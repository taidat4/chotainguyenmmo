'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Search, Eye, Package, X, Star, Store, ShoppingCart, AlertTriangle, ShieldOff, ShieldCheck, Loader2 } from 'lucide-react';

interface Product {
    id: string;
    name: string;
    slug: string;
    description: string;
    price: number;
    compareAtPrice: number | null;
    shopName: string;
    shopId: string;
    categoryName: string;
    ratingAverage: number;
    soldCount: number;
    stockCount: number;
    status: string;
    images: string[];
}

export default function AdminProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [selected, setSelected] = useState<Product | null>(null);
    const [banModal, setBanModal] = useState<Product | null>(null);
    const [banReason, setBanReason] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    useEffect(() => { fetchProducts(); }, []);

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/v1/products');
            const data = await res.json();
            if (data.success) {
                setProducts(data.data || []);
            }
        } catch (e) {
            console.error('[Admin Products] Fetch error:', e);
        }
        setLoading(false);
    };

    const filtered = products.filter(p => {
        const matchSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.shopName?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'all' || p.status?.toLowerCase() === statusFilter;
        return matchSearch && matchStatus;
    });

    const handleBan = async (id: string) => {
        try {
            const token = localStorage.getItem('token') || '';
            await fetch(`/api/v1/products/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: 'BANNED', banReason }),
            });
            setProducts(prev => prev.map(p => p.id === id ? { ...p, status: 'BANNED' } : p));
            setBanModal(null);
            setBanReason('');
            showToast('🚫 Sản phẩm đã bị cấm bán');
        } catch {
            showToast('❌ Lỗi cập nhật');
        }
    };

    const handleUnban = async (id: string) => {
        try {
            const token = localStorage.getItem('token') || '';
            await fetch(`/api/v1/products/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: 'ACTIVE' }),
            });
            setProducts(prev => prev.map(p => p.id === id ? { ...p, status: 'ACTIVE' } : p));
            showToast('✅ Sản phẩm đã được mở bán lại');
        } catch {
            showToast('❌ Lỗi cập nhật');
        }
    };

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý sản phẩm</h1>
                <p className="text-sm text-brand-text-muted">Duyệt, theo dõi và quản lý toàn bộ sản phẩm trên sàn.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng sản phẩm', value: products.length, color: 'text-brand-primary' },
                    { label: 'Đang bán', value: products.filter(p => p.status?.toLowerCase() === 'active').length, color: 'text-brand-success' },
                    { label: 'Chờ duyệt', value: products.filter(p => p.status?.toLowerCase() === 'pending').length, color: 'text-brand-warning' },
                    { label: 'Vi phạm', value: products.filter(p => p.status?.toLowerCase() === 'banned').length, color: 'text-brand-danger' },
                ].map((s, i) => (
                    <div key={i} className="card !p-4">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-brand-text-muted mt-1">{s.label}</div>
                    </div>
                ))}
            </div>
            <div className="card !p-4 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm sản phẩm..." className="input-field !py-2 !pl-10 text-sm w-full" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field !py-2 text-sm min-w-[130px]">
                    <option value="all">Tất cả trạng thái</option>
                    <option value="active">Đang bán</option>
                    <option value="pending">Chờ duyệt</option>
                    <option value="banned">Vi phạm</option>
                </select>
            </div>
            <div className="card !p-0 overflow-hidden">
                <table className="w-full text-sm">
                    <thead><tr className="bg-brand-surface-2/50">
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Sản phẩm</th>
                        <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Shop</th>
                        <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Giá</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Đã bán</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                        <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                    </tr></thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-12 text-brand-text-muted text-sm">Chưa có sản phẩm nào</td></tr>
                        ) : filtered.map(p => (
                            <tr key={p.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30">
                                <td className="py-3 px-4"><div className="flex items-center gap-2"><Package className="w-4 h-4 text-brand-primary shrink-0" /><span className="text-sm text-brand-text-primary truncate max-w-[200px]">{p.name}</span></div></td>
                                <td className="py-3 px-4 text-xs text-brand-text-secondary">{p.shopName}</td>
                                <td className="py-3 px-4 text-right font-medium text-brand-text-primary">{formatCurrency(p.price)}</td>
                                <td className="py-3 px-4 text-center text-brand-text-secondary">{p.soldCount}</td>
                                <td className="py-3 px-4 text-center">
                                    <span className={`badge text-[10px] ${p.status?.toLowerCase() === 'active' ? 'badge-success' : p.status?.toLowerCase() === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                                        {p.status?.toLowerCase() === 'active' ? 'Đang bán' : p.status?.toLowerCase() === 'pending' ? 'Chờ duyệt' : 'Vi phạm'}
                                    </span>
                                </td>
                                <td className="py-3 px-4"><div className="flex items-center justify-center gap-1">
                                    <button onClick={() => setSelected(p)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                                    {p.status?.toLowerCase() === 'active' ? (
                                        <button onClick={() => { setBanModal(p); setBanReason(''); }} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-surface-2 transition-colors" title="Cấm bán"><ShieldOff className="w-3.5 h-3.5" /></button>
                                    ) : p.status?.toLowerCase() === 'banned' && (
                                        <button onClick={() => handleUnban(p.id)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-success hover:bg-brand-surface-2 transition-colors" title="Mở bán lại"><ShieldCheck className="w-3.5 h-3.5" /></button>
                                    )}
                                </div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Product Detail Modal */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-lg w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-brand-text-primary">Chi tiết sản phẩm</h3>
                            <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-brand-surface-2 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0"><Package className="w-6 h-6 text-brand-primary" /></div>
                                    <div>
                                        <h4 className="text-sm font-bold text-brand-text-primary">{selected.name}</h4>
                                        <p className="text-xs text-brand-text-muted mt-1">{selected.description?.substring(0, 120)}...</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-brand-surface-2 rounded-xl p-3 text-center">
                                    <div className="text-sm font-bold text-brand-success">{formatCurrency(selected.price)}</div>
                                    <div className="text-[10px] text-brand-text-muted mt-0.5">Giá bán</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3 text-center">
                                    <div className="text-sm font-bold text-brand-primary">{selected.soldCount}</div>
                                    <div className="text-[10px] text-brand-text-muted mt-0.5">Đã bán</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3 text-center">
                                    <div className="text-sm font-bold text-brand-warning flex items-center justify-center gap-1"><Star className="w-3 h-3 fill-brand-warning" />{selected.ratingAverage || 0}</div>
                                    <div className="text-[10px] text-brand-text-muted mt-0.5">Đánh giá</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-brand-text-muted">
                                <Store className="w-3.5 h-3.5" /> Shop: <span className="text-brand-text-primary font-medium">{selected.shopName}</span>
                                <span className="mx-1">·</span>
                                <ShoppingCart className="w-3.5 h-3.5" /> Tồn kho: <span className="text-brand-text-primary font-medium">{selected.stockCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Ban Product Modal */}
            {banModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-sm w-full p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-5 h-5 text-brand-danger" />
                            <h3 className="text-sm font-semibold text-brand-text-primary">Cấm bán sản phẩm</h3>
                        </div>
                        <p className="text-xs text-brand-text-muted mb-3">Sản phẩm <strong>{banModal.name}</strong> sẽ bị ẩn khỏi sàn.</p>
                        <textarea value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Lý do vi phạm (tùy chọn)..." className="input-field w-full h-20 resize-none text-sm" />
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setBanModal(null)} className="btn-secondary flex-1 text-sm">Hủy</button>
                            <button onClick={() => handleBan(banModal.id)} className="btn-primary flex-1 text-sm !bg-brand-danger">Xác nhận cấm</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 animate-slide-up"><span className="text-sm text-brand-text-primary font-medium">{toast}</span></div>}
        </div>
    );
}
