'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { Lock, Shield, Smartphone, Key, AlertTriangle, CheckCircle, Copy, X, Loader2, Eye, EyeOff } from 'lucide-react';

export default function SecurityPage() {
    const { user } = useAuth();
    const { t } = useI18n();
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [setupMode, setSetupMode] = useState(false);
    const [secret, setSecret] = useState('');
    const [otpauthUrl, setOtpauthUrl] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [disableCode, setDisableCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [pwLoading, setPwLoading] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

    useEffect(() => {
        fetch('/api/v1/auth/2fa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'status' }),
        }).then(r => r.json()).then(d => { if (d.success) setTwoFAEnabled(d.data.enabled); }).catch(() => {});
    }, [token]);

    const handleSetup2FA = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/auth/2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action: 'setup' }),
            });
            const data = await res.json();
            if (data.success) {
                setSecret(data.data.secret);
                setOtpauthUrl(data.data.otpauthUrl);
                setSetupMode(true);
            } else showToast('❌ ' + data.message);
        } catch { showToast('❌ ' + t('secConnectionError')); }
        setLoading(false);
    };

    const handleVerify2FA = async () => {
        if (otpCode.length !== 6) { showToast('❌ ' + t('secOtp6Digits')); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/v1/auth/2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action: 'verify', token: otpCode }),
            });
            const data = await res.json();
            if (data.success) {
                setTwoFAEnabled(true);
                setSetupMode(false);
                setOtpCode('');
                showToast('✅ ' + t('sec2faSuccess'));
            } else showToast('❌ ' + data.message);
        } catch { showToast('❌ ' + t('secConnectionError')); }
        setLoading(false);
    };

    const handleDisable2FA = async () => {
        if (disableCode.length !== 6) { showToast('❌ ' + t('secEnterOtp6')); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/v1/auth/2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action: 'disable', token: disableCode }),
            });
            const data = await res.json();
            if (data.success) {
                setTwoFAEnabled(false);
                setDisableCode('');
                showToast('✅ ' + t('sec2faDisabled2'));
            } else showToast('❌ ' + data.message);
        } catch { showToast('❌ ' + t('secConnectionError')); }
        setLoading(false);
    };

    const handleChangePassword = async () => {
        if (!passwords.current || !passwords.new) { showToast('❌ ' + t('secFillAll')); return; }
        if (passwords.new.length < 8) { showToast('❌ ' + t('secMinLength')); return; }
        if (passwords.new !== passwords.confirm) { showToast('❌ ' + t('secMismatch')); return; }
        setPwLoading(true);
        try {
            const res = await fetch('/api/v1/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('✅ ' + t('secPasswordChanged'));
                setPasswords({ current: '', new: '', confirm: '' });
            } else showToast('❌ ' + data.message);
        } catch { showToast('❌ ' + t('secConnectionError')); }
        setPwLoading(false);
    };

    const copyText = (text: string) => { navigator.clipboard.writeText(text); showToast('📋 ' + t('secCopied')); };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">{t('secTitle')}</h1>
                <p className="text-sm text-brand-text-muted">{t('secSubtitle')}</p>
            </div>

            {/* Security Status */}
            <div className={`card ${twoFAEnabled ? 'bg-gradient-to-r from-brand-success/5 to-brand-success/0 border-brand-success/20' : 'bg-gradient-to-r from-brand-warning/5 to-brand-warning/0 border-brand-warning/20'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${twoFAEnabled ? 'bg-brand-success/20' : 'bg-brand-warning/20'}`}>
                        <Shield className={`w-5 h-5 ${twoFAEnabled ? 'text-brand-success' : 'text-brand-warning'}`} />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-brand-text-primary">{twoFAEnabled ? t('secLevelGood') : t('secLevelMedium')}</div>
                        <div className="text-xs text-brand-text-muted">{twoFAEnabled ? t('secLevelGoodDesc') : t('secLevelMediumDesc')}</div>
                    </div>
                </div>
            </div>

            {/* Change Password */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-brand-primary" /> {t('secChangePassword')}
                </h3>
                <div className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('secCurrentPassword')}</label>
                        <div className="relative">
                            <Key className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="password" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} placeholder={t('secCurrentPasswordPlaceholder')} className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('secNewPassword')}</label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="password" value={passwords.new} onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))} placeholder={t('secNewPasswordPlaceholder')} className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">{t('secConfirmPassword')}</label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} placeholder={t('secConfirmPasswordPlaceholder')} className="input-field !pl-11" />
                        </div>
                    </div>
                    <button onClick={handleChangePassword} disabled={pwLoading} className="btn-primary disabled:opacity-50">
                        {pwLoading ? t('secProcessing') : t('secUpdatePassword')}
                    </button>
                </div>
            </div>

            {/* Two-Factor Auth */}
            <div className="card">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-brand-primary" /> {t('sec2faTitle')}
                    </h3>
                    <span className={twoFAEnabled ? 'badge-success' : 'badge-warning'}>{twoFAEnabled ? t('sec2faEnabled') : t('sec2faDisabled')}</span>
                </div>

                {!twoFAEnabled && !setupMode && (
                    <>
                        <p className="text-sm text-brand-text-secondary mb-4">
                            {t('sec2faDesc')}
                        </p>
                        <button onClick={handleSetup2FA} disabled={loading} className="btn-primary disabled:opacity-50">
                            {loading ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />{t('sec2faCreating')}</> : t('sec2faSetup')}
                        </button>
                    </>
                )}

                {/* Setup Mode: QR Code + Secret Key */}
                {setupMode && (
                    <div className="space-y-5">
                        <div className="bg-brand-surface-2 rounded-xl p-5">
                            <h4 className="text-sm font-semibold text-brand-text-primary mb-3">{t('sec2faStep1')}</h4>
                            <p className="text-xs text-brand-text-muted mb-4">{t('sec2faStep1Desc')}</p>
                            <div className="flex justify-center mb-4">
                                <div className="bg-white p-4 rounded-xl shadow-sm">
                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`} alt="QR Code 2FA" width={200} height={200} className="rounded-lg" />
                                </div>
                            </div>
                            <p className="text-xs text-brand-text-muted text-center mb-3">{t('sec2faManual')}</p>
                            <div className="flex items-center gap-2 bg-brand-surface rounded-lg border border-brand-border p-3">
                                <code className="flex-1 text-sm font-mono text-brand-primary tracking-wider">
                                    {showSecret ? secret : '•'.repeat(secret.length)}
                                </code>
                                <button onClick={() => setShowSecret(!showSecret)} className="p-1.5 rounded-lg hover:bg-brand-surface-2 text-brand-text-muted">
                                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                <button onClick={() => copyText(secret)} className="p-1.5 rounded-lg hover:bg-brand-surface-2 text-brand-text-muted">
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="bg-brand-surface-2 rounded-xl p-5">
                            <h4 className="text-sm font-semibold text-brand-text-primary mb-3">{t('sec2faStep2')}</h4>
                            <p className="text-xs text-brand-text-muted mb-4">{t('sec2faStep2Desc')}</p>
                            <div className="flex gap-3 max-w-xs">
                                <input
                                    type="text" value={otpCode}
                                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    className="input-field text-center text-lg font-mono tracking-[0.5em] flex-1"
                                    maxLength={6}
                                />
                                <button onClick={handleVerify2FA} disabled={loading || otpCode.length !== 6} className="btn-primary !px-6 disabled:opacity-50">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('sec2faConfirm')}
                                </button>
                            </div>
                        </div>

                        <button onClick={() => { setSetupMode(false); setOtpCode(''); }} className="btn-secondary text-sm">
                            <X className="w-4 h-4 inline mr-1" /> {t('sec2faCancel')}
                        </button>
                    </div>
                )}

                {/* Disable 2FA */}
                {twoFAEnabled && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-brand-success">
                            <CheckCircle className="w-4 h-4" /> {t('sec2faActiveDesc')}
                        </div>
                        <div className="border-t border-brand-border pt-4">
                            <p className="text-xs text-brand-text-muted mb-3">{t('sec2faDisableDesc')}</p>
                            <div className="flex gap-3 max-w-xs">
                                <input
                                    type="text" value={disableCode}
                                    onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    className="input-field text-center text-sm font-mono tracking-[0.3em] flex-1"
                                    maxLength={6}
                                />
                                <button onClick={handleDisable2FA} disabled={loading || disableCode.length !== 6} className="px-4 py-2 bg-brand-danger text-white text-sm rounded-xl hover:bg-brand-danger/90 disabled:opacity-50 transition-all">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('sec2faDisableBtn')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Active Sessions */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5">{t('secSessions')}</h3>
                <div className="space-y-3">
                    {[
                        { device: 'Chrome — Windows 10', location: 'TP.HCM, Viet Nam', time: t('secActiveNow'), current: true },
                        { device: 'Safari — iPhone 15', location: 'TP.HCM, Viet Nam', time: '2h', current: false },
                        { device: 'Firefox — macOS', location: 'Ha Noi, Viet Nam', time: '3d', current: false },
                    ].map((session, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-brand-surface-2/50 border border-brand-border/50">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${session.current ? 'bg-brand-success' : 'bg-brand-text-muted'}`} />
                                <div>
                                    <div className="text-sm font-medium text-brand-text-primary">{session.device}</div>
                                    <div className="text-xs text-brand-text-muted">{session.location} · {session.time}</div>
                                </div>
                            </div>
                            {session.current ? (
                                <span className="text-xs text-brand-success font-medium">{t('secCurrentSession')}</span>
                            ) : (
                                <button className="text-xs text-brand-danger hover:underline">{t('secRevoke')}</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Danger Zone */}
            <div className="card border-brand-danger/30">
                <h3 className="text-sm font-semibold text-brand-danger mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {t('secDangerZone')}
                </h3>
                <p className="text-sm text-brand-text-secondary mb-4">
                    {t('secDangerDesc')}
                </p>
                <button className="btn-danger !py-2 !px-4 text-sm">{t('secDeleteAccount')}</button>
            </div>

            {toast && <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 animate-slide-up"><span className="text-sm text-brand-text-primary font-medium">{toast}</span></div>}
        </div>
    );
}
