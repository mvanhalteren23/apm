'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { CardInstance, PlayerSeat } from '@/types/game';
import {
  combatRegistry,
  playProceduralCombatSound,
} from '@/systems/CombatChoreographer';
import { useGameStore } from '@/store/useGameStore';
import {
  AetherColossusModel,
  CrimsonHellkiteModel,
  ObsidianShadeModel,
} from './HeroModels';

interface CreatureFactoryProps {
  card: CardInstance;
  slotWorldPosition: [number, number, number];
  localSeat: PlayerSeat;
}

const ArchetypeCreatureRig: React.FC<{
  card: CardInstance;
  slotWorldPosition: [number, number, number];
}> = ({ card, slotWorldPosition }) => {
  const rootMoverRef = useRef<THREE.Group>(null);
  const bodyGroupRef = useRef<THREE.Group>(null);
  const auraRingRef = useRef<THREE.Mesh>(null);
  const weaponPivotRef = useRef<THREE.Group>(null);

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
          const weapon = weaponPivotRef.current;
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
            x: worldDx * 0.78,
            y: card.keywords.includes('Flying') ? 0.28 : 0.06,
            z: worldDz * 0.78,
            duration: 0.24,
            ease: 'power3.inOut',
          });

          if (weapon) {
            tl.to(
              weapon.rotation,
              {
                x: -1.1,
                duration: 0.12,
                yoyo: true,
                repeat: 1,
              },
              0.18
            );
          }

          tl.call(() => {
            onImpactCallback();
          });

          tl.to(mover.position, { duration: 0.14 });

          tl.to(mover.position, {
            x: 0,
            y: 0,
            z: 0,
            duration: 0.26,
            ease: 'power2.out',
          });
        });
      },
    });

    return () => {
      combatRegistry.unregister(card.id);
    };
  }, [card.id, card.owner, card.keywords, slotWorldPosition]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (bodyGroupRef.current && !isAttackingAnimRef.current) {
      const baseHeight = card.keywords.includes('Flying') ? 0.23 : 0.16;
      const targetY = card.tapped
        ? 0.08
        : baseHeight + Math.sin(t * 3.6) * 0.02;
      bodyGroupRef.current.position.y = THREE.MathUtils.lerp(
        bodyGroupRef.current.position.y,
        targetY,
        0.15
      );
      bodyGroupRef.current.rotation.x = card.tapped ? 0.34 : 0;
    }

    if (auraRingRef.current) {
      auraRingRef.current.rotation.z = t * 1.6;
    }
  });

  const mainColor = whiteFlash
    ? '#ffffff'
    : card.tapped
    ? '#475569'
    : card.accentHex;

  return (
    <group ref={rootMoverRef}>
      <mesh
        ref={auraRingRef}
        position={[0, 0.025, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.13, 0.16, 12]} />
        <meshBasicMaterial
          color={mainColor}
          side={THREE.DoubleSide}
          transparent
          opacity={card.tapped ? 0.3 : 0.8}
        />
      </mesh>

      <group ref={bodyGroupRef} position={[0, 0.16, 0]}>
        {card.archetype === 'GOBLIN' && (
          <>
            <mesh>
              <coneGeometry args={[0.075, 0.19, 5]} />
              <meshLambertMaterial
                color={mainColor}
                emissive={whiteFlash ? '#ffffff' : '#4c0519'}
                flatShading
              />
            </mesh>
            <mesh position={[0, 0.11, 0]}>
              <octahedronGeometry args={[0.048, 0]} />
              <meshLambertMaterial color="#fb7185" flatShading />
            </mesh>
            <group ref={weaponPivotRef} position={[0.08, 0.02, -0.04]}>
              <mesh position={[0, 0, -0.07]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.018, 0.22, 4]} />
                <meshBasicMaterial color="#f5b041" />
              </mesh>
            </group>
          </>
        )}

        {card.archetype === 'KNIGHT' && (
          <>
            <mesh>
              <cylinderGeometry args={[0.065, 0.08, 0.2, 6]} />
              <meshLambertMaterial
                color={whiteFlash ? '#ffffff' : '#e2e8f0'}
                emissive={whiteFlash ? '#ffffff' : '#082f49'}
                flatShading
              />
            </mesh>
            <mesh position={[0, 0.13, 0]}>
              <dodecahedronGeometry args={[0.05, 0]} />
              <meshLambertMaterial color={mainColor} flatShading />
            </mesh>
            <mesh position={[-0.085, 0.02, -0.04]} rotation={[0, 0.3, 0]}>
              <boxGeometry args={[0.02, 0.14, 0.09]} />
              <meshLambertMaterial color={mainColor} flatShading />
            </mesh>
            <group ref={weaponPivotRef} position={[0.085, 0.03, -0.03]}>
              <mesh position={[0, 0, -0.08]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.02, 0.24, 5]} />
                <meshBasicMaterial color="#00f0ff" />
              </mesh>
            </group>
          </>
        )}

        {card.archetype === 'SPRITE' && (
          <>
            <mesh>
              <octahedronGeometry args={[0.075, 0]} />
              <meshBasicMaterial color={mainColor} />
            </mesh>
            <mesh position={[-0.1, 0.03, 0.02]} rotation={[0, 0.3, 0.4]}>
              <planeGeometry args={[0.16, 0.1]} />
              <meshBasicMaterial
                color="#38bdf8"
                side={THREE.DoubleSide}
                transparent
                opacity={0.75}
              />
            </mesh>
            <mesh position={[0.1, 0.03, 0.02]} rotation={[0, -0.3, -0.4]}>
              <planeGeometry args={[0.16, 0.1]} />
              <meshBasicMaterial
                color="#38bdf8"
                side={THREE.DoubleSide}
                transparent
                opacity={0.75}
              />
            </mesh>
            <group ref={weaponPivotRef} position={[0, 0, -0.06]}>
              <mesh>
                <octahedronGeometry args={[0.03, 0]} />
                <meshBasicMaterial color="#f5b041" />
              </mesh>
            </group>
          </>
        )}

        {(card.archetype === 'ELEMENTAL' ||
          (card.archetype !== 'GOBLIN' &&
            card.archetype !== 'KNIGHT' &&
            card.archetype !== 'SPRITE')) && (
          <>
            <mesh>
              <dodecahedronGeometry args={[0.085, 0]} />
              <meshLambertMaterial
                color={mainColor}
                emissive={whiteFlash ? '#ffffff' : '#3b0764'}
                flatShading
              />
            </mesh>
            <group ref={weaponPivotRef}>
              <mesh position={[-0.1, 0.06, -0.04]}>
                <tetrahedronGeometry args={[0.045, 0]} />
                <meshBasicMaterial color="#f5b041" />
              </mesh>
              <mesh position={[0.1, 0.06, -0.04]}>
                <tetrahedronGeometry args={[0.045, 0]} />
                <meshBasicMaterial color={mainColor} />
              </mesh>
            </group>
          </>
        )}
      </group>
    </group>
  );
};

