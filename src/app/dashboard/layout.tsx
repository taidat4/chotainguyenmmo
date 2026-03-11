'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
    LayoutDashboard, Wallet, ShoppingBag, AlertTriangle, Heart,
    Bell, User, Shield, LogOut, ChevronLeft, Menu, X,
    Home, Grid3X3, Store, HelpCircle, Search, PlusCircle, Key
} from 'lucide-react';

const userMenuItems = [
    { icon: LayoutDashboard, label: 'Tổng quan', href: '/dashboard' },
    { icon: User, label: 'Hồ sơ', href: '/dashboard/ho-so' },
    { icon: Shield, label: 'Bảo mật', href: '/dashboard/bao-mat' },
    { icon: Wallet, label: 'Ví của tôi', href: '/dashboard/vi' },
    { icon: PlusCircle, label: 'Nạp tiền', href: '/dashboard/nap-tien' },
    { icon: ShoppingBag, label: 'Đơn hàng', href: '/dashboard/don-hang' },
    { icon: AlertTriangle, label: 'Khiếu nại', href: '/dashboard/khieu-nai' },
    { icon: Heart, label: 'Yêu thích', href: '/dashboard/yeu-thich' },
    { icon: Bell, label: 'Thông báo', href: '/dashboard/thong-bao' },
    { icon: Key, label: 'API Keys', href: '/dashboard/api-keys' },
];

const quickLinks = [
    { icon: Home, label: 'Trang chủ', href: '/' },
    { icon: Grid3X3, label: 'Danh mục', href: '/danh-muc' },
    { icon: Store, label: 'Gian hàng', href: '/gian-hang' },
    { icon: Search, label: 'Tìm kiếm', href: '/san-pham' },
    { icon: HelpCircle, label: 'Hỗ trợ', href: '/ho-tro' },
];

function SidebarContent({ pathname, user, onClose, onLogout }: { pathname: string; user: { fullName: string; username: string; email: string } | null; onClose?: () => void; onLogout: () => void }) {
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase();

    return (
        <>
            {/* Brand */}
            <div className="p-5 border-b border-brand-border flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-md">
                        <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
                            <path d="M8 6L16 2L24 6V18L16 22L8 18V6Z" fill="white" fillOpacity="0.9" />
                            <path d="M16 2L24 6V18L16 22V10L8 6L16 2Z" fill="white" fillOpacity="0.7" />
                            <path d="M12 12L16 10L20 12V18L16 20L12 18V12Z" fill="rgba(59,130,246,0.6)" />
                            <circle cx="16" cy="15" r="2.5" fill="white" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-base font-bold text-brand-text-primary">ChoTaiNguyen</div>
                        <div className="text-[10px] text-brand-text-muted">Bảng điều khiển</div>
                    </div>
                </Link>
                {onClose && (
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-surface-2 lg:hidden">
                        <X className="w-5 h-5 text-brand-text-muted" />
                    </button>
                )}
            </div>

            {/* User Info */}
            <div className="p-5 border-b border-brand-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">{user ? getInitials(user.fullName) : '?'}</span>
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-brand-text-primary">{user?.fullName || 'Khách'}</div>
                        <div className="text-xs text-brand-text-muted">@{user?.username || ''}</div>
                    </div>
                </div>
            </div>

            {/* Dashboard Nav */}
            <nav className="flex-1 p-3 overflow-y-auto">
                <div className="px-4 py-1.5 text-[10px] font-semibold text-brand-text-muted uppercase tracking-wider">
                    Tài khoản
                </div>
                <div className="space-y-0.5 mb-4">
                    {userMenuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                                    ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
                                    : 'text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>

                {/* Quick Links */}
                <div className="px-4 py-1.5 text-[10px] font-semibold text-brand-text-muted uppercase tracking-wider">
                    Truy cập nhanh
                </div>
                <div className="space-y-0.5">
                    {quickLinks.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-brand-text-muted hover:text-brand-text-primary hover:bg-brand-surface-2 transition-all"
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </Link>
                    ))}
                </div>
            </nav>

            {/* Bottom */}
            <div className="p-3 border-t border-brand-border">
                <Link href="/" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-brand-text-muted hover:text-brand-text-primary hover:bg-brand-surface-2 transition-all">
                    <ChevronLeft className="w-4 h-4" /> Về trang chủ
                </Link>
                <button onClick={onLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-brand-danger hover:bg-brand-surface-2 transition-all w-full">
                    <LogOut className="w-4 h-4" /> Đăng xuất
                </button>
            </div>
        </>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const handleLogout = () => {
        logout();
        router.push('/dang-nhap');
    };

    return (
        <div className="min-h-screen bg-brand-bg flex">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-[270px] bg-brand-surface border-r border-brand-border flex-col shrink-0 sticky top-0 h-screen">
                <SidebarContent pathname={pathname} user={user} onLogout={handleLogout} />
            </aside>

            {/* Mobile Drawer Overlay */}
            {drawerOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
                    <aside className="absolute left-0 top-0 h-full w-[280px] bg-brand-surface border-r border-brand-border flex flex-col shadow-card-hover animate-slide-up">
                        <SidebarContent pathname={pathname} user={user} onClose={() => setDrawerOpen(false)} onLogout={handleLogout} />
                    </aside>
                </div>
            )}

            {/* Main */}
            <div className="flex-1 min-w-0">
                {/* Topbar */}
                <header className="sticky top-0 z-30 bg-brand-bg/95 backdrop-blur-xl border-b border-brand-border px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setDrawerOpen(true)}
                                className="lg:hidden p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2 transition-all"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                            <h2 className="text-lg font-semibold text-brand-text-primary hidden lg:block">Tổng quan tài khoản</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link href="/dashboard/vi" className="flex items-center gap-2 bg-brand-success/10 border border-brand-success/20 rounded-xl px-3 py-1.5 text-sm hover:bg-brand-success/20 transition-all">
                                <Wallet className="w-4 h-4 text-brand-success" />
                                <span className="text-brand-success font-semibold">
                                    {(user?.walletBalance || 0).toLocaleString('vi-VN')}đ
                                </span>
                                <span className="text-[10px] bg-brand-primary text-white px-1.5 py-0.5 rounded font-medium">
                                    <PlusCircle className="w-3 h-3 inline -mt-0.5" /> Nạp
                                </span>
                            </Link>
                            <button className="relative p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2 transition-all">
                                <Bell className="w-5 h-5" />
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-brand-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">2</span>
                            </button>
                        </div>
                    </div>
                </header>

                <main className="p-6">{children}</main>
            </div>
        </div>
    );
}
