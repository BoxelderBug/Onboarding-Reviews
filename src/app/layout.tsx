import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { GoogleCalendarProvider } from '@/context/GoogleCalendarContext';

export const metadata: Metadata = {
  title: 'HR Comm/Sched Center | Adams Pest Control',
  description: 'HR communication and scheduling center for Adams Pest Control',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen font-sans antialiased">
        <GoogleCalendarProvider>{children}</GoogleCalendarProvider>
        {/* Google Identity Services — loaded after page is interactive */}
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      </body>
    </html>
  );
}
