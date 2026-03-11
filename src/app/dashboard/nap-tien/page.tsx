'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { X, CheckCircle2, Clock, Copy, Loader2, AlertTriangle, ArrowRight, Wallet, RefreshCw } from 'lucide-react';

const DEPOSIT_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];
const CHECK_INTERVAL_MS = 5000; // 5s like shop-mmo
const MAX_CHECKS = 120; // 120 checks = 10 minutes

const BANK_INFO = {
    bankId: 'MB',
    bankName: 'MB Bank',
    accountNo: '0393959643',
    accountName: 'NGUYEN TAI DAT',
    logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/02/Logo-MB-Bank-MBB.png',
};

export default function DepositPage() {
    const { user, updateUser } = useAuth();
    const [amount, setAmount] = useState('');
    const [invoiceData, setInvoiceData] = useState<any>(null);
    const [invoiceStatus, setInvoiceStatus] = useState<'PENDING' | 'PAID' | 'CANCELLED'>('PENDING');
    const [isChecking, setIsChecking] = useState(false);
    const [checkMessage, setCheckMessage] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    const [copied, setCopied] = useState('');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const checkCountRef = useRef(0);
    const statusRef = useRef<string>('PENDING');

    useEffect(() => { statusRef.current = invoiceStatus; }, [invoiceStatus]);

    // Load bank settings
    useEffect(() => {
        fetch('/api/v1/admin/settings')
            .then(r => r.json())
            .then(d => {
                if (d.success && d.data?.settings) {
                    const s = d.data.settings;
                    if (s.bankAccount) BANK_INFO.accountNo = s.bankAccount;
                    if (s.bankOwner) BANK_INFO.accountName = s.bankOwner;
                }
            })
            .catch(() => {});
    }, []);

    const getQRCodeUrl = () => {
        if (!invoiceData) return '';
        const params = new URLSearchParams({
            amount: invoiceData.amount.toString(),
            addInfo: invoiceData.content,
            accountName: BANK_INFO.accountName,
        });
        return `https://img.vietqr.io/image/${BANK_INFO.bankId}-${BANK_INFO.accountNo}-compact.png?${params.toString()}`;
    };

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(''), 2000);
    };

    // Create invoice
    const handleCreateInvoice = () => {
        if (!amount || parseInt(amount) < 10000) return;

        const invoiceCode = `INV${Date.now()}`;
        const invoiceContent = `NAPTIEN ${invoiceCode}`;

        setInvoiceData({
            code: invoiceCode,
            amount: parseInt(amount),
            content: invoiceContent,
        });
        setInvoiceStatus('PENDING');
        setCheckMessage('');
        checkCountRef.current = 0;
    };

    // Auto-check when invoice is created — EXACT shop-mmo logic
    useEffect(() => {
        if (!invoiceData || invoiceStatus === 'PAID' || invoiceStatus === 'CANCELLED') {
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            return;
        }

        const checkStatus = async () => {
            if (statusRef.current === 'PAID' || statusRef.current === 'CANCELLED') return;

            checkCountRef.current++;
            setIsChecking(true);
            setCheckMessage(`Chưa phát hiện thanh toán... (${checkCountRef.current}/${MAX_CHECKS})`);

            try {
                console.log(`[Deposit] Đang check MB Bank: amount=${invoiceData.amount}, content="${invoiceData.content}"`);
                const res = await fetch('/api/payment/mbbank/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: invoiceData.content,
                        amount: invoiceData.amount,
                        depositCode: invoiceData.content,
                    }),
                    cache: 'no-store',
                });
                const data = await res.json();
                console.log(`[Deposit] MB Bank check response:`, data);

                if ((data.success && data.paid) || data.status === 'found') {
                    // PAYMENT FOUND!
                    setIsChecking(false);
                    setCheckMessage('✅ Đã phát hiện thanh toán!');
                    setInvoiceStatus('PAID');
                    statusRef.current = 'PAID';

                    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

                    // Update local balance
                    if (user) {
                        updateUser({ walletBalance: (user.walletBalance || 0) + invoiceData.amount });
                    }

                    // Try crediting wallet in DB too
                    try {
                        const token = localStorage.getItem('token') || '';
                        await fetch('/api/v1/wallet/deposits/check', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ depositCode: invoiceData.content, amount: invoiceData.amount }),
                        });
                    } catch {}

                    return;
                }
            } catch (error) {
                console.error('[Deposit] Error checking status:', error);
                setCheckMessage('❌ Lỗi khi kiểm tra. Đang thử lại...');
            }

            setIsChecking(false);

            // Stop after max checks
            if (checkCountRef.current >= MAX_CHECKS) {
                setCheckMessage('⏱️ Đã kiểm tra 10 phút. Vui lòng liên hệ hỗ trợ nếu đã chuyển khoản.');
                if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            }
        };

        // Check immediately
        checkStatus();
        // Then every 5s
        intervalRef.current = setInterval(checkStatus, CHECK_INTERVAL_MS);

        return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
    }, [invoiceData, invoiceStatus]);

    const handleCancel = () => {
        setIsCancelling(true);
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        setInvoiceStatus('CANCELLED');
        statusRef.current = 'CANCELLED';
        setIsChecking(false);
        setCheckMessage('');
        setTimeout(() => {
            setInvoiceData(null);
            setInvoiceStatus('PENDING');
            statusRef.current = 'PENDING';
            setAmount('');
            setIsCancelling(false);
        }, 500);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Nạp tiền</h1>
                <p className="text-sm text-brand-text-muted">Chuyển khoản đến MBBank — hệ thống tự động xác nhận & cộng tiền vào ví.</p>
            </div>

            {/* Current Balance */}
            <div className="card !p-4 bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-primary/20 flex items-center justify-center"><Wallet className="w-5 h-5 text-brand-primary" /></div>
                    <div>
                        <div className="text-xs text-brand-text-muted">Số dư ví hiện tại</div>
                        <div className="text-xl font-bold text-brand-primary">{(user?.walletBalance || 0).toLocaleString('vi-VN')}đ</div>
                    </div>
                </div>
            </div>

            {/* SELECT AMOUNT — When no invoice */}
            {!invoiceData && (
                <div className="card space-y-5">
                    <h2 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">💳 Chọn số tiền nạp</h2>
                    <div className="grid grid-cols-3 gap-3">
                        {DEPOSIT_AMOUNTS.map(a => (
                            <button key={a} onClick={() => setAmount(a.toString())}
                                className={`py-3 rounded-xl text-sm font-semibold transition-all ${parseInt(amount) === a ? 'bg-brand-primary text-white shadow-md' : 'bg-brand-surface-2 text-brand-text-secondary hover:border-brand-primary border border-transparent'}`}>
                                {a.toLocaleString('vi-VN')}đ
                            </button>
                        ))}
                    </div>
                    <div>
                        <label className="text-xs text-brand-text-muted mb-1 block">Hoặc nhập số tiền tùy chỉnh:</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                            placeholder="VD: 300000" className="input-field w-full text-sm" min={10000} />
                    </div>
                    <button onClick={handleCreateInvoice} disabled={!amount || parseInt(amount) < 10000}
                        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
                        Tạo hóa đơn nạp tiền <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* INVOICE — Shop-mmo layout: Dark left + White right */}
            {invoiceData && (
                <div>
                    {/* Top actions */}
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={handleCancel} className="text-sm text-brand-text-muted hover:text-brand-primary flex items-center gap-1">
                            ← Tạo hóa đơn khác
                        </button>
                        {invoiceStatus === 'PENDING' && (
                            <button onClick={handleCancel} disabled={isCancelling}
                                className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1">
                                <X className="w-3.5 h-3.5" /> Hủy hóa đơn
                            </button>
                        )}
                    </div>

                    <div className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-gray-200 min-h-[500px]">
                        {/* LEFT: Dark panel with bank info */}
                        <div className="w-full md:w-2/5 bg-[#1a1a1a] text-white p-8 flex flex-col justify-between relative">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

                            <div className="relative z-10 space-y-6">
                                {/* Header */}
                                <div className="border border-cyan-500/30 bg-cyan-900/10 p-4 rounded text-center">
                                    <h2 className="text-lg font-bold text-cyan-400 uppercase tracking-wider">CHỢ TÀI NGUYÊN</h2>
                                    <p className="text-[10px] text-gray-400 tracking-[0.3em] uppercase mt-1">HÓA ĐƠN NẠP TIỀN</p>
                                </div>

                                {/* Bank info */}
                                <div className="space-y-5 text-sm">
                                    <div>
                                        <p className="text-gray-500 text-xs mb-1 uppercase font-bold">🏦 NGÂN HÀNG</p>
                                        <div className="flex items-center gap-3">
                                            <img src={BANK_INFO.logo} className="h-8 w-8 rounded-full bg-white p-0.5" alt="MB" />
                                            <p className="font-bold text-xl text-white">MB Bank</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-gray-500 text-xs mb-1 uppercase font-bold flex items-center gap-2">
                                            💳 SỐ TÀI KHOẢN
                                            <button onClick={() => copyToClipboard(BANK_INFO.accountNo, 'stk')} className="text-cyan-500 hover:text-white transition">
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </p>
                                        <p className="font-mono font-bold text-green-400 text-2xl tracking-wider">{BANK_INFO.accountNo}</p>
                                    </div>

                                    <div>
                                        <p className="text-gray-500 text-xs mb-1 uppercase font-bold">👤 CHỦ TÀI KHOẢN</p>
                                        <p className="font-bold text-lg uppercase">{BANK_INFO.accountName}</p>
                                    </div>

                                    <div className="border-t border-gray-700 pt-4">
                                        <p className="text-gray-500 text-xs mb-1 uppercase font-bold">💰 SỐ TIỀN NẠP</p>
                                        <p className="font-bold text-3xl text-cyan-400">{invoiceData.amount.toLocaleString()} <span className="text-sm text-gray-400">VNĐ</span></p>
                                    </div>

                                    <div>
                                        <p className="text-gray-500 text-xs mb-2 uppercase font-bold flex items-center gap-2">
                                            📝 NỘI DUNG CHUYỂN KHOẢN (BẮT BUỘC)
                                            <button onClick={() => copyToClipboard(invoiceData.content, 'content')} className="text-cyan-500 hover:text-white transition">
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        </p>
                                        <div className="bg-yellow-900/20 text-yellow-400 border border-yellow-600/30 p-3 rounded font-mono font-bold text-center text-lg tracking-wide border-dashed break-all">
                                            {invoiceData.content}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Status */}
                            <div className="pt-6 mt-4 border-t border-gray-800 flex flex-col items-center justify-center gap-2">
                                {invoiceStatus === 'PAID' ? (
                                    <div className="flex items-center gap-2 text-green-400 font-bold animate-pulse text-lg bg-green-900/20 px-4 py-2 rounded-full border border-green-500/30 w-full justify-center">
                                        <CheckCircle2 className="w-6 h-6" /> NẠP TIỀN THÀNH CÔNG
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 text-orange-400 text-xs font-bold bg-orange-900/10 px-4 py-2 rounded-full border border-orange-500/20 w-full justify-center">
                                            {isChecking ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Đang kiểm tra thanh toán...</>
                                            ) : (
                                                <><Clock className="w-4 h-4" /> Đang chờ thanh toán...</>
                                            )}
                                        </div>
                                        {checkMessage && (
                                            <p className="text-xs text-gray-400 text-center">{checkMessage}</p>
                                        )}
                                        <button onClick={handleCancel} disabled={isCancelling}
                                            className="mt-2 w-full px-4 py-2 bg-red-900/20 hover:bg-red-900/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2">
                                            <X className="w-4 h-4" /> Hủy thanh toán
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: White panel with QR */}
                        <div className="w-full md:w-3/5 bg-white p-8 flex flex-col items-center justify-center">
                            {invoiceStatus === 'PAID' ? (
                                <div className="text-center space-y-4">
                                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                                    </div>
                                    <h3 className="text-2xl font-black text-green-600">Nạp tiền thành công!</h3>
                                    <p className="text-gray-500">Số tiền <strong className="text-green-600">{invoiceData.amount.toLocaleString()}đ</strong> đã được cộng vào ví</p>
                                    <div className="flex gap-3 mt-4">
                                        <button onClick={handleCancel} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold text-gray-700">Nạp thêm</button>
                                        <button onClick={() => window.location.href = '/dashboard'} className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold">Về Dashboard</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="text-center mb-6">
                                        <h3 className="text-2xl font-black text-blue-600 mb-2 uppercase tracking-tight">QUÉT MÃ QR</h3>
                                        <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
                                            <span className="flex items-center gap-1">📱 App Ngân hàng</span>
                                            <span>·</span>
                                            <span className="flex items-center gap-1">📷 Camera hỗ trợ QR</span>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-2xl p-6 inline-block border-2 border-gray-200">
                                        <img
                                            src={getQRCodeUrl()}
                                            alt="QR Code"
                                            className="w-64 h-64 mx-auto"
                                        />
                                    </div>

                                    <div className="mt-6 flex items-center gap-4 opacity-80">
                                        <span className="font-bold text-gray-500 text-sm">napas247</span>
                                        <span className="text-gray-300">|</span>
                                        <div className="flex items-center gap-2">
                                            <img src={BANK_INFO.logo} className="h-6 w-6 rounded bg-white" alt="MB" />
                                            <span className="font-bold text-gray-700">MB</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 bg-orange-50 border border-orange-200 rounded-xl p-3 max-w-sm">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                                            <p className="text-xs text-orange-700">
                                                <strong>Quan trọng:</strong> Nhập đúng nội dung chuyển khoản <strong className="text-blue-600">{invoiceData.content}</strong> để hệ thống tự động xác nhận.
                                            </p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
