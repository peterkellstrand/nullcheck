import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
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
        className={`${mono.variable} font-mono antialiased bg-black text-neutral-200`}
      >
        <Providers>
          <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
