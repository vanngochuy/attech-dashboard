import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'vietnamese'], display: 'swap' });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0284c7',
};

export const metadata: Metadata = {
  title: 'ATTECH AI – Hệ thống Tài liệu & Trợ lý Tri thức',
  description:
    'Trợ lý AI tra cứu tài liệu kỹ thuật, quản lý công việc từ email và kho tài liệu Google Drive cho đài trạm CNS.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ATTECH Docs',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/attech-logo.png',
    shortcut: '/attech-logo.png',
    apple: [
      { url: '/attech-logo.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="dark">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ATTECH Docs" />
        <link rel="apple-touch-icon" href="/attech-logo.png" />
      </head>
      <body className={`${inter.className} antialiased bg-slate-950 text-slate-50`}>{children}</body>
    </html>
  );
}
