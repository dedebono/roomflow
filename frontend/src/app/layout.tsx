import type { Metadata, Viewport } from 'next';
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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} ${karla.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f1dece] dark:bg-[#1a1a1a] text-[#474547] dark:text-[#e8e8e8] selection:bg-[#f7b917]/30 selection:text-[#143258]">
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#2a2a2a',
                color: '#e8e8e8',
                border: '1px solid #3a3a3a',
              },
            }}
          />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
