import { MobileGameApp } from '@/components/MobileGameApp';

interface ShortRoomPageProps {
  params: {
    room: string;
  };
}

export default function ShortRoomPage({ params }: ShortRoomPageProps) {
  const rawSlug = decodeURIComponent(params.room || 'a1').trim();
  const normalized = rawSlug.toLowerCase();

  if (normalized === 's' || normalized === 'solo' || normalized === 'ai') {
    return (
      <MobileGameApp
        initialRoom="A1"
        initialMode="SOLO_AI"
        initialSeat="P1"
        autoLaunch={true}
      />
    );
  }

  const isPlayerTwo = normalized.endsWith('-2');
  const roomCode =
    (isPlayerTwo ? normalized.slice(0, -2) : normalized).toUpperCase() || 'A1';

  return (
    <MobileGameApp
      initialRoom={roomCode}
      initialMode="MULTIPLAYER"
      initialSeat={isPlayerTwo ? 'P2' : 'P1'}
      autoLaunch={true}
    />
  );
}
