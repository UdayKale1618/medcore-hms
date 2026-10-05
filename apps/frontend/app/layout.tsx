import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { SocketProvider } from '@/lib/socket-context';
import { ToastProvider } from '@/lib/toast-context';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MedCore HMS — Hospital Management System',
  description: 'Multi-tenant Enterprise Hospital Management and Clinical Information System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#F6F8FC] text-[#111827] font-sans">
        <AuthProvider>
          <SocketProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </SocketProvider>
        </AuthProvider>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
