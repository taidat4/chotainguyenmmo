'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
    LayoutDashboard, Users, Store, Package, FolderTree, ShoppingBag,
    AlertTriangle, Wallet, ArrowDownCircle, ArrowUpCircle, Image,
    FileText, Settings, ClipboardList, LogOut, ChevronLeft, Bell, Shield, Menu, X, CreditCard, Palette, Lock, KeyRound, Eye, EyeOff
} from 'lucide-react';

// ==================== ADMIN KEY ====================
// Đổi key này để bảo mật admin panel
const ADMIN_SECRET_KEY = 'CTN_ADMIN_2026_xK9mP4qR7sT2vW5yBn8jLc3';
// ===================================================

const adminMenuItems = [
    {
        group: 'Tổng quan', items: [
            { icon: LayoutDashboard, label: 'Tổng quan', href: '/admin' },
        ]
    },
    {
        group: 'Quản lý', items: [
            { icon: Users, label: 'Người dùng', href: '/admin/nguoi-dung' },
            { icon: Store, label: 'Người bán', href: '/admin/nguoi-ban' },
            { icon: Package, label: 'Sản phẩm', href: '/admin/san-pham' },
            { icon: FolderTree, label: 'Danh mục', href: '/admin/danh-muc' },
            { icon: ShoppingBag, label: 'Đơn hàng', href: '/admin/don-hang' },
            { icon: AlertTriangle, label: 'Khiếu nại', href: '/admin/khieu-nai' },
        ]
    },
    {
        group: 'Tài chính', items: [
            { icon: Wallet, label: 'Giao dịch', href: '/admin/giao-dich' },
            { icon: ArrowDownCircle, label: 'Nạp tiền', href: '/admin/nap-tien' },
            { icon: ArrowUpCircle, label: 'Rút tiền', href: '/admin/rut-tien' },
            { icon: CreditCard, label: 'Cổng nạp', href: '/admin/cong-nap' },
        ]
    },
    {
        group: 'Hệ thống', items: [
            { icon: Image, label: 'Banner', href: '/admin/banner' },
            { icon: FileText, label: 'Nội dung', href: '/admin/noi-dung' },
            { icon: Palette, label: 'Giao diện', href: '/admin/giao-dien' },
            { icon: Settings, label: 'Cài đặt', href: '/admin/cai-dat' },
            { icon: ClipboardList, label: 'Nhật ký', href: '/admin/nhat-ky' },
        ]
    },
];

