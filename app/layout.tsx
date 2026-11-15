import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EM Growth · Lead Sources',
  description: 'What a booked call costs, by lead source.',
  robots: { index: false, follow: false },
};

// Applies a saved theme before the page paints, so dark mode never flashes white.
const themeScript = `try{var t=localStorage.getItem('em-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
