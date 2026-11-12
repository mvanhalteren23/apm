'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/store/useGameStore';
import { useAIPlaneswalkerBot } from '@/systems/AIPlaneswalkerBot';
import { CombatChoreographer } from '@/systems/CombatChoreographer';
import { MobileVoiceManager } from './MobileVoiceManager';
import { MobileCameraRig } from './MobileCameraRig';
import { CardHandArc } from './CardHandArc';
import { BattlefieldGrid } from './BattlefieldGrid';
import { PhaseHUD } from './PhaseHUD';

const PlaneswalkerTargetOrbs: React.FC = () => {
  const p1OrbRef = useRef<THREE.Mesh>(null);
  const p2OrbRef = useRef<THREE.Mesh>(null);

  const localSeat = useGameStore((s) => s.localSeat);
  const players = useGameStore((s) => s.players);
  const interactWithPlayerAvatar = useGameStore((s) => s.interactWithPlayerAvatar);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (p1OrbRef.current) p1OrbRef.current.rotation.y = t * 1.2;
    if (p2OrbRef.current) p2OrbRef.current.rotation.y = -t * 1.2;
  });

  return (
    <group name="planeswalker-target-orbs">
      <group
        position={[0, 1.4, 3.2]}
        rotation={[0, localSeat === 'P1' ? 0 : Math.PI, 0]}
      >
        <mesh
          ref={p1OrbRef}
          onClick={(e) => {
            e.stopPropagation();
            interactWithPlayerAvatar('P1');
          }}
        >
          <octahedronGeometry args={[0.14, 0]} />
          <meshLambertMaterial
            color="#00f0ff"
            emissive="#083344"
            flatShading
          />
        </mesh>
        <Text
          position={[0, 0.22, 0]}
          fontSize={0.075}
          color="#00f0ff"
          anchorX="center"
          anchorY="middle"
        >
          {`P1 LIFE: ${players.P1.life} HP`}
        </Text>
      </group>

      <group
        position={[0, 1.4, -3.2]}
        rotation={[0, localSeat === 'P1' ? 0 : Math.PI, 0]}
      >
        <mesh
          ref={p2OrbRef}
          onClick={(e) => {
            e.stopPropagation();
            interactWithPlayerAvatar('P2');
          }}
        >
          <octahedronGeometry args={[0.14, 0]} />
          <meshLambertMaterial
            color="#f43f5e"
            emissive="#4c0519"
            flatShading
          />
        </mesh>
        <Text
          position={[0, -0.22, 0]}
          fontSize={0.075}
          color="#fb7185"
          anchorX="center"
          anchorY="middle"
        >
          {`P2 LIFE: ${players.P2.life} HP`}
        </Text>
      </group>
    </group>
  );
};

const MobileArenaInterior: React.FC = () => {
  useAIPlaneswalkerBot();
  const clearSelection = useGameStore((s) => s.clearSelection);

  return (
    <>
      <ambientLight intensity={1.18} color="#e2e8f0" />
      <directionalLight position={[0, 6, 2]} intensity={0.95} color="#38bdf8" />
      <directionalLight position={[0, 4, -3]} intensity={0.68} color="#f5b041" />

      <mesh>
        <sphereGeometry args={[18, 16, 12]} />
        <meshBasicMaterial color="#060913" side={THREE.BackSide} />
      </mesh>

      <mesh
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={() => clearSelection()}
      >
        <ringGeometry args={[4.5, 11.5, 24]} />
        <meshBasicMaterial color="#0f172a" side={THREE.DoubleSide} />
      </mesh>

      <group position={[0, 0.4, 0]}>
        <mesh onClick={() => clearSelection()}>
          <cylinderGeometry args={[2.55, 2.15, 0.78, 12]} />
          <meshLambertMaterial color="#0f172a" />
        </mesh>

        <mesh position={[0, 0.395, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.44, 2.54, 24]} />
          <meshBasicMaterial color="#00f0ff" side={THREE.DoubleSide} />
        </mesh>

        <mesh position={[0, 0.398, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.4, 0.025]} />
          <meshBasicMaterial color="#f5b041" />
        </mesh>

        <mesh position={[0, 0.397, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.92, 0.96, 24]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={0.45}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      <MobileVoiceManager />
      <PlaneswalkerTargetOrbs />
      <PhaseHUD />
      <BattlefieldGrid />
      <CardHandArc />
      <CombatChoreographer />
      <MobileCameraRig />
    </>
  );
};

export const MobileArenaScene: React.FC = () => {
  return (
    <div className="relative w-full h-[100dvh] bg-[#060913] overflow-hidden select-none touch-none">
      <Canvas
        shadows={false}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
          depth: true,
        }}
        camera={{
          fov: 68,
          near: 0.1,
          far: 40,
          position: [0, 2.75, 4.45],
        }}
      >
        <MobileArenaInterior />
      </Canvas>
    </div>
  );
};

export default MobileArenaScene;
