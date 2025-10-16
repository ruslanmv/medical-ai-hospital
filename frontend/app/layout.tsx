import '../styles/globals.css'; // <-- CORRECTED PATH
import { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import Providers from '@/lib/providers';

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || 'Medical AI Portal',
  description: 'Patient portal with AI intake assistant',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <Navbar />
          <main className="container-wide py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}