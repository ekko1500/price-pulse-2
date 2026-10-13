import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '@/components/LanguageContext';

export const metadata: Metadata = {
  title: 'PricePulse Myanmar',
  description: 'AI-powered wholesale–retail pricing intelligence for Myanmar small businesses.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-800 min-h-screen">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