function SidebarContent({ pathname, user, onClose, onLogout }: { pathname: string; user: { fullName: string } | null; onClose?: () => void; onLogout: () => void }) {
    return (
        <>
            <div className="p-5 border-b border-brand-border flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-danger to-brand-warning flex items-center justify-center">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <div className="text-base font-bold text-brand-text-primary">Admin Panel</div>
                        <div className="text-[10px] text-brand-text-muted">ChoTaiNguyen</div>
                    </div>
                </Link>
                {onClose && (
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-surface-2 lg:hidden">
                        <X className="w-5 h-5 text-brand-text-muted" />
                    </button>
                )}
            </div>

            <nav className="flex-1 p-3 overflow-y-auto">
                {adminMenuItems.map((group, gi) => (
                    <div key={gi} className="mb-4">
                        <div className="px-4 py-1.5 text-[10px] font-semibold text-brand-text-muted uppercase tracking-wider">
                            {group.group}
                        </div>
                        <div className="space-y-0.5">
                            {group.items.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link key={item.href} href={item.href} onClick={onClose}
                                        className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-brand-primary/10 text-brand-primary' : 'text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2'
                                            }`}>
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="p-3 border-t border-brand-border">
                <Link href="/" className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-brand-text-muted hover:text-brand-text-primary hover:bg-brand-surface-2 transition-all">
                    <ChevronLeft className="w-4 h-4" /> Về trang chủ
                </Link>
                <button onClick={onLogout} className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-brand-danger hover:bg-brand-surface-2 transition-all w-full">
                    <LogOut className="w-4 h-4" /> Đăng xuất
                </button>
            </div>
        </>
    );
}

// ==================== ADMIN KEY GATE ====================
function AdminKeyGate({ onUnlock }: { onUnlock: () => void }) {
    const [key, setKey] = useState('');
    const [error, setError] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [locked, setLocked] = useState(false);
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (locked) return;

        if (key === ADMIN_SECRET_KEY) {
            sessionStorage.setItem('admin_verified', 'true');
            onUnlock();
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            setError(`Sai Admin Key! (${newAttempts}/5)`);
            setKey('');

            if (newAttempts >= 5) {
                setLocked(true);
                setError('🔒 Đã khóa — quá nhiều lần thử sai. Vui lòng chờ 60 giây.');
                setTimeout(() => {
                    setLocked(false);
                    setAttempts(0);
                    setError('');
                }, 60000);
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-brand-bg p-6">
            <div className="max-w-sm w-full">
                {/* Lock icon animation */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-danger/20 to-brand-warning/20 border-2 border-brand-danger/30 flex items-center justify-center mx-auto mb-5 shadow-lg">
                        <Lock className="w-10 h-10 text-brand-danger" />
                    </div>
                    <h1 className="text-2xl font-bold text-brand-text-primary">Admin Panel</h1>
                    <p className="text-sm text-brand-text-muted mt-1.5">Nhập Admin Key để truy cập bảng điều khiển</p>
                </div>

                {/* Key input form */}
                <form onSubmit={handleSubmit} className="card space-y-5">
                    <div>
                        <label className="text-xs font-semibold text-brand-text-secondary mb-2 block flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5" /> Admin Secret Key
                        </label>
                        <div className="relative">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={key}
                                onChange={e => { setKey(e.target.value); setError(''); }}
                                placeholder="Nhập admin key..."
                                className="input-field w-full !pr-12 font-mono tracking-wider"
                                autoFocus
                                disabled={locked}
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text-primary transition-colors"
                            >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="text-xs text-brand-danger font-medium bg-brand-danger/10 rounded-xl px-4 py-2.5 flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!key || locked}
                        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Shield className="w-4 h-4" /> Xác thực
                    </button>
                </form>

                {/* Back link */}
                <div className="text-center mt-5">
                    <button
                        onClick={() => router.push('/')}
                        className="text-sm text-brand-text-muted hover:text-brand-primary transition-colors inline-flex items-center gap-1.5"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" /> Quay về trang chủ
                    </button>
                </div>

                {/* Security badge */}
                <div className="text-center mt-8">
                    <div className="inline-flex items-center gap-1.5 text-[10px] text-brand-text-muted bg-brand-surface-2 rounded-full px-3 py-1">
                        <Lock className="w-3 h-3" />
                        Bảo mật bằng Admin Secret Key · Phiên đăng nhập
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [adminVerified, setAdminVerified] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);

    // Check if admin key was already verified this session
    useEffect(() => {
        const verified = sessionStorage.getItem('admin_verified') === 'true';
        setAdminVerified(verified);
        setCheckingSession(false);
    }, []);

    const handleLogout = () => {
        sessionStorage.removeItem('admin_verified');
        logout();
        router.push('/dang-nhap');
    };

    // Loading
    if (checkingSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg">
                <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    // Admin key gate
    if (!adminVerified) {
        return <AdminKeyGate onUnlock={() => setAdminVerified(true)} />;
    }

    return (
        <div className="min-h-screen bg-brand-bg flex">
            <aside className="hidden lg:flex w-[270px] bg-brand-surface border-r border-brand-border flex-col shrink-0 sticky top-0 h-screen">
                <SidebarContent pathname={pathname} user={user} onLogout={handleLogout} />
            </aside>

            {drawerOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
                    <aside className="absolute left-0 top-0 h-full w-[280px] bg-brand-surface border-r border-brand-border flex flex-col shadow-card-hover">
                        <SidebarContent pathname={pathname} user={user} onClose={() => setDrawerOpen(false)} onLogout={handleLogout} />
                    </aside>
                </div>
            )}

            <div className="flex-1 min-w-0">
                <header className="sticky top-0 z-30 bg-brand-bg/95 backdrop-blur-xl border-b border-brand-border px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setDrawerOpen(true)} className="lg:hidden p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2 transition-all">
                                <Menu className="w-5 h-5" />
                            </button>
                            <h2 className="text-lg font-semibold text-brand-text-primary hidden lg:block">Quản trị hệ thống</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="badge-danger">Admin</span>
                            <span className="text-sm text-brand-text-secondary font-medium">{user?.fullName || 'Admin'}</span>
                            <button className="relative p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2">
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-1 right-1 w-2 h-2 bg-brand-danger rounded-full" />
                            </button>
                        </div>
                    </div>
                </header>
                <main className="p-6">{children}</main>
            </div>
        </div>
    );
}
