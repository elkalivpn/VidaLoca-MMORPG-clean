import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VidaLoca – MMORPG de mundo libre en España | Tú decides quién eres',
  description:
    'MMORPG de navegador en Madrid, Barcelona, Marbella y más. Economía dual, clanes, territorios, vehículos, misiones y multijugador en tiempo real.',
  keywords: [
    'MMORPG',
    'juego online',
    'España',
    'Madrid',
    'Barcelona',
    'Marbella',
    'mundo libre',
    'clanes',
  ],
  openGraph: {
    title: 'VidaLoca – Tú decides quién eres',
    description:
      'Vive la vida que quieras en las calles de España. Clanes, lujo, calle y multijugador en vivo.',
    type: 'website',
    locale: 'es_ES',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VidaLoca MMORPG',
    description: 'Mundo libre. Tú decides quién eres.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-black text-zinc-100 antialiased antialiased">
        {children}
      </body>
    </html>
  );
}
