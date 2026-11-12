'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { insertCoin, onPlayerJoin, myPlayer } from 'playroomkit';
import { PHASE_LABELS, useGameStore } from '@/store/useGameStore';
import { GameMode, MobileCameraPreset, PlayerSeat } from '@/types/game';

const MobileArenaScene = dynamic(
  () => import('@/components/MobileArenaScene'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-[100dvh] bg-[#060913] text-cyan-400 font-mono text-sm tracking-widest">
        LOADING 3D MOBILE ARENA...
      </div>
    ),
  }
);

export interface MobileGameAppProps {
  initialRoom?: string;
  initialMode?: GameMode;
  initialSeat?: PlayerSeat;
  autoLaunch?: boolean;
}

function unlockMobileAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    setTimeout(() => ctx.close().catch(() => undefined), 200);
  } catch {
    // Ignore
  }
}

export const MobileGameApp: React.FC<MobileGameAppProps> = ({
  initialRoom,
  initialMode,
  initialSeat,
  autoLaunch = false,
}) => {
  const localSeat = useGameStore((s) => s.localSeat);
  const roomCode = useGameStore((s) => s.roomCode);
  const gameMode = useGameStore((s) => s.gameMode);
  const isLobbyEntered = useGameStore((s) => s.isLobbyEntered);
  const cameraPreset = useGameStore((s) => s.cameraPreset);
  const isMicMuted = useGameStore((s) => s.isMicMuted);
  const localMicStream = useGameStore((s) => s.localMicStream);
  const localMicLevel = useGameStore((s) => s.localMicLevel);
  const remoteVoiceLevel = useGameStore((s) => s.remoteVoiceLevel);
  const remotePeerConnected = useGameStore((s) => s.remotePeerConnected);
  const turnNumber = useGameStore((s) => s.turnNumber);
  const priorityPlayer = useGameStore((s) => s.priorityPlayer);
  const phase = useGameStore((s) => s.phase);
  const isCombatChoreographyPlaying = useGameStore(
    (s) => s.isCombatChoreographyPlaying
  );
  const players = useGameStore((s) => s.players);
  const cards = useGameStore((s) => s.cards);
  const selectedCardId = useGameStore((s) => s.selectedCardId);
  const combatLog = useGameStore((s) => s.combatLog);
  const winner = useGameStore((s) => s.winner);

  const setLocalSeat = useGameStore((s) => s.setLocalSeat);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setGameMode = useGameStore((s) => s.setGameMode);
  const setCameraPreset = useGameStore((s) => s.setCameraPreset);
  const toggleMicMute = useGameStore((s) => s.toggleMicMute);
  const clearSelection = useGameStore((s) => s.clearSelection);
  const spawnAIOpponent = useGameStore((s) => s.spawnAIOpponent);
  const setLobbyEntered = useGameStore((s) => s.setLobbyEntered);
  const setPlayroomConnected = useGameStore((s) => s.setPlayroomConnected);
  const setLocalMicStream = useGameStore((s) => s.setLocalMicStream);
  const setLocalMicLevel = useGameStore((s) => s.setLocalMicLevel);
  const playLandToSlot = useGameStore((s) => s.playLandToSlot);
  const summonCreatureToSlot = useGameStore((s) => s.summonCreatureToSlot);
  const castSpellOnTarget = useGameStore((s) => s.castSpellOnTarget);
  const advancePhase = useGameStore((s) => s.advancePhase);
  const resetMatch = useGameStore((s) => s.resetMatch);

  const [micStatus, setMicStatus] = useState<'IDLE' | 'TESTING' | 'READY' | 'BLOCKED'>('IDLE');
  const [micError, setMicError] = useState<string | null>(null);
  const [joiningRoom, setJoiningRoom] = useState<boolean>(false);

  const micRafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const autoLaunchedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const qRoom = initialRoom || params.get('r');
    const qMode =
      initialMode ||
      (params.get('m') === 'pvp'
        ? 'MULTIPLAYER'
        : params.get('m') === 'ai'
        ? 'SOLO_AI'
        : undefined);
    const qSeat =
      initialSeat || (params.get('s') === '2' ? 'P2' : undefined);

    if (qRoom) {
      setRoomCode(qRoom.toUpperCase().slice(0, 12));
    }
    if (qMode) {
      setGameMode(qMode);
    }
    if (qSeat) {
      setLocalSeat(qSeat);
    }

    if (autoLaunch && !autoLaunchedRef.current) {
      autoLaunchedRef.current = true;
      const targetMode = qMode ?? 'SOLO_AI';
      if (targetMode === 'SOLO_AI') {
        setLocalSeat('P1');
        spawnAIOpponent();
        setLobbyEntered(true);
      } else {
        handleJoinMatch(qRoom?.toUpperCase() || undefined, targetMode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom, initialMode, initialSeat, autoLaunch]);

  useEffect(() => {
    return () => {
      if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => undefined);
      }
    };
  }, []);

  const runMobileMicCheck = async () => {
    unlockMobileAudio();
    setMicStatus('TESTING');
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      setLocalMicStream(stream);
      setMicStatus('READY');

      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const normalized = Math.min(100, Math.round((sum / dataArray.length / 110) * 100));
        setLocalMicLevel(normalized);
        micRafRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (err) {
      setMicStatus('BLOCKED');
      setMicError(
        err instanceof Error
          ? err.message
          : 'Microphone access denied or unavailable.'
      );
    }
  };

  const handleJoinMatch = async (
    overrideRoom?: string,
    overrideMode?: GameMode
  ) => {
    unlockMobileAudio();
    const activeMode = overrideMode ?? gameMode;
    const activeRoom = (overrideRoom ?? roomCode).trim().toUpperCase() || 'A1';
    setJoiningRoom(true);

    try {
      if (activeMode === 'SOLO_AI') {
        setLocalSeat('P1');
        spawnAIOpponent();
      } else {
        await Promise.race([
          insertCoin({
            skipLobby: true,
            roomCode: activeRoom,
            maxPlayersPerRoom: 2,
          }),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);

        if (myPlayer()) {
          setPlayroomConnected(true);
          onPlayerJoin(() => {
            useGameStore.getState().setRemotePeerConnected(true);
          });
        }
      }
    } catch {
      // Seamless fallback
    } finally {
      setJoiningRoom(false);
      setLobbyEntered(true);
    }
  };

  const opponentSeat: PlayerSeat = localSeat === 'P1' ? 'P2' : 'P1';
  const localPlayer = players[localSeat];
  const opponentPlayer = players[opponentSeat];
  const hasLocalPriority = priorityPlayer === localSeat;

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedCardId) ?? null,
    [cards, selectedCardId]
  );

  const cycleCameraPreset = () => {
    const order: MobileCameraPreset[] = ['DUEL', 'TOP', 'HAND'];
    const next = order[(order.indexOf(cameraPreset) + 1) % order.length];
    setCameraPreset(next);
  };

  let phaseActionText = 'Declare Attackers →';
  if (winner) {
    phaseActionText = 'Play Again';
  } else if (isCombatChoreographyPlaying) {
    phaseActionText = 'Resolving Combat...';
  } else if (!hasLocalPriority) {
    phaseActionText = players.P2.isBot
      ? 'AI Thinking...'
      : `Waiting (${priorityPlayer})`;
  } else if (phase === 'DECLARE_ATTACKERS') {
    phaseActionText = 'Confirm Attackers';
  } else if (phase === 'DECLARE_BLOCKERS') {
    phaseActionText = 'Confirm Blocks';
  } else if (phase === 'COMBAT_RESOLUTION_AND_END') {
    phaseActionText = 'Resolving...';
  }

  if (isLobbyEntered) {
    return (
      <main className="relative w-full h-[100dvh] bg-[#060913] overflow-hidden select-none">
        <MobileArenaScene />

        {/* Mobile Top HUD Bar */}
        <header className="fixed top-0 left-0 right-0 z-20 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 bg-slate-950/85 border-b border-cyan-500/30 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-400/50 text-cyan-200 font-bold">
                YOU: {localPlayer.life}♥
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-400/50 text-amber-300 font-bold">
                MANA: {localPlayer.manaPool}
              </span>
            </div>

            <div className="text-center">
              <div className="text-[10px] text-slate-400">
                T{turnNumber} • {gameMode === 'SOLO_AI' ? 'AI' : roomCode}
              </div>
              <div className="text-[11px] font-bold text-cyan-300">
                {PHASE_LABELS[phase]}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-400/50 text-rose-200 font-bold">
                OPP: {opponentPlayer.life}♥
              </span>
            </div>
          </div>

          {/* Mobile Quick Controls Row */}
          <div className="flex items-center justify-between gap-1.5 mt-1.5 text-[11px]">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cycleCameraPreset}
                className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-600 text-slate-200 font-semibold active:scale-95 transition"
              >
                Cam: {cameraPreset}
              </button>

              <button
                type="button"
                onClick={() => {
                  unlockMobileAudio();
                  toggleMicMute();
                }}
                className={`px-2.5 py-1 rounded-md border font-semibold active:scale-95 transition ${
                  isMicMuted
                    ? 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                    : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                }`}
              >
                {isMicMuted
                  ? 'Mic Off'
                  : players.P2.isBot
                  ? `AI ${Math.round(remoteVoiceLevel * 100)}%`
                  : remotePeerConnected
                  ? 'Voice Live'
                  : 'Mic On'}
              </button>
            </div>

            {gameMode === 'MULTIPLAYER' && !players.P2.isBot && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={spawnAIOpponent}
                  className="px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-semibold active:scale-95"
                >
                  + AI Bot
                </button>
                <button
                  type="button"
                  onClick={() => setLocalSeat(localSeat === 'P1' ? 'P2' : 'P1')}
                  className="px-2 py-1 rounded-md bg-slate-800 border border-slate-600 text-slate-200"
                >
                  {localSeat}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Floating Touch Card Inspector & Quick-Cast Bar (when a Hand card is tapped) */}
        {selectedCard && selectedCard.owner === localSeat && (
          <div className="fixed left-3 right-3 bottom-24 z-30 p-3 rounded-2xl bg-slate-900/95 border border-cyan-400/60 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-white">
                    {selectedCard.name}
                  </span>
                  {selectedCard.manaCost > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-bold">
                      {selectedCard.manaCost} MANA
                    </span>
                  )}
                  {selectedCard.type === 'CREATURE' && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-bold">
                      {selectedCard.power}/{selectedCard.toughness}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-cyan-300 font-mono mt-0.5">
                  {selectedCard.keywords.length > 0
                    ? selectedCard.keywords.join(' • ')
                    : selectedCard.type}
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  {selectedCard.rulesText}
                </p>
              </div>

              <button
                type="button"
                onClick={clearSelection}
                className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {selectedCard.zone === 'HAND' && phase === 'START_AND_MAIN_1' && hasLocalPriority && (
              <div className="mt-2.5 flex gap-2">
                {selectedCard.type === 'LAND' && (
                  <button
                    type="button"
                    disabled={
                      localPlayer.landsPlayedThisTurn >=
                      localPlayer.maxLandsPerTurn
                    }
                    onClick={() => playLandToSlot(selectedCard.id, undefined, localSeat)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider active:scale-95 transition"
                  >
                    {localPlayer.landsPlayedThisTurn >=
                    localPlayer.maxLandsPerTurn
                      ? 'Land Limit Reached (1/Turn)'
                      : 'Play Land to Board'}
                  </button>
                )}

                {selectedCard.type === 'CREATURE' && (
                  <button
                    type="button"
                    disabled={localPlayer.manaPool < selectedCard.manaCost}
                    onClick={() =>
                      summonCreatureToSlot(selectedCard.id, undefined, localSeat)
                    }
                    className="flex-1 py-2.5 rounded-xl bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider active:scale-95 transition"
                  >
                    {localPlayer.manaPool < selectedCard.manaCost
                      ? `Need ${selectedCard.manaCost} Mana (Tap Lands!)`
                      : `Summon ${selectedCard.name} (${selectedCard.manaCost} Mana)`}
                  </button>
                )}

                {selectedCard.type === 'SPELL' && (
                  <button
                    type="button"
                    disabled={localPlayer.manaPool < selectedCard.manaCost}
                    onClick={() =>
                      castSpellOnTarget(
                        selectedCard.id,
                        'PLAYER',
                        opponentSeat,
                        localSeat
                      )
                    }
                    className="flex-1 py-2.5 rounded-xl bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-extrabold text-xs uppercase tracking-wider active:scale-95 transition"
                  >
                    {localPlayer.manaPool < selectedCard.manaCost
                      ? `Need ${selectedCard.manaCost} Mana`
                      : `Blast Opponent (${selectedCard.power} DMG) or Tap Enemy Creature`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom Thumb-Friendly Action Dock */}
        <footer className="fixed bottom-0 left-0 right-0 z-20 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-slate-950/90 border-t border-slate-800 backdrop-blur-md space-y-1.5">
          <div className="text-[11px] font-mono text-slate-300 truncate text-center">
            {winner
              ? `VICTORY: ${players[winner].displayName} WINS!`
              : combatLog[0] ?? 'Tap cards to play, drag to orbit 3D view.'}
          </div>

          <button
            type="button"
            disabled={(!hasLocalPriority && !winner) || isCombatChoreographyPlaying}
            onClick={() => {
              unlockMobileAudio();
              if (winner) {
                resetMatch();
              } else {
                advancePhase(localSeat);
              }
            }}
            className={`w-full py-3 rounded-xl font-extrabold text-sm uppercase tracking-wider shadow-lg active:scale-[0.99] transition ${
              winner
                ? 'bg-emerald-400 text-slate-950'
                : hasLocalPriority && !isCombatChoreographyPlaying
                ? 'bg-amber-400 text-slate-950'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            {phaseActionText}
          </button>
        </footer>
      </main>
    );
  }

  // Mobile-First Touch Lobby
  return (
    <main className="min-h-[100dvh] w-full bg-[#060913] text-slate-100 flex flex-col items-center justify-center p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/95 border border-cyan-500/30 shadow-2xl p-5 space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono mb-1.5">
            <span>MOBILE TOUCH EDITION • CROSS-PLAY WITH PICO G2</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            AETHERPLANES <span className="text-cyan-400">MOBILE</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Same 3D creatures, combat choreography &amp; PlayroomKit rooms as Pico G2 VR
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-cyan-400">
            1. Choose Mode
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                {
                  mode: 'SOLO_AI' as GameMode,
                  title: 'Solo vs. AI',
                  sub: 'Instant Bot match',
                },
                {
                  mode: 'MULTIPLAYER' as GameMode,
                  title: '1v1 Cross-Play',
                  sub: 'Phone ↔ Pico G2 / Phone',
                },
              ] as const
            ).map((item) => {
              const active = gameMode === item.mode;
              return (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => setGameMode(item.mode)}
                  className={`p-3 rounded-xl border text-left transition active:scale-95 ${
                    active
                      ? 'bg-cyan-950/90 border-cyan-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="font-bold text-sm">{item.title}</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    {item.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Short Room Code & Seat */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-cyan-400">
              Room Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="A1"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Seat
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['P1', 'P2'] as PlayerSeat[]).map((seat) => {
                const selected = localSeat === seat;
                const disabled = gameMode === 'SOLO_AI' && seat === 'P2';
                return (
                  <button
                    key={seat}
                    type="button"
                    disabled={disabled}
                    onClick={() => setLocalSeat(seat)}
                    className={`py-2.5 rounded-xl border font-bold text-xs transition ${
                      selected
                        ? 'bg-cyan-950 border-cyan-400 text-white'
                        : disabled
                        ? 'bg-slate-950 border-slate-900 text-slate-600'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {seat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Voice Mic Check */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Voice Mic Check
            </span>
            <button
              type="button"
              onClick={runMobileMicCheck}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[11px] font-bold uppercase"
            >
              {micStatus === 'READY' ? 'Ready ✓' : 'Test Mic'}
            </button>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400 transition-all duration-75"
              style={{ width: `${localMicStream ? Math.max(6, localMicLevel) : 0}%` }}
            />
          </div>
          {micError && (
            <p className="text-[11px] text-rose-400 font-mono">
              {micError} (Receive-only &amp; AI voice still work.)
            </p>
          )}
        </div>

        {/* Primary Play Button */}
        <button
          type="button"
          disabled={joiningRoom}
          onClick={() => handleJoinMatch()}
          className="w-full py-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-extrabold text-sm uppercase tracking-wider shadow-lg active:scale-[0.98] transition"
        >
          {joiningRoom
            ? 'Connecting...'
            : gameMode === 'SOLO_AI'
            ? 'Play Solo vs. AI'
            : `Join Cross-Play Room ${roomCode}`}
        </button>

        <div className="text-[10px] font-mono text-slate-500 text-center pt-1">
          Short links: <code>/s</code> (Solo AI) • <code>/a1</code> (P1) •{' '}
          <code>/a1-2</code> (P2)
        </div>
      </div>
    </main>
  );
};
