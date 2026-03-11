'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Store, CreditCard, Bell, Save, Upload, CheckCircle2, Loader2 } from 'lucide-react';
import { VIETNAMESE_BANKS } from '@/lib/banks';

export default function SellerSettingsPage() {
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');

    const [shopName, setShopName] = useState('AI Resource Center');
    const [shopDesc, setShopDesc] = useState('Chuyên cung cấp tài khoản AI premium, phần mềm bản quyền và tài nguyên số chất lượng cao.');
    const [email, setEmail] = useState('contact@airesource.vn');
    const [phone, setPhone] = useState('0901 234 567');
    const [bankName, setBankName] = useState('Vietcombank');
    const [bankAccount, setBankAccount] = useState('1234567890');
    const [bankOwner, setBankOwner] = useState('NGUYEN VAN A');
    const [bankBranch, setBankBranch] = useState('TP.HCM');
    const [notifications, setNotifications] = useState([
        { key: 'orders', label: 'Thông báo đơn hàng mới', desc: 'Nhận thông báo khi có đơn hàng mới', on: true },
        { key: 'complaints', label: 'Thông báo khiếu nại', desc: 'Nhận thông báo khi có khiếu nại từ khách', on: true },
        { key: 'stock', label: 'Thông báo tồn kho', desc: 'Cảnh báo khi sản phẩm sắp hết hàng', on: true },
        { key: 'weekly', label: 'Email hàng tuần', desc: 'Báo cáo doanh thu tuần qua email', on: false },
    ]);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const toggleNotification = (key: string) => {
        setNotifications(prev => prev.map(n => n.key === key ? { ...n, on: !n.on } : n));
    };

    const handleSave = async () => {
        setSaving(true);
        await new Promise(r => setTimeout(r, 1200));
        setSaving(false);
        showToast('✅ Đã lưu cài đặt thành công');
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Cài đặt shop</h1>
                <p className="text-sm text-brand-text-muted">Quản lý thông tin shop, cài đặt thanh toán và thông báo.</p>
            </div>

            {/* Shop Info */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5 flex items-center gap-2">
                    <Store className="w-4 h-4 text-brand-primary" /> Thông tin shop
                </h3>
                <div className="space-y-5">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 border border-brand-border flex items-center justify-center relative">
                            <Store className="w-8 h-8 text-brand-primary" />
                            <button className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-brand-primary flex items-center justify-center text-white hover:bg-brand-primary/90 transition-all">
                                <Upload className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-brand-text-primary mb-2">Tên shop</label>
                            <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} className="input-field" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Mô tả shop</label>
                        <textarea rows={3} value={shopDesc} onChange={e => setShopDesc(e.target.value)} className="input-field resize-none" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-text-primary mb-2">Email liên hệ</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-text-primary mb-2">Số điện thoại</label>
                            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="input-field" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Settings */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-brand-primary" /> Thông tin thanh toán
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Ngân hàng</label>
                        <select value={bankName} onChange={e => setBankName(e.target.value)} className="input-field">
                            {VIETNAMESE_BANKS.map(b => (
                                <option key={b.code} value={b.name}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Số tài khoản</label>
                        <input type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)} className="input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Tên chủ tài khoản</label>
                        <input type="text" value={bankOwner} onChange={e => setBankOwner(e.target.value)} className="input-field" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-text-primary mb-2">Chi nhánh</label>
                        <input type="text" value={bankBranch} onChange={e => setBankBranch(e.target.value)} className="input-field" />
                    </div>
                </div>
            </div>

            {/* Notification Settings */}
            <div className="card">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-5 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-brand-primary" /> Cài đặt thông báo
                </h3>
                <div className="space-y-4">
                    {notifications.map(item => (
                        <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-brand-surface-2/50">
                            <div>
                                <div className="text-sm font-medium text-brand-text-primary">{item.label}</div>
                                <div className="text-xs text-brand-text-muted">{item.desc}</div>
                            </div>
                            <button onClick={() => toggleNotification(item.key)} className={`w-11 h-6 rounded-full transition-all ${item.on ? 'bg-brand-primary' : 'bg-brand-surface-3'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full mt-0.5 transition-all shadow ${item.on ? 'ml-[22px]' : 'ml-0.5'}`} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Save */}
            <div className="flex justify-end">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-70">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
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
