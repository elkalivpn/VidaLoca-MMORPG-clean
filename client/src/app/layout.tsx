import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VidaLoca MMORPG',
  description: 'Mundo libre. Tú decides quién eres.',
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
