'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
    Search, Menu, X, Bell, Wallet, Store, User, ChevronDown,
    LogIn, UserPlus, Settings, LogOut,
    LayoutDashboard, Package, Heart, Shield, PlusCircle, Clock, CheckCircle, AlertTriangle
} from 'lucide-react';

// Mock notifications
const MOCK_NOTIFICATIONS = [
    { id: 1, type: 'order', title: 'Đơn hàng đã hoàn tất', desc: 'Đơn hàng CTN-20260301-001 đã được giao thành công.', time: '5 phút trước', read: false, icon: CheckCircle, color: 'text-brand-success' },
    { id: 2, type: 'deposit', title: 'Nạp tiền thành công', desc: 'Yêu cầu nạp 1.000.000đ đã được duyệt và cộng vào ví.', time: '1 giờ trước', read: false, icon: PlusCircle, color: 'text-brand-primary' },
    { id: 3, type: 'delivery', title: 'Giao hàng thành công', desc: 'Đơn hàng CTN-20260305-003 đã được giao tự động.', time: '3 giờ trước', read: true, icon: Package, color: 'text-brand-info' },
    { id: 4, type: 'system', title: 'Cập nhật tính năng', desc: 'Hệ thống vừa cập nhật giao diện Seller Center mới.', time: '1 ngày trước', read: true, icon: Bell, color: 'text-brand-secondary' },
    { id: 5, type: 'complaint', title: 'Khiếu nại mới', desc: 'Có 1 khiếu nại mới cần xử lý cho đơn hàng CTN-20260228-007.', time: '2 ngày trước', read: true, icon: AlertTriangle, color: 'text-brand-warning' },
];

