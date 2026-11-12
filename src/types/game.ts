export type PlayerSeat = 'P1' | 'P2';

export type GameMode = 'MULTIPLAYER' | 'SOLO_AI';

export type MobileCameraPreset = 'DUEL' | 'TOP' | 'HAND';

export type ManaColor = 'CRIMSON' | 'AETHER' | 'OBSIDIAN';

export type CardType = 'LAND' | 'CREATURE' | 'SPELL';

export type CardKeyword = 'Haste' | 'Flying' | 'Deathtouch' | 'Lifelink';

export type CreatureArchetype =
  | 'DRAGON_HERO'
  | 'GOLEM_HERO'
  | 'SHADE_HERO'
  | 'GOBLIN'
  | 'KNIGHT'
  | 'SPRITE'
  | 'ELEMENTAL'
  | 'LAND'
  | 'SPELL';

export type CardZone =
  | 'LIBRARY'
  | 'HAND'
  | 'BATTLEFIELD_LAND'
  | 'BATTLEFIELD_CREATURE'
  | 'GRAVEYARD';

export type TurnPhase =
  | 'START_AND_MAIN_1'
  | 'DECLARE_ATTACKERS'
  | 'DECLARE_BLOCKERS'
  | 'COMBAT_RESOLUTION_AND_END';

export interface ManaPoolByColor {
  CRIMSON: number;
  AETHER: number;
  OBSIDIAN: number;
}

export interface CardInstance {
  id: string;
  templateId: string;
  owner: PlayerSeat;
  name: string;
  type: CardType;
  archetype: CreatureArchetype;
  manaCost: number;
  manaColor: ManaColor;
  power: number;
  toughness: number;
  damageMarked: number;
  deathtouchDamageReceived: boolean;
  keywords: CardKeyword[];
  zone: CardZone;
  slotIndex: number | null;
  tapped: boolean;
  summoningSick: boolean;
  isAttacking: boolean;
  blockingAttackerId: string | null;
  summonedAt: number | null;
  rulesText: string;
  accentHex: string;
}

export interface PlayerState {
  seat: PlayerSeat;
  playroomPlayerId: string | null;
  displayName: string;
  isBot: boolean;
  life: number;
  manaPool: number;
  manaColors: ManaPoolByColor;
  maxLandsPerTurn: number;
  landsPlayedThisTurn: number;
  isConnected: boolean;
  micActive: boolean;
}

export interface CombatAnimationEvent {
  id: string;
  attackerId: string;
  blockerId?: string | null;
  targetType: 'PLAYER' | 'CREATURE';
  targetId: string;
  damage: number;
  lifelinkHealed?: number;
  timestamp: number;
}

export interface BotVoiceEvent {
  id: string;
  text: string;
  mood: 'SUMMON' | 'ATTACK' | 'BLOCK' | 'DAMAGE' | 'TAUNT';
  timestamp: number;
}

export interface SynchronizedMatchState {
  matchId: string;
  gameMode: GameMode;
  turnNumber: number;
  activePlayer: PlayerSeat;
  priorityPlayer: PlayerSeat;
  phase: TurnPhase;
  isCombatChoreographyPlaying: boolean;
  combatSequenceId: number;
  players: Record<PlayerSeat, PlayerState>;
  cards: CardInstance[];
  selectedCardId: string | null;
  selectedBlockerId: string | null;
  lastCombatEvent: CombatAnimationEvent | null;
  botVoiceEvent: BotVoiceEvent | null;
  combatLog: string[];
  winner: PlayerSeat | null;
}

export interface WebRTCSignalPayload {
  senderPlayroomId: string;
  senderSeat: PlayerSeat;
  targetSeat: PlayerSeat;
  type: 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE' | 'PING_READY';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
