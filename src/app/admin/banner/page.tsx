'use client';

import { Plus, Edit, Trash2, Eye, EyeOff, Image, GripVertical } from 'lucide-react';

const banners = [
    { id: 1, title: 'Flash Sale tháng 3 — Giảm đến 50%', subtitle: 'Áp dụng cho tất cả tài khoản premium', status: 'active', position: 1, link: '/danh-muc/tai-khoan' },
    { id: 2, title: 'Seller mới — Ưu đãi đăng ký shop', subtitle: 'Miễn phí 30 ngày đầu, hỗ trợ 24/7', status: 'active', position: 2, link: '/dang-ky-ban-hang' },
    { id: 3, title: 'Chương trình giới thiệu bạn bè', subtitle: 'Nhận ngay 50,000đ cho mỗi lượt giới thiệu', status: 'active', position: 3, link: '/gioi-thieu' },
    { id: 4, title: 'Mua sắm an toàn với ChoTaiNguyen', subtitle: 'Bảo vệ giao dịch 100%', status: 'draft', position: 4, link: '/' },
];

export default function AdminBannerPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý banner</h1>
                    <p className="text-sm text-brand-text-muted">Tạo và quản lý banner quảng cáo trên trang chủ.</p>
                </div>
                <button className="btn-primary flex items-center gap-2 !py-2 text-sm">
                    <Plus className="w-4 h-4" /> Thêm banner
                </button>
            </div>

            <div className="space-y-3">
                {banners.map(b => (
                    <div key={b.id} className="card flex items-center gap-4">
                        <div className="cursor-grab text-brand-text-muted hover:text-brand-text-primary">
                            <GripVertical className="w-5 h-5" />
                        </div>
                        <div className="w-32 h-16 rounded-xl bg-gradient-to-r from-brand-primary/20 to-brand-secondary/20 border border-brand-border flex items-center justify-center shrink-0">
                            <Image className="w-6 h-6 text-brand-primary/50" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-brand-text-primary truncate">{b.title}</h3>
                            <p className="text-xs text-brand-text-muted truncate">{b.subtitle}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-brand-text-muted">Vị trí: #{b.position}</span>
                                <span className="text-[10px] text-brand-text-muted">·</span>
                                <span className="text-[10px] text-brand-primary">{b.link}</span>
                            </div>
                        </div>
                        <span className={`badge text-[10px] ${b.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                            {b.status === 'active' ? 'Hiển thị' : 'Nháp'}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                            <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-info hover:bg-brand-surface-2"><Edit className="w-3.5 h-3.5" /></button>
                            {b.status === 'active' ? (
                                <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-warning hover:bg-brand-surface-2"><EyeOff className="w-3.5 h-3.5" /></button>
                            ) : (
                                <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-success hover:bg-brand-surface-2"><Eye className="w-3.5 h-3.5" /></button>
                            )}
                            <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-surface-2"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
