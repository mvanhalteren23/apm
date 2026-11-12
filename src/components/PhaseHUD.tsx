'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/store/useGameStore';

export const PhaseHUD: React.FC = () => {
  const manaCrimsonRef = useRef<THREE.Mesh>(null);
  const manaAetherRef = useRef<THREE.Mesh>(null);
  const manaObsidianRef = useRef<THREE.Mesh>(null);
  const spawnAiOrbRef = useRef<THREE.Mesh>(null);

  const localSeat = useGameStore((s) => s.localSeat);
  const gameMode = useGameStore((s) => s.gameMode);
  const players = useGameStore((s) => s.players);
  const remotePeerConnected = useGameStore((s) => s.remotePeerConnected);
  const spawnAIOpponent = useGameStore((s) => s.spawnAIOpponent);

  const zSign = localSeat === 'P1' ? 1 : -1;
  const facingRotY = localSeat === 'P1' ? 0 : Math.PI;
  const localPlayer = players[localSeat];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (manaCrimsonRef.current) manaCrimsonRef.current.rotation.y = t * 1.4;
    if (manaAetherRef.current) manaAetherRef.current.rotation.y = -t * 1.4;
    if (manaObsidianRef.current) manaObsidianRef.current.rotation.y = t * 1.1;
    if (spawnAiOrbRef.current) {
      spawnAiOrbRef.current.rotation.y = t * 1.6;
      spawnAiOrbRef.current.position.y = 1.05 + Math.sin(t * 3.0) * 0.03;
    }
  });

  const showSpawnAIButton =
    gameMode === 'MULTIPLAYER' && !players.P2.isBot && !remotePeerConnected;

  return (
    <group name="mobile-phase-hud-3d">
      {/* Floating 3D Mana Pool Crystal Counter on the Table Edge */}
      <group
        position={[-1.82 * zSign, 1.04, 0.72 * zSign]}
        rotation={[0, facingRotY, 0]}
      >
        <Text
          position={[0, 0.26, 0]}
          fontSize={0.056}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
        >
          {`MANA: ${localPlayer.manaPool}`}
        </Text>

        <group position={[-0.22, 0.06, 0]}>
          <mesh ref={manaCrimsonRef}>
            <octahedronGeometry args={[0.075, 0]} />
            <meshLambertMaterial
              color="#f43f5e"
              emissive="#881337"
              flatShading
            />
          </mesh>
          <Text
            position={[0, -0.13, 0]}
            fontSize={0.048}
            color="#fb7185"
            anchorX="center"
            anchorY="middle"
          >
            {`C:${localPlayer.manaColors.CRIMSON}`}
          </Text>
        </group>

        <group position={[0, 0.06, 0]}>
          <mesh ref={manaAetherRef}>
            <octahedronGeometry args={[0.075, 0]} />
            <meshLambertMaterial
              color="#00f0ff"
              emissive="#083344"
              flatShading
            />
          </mesh>
          <Text
            position={[0, -0.13, 0]}
            fontSize={0.048}
            color="#38bdf8"
            anchorX="center"
            anchorY="middle"
          >
            {`A:${localPlayer.manaColors.AETHER}`}
          </Text>
        </group>

        <group position={[0.22, 0.06, 0]}>
          <mesh ref={manaObsidianRef}>
            <octahedronGeometry args={[0.075, 0]} />
            <meshLambertMaterial
              color="#a855f7"
              emissive="#3b0764"
              flatShading
            />
          </mesh>
          <Text
            position={[0, -0.13, 0]}
            fontSize={0.048}
            color="#c084fc"
            anchorX="center"
            anchorY="middle"
          >
            {`O:${localPlayer.manaColors.OBSIDIAN}`}
          </Text>
        </group>

        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.28, 0.32, 0.06, 8]} />
          <meshLambertMaterial color="#1e293b" />
        </mesh>
      </group>

      {/* Tap-to-Spawn AI Opponent Orb if waiting in 1v1 Multiplayer */}
      {showSpawnAIButton && (
        <group position={[0, 0, 0]} rotation={[0, facingRotY, 0]}>
          <mesh
            ref={spawnAiOrbRef}
            position={[0, 1.05, 0]}
            onClick={(e) => {
              e.stopPropagation();
              spawnAIOpponent();
            }}
          >
            <dodecahedronGeometry args={[0.2, 0]} />
            <meshLambertMaterial
              color="#f5b041"
              emissive="#78350f"
              flatShading
            />
          </mesh>

          <Text
            position={[0, 1.35, 0]}
            fontSize={0.075}
            color="#10b981"
            anchorX="center"
            anchorY="middle"
          >
            TAP TO SPAWN AI OPPONENT
          </Text>
        </group>
      )}
    </group>
  );
};
