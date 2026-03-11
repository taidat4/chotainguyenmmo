'use client';

import { useState } from 'react';
import { formatDateTime, getStatusLabel } from '@/lib/utils';
import { AlertTriangle, Eye, MessageSquare, CheckCircle, Clock, X, Send, CheckCircle2 } from 'lucide-react';

const initialComplaints: { id: string; orderCode: string; buyer: string; product: string; reason: string; status: string; createdAt: string }[] = [];

export default function SellerComplaintsPage() {
    const [complaints, setComplaints] = useState(initialComplaints);
    const [selected, setSelected] = useState<typeof initialComplaints[0] | null>(null);
    const [replyTo, setReplyTo] = useState<typeof initialComplaints[0] | null>(null);
    const [replyText, setReplyText] = useState('');
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const handleReply = () => {
        if (!replyTo || !replyText.trim()) return;
        setComplaints(prev => prev.map(c => c.id === replyTo.id ? { ...c, status: 'under_review' } : c));
        setReplyTo(null);
        setReplyText('');
        showToast('✅ Đã gửi phản hồi khiếu nại');
    };

    const handleResolve = (id: string) => {
        setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: 'resolved' } : c));
        setSelected(null);
        showToast('✅ Đã đánh dấu giải quyết xong');
    };

    const stats = {
        open: complaints.filter(c => c.status === 'open').length,
        review: complaints.filter(c => c.status === 'under_review').length,
        resolved: complaints.filter(c => c.status === 'resolved').length,
        rate: complaints.length > 0 ? Math.round(complaints.filter(c => c.status === 'resolved').length / complaints.length * 100) : 0,
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Khiếu nại từ khách hàng</h1>
                <p className="text-sm text-brand-text-muted">Xem xét và phản hồi khiếu nại, giữ tỷ lệ giải quyết cao để bảo vệ uy tín shop.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Chờ phản hồi', value: stats.open, icon: Clock, color: 'text-brand-warning', bg: 'bg-brand-warning/10' },
                    { label: 'Đang xử lý', value: stats.review, icon: MessageSquare, color: 'text-brand-info', bg: 'bg-brand-info/10' },
                    { label: 'Đã giải quyết', value: stats.resolved, icon: CheckCircle, color: 'text-brand-success', bg: 'bg-brand-success/10' },
                    { label: 'Tỷ lệ giải quyết', value: `${stats.rate}%`, icon: AlertTriangle, color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
                ].map((s, i) => (
                    <div key={i} className="card !p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
                        </div>
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                        <div className="text-xs text-brand-text-muted mt-0.5">{s.label}</div>
                    </div>
                ))}
            </div>

            <div className="space-y-3">
                {complaints.map(c => (
                    <div key={c.id} className="card hover:border-brand-primary/30 transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-xs text-brand-primary font-medium">{c.id}</span>
                                    <span className="text-xs text-brand-text-muted">·</span>
                                    <span className="text-xs text-brand-text-muted">{c.orderCode}</span>
                                    <span className="text-xs text-brand-text-muted">·</span>
                                    <span className="text-xs text-brand-text-secondary">Khách: {c.buyer}</span>
                                </div>
                                <h3 className="text-sm font-semibold text-brand-text-primary">{c.product}</h3>
                                <p className="text-xs text-brand-text-secondary mt-1">Lý do: {c.reason}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                    <span className={`badge text-[10px] ${c.status === 'open' ? 'badge-warning' : c.status === 'under_review' ? 'badge-info' : c.status === 'resolved' ? 'badge-success' : 'badge-danger'}`}>
                                        {getStatusLabel(c.status)}
                                    </span>
                                    <div className="text-[10px] text-brand-text-muted mt-1">{formatDateTime(c.createdAt)}</div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => setSelected(c)} className="p-2 rounded-xl text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2 transition-all" title="Xem chi tiết">
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    {(c.status === 'open' || c.status === 'under_review') && (
                                        <button onClick={() => { setReplyTo(c); setReplyText(''); }} className="p-2 rounded-xl text-brand-text-muted hover:text-brand-success hover:bg-brand-surface-2 transition-all" title="Phản hồi">
                                            <MessageSquare className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* View Detail Modal */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6 animate-slide-up">
                        <button onClick={() => setSelected(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5 text-brand-text-muted" /></button>
                        <h2 className="text-lg font-bold text-brand-text-primary mb-4">⚠️ Chi tiết khiếu nại</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Mã KN</span><span className="font-semibold text-brand-primary">{selected.id}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Đơn hàng</span><span>{selected.orderCode}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Khách hàng</span><span>{selected.buyer}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Sản phẩm</span><span>{selected.product}</span></div>
                            <div className="border-t border-brand-border pt-3"><div className="text-xs text-brand-text-muted mb-1">Lý do khiếu nại</div><p className="text-sm text-brand-text-primary bg-brand-surface-2 rounded-xl p-3">{selected.reason}</p></div>
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">Trạng thái</span><span className={`badge text-[10px] ${selected.status === 'resolved' ? 'badge-success' : 'badge-warning'}`}>{getStatusLabel(selected.status)}</span></div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            {(selected.status === 'open' || selected.status === 'under_review') && (
                                <button onClick={() => handleResolve(selected.id)} className="btn-primary flex-1 !py-3 flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4" /> Đánh dấu đã giải quyết</button>
                            )}
                            <button onClick={() => setSelected(null)} className="btn-secondary flex-1 !py-3">Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reply Modal */}
            {replyTo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReplyTo(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6 animate-slide-up">
                        <button onClick={() => setReplyTo(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5 text-brand-text-muted" /></button>
                        <h2 className="text-lg font-bold text-brand-text-primary mb-2">💬 Phản hồi khiếu nại</h2>
                        <p className="text-sm text-brand-text-muted mb-4">{replyTo.id} — {replyTo.product}</p>
                        <div className="bg-brand-surface-2 rounded-xl p-3 mb-4">
                            <div className="text-xs text-brand-text-muted mb-1">Lý do khiếu nại:</div>
                            <p className="text-sm text-brand-text-primary">{replyTo.reason}</p>
                        </div>
                        <textarea rows={4} value={replyText} onChange={e => setReplyText(e.target.value)} className="input-field resize-none mb-4" placeholder="Nhập phản hồi cho khách hàng..." />
                        <div className="flex gap-3">
                            <button onClick={() => setReplyTo(null)} className="btn-secondary flex-1 !py-3">Hủy</button>
                            <button onClick={handleReply} disabled={!replyText.trim()} className="btn-primary flex-1 !py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                                <Send className="w-4 h-4" /> Gửi phản hồi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 flex items-center gap-2 animate-slide-up">
                    <CheckCircle2 className="w-5 h-5 text-brand-success" /><span className="text-sm text-brand-text-primary font-medium">{toast}</span>
                </div>
            )}
        </div>
    );
}
