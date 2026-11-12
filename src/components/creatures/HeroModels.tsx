'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { CardInstance } from '@/types/game';
import { combatRegistry } from '@/systems/CombatChoreographer';

export interface HeroModelProps {
  card: CardInstance;
  slotWorldPosition: [number, number, number];
  isTapped: boolean;
}

export const CrimsonHellkiteModel: React.FC<HeroModelProps> = ({
  card,
  slotWorldPosition,
  isTapped,
}) => {
  const rootMoverRef = useRef<THREE.Group>(null);
  const bodyRigRef = useRef<THREE.Group>(null);
  const chestCoreRef = useRef<THREE.Mesh>(null);
  const lowerJawRef = useRef<THREE.Group>(null);

  const leftInnerWingRef = useRef<THREE.Group>(null);
  const leftOuterWingRef = useRef<THREE.Group>(null);
  const rightInnerWingRef = useRef<THREE.Group>(null);
  const rightOuterWingRef = useRef<THREE.Group>(null);

  const tailSeg1Ref = useRef<THREE.Group>(null);
  const tailSeg2Ref = useRef<THREE.Group>(null);
  const tailSeg3Ref = useRef<THREE.Group>(null);

  const fireConeGroupRef = useRef<THREE.Group>(null);

  const [whiteFlash, setWhiteFlash] = useState(false);
  const isAttackingAnimRef = useRef(false);

  useEffect(() => {
    const facingSign = card.owner === 'P1' ? 1 : -1;

    combatRegistry.register(card.id, {
      cardId: card.id,
      owner: card.owner,
      rootGroup: rootMoverRef.current,
      getWorldSlotPosition: () =>
        new THREE.Vector3(
          slotWorldPosition[0],
          slotWorldPosition[1],
          slotWorldPosition[2]
        ),
      triggerWhiteFlash: (active: boolean) => setWhiteFlash(active),
      triggerAttackAnimation: (
        targetWorldPos: THREE.Vector3,
        onImpactCallback: () => void
      ) => {
        return new Promise<void>((resolve) => {
          const mover = rootMoverRef.current;
          const jaw = lowerJawRef.current;
          const fireGroup = fireConeGroupRef.current;
          if (!mover) {
            onImpactCallback();
            resolve();
            return;
          }

          isAttackingAnimRef.current = true;
          const worldDx =
            (targetWorldPos.x - slotWorldPosition[0]) * facingSign;
          const worldDz =
            (targetWorldPos.z - slotWorldPosition[2]) * facingSign;

          const tl = gsap.timeline({
            onComplete: () => {
              isAttackingAnimRef.current = false;
              resolve();
            },
          });

          tl.to(mover.position, {
            x: worldDx * 0.25,
            y: 0.72,
            z: worldDz * 0.25,
            duration: 0.24,
            ease: 'power2.out',
          });
          tl.to(
            mover.rotation,
            {
              x: 0.48,
              duration: 0.2,
              ease: 'power2.out',
            },
            0
          );

          tl.to(mover.position, {
            x: worldDx * 0.78,
            y: 0.22,
            z: worldDz * 0.78,
            duration: 0.22,
            ease: 'power3.in',
          });

          if (jaw) {
            tl.to(
              jaw.rotation,
              {
                x: 0.65,
                duration: 0.14,
                yoyo: true,
                repeat: 1,
              },
              0.22
            );
          }

          tl.call(() => {
            onImpactCallback();
            if (fireGroup) {
              fireGroup.visible = true;
              fireGroup.children.forEach((child, idx) => {
                const sphere = child as THREE.Mesh;
                const spreadX = ((idx % 3) - 1) * 0.11;
                const spreadY = (Math.floor(idx / 3) - 1) * 0.08 - 0.05;
                gsap.fromTo(
                  sphere.position,
                  { x: 0, y: 0, z: 0 },
                  {
                    x: spreadX,
                    y: spreadY,
                    z: -0.48 - (idx % 4) * 0.1,
                    duration: 0.28,
                    ease: 'power2.out',
                  }
                );
                gsap.fromTo(
                  sphere.scale,
                  { x: 1.2, y: 1.2, z: 1.2 },
                  {
                    x: 0.05,
                    y: 0.05,
                    z: 0.05,
                    duration: 0.28,
                    ease: 'power2.in',
                  }
                );
              });
              setTimeout(() => {
                if (fireGroup) fireGroup.visible = false;
              }, 300);
            }
          });

          tl.to(mover.position, { duration: 0.18 });

          tl.to(mover.position, {
            x: 0,
            y: 0,
            z: 0,
            duration: 0.3,
            ease: 'power2.inOut',
          });
          tl.to(
            mover.rotation,
            {
              x: 0,
              y: 0,
              z: 0,
              duration: 0.25,
            },
            '-=0.3'
          );
        });
      },
    });

    return () => {
      combatRegistry.unregister(card.id);
    };
  }, [card.id, card.owner, slotWorldPosition]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const speed = isAttackingAnimRef.current ? 14.0 : isTapped ? 2.2 : 5.2;
    const flap = Math.sin(t * speed);

    if (bodyRigRef.current && !isAttackingAnimRef.current) {
      const targetBaseY = isTapped ? 0.11 : 0.26 + flap * 0.04;
      bodyRigRef.current.position.y = THREE.MathUtils.lerp(
        bodyRigRef.current.position.y,
        targetBaseY,
        0.15
      );
      bodyRigRef.current.rotation.x = isTapped ? 0.28 : 0.06;
    }

    if (leftInnerWingRef.current && leftOuterWingRef.current) {
      leftInnerWingRef.current.rotation.z = flap * 0.52;
      leftOuterWingRef.current.rotation.z = Math.sin(t * speed - 0.6) * 0.45;
    }

    if (rightInnerWingRef.current && rightOuterWingRef.current) {
      rightInnerWingRef.current.rotation.z = -flap * 0.52;
      rightOuterWingRef.current.rotation.z = -Math.sin(t * speed - 0.6) * 0.45;
    }

    if (tailSeg1Ref.current && tailSeg2Ref.current && tailSeg3Ref.current) {
      tailSeg1Ref.current.rotation.y = Math.sin(t * 3.2) * 0.25;
      tailSeg2Ref.current.rotation.y = Math.sin(t * 3.2 - 0.5) * 0.32;
      tailSeg3Ref.current.rotation.y = Math.sin(t * 3.2 - 1.0) * 0.38;
    }

    if (chestCoreRef.current) {
      const pulse = 1 + Math.sin(t * 6.0) * 0.18;
      chestCoreRef.current.scale.setScalar(pulse);
    }
  });

  const primaryColor = whiteFlash
    ? '#ffffff'
    : isTapped
    ? '#881337'
    : '#f43f5e';
  const secondaryColor = whiteFlash ? '#ffffff' : '#fb7185';
  const coreColor = whiteFlash ? '#ffffff' : '#f5b041';

  return (
    <group ref={rootMoverRef}>
      <group ref={bodyRigRef} position={[0, 0.26, 0]}>
        <mesh rotation={[0.35, 0, 0]}>
          <coneGeometry args={[0.1, 0.28, 6]} />
          <meshLambertMaterial
            color={primaryColor}
            emissive={whiteFlash ? '#ffffff' : '#4c0519'}
            flatShading
          />
        </mesh>

        <mesh ref={chestCoreRef} position={[0, 0.01, -0.075]}>
          <octahedronGeometry args={[0.048, 0]} />
          <meshBasicMaterial color={coreColor} />
        </mesh>

        <group position={[0, 0.13, -0.1]}>
          <mesh position={[0, 0.03, -0.04]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.055, 0.14, 5]} />
            <meshLambertMaterial color={primaryColor} flatShading />
          </mesh>

          <mesh position={[-0.035, 0.07, 0.01]} rotation={[-0.5, 0, 0.3]}>
            <coneGeometry args={[0.015, 0.08, 4]} />
            <meshBasicMaterial color="#f5b041" />
          </mesh>
          <mesh position={[0.035, 0.07, 0.01]} rotation={[-0.5, 0, -0.3]}>
            <coneGeometry args={[0.015, 0.08, 4]} />
            <meshBasicMaterial color="#f5b041" />
          </mesh>

          <group ref={lowerJawRef} position={[0, 0.005, -0.02]}>
            <mesh position={[0, -0.015, -0.045]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.038, 0.1, 4]} />
              <meshLambertMaterial color={secondaryColor} flatShading />
            </mesh>
          </group>

          <group
            ref={fireConeGroupRef}
            position={[0, 0, -0.09]}
            visible={false}
          >
            {Array.from({ length: 9 }).map((_, idx) => (
              <mesh key={idx}>
                <dodecahedronGeometry args={[0.032, 0]} />
                <meshBasicMaterial
                  color={idx % 2 === 0 ? '#f97316' : '#facc15'}
                />
              </mesh>
            ))}
          </group>
        </group>

        <group ref={leftInnerWingRef} position={[-0.07, 0.05, -0.02]}>
          <mesh position={[-0.09, 0, 0]} rotation={[0, 0, 0.1]}>
            <boxGeometry args={[0.18, 0.012, 0.14]} />
            <meshLambertMaterial color={primaryColor} flatShading />
          </mesh>
          <group ref={leftOuterWingRef} position={[-0.18, 0, 0]}>
            <mesh position={[-0.09, 0, 0.02]} rotation={[0, 0.2, 0]}>
              <coneGeometry args={[0.09, 0.2, 3]} />
              <meshLambertMaterial color={secondaryColor} flatShading />
            </mesh>
          </group>
        </group>

        <group ref={rightInnerWingRef} position={[0.07, 0.05, -0.02]}>
          <mesh position={[0.09, 0, 0]} rotation={[0, 0, -0.1]}>
            <boxGeometry args={[0.18, 0.012, 0.14]} />
            <meshLambertMaterial color={primaryColor} flatShading />
          </mesh>
          <group ref={rightOuterWingRef} position={[0.18, 0, 0]}>
            <mesh position={[0.09, 0, 0.02]} rotation={[0, -0.2, 0]}>
              <coneGeometry args={[0.09, 0.2, 3]} />
              <meshLambertMaterial color={secondaryColor} flatShading />
            </mesh>
          </group>
        </group>

        <group ref={tailSeg1Ref} position={[0, -0.1, 0.07]}>
          <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.028, 0.04, 0.1, 5]} />
            <meshLambertMaterial color={primaryColor} flatShading />
          </mesh>
          <group ref={tailSeg2Ref} position={[0, 0, 0.09]}>
            <mesh position={[0, 0, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.028, 0.09, 5]} />
              <meshLambertMaterial color={secondaryColor} flatShading />
            </mesh>
            <group ref={tailSeg3Ref} position={[0, 0, 0.08]}>
              <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.026, 0.08, 4]} />
                <meshBasicMaterial color="#f5b041" />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};

