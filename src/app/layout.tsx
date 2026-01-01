import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'リコールチェッカー',
  description: '中古車在庫のリコール状況を一括管理',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
