'use client';

import Link from 'next/link';
import { ArrowRight, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function CTASection() {
    const { user, isLoading } = useAuth();

    // Hide CTA when user is logged in
    if (isLoading || user) return null;

    return (
        <section className="section-padding">
            <div className="max-w-container mx-auto px-4">
                <div className="relative bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 border border-brand-border rounded-3xl p-8 md:p-16 text-center overflow-hidden">
                    {/* Background Glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 blur-3xl" />

                    <div className="relative z-10">
                        <h2 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-4">
                            Bắt đầu khám phá chợ tài nguyên số ngay hôm nay
                        </h2>
                        <p className="text-brand-text-secondary max-w-lg mx-auto mb-8">
                            Tạo tài khoản để theo dõi đơn hàng, quản lý ví và giao dịch trên một nền tảng gọn gàng, hiện đại.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            <Link href="/dang-ky" className="btn-primary flex items-center gap-2">
                                <UserPlus className="w-4 h-4" /> Tạo tài khoản
                            </Link>
                            <Link href="/danh-muc" className="btn-secondary flex items-center gap-2">
                                Khám phá sản phẩm <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
