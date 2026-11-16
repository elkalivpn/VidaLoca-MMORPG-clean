import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VidaLoca MMORPG',
  description: 'Mundo libre. Tú decides quién eres.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#f59e0b',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
