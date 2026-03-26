'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { formatDateTime, getStatusLabel } from '@/lib/utils';
import { AlertTriangle, Eye, MessageSquare, CheckCircle, Clock, X, Send, CheckCircle2, Loader2 } from 'lucide-react';

interface ComplaintItem {
    id: string; orderCode: string; buyer: string; product: string;
    reason: string; status: string; createdAt: string;
}

export default function SellerComplaintsPage() {
    const { user } = useAuth();
    const { t } = useI18n();
    const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
    const [selected, setSelected] = useState<ComplaintItem | null>(null);
    const [replyTo, setReplyTo] = useState<ComplaintItem | null>(null);
    const [replyText, setReplyText] = useState('');
    const [toast, setToast] = useState('');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ open: 0, review: 0, resolved: 0, rate: 0 });

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/v1/seller/complaints', { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                if (data.success) {
                    setComplaints(data.data.complaints);
                    setStats(data.data.stats);
                }
            } catch { }
            setLoading(false);
        })();
    }, []);

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">{t('scTitle')}</h1>
                <p className="text-sm text-brand-text-muted">{t('scSubtitle')}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: t('scWaitingResponse'), value: stats.open, icon: Clock, color: 'text-brand-warning', bg: 'bg-brand-warning/10' },
                    { label: t('scProcessing'), value: stats.review, icon: MessageSquare, color: 'text-brand-info', bg: 'bg-brand-info/10' },
                    { label: t('scResolved'), value: stats.resolved, icon: CheckCircle, color: 'text-brand-success', bg: 'bg-brand-success/10' },
                    { label: t('scResolutionRate'), value: `${stats.rate}%`, icon: AlertTriangle, color: 'text-brand-primary', bg: 'bg-brand-primary/10' },
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
                {complaints.length === 0 ? (
                    <div className="card text-center py-12">
                        <CheckCircle className="w-10 h-10 text-brand-success/30 mx-auto mb-2" />
                        <p className="text-sm text-brand-text-muted">{t('scNoComplaints')}</p>
                    </div>
                ) : complaints.map(c => (
                    <div key={c.id} className="card hover:border-brand-primary/30 transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-xs text-brand-primary font-medium">{c.id}</span>
                                    <span className="text-xs text-brand-text-muted">·</span>
                                    <span className="text-xs text-brand-text-muted">{c.orderCode}</span>
                                    <span className="text-xs text-brand-text-muted">·</span>
                                    <span className="text-xs text-brand-text-secondary">{t('scCustomer')}: {c.buyer}</span>
                                </div>
                                <h3 className="text-sm font-semibold text-brand-text-primary">{c.product}</h3>
                                <p className="text-xs text-brand-text-secondary mt-1">{t('scReason')}: {c.reason}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right">
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                        c.status === 'open' ? 'bg-brand-warning/10 text-brand-warning' :
                                        c.status === 'resolved' ? 'bg-brand-success/10 text-brand-success' :
                                        c.status === 'refunded' ? 'bg-brand-info/10 text-brand-info' :
                                        'bg-brand-danger/10 text-brand-danger'
                                    }`}>
                                        {c.status === 'open' ? t('scNew') : c.status === 'resolved' ? t('scResolvedLabel') : c.status === 'refunded' ? t('scRefunded') : c.status}
                                    </span>
                                    <div className="text-[10px] text-brand-text-muted mt-1">{formatDateTime(c.createdAt)}</div>
                                </div>
                                <button onClick={() => setSelected(c)} className="p-2 rounded-xl text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2">
                                    <Eye className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6 animate-slide-up">
                        <button onClick={() => setSelected(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5 text-brand-text-muted" /></button>
                        <h2 className="text-lg font-bold text-brand-text-primary mb-4">{t('scDetailTitle')}</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">{t('scComplaintId')}</span><span className="font-semibold text-brand-primary">{selected.id}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">{t('scOrder')}</span><span>{selected.orderCode}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-brand-text-muted">{t('scCustomerLabel')}</span><span>{selected.buyer}</span></div>
                            <div className="border-t border-brand-border pt-3">
                                <div className="text-xs text-brand-text-muted mb-1">{t('scReasonLabel')}</div>
                                <p className="text-sm text-brand-text-primary bg-brand-surface-2 rounded-xl p-3">{selected.reason}</p>
                            </div>
                        </div>
                        <button onClick={() => setSelected(null)} className="btn-secondary w-full !py-3 mt-5">{t('scClose')}</button>
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
