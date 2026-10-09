import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'vietnamese'], display: 'swap' });

export const metadata: Metadata = {
  title: 'ATTECH AI – Hệ thống Tài liệu & Trợ lý Tri thức',
  description:
    'Trợ lý AI tra cứu tài liệu kỹ thuật, quản lý công việc từ email và kho tài liệu Google Drive cho đài trạm CNS.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="dark">
      <body className={`${inter.className} antialiased bg-slate-950 text-slate-50`}>{children}</body>
    </html>
  );
}
