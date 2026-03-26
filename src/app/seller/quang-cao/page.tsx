'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import {
    Megaphone, Plus, Loader2, Package, Calendar, DollarSign, Eye,
    MousePointer, Pause, Play, AlertCircle, TrendingUp, X
} from 'lucide-react';

function formatCurrency(n: number) { return n.toLocaleString('vi-VN') + 'đ'; }

export default function SellerAdsPage() {
    const { user } = useAuth();
    const { t } = useI18n();
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [toast, setToast] = useState('');
    const [creating, setCreating] = useState(false);

    // Form state
    const [form, setForm] = useState({
        productId: '', title: '', bidAmount: 500, totalBudget: 100000, dailyBudget: 20000,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    });

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const fetchData = async () => {
        const token = localStorage.getItem('token') || '';
        try {
            const [adsRes, prodsRes] = await Promise.all([
                fetch('/api/v1/seller/ads', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/v1/seller/products', { headers: { Authorization: `Bearer ${token}` } }),
            ]);
            const adsData = await adsRes.json();
            const prodsData = await prodsRes.json();
            if (adsData.success) setCampaigns(adsData.data);
            if (prodsData.success) setProducts(prodsData.data.filter((p: any) => p.status === 'ACTIVE'));
        } catch { }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const statusLabels: Record<string, { label: string; cls: string }> = {
        DRAFT: { label: t('sadDraftLabel'), cls: 'badge-secondary' },
        PENDING_REVIEW: { label: t('sadPendingReview'), cls: 'bg-brand-warning/10 text-brand-warning border border-brand-warning/30 text-xs px-2 py-0.5 rounded-full' },
        ACTIVE: { label: t('sadActiveLabel'), cls: 'badge-success' },
        PAUSED: { label: t('sadPausedLabel'), cls: 'badge-secondary' },
        COMPLETED: { label: t('sadCompletedLabel'), cls: 'badge-primary' },
        REJECTED: { label: t('sadRejectedLabel'), cls: 'badge-danger' },
    };

    const handleCreate = async () => {
        if (!form.productId || !form.title) { showToast(t('sadFillAll')); return; }
        setCreating(true);
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/seller/ads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (data.success) {
                showToast('✅ ' + data.message);
                setShowCreate(false);
                fetchData();
            } else {
                showToast('❌ ' + data.message);
            }
        } catch { showToast(t('spConnectionError')); }
        setCreating(false);
    };

    const handleAction = async (campaignId: string, action: string) => {
        const token = localStorage.getItem('token') || '';
        try {
            const res = await fetch('/api/v1/seller/ads', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ campaignId, action }),
            });
            const data = await res.json();
            showToast(data.success ? '✅ ' + data.message : '❌ ' + data.message);
            if (data.success) fetchData();
        } catch { showToast(t('spConnectionError')); }
    };

    // Stats
    const totalSpent = campaigns.reduce((s, c) => s + c.spentAmount, 0);
    const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-primary" /></div>;

    return (
        <div className="space-y-6">
            {toast && <div className="fixed top-4 right-4 z-50 bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-sm shadow-card-hover">{toast}</div>}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary flex items-center gap-2">
                        <Megaphone className="w-6 h-6 text-brand-primary" /> {t('sadTitle')}
                    </h1>
                    <p className="text-sm text-brand-text-muted mt-1">{t('sadSubtitle')}</p>
                </div>
                <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
                    <Plus className="w-4 h-4" /> {t('sadCreateCampaign')}
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-brand-primary" /></div>
                    <div><div className="text-xs text-brand-text-muted">{t('sadRunning')}</div><div className="text-lg font-bold text-brand-text-primary">{activeCampaigns}</div></div>
                </div>
                <div className="card flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-info/10 flex items-center justify-center"><Eye className="w-5 h-5 text-brand-info" /></div>
                    <div><div className="text-xs text-brand-text-muted">{t('sadTotalImpressions')}</div><div className="text-lg font-bold text-brand-text-primary">{totalImpressions.toLocaleString()}</div></div>
                </div>
                <div className="card flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-warning/10 flex items-center justify-center"><DollarSign className="w-5 h-5 text-brand-warning" /></div>
                    <div><div className="text-xs text-brand-text-muted">{t('sadSpent')}</div><div className="text-lg font-bold text-brand-text-primary">{formatCurrency(totalSpent)}</div></div>
                </div>
            </div>

            {/* Campaigns List */}
            {campaigns.length === 0 ? (
                <div className="card text-center py-12">
                    <Megaphone className="w-10 h-10 text-brand-text-muted/30 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-brand-text-primary mb-1">{t('sadNoCampaigns')}</h3>
                    <p className="text-xs text-brand-text-muted mb-4">{t('sadNoCampaignsDesc')}</p>
                    <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">{t('sadCreateFirst')}</button>
                </div>
            ) : (
                <div className="space-y-3">
                    {campaigns.map(c => (
                        <div key={c.id} className="card">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-lg bg-brand-surface-2 flex items-center justify-center overflow-hidden shrink-0">
                                    {c.product?.images?.[0]?.url ? (
                                        <img src={c.product.images[0].url} className="w-full h-full object-cover" />
                                    ) : (
                                        <Package className="w-6 h-6 text-brand-text-muted/30" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-sm font-semibold text-brand-text-primary truncate">{c.title}</h3>
                                        <span className={statusLabels[c.status]?.cls}>{statusLabels[c.status]?.label}</span>
                                    </div>
                                    <p className="text-xs text-brand-text-muted mb-2">{c.product?.name}</p>
                                    <div className="flex items-center gap-4 text-xs text-brand-text-muted flex-wrap">
                                        <span>Bid: <b className="text-brand-primary">{formatCurrency(c.bidAmount)}</b>{t('sadBidPer')}</span>
                                        <span>{t('sadBudget')}: <b>{formatCurrency(c.totalBudget)}</b></span>
                                        <span>{t('sadSpentLabel')}: <b className="text-brand-warning">{formatCurrency(c.spentAmount)}</b></span>
                                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{c.impressions}</span>
                                        <span className="flex items-center gap-1"><MousePointer className="w-3 h-3" />{c.clicks}</span>
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(c.startDate).toLocaleDateString('vi-VN')} — {new Date(c.endDate).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                    {c.rejectedReason && <p className="text-xs text-brand-danger mt-1">{t('sadRejectReason')}: {c.rejectedReason}</p>}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {c.status === 'ACTIVE' && (
                                        <button onClick={() => handleAction(c.id, 'pause')} className="p-2 rounded-lg hover:bg-brand-surface-2 text-brand-warning" title={t('sadPausedLabel')}>
                                            <Pause className="w-4 h-4" />
                                        </button>
                                    )}
                                    {c.status === 'PAUSED' && (
                                        <button onClick={() => handleAction(c.id, 'resume')} className="p-2 rounded-lg hover:bg-brand-surface-2 text-brand-success" title={t('sadActiveLabel')}>
                                            <Play className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-brand-surface rounded-2xl shadow-card-hover w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-5 border-b border-brand-border flex items-center justify-between">
                            <h2 className="text-base font-bold text-brand-text-primary">{t('sadCreateTitle')}</h2>
                            <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-brand-text-muted" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-brand-text-secondary mb-1 block">{t('sadProduct')}</label>
                                <select value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })} className="input-field w-full text-sm">
                                    <option value="">{t('sadSelectProduct')}</option>
                                    {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-brand-text-secondary mb-1 block">{t('sadCampaignTitle')}</label>
                                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field w-full text-sm" placeholder="VD: Promote ChatGPT Premium" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-brand-text-secondary mb-1 block">{t('sadBidPerView')}</label>
                                    <input type="number" value={form.bidAmount} onChange={e => setForm({ ...form, bidAmount: +e.target.value })} className="input-field w-full text-sm" min={100} step={100} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-brand-text-secondary mb-1 block">{t('sadTotalBudget')}</label>
                                    <input type="number" value={form.totalBudget} onChange={e => setForm({ ...form, totalBudget: +e.target.value })} className="input-field w-full text-sm" min={10000} step={10000} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-brand-text-secondary mb-1 block">{t('sadDailyBudget')}</label>
                                    <input type="number" value={form.dailyBudget} onChange={e => setForm({ ...form, dailyBudget: +e.target.value })} className="input-field w-full text-sm" min={5000} step={5000} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-brand-text-secondary mb-1 block">{t('sadStartDate')}</label>
                                    <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="input-field w-full text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-brand-text-secondary mb-1 block">{t('sadEndDate')}</label>
                                    <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="input-field w-full text-sm" />
                                </div>
                            </div>

                            {/* Cost estimate */}
                            <div className="bg-brand-surface-2 rounded-xl p-3 text-xs text-brand-text-secondary space-y-1">
                                <div className="flex justify-between"><span>{t('sadBidPrice')}:</span><span className="font-bold text-brand-primary">{formatCurrency(form.bidAmount)}{t('sadBidPer')}</span></div>
                                <div className="flex justify-between"><span>{t('sadDailyBudgetLabel')}:</span><span className="font-bold">{formatCurrency(form.dailyBudget)}</span></div>
                                <div className="flex justify-between"><span>{t('sadTotalBudgetLabel')}:</span><span className="font-bold text-brand-warning">{formatCurrency(form.totalBudget)}</span></div>
                                <div className="flex justify-between"><span>{t('sadEstImpressions')}:</span><span className="font-bold text-brand-success">~{Math.floor(form.totalBudget / form.bidAmount).toLocaleString()}</span></div>
                            </div>

                            <div className="bg-brand-info/5 border border-brand-info/20 rounded-xl p-3 text-xs text-brand-text-secondary flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-brand-info shrink-0 mt-0.5" />
                                <p>{formatCurrency(form.totalBudget)}</p>
                            </div>
                        </div>
                        <div className="p-5 border-t border-brand-border flex gap-3">
                            <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">{t('sadCancel')}</button>
                            <button onClick={handleCreate} disabled={creating} className="btn-primary flex-1 flex items-center justify-center gap-2">
                                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('sadCreating')}</> : <><Megaphone className="w-4 h-4" /> {t('sadCreateCampaign')}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
