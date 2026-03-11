'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Wallet, Plus, AlertCircle, X, CheckCircle2, BanknoteIcon } from 'lucide-react';
import { VIETNAMESE_BANKS } from '@/lib/banks';

const initialWithdrawals: { id: string; amount: number; method: string; status: string; createdAt: string }[] = [];

export default function WithdrawalPage() {
    const { user } = useAuth();
    const [withdrawals, setWithdrawals] = useState(initialWithdrawals);
    const [showModal, setShowModal] = useState(false);
    const [amount, setAmount] = useState('');
    const [bank, setBank] = useState('Vietcombank');
    const [accountNum, setAccountNum] = useState('');
    const [accountName, setAccountName] = useState('');
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
    const balance = user?.walletBalance || 0;
    const pendingAmount = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0);
    const totalWithdrawn = withdrawals.filter(w => w.status === 'completed').reduce((s, w) => s + w.amount, 0);

    const handleWithdraw = () => {
        if (!amount || Number(amount) < 500000) { showToast('⚠️ Số tiền rút tối thiểu 500.000đ'); return; }
        if (Number(amount) > balance) { showToast('⚠️ Số dư không đủ'); return; }
        if (!accountNum || !accountName) { showToast('⚠️ Vui lòng nhập đầy đủ thông tin'); return; }

        const newWithdraw = {
            id: `RT-${String(withdrawals.length + 1).padStart(3, '0')}`,
            amount: Number(amount),
            method: `${bank} ****${accountNum.slice(-4)}`,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };
        setWithdrawals([newWithdraw, ...withdrawals]);
        setShowModal(false);
        setAmount('');
        setAccountNum('');
        setAccountName('');
        showToast('✅ Đã tạo yêu cầu rút tiền thành công');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Rút tiền</h1>
                    <p className="text-sm text-brand-text-muted">Yêu cầu rút tiền về ngân hàng hoặc ví điện tử.</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 !py-2 text-sm">
                    <Plus className="w-4 h-4" /> Tạo yêu cầu rút
                </button>
            </div>

            <div className="bg-gradient-to-r from-brand-primary to-brand-secondary rounded-3xl p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                        <div className="text-sm text-white/70 mb-1">Số dư khả dụng</div>
                        <div className="text-2xl font-bold">{formatCurrency(balance)}</div>
                    </div>
                    <div>
                        <div className="text-sm text-white/70 mb-1">Đang chờ rút</div>
                        <div className="text-2xl font-bold">{formatCurrency(pendingAmount)}</div>
                    </div>
                    <div>
                        <div className="text-sm text-white/70 mb-1">Tổng đã rút</div>
                        <div className="text-2xl font-bold">{formatCurrency(totalWithdrawn)}</div>
                    </div>
                </div>
            </div>

            <div className="card bg-brand-warning/5 border-brand-warning/20">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-brand-warning shrink-0 mt-0.5" />
                    <div className="text-xs text-brand-text-secondary space-y-0.5">
                        <p>• Xử lý trong 1-3 ngày làm việc. Rút tối thiểu 500.000đ. Phí: 15.000đ/lần.</p>
                    </div>
                </div>
            </div>

            <div className="card !p-0 overflow-hidden">
                <div className="p-4 border-b border-brand-border"><h3 className="text-sm font-semibold text-brand-text-primary">Lịch sử rút tiền</h3></div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-brand-surface-2/50">
                            <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Mã</th>
                            <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Số tiền</th>
                            <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Phương thức</th>
                            <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                            <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Thời gian</th>
                        </tr>
                    </thead>
                    <tbody>
                        {withdrawals.map(w => (
                            <tr key={w.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30">
                                <td className="py-3 px-4 text-brand-primary font-medium text-xs">{w.id}</td>
                                <td className="py-3 px-4 text-right font-semibold text-brand-text-primary">{formatCurrency(w.amount)}</td>
                                <td className="py-3 px-4 text-xs text-brand-text-secondary">{w.method}</td>
                                <td className="py-3 px-4 text-center">
                                    <span className={`badge text-[10px] ${w.status === 'completed' ? 'badge-success' : w.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                                        {w.status === 'completed' ? 'Hoàn tất' : w.status === 'pending' ? 'Đang chờ' : 'Từ chối'}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-right text-brand-text-muted text-xs">{formatDateTime(w.createdAt)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Withdrawal Request Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6 animate-slide-up">
                        <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5 text-brand-text-muted" /></button>
                        <h2 className="text-lg font-bold text-brand-text-primary mb-1">💰 Tạo yêu cầu rút tiền</h2>
                        <p className="text-sm text-brand-text-muted mb-5">Số dư: <span className="text-brand-primary font-semibold">{formatCurrency(balance)}</span></p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-1.5">Số tiền rút *</label>
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input-field" placeholder="Tối thiểu 100,000" />
                                <div className="flex gap-2 mt-2">
                                    {[500000, 1000000, 2000000, 5000000].map(v => (
                                        <button key={v} onClick={() => setAmount(String(v))} className="text-[10px] px-2 py-1 rounded-lg bg-brand-surface-2 text-brand-text-secondary hover:bg-brand-primary/10 hover:text-brand-primary transition-all">
                                            {formatCurrency(v)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-1.5">Ngân hàng *</label>
                                <select value={bank} onChange={e => setBank(e.target.value)} className="input-field">
                                    {VIETNAMESE_BANKS.map(b => (
                                        <option key={b.code} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-1.5">Số tài khoản *</label>
                                <input type="text" value={accountNum} onChange={e => setAccountNum(e.target.value)} className="input-field" placeholder="1234567890" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-brand-text-primary mb-1.5">Tên chủ tài khoản *</label>
                                <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} className="input-field" placeholder="NGUYEN VAN A" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 !py-3">Hủy</button>
                            <button onClick={handleWithdraw} className="btn-primary flex-1 !py-3 flex items-center justify-center gap-2">
                                <BanknoteIcon className="w-4 h-4" /> Xác nhận rút
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
