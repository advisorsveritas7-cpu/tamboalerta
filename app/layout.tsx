import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { RegistrarSW } from '@/components/RegistrarSW';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Sora({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display', display: 'swap' });

const SITIO = process.env.SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: 'TamboAlerta · Prevenir es proteger vidas',
  description: 'Monitoreo de lluvias, mapa de calles inundables y reportes ciudadanos en tiempo real para Tambogrande y las ciudades de la región Piura.',
  manifest: './manifest.webmanifest',
  applicationName: 'TamboAlerta',
  appleWebApp: { capable: true, title: 'TamboAlerta', statusBarStyle: 'black-translucent' },
  icons: { icon: './icons/icon.svg', apple: './icons/icon-192.png' },
  openGraph: {
    title: 'TamboAlerta · Prevenir es proteger vidas',
    description: 'Mapa de calles inundables y reportes ciudadanos de la región Piura.',
    images: [`${SITIO}/icons/og.png`],
    url: SITIO,
    locale: 'es_PE',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A192F',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE" className={`${sans.variable} ${display.variable}`}>
      <body className="bg-navy-900 font-sans text-white antialiased">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
