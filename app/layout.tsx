import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EM Growth · Lead Sources',
  description: 'What a booked call costs, by lead source.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
