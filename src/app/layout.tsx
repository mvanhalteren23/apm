import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'APM | AetherPlanes Mobile',
  description:
    'Touch-first 3D Trading Card Game for iOS & Android with cross-play to AetherPlanes VR on Pico G2.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#060913',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#060913] text-slate-100">
        {children}
      </body>
    </html>
  );
}
