'use client';

import { useState, useEffect } from 'react';
import { Search, Eye, Store, CheckCircle, Star, Ban, PlusCircle, MinusCircle, History, Lock, Unlock, X, FileText, User, XCircle, Clock, AlertTriangle, Trash2 } from 'lucide-react';

interface SellerApp {
    id: string;
    userId: string;
    username: string;
    userEmail: string;
    shopName: string;
    kycFullName?: string;
    kycCccd?: string;
    kycPhone?: string;
    kycAddress?: string;
    bankName: string;
    bankAccount: string;
    bankOwner: string;
    status: string;
    kycCompleted: boolean;
    createdAt: string;
    reviewedAt?: string;
    reviewedBy?: string;
    rejectionReason?: string;
}


type ModalType = 'kyc' | 'balance' | 'history' | 'ban' | null;

export default function AdminSellersPage() {
    const [sellers, setSellers] = useState<{ id: number; name: string; owner: string; email: string; products: number; revenue: number; balance: number; rating: number; status: string; kycStatus: string; cccd: string; phone: string; history: { type: string; amount: number; date: string; desc: string }[] }[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [modal, setModal] = useState<{ type: ModalType; sellerId: number | null }>({ type: null, sellerId: null });
    const [balanceAction, setBalanceAction] = useState<'add' | 'subtract'>('add');
    const [balanceAmount, setBalanceAmount] = useState('');
    const [toast, setToast] = useState('');
    const [activeTab, setActiveTab] = useState<'sellers' | 'applications'>('applications');

    // Seller applications from API
    const [apps, setApps] = useState<SellerApp[]>([]);
    const [appsLoading, setAppsLoading] = useState(true);
    const [rejectModal, setRejectModal] = useState<{ appId: string; reason: string } | null>(null);


    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

    useEffect(() => { loadApps(); }, []);

    const loadApps = async () => {
        setAppsLoading(true);
        try {
            const res = await fetch('/api/v1/seller/register?view=all');
            const data = await res.json();
            if (data.success) {
                setApps(data.data);
                // Build seller list from approved applications only
                const approvedApps = (data.data as SellerApp[]).filter((a: SellerApp) => a.status === 'APPROVED');
                const realSellers = approvedApps.map((a, i) => ({
                    id: i + 1,
                    name: a.shopName,
                    owner: a.kycFullName || a.username,
                    email: a.userEmail,
                    products: 0,
                    revenue: 0,
                    balance: 0,
                    rating: 0,
                    status: 'verified',
                    kycStatus: 'approved',
                    cccd: a.kycCccd || '',
                    phone: a.kycPhone || '',
                    history: [] as { type: string; amount: number; date: string; desc: string }[],
                }));
                setSellers(realSellers);
            }
        } catch { }
        setAppsLoading(false);
    };

    const reviewApp = async (appId: string, decision: 'APPROVED' | 'REJECTED', reason?: string) => {
        try {
            const res = await fetch('/api/v1/seller/register', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'review', appId, decision, reviewedBy: 'admin', reason }),
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ ${data.message}`);
                setRejectModal(null);
                loadApps();
            }
        } catch { showToast('❌ Lỗi'); }
    };

    const deleteApp = async (appId: string) => {
        if (!confirm('Bạn chắc chắn muốn xóa đơn đăng ký/gian hàng này? Hành động không thể hoàn tác!')) return;
        try {
            const res = await fetch('/api/v1/seller/register', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', appId }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('🗑️ Đã xóa thành công');
                loadApps();
            } else {
                showToast(`❌ ${data.message}`);
            }
        } catch { showToast('❌ Lỗi'); }
    };

    const pendingAppsCount = apps.filter(a => a.status === 'PENDING').length;

    const filtered = sellers.filter(s => {
        const matchSearch = !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.owner.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'all' || s.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const handleApproveKYC = (id: number) => {
        setSellers(prev => prev.map(s => s.id === id ? { ...s, status: 'verified', kycStatus: 'approved' } : s));
        setModal({ type: null, sellerId: null });
        showToast('✅ Đã duyệt KYC');
    };

    const handleRejectKYC = (id: number) => {
        setSellers(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected', kycStatus: 'rejected' } : s));
        setModal({ type: null, sellerId: null });
        showToast('❌ Đã từ chối KYC');
    };

    const handleBalanceChange = () => {
        const amount = parseInt(balanceAmount);
        if (!amount || !modal.sellerId) return;
        setSellers(prev => prev.map(s => {
            if (s.id === modal.sellerId) {
                return { ...s, balance: balanceAction === 'add' ? s.balance + amount : Math.max(0, s.balance - amount) };
            }
            return s;
        }));
        setModal({ type: null, sellerId: null });
        setBalanceAmount('');
        showToast(`✅ Đã ${balanceAction === 'add' ? 'cộng' : 'trừ'} ${amount.toLocaleString('vi-VN')}đ`);
    };

    const handleBan = (id: number, action: 'suspend' | 'ban' | 'unban') => {
        setSellers(prev => prev.map(s => s.id === id ? { ...s, status: action === 'unban' ? 'verified' : action === 'ban' ? 'banned' : 'suspended' } : s));
        setModal({ type: null, sellerId: null });
        showToast(action === 'unban' ? '✅ Đã mở khóa shop' : action === 'ban' ? '🚫 Đã ban vĩnh viễn' : '🔒 Đã tạm khóa shop');
    };

    const selectedSeller = modal.sellerId ? sellers.find(s => s.id === modal.sellerId) : null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý người bán</h1>
                <p className="text-sm text-brand-text-muted">Duyệt đơn đăng ký, quản lý shop, cộng/trừ tiền, khóa/ban sellers.</p>
            </div>

            {/* Tabs: Đơn đăng ký | Danh sách Seller */}
            <div className="flex border-b border-brand-border">
                <button onClick={() => setActiveTab('applications')}
                    className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'applications' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-brand-text-muted hover:text-brand-text-primary'}`}>
                    Đơn đăng ký
                    {pendingAppsCount > 0 && <span className="ml-2 bg-brand-danger text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{pendingAppsCount}</span>}
                </button>
                <button onClick={() => setActiveTab('sellers')}
                    className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'sellers' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-brand-text-muted hover:text-brand-text-primary'}`}>
                    Danh sách Seller ({sellers.length})
                </button>
            </div>

            {/* ==================== TAB: Đơn đăng ký ==================== */}
            {activeTab === 'applications' && (
                <div className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Tổng đơn', value: apps.length, color: 'text-brand-primary' },
                            { label: 'Chờ duyệt', value: apps.filter(a => a.status === 'PENDING').length, color: 'text-brand-warning' },
                            { label: 'Đã duyệt', value: apps.filter(a => a.status === 'APPROVED').length, color: 'text-brand-success' },
                            { label: 'Từ chối', value: apps.filter(a => a.status === 'REJECTED').length, color: 'text-brand-danger' },
                        ].map((s, i) => (
                            <div key={i} className="card !p-4">
                                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                                <div className="text-xs text-brand-text-muted mt-1">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {appsLoading ? (
                        <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full" /></div>
                    ) : apps.length === 0 ? (
                        <div className="card text-center py-12">
                            <Store className="w-10 h-10 text-brand-text-muted mx-auto mb-3" />
                            <p className="text-sm text-brand-text-muted">Chưa có đơn đăng ký nào.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {apps.map(app => (
                                <div key={app.id} className={`card !p-4 border-l-4 ${app.status === 'PENDING' ? 'border-l-brand-warning' : app.status === 'APPROVED' ? 'border-l-brand-success' : app.status === 'REJECTED' ? 'border-l-brand-danger' : 'border-l-brand-info'}`}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="text-sm font-bold text-brand-text-primary">{app.shopName}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${app.status === 'APPROVED' ? 'bg-brand-success/10 text-brand-success' :
                                                    app.status === 'PENDING' ? 'bg-brand-warning/10 text-brand-warning' :
                                                        app.status === 'REJECTED' ? 'bg-brand-danger/10 text-brand-danger' :
                                                            'bg-brand-info/10 text-brand-info'
                                                    }`}>
                                                    {app.status === 'APPROVED' ? '✅ Đã duyệt' : app.status === 'PENDING' ? '⏳ Chờ duyệt' : app.status === 'REJECTED' ? '❌ Từ chối' : '📋 Cần KYC'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-brand-text-muted space-y-0.5">
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> @{app.username}</span>
                                                    <span>📧 {app.userEmail}</span>
                                                    <span>🏦 {app.bankName} — {app.bankAccount} ({app.bankOwner})</span>
                                                </div>
                                                {app.kycFullName && (
                                                    <div className="flex items-center gap-4 flex-wrap mt-1">
                                                        <span>👤 {app.kycFullName}</span>
                                                        <span>🪪 CCCD: {app.kycCccd}</span>
                                                        <span>📱 {app.kycPhone}</span>
                                                        {app.kycAddress && <span>📍 {app.kycAddress}</span>}
                                                    </div>
                                                )}
                                                <div className="mt-1">
                                                    <span>📅 {new Date(app.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                    {app.reviewedBy && <span className="ml-3">✏️ Duyệt bởi: {app.reviewedBy} — {app.reviewedAt && new Date(app.reviewedAt).toLocaleDateString('vi-VN')}</span>}
                                                </div>
                                            </div>
                                            {app.rejectionReason && (
                                                <div className="mt-2 text-xs text-brand-danger flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> Lý do từ chối: {app.rejectionReason}
                                                </div>
                                            )}
                                        </div>
                                        {/* Delete button for all statuses */}
                                        <div className="flex gap-2 shrink-0">
                                            {app.status === 'PENDING' && (
                                                <>
                                                    <button onClick={() => reviewApp(app.id, 'APPROVED')} className="btn-primary !py-2 !px-4 text-xs flex items-center gap-1.5">
                                                        <CheckCircle className="w-3.5 h-3.5" /> Duyệt
                                                    </button>
                                                    <button onClick={() => setRejectModal({ appId: app.id, reason: '' })} className="btn-secondary !py-2 !px-4 text-xs flex items-center gap-1.5 text-brand-danger border-brand-danger/30 hover:bg-brand-danger/5">
                                                        <XCircle className="w-3.5 h-3.5" /> Từ chối
                                                    </button>
                                                </>
                                            )}
                                            <button onClick={() => deleteApp(app.id)} className="p-2 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-colors" title="Xóa vĩnh viễn">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ==================== TAB: Danh sách Seller ==================== */}
            {activeTab === 'sellers' && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {[
                            { label: 'Tổng sellers', value: sellers.length, color: 'text-brand-primary' },
                            { label: 'Đã duyệt', value: sellers.filter(s => s.status === 'verified').length, color: 'text-brand-success' },
                            { label: 'Chờ duyệt KYC', value: sellers.filter(s => s.kycStatus === 'pending').length, color: 'text-brand-warning' },
                            { label: 'Bị khóa', value: sellers.filter(s => s.status === 'banned' || s.status === 'suspended').length, color: 'text-brand-danger' },
                            { label: 'Tổng doanh thu', value: (sellers.reduce((s, sel) => s + sel.revenue, 0) / 1000000).toFixed(1) + 'M', color: 'text-brand-info' },
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
                            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm shop, chủ shop..." className="input-field !py-2 !pl-10 text-sm w-full" />
                        </div>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field !py-2 text-sm min-w-[140px]">
                            <option value="all">Tất cả</option>
                            <option value="verified">Đã duyệt</option>
                            <option value="pending">Chờ duyệt</option>
                            <option value="suspended">Tạm khóa</option>
                            <option value="banned">Banned</option>
                        </select>
                    </div>

                    <div className="card !p-0 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead><tr className="bg-brand-surface-2/50">
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Shop</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">SP</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Số dư</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Doanh thu</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Rating</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                            </tr></thead>
                            <tbody>
                                {filtered.map(s => (
                                    <tr key={s.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center"><Store className="w-4 h-4 text-brand-primary" /></div>
                                                <div><div className="text-sm font-medium text-brand-text-primary">{s.name}</div><div className="text-xs text-brand-text-muted">{s.owner} · {s.email}</div></div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center text-brand-text-secondary">{s.products}</td>
                                        <td className="py-3 px-4 text-right font-semibold text-brand-text-primary">{s.balance.toLocaleString('vi-VN')}đ</td>
                                        <td className="py-3 px-4 text-right text-brand-text-secondary">{s.revenue.toLocaleString('vi-VN')}đ</td>
                                        <td className="py-3 px-4 text-center">{s.rating > 0 ? <div className="flex items-center justify-center gap-1"><Star className="w-3 h-3 text-brand-warning fill-brand-warning" /><span className="text-xs">{s.rating}</span></div> : <span className="text-xs text-brand-text-muted">—</span>}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`badge text-[10px] ${s.status === 'verified' ? 'badge-success' : s.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                                                {s.status === 'verified' ? 'Đã duyệt' : s.status === 'pending' ? 'Chờ KYC' : s.status === 'rejected' ? 'Từ chối' : s.status === 'suspended' ? 'Tạm khóa' : 'Banned'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-center gap-1">
                                                {s.kycStatus === 'pending' && (
                                                    <button onClick={() => setModal({ type: 'kyc', sellerId: s.id })} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors" title="Xem KYC"><FileText className="w-4 h-4" /></button>
                                                )}
                                                <button onClick={() => setModal({ type: 'balance', sellerId: s.id })} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-success hover:bg-brand-success/10 transition-colors" title="Cộng/Trừ tiền"><PlusCircle className="w-4 h-4" /></button>
                                                <button onClick={() => setModal({ type: 'history', sellerId: s.id })} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors" title="Lịch sử"><History className="w-4 h-4" /></button>
                                                {s.status === 'verified' ? (
                                                    <button onClick={() => setModal({ type: 'ban', sellerId: s.id })} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-colors" title="Khóa"><Lock className="w-4 h-4" /></button>
                                                ) : (s.status === 'suspended' || s.status === 'banned') && (
                                                    <button onClick={() => handleBan(s.id, 'unban')} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-success hover:bg-brand-success/10 transition-colors" title="Mở khóa"><Unlock className="w-4 h-4" /></button>
                                                )}
                                                <button onClick={() => {
                                                    // Find the application associated with this seller to delete it
                                                    const sellerApp = apps.find(a => a.shopName === s.name);
                                                    if (sellerApp) {
                                                        deleteApp(sellerApp.id);
                                                    } else {
                                                        setSellers(prev => prev.filter(ss => ss.id !== s.id));
                                                        showToast('🗑️ Đã xóa seller');
                                                    }
                                                }} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-colors" title="Xóa seller"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Reject Modal */}
            {rejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6 space-y-4">
                        <h3 className="text-sm font-semibold text-brand-text-primary">Lý do từ chối</h3>
                        <textarea value={rejectModal.reason} onChange={e => setRejectModal({ ...rejectModal, reason: e.target.value })}
                            placeholder="Nhập lý do từ chối (tùy chọn)..." className="input-field w-full h-24 resize-none text-sm" />
                        <div className="flex gap-3">
                            <button onClick={() => setRejectModal(null)} className="btn-secondary flex-1 text-sm">Hủy</button>
                            <button onClick={() => reviewApp(rejectModal.appId, 'REJECTED', rejectModal.reason)} className="btn-primary flex-1 text-sm !bg-brand-danger hover:!bg-brand-danger/90">Xác nhận từ chối</button>
                        </div>
                    </div>
                </div>
            )}

            {/* KYC Review Modal */}
            {modal.type === 'kyc' && selectedSeller && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-brand-surface rounded-2xl p-6 w-[480px] shadow-card-hover border border-brand-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-brand-text-primary">Duyệt KYC — {selectedSeller.name}</h3>
                            <button onClick={() => setModal({ type: null, sellerId: null })} className="p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] text-brand-text-muted uppercase tracking-wider mb-1">Họ tên chủ shop</div>
                                    <div className="text-sm font-medium text-brand-text-primary flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-brand-primary" /> {selectedSeller.owner}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] text-brand-text-muted uppercase tracking-wider mb-1">Email</div>
                                    <div className="text-sm font-medium text-brand-text-primary">{selectedSeller.email}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] text-brand-text-muted uppercase tracking-wider mb-1">CCCD/CMND</div>
                                    <div className="text-sm font-medium text-brand-text-primary">{selectedSeller.cccd}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] text-brand-text-muted uppercase tracking-wider mb-1">Số điện thoại</div>
                                    <div className="text-sm font-medium text-brand-text-primary">{selectedSeller.phone}</div>
                                </div>
                            </div>
                            <div className="bg-brand-surface-2 rounded-xl p-4">
                                <div className="text-[10px] text-brand-text-muted uppercase tracking-wider mb-2">Ảnh CCCD/CMND</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="aspect-[3/2] bg-brand-surface-3 rounded-lg border border-dashed border-brand-border flex items-center justify-center"><span className="text-xs text-brand-text-muted">Mặt trước</span></div>
                                    <div className="aspect-[3/2] bg-brand-surface-3 rounded-lg border border-dashed border-brand-border flex items-center justify-center"><span className="text-xs text-brand-text-muted">Mặt sau</span></div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => handleRejectKYC(selectedSeller.id)} className="bg-brand-danger text-white flex-1 py-2.5 rounded-xl text-sm font-medium hover:brightness-110 transition-all">Từ chối</button>
                                <button onClick={() => handleApproveKYC(selectedSeller.id)} className="bg-brand-success text-white flex-1 py-2.5 rounded-xl text-sm font-medium hover:brightness-110 transition-all">Duyệt KYC</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Balance Modal */}
            {modal.type === 'balance' && selectedSeller && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-brand-surface rounded-2xl p-6 w-[420px] shadow-card-hover border border-brand-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-brand-text-primary">Cộng/Trừ tiền — {selectedSeller.name}</h3>
                            <button onClick={() => setModal({ type: null, sellerId: null })} className="p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-4 h-4" /></button>
                        </div>
                        <p className="text-sm text-brand-text-muted mb-4">Số dư: <span className="font-semibold text-brand-success">{selectedSeller.balance.toLocaleString('vi-VN')}đ</span></p>
                        <div className="flex gap-2 mb-4">
                            <button onClick={() => setBalanceAction('add')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${balanceAction === 'add' ? 'bg-brand-success/15 text-brand-success border border-brand-success/30' : 'bg-brand-surface-2 text-brand-text-muted'}`}><PlusCircle className="w-4 h-4" /> Cộng</button>
                            <button onClick={() => setBalanceAction('subtract')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${balanceAction === 'subtract' ? 'bg-brand-danger/15 text-brand-danger border border-brand-danger/30' : 'bg-brand-surface-2 text-brand-text-muted'}`}><MinusCircle className="w-4 h-4" /> Trừ</button>
                        </div>
                        <input type="number" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)} placeholder="Số tiền (VNĐ)..." className="input-field w-full text-sm mb-4" />
                        <div className="flex gap-3">
                            <button onClick={() => setModal({ type: null, sellerId: null })} className="btn-secondary flex-1 text-sm">Hủy</button>
                            <button onClick={handleBalanceChange} className={`flex-1 py-2 rounded-xl text-sm font-medium text-white ${balanceAction === 'add' ? 'bg-brand-success' : 'bg-brand-danger'} hover:brightness-110 transition-all`}>Xác nhận</button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {modal.type === 'history' && selectedSeller && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-brand-surface rounded-2xl p-6 w-[500px] shadow-card-hover border border-brand-border max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-brand-text-primary">Lịch sử — {selectedSeller.name}</h3>
                            <button onClick={() => setModal({ type: null, sellerId: null })} className="p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-4 h-4" /></button>
                        </div>
                        {selectedSeller.history.length > 0 ? selectedSeller.history.map((h, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface-2/50 mb-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${h.amount > 0 ? 'bg-brand-success/15' : 'bg-brand-danger/15'}`}>
                                    {h.amount > 0 ? <PlusCircle className="w-4 h-4 text-brand-success" /> : <MinusCircle className="w-4 h-4 text-brand-danger" />}
                                </div>
                                <div className="flex-1"><div className="text-sm text-brand-text-primary">{h.desc}</div><div className="text-xs text-brand-text-muted">{h.date}</div></div>
                                <div className={`text-sm font-semibold ${h.amount > 0 ? 'text-brand-success' : 'text-brand-danger'}`}>{h.amount > 0 ? '+' : ''}{h.amount.toLocaleString('vi-VN')}đ</div>
                            </div>
                        )) : <p className="text-sm text-brand-text-muted text-center py-8">Chưa có lịch sử</p>}
                    </div>
                </div>
            )}

            {/* Ban Modal */}
            {modal.type === 'ban' && selectedSeller && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-brand-surface rounded-2xl p-6 w-[400px] shadow-card-hover border border-brand-border">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-brand-text-primary">Khóa shop</h3>
                            <button onClick={() => setModal({ type: null, sellerId: null })} className="p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-4 h-4" /></button>
                        </div>
                        <p className="text-sm text-brand-text-muted mb-4">Xử lý shop <span className="font-semibold">{selectedSeller.name}</span>:</p>
                        <div className="space-y-3">
                            <button onClick={() => handleBan(selectedSeller.id, 'suspend')} className="w-full flex items-center gap-3 p-3 rounded-xl border border-brand-warning/30 bg-brand-warning/5 hover:bg-brand-warning/10"><Lock className="w-5 h-5 text-brand-warning" /><div className="text-left"><div className="text-sm font-medium text-brand-warning">Tạm khóa</div><div className="text-xs text-brand-text-muted">Khóa tạm thời shop</div></div></button>
                            <button onClick={() => handleBan(selectedSeller.id, 'ban')} className="w-full flex items-center gap-3 p-3 rounded-xl border border-brand-danger/30 bg-brand-danger/5 hover:bg-brand-danger/10"><Ban className="w-5 h-5 text-brand-danger" /><div className="text-left"><div className="text-sm font-medium text-brand-danger">Ban vĩnh viễn</div><div className="text-xs text-brand-text-muted">Cấm vĩnh viễn khỏi hệ thống</div></div></button>
                        </div>
                        <button onClick={() => setModal({ type: null, sellerId: null })} className="btn-secondary w-full mt-4 text-sm">Hủy</button>
                    </div>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 animate-slide-up">
                    <span className="text-sm text-brand-text-primary font-medium">{toast}</span>
                </div>
            )}
        </div>
    );
}
