'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Lock, Shield, Smartphone, Key, AlertTriangle, CheckCircle, Copy, X, Loader2, Eye, EyeOff } from 'lucide-react';

export default function SecurityPage() {
    const { user } = useAuth();
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
        // Check 2FA status
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
        } catch { showToast('❌ Lỗi kết nối'); }
        setLoading(false);
    };

    const handleVerify2FA = async () => {
        if (otpCode.length !== 6) { showToast('❌ Mã OTP phải 6 chữ số'); return; }
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
                showToast('✅ Đã bật 2FA thành công!');
            } else showToast('❌ ' + data.message);
        } catch { showToast('❌ Lỗi kết nối'); }
        setLoading(false);
    };

    const handleDisable2FA = async () => {
        if (disableCode.length !== 6) { showToast('❌ Nhập mã OTP 6 số'); return; }
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
                showToast('✅ Đã tắt 2FA');
            } else showToast('❌ ' + data.message);
        } catch { showToast('❌ Lỗi kết nối'); }
        setLoading(false);
    };

    const handleChangePassword = async () => {
        if (!passwords.current || !passwords.new) { showToast('❌ Vui lòng nhập đầy đủ'); return; }
        if (passwords.new.length < 8) { showToast('❌ Mật khẩu mới tối thiểu 8 ký tự'); return; }
        if (passwords.new !== passwords.confirm) { showToast('❌ Mật khẩu xác nhận không khớp'); return; }
        setPwLoading(true);
        try {
            const res = await fetch('/api/v1/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('✅ Đã đổi mật khẩu!');
                setPasswords({ current: '', new: '', confirm: '' });
            } else showToast('❌ ' + data.message);
        } catch { showToast('❌ Lỗi'); }
        setPwLoading(false);
    };

    const copyText = (text: string) => { navigator.clipboard.writeText(text); showToast('📋 Đã copy!'); };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Bảo mật tài khoản</h1>
                <p className="text-sm text-brand-text-muted">Thay đổi mật khẩu, thiết lập xác thực hai lớp và quản lý phiên đăng nhập.</p>
            </div>

            {/* Security Status */}
            <div className={`card ${twoFAEnabled ? 'bg-gradient-to-r from-brand-success/5 to-brand-success/0 border-brand-success/20' : 'bg-gradient-to-r from-brand-warning/5 to-brand-warning/0 border-brand-warning/20'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${twoFAEnabled ? 'bg-brand-success/20' : 'bg-brand-warning/20'}`}>
                        <Shield className={`w-5 h-5 ${twoFAEnabled ? 'text-brand-success' : 'text-brand-warning'}`} />
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-brand-text-primary">Mức độ bảo mật: {twoFAEnabled ? '🛡️ Rất tốt' : '⚠️ Trung bình'}</div>
                        <div className="text-xs text-brand-text-muted">{twoFAEnabled ? '2FA đã bật — tài khoản được bảo vệ tối đa' : 'Bật xác thực 2 lớp để tăng bảo mật cho tài khoản'}</div>
                    </div>
                </div>
            </div>

            {/* Change Password */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-brand-primary" /> Đổi mật khẩu
                </h3>
                <div className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Mật khẩu hiện tại</label>
                        <div className="relative">
                            <Key className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="password" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} placeholder="Nhập mật khẩu hiện tại" className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Mật khẩu mới</label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="password" value={passwords.new} onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))} placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)" className="input-field !pl-11" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Xác nhận mật khẩu mới</label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-brand-text-muted absolute left-4 top-1/2 -translate-y-1/2" />
                            <input type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} placeholder="Nhập lại mật khẩu mới" className="input-field !pl-11" />
                        </div>
                    </div>
                    <button onClick={handleChangePassword} disabled={pwLoading} className="btn-primary disabled:opacity-50">
                        {pwLoading ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
                    </button>
                </div>
            </div>

            {/* Two-Factor Auth */}
            <div className="card">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-brand-primary" /> Xác thực hai lớp (2FA)
                    </h3>
                    <span className={twoFAEnabled ? 'badge-success' : 'badge-warning'}>{twoFAEnabled ? '✅ Đã bật' : 'Chưa bật'}</span>
                </div>

                {!twoFAEnabled && !setupMode && (
                    <>
                        <p className="text-sm text-brand-text-secondary mb-4">
                            Thêm lớp bảo vệ cho tài khoản bằng cách yêu cầu mã xác thực từ ứng dụng (Google Authenticator, Authy) mỗi khi đăng nhập.
                        </p>
                        <button onClick={handleSetup2FA} disabled={loading} className="btn-primary disabled:opacity-50">
                            {loading ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Đang tạo...</> : 'Thiết lập 2FA'}
                        </button>
                    </>
                )}

                {/* Setup Mode: QR Code + Secret Key */}
                {setupMode && (
                    <div className="space-y-5">
                        <div className="bg-brand-surface-2 rounded-xl p-5">
                            <h4 className="text-sm font-semibold text-brand-text-primary mb-3">Bước 1: Quét mã QR</h4>
                            <p className="text-xs text-brand-text-muted mb-4">Mở app Google Authenticator hoặc Authy, chọn &quot;Quét mã QR&quot; và quét mã bên dưới.</p>
                            <div className="flex justify-center mb-4">
                                <div className="bg-white p-4 rounded-xl shadow-sm">
                                    {/* QR Code using Google Charts API */}
                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`} alt="QR Code 2FA" width={200} height={200} className="rounded-lg" />
                                </div>
                            </div>
                            <p className="text-xs text-brand-text-muted text-center mb-3">Hoặc nhập mã thủ công:</p>
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
                            <h4 className="text-sm font-semibold text-brand-text-primary mb-3">Bước 2: Nhập mã xác thực</h4>
                            <p className="text-xs text-brand-text-muted mb-4">Nhập mã 6 chữ số từ app để xác nhận thiết lập.</p>
                            <div className="flex gap-3 max-w-xs">
                                <input
                                    type="text" value={otpCode}
                                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    className="input-field text-center text-lg font-mono tracking-[0.5em] flex-1"
                                    maxLength={6}
                                />
                                <button onClick={handleVerify2FA} disabled={loading || otpCode.length !== 6} className="btn-primary !px-6 disabled:opacity-50">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xác nhận'}
                                </button>
                            </div>
                        </div>

                        <button onClick={() => { setSetupMode(false); setOtpCode(''); }} className="btn-secondary text-sm">
                            <X className="w-4 h-4 inline mr-1" /> Hủy
                        </button>
                    </div>
                )}

                {/* Disable 2FA */}
                {twoFAEnabled && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-brand-success">
                            <CheckCircle className="w-4 h-4" /> Xác thực 2 lớp đang được bật. Tài khoản của bạn được bảo vệ bổ sung.
                        </div>
                        <div className="border-t border-brand-border pt-4">
                            <p className="text-xs text-brand-text-muted mb-3">Để tắt 2FA, nhập mã OTP hiện tại từ app:</p>
                            <div className="flex gap-3 max-w-xs">
                                <input
                                    type="text" value={disableCode}
                                    onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    className="input-field text-center text-sm font-mono tracking-[0.3em] flex-1"
                                    maxLength={6}
                                />
                                <button onClick={handleDisable2FA} disabled={loading || disableCode.length !== 6} className="px-4 py-2 bg-brand-danger text-white text-sm rounded-xl hover:bg-brand-danger/90 disabled:opacity-50 transition-all">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tắt 2FA'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Active Sessions */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5">Phiên đăng nhập đang hoạt động</h3>
                <div className="space-y-3">
                    {[
                        { device: 'Chrome — Windows 10', location: 'TP.HCM, Việt Nam', time: 'Đang hoạt động', current: true },
                        { device: 'Safari — iPhone 15', location: 'TP.HCM, Việt Nam', time: '2 giờ trước', current: false },
                        { device: 'Firefox — macOS', location: 'Hà Nội, Việt Nam', time: '3 ngày trước', current: false },
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
                                <span className="text-xs text-brand-success font-medium">Hiện tại</span>
                            ) : (
                                <button className="text-xs text-brand-danger hover:underline">Thu hồi</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Danger Zone */}
            <div className="card border-brand-danger/30">
                <h3 className="text-sm font-semibold text-brand-danger mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Vùng nguy hiểm
                </h3>
                <p className="text-sm text-brand-text-secondary mb-4">
                    Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu của bạn. Hành động này không thể hoàn tác.
                </p>
                <button className="btn-danger !py-2 !px-4 text-sm">Xóa tài khoản</button>
            </div>

            {toast && <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 animate-slide-up"><span className="text-sm text-brand-text-primary font-medium">{toast}</span></div>}
        </div>
    );
}
