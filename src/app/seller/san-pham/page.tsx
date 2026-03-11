'use client';

import { useState } from 'react';
import { products, categories } from '@/lib/mock-data';
import { formatCurrency } from '@/lib/utils';
import { Plus, Search, Edit, Trash2, Eye, Package, X, Save, Loader2, CheckCircle2 } from 'lucide-react';

type ModalType = 'view' | 'edit' | 'add' | null;

export default function SellerProductsPage() {
    const [sellerProducts, setSellerProducts] = useState(products.slice(0, 10));
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [modal, setModal] = useState<ModalType>(null);
    const [selectedProduct, setSelectedProduct] = useState<typeof products[0] | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [toast, setToast] = useState('');
    const [formData, setFormData] = useState<{ name: string; price: string; categoryName: string; shortDescription: string; deliveryType: 'auto' | 'manual' }>({ name: '', price: '', categoryName: '', shortDescription: '', deliveryType: 'auto' });

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const filtered = sellerProducts.filter(p => {
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'all' || (statusFilter === 'active' && p.stockCount > 0) || (statusFilter === 'out' && p.stockCount === 0);
        return matchSearch && matchStatus;
    });

    const stats = {
        total: sellerProducts.length,
        active: sellerProducts.filter(p => p.stockCount > 0).length,
        out: sellerProducts.filter(p => p.stockCount === 0).length,
        pending: 2,
    };

    const openAdd = () => {
        setFormData({ name: '', price: '', categoryName: '', shortDescription: '', deliveryType: 'auto' });
        setSelectedProduct(null);
        setModal('add');
    };

    const openEdit = (p: typeof products[0]) => {
        setFormData({ name: p.name, price: String(p.price), categoryName: p.categoryName, shortDescription: p.shortDescription, deliveryType: p.deliveryType });
        setSelectedProduct(p);
        setModal('edit');
    };

    const openView = (p: typeof products[0]) => { setSelectedProduct(p); setModal('view'); };

    const handleSave = () => {
        if (!formData.name || !formData.price || !formData.categoryName) { showToast('⚠️ Vui lòng điền đầy đủ: tên, giá, danh mục'); return; }
        if (modal === 'edit' && selectedProduct) {
            setSellerProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, name: formData.name, price: Number(formData.price), categoryName: formData.categoryName, shortDescription: formData.shortDescription, deliveryType: formData.deliveryType } : p));
            showToast('✅ Đã cập nhật sản phẩm');
        } else {
            const newProd = { ...products[0], id: `prod_new_${Date.now()}`, name: formData.name, price: Number(formData.price), categoryName: formData.categoryName, shortDescription: formData.shortDescription, deliveryType: formData.deliveryType, slug: formData.name.toLowerCase().replace(/\s+/g, '-'), stockCount: 0, soldCount: 0 };
            setSellerProducts(prev => [newProd, ...prev]);
            showToast('✅ Đã thêm sản phẩm mới');
        }
        setModal(null);
    };

    const handleDelete = () => {
        if (!deleteTarget) return;
        setSellerProducts(prev => prev.filter(p => p.id !== deleteTarget));
        setDeleteTarget(null);
        showToast('🗑️ Đã xóa sản phẩm');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý sản phẩm</h1>
                    <p className="text-sm text-brand-text-muted">Tạo mới, chỉnh sửa và quản lý các sản phẩm đang bán trên shop.</p>
                </div>
                <button onClick={openAdd} className="btn-primary flex items-center gap-2 !py-2 text-sm">
                    <Plus className="w-4 h-4" /> Thêm sản phẩm
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng sản phẩm', value: stats.total, color: 'text-brand-text-primary' },
                    { label: 'Đang bán', value: stats.active, color: 'text-brand-success' },
                    { label: 'Hết hàng', value: stats.out, color: 'text-brand-danger' },
                    { label: 'Đang duyệt', value: stats.pending, color: 'text-brand-warning' },
                ].map((s, i) => (
                    <div key={i} className="card !p-4">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-brand-text-muted mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="card !p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên sản phẩm..." className="input-field !py-2 !pl-10 text-sm" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field !py-2 text-sm min-w-[140px]">
                    <option value="all">Tất cả trạng thái</option>
                    <option value="active">Đang bán</option>
                    <option value="out">Hết hàng</option>
                </select>
            </div>

            <div className="card !p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-brand-surface-2/50">
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Sản phẩm</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Giá</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Tồn kho</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Đã bán</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => (
                                <tr key={p.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
                                                <Package className="w-5 h-5 text-brand-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-brand-text-primary truncate max-w-[250px]">{p.name}</div>
                                                <div className="text-xs text-brand-text-muted">{p.categoryName}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-center font-semibold text-brand-text-primary">{formatCurrency(p.price)}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={p.stockCount > 0 ? 'text-brand-success' : 'text-brand-danger'}>{p.stockCount}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center text-brand-text-secondary">{p.soldCount}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`badge text-[10px] ${p.stockCount > 0 ? 'badge-success' : 'badge-danger'}`}>
                                            {p.stockCount > 0 ? 'Đang bán' : 'Hết hàng'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => openView(p)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2 transition-all" title="Xem">
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-info hover:bg-brand-surface-2 transition-all" title="Sửa">
                                                <Edit className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => setDeleteTarget(p.id)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-surface-2 transition-all" title="Xóa">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View/Edit/Add Modal */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModal(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-lg w-full p-6 animate-slide-up max-h-[85vh] overflow-y-auto">
                        <button onClick={() => setModal(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5 text-brand-text-muted" /></button>
                        <h2 className="text-lg font-bold text-brand-text-primary mb-4">
                            {modal === 'view' ? '📦 Chi tiết sản phẩm' : modal === 'edit' ? '✏️ Sửa sản phẩm' : '➕ Thêm sản phẩm mới'}
                        </h2>

                        {modal === 'view' && selectedProduct ? (
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Tên</span><span className="text-brand-text-primary font-medium">{selectedProduct.name}</span></div>
                                <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Giá</span><span className="text-brand-primary font-bold">{formatCurrency(selectedProduct.price)}</span></div>
                                <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Danh mục</span><span className="text-brand-text-secondary">{selectedProduct.categoryName}</span></div>
                                <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Tồn kho</span><span className="text-brand-success">{selectedProduct.stockCount}</span></div>
                                <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Đã bán</span><span>{selectedProduct.soldCount}</span></div>
                                <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Giao hàng</span><span>{selectedProduct.deliveryType === 'auto' ? '⚡ Tự động' : '📦 Thủ công'}</span></div>
                                <div className="border-t border-brand-border pt-3"><div className="text-xs text-brand-text-muted mb-1">Mô tả</div><p className="text-sm text-brand-text-secondary">{selectedProduct.shortDescription}</p></div>
                                <button onClick={() => setModal(null)} className="btn-primary w-full !py-3 mt-2">Đóng</button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-brand-text-primary mb-1.5">Tên sản phẩm *</label>
                                    <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input-field" placeholder="VD: ChatGPT Plus - 1 tháng" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-brand-text-primary mb-1.5">Giá (VNĐ) *</label>
                                        <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="input-field" placeholder="350000" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-brand-text-primary mb-1.5">Danh mục *</label>
                                        <select value={formData.categoryName} onChange={e => setFormData({ ...formData, categoryName: e.target.value })} className="input-field" required>
                                            <option value="">— Chọn danh mục —</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-text-primary mb-1.5">Giao hàng</label>
                                    <select value={formData.deliveryType} onChange={e => setFormData({ ...formData, deliveryType: e.target.value as 'auto' | 'manual' })} className="input-field">
                                        <option value="auto">Tự động</option>
                                        <option value="manual">Thủ công</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-text-primary mb-1.5">Mô tả ngắn</label>
                                    <textarea rows={3} value={formData.shortDescription} onChange={e => setFormData({ ...formData, shortDescription: e.target.value })} className="input-field resize-none" placeholder="Mô tả ngắn về sản phẩm..." />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setModal(null)} className="btn-secondary flex-1 !py-3">Hủy</button>
                                    <button onClick={handleSave} className="btn-primary flex-1 !py-3 flex items-center justify-center gap-2">
                                        <Save className="w-4 h-4" /> {modal === 'edit' ? 'Cập nhật' : 'Thêm sản phẩm'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-sm w-full p-6 animate-slide-up text-center">
                        <Trash2 className="w-12 h-12 text-brand-danger mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-brand-text-primary mb-2">Xác nhận xóa?</h3>
                        <p className="text-sm text-brand-text-muted mb-5">Sản phẩm sẽ bị xóa vĩnh viễn và không thể khôi phục.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 !py-3">Hủy</button>
                            <button onClick={handleDelete} className="flex-1 !py-3 bg-brand-danger text-white rounded-xl font-medium hover:bg-brand-danger/90 transition-all">Xóa</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 flex items-center gap-2 animate-slide-up">
                    <CheckCircle2 className="w-5 h-5 text-brand-success" />
                    <span className="text-sm text-brand-text-primary font-medium">{toast}</span>
                </div>
            )}
        </div>
    );
}
