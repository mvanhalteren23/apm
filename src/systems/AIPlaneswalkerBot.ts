'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { CardInstance } from '@/types/game';

const AI_STEP_DELAY_MS = 850;

const HERO_PRIORITY_NAMES = new Set([
  'Crimson Hellkite',
  'Aether Colossus',
  'Obsidian Shade',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sortBotHandByPriority(cards: CardInstance[]): CardInstance[] {
  return [...cards].sort((a, b) => {
    if (b.manaCost !== a.manaCost) {
      return b.manaCost - a.manaCost;
    }
    const aHero = HERO_PRIORITY_NAMES.has(a.name) ? 1 : 0;
    const bHero = HERO_PRIORITY_NAMES.has(b.name) ? 1 : 0;
    if (bHero !== aHero) {
      return bHero - aHero;
    }
    return b.power - a.power;
  });
}

export class AIPlaneswalkerBotEngine {
  private isExecuting = false;

  public async evaluateAndExecute(): Promise<void> {
    if (this.isExecuting) return;

    const initial = useGameStore.getState();
    if (
      initial.winner ||
      initial.isCombatChoreographyPlaying ||
      initial.gameMode !== 'SOLO_AI' ||
      !initial.players.P2.isBot
    ) {
      return;
    }

    const isBotMainOrAttack =
      initial.activePlayer === 'P2' &&
      (initial.phase === 'START_AND_MAIN_1' ||
        initial.phase === 'DECLARE_ATTACKERS');

    const isBotBlocking =
      initial.activePlayer === 'P1' &&
      initial.phase === 'DECLARE_BLOCKERS' &&
      initial.priorityPlayer === 'P2';

    if (!isBotMainOrAttack && !isBotBlocking) {
      return;
    }

    this.isExecuting = true;

    try {
      if (isBotBlocking) {
        await this.executeDefensiveBlockingSequence();
      } else if (initial.phase === 'START_AND_MAIN_1') {
        await this.executeMainPhaseSequence();
      } else if (initial.phase === 'DECLARE_ATTACKERS') {
        await this.executeAttackDeclarationSequence();
      }
    } finally {
      this.isExecuting = false;
    }
  }

  private isStillValidBotTurn(expectedPhase: string): boolean {
    const s = useGameStore.getState();
    return (
      !s.winner &&
      !s.isCombatChoreographyPlaying &&
      s.gameMode === 'SOLO_AI' &&
      s.players.P2.isBot &&
      s.phase === expectedPhase
    );
  }

  private async executeMainPhaseSequence(): Promise<void> {
    await sleep(AI_STEP_DELAY_MS);
    if (!this.isStillValidBotTurn('START_AND_MAIN_1')) return;

    let state = useGameStore.getState();
    if (state.players.P2.landsPlayedThisTurn < state.players.P2.maxLandsPerTurn) {
      const botLandsInHand = state.cards.filter(
        (c) => c.owner === 'P2' && c.zone === 'HAND' && c.type === 'LAND'
      );
      if (botLandsInHand.length > 0) {
        const landToPlay = botLandsInHand[0];
        useGameStore.getState().playLandToSlot(landToPlay.id, undefined, 'P2');
        await sleep(AI_STEP_DELAY_MS);
        if (!this.isStillValidBotTurn('START_AND_MAIN_1')) return;
      }
    }

    while (this.isStillValidBotTurn('START_AND_MAIN_1')) {
      state = useGameStore.getState();
      const botCreaturesOnBoard = state.cards.filter(
        (c) => c.owner === 'P2' && c.zone === 'BATTLEFIELD_CREATURE'
      );
      if (botCreaturesOnBoard.length >= 6) break;

      const untappedLands = state.cards.filter(
        (c) => c.owner === 'P2' && c.zone === 'BATTLEFIELD_LAND' && !c.tapped
      );
      const totalAvailableMana =
        state.players.P2.manaPool + untappedLands.length;

      const castableCreatures = sortBotHandByPriority(
        state.cards.filter(
          (c) =>
            c.owner === 'P2' &&
            c.zone === 'HAND' &&
            c.type === 'CREATURE' &&
            c.manaCost <= totalAvailableMana
        )
      );

      if (castableCreatures.length === 0) break;

      const chosenCreature = castableCreatures[0];

      while (
        useGameStore.getState().players.P2.manaPool < chosenCreature.manaCost
      ) {
        if (!this.isStillValidBotTurn('START_AND_MAIN_1')) return;
        const nextUntappedLand = useGameStore
          .getState()
          .cards.find(
            (c) =>
              c.owner === 'P2' && c.zone === 'BATTLEFIELD_LAND' && !c.tapped
          );
        if (!nextUntappedLand) break;

        useGameStore.getState().tapLandForMana(nextUntappedLand.id, 'P2');
        await sleep(AI_STEP_DELAY_MS);
      }

      if (!this.isStillValidBotTurn('START_AND_MAIN_1')) return;
      const summoned = useGameStore
        .getState()
        .summonCreatureToSlot(chosenCreature.id, undefined, 'P2');

      if (!summoned) break;
      await sleep(AI_STEP_DELAY_MS);
    }

    while (this.isStillValidBotTurn('START_AND_MAIN_1')) {
      state = useGameStore.getState();
      const untappedLands = state.cards.filter(
        (c) => c.owner === 'P2' && c.zone === 'BATTLEFIELD_LAND' && !c.tapped
      );
      const totalAvailableMana =
        state.players.P2.manaPool + untappedLands.length;

      const castableSpells = sortBotHandByPriority(
        state.cards.filter(
          (c) =>
            c.owner === 'P2' &&
            c.zone === 'HAND' &&
            c.type === 'SPELL' &&
            c.manaCost <= totalAvailableMana
        )
      );

      if (castableSpells.length === 0) break;

      const spell = castableSpells[0];
      const spellDamage = spell.power || 3;
      const humanLife = state.players.P1.life;

      const humanCreatures = state.cards
        .filter((c) => c.owner === 'P1' && c.zone === 'BATTLEFIELD_CREATURE')
        .sort((a, b) => b.power - a.power);

      while (useGameStore.getState().players.P2.manaPool < spell.manaCost) {
        if (!this.isStillValidBotTurn('START_AND_MAIN_1')) return;
        const nextUntappedLand = useGameStore
          .getState()
          .cards.find(
            (c) =>
              c.owner === 'P2' && c.zone === 'BATTLEFIELD_LAND' && !c.tapped
          );
        if (!nextUntappedLand) break;

        useGameStore.getState().tapLandForMana(nextUntappedLand.id, 'P2');
        await sleep(AI_STEP_DELAY_MS);
      }

      if (!this.isStillValidBotTurn('START_AND_MAIN_1')) return;

      if (humanLife <= spellDamage || humanCreatures.length === 0) {
        useGameStore
          .getState()
          .castSpellOnTarget(spell.id, 'PLAYER', 'P1', 'P2');
      } else {
        useGameStore
          .getState()
          .castSpellOnTarget(
            spell.id,
            'CREATURE',
            humanCreatures[0].id,
            'P2'
          );
      }

      await sleep(AI_STEP_DELAY_MS);
    }

    if (this.isStillValidBotTurn('START_AND_MAIN_1')) {
      useGameStore.getState().advancePhase('P2');
    }
  }

  private async executeAttackDeclarationSequence(): Promise<void> {
    await sleep(AI_STEP_DELAY_MS);
    if (!this.isStillValidBotTurn('DECLARE_ATTACKERS')) return;

    const state = useGameStore.getState();
    const eligibleBotAttackers = state.cards.filter(
      (c) =>
        c.owner === 'P2' &&
        c.zone === 'BATTLEFIELD_CREATURE' &&
        !c.tapped &&
        (!c.summoningSick || c.keywords.includes('Haste'))
    );

    const humanUntappedBlockers = state.cards.filter(
      (c) => c.owner === 'P1' && c.zone === 'BATTLEFIELD_CREATURE' && !c.tapped
    );

    const humanHasUntappedFlyer = humanUntappedBlockers.some((c) =>
      c.keywords.includes('Flying')
    );

    const humanHighestUntappedToughness = humanUntappedBlockers.reduce(
      (max, c) => Math.max(max, c.toughness - c.damageMarked),
      0
    );

    const sortedBotPowers = [...eligibleBotAttackers]
      .map((c) => c.power)
      .sort((a, b) => b - a);
    const unblockedCount = Math.max(
      0,
      eligibleBotAttackers.length - humanUntappedBlockers.length
    );
    const guaranteedUnblockedDamage = sortedBotPowers
      .slice(eligibleBotAttackers.length - unblockedCount)
      .reduce((sum, p) => sum + p, 0);
    const allOutLethal = guaranteedUnblockedDamage >= state.players.P1.life;

    for (const botCreature of eligibleBotAttackers) {
      if (!this.isStillValidBotTurn('DECLARE_ATTACKERS')) return;

      const hasFlyingAdvantage =
        botCreature.keywords.includes('Flying') && !humanHasUntappedFlyer;
      const hasDeathtouch = botCreature.keywords.includes('Deathtouch');
      const overpowersDefender =
        botCreature.power > humanHighestUntappedToughness;

      if (
        allOutLethal ||
        hasFlyingAdvantage ||
        hasDeathtouch ||
        overpowersDefender
      ) {
        useGameStore.getState().toggleAttacker(botCreature.id, 'P2');
        await sleep(AI_STEP_DELAY_MS);
      }
    }

    if (this.isStillValidBotTurn('DECLARE_ATTACKERS')) {
      useGameStore.getState().advancePhase('P2');
    }
  }

  private async executeDefensiveBlockingSequence(): Promise<void> {
    await sleep(AI_STEP_DELAY_MS);
    if (!this.isStillValidBotTurn('DECLARE_BLOCKERS')) return;

    const state = useGameStore.getState();
    const incomingAttackers = state.cards
      .filter(
        (c) =>
          c.owner === 'P1' &&
          c.zone === 'BATTLEFIELD_CREATURE' &&
          c.isAttacking
      )
      .sort((a, b) => b.power - a.power);

    const availableBotBlockers = state.cards.filter(
      (c) => c.owner === 'P2' && c.zone === 'BATTLEFIELD_CREATURE' && !c.tapped
    );

    let projectedUnblockedDamage = incomingAttackers.reduce(
      (sum, c) => sum + c.power,
      0
    );
    const botLife = state.players.P2.life;
    const usedBlockerIds = new Set<string>();

    for (const attacker of incomingAttackers) {
      if (!this.isStillValidBotTurn('DECLARE_BLOCKERS')) return;

      const attackerFlies = attacker.keywords.includes('Flying');
      const attackerHasDeathtouch = attacker.keywords.includes('Deathtouch');
      const attackerRemainingToughness =
        attacker.toughness - attacker.damageMarked;

      const legalBlockers = availableBotBlockers.filter(
        (b) =>
          !usedBlockerIds.has(b.id) &&
          (!attackerFlies || b.keywords.includes('Flying'))
      );

      if (legalBlockers.length === 0) continue;

      const favorableBlocker = legalBlockers.find((b) => {
        const canKillAttacker =
          b.power >= attackerRemainingToughness ||
          b.keywords.includes('Deathtouch');
        const blockerSurvives =
          attacker.power < b.toughness - b.damageMarked &&
          !attackerHasDeathtouch;
        const tradesUpOrEvenInCost = attacker.manaCost >= b.manaCost;
        return canKillAttacker && (blockerSurvives || tradesUpOrEvenInCost);
      });

      if (favorableBlocker) {
        usedBlockerIds.add(favorableBlocker.id);
        projectedUnblockedDamage -= attacker.power;
        useGameStore
          .getState()
          .assignBlocker(favorableBlocker.id, attacker.id, 'P2');
        await sleep(AI_STEP_DELAY_MS);
        continue;
      }

      if (projectedUnblockedDamage >= botLife) {
        const cheapestChumpBlocker = [...legalBlockers].sort(
          (a, b) => a.manaCost - b.manaCost || a.power - b.power
        )[0];

        if (cheapestChumpBlocker) {
          usedBlockerIds.add(cheapestChumpBlocker.id);
          projectedUnblockedDamage -= attacker.power;
          useGameStore
            .getState()
            .assignBlocker(cheapestChumpBlocker.id, attacker.id, 'P2');
          await sleep(AI_STEP_DELAY_MS);
        }
      }
    }

    if (this.isStillValidBotTurn('DECLARE_BLOCKERS')) {
      useGameStore.getState().advancePhase('P2');
    }
  }
}

export const singletonAIBot = new AIPlaneswalkerBotEngine();

export function useAIPlaneswalkerBot(): void {
  const gameMode = useGameStore((s) => s.gameMode);
  const isBot = useGameStore((s) => s.players.P2.isBot);
  const activePlayer = useGameStore((s) => s.activePlayer);
  const priorityPlayer = useGameStore((s) => s.priorityPlayer);
  const phase = useGameStore((s) => s.phase);
  const isCombatChoreographyPlaying = useGameStore(
    (s) => s.isCombatChoreographyPlaying
  );
  const turnNumber = useGameStore((s) => s.turnNumber);
  const winner = useGameStore((s) => s.winner);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (
      winner ||
      isCombatChoreographyPlaying ||
      gameMode !== 'SOLO_AI' ||
      !isBot
    ) {
      return;
    }

    const shouldAct =
      (activePlayer === 'P2' &&
        (phase === 'START_AND_MAIN_1' || phase === 'DECLARE_ATTACKERS')) ||
      (activePlayer === 'P1' &&
        phase === 'DECLARE_BLOCKERS' &&
        priorityPlayer === 'P2');

    if (!shouldAct) return;

    timerRef.current = setTimeout(() => {
      singletonAIBot.evaluateAndExecute();
    }, 350);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [
    gameMode,
    isBot,
    activePlayer,
    priorityPlayer,
    phase,
    isCombatChoreographyPlaying,
    turnNumber,
    winner,
  ]);
}
