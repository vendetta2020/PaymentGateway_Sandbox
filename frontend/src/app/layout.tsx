import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import { AppShell } from '@/components/shell/app-shell';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Merchant Dashboard — Payment Gateway Simulator',
  description:
    'High-fidelity educational payment gateway merchant dashboard inspired by Stripe, Xendit, and Midtrans.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body className="min-h-screen bg-white text-neutral-900 font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
