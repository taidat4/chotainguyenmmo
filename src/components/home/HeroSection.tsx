'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
    ArrowRight, Package, Store, ShoppingBag, Activity,
    Wallet, TrendingUp, ShieldCheck, BarChart3, Sparkles
} from 'lucide-react';

interface HeroSectionProps {
    isLoggedIn?: boolean;
}

export default function HeroSection({ isLoggedIn = false }: HeroSectionProps) {
    const { user } = useAuth();

    // Use server-side cookie for initial render, client auth for user details
    const showCompact = isLoggedIn;

    // ─── Compact Hero for logged-in users (only after mount) ───
    if (showCompact) {
        return (
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/5 via-brand-secondary/3 to-transparent" />
                <div className="max-w-container mx-auto px-4 py-6 relative z-10">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        {/* Welcome message */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-brand-text-primary">
                                    Xin chào, <span className="gradient-text">{user?.fullName || user?.username || 'bạn'}</span>! 👋
                                </h2>
                                <p className="text-sm text-brand-text-secondary">Khám phá sản phẩm mới hoặc quản lý đơn hàng của bạn</p>
                            </div>
                        </div>

                        {/* Quick actions */}
                        <div className="flex items-center gap-2">
                            <Link href="/danh-muc" className="btn-primary !px-4 !py-2 text-sm flex items-center gap-1.5">
                                <Package className="w-4 h-4" /> Khám phá
                            </Link>
                            <Link href="/dashboard" className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-1.5">
                                Dashboard
                            </Link>
                        </div>
                    </div>

                    {/* Compact stats row */}
                    <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t border-brand-border/50">
                        {[
                            { icon: Package, value: '25,000+', label: 'Sản phẩm' },
                            { icon: Store, value: '1,200+', label: 'Gian hàng' },
                            { icon: ShoppingBag, value: '80,000+', label: 'Giao dịch' },
                            { icon: Activity, value: '99.9%', label: 'Uptime' },
                        ].map((stat, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <stat.icon className="w-3.5 h-3.5 text-brand-primary" />
                                <span className="text-sm font-bold text-brand-text-primary">{stat.value}</span>
                                <span className="text-xs text-brand-text-muted">{stat.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    // ─── Full Hero (default for SSR + guests) ───
    return (
        <section className="relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/5 via-transparent to-transparent" />
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-brand-primary/5 rounded-full blur-[120px]" />
            <div className="absolute top-40 right-1/4 w-80 h-80 bg-brand-secondary/5 rounded-full blur-[120px]" />

            <div className="max-w-container mx-auto px-4 py-16 md:py-24 relative z-10">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Content */}
                    <div>
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-sm text-brand-primary font-medium mb-6">
                            <Activity className="w-4 h-4" />
                            Nền tảng giao dịch tài nguyên số hiện đại
                        </div>

                        {/* Title */}
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-brand-text-primary leading-tight mb-6">
                            Mua bán tài nguyên số{' '}
                            <span className="gradient-text">nhanh, rõ ràng</span>{' '}
                            và thuận tiện trên{' '}
                            <span className="gradient-text">ChoTaiNguyen</span>
                        </h1>

                        {/* Description */}
                        <p className="text-base md:text-lg text-brand-text-secondary leading-relaxed mb-8 max-w-xl">
                            Khám phá hàng loạt tài nguyên số từ nhiều người bán trên một nền tảng duy nhất.
                            Tìm kiếm dễ dàng, giao dịch nhanh chóng, quản lý đơn hàng và ví nội bộ trong một trải nghiệm gọn gàng, hiện đại.
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-wrap gap-3 mb-10">
                            <Link href="/danh-muc" className="btn-primary flex items-center gap-2">
                                Khám phá ngay <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link href="/dang-ky-ban-hang" className="btn-secondary flex items-center gap-2">
                                <Store className="w-4 h-4" /> Trở thành người bán
                            </Link>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                                { icon: Package, value: '25,000+', label: 'Sản phẩm' },
                                { icon: Store, value: '1,200+', label: 'Gian hàng' },
                                { icon: ShoppingBag, value: '80,000+', label: 'Giao dịch' },
                                { icon: Activity, value: '99.9%', label: 'Uptime' },
                            ].map((stat, i) => (
                                <div key={i} className="text-center sm:text-left">
                                    <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                                        <stat.icon className="w-4 h-4 text-brand-primary" />
                                        <span className="text-xl font-bold text-brand-text-primary">{stat.value}</span>
                                    </div>
                                    <span className="text-xs text-brand-text-muted">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Visual - Dashboard Mockup */}
                    <div className="hidden lg:block relative">
                        {/* Main Card */}
                        <div className="bg-brand-surface border border-brand-border rounded-3xl p-6 shadow-card relative z-10">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-semibold text-brand-text-primary">Tổng quan giao dịch</h3>
                                <span className="badge-success">Hoạt động</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-brand-surface-2 rounded-xl p-4">
                                    <Wallet className="w-5 h-5 text-brand-primary mb-2" />
                                    <div className="text-lg font-bold text-brand-text-primary">2,450,000đ</div>
                                    <div className="text-xs text-brand-text-muted">Số dư ví</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-4">
                                    <TrendingUp className="w-5 h-5 text-brand-success mb-2" />
                                    <div className="text-lg font-bold text-brand-text-primary">156</div>
                                    <div className="text-xs text-brand-text-muted">Đơn hoàn tất</div>
                                </div>
                            </div>
                            {/* Mini Chart Bars */}
                            <div className="flex items-end gap-1.5 h-20 mb-4">
                                {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                                    <div
                                        key={i}
                                        className="flex-1 rounded-t-md bg-gradient-to-t from-brand-primary/40 to-brand-primary/80"
                                        style={{ height: `${h}%` }}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center justify-between text-xs text-brand-text-muted">
                                <span>7 ngày qua</span>
                                <span className="text-brand-success font-medium">+12.5%</span>
                            </div>
                        </div>

                        {/* Floating Card 1 */}
                        <div className="absolute -top-4 -right-4 bg-brand-surface border border-brand-border rounded-xl p-3 shadow-card animate-float z-20">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-brand-success/20 flex items-center justify-center">
                                    <ShieldCheck className="w-4 h-4 text-brand-success" />
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-brand-text-primary">Giao hàng tự động</div>
                                    <div className="text-[10px] text-brand-text-muted">Nhận ngay sau thanh toán</div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Card 2 */}
                        <div className="absolute -bottom-4 -left-4 bg-brand-surface border border-brand-border rounded-xl p-3 shadow-card animate-float-delayed z-20">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-brand-primary/20 flex items-center justify-center">
                                    <BarChart3 className="w-4 h-4 text-brand-primary" />
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-brand-text-primary">+2,450 đơn</div>
                                    <div className="text-[10px] text-brand-text-muted">Tháng này</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
