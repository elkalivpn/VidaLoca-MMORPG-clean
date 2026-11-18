import type { Metadata, Viewport } from 'next';
import PwaRegistrar from '@/components/PwaRegistrar';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://vidaloca-mmorpg.vercel.app'),
  title: 'VidaLoca MMORPG (+18) — Mundo Abierto en España',
  description:
    'MMORPG +18 para adultos en Madrid, Barcelona, Marbella, Valencia, Galicia e Islas. Conducción 3D con drift, tiroteos, sangre, clubes nocturnos, casino clandestino, contrabando y Club VIP.',
  keywords: [
    'VidaLoca MMORPG',
    'juego online españa +18',
    'MMORPG adultos navegador',
    'mundo abierto 3D',
    'clanes',
    'vehículos',
    'drift 3D',
  ],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
  },
  openGraph: {
    title: 'VidaLoca MMORPG (+18) — España es tuya',
    description:
      'Experiencia adulta +18 sin censura: conducción 3D con drift, tiroteos, clubes nocturnos, casino clandestino, 78 misiones, 44 vehículos, Mercado P2P y Club VIP.',
    url: 'https://vidaloca-mmorpg.vercel.app',
    siteName: 'VidaLoca MMORPG (+18)',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/images/vidaloca-logo.png',
        width: 1200,
        height: 630,
        alt: 'VidaLoca MMORPG (+18) — Logotipo Oficial',
      },
      {
        url: '/images/vidaloca-loading.png',
        width: 1200,
        height: 630,
        alt: 'VidaLoca MMORPG (+18) — Asfalto Nocturno y Moto',
      },
      {
        url: '/images/madrid-hero.jpg',
        width: 1200,
        height: 630,
        alt: 'VidaLoca MMORPG (+18) — Mundo Abierto 3D en España',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VidaLoca MMORPG (+18) — Mundo Abierto en España',
    description:
      'Juega gratis (+18) en 1 clic: conducción 3D, tiroteos, clubes nocturnos, misiones co-op, clanes, Battle Pass y Club VIP.',
    images: ['/images/vidaloca-logo.png', '/images/vidaloca-loading.png'],
  },
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
      <body>
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
