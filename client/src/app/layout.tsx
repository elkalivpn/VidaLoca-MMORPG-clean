import type { Metadata, Viewport } from 'next';
import PwaRegistrar from '@/components/PwaRegistrar';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://vidaloca-mmorpg.vercel.app'),
  title: 'VidaLoca MMORPG — Mundo Abierto en España',
  description:
    'Domina las calles de Madrid, Barcelona, Marbella, Valencia, Galicia e Islas en un MMORPG 3D en vivo con clanes, vehículos, propiedades, Battle Pass y Club VIP.',
  keywords: [
    'VidaLoca MMORPG',
    'juego online españa',
    'MMORPG navegador',
    'mundo abierto 3D',
    'clanes',
    'vehículos',
  ],
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'VidaLoca MMORPG — España es tuya',
    description:
      'Entra gratis en 1 clic: conducción 3D con drift, 78 misiones, 44 vehículos, propiedades, Mercado P2P, Battle Pass y Club VIP.',
    url: 'https://vidaloca-mmorpg.vercel.app',
    siteName: 'VidaLoca MMORPG',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/images/madrid-hero.jpg',
        width: 1200,
        height: 630,
        alt: 'VidaLoca MMORPG — Mundo Abierto 3D en España',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VidaLoca MMORPG — Mundo Abierto en España',
    description:
      'Juega gratis en 1 clic: conducción 3D, misiones co-op, clanes, Battle Pass y Club VIP.',
    images: ['/images/madrid-hero.jpg'],
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
