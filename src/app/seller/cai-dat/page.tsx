'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { Store, CreditCard, Bell, Save, Upload, CheckCircle2, Loader2 } from 'lucide-react';
import { VIETNAMESE_BANKS } from '@/lib/banks';

export default function SellerSettingsPage() {
    const { user } = useAuth();
    const { t } = useI18n();
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');

    const [shopName, setShopName] = useState('');
    const [shopDesc, setShopDesc] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankAccount, setBankAccount] = useState('');
    const [bankOwner, setBankOwner] = useState('');
    const [bankBranch, setBankBranch] = useState('');
    const [notifications, setNotifications] = useState([
        { key: 'orders', labelKey: 'ssetNotifOrders' as const, descKey: 'ssetNotifOrdersDesc' as const, on: true },
        { key: 'complaints', labelKey: 'ssetNotifComplaints' as const, descKey: 'ssetNotifComplaintsDesc' as const, on: true },
        { key: 'stock', labelKey: 'ssetNotifStock' as const, descKey: 'ssetNotifStockDesc' as const, on: true },
        { key: 'weekly', labelKey: 'ssetNotifWeekly' as const, descKey: 'ssetNotifWeeklyDesc' as const, on: false },
    ]);

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/v1/seller/settings', { headers: { Authorization: `Bearer ${token}` } });
                const json = await res.json();
                if (json.success && json.data) {
                    const d = json.data;
                    setShopName(d.name || '');
                    setShopDesc(d.description || '');
                    setLogoUrl(d.logoUrl || '');
                    setEmail(d.email || '');
                    setPhone(d.phone || '');
                    setBankName(d.bankName || '');
                    setBankAccount(d.bankAccount || '');
                    setBankOwner(d.bankAccountName || '');
                    setBankBranch(d.bankBranch || '');
                }
            } catch { }
            setLoading(false);
        })();
    }, []);

    const toggleNotification = (key: string) => {
        setNotifications(prev => prev.map(n => n.key === key ? { ...n, on: !n.on } : n));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/v1/seller/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    name: shopName, description: shopDesc, phone, logoUrl,
                    bankName, bankAccount, bankAccountName: bankOwner, bankBranch,
                }),
            });
            const data = await res.json();
            if (data.success) showToast(t('ssetSaved'));
            else showToast(`❌ ${data.message}`);
        } catch { showToast(t('spConnectionError')); }
        setSaving(false);
    };

    if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">{t('ssetTitle')}</h1>
                <p className="text-sm text-brand-text-muted">{t('ssetSubtitle')}</p>
            </div>

            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5 flex items-center gap-2">
                    <Store className="w-4 h-4 text-brand-primary" /> {t('ssetShopInfo')}
                </h3>
                <div className="space-y-5">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 border-2 border-dashed border-brand-border flex items-center justify-center relative overflow-hidden group">
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <Store className="w-8 h-8 text-brand-primary" />
                            )}
                            <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <Upload className="w-5 h-5 text-white" />
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        if (file.size > 2 * 1024 * 1024) { showToast('❌ Max 2MB'); return; }
                                        const formData = new FormData();
                                        formData.append('file', file);
                                        formData.append('type', 'shop-logo');
                                        try {
                                            const res = await fetch('/api/v1/upload', {
                                                method: 'POST',
                                                headers: { Authorization: `Bearer ${token}` },
                                                body: formData,
                                            });
                                            const data = await res.json();
                                            if (data.success && data.url) {
                                                setLogoUrl(data.url);
                                                showToast('✅ Logo uploaded');
                                            } else {
                                                const reader = new FileReader();
                                                reader.onload = () => setLogoUrl(reader.result as string);
                                                reader.readAsDataURL(file);
                                                showToast('✅ Logo selected');
                                            }
                                        } catch {
                                            const reader = new FileReader();
                                            reader.onload = () => setLogoUrl(reader.result as string);
                                            reader.readAsDataURL(file);
                                            showToast('✅ Logo selected');
                                        }
                                    }}
                                />
                            </label>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('ssetShopName')}</label>
                            <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} className="input-field" />
                            <p className="text-[10px] text-brand-text-muted mt-1">{t('ssetLogoHint')}</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('ssetShopDesc')}</label>
                        <textarea rows={3} value={shopDesc} onChange={e => setShopDesc(e.target.value)} className="input-field resize-none" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('ssetEmail')}</label>
                            <input type="email" value={email} disabled className="input-field opacity-60" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('ssetPhone')}</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="input-field" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-brand-primary" /> {t('ssetPaymentInfo')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('ssetBank')}</label>
                        <select value={bankName} onChange={e => setBankName(e.target.value)} className="input-field">
                            <option value="">{t('ssetSelectBank')}</option>
                            {VIETNAMESE_BANKS.map(b => (<option key={b.code} value={b.name}>{b.name}</option>))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('ssetAccountNum')}</label>
                        <input type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)} className="input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('ssetAccountName')}</label>
                        <input type="text" value={bankOwner} onChange={e => setBankOwner(e.target.value)} className="input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('ssetBranch')}</label>
                        <input type="text" value={bankBranch} onChange={e => setBankBranch(e.target.value)} className="input-field" />
                    </div>
                </div>
            </div>

            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-brand-primary" /> {t('ssetNotifications')}
                </h3>
                <div className="space-y-4">
                    {notifications.map(item => (
                        <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-brand-surface-2/50">
                            <div>
                                <div className="text-sm font-medium text-brand-text-primary">{t(item.labelKey)}</div>
                                <div className="text-xs text-brand-text-muted">{t(item.descKey)}</div>
                            </div>
                            <button onClick={() => toggleNotification(item.key)} className={`w-11 h-6 rounded-full transition-all ${item.on ? 'bg-brand-primary' : 'bg-brand-surface-3'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-all shadow ${item.on ? 'ml-[22px]' : 'ml-0.5'}`} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-70">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? t('ssetSaving') : t('ssetSaveSettings')}
                </button>
            </div>

            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 flex items-center gap-2 animate-slide-up">
                    <CheckCircle2 className="w-5 h-5 text-brand-success" /><span className="text-sm text-brand-text-primary font-medium">{toast}</span>
                </div>
            )}
        </div>
    );
}
