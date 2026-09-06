import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'iPeople PULSE — продажі та зарплата',
  description: 'Щоденний калькулятор зарплати та мотивації команди iPeople.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/ipeople-pulse-icon-v2.png', type: 'image/png', sizes: '1254x1254' }],
    apple: [{ url: '/ipeople-pulse-icon-v2.png', type: 'image/png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