const LandConstructRig: React.FC<{ card: CardInstance }> = ({ card }) => {
  const spireRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (spireRef.current) {
      spireRef.current.position.y = card.tapped
        ? 0.04
        : 0.09 + Math.sin(t * 2.2) * 0.012;
      spireRef.current.rotation.y = card.tapped ? 0 : t * 0.65;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = -t * 1.2;
    }
  });

  const color = card.tapped ? '#334155' : card.accentHex;

  return (
    <group>
      <mesh
        ref={ringRef}
        position={[0, 0.018, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.1, 0.13, 8]} />
        <meshBasicMaterial
          color={color}
          side={THREE.DoubleSide}
          transparent
          opacity={card.tapped ? 0.25 : 0.75}
        />
      </mesh>
      <group ref={spireRef} position={[0, 0.09, 0]}>
        <mesh>
          <octahedronGeometry args={[0.065, 0]} />
          <meshLambertMaterial
            color={color}
            emissive={card.tapped ? '#0f172a' : card.accentHex}
            flatShading
          />
        </mesh>
      </group>
    </group>
  );
};

export const CreatureFactory: React.FC<CreatureFactoryProps> = ({
  card,
  slotWorldPosition,
  localSeat,
}) => {
  const emergenceGroupRef = useRef<THREE.Group>(null);
  const portalRingRef = useRef<THREE.Mesh>(null);
  const interactWithCard = useGameStore((s) => s.interactWithCard);
  const setHoveredObjectId = useGameStore((s) => s.setHoveredObjectId);

  const facingRotY = card.owner === 'P1' ? 0 : Math.PI;

  useEffect(() => {
    const emergence = emergenceGroupRef.current;
    const portal = portalRingRef.current;
    if (!emergence) return;

    const isFreshSummon =
      card.summonedAt !== null && Date.now() - card.summonedAt < 2500;

    if (isFreshSummon) {
      playProceduralCombatSound('SUMMON');
      emergence.scale.set(0.001, 0.001, 0.001);

      if (portal) {
        portal.visible = true;
        gsap.fromTo(
          portal.scale,
          { x: 0.1, y: 0.1, z: 1 },
          {
            x: 2.1,
            y: 2.1,
            z: 1,
            duration: 0.55,
            ease: 'power2.out',
            onComplete: () => {
              portal.visible = false;
            },
          }
        );
      }

      gsap.to(emergence.scale, {
        x: 1,
        y: 1,
        z: 1,
        delay: 0.22,
        duration: 0.48,
        ease: 'back.out(1.7)',
      });
    } else {
      emergence.scale.set(1, 1, 1);
    }
  }, [card.summonedAt]);

  const effectiveToughness = Math.max(0, card.toughness - card.damageMarked);
  const isCreature = card.type === 'CREATURE';

  return (
    <group
      position={slotWorldPosition}
      rotation={[0, facingRotY, 0]}
      userData={{
        interactableType: 'CARD',
        cardId: card.id,
        owner: card.owner,
      }}
      onClick={(e) => {
        e.stopPropagation();
        interactWithCard(card.id, localSeat);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHoveredObjectId(card.id);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        if (useGameStore.getState().hoveredObjectId === card.id) {
          setHoveredObjectId(null);
        }
      }}
    >
      <mesh
        ref={portalRingRef}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[0.14, 0.2, 24]} />
        <meshBasicMaterial
          color={card.accentHex}
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
        />
      </mesh>

      <group ref={emergenceGroupRef}>
        {card.archetype === 'DRAGON_HERO' ? (
          <CrimsonHellkiteModel
            card={card}
            slotWorldPosition={slotWorldPosition}
            isTapped={card.tapped}
          />
        ) : card.archetype === 'GOLEM_HERO' ? (
          <AetherColossusModel
            card={card}
            slotWorldPosition={slotWorldPosition}
            isTapped={card.tapped}
          />
        ) : card.archetype === 'SHADE_HERO' ? (
          <ObsidianShadeModel
            card={card}
            slotWorldPosition={slotWorldPosition}
            isTapped={card.tapped}
          />
        ) : isCreature ? (
          <ArchetypeCreatureRig
            card={card}
            slotWorldPosition={slotWorldPosition}
          />
        ) : (
          <LandConstructRig card={card} />
        )}

        {isCreature && (
          <group
            position={[0, 0.46, 0]}
            rotation={[0, card.owner === localSeat ? 0 : Math.PI, 0]}
          >
            <mesh position={[0, 0, -0.005]}>
              <planeGeometry args={[0.34, 0.095]} />
              <meshBasicMaterial
                color="#090d16"
                transparent
                opacity={0.88}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[0, 0, -0.008]}>
              <planeGeometry args={[0.36, 0.11]} />
              <meshBasicMaterial
                color={
                  card.isAttacking
                    ? '#f43f5e'
                    : card.blockingAttackerId
                    ? '#00f0ff'
                    : card.accentHex
                }
                side={THREE.DoubleSide}
              />
            </mesh>
            <Text
              position={[0, 0.015, 0.002]}
              fontSize={0.036}
              color={card.damageMarked > 0 ? '#fb7185' : '#f8fafc'}
              anchorX="center"
              anchorY="middle"
            >
              {`${card.power} / ${effectiveToughness} HP`}
            </Text>
            <Text
              position={[0, -0.025, 0.002]}
              fontSize={0.022}
              color="#f5b041"
              anchorX="center"
              anchorY="middle"
            >
              {card.isAttacking
                ? 'ATTACKING'
                : card.blockingAttackerId
                ? 'BLOCKING'
                : card.keywords.join(' • ') || card.name}
            </Text>
          </group>
        )}
      </group>
    </group>
  );
};
