import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/components/Providers';
import './globals.css';

const sfMono = localFont({
  src: [
    {
      path: '../fonts/SF-Mono-Light.otf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../fonts/SF-Mono-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/SF-Mono-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/SF-Mono-Semibold.otf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../fonts/SF-Mono-Bold.otf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-mono',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
});

export const metadata: Metadata = {
  title: 'null//check | Risk-First DEX Screener',
  description:
    'Zero promoted tokens. Organic trending. Honeypot detection first.',
  keywords: ['dex', 'screener', 'crypto', 'defi', 'risk', 'honeypot', 'rug'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${sfMono.variable} font-mono antialiased bg-black text-neutral-200 overflow-x-hidden`}
      >
        <Providers>
          <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 overflow-visible">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
