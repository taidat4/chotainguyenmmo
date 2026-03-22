'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Store, CheckCircle, FileText, User, Phone, CreditCard, Clock, ArrowRight, Shield, AlertTriangle, Building2 } from 'lucide-react';
import { VIETNAMESE_BANKS } from '@/lib/banks';
import { useI18n } from '@/lib/i18n';

export default function SellerRegistrationPage() {
    const { user, updateUser } = useAuth();
    const router = useRouter();
    const { t, locale } = useI18n();
    const [step, setStep] = useState(1);
    const [kycRequired, setKycRequired] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [existingApp, setExistingApp] = useState<any>(null);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [formData, setFormData] = useState({
        shopName: '',
        fullName: '',
        phone: '',
        cccd: '',
        address: '',
        bankName: '',
        bankAccount: '',
        bankOwner: '',
    });

    useEffect(() => {
        if (user) checkStatus();
    }, [user]);

    const checkStatus = async () => {
        try {
            const res = await fetch(`/api/v1/seller/register?userId=${user?.id}`);
            const data = await res.json();
            if (data.success) {
                setKycRequired(data.settings?.kycRequired || false);
                if (data.data) {
                    setExistingApp(data.data);
                }
            }
        } catch { }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await fetch('/api/v1/seller/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user?.id,
                    username: user?.username,
                    userEmail: user?.email,
                    shopName: formData.shopName,
                    bankName: formData.bankName,
                    bankAccount: formData.bankAccount,
                    bankOwner: formData.bankOwner,
                    ...(kycRequired ? {
                        kycFullName: formData.fullName,
                        kycCccd: formData.cccd,
                        kycPhone: formData.phone,
                        kycAddress: formData.address,
                    } : {}),
                }),
            });
            const data = await res.json();
            setResult({ success: data.success, message: data.message });

            if (data.success && data.data?.status === 'APPROVED') {
                updateUser({ role: 'SELLER' });
                setTimeout(() => {
                    router.push('/seller');
                }, 2000);
            }
        } catch {
            setResult({ success: false, message: t('srConnectError') });
        }
        setSubmitting(false);
    };

    const steps = kycRequired
        ? [t('srStepShop'), t('srStepKyc'), t('srStepBank')]
        : [t('srStepShop'), t('srStepBank')];

    const totalSteps = steps.length;

    if (!user) {
        return (
            <>
                <Header />
                <main className="min-h-screen bg-brand-bg flex items-center justify-center">
                    <div className="card max-w-md text-center">
                        <Shield className="w-12 h-12 text-brand-primary mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-brand-text-primary mb-2">{t('srLoginRequired')}</h2>
                        <p className="text-sm text-brand-text-muted mb-6">{t('srLoginRequiredDesc')}</p>
                        <button onClick={() => router.push('/dang-nhap')} className="btn-primary w-full">{t('srLoginNow')}</button>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    if (loading) {
        return (
            <>
                <Header />
                <main className="min-h-screen bg-brand-bg flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
                </main>
                <Footer />
            </>
        );
    }

    if (existingApp) {
        const statusInfo: Record<string, { icon: React.ReactNode; title: string; desc: string; color: string }> = {
            PENDING: { icon: <Clock className="w-8 h-8 text-brand-warning" />, title: t('srStatusPending'), desc: t('srStatusPendingDesc'), color: 'brand-warning' },
            APPROVED: { icon: <CheckCircle className="w-8 h-8 text-brand-success" />, title: t('srStatusApproved'), desc: `Shop "${existingApp.shopName}" ${locale === 'vi' ? 'đã hoạt động. Bạn có thể bắt đầu bán hàng.' : 'is now active. You can start selling.'}`, color: 'brand-success' },
            REJECTED: { icon: <AlertTriangle className="w-8 h-8 text-brand-danger" />, title: t('srStatusRejected'), desc: existingApp.rejectionReason || t('srStatusRejectedDesc'), color: 'brand-danger' },
            KYC_REQUIRED: { icon: <FileText className="w-8 h-8 text-brand-warning" />, title: t('srStatusKyc'), desc: t('srStatusKycDesc'), color: 'brand-warning' },
        };
        const info = statusInfo[existingApp.status] || statusInfo.PENDING;

        return (
            <>
                <Header />
                <main className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
                    <div className="card max-w-lg text-center space-y-5">
                        <div className={`w-16 h-16 rounded-full bg-${info.color}/15 flex items-center justify-center mx-auto`}>
                            {info.icon}
                        </div>
                        <h2 className="text-xl font-bold text-brand-text-primary">{info.title}</h2>
                        <p className="text-sm text-brand-text-muted">{info.desc}</p>
                        <div className="bg-brand-surface-2 rounded-xl p-4 text-left text-xs space-y-1">
                            <div className="flex justify-between"><span className="text-brand-text-muted">{t('srShopNameLabel')}</span><span className="font-medium text-brand-text-primary">{existingApp.shopName}</span></div>
                            <div className="flex justify-between"><span className="text-brand-text-muted">{t('srRegDate')}</span><span className="font-medium text-brand-text-primary">{new Date(existingApp.createdAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}</span></div>
                            <div className="flex justify-between"><span className="text-brand-text-muted">{t('srStatus')}</span><span className={`font-semibold text-${info.color}`}>{existingApp.status === 'APPROVED' ? t('srApproved') : existingApp.status === 'PENDING' ? t('srPendingLabel') : existingApp.status === 'REJECTED' ? t('srRejectedLabel') : t('srKycLabel')}</span></div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => router.push('/')} className="btn-secondary flex-1 text-sm">{t('backHome')}</button>
                            {existingApp.status === 'APPROVED' && (
                                <button onClick={() => router.push('/seller')} className="btn-primary flex-1 text-sm">{t('srGoSeller')}</button>
                            )}
                            {existingApp.status === 'REJECTED' && (
                                <button onClick={() => { setExistingApp(null); setStep(1); }} className="btn-primary flex-1 text-sm">{t('srReRegister')}</button>
                            )}
                        </div>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    if (result) {
        return (
            <>
                <Header />
                <main className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
                    <div className="card max-w-lg text-center space-y-5">
                        <div className={`w-16 h-16 rounded-full ${result.success ? 'bg-brand-success/15' : 'bg-brand-danger/15'} flex items-center justify-center mx-auto`}>
                            {result.success ? <CheckCircle className="w-8 h-8 text-brand-success" /> : <AlertTriangle className="w-8 h-8 text-brand-danger" />}
                        </div>
                        <h2 className="text-xl font-bold text-brand-text-primary">{result.success ? t('success') : t('error')}</h2>
                        <p className="text-sm text-brand-text-muted">{result.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => router.push('/')} className="btn-secondary flex-1 text-sm">{t('backHome')}</button>
                            {result.success && (
                                <button onClick={() => router.push('/seller')} className="btn-primary flex-1 text-sm">{t('srGoSeller')}</button>
                            )}
                        </div>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    return (
        <>
            <Header />
            <main className="min-h-screen bg-brand-bg">
                <section className="relative py-12 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/10 to-brand-secondary/5" />
                    <div className="max-w-3xl mx-auto px-6 relative z-10 text-center">
                        <div className="badge-primary mb-3 inline-flex">{t('srBadge')}</div>
                        <h1 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-3">
                            {t('srTitle')} <span className="gradient-text">ChoTaiNguyen</span>
                        </h1>
                        <p className="text-sm text-brand-text-secondary max-w-xl mx-auto">
                            {kycRequired
                                ? t('srDescKyc').replace('{username}', user.username)
                                : t('srDescNoKyc')
                            }
                        </p>
                        {!kycRequired && (
                            <div className="mt-3 inline-flex items-center gap-2 bg-brand-success/10 text-brand-success text-xs font-medium px-3 py-1.5 rounded-full">
                                <CheckCircle className="w-3.5 h-3.5" /> {t('srNoKycBadge')}
                            </div>
                        )}
                    </div>
                </section>

                <div className="max-w-3xl mx-auto px-6 mb-8">
                    <div className="flex items-center justify-center gap-3">
                        {steps.map((label, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step > i + 1 ? 'bg-brand-success text-white' : step === i + 1 ? 'bg-brand-primary text-white' : 'bg-brand-surface-2 text-brand-text-muted'}`}>
                                    {step > i + 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
                                </div>
                                <span className={`text-xs font-medium hidden sm:block ${step === i + 1 ? 'text-brand-primary' : 'text-brand-text-muted'}`}>{label}</span>
                                {i < totalSteps - 1 && <div className={`w-12 h-0.5 ${step > i + 1 ? 'bg-brand-success' : 'bg-brand-border'}`} />}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="max-w-2xl mx-auto px-6 pb-16">
                    <form onSubmit={handleSubmit}>
                        {step === 1 && (
                            <div className="card space-y-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <Store className="w-5 h-5 text-brand-primary" />
                                    <h2 className="text-lg font-semibold text-brand-text-primary">{t('srShopInfo')}</h2>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">{t('srShopName')}</label>
                                    <input type="text" value={formData.shopName} onChange={e => setFormData({ ...formData, shopName: e.target.value })} placeholder={t('srShopPlaceholder')} className="input-field w-full" required />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">{t('srLinkedAccount')}</label>
                                    <div className="bg-brand-surface-2 rounded-xl p-3 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center"><User className="w-4 h-4 text-brand-primary" /></div>
                                        <div>
                                            <div className="text-sm font-medium text-brand-text-primary">{user.fullName}</div>
                                            <div className="text-xs text-brand-text-muted">@{user.username} · {user.email}</div>
                                        </div>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setStep(2)} disabled={!formData.shopName} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                                    {t('next')} <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {step === 2 && kycRequired && (
                            <div className="card space-y-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <FileText className="w-5 h-5 text-brand-primary" />
                                    <h2 className="text-lg font-semibold text-brand-text-primary">{t('srKycTitle')}</h2>
                                </div>
                                <div className="bg-brand-warning/10 border border-brand-warning/30 rounded-xl p-3 text-xs text-brand-text-secondary flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-brand-warning shrink-0 mt-0.5" />
                                    {t('srKycNotice')}
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">{t('srFullName')}</label>
                                    <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} placeholder="Nguyen Van A" className="input-field w-full" required />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">{t('srCccd')}</label>
                                    <div className="relative">
                                        <CreditCard className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input type="text" value={formData.cccd} onChange={e => setFormData({ ...formData, cccd: e.target.value })} placeholder="01234567890" className="input-field w-full !pl-10" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">{t('srPhone')}</label>
                                    <div className="relative">
                                        <Phone className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="0912345678" className="input-field w-full !pl-10" required />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">{t('srAddress')}</label>
                                    <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="input-field w-full" />
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1 text-sm">{t('back')}</button>
                                    <button type="button" onClick={() => setStep(3)} disabled={!formData.fullName || !formData.cccd || !formData.phone} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                                        {t('next')} <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {((step === 2 && !kycRequired) || (step === 3 && kycRequired)) && (
                            <div className="card space-y-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <Building2 className="w-5 h-5 text-brand-primary" />
                                    <h2 className="text-lg font-semibold text-brand-text-primary">{t('srBankTitle')}</h2>
                                </div>
                                <p className="text-xs text-brand-text-muted">{t('srBankDesc')} <span className="font-semibold text-brand-warning">500.000đ</span></p>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">{t('srBankName')}</label>
                                    <select value={formData.bankName} onChange={e => setFormData({ ...formData, bankName: e.target.value })} className="input-field w-full" required>
                                        <option value="">{t('srBankSelect')}</option>
                                        {VIETNAMESE_BANKS.map(b => (
                                            <option key={b.code} value={b.code}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">{t('srBankAccount')}</label>
                                    <input type="text" value={formData.bankAccount} onChange={e => setFormData({ ...formData, bankAccount: e.target.value })} placeholder="0123456789" className="input-field w-full" required />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-brand-text-secondary mb-1.5 block">{t('srBankOwner')}</label>
                                    <input type="text" value={formData.bankOwner} onChange={e => setFormData({ ...formData, bankOwner: e.target.value })} placeholder="NGUYEN VAN A" className="input-field w-full uppercase" required />
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setStep(kycRequired ? 2 : 1)} className="btn-secondary flex-1 text-sm">{t('back')}</button>
                                    <button type="submit" disabled={submitting || !formData.bankName || !formData.bankAccount || !formData.bankOwner} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                                        {submitting ? (
                                            <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> {t('submitting')}</>
                                        ) : (
                                            <><CheckCircle className="w-4 h-4" /> {t('srSubmit')}</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </main>
            <Footer />
        </>
    );
}