export const AetherColossusModel: React.FC<HeroModelProps> = ({
  card,
  slotWorldPosition,
  isTapped,
}) => {
  const rootMoverRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const leftShoulderRef = useRef<THREE.Mesh>(null);
  const rightShoulderRef = useRef<THREE.Mesh>(null);
  const leftArmPivotRef = useRef<THREE.Group>(null);
  const rightArmPivotRef = useRef<THREE.Group>(null);
  const coreCrystalRef = useRef<THREE.Mesh>(null);
  const coreRing1Ref = useRef<THREE.Mesh>(null);
  const coreRing2Ref = useRef<THREE.Mesh>(null);
  const shockwaveRingRef = useRef<THREE.Mesh>(null);

  const [whiteFlash, setWhiteFlash] = useState(false);
  const isAttackingAnimRef = useRef(false);

  useEffect(() => {
    const facingSign = card.owner === 'P1' ? 1 : -1;

    combatRegistry.register(card.id, {
      cardId: card.id,
      owner: card.owner,
      rootGroup: rootMoverRef.current,
      getWorldSlotPosition: () =>
        new THREE.Vector3(
          slotWorldPosition[0],
          slotWorldPosition[1],
          slotWorldPosition[2]
        ),
      triggerWhiteFlash: (active: boolean) => setWhiteFlash(active),
      triggerAttackAnimation: (
        targetWorldPos: THREE.Vector3,
        onImpactCallback: () => void
      ) => {
        return new Promise<void>((resolve) => {
          const mover = rootMoverRef.current;
          const leftArm = leftArmPivotRef.current;
          const rightArm = rightArmPivotRef.current;
          const shockwave = shockwaveRingRef.current;
          if (!mover) {
            onImpactCallback();
            resolve();
            return;
          }

          isAttackingAnimRef.current = true;
          const worldDx =
            (targetWorldPos.x - slotWorldPosition[0]) * facingSign;
          const worldDz =
            (targetWorldPos.z - slotWorldPosition[2]) * facingSign;

          const tl = gsap.timeline({
            onComplete: () => {
              isAttackingAnimRef.current = false;
              resolve();
            },
          });

          tl.to(mover.position, {
            x: worldDx * 0.76,
            y: 0.14,
            z: worldDz * 0.76,
            duration: 0.25,
            ease: 'power2.out',
          });

          if (leftArm && rightArm) {
            tl.to(
              [leftArm.rotation, rightArm.rotation],
              {
                x: -2.1,
                duration: 0.22,
                ease: 'power2.out',
              },
              0
            );

            tl.to(
              [leftArm.rotation, rightArm.rotation],
              {
                x: 0.75,
                duration: 0.14,
                ease: 'power4.in',
              },
              0.24
            );
          }

          tl.to(
            mover.position,
            {
              y: 0,
              duration: 0.12,
              ease: 'power4.in',
            },
            0.25
          );

          tl.call(() => {
            onImpactCallback();
            if (shockwave) {
              shockwave.visible = true;
              gsap.fromTo(
                shockwave.scale,
                { x: 0.2, y: 0.2, z: 1 },
                {
                  x: 2.6,
                  y: 2.6,
                  z: 1,
                  duration: 0.36,
                  ease: 'power2.out',
                  onComplete: () => {
                    shockwave.visible = false;
                  },
                }
              );
            }
          });

          tl.to(mover.position, { duration: 0.16 });

          if (leftArm && rightArm) {
            tl.to(
              [leftArm.rotation, rightArm.rotation],
              {
                x: 0,
                duration: 0.24,
              },
              '-=0.1'
            );
          }

          tl.to(mover.position, {
            x: 0,
            y: 0,
            z: 0,
            duration: 0.28,
            ease: 'power2.inOut',
          });
        });
      },
    });

    return () => {
      combatRegistry.unregister(card.id);
    };
  }, [card.id, card.owner, slotWorldPosition]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (torsoRef.current && !isAttackingAnimRef.current) {
      const hoverY = isTapped ? 0.12 : 0.22 + Math.sin(t * 2.4) * 0.025;
      torsoRef.current.position.y = THREE.MathUtils.lerp(
        torsoRef.current.position.y,
        hoverY,
        0.15
      );
      torsoRef.current.rotation.x = isTapped ? 0.32 : 0;
    }

    if (coreCrystalRef.current) {
      coreCrystalRef.current.rotation.y = t * 1.8;
    }
    if (coreRing1Ref.current) {
      coreRing1Ref.current.rotation.z = t * 1.5;
      coreRing1Ref.current.rotation.x = Math.sin(t) * 0.4;
    }
    if (coreRing2Ref.current) {
      coreRing2Ref.current.rotation.z = -t * 1.9;
      coreRing2Ref.current.rotation.y = Math.cos(t) * 0.4;
    }

    if (leftShoulderRef.current && rightShoulderRef.current) {
      leftShoulderRef.current.position.y = 0.12 + Math.sin(t * 3.0) * 0.015;
      rightShoulderRef.current.position.y =
        0.12 + Math.sin(t * 3.0 + Math.PI) * 0.015;
    }
  });

  const armorColor = whiteFlash
    ? '#ffffff'
    : isTapped
    ? '#1e3a8a'
    : '#1e293b';
  const crystalColor = whiteFlash ? '#ffffff' : '#00f0ff';

  return (
    <group ref={rootMoverRef}>
      <group ref={torsoRef} position={[0, 0.22, 0]}>
        <mesh position={[0, 0.04, 0]}>
          <dodecahedronGeometry args={[0.12, 0]} />
          <meshLambertMaterial
            color={armorColor}
            emissive={whiteFlash ? '#ffffff' : '#082f49'}
            flatShading
          />
        </mesh>

        <mesh position={[0, 0.17, -0.02]}>
          <octahedronGeometry args={[0.06, 0]} />
          <meshBasicMaterial color={crystalColor} />
        </mesh>

        <mesh ref={coreCrystalRef} position={[0, 0.03, -0.09]}>
          <octahedronGeometry args={[0.045, 0]} />
          <meshBasicMaterial color={crystalColor} />
        </mesh>
        <mesh ref={coreRing1Ref} position={[0, 0.03, -0.09]}>
          <ringGeometry args={[0.055, 0.068, 8]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={coreRing2Ref} position={[0, 0.03, -0.09]}>
          <ringGeometry args={[0.072, 0.084, 8]} />
          <meshBasicMaterial color="#f5b041" side={THREE.DoubleSide} />
        </mesh>

        <mesh
          ref={leftShoulderRef}
          position={[-0.15, 0.12, 0]}
          rotation={[0, 0, 0.35]}
        >
          <boxGeometry args={[0.08, 0.04, 0.1]} />
          <meshLambertMaterial color="#38bdf8" flatShading />
        </mesh>
        <mesh
          ref={rightShoulderRef}
          position={[0.15, 0.12, 0]}
          rotation={[0, 0, -0.35]}
        >
          <boxGeometry args={[0.08, 0.04, 0.1]} />
          <meshLambertMaterial color="#38bdf8" flatShading />
        </mesh>

        <group ref={leftArmPivotRef} position={[-0.15, 0.08, 0]}>
          <mesh position={[0, -0.09, -0.02]}>
            <boxGeometry args={[0.055, 0.16, 0.065]} />
            <meshLambertMaterial color={armorColor} flatShading />
          </mesh>
          <mesh position={[0, -0.17, -0.03]}>
            <dodecahedronGeometry args={[0.05, 0]} />
            <meshBasicMaterial color={crystalColor} />
          </mesh>
        </group>

        <group ref={rightArmPivotRef} position={[0.15, 0.08, 0]}>
          <mesh position={[0, -0.09, -0.02]}>
            <boxGeometry args={[0.055, 0.16, 0.065]} />
            <meshLambertMaterial color={armorColor} flatShading />
          </mesh>
          <mesh position={[0, -0.17, -0.03]}>
            <dodecahedronGeometry args={[0.05, 0]} />
            <meshBasicMaterial color={crystalColor} />
          </mesh>
        </group>
      </group>

      <mesh
        ref={shockwaveRingRef}
        position={[0, 0.02, -0.15]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[0.12, 0.18, 24]} />
        <meshBasicMaterial
          color="#00f0ff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
};

export const ObsidianShadeModel: React.FC<HeroModelProps> = ({
  card,
  slotWorldPosition,
  isTapped,
}) => {
  const rootMoverRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const leftDaggerPivotRef = useRef<THREE.Group>(null);
  const rightDaggerPivotRef = useRef<THREE.Group>(null);
  const shardsGroupRef = useRef<THREE.Group>(null);
  const xSlashGroupRef = useRef<THREE.Group>(null);

  const [whiteFlash, setWhiteFlash] = useState(false);
  const isAttackingAnimRef = useRef(false);

  useEffect(() => {
    const facingSign = card.owner === 'P1' ? 1 : -1;

    combatRegistry.register(card.id, {
      cardId: card.id,
      owner: card.owner,
      rootGroup: rootMoverRef.current,
      getWorldSlotPosition: () =>
        new THREE.Vector3(
          slotWorldPosition[0],
          slotWorldPosition[1],
          slotWorldPosition[2]
        ),
      triggerWhiteFlash: (active: boolean) => setWhiteFlash(active),
      triggerAttackAnimation: (
        targetWorldPos: THREE.Vector3,
        onImpactCallback: () => void
      ) => {
        return new Promise<void>((resolve) => {
          const mover = rootMoverRef.current;
          const body = bodyRef.current;
          const leftDag = leftDaggerPivotRef.current;
          const rightDag = rightDaggerPivotRef.current;
          const xSlash = xSlashGroupRef.current;
          if (!mover || !body) {
            onImpactCallback();
            resolve();
            return;
          }

          isAttackingAnimRef.current = true;
          const worldDx =
            (targetWorldPos.x - slotWorldPosition[0]) * facingSign;
          const worldDz =
            (targetWorldPos.z - slotWorldPosition[2]) * facingSign;

          const tl = gsap.timeline({
            onComplete: () => {
              isAttackingAnimRef.current = false;
              resolve();
            },
          });

          tl.to(body.scale, {
            x: 0.15,
            y: 0.02,
            z: 0.15,
            duration: 0.15,
            ease: 'power2.in',
          });
          tl.to(
            body.position,
            {
              y: 0.02,
              duration: 0.15,
            },
            0
          );

          tl.set(mover.position, {
            x: worldDx * 0.82,
            y: 0,
            z: worldDz * 0.82,
          });

          tl.to(body.scale, {
            x: 1.15,
            y: 1.15,
            z: 1.15,
            duration: 0.15,
            ease: 'back.out(1.8)',
          });
          tl.to(
            body.position,
            {
              y: 0.2,
              duration: 0.15,
            },
            '-=0.15'
          );

          if (leftDag && rightDag) {
            tl.fromTo(
              [leftDag.rotation, rightDag.rotation],
              { x: -1.2 },
              {
                x: 0.9,
                duration: 0.14,
                ease: 'power3.out',
              }
            );
          }

          tl.call(() => {
            onImpactCallback();
            if (xSlash) {
              xSlash.visible = true;
              gsap.fromTo(
                xSlash.scale,
                { x: 0.2, y: 0.2, z: 0.2 },
                {
                  x: 1.45,
                  y: 1.45,
                  z: 1.45,
                  duration: 0.24,
                  ease: 'power2.out',
                  onComplete: () => {
                    xSlash.visible = false;
                  },
                }
              );
            }
          });

          tl.to(body.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: 0.2,
          });

          tl.to(mover.position, {
            x: 0,
            y: 0,
            z: 0,
            duration: 0.22,
            ease: 'power2.inOut',
          });
        });
      },
    });

    return () => {
      combatRegistry.unregister(card.id);
    };
  }, [card.id, card.owner, slotWorldPosition]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (bodyRef.current && !isAttackingAnimRef.current) {
      const targetY = isTapped ? 0.1 : 0.19 + Math.sin(t * 3.4) * 0.025;
      bodyRef.current.position.y = THREE.MathUtils.lerp(
        bodyRef.current.position.y,
        targetY,
        0.15
      );
      bodyRef.current.rotation.x = isTapped ? 0.3 : 0.08;
    }

    if (shardsGroupRef.current) {
      shardsGroupRef.current.rotation.y = t * 2.4;
    }
  });

  const cloakColor = whiteFlash
    ? '#ffffff'
    : isTapped
    ? '#2e1065'
    : '#3b0764';
  const daggerColor = whiteFlash ? '#ffffff' : '#c084fc';

  return (
    <group ref={rootMoverRef}>
      <group ref={bodyRef} position={[0, 0.19, 0]}>
        <mesh position={[0, 0, 0]}>
          <coneGeometry args={[0.11, 0.3, 6]} />
          <meshLambertMaterial
            color={cloakColor}
            emissive={whiteFlash ? '#ffffff' : '#1e1b4b'}
            flatShading
          />
        </mesh>

        <mesh position={[0, 0.14, -0.02]} rotation={[0.25, 0, 0]}>
          <coneGeometry args={[0.065, 0.11, 5]} />
          <meshLambertMaterial color={cloakColor} flatShading />
        </mesh>
        <mesh position={[-0.02, 0.13, -0.065]}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshBasicMaterial color="#e879f9" />
        </mesh>
        <mesh position={[0.02, 0.13, -0.065]}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshBasicMaterial color="#e879f9" />
        </mesh>

        <group
          ref={leftDaggerPivotRef}
          position={[-0.1, 0.04, -0.06]}
          rotation={[0.4, 0, -0.3]}
        >
          <mesh position={[0, 0, -0.06]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.018, 0.15, 4]} />
            <meshBasicMaterial color={daggerColor} />
          </mesh>
        </group>

        <group
          ref={rightDaggerPivotRef}
          position={[0.1, 0.04, -0.06]}
          rotation={[0.4, 0, 0.3]}
        >
          <mesh position={[0, 0, -0.06]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.018, 0.15, 4]} />
            <meshBasicMaterial color={daggerColor} />
          </mesh>
        </group>

        <group ref={shardsGroupRef} position={[0, 0.04, 0]}>
          {[0, 1, 2].map((idx) => {
            const angle = (idx / 3) * Math.PI * 2;
            return (
              <mesh
                key={idx}
                position={[
                  Math.cos(angle) * 0.16,
                  (idx - 1) * 0.04,
                  Math.sin(angle) * 0.16,
                ]}
              >
                <octahedronGeometry args={[0.025, 0]} />
                <meshBasicMaterial color={daggerColor} />
              </mesh>
            );
          })}
        </group>

        <group
          ref={xSlashGroupRef}
          position={[0, 0.05, -0.18]}
          visible={false}
        >
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <planeGeometry args={[0.32, 0.035]} />
            <meshBasicMaterial color="#e879f9" side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 4]}>
            <planeGeometry args={[0.32, 0.035]} />
            <meshBasicMaterial color="#00f0ff" side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
};
