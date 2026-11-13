'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QuadraticBezierLine } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { useGameStore } from '@/store/useGameStore';
import { CardInstance, PlayerSeat } from '@/types/game';

export interface CreatureChoreographyHandle {
  cardId: string;
  owner: PlayerSeat;
  rootGroup: THREE.Group | null;
  getWorldSlotPosition: () => THREE.Vector3;
  triggerAttackAnimation: (
    targetWorldPos: THREE.Vector3,
    onImpactCallback: () => void
  ) => Promise<void>;
  triggerWhiteFlash: (active: boolean) => void;
}

class CombatChoreographyRegistry {
  private handles = new Map<string, CreatureChoreographyHandle>();

  public register(cardId: string, handle: CreatureChoreographyHandle): void {
    this.handles.set(cardId, handle);
  }

  public unregister(cardId: string): void {
    this.handles.delete(cardId);
  }

  public get(cardId: string): CreatureChoreographyHandle | undefined {
    return this.handles.get(cardId);
  }
}

export const combatRegistry = new CombatChoreographyRegistry();

const SLOT_COUNT = 6;
const CREATURE_SLOT_SPACING = 0.54;
const LAND_SLOT_SPACING = 0.52;

export function computeSlotWorldCoords(
  seat: PlayerSeat,
  zone: 'BATTLEFIELD_CREATURE' | 'BATTLEFIELD_LAND',
  slotIndex: number
): [number, number, number] {
  const zSign = seat === 'P1' ? 1 : -1;
  const offsetIdx = slotIndex - (SLOT_COUNT - 1) / 2;
  const spacing =
    zone === 'BATTLEFIELD_CREATURE'
      ? CREATURE_SLOT_SPACING
      : LAND_SLOT_SPACING;
  const x = offsetIdx * spacing * zSign;
  const y = 0.82;
  const z = (zone === 'BATTLEFIELD_CREATURE' ? 0.56 : 1.38) * zSign;
  return [x, y, z];
}

export function computeGraveyardWorldCoords(
  seat: PlayerSeat
): [number, number, number] {
  const zSign = seat === 'P1' ? 1 : -1;
  return [-1.85 * zSign, 0.85, 1.35 * zSign];
}

export function computeHandOriginWorldCoords(
  seat: PlayerSeat,
  localSeat: PlayerSeat
): [number, number, number] {
  if (seat === localSeat) {
    const zSign = seat === 'P1' ? 1 : -1;
    return [0, 0.95, 2.7 * zSign];
  }
  const oppSign = seat === 'P1' ? 1 : -1;
  return [0, 1.3, 2.7 * oppSign];
}

let sharedCombatAudioCtx: AudioContext | null = null;

function getSharedCombatAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedCombatAudioCtx || sharedCombatAudioCtx.state === 'closed') {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    sharedCombatAudioCtx = new AudioCtx();
  }
  if (sharedCombatAudioCtx.state === 'suspended') {
    sharedCombatAudioCtx.resume().catch(() => undefined);
  }
  return sharedCombatAudioCtx;
}

export function playProceduralCombatSound(
  type: 'CLASH' | 'AVATAR_HIT' | 'SHATTER' | 'SUMMON'
): void {
  const ctx = getSharedCombatAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'CLASH') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.24);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } else if (type === 'AVATAR_HIT') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.38);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);
    } else if (type === 'SHATTER') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.32);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.3);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.34);
    }
  } catch {
    // Ignore if audio context awaits gesture
  }
}

interface ImpactBurstInstance {
  id: string;
  origin: [number, number, number];
  color: string;
}

interface ShatterExplosionInstance {
  id: string;
  origin: [number, number, number];
  graveyardTarget: [number, number, number];
  color: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ImpactBurstEffect: React.FC<{
  burst: ImpactBurstInstance;
  onDone: (id: string) => void;
}> = ({ burst, onDone }) => {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const tl = gsap.timeline({
      onComplete: () => onDone(burst.id),
    });

    group.children.forEach((child, idx) => {
      const mesh = child as THREE.Mesh;
      const angle = (idx / group.children.length) * Math.PI * 2;
      const radius = 0.25 + (idx % 3) * 0.1;
      const dx = Math.cos(angle) * radius;
      const dy = 0.12 + (idx % 2) * 0.14;
      const dz = Math.sin(angle) * radius;

      tl.fromTo(
        mesh.position,
        { x: 0, y: 0, z: 0 },
        {
          x: dx,
          y: dy,
          z: dz,
          duration: 0.36,
          ease: 'power2.out',
        },
        0
      );
      tl.to(
        mesh.scale,
        {
          x: 0.01,
          y: 0.01,
          z: 0.01,
          duration: 0.36,
          ease: 'power2.in',
        },
        0
      );
    });

    return () => {
      tl.kill();
    };
  }, [burst, onDone]);

  const particles = Array.from({ length: 10 }).map((_, idx) =>
    React.createElement(
      'mesh',
      { key: idx },
      React.createElement('octahedronGeometry', { args: [0.038, 0] }),
      React.createElement('meshBasicMaterial', {
        color: idx % 2 === 0 ? burst.color : '#f5b041',
      })
    )
  );

  return React.createElement(
    'group',
    { ref: groupRef, position: burst.origin },
    ...particles
  );
};

