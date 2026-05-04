import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Onboarding Reviews | Adams Pest Control',
  description: 'Schedule and track 30/60/180-day employee onboarding reviews',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
