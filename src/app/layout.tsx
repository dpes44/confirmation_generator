import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Confirmation Letter Generator',
  description: 'Generate audit balance confirmation letters as PDFs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