const DeathShatterEffect: React.FC<{
  shatter: ShatterExplosionInstance;
  onDone: (id: string) => void;
}> = ({ shatter, onDone }) => {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const relGraveX = shatter.graveyardTarget[0] - shatter.origin[0];
    const relGraveY = shatter.graveyardTarget[1] - shatter.origin[1];
    const relGraveZ = shatter.graveyardTarget[2] - shatter.origin[2];

    const tl = gsap.timeline({
      onComplete: () => onDone(shatter.id),
    });

    group.children.forEach((child, idx) => {
      const mesh = child as THREE.Mesh;
      const angle = (idx / 12) * Math.PI * 2;
      const spread = 0.24 + (idx % 3) * 0.08;
      const burstX = Math.cos(angle) * spread;
      const burstY = 0.22 + (idx % 4) * 0.07;
      const burstZ = Math.sin(angle) * spread;

      tl.fromTo(
        mesh.position,
        { x: 0, y: 0.1, z: 0 },
        {
          x: burstX,
          y: burstY,
          z: burstZ,
          duration: 0.26,
          ease: 'power2.out',
        },
        0
      );

      tl.to(
        mesh.rotation,
        {
          x: idx * 1.7,
          y: idx * 2.3,
          z: idx * 1.1,
          duration: 0.68,
          ease: 'none',
        },
        0
      );

      tl.to(
        mesh.position,
        {
          x: relGraveX + ((idx % 3) - 1) * 0.04,
          y: relGraveY + 0.04,
          z: relGraveZ + ((idx % 2) - 0.5) * 0.04,
          duration: 0.44,
          ease: 'power2.inOut',
        },
        0.26
      );

      tl.to(
        mesh.scale,
        {
          x: 0.05,
          y: 0.05,
          z: 0.05,
          duration: 0.44,
          ease: 'power2.in',
        },
        0.26
      );
    });

    return () => {
      tl.kill();
    };
  }, [shatter, onDone]);

  const shards = Array.from({ length: 12 }).map((_, idx) =>
    React.createElement(
      'mesh',
      { key: idx },
      React.createElement('tetrahedronGeometry', { args: [0.052, 0] }),
      React.createElement('meshLambertMaterial', {
        color: idx % 3 === 0 ? '#ffffff' : shatter.color,
        emissive: shatter.color,
        flatShading: true,
      })
    )
  );

  return React.createElement(
    'group',
    { ref: groupRef, position: shatter.origin },
    ...shards
  );
};

