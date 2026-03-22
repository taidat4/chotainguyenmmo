'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { User, Mail, Lock, AtSign, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const { login } = useAuth();
    const { t } = useI18n();
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        fullName: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!agreed) {
            setError(t('regTermsError'));
            return;
        }

        if (!form.fullName || !form.username || !form.email || !form.password) {
            setError(t('regFieldsError'));
            return;
        }

        if (!/^[a-zA-Z0-9_.]{3,30}$/.test(form.username)) {
            setError(t('regUsernameError'));
            return;
        }

        if (form.password.length < 8) {
            setError(t('regPasswordLengthError'));
            return;
        }

        if (form.password !== form.confirmPassword) {
            setError(t('regPasswordMatchError'));
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/v1/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: form.fullName,
                    username: form.username,
                    email: form.email,
                    password: form.password,
                    termsAccepted: true,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.message || t('regFailed'));
                setLoading(false);
                return;
            }

            if (data.data?.token) {
                login(data.data.token, data.data.user);
            }

            setSuccess(t('regSuccess'));
            setTimeout(() => {
                router.push('/');
            }, 1500);
        } catch {
            setError(t('regConnectError'));
            setLoading(false);
        }
    };

    return (
        <>
            <Header />
            <main className="min-h-screen flex items-center justify-center py-6 md:py-12 pt-24 md:pt-12">
                <div className="max-w-md mx-auto w-full px-4">
                    <div className="card !p-5 md:!p-8">
                        <div className="flex items-center gap-2 mb-6 justify-center">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                <span className="text-white font-bold text-sm">CT</span>
                            </div>
                            <span className="text-lg font-bold text-brand-text-primary">ChoTaiNguyen</span>
                        </div>

                        <h1 className="text-xl font-bold text-brand-text-primary mb-2 text-center">{t('regTitle')}</h1>
                        <p className="text-sm text-brand-text-secondary mb-8 text-center">
                            {t('regDesc')}
                        </p>

                        {error && (
                            <div className="flex items-center gap-2 bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-sm rounded-xl px-4 py-3 mb-5">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="flex items-center gap-2 bg-brand-success/10 border border-brand-success/20 text-brand-success text-sm rounded-xl px-4 py-3 mb-5">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                {success}
                            </div>
                        )}

                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('regFullName')}</label>
                                <div className="relative">
                                    <User className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input type="text" name="fullName" value={form.fullName} onChange={handleChange} placeholder={t('regFullNamePlaceholder')} className="input-field !pl-11" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-2">
                                    {t('regUsername')} <span className="text-brand-danger">*</span>
                                </label>
                                <div className="relative">
                                    <AtSign className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input type="text" name="username" value={form.username} onChange={handleChange} placeholder={t('regUsernamePlaceholder')} className="input-field !pl-11" required minLength={3} maxLength={30} />
                                </div>
                                <p className="text-xs text-brand-text-muted mt-1.5">{t('regUsernameHint')}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('regEmail')}</label>
                                <div className="relative">
                                    <Mail className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input type="email" name="email" value={form.email} onChange={handleChange} placeholder={t('regEmailPlaceholder')} className="input-field !pl-11" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('regPassword')}</label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input type="password" name="password" value={form.password} onChange={handleChange} placeholder={t('regPasswordPlaceholder')} className="input-field !pl-11" required minLength={8} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('regConfirmPassword')}</label>
                                <div className="relative">
                                    <Lock className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder={t('regConfirmPlaceholder')} className="input-field !pl-11" required />
                                </div>
                            </div>

                            {/* Required agreement checkboxes */}
                            <div className="space-y-3 bg-brand-surface-2 border border-brand-border rounded-xl p-4">
                                <label className="flex items-start gap-2.5 text-sm text-brand-text-secondary cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={agreed}
                                        onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setError(''); }}
                                        className="rounded border-brand-border bg-brand-surface mt-0.5 w-4 h-4 accent-brand-primary shrink-0"
                                    />
                                    <span>
                                        {t('regAgreeTerms')}{' '}
                                        <Link href="/chinh-sach" className="text-brand-primary hover:underline font-medium">{t('regTermsOfUse')}</Link>,{' '}
                                        <Link href="/chinh-sach" className="text-brand-primary hover:underline font-medium">{t('regTransactionPolicy')}</Link>{' & '}
                                        <Link href="/chinh-sach" className="text-brand-primary hover:underline font-medium">{t('regPrivacyPolicy')}</Link>{' '}
                                        {t('regOfPlatform')}
                                    </span>
                                </label>
                                <label className="flex items-start gap-2.5 text-sm text-brand-text-secondary cursor-pointer">
                                    <input
                                        type="checkbox"
                                        required
                                        className="rounded border-brand-border bg-brand-surface mt-0.5 w-4 h-4 accent-brand-primary shrink-0"
                                    />
                                    <span>
                                        {t('regConfirmInfo')}
                                    </span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={!agreed || loading}
                                className={`btn-primary w-full !py-3.5 flex items-center justify-center gap-2 ${(!agreed || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {loading ? t('regProcessing') : t('regSubmit')}
                            </button>
                        </form>

                        <p className="text-center text-sm text-brand-text-muted mt-6">
                            {t('regHasAccount')}{' '}
                            <Link href="/dang-nhap" className="text-brand-primary font-medium hover:underline">
                                {t('regLoginLink')}
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
