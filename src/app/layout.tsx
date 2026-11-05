import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'ReturnDesk | Support Agent Portal',
  description: 'Production-ready return & replacement management desk',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
