'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
    LayoutDashboard, Package, Database, ShoppingBag, AlertTriangle,
    TrendingUp, Wallet, Settings, LogOut, ChevronLeft, Bell, Store, Menu, X, FileSpreadsheet, Clock
} from 'lucide-react';

const sellerMenuItems = [
    { icon: LayoutDashboard, label: 'Tổng quan', href: '/seller' },
    { icon: Package, label: 'Sản phẩm', href: '/seller/san-pham' },
    { icon: Database, label: 'Tồn kho', href: '/seller/ton-kho' },
    { icon: FileSpreadsheet, label: 'Google Sheets', href: '/seller/google-sheets' },
    { icon: ShoppingBag, label: 'Đơn hàng', href: '/seller/don-hang' },
    { icon: AlertTriangle, label: 'Khiếu nại', href: '/seller/khieu-nai' },
    { icon: TrendingUp, label: 'Doanh thu', href: '/seller/doanh-thu' },
    { icon: Wallet, label: 'Rút tiền', href: '/seller/rut-tien' },
    { icon: Settings, label: 'Cài đặt shop', href: '/seller/cai-dat' },
];

function SidebarContent({ pathname, user, onClose, onLogout }: { pathname: string; user: { fullName: string; username: string } | null; onClose?: () => void; onLogout: () => void }) {
    return (
        <>
            <div className="p-5 border-b border-brand-border flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                        <span className="text-white font-bold text-sm">CT</span>
                    </div>
                    <div>
                        <div className="text-base font-bold text-brand-text-primary">Seller Center</div>
                        <div className="text-[10px] text-brand-text-muted">ChoTaiNguyen</div>
                    </div>
                </Link>
                {onClose && (
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-surface-2 lg:hidden">
                        <X className="w-5 h-5 text-brand-text-muted" />
                    </button>
                )}
            </div>
            <div className="p-5 border-b border-brand-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center border border-brand-border">
                        <Store className="w-5 h-5 text-brand-primary" />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-brand-text-primary">{user?.fullName || 'Shop'}</div>
                        <div className="text-xs text-brand-success flex items-center gap-1">● Đang hoạt động</div>
                    </div>
                </div>
            </div>
            <nav className="flex-1 p-3 overflow-y-auto">
                <div className="space-y-1">
                    {sellerMenuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link key={item.href} href={item.href} onClick={onClose}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2'
                                    }`}>
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </nav>
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

export default function SellerLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout, isLoading } = useAuth();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [sellerStatus, setSellerStatus] = useState<'loading' | 'active' | 'pending' | 'none' | 'kyc_required'>('loading');

    const handleLogout = () => { logout(); router.push('/dang-nhap'); };

    // Server-side verification of seller status
    useEffect(() => {
        if (!user || isLoading) return;

        // Admins/Super Admins can always access seller center
        if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
            setSellerStatus('active');
            return;
        }

        // Verify seller status with the server
        fetch(`/api/v1/seller/register?userId=${user.id}`)
            .then(res => res.json())
            .then(data => {
                if (data.isActiveSeller) {
                    setSellerStatus('active');
                } else if (data.data?.status === 'PENDING') {
                    setSellerStatus('pending');
                } else if (data.data?.status === 'KYC_REQUIRED') {
                    setSellerStatus('kyc_required');
                } else {
                    setSellerStatus('none');
                }
            })
            .catch(() => {
                // On error, fall back to role check
                setSellerStatus(user.role === 'SELLER' ? 'active' : 'none');
            });
    }, [user, isLoading]);

    // Loading state
    if (isLoading || sellerStatus === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg">
                <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    // Not logged in
    if (!user) {
        router.push('/dang-nhap');
        return null;
    }

    // Pending approval
    if (sellerStatus === 'pending') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg p-6">
                <div className="max-w-md w-full card text-center space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-brand-warning/10 flex items-center justify-center mx-auto">
                        <Clock className="w-8 h-8 text-brand-warning" />
                    </div>
                    <h1 className="text-xl font-bold text-brand-text-primary">Đang chờ duyệt</h1>
                    <p className="text-sm text-brand-text-muted">
                        Đơn đăng ký gian hàng của bạn đang được admin xem xét. Bạn sẽ được thông báo khi có kết quả (thường 1-3 ngày).
                    </p>
                    <div className="space-y-3">
                        <Link href="/dang-ky-ban-hang" className="btn-primary w-full flex items-center justify-center gap-2">
                            <Store className="w-4 h-4" /> Xem trạng thái đơn
                        </Link>
                        <Link href="/" className="btn-secondary w-full text-sm">
                            Quay về trang chủ
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // KYC required
    if (sellerStatus === 'kyc_required') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg p-6">
                <div className="max-w-md w-full card text-center space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-brand-warning/10 flex items-center justify-center mx-auto">
                        <Store className="w-8 h-8 text-brand-warning" />
                    </div>
                    <h1 className="text-xl font-bold text-brand-text-primary">Cần bổ sung KYC</h1>
                    <p className="text-sm text-brand-text-muted">
                        Admin đã bật yêu cầu xác minh KYC. Vui lòng bổ sung giấy tờ để tiếp tục sử dụng gian hàng.
                    </p>
                    <div className="space-y-3">
                        <Link href="/dang-ky-ban-hang" className="btn-primary w-full flex items-center justify-center gap-2">
                            <Store className="w-4 h-4" /> Bổ sung KYC
                        </Link>
                        <Link href="/" className="btn-secondary w-full text-sm">
                            Quay về trang chủ
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Not a seller — no application exists
    if (sellerStatus === 'none') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-bg p-6">
                <div className="max-w-md w-full card text-center space-y-5">
                    <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto">
                        <Store className="w-8 h-8 text-brand-primary" />
                    </div>
                    <h1 className="text-xl font-bold text-brand-text-primary">Bạn chưa có gian hàng</h1>
                    <p className="text-sm text-brand-text-muted">
                        Tạo gian hàng chỉ trong 1 phút — nhập tên shop và tài khoản ngân hàng, chờ admin duyệt!
                    </p>
                    <div className="space-y-3">
                        <Link href="/dang-ky-ban-hang" className="btn-primary w-full flex items-center justify-center gap-2">
                            <Store className="w-4 h-4" /> Đăng ký mở shop
                        </Link>
                        <Link href="/" className="btn-secondary w-full text-sm">
                            Quay về trang chủ
                        </Link>
                    </div>
                </div>
            </div>
        );
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
                            <h2 className="text-lg font-semibold text-brand-text-primary hidden lg:block">Bảng điều khiển người bán</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="bg-brand-surface-2 border border-brand-border rounded-xl px-3 py-1.5 text-sm">
                                <span className="text-brand-text-muted">Số dư: </span>
                                <span className="text-brand-success font-semibold">{(user?.walletBalance || 0).toLocaleString('vi-VN')}đ</span>
                            </div>
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
