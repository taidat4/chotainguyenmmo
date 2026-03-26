import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
    subsets: ['latin', 'vietnamese'],
    weight: ['300', '400', '500', '600', '700', '800'],
    display: 'swap',
    variable: '--font-inter',
});

export const metadata: Metadata = {
    title: 'ChoTaiNguyen - Chợ tài nguyên số, giao dịch nhanh và an toàn',
    description: 'ChoTaiNguyen là nền tảng giao dịch tài nguyên số với trải nghiệm hiện đại, rõ ràng và thuận tiện cho cả người mua lẫn người bán.',
    keywords: 'tài nguyên số, marketplace, mua bán tài khoản, phần mềm, AI tools, proxy',
    icons: {
        icon: '/logo_ngoaiweb.png',
        apple: '/logo_ngoaiweb.png',
    },
    openGraph: {
        title: 'ChoTaiNguyen - Chợ tài nguyên số',
        description: 'Nền tảng giao dịch tài nguyên số hiện đại cho người dùng Việt Nam.',
        siteName: 'ChoTaiNguyen',
        type: 'website',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="vi" className={inter.variable} suppressHydrationWarning>
            <body className="min-h-screen bg-brand-bg text-brand-text-primary antialiased">
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
