'use client';

import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import gsap from 'gsap';
import { useGameStore } from '@/store/useGameStore';

export const MobileCameraRig: React.FC = () => {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const localSeat = useGameStore((s) => s.localSeat);
  const cameraPreset = useGameStore((s) => s.cameraPreset);

  const isPortrait = size.width < size.height;
  const zSign = localSeat === 'P1' ? 1 : -1;

  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    // Widen vertical FOV on narrow portrait phone screens so all 6 slots remain visible
    const aspect = size.width / Math.max(1, size.height);
    const targetFov = aspect < 0.7 ? 74 : aspect < 1.0 ? 68 : 56;
    if (persp.isPerspectiveCamera && Math.abs(persp.fov - targetFov) > 0.5) {
      persp.fov = targetFov;
      persp.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height]);

  useEffect(() => {
    const controls = controlsRef.current;
    let camPos: [number, number, number];
    let targetPos: [number, number, number];

    if (cameraPreset === 'TOP') {
      camPos = [0, isPortrait ? 5.2 : 4.2, (isPortrait ? 2.4 : 2.1) * zSign];
      targetPos = [0, 0.75, 0.2 * zSign];
    } else if (cameraPreset === 'HAND') {
      camPos = [0, isPortrait ? 2.25 : 1.95, (isPortrait ? 4.35 : 3.9) * zSign];
      targetPos = [0, 0.92, 1.9 * zSign];
    } else {
      // DUEL preset (default balanced view for portrait & landscape phones)
      camPos = [0, isPortrait ? 2.75 : 2.2, (isPortrait ? 4.45 : 3.95) * zSign];
      targetPos = [0, 0.85, 0.35 * zSign];
    }

    gsap.to(camera.position, {
      x: camPos[0],
      y: camPos[1],
      z: camPos[2],
      duration: 0.45,
      ease: 'power2.out',
      overwrite: 'auto',
    });

    if (controls) {
      gsap.to(controls.target, {
        x: targetPos[0],
        y: targetPos[1],
        z: targetPos[2],
        duration: 0.45,
        ease: 'power2.out',
        overwrite: 'auto',
        onUpdate: () => controls.update(),
      });
    } else {
      camera.lookAt(targetPos[0], targetPos[1], targetPos[2]);
    }
  }, [camera, cameraPreset, localSeat, isPortrait, zSign]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      minDistance={2.4}
      maxDistance={6.6}
      minPolarAngle={0.28}
      maxPolarAngle={Math.PI / 2 - 0.12}
      minAzimuthAngle={localSeat === 'P1' ? -0.75 : Math.PI - 0.75}
      maxAzimuthAngle={localSeat === 'P1' ? 0.75 : Math.PI + 0.75}
    />
  );
};
