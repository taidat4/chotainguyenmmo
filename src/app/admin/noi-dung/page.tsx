'use client';

import { Plus, Edit, Trash2, Eye, FileText, Globe } from 'lucide-react';

const pages = [
    { id: 1, title: 'Điều khoản sử dụng', slug: '/chinh-sach/dieu-khoan', status: 'published', updatedAt: '2026-03-01' },
    { id: 2, title: 'Chính sách bảo mật', slug: '/chinh-sach/bao-mat', status: 'published', updatedAt: '2026-03-01' },
    { id: 3, title: 'Chính sách hoàn tiền', slug: '/chinh-sach/hoan-tien', status: 'published', updatedAt: '2026-02-28' },
    { id: 4, title: 'Hướng dẫn mua hàng', slug: '/huong-dan/mua-hang', status: 'published', updatedAt: '2026-02-25' },
    { id: 5, title: 'Hướng dẫn bán hàng', slug: '/huong-dan/ban-hang', status: 'published', updatedAt: '2026-02-25' },
    { id: 6, title: 'FAQ - Câu hỏi thường gặp', slug: '/ho-tro/faq', status: 'draft', updatedAt: '2026-03-05' },
    { id: 7, title: 'Liên hệ hỗ trợ', slug: '/ho-tro/lien-he', status: 'published', updatedAt: '2026-02-20' },
];

export default function AdminContentPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý nội dung</h1>
                    <p className="text-sm text-brand-text-muted">Tạo và chỉnh sửa các trang nội dung tĩnh: chính sách, hướng dẫn, FAQ.</p>
                </div>
                <button className="btn-primary flex items-center gap-2 !py-2 text-sm">
                    <Plus className="w-4 h-4" /> Tạo trang mới
                </button>
            </div>

            <div className="card !p-0 overflow-hidden">
                <table className="w-full text-sm">
                    <thead><tr className="bg-brand-surface-2/50">
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Trang</th>
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Đường dẫn</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Cập nhật</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                    </tr></thead>
                    <tbody>
                        {pages.map(p => (
                            <tr key={p.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30">
                                <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-brand-primary shrink-0" />
                                        <span className="text-sm font-medium text-brand-text-primary">{p.title}</span>
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-xs text-brand-text-muted font-mono">{p.slug}</td>
                                <td className="py-3 px-4 text-center">
                                    <span className={`badge text-[10px] ${p.status === 'published' ? 'badge-success' : 'badge-neutral'}`}>
                                        {p.status === 'published' ? 'Đã xuất bản' : 'Nháp'}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-right text-xs text-brand-text-muted">{p.updatedAt}</td>
                                <td className="py-3 px-4">
                                    <div className="flex items-center justify-center gap-1">
                                        <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2"><Eye className="w-3.5 h-3.5" /></button>
                                        <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-info hover:bg-brand-surface-2"><Edit className="w-3.5 h-3.5" /></button>
                                        <button className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-surface-2"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