export const CombatChoreographer: React.FC = () => {
  const cards = useGameStore((s) => s.cards);
  const phase = useGameStore((s) => s.phase);
  const combatSequenceId = useGameStore((s) => s.combatSequenceId);
  const isCombatChoreographyPlaying = useGameStore(
    (s) => s.isCombatChoreographyPlaying
  );

  const [bursts, setBursts] = useState<ImpactBurstInstance[]>([]);
  const [shatters, setShatters] = useState<ShatterExplosionInstance[]>([]);
  const runningSequenceRef = useRef<number>(0);

  const spawnBurst = (origin: [number, number, number], color: string) => {
    const id = `burst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setBursts((prev) => [...prev, { id, origin, color }]);
  };

  const removeBurst = (id: string) => {
    setBursts((prev) => prev.filter((b) => b.id !== id));
  };

  const spawnShatter = (
    origin: [number, number, number],
    graveyardTarget: [number, number, number],
    color: string
  ): Promise<void> => {
    return new Promise((resolve) => {
      const id = `shatter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setShatters((prev) => [
        ...prev,
        { id, origin, graveyardTarget, color },
      ]);
      setTimeout(() => {
        setShatters((prev) => prev.filter((s) => s.id !== id));
        resolve();
      }, 720);
    });
  };

  const blockingArcs = useMemo(() => {
    const arcs: Array<{
      id: string;
      start: [number, number, number];
      mid: [number, number, number];
      end: [number, number, number];
    }> = [];

    const blockers = cards.filter(
      (c) =>
        c.zone === 'BATTLEFIELD_CREATURE' && c.blockingAttackerId !== null
    );

    blockers.forEach((blocker) => {
      const attacker = cards.find((c) => c.id === blocker.blockingAttackerId);
      if (!attacker) return;

      const startCoords = computeSlotWorldCoords(
        blocker.owner,
        'BATTLEFIELD_CREATURE',
        blocker.slotIndex ?? 0
      );
      const endCoords = computeSlotWorldCoords(
        attacker.owner,
        'BATTLEFIELD_CREATURE',
        attacker.slotIndex ?? 0
      );

      const start: [number, number, number] = [
        startCoords[0],
        startCoords[1] + 0.16,
        startCoords[2],
      ];
      const end: [number, number, number] = [
        endCoords[0],
        endCoords[1] + 0.16,
        endCoords[2],
      ];
      const mid: [number, number, number] = [
        (start[0] + end[0]) * 0.5,
        1.34,
        (start[2] + end[2]) * 0.5,
      ];

      arcs.push({
        id: `bezier-block-${blocker.id}-${attacker.id}`,
        start,
        mid,
        end,
      });
    });

    return arcs;
  }, [cards]);

  useEffect(() => {
    if (
      phase !== 'COMBAT_RESOLUTION_AND_END' ||
      !isCombatChoreographyPlaying ||
      combatSequenceId === runningSequenceRef.current
    ) {
      return;
    }

    runningSequenceRef.current = combatSequenceId;
    let cancelled = false;

    async function runSequentialCombatTimeline() {
      const store = useGameStore.getState();
      const attackingSeat = store.activePlayer;
      const defendingSeat: PlayerSeat = attackingSeat === 'P1' ? 'P2' : 'P1';

      const attackers = store.cards
        .filter(
          (c) =>
            c.owner === attackingSeat &&
            c.zone === 'BATTLEFIELD_CREATURE' &&
            c.isAttacking
        )
        .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

      for (const attacker of attackers) {
        if (cancelled || useGameStore.getState().winner) break;

        const latestCards = useGameStore.getState().cards;
        const currentAttacker = latestCards.find((c) => c.id === attacker.id);
        if (
          !currentAttacker ||
          currentAttacker.zone !== 'BATTLEFIELD_CREATURE'
        ) {
          continue;
        }

        const assignedBlockers = latestCards.filter(
          (c) =>
            c.owner === defendingSeat &&
            c.zone === 'BATTLEFIELD_CREATURE' &&
            c.blockingAttackerId === currentAttacker.id
        );

        const attackerHandle = combatRegistry.get(currentAttacker.id);
        const attackerSlotPos = computeSlotWorldCoords(
          currentAttacker.owner,
          'BATTLEFIELD_CREATURE',
          currentAttacker.slotIndex ?? 0
        );

        if (assignedBlockers.length > 0) {
          const primaryBlocker = assignedBlockers[0];
          const blockerHandle = combatRegistry.get(primaryBlocker.id);
          const blockerSlotPos = computeSlotWorldCoords(
            primaryBlocker.owner,
            'BATTLEFIELD_CREATURE',
            primaryBlocker.slotIndex ?? 0
          );

          const midpoint: [number, number, number] = [
            (attackerSlotPos[0] + blockerSlotPos[0]) * 0.5,
            0.98,
            (attackerSlotPos[2] + blockerSlotPos[2]) * 0.5,
          ];

          const targetVecForAttacker = new THREE.Vector3(
            blockerSlotPos[0],
            blockerSlotPos[1],
            blockerSlotPos[2]
          );
          const targetVecForBlocker = new THREE.Vector3(
            attackerSlotPos[0],
            attackerSlotPos[1],
            attackerSlotPos[2]
          );

          const applyClashDamage = () => {
            playProceduralCombatSound('CLASH');
            spawnBurst(midpoint, currentAttacker.accentHex);

            const atkLifelink = currentAttacker.keywords.includes('Lifelink')
              ? currentAttacker.power
              : 0;
            const blkLifelink = primaryBlocker.keywords.includes('Lifelink')
              ? primaryBlocker.power
              : 0;

            useGameStore
              .getState()
              .applyLiveCreatureDamage(
                primaryBlocker.id,
                currentAttacker.power,
                currentAttacker.keywords.includes('Deathtouch'),
                currentAttacker.owner,
                atkLifelink
              );

            useGameStore
              .getState()
              .applyLiveCreatureDamage(
                currentAttacker.id,
                primaryBlocker.power,
                primaryBlocker.keywords.includes('Deathtouch'),
                primaryBlocker.owner,
                blkLifelink
              );
          };

          const atkPromise = attackerHandle
            ? attackerHandle.triggerAttackAnimation(
                targetVecForAttacker,
                applyClashDamage
              )
            : (async () => {
                await sleep(350);
                applyClashDamage();
                await sleep(350);
              })();

          const blkPromise = blockerHandle
            ? blockerHandle.triggerAttackAnimation(
                targetVecForBlocker,
                () => undefined
              )
            : Promise.resolve();

          await Promise.all([atkPromise, blkPromise]);

          const postClashCards = useGameStore.getState().cards;
          const updatedBlocker = postClashCards.find(
            (c) => c.id === primaryBlocker.id
          );
          const updatedAttacker = postClashCards.find(
            (c) => c.id === currentAttacker.id
          );

          const lethalList: Array<{
            card: CardInstance;
            origin: [number, number, number];
          }> = [];

          if (
            updatedBlocker &&
            (updatedBlocker.damageMarked >= updatedBlocker.toughness ||
              updatedBlocker.deathtouchDamageReceived)
          ) {
            lethalList.push({ card: updatedBlocker, origin: blockerSlotPos });
          }

          if (
            updatedAttacker &&
            (updatedAttacker.damageMarked >= updatedAttacker.toughness ||
              updatedAttacker.deathtouchDamageReceived)
          ) {
            lethalList.push({ card: updatedAttacker, origin: attackerSlotPos });
          }

          if (lethalList.length > 0) {
            lethalList.forEach(({ card }) => {
              combatRegistry.get(card.id)?.triggerWhiteFlash(true);
            });
            await sleep(150);

            playProceduralCombatSound('SHATTER');

            await Promise.all(
              lethalList.map(async ({ card, origin }) => {
                combatRegistry.get(card.id)?.triggerWhiteFlash(false);
                useGameStore.getState().shatterCreatureToGraveyard(card.id);
                const gravePos = computeGraveyardWorldCoords(card.owner);
                await spawnShatter(origin, gravePos, card.accentHex);
              })
            );
          }
        } else {
          const defenderAvatarZ = defendingSeat === 'P2' ? -3.2 : 3.2;
          const avatarOrbPos: [number, number, number] = [
            0,
            1.4,
            defenderAvatarZ,
          ];
          const avatarTargetVec = new THREE.Vector3(
            avatarOrbPos[0],
            avatarOrbPos[1],
            avatarOrbPos[2]
          );

          const applyFaceStrike = () => {
            playProceduralCombatSound('AVATAR_HIT');
            spawnBurst(avatarOrbPos, currentAttacker.accentHex);

            const atkLifelink = currentAttacker.keywords.includes('Lifelink')
              ? currentAttacker.power
              : 0;

            useGameStore
              .getState()
              .applyLivePlayerDamage(
                defendingSeat,
                currentAttacker.power,
                currentAttacker.owner,
                atkLifelink,
                currentAttacker.name
              );
          };

          if (attackerHandle) {
            await attackerHandle.triggerAttackAnimation(
              avatarTargetVec,
              applyFaceStrike
            );
          } else {
            await sleep(350);
            applyFaceStrike();
            await sleep(350);
          }
        }

        await sleep(220);
      }

      if (!cancelled) {
        useGameStore.getState().completeCombatChoreographyAndPassTurn();
      }
    }

    runSequentialCombatTimeline();

    return () => {
      cancelled = true;
    };
  }, [phase, isCombatChoreographyPlaying, combatSequenceId]);

  const arcElements = blockingArcs.map((arc) =>
    React.createElement(QuadraticBezierLine, {
      key: arc.id,
      start: arc.start,
      mid: arc.mid,
      end: arc.end,
      color: '#00f0ff',
      lineWidth: 3.5,
      dashed: false,
    })
  );

  const burstElements = bursts.map((b) =>
    React.createElement(ImpactBurstEffect, {
      key: b.id,
      burst: b,
      onDone: removeBurst,
    })
  );

  const shatterElements = shatters.map((s) =>
    React.createElement(DeathShatterEffect, {
      key: s.id,
      shatter: s,
      onDone: () => undefined,
    })
  );

  return React.createElement(
    'group',
    { name: 'combat-choreographer-fx' },
    ...arcElements,
    ...burstElements,
    ...shatterElements
  );
};
