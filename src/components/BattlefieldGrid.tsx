'use client';

import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/store/useGameStore';
import { CardInstance, PlayerSeat } from '@/types/game';
import { computeSlotWorldCoords } from '@/systems/CombatChoreographer';
import { Card3D } from './Card3D';
import { CreatureFactory } from './creatures/CreatureFactory';

const SLOT_COUNT = 6;

export const BattlefieldGrid: React.FC = () => {
  const cards = useGameStore((s) => s.cards);
  const localSeat = useGameStore((s) => s.localSeat);
  const activePlayer = useGameStore((s) => s.activePlayer);
  const phase = useGameStore((s) => s.phase);
  const players = useGameStore((s) => s.players);
  const selectedCardId = useGameStore((s) => s.selectedCardId);
  const hoveredObjectId = useGameStore((s) => s.hoveredObjectId);
  const winner = useGameStore((s) => s.winner);

  const setHoveredObjectId = useGameStore((s) => s.setHoveredObjectId);
  const interactWithSlot = useGameStore((s) => s.interactWithSlot);
  const drawCard = useGameStore((s) => s.drawCard);
  const resetMatch = useGameStore((s) => s.resetMatch);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedCardId) ?? null,
    [cards, selectedCardId]
  );

  const localPlayer = players[localSeat];
  const isLocalMainPhase =
    activePlayer === localSeat && phase === 'START_AND_MAIN_1';

  const highlightCreatureSlots = Boolean(
    isLocalMainPhase &&
      selectedCard &&
      selectedCard.owner === localSeat &&
      selectedCard.zone === 'HAND' &&
      selectedCard.type === 'CREATURE' &&
      localPlayer.manaPool >= selectedCard.manaCost
  );

  const highlightLandSlots = Boolean(
    isLocalMainPhase &&
      localPlayer.landsPlayedThisTurn < localPlayer.maxLandsPerTurn &&
      ((selectedCard &&
        selectedCard.owner === localSeat &&
        selectedCard.zone === 'HAND' &&
        selectedCard.type === 'LAND') ||
        cards.some(
          (c) => c.owner === localSeat && c.zone === 'HAND' && c.type === 'LAND'
        ))
  );

  const battlefieldCardsLayout = useMemo(() => {
    const seats: PlayerSeat[] = ['P1', 'P2'];
    const list: Array<{
      card: CardInstance;
      slotPos: [number, number, number];
      cardPos: [number, number, number];
      rotation: [number, number, number];
      has3DConstruct: boolean;
    }> = [];

    seats.forEach((seat) => {
      const zSign = seat === 'P1' ? 1 : -1;
      const facingRotY = seat === 'P1' ? 0 : Math.PI;

      const creatures = cards.filter(
        (c) => c.owner === seat && c.zone === 'BATTLEFIELD_CREATURE'
      );
      creatures.forEach((card, fallbackIdx) => {
        const slot = card.slotIndex ?? fallbackIdx % 6;
        const pos = computeSlotWorldCoords(seat, 'BATTLEFIELD_CREATURE', slot);
        const tapRotZ = card.tapped ? -Math.PI / 2 : 0;
        list.push({
          card,
          slotPos: pos,
          cardPos: [pos[0], pos[1] + 0.008, pos[2]],
          rotation: [-Math.PI / 2, facingRotY, tapRotZ],
          has3DConstruct: true,
        });
      });

      const lands = cards.filter(
        (c) => c.owner === seat && c.zone === 'BATTLEFIELD_LAND'
      );
      lands.forEach((card, fallbackIdx) => {
        const slot = card.slotIndex ?? fallbackIdx % 6;
        const pos = computeSlotWorldCoords(seat, 'BATTLEFIELD_LAND', slot);
        const tapRotZ = card.tapped ? -Math.PI / 2 : 0;
        list.push({
          card,
          slotPos: pos,
          cardPos: [pos[0], pos[1] + 0.008, pos[2]],
          rotation: [-Math.PI / 2, facingRotY, tapRotZ],
          has3DConstruct: true,
        });
      });

      const grave = cards.filter(
        (c) => c.owner === seat && c.zone === 'GRAVEYARD'
      );
      if (grave.length > 0) {
        const topGrave = grave[grave.length - 1];
        const gPos: [number, number, number] = [
          -1.85 * zSign,
          0.825,
          1.35 * zSign,
        ];
        list.push({
          card: topGrave,
          slotPos: gPos,
          cardPos: gPos,
          rotation: [-Math.PI / 2, facingRotY, 0],
          has3DConstruct: false,
        });
      }
    });

    return list;
  }, [cards]);

  const seats: PlayerSeat[] = ['P1', 'P2'];

  return (
    <group name="battlefield-grid">
      {seats.map((seat) => {
        const isLocal = seat === localSeat;
        const zSign = seat === 'P1' ? 1 : -1;
        const facingRotY = seat === 'P1' ? 0 : Math.PI;
        const libCount = cards.filter(
          (c) => c.owner === seat && c.zone === 'LIBRARY'
        ).length;
        const graveCount = cards.filter(
          (c) => c.owner === seat && c.zone === 'GRAVEYARD'
        ).length;

        return (
          <group key={`grid-${seat}`}>
            {Array.from({ length: SLOT_COUNT }).map((_, slotIdx) => {
              const pos = computeSlotWorldCoords(
                seat,
                'BATTLEFIELD_CREATURE',
                slotIdx
              );
              const occupied = cards.some(
                (c) =>
                  c.owner === seat &&
                  c.zone === 'BATTLEFIELD_CREATURE' &&
                  c.slotIndex === slotIdx
              );
              const canPlaceCreature =
                isLocal && highlightCreatureSlots && !occupied;
              const slotHoverId = `slot-${seat}-creature-${slotIdx}`;
              const isHovered = hoveredObjectId === slotHoverId;

              return (
                <group
                  key={slotHoverId}
                  position={pos}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <mesh
                    name={slotHoverId}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isLocal) {
                        interactWithSlot('BATTLEFIELD_CREATURE', slotIdx, seat);
                      }
                    }}
                    onPointerOver={(e) => {
                      e.stopPropagation();
                      setHoveredObjectId(slotHoverId);
                    }}
                    onPointerOut={(e) => {
                      e.stopPropagation();
                      if (hoveredObjectId === slotHoverId) {
                        setHoveredObjectId(null);
                      }
                    }}
                  >
                    <planeGeometry args={[0.46, 0.62]} />
                    <meshBasicMaterial
                      color={
                        canPlaceCreature
                          ? '#10b981'
                          : isHovered && isLocal
                          ? '#00f0ff'
                          : '#1e293b'
                      }
                      transparent
                      opacity={canPlaceCreature ? 0.58 : 0.28}
                      side={THREE.DoubleSide}
                    />
                  </mesh>

                  <mesh position={[0, 0, 0.001]}>
                    <ringGeometry args={[0.25, 0.27, 4]} />
                    <meshBasicMaterial
                      color={canPlaceCreature ? '#34d399' : '#334155'}
                      transparent
                      opacity={canPlaceCreature ? 0.9 : 0.4}
                    />
                  </mesh>
                </group>
              );
            })}

            {Array.from({ length: SLOT_COUNT }).map((_, slotIdx) => {
              const pos = computeSlotWorldCoords(
                seat,
                'BATTLEFIELD_LAND',
                slotIdx
              );
              const occupied = cards.some(
                (c) =>
                  c.owner === seat &&
                  c.zone === 'BATTLEFIELD_LAND' &&
                  c.slotIndex === slotIdx
              );
              const canPlaceLand = isLocal && highlightLandSlots && !occupied;
              const slotHoverId = `slot-${seat}-land-${slotIdx}`;
              const isHovered = hoveredObjectId === slotHoverId;

              return (
                <group
                  key={slotHoverId}
                  position={pos}
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  <mesh
                    name={slotHoverId}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isLocal) {
                        interactWithSlot('BATTLEFIELD_LAND', slotIdx, seat);
                      }
                    }}
                    onPointerOver={(e) => {
                      e.stopPropagation();
                      setHoveredObjectId(slotHoverId);
                    }}
                    onPointerOut={(e) => {
                      e.stopPropagation();
                      if (hoveredObjectId === slotHoverId) {
                        setHoveredObjectId(null);
                      }
                    }}
                  >
                    <planeGeometry args={[0.45, 0.6]} />
                    <meshBasicMaterial
                      color={
                        canPlaceLand
                          ? '#10b981'
                          : isHovered && isLocal
                          ? '#00f0ff'
                          : '#0f172a'
                      }
                      transparent
                      opacity={canPlaceLand ? 0.52 : 0.25}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                </group>
              );
            })}

            <group
              position={[1.85 * zSign, 0.84, 1.35 * zSign]}
              rotation={[0, facingRotY, 0]}
              onClick={(e) => {
                e.stopPropagation();
                if (!isLocal) return;
                if (winner) {
                  resetMatch();
                } else {
                  drawCard(localSeat);
                }
              }}
            >
              <mesh>
                <boxGeometry args={[0.4, 0.12, 0.56]} />
                <meshLambertMaterial color="#1e293b" />
              </mesh>
              <Text
                position={[0, 0.11, 0]}
                fontSize={0.048}
                color="#00f0ff"
                anchorX="center"
                anchorY="middle"
              >
                {winner && isLocal ? 'RESET' : `DECK (${libCount})`}
              </Text>
            </group>

            <group
              position={[-1.85 * zSign, 0.815, 1.35 * zSign]}
              rotation={[0, facingRotY, 0]}
            >
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.44, 0.6]} />
                <meshBasicMaterial
                  color="#3b0764"
                  transparent
                  opacity={0.35}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <Text
                position={[0, 0.08, 0.34]}
                fontSize={0.045}
                color="#c084fc"
                anchorX="center"
                anchorY="middle"
              >
                {`GRAVE (${graveCount})`}
              </Text>
            </group>
          </group>
        );
      })}

      {battlefieldCardsLayout.map(
        ({ card, slotPos, cardPos, rotation, has3DConstruct }) => (
          <React.Fragment key={card.id}>
            <Card3D
              card={card}
              targetPosition={cardPos}
              targetRotation={rotation}
              localSeat={localSeat}
              faceDown={false}
              hoverScale={1.06}
              hoverLiftY={0.02}
            />
            {has3DConstruct && (
              <CreatureFactory
                card={card}
                slotWorldPosition={slotPos}
                localSeat={localSeat}
              />
            )}
          </React.Fragment>
        )
      )}
    </group>
  );
};
