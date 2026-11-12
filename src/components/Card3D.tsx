'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { CardInstance, PlayerSeat } from '@/types/game';
import { useGameStore } from '@/store/useGameStore';
import { computeHandOriginWorldCoords } from '@/systems/CombatChoreographer';

interface Card3DProps {
  card: CardInstance;
  targetPosition: [number, number, number];
  targetRotation: [number, number, number];
  localSeat: PlayerSeat;
  faceDown?: boolean;
  hoverScale?: number;
  hoverLiftY?: number;
}

const backTextureCache = new Map<string, THREE.CanvasTexture>();

function getOrCreateCardBackTexture(): THREE.CanvasTexture {
  const existing = backTextureCache.get('AETHER_BACK');
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 356;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 256, 356);

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 7;
    ctx.strokeRect(12, 12, 232, 332);

    ctx.strokeStyle = '#f5b041';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(128, 178, 64, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(128, 102);
    ctx.lineTo(182, 178);
    ctx.lineTo(128, 254);
    ctx.lineTo(74, 178);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AETHERPLANES', 128, 184);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  backTextureCache.set('AETHER_BACK', texture);
  return texture;
}

export const Card3D: React.FC<Card3DProps> = ({
  card,
  targetPosition,
  targetRotation,
  localSeat,
  faceDown = false,
  hoverScale = 1.15,
  hoverLiftY = 0.12,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const playedFlightDoneRef = useRef<number | null>(null);

  const hoveredObjectId = useGameStore((s) => s.hoveredObjectId);
  const selectedCardId = useGameStore((s) => s.selectedCardId);
  const selectedBlockerId = useGameStore((s) => s.selectedBlockerId);
  const setHoveredObjectId = useGameStore((s) => s.setHoveredObjectId);
  const interactWithCard = useGameStore((s) => s.interactWithCard);

  const isHovered = hoveredObjectId === card.id;
  const isSelected =
    selectedCardId === card.id || selectedBlockerId === card.id;

  const backTexture = useMemo(() => {
    if (typeof document === 'undefined' || !faceDown) return null;
    return getOrCreateCardBackTexture();
  }, [faceDown]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const isFreshBattlefieldPlay =
      (card.zone === 'BATTLEFIELD_CREATURE' ||
        card.zone === 'BATTLEFIELD_LAND') &&
      card.summonedAt !== null &&
      playedFlightDoneRef.current !== card.summonedAt &&
      Date.now() - card.summonedAt < 2500;

    if (isFreshBattlefieldPlay) {
      playedFlightDoneRef.current = card.summonedAt;
      const handOrigin = computeHandOriginWorldCoords(card.owner, localSeat);
      gsap.fromTo(
        group.position,
        {
          x: handOrigin[0],
          y: handOrigin[1],
          z: handOrigin[2],
        },
        {
          x: targetPosition[0],
          y: targetPosition[1],
          z: targetPosition[2],
          duration: 0.3,
          ease: 'power2.out',
          overwrite: 'auto',
        }
      );

      gsap.fromTo(
        group.rotation,
        {
          x: card.owner === 'P1' ? -0.45 : 0.45,
          y: targetRotation[1],
          z: 0,
        },
        {
          x: targetRotation[0],
          y: targetRotation[1],
          z: targetRotation[2],
          duration: 0.3,
          ease: 'power2.out',
          overwrite: 'auto',
        }
      );
      return;
    }

    const liftY =
      !faceDown && (isHovered || isSelected) ? hoverLiftY : 0;
    const zPop =
      !faceDown && (isHovered || isSelected) && card.zone === 'HAND'
        ? card.owner === 'P1'
          ? 0.08
          : -0.08
        : 0;
    const scaleVal =
      !faceDown && (isHovered || isSelected) ? hoverScale : 1.0;

    gsap.to(group.position, {
      x: targetPosition[0],
      y: targetPosition[1] + liftY,
      z: targetPosition[2] + zPop,
      duration: 0.24,
      ease: 'power2.out',
      overwrite: 'auto',
    });

    gsap.to(group.rotation, {
      x: targetRotation[0],
      y: targetRotation[1],
      z: targetRotation[2],
      duration: 0.26,
      ease: 'power2.out',
      overwrite: 'auto',
    });

    gsap.to(group.scale, {
      x: scaleVal,
      y: scaleVal,
      z: scaleVal,
      duration: 0.2,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }, [
    targetPosition,
    targetRotation,
    isHovered,
    isSelected,
    faceDown,
    hoverLiftY,
    hoverScale,
    card.zone,
    card.owner,
    card.summonedAt,
    localSeat,
  ]);

  const effectiveToughness = Math.max(0, card.toughness - card.damageMarked);
  const keywordString =
    card.keywords.length > 0 ? card.keywords.join(' • ') : card.type;

  const statusTag = card.isAttacking
    ? '[ATTACKING]'
    : card.blockingAttackerId
    ? '[BLOCKING]'
    : card.zone === 'BATTLEFIELD_CREATURE' &&
      card.summoningSick &&
      !card.keywords.includes('Haste')
    ? 'SUMMON SICK'
    : null;

  return (
    <group
      ref={groupRef}
      name={card.id}
      userData={{
        interactableType: 'CARD',
        cardId: card.id,
        owner: card.owner,
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!faceDown) {
          interactWithCard(card.id, localSeat);
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!faceDown) {
          setHoveredObjectId(card.id);
        }
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        if (hoveredObjectId === card.id) {
          setHoveredObjectId(null);
        }
      }}
    >
      {faceDown ? (
        <mesh>
          <planeGeometry args={[0.38, 0.54]} />
          <meshBasicMaterial
            map={backTexture ?? undefined}
            color="#ffffff"
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : (
        <>
          <mesh position={[0, 0, -0.002]}>
            <planeGeometry args={[0.42, 0.58]} />
            <meshBasicMaterial
              color={
                card.isAttacking
                  ? '#f43f5e'
                  : isSelected
                  ? '#f5b041'
                  : isHovered
                  ? '#00f0ff'
                  : card.accentHex
              }
              side={THREE.DoubleSide}
            />
          </mesh>

          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[0.39, 0.55]} />
            <meshBasicMaterial
              color={card.tapped ? '#070b14' : '#0b1120'}
              side={THREE.DoubleSide}
            />
          </mesh>

          <mesh position={[0, 0.06, 0.002]}>
            <planeGeometry args={[0.35, 0.21]} />
            <meshBasicMaterial color="#1e293b" />
          </mesh>

          <mesh position={[0, 0.06, 0.004]}>
            {card.type === 'LAND' ? (
              <ringGeometry args={[0.04, 0.075, 6]} />
            ) : card.type === 'CREATURE' ? (
              <circleGeometry args={[0.07, 16]} />
            ) : (
              <ringGeometry args={[0.03, 0.075, 3]} />
            )}
            <meshBasicMaterial color={card.accentHex} />
          </mesh>

          <Text
            position={[-0.17, 0.225, 0.005]}
            fontSize={0.03}
            color="#f8fafc"
            anchorX="left"
            anchorY="middle"
            maxWidth={0.28}
          >
            {card.name}
          </Text>

          {card.manaCost > 0 && (
            <group position={[0.145, 0.225, 0.005]}>
              <mesh>
                <circleGeometry args={[0.028, 12]} />
                <meshBasicMaterial color={card.accentHex} />
              </mesh>
              <Text
                position={[0, 0, 0.002]}
                fontSize={0.032}
                color="#090d16"
                anchorX="center"
                anchorY="middle"
              >
                {String(card.manaCost)}
              </Text>
            </group>
          )}

          <Text
            position={[0, -0.075, 0.005]}
            fontSize={0.025}
            color={card.accentHex}
            anchorX="center"
            anchorY="middle"
            maxWidth={0.35}
          >
            {keywordString.toUpperCase()}
          </Text>

          <Text
            position={[0, -0.145, 0.005]}
            fontSize={0.02}
            color="#cbd5e1"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.34}
            textAlign="center"
          >
            {card.rulesText}
          </Text>

          {statusTag && (
            <Text
              position={[-0.17, -0.225, 0.006]}
              fontSize={0.022}
              color={
                card.isAttacking
                  ? '#f43f5e'
                  : card.blockingAttackerId
                  ? '#38bdf8'
                  : '#f5b041'
              }
              anchorX="left"
              anchorY="middle"
            >
              {statusTag}
            </Text>
          )}

          {card.type === 'CREATURE' && (
            <group position={[0.125, -0.225, 0.005]}>
              <mesh>
                <planeGeometry args={[0.11, 0.05]} />
                <meshBasicMaterial color={card.accentHex} />
              </mesh>
              <Text
                position={[0, 0, 0.002]}
                fontSize={0.031}
                color="#090d16"
                anchorX="center"
                anchorY="middle"
              >
                {`${card.power}/${effectiveToughness}`}
              </Text>
            </group>
          )}
        </>
      )}
    </group>
  );
};
