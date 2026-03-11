'use client';

import { useState } from 'react';
import { formatDateTime, getStatusLabel } from '@/lib/utils';
import { Eye, CheckCircle, XCircle, AlertTriangle, X, MessageSquare, User, Package, Clock } from 'lucide-react';

const initialComplaints: { id: string; order: string; buyer: string; seller: string; product: string; reason: string; evidence: string; status: string; createdAt: string; resolution?: string }[] = [];

export default function AdminComplaintsPage() {
    const [complaints, setComplaints] = useState(initialComplaints);
    const [selected, setSelected] = useState<typeof initialComplaints[0] | null>(null);
    const [resolveModal, setResolveModal] = useState<string | null>(null);
    const [resolution, setResolution] = useState('');
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const handleResolve = (id: string) => {
        setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: 'resolved', resolution } : c));
        setResolveModal(null);
        setResolution('');
        showToast('✅ Khiếu nại đã được giải quyết');
    };

    const handleReject = (id: string) => {
        setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: 'rejected' } : c));
        setSelected(null);
        showToast('❌ Đã từ chối khiếu nại');
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý khiếu nại</h1>
                <p className="text-sm text-brand-text-muted">Xem xét và phân xử khiếu nại giữa người mua và người bán.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Chờ xử lý', value: complaints.filter(c => c.status === 'open').length, color: 'text-brand-warning' },
                    { label: 'Đang xem xét', value: complaints.filter(c => c.status === 'under_review').length, color: 'text-brand-info' },
                    { label: 'Đã giải quyết', value: complaints.filter(c => c.status === 'resolved').length, color: 'text-brand-success' },
                    { label: 'Từ chối', value: complaints.filter(c => c.status === 'rejected').length, color: 'text-brand-danger' },
                ].map((s, i) => (
                    <div key={i} className="card !p-4">
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-brand-text-muted mt-1">{s.label}</div>
                    </div>
                ))}
            </div>
            <div className="space-y-3">
                {complaints.map(c => (
                    <div key={c.id} className="card hover:border-brand-primary/30">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-xs text-brand-primary font-medium">{c.id}</span>
                                    <span className="text-xs text-brand-text-muted">·</span>
                                    <span className="text-xs text-brand-text-muted">{c.order}</span>
                                </div>
                                <h3 className="text-sm font-semibold text-brand-text-primary">{c.product}</h3>
                                <p className="text-xs text-brand-text-secondary mt-1">Buyer: {c.buyer} → Seller: {c.seller}</p>
                                <p className="text-xs text-brand-text-muted mt-0.5">Lý do: {c.reason}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                    <span className={`badge text-[10px] ${c.status === 'open' ? 'badge-warning' : c.status === 'under_review' ? 'badge-info' : c.status === 'resolved' ? 'badge-success' : 'badge-danger'}`}>{getStatusLabel(c.status)}</span>
                                    <div className="text-[10px] text-brand-text-muted mt-1">{formatDateTime(c.createdAt)}</div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => setSelected(c)} className="p-2 rounded-xl text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2 transition-colors"><Eye className="w-4 h-4" /></button>
                                    {(c.status === 'open' || c.status === 'under_review') && (
                                        <button onClick={() => { setResolveModal(c.id); setResolution(''); }} className="p-2 rounded-xl text-brand-text-muted hover:text-brand-success hover:bg-brand-surface-2 transition-colors"><CheckCircle className="w-4 h-4" /></button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Detail Modal */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-lg w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-brand-text-primary">Chi tiết khiếu nại — {selected.id}</h3>
                            <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Sản phẩm</div>
                                    <div className="text-sm font-medium text-brand-text-primary flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-brand-primary" /> {selected.product}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Mã đơn</div>
                                    <div className="text-sm font-medium text-brand-primary">{selected.order}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Người mua</div>
                                    <div className="text-sm font-medium text-brand-text-primary flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-brand-info" /> {selected.buyer}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Người bán</div>
                                    <div className="text-sm font-medium text-brand-text-primary">{selected.seller}</div>
                                </div>
                            </div>
                            <div className="bg-brand-surface-2 rounded-xl p-3">
                                <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Lý do</div>
                                <div className="text-sm text-brand-text-primary font-medium">{selected.reason}</div>
                            </div>
                            <div className="bg-brand-surface-2 rounded-xl p-3">
                                <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Mô tả chi tiết</div>
                                <div className="text-sm text-brand-text-secondary">{selected.evidence}</div>
                            </div>
                            {selected.resolution && (
                                <div className="bg-brand-success/5 border border-brand-success/20 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-success tracking-wider mb-1">Kết quả xử lý</div>
                                    <div className="text-sm text-brand-text-primary">{selected.resolution}</div>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-xs text-brand-text-muted">
                                <Clock className="w-3.5 h-3.5" /> {formatDateTime(selected.createdAt)} ·
                                <span className={`badge text-[10px] ${selected.status === 'open' ? 'badge-warning' : selected.status === 'under_review' ? 'badge-info' : selected.status === 'resolved' ? 'badge-success' : 'badge-danger'}`}>{getStatusLabel(selected.status)}</span>
                            </div>
                            {(selected.status === 'open' || selected.status === 'under_review') && (
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => handleReject(selected.id)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-brand-danger text-white hover:brightness-110">Từ chối</button>
                                    <button onClick={() => { setSelected(null); setResolveModal(selected.id); setResolution(''); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-brand-success text-white hover:brightness-110">Giải quyết</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Resolve Modal */}
            {resolveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6">
                        <h3 className="text-sm font-semibold text-brand-text-primary mb-3">Giải quyết khiếu nại — {resolveModal}</h3>
                        <textarea value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Nhập kết quả xử lý..." className="input-field w-full h-24 resize-none text-sm" />
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setResolveModal(null)} className="btn-secondary flex-1 text-sm">Hủy</button>
                            <button onClick={() => handleResolve(resolveModal)} className="btn-primary flex-1 text-sm !bg-brand-success">Xác nhận</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 animate-slide-up"><span className="text-sm text-brand-text-primary font-medium">{toast}</span></div>}
        </div>
    );
}
