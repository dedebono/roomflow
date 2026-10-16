import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import { Toaster } from 'react-hot-toast';

const barlow = Barlow({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow-condensed',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RoomFlow — Premium Multi-Building Booking Engine',
  description: 'Manage and schedule rooms across multiple corporate buildings with intuitive conflict detection, dynamic calendars, and advanced RBAC rules.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#143258',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] selection:bg-[#F59E0B]/30 selection:text-[#0F172A]">
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#0F172A',
                color: '#FFFBEB',
                border: '1px solid #1E3A5F',
              },
            }}
          />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