export default function Header() {
    const { user, logout, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    // Close menus when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setNotifOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        setUserMenuOpen(false);
        router.push('/dang-nhap');
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/san-pham?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(-2).join('').toUpperCase();
    };

    const getDashboardLink = () => {
        if (!user) return '/dashboard';
        if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return '/admin';
        if (user.role === 'SELLER') return '/seller';
        return '/dashboard';
    };

    const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length;

    return (
        <header className="sticky top-0 z-50 bg-brand-bg/95 backdrop-blur-xl border-b border-brand-border">
            {/* Announcement Bar */}
            <div className="bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 border-b border-brand-border/50">
                <div className="max-w-container mx-auto px-4 py-1.5 text-center text-xs text-brand-text-secondary">
                    🚀 Hệ thống đang hoạt động ổn định — Khám phá <span className="text-brand-primary font-medium">tính năng Seller Center mới</span>
                </div>
            </div>

            {/* Main Header */}
            <div className="max-w-container mx-auto px-4 py-3">
                <div className="flex items-center gap-4">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-md">
                            <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6">
                                <path d="M8 6L16 2L24 6V18L16 22L8 18V6Z" fill="white" fillOpacity="0.9" />
                                <path d="M16 2L24 6V18L16 22V10L8 6L16 2Z" fill="white" fillOpacity="0.7" />
                                <path d="M12 12L16 10L20 12V18L16 20L12 18V12Z" fill="rgba(59,130,246,0.6)" />
                                <circle cx="16" cy="15" r="2.5" fill="white" />
                            </svg>
                        </div>
                        <div className="hidden sm:block">
                            <div className="text-lg font-bold text-brand-text-primary leading-tight">ChoTaiNguyen</div>
                            <div className="text-[10px] text-brand-text-muted leading-tight">Chợ Tài Nguyên</div>
                        </div>
                    </Link>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-auto relative">
                        <div className={`flex items-center bg-brand-surface-2 border rounded-xl transition-all duration-200 ${searchFocused ? 'border-brand-primary ring-1 ring-brand-primary/30' : 'border-brand-border'}`}>
                            <Search className="w-4 h-4 text-brand-text-muted ml-4" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm kiếm sản phẩm, gian hàng hoặc danh mục..."
                                className="flex-1 bg-transparent border-none outline-none px-3 py-2.5 text-sm text-brand-text-primary placeholder:text-brand-text-muted"
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
                            />
                            <button type="submit" className="bg-brand-primary text-white text-sm font-medium px-4 py-1.5 rounded-lg mr-1.5 hover:brightness-110 transition-all">
                                Tìm kiếm
                            </button>
                        </div>
                    </form>

                    {/* Desktop Actions */}
                    <div className="hidden lg:flex items-center gap-1">
                        <Link href="/seller" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-all">
                            <Store className="w-4 h-4" />
                            <span>Seller Center</span>
                        </Link>

                        {!isLoading && user ? (
                            <>
                                <Link href="/dashboard/vi" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-brand-success/10 border border-brand-success/20 hover:bg-brand-success/20 transition-all">
                                    <Wallet className="w-4 h-4 text-brand-success" />
                                    <span className="text-brand-success font-semibold">
                                        {(user.walletBalance || 0).toLocaleString('vi-VN')}đ
                                    </span>
                                </Link>
                                <Link href="/dashboard/nap-tien" className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 transition-all shadow-sm">
                                    <PlusCircle className="w-3.5 h-3.5" /> Nạp tiền
                                </Link>

                                {/* Notification Bell */}
                                <div className="relative" ref={notifRef}>
                                    <button
                                        onClick={() => setNotifOpen(!notifOpen)}
                                        className="relative p-2 rounded-xl text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2 transition-all"
                                    >
                                        <Bell className="w-5 h-5" />
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-brand-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                                {unreadCount}
                                            </span>
                                        )}
                                    </button>
                                    {notifOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-80 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover z-50 overflow-hidden">
                                            <div className="px-4 py-3 border-b border-brand-border flex items-center justify-between">
                                                <span className="text-sm font-semibold text-brand-text-primary">Thông báo</span>
                                                <span className="text-[11px] text-brand-primary cursor-pointer hover:underline">Đánh dấu đã đọc</span>
                                            </div>
                                            <div className="max-h-80 overflow-y-auto">
                                                {MOCK_NOTIFICATIONS.map((notif) => (
                                                    <div key={notif.id} className={`px-4 py-3 border-b border-brand-border/50 hover:bg-brand-surface-2 cursor-pointer transition-colors ${!notif.read ? 'bg-brand-primary/5' : ''}`}>
                                                        <div className="flex gap-3">
                                                            <div className={`mt-0.5 ${notif.color}`}>
                                                                <notif.icon className="w-4 h-4" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-medium text-brand-text-primary">{notif.title}</span>
                                                                    {!notif.read && <span className="w-2 h-2 bg-brand-primary rounded-full shrink-0" />}
                                                                </div>
                                                                <p className="text-xs text-brand-text-muted mt-0.5 line-clamp-2">{notif.desc}</p>
                                                                <span className="text-[10px] text-brand-text-muted mt-1 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" /> {notif.time}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <Link href="/dashboard/thong-bao" onClick={() => setNotifOpen(false)} className="block text-center py-2.5 text-sm text-brand-primary font-medium hover:bg-brand-surface-2 transition-colors">
                                                Xem tất cả thông báo
                                            </Link>
                                        </div>
                                    )}
                                </div>

                                {/* User Menu */}
                                <div className="relative" ref={menuRef}>
                                    <button
                                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-brand-surface-2 transition-all"
                                    >
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                            <span className="text-white text-xs font-medium">{getInitials(user.fullName)}</span>
                                        </div>
                                        <span className="text-sm font-medium text-brand-text-primary max-w-[100px] truncate">{user.username}</span>
                                        <ChevronDown className={`w-3 h-3 text-brand-text-muted transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {userMenuOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-64 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover py-2 z-50">
                                            {/* User info */}
                                            <div className="px-4 py-3 border-b border-brand-border">
                                                <div className="text-sm font-semibold text-brand-text-primary">{user.fullName}</div>
                                                <div className="text-xs text-brand-text-muted">@{user.username}</div>
                                                {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                                                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-brand-danger/10 text-brand-danger px-2 py-0.5 rounded-full font-medium">
                                                        <Shield className="w-3 h-3" /> Admin
                                                    </span>
                                                )}
                                                {user.role === 'SELLER' && (
                                                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-medium">
                                                        <Store className="w-3 h-3" /> Seller
                                                    </span>
                                                )}
                                            </div>
                                            <Link href={getDashboardLink()} onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2">
                                                <LayoutDashboard className="w-4 h-4" /> Bảng điều khiển
                                            </Link>
                                            <Link href="/dashboard/don-hang" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2">
                                                <Package className="w-4 h-4" /> Đơn hàng
                                            </Link>
                                            <Link href="/dashboard/yeu-thich" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2">
                                                <Heart className="w-4 h-4" /> Yêu thích
                                            </Link>
                                            <Link href="/dashboard/ho-so" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2">
                                                <Settings className="w-4 h-4" /> Hồ sơ
                                            </Link>
                                            <div className="border-t border-brand-border my-1" />
                                            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2.5 text-sm text-brand-danger hover:bg-brand-surface-2 w-full">
                                                <LogOut className="w-4 h-4" /> Đăng xuất
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : !isLoading ? (
                            <div className="flex items-center gap-2">
                                <Link href="/dang-nhap" className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-1.5">
                                    <LogIn className="w-4 h-4" /> Đăng nhập
                                </Link>
                                <Link href="/dang-ky" className="btn-primary !px-4 !py-2 text-sm flex items-center gap-1.5">
                                    <UserPlus className="w-4 h-4" /> Đăng ký
                                </Link>
                            </div>
                        ) : null}
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="lg:hidden p-2 rounded-xl text-brand-text-secondary hover:bg-brand-surface-2 transition-all"
                    >
                        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* Category Navigation */}
                <nav className="hidden lg:flex items-center gap-1 mt-2 -mx-2">
                    {[
                        { label: 'Trang chủ', href: '/' },
                        { label: 'Danh mục', href: '/danh-muc' },
                        { label: 'Sản phẩm nổi bật', href: '/san-pham-noi-bat' },
                        { label: 'Gian hàng', href: '/gian-hang' },
                        { label: 'Hướng dẫn', href: '/huong-dan' },
                        { label: 'Hỗ trợ', href: '/ho-tro' },
                    ].map((item, i) => {
                        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                        return (
                            <Link key={i} href={item.href} className={`px-3 py-1.5 text-sm rounded-lg transition-all ${isActive ? 'text-brand-primary font-semibold bg-brand-primary/10' : 'text-brand-text-secondary hover:text-brand-text-primary hover:bg-brand-surface-2'}`}>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="lg:hidden bg-brand-surface border-t border-brand-border">
                    <div className="px-4 py-3 space-y-1">
                        {[
                            { label: 'Trang chủ', href: '/' },
                            { label: 'Danh mục', href: '/danh-muc' },
                            { label: 'Sản phẩm nổi bật', href: '/san-pham-noi-bat' },
                            { label: 'Gian hàng', href: '/gian-hang' },
                            { label: 'Hướng dẫn', href: '/huong-dan' },
                            { label: 'Hỗ trợ', href: '/ho-tro' },
                        ].map((item, i) => (
                            <Link
                                key={i}
                                href={item.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className="block py-2 text-brand-text-secondary hover:text-brand-text-primary"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </header>
    );
}
