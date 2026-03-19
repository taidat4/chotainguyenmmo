import Link from 'next/link';
import { Facebook, MessageCircle, Youtube, Send } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="bg-brand-surface border-t border-brand-border mt-auto">
            <div className="max-w-container mx-auto px-4 py-12 md:py-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
                    {/* Brand */}
                    <div className="sm:col-span-2 lg:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <img src="/logokhongnen.png" alt="ChoTaiNguyen" style={{ height: '60px', width: 'auto' }} />
                        </div>
                        <p className="text-sm text-brand-text-secondary leading-relaxed mb-4">
                            Nền tảng giao dịch tài nguyên số với trải nghiệm nhanh, rõ ràng và thuận tiện cho cả người mua lẫn người bán.
                        </p>
                        <div className="flex items-center gap-3">
                            {[Facebook, MessageCircle, Youtube, Send].map((Icon, i) => (
                                <a key={i} href="#" className="w-9 h-9 rounded-xl bg-brand-surface-2 border border-brand-border flex items-center justify-center text-brand-text-muted hover:text-brand-primary hover:border-brand-primary/30 transition-all">
                                    <Icon className="w-4 h-4" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Links */}
                    <div>
                        <h3 className="text-sm font-semibold text-brand-text-primary mb-4">Liên kết</h3>
                        <ul className="space-y-2.5">
                            {[
                                { label: 'Trang chủ', href: '/' },
                                { label: 'Danh mục', href: '/danh-muc' },
                                { label: 'Gian hàng', href: '/gian-hang' },
                                { label: 'Hướng dẫn', href: '/huong-dan' },
                                { label: 'Hỗ trợ', href: '/ho-tro' },
                            ].map((link, i) => (
                                <li key={i}>
                                    <Link href={link.href} className="text-sm text-brand-text-secondary hover:text-brand-primary transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Policies */}
                    <div>
                        <h3 className="text-sm font-semibold text-brand-text-primary mb-4">Chính sách</h3>
                        <ul className="space-y-2.5">
                            {[
                                'Điều khoản sử dụng',
                                'Chính sách giao dịch',
                                'Chính sách khiếu nại',
                                'Chính sách hoàn tiền',
                                'Chính sách bảo mật',
                            ].map((policy, i) => (
                                <li key={i}>
                                    <Link href="/chinh-sach" className="text-sm text-brand-text-secondary hover:text-brand-primary transition-colors">
                                        {policy}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Seller */}
                    <div>
                        <h3 className="text-sm font-semibold text-brand-text-primary mb-4">Dành cho người bán</h3>
                        <ul className="space-y-2.5">
                            {[
                                { label: 'Đăng ký bán hàng', href: '/dang-ky-ban-hang' },
                                { label: 'Trung tâm người bán', href: '/seller' },
                                { label: 'Quy định đăng sản phẩm', href: '/chinh-sach' },
                                { label: 'Hướng dẫn quản lý tồn kho', href: '/huong-dan' },
                                { label: 'Hướng dẫn rút tiền', href: '/huong-dan' },
                            ].map((link, i) => (
                                <li key={i}>
                                    <Link href={link.href} className="text-sm text-brand-text-secondary hover:text-brand-primary transition-colors">
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom */}
            <div className="border-t border-brand-border">
                <div className="max-w-container mx-auto px-4 py-4 text-center text-xs text-brand-text-muted">
                    © 2026 ChoTaiNguyen. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
