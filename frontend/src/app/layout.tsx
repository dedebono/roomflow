import type { Metadata } from 'next';
import { Geist, Geist_Mono, Playfair_Display, Karla } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import { Toaster } from 'react-hot-toast';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const playfairDisplay = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const karla = Karla({
  variable: '--font-karla',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'RoomFlow — Premium Multi-Building Booking Engine',
  description: 'Manage and schedule rooms across multiple corporate buildings with intuitive conflict detection, dynamic calendars, and advanced RBAC rules.',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} ${karla.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900 selection:bg-indigo-500/30 selection:text-indigo-900">
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid rgba(99, 102, 241, 0.15)',
              },
            }}
          />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
