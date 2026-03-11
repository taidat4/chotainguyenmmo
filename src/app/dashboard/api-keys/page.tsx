'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Key, Plus, Copy, CheckCircle2, Trash2, Eye, EyeOff, RefreshCw, Shield, AlertTriangle, ExternalLink, FileSpreadsheet, ToggleLeft, ToggleRight, Code2, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface ApiKeyData {
    id: string;
    key: string;
    label: string;
    type: 'SELLER' | 'CUSTOMER';
    permissions: string[];
    isActive: boolean;
    createdAt: string;
    lastUsed?: string;
    usageCount: number;
    rateLimit: number;
    googleSheetUrl?: string;
    googleSheetSyncEnabled?: boolean;
}

interface PermOption {
    id: string;
    label: string;
    description: string;
}

export default function ApiKeysPage() {
    const { user } = useAuth();
    const [keys, setKeys] = useState<ApiKeyData[]>([]);
    const [perms, setPerms] = useState<{ CUSTOMER: PermOption[]; SELLER: PermOption[] }>({ CUSTOMER: [], SELLER: [] });
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [newKey, setNewKey] = useState<string | null>(null);
    const [copied, setCopied] = useState('');
    const [toast, setToast] = useState('');

    // Create form
    const [label, setLabel] = useState('');
    const [keyType, setKeyType] = useState<'CUSTOMER' | 'SELLER'>('CUSTOMER');
    const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
    const [googleSheetUrl, setGoogleSheetUrl] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

    const copy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(''), 2000);
    };

    useEffect(() => { loadKeys(); }, []);

    const loadKeys = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/api-keys', {
                headers: { 'x-user-id': user?.id || '', 'x-username': user?.username || '' },
            });
            const data = await res.json();
            if (data.success) {
                setKeys(data.data);
                setPerms(data.permissionOptions);
            }
        } catch { }
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!label.trim()) { showToast('❌ Vui lòng nhập tên cho API Key'); return; }
        setCreating(true);
        try {
            const res = await fetch('/api/v1/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user?.id,
                    username: user?.username,
                    label,
                    type: keyType,
                    permissions: selectedPerms.length > 0 ? selectedPerms : undefined,
                    googleSheetUrl: googleSheetUrl || undefined,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setNewKey(data.data.key);
                setShowCreate(false);
                setLabel('');
                setGoogleSheetUrl('');
                setSelectedPerms([]);
                loadKeys();
                showToast('✅ API Key đã tạo thành công!');
            }
        } catch { showToast('❌ Lỗi tạo API Key'); }
        setCreating(false);
    };

    const handleRevoke = async (keyId: string) => {
        if (!confirm('Bạn có chắc muốn thu hồi API Key này? Thao tác không thể hoàn tác.')) return;
        try {
            const res = await fetch(`/api/v1/api-keys?id=${keyId}&userId=${user?.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                loadKeys();
                showToast('✅ Đã thu hồi API Key');
            }
        } catch { showToast('❌ Lỗi thu hồi API Key'); }
    };

    const availablePerms = keyType === 'SELLER' ? perms.SELLER : perms.CUSTOMER;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">API Keys</h1>
                    <p className="text-sm text-brand-text-muted">Tạo và quản lý API Key để mua hàng tự động hoặc tích hợp vào bot/app của bạn.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/api-docs" className="btn-secondary !py-2 text-sm flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" /> API Docs
                    </Link>
                    <button onClick={() => setShowCreate(true)} className="btn-primary !py-2 text-sm flex items-center gap-1.5">
                        <Plus className="w-4 h-4" /> Tạo API Key
                    </button>
                </div>
            </div>

            {/* Newly created key — show ONCE */}
            {newKey && (
                <div className="bg-brand-success/10 border-2 border-brand-success/40 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2 text-brand-success font-semibold text-sm">
                        <CheckCircle2 className="w-5 h-5" /> API Key đã được tạo!
                    </div>
                    <div className="bg-brand-surface rounded-lg p-3 font-mono text-sm break-all text-brand-text-primary flex items-center gap-2">
                        <code className="flex-1">{newKey}</code>
                        <button onClick={() => copy(newKey, 'newkey')} className="shrink-0 p-1.5 rounded hover:bg-brand-surface-2">
                            {copied === 'newkey' ? <CheckCircle2 className="w-4 h-4 text-brand-success" /> : <Copy className="w-4 h-4 text-brand-text-muted" />}
                        </button>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-brand-warning">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span><strong>Lưu key này ngay!</strong> Bạn sẽ không thể xem lại key đầy đủ sau khi đóng thông báo này.</span>
                    </div>
                    <button onClick={() => setNewKey(null)} className="text-xs text-brand-text-muted hover:text-brand-text-primary">Đã lưu, đóng thông báo</button>
                </div>
            )}

            {/* Create Form Modal */}
            {showCreate && (
                <div className="card space-y-4 border-2 border-brand-primary/20">
                    <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                        <Key className="w-4 h-4 text-brand-primary" /> Tạo API Key mới
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-brand-text-muted mb-1 block">Tên API Key *</label>
                            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="VD: My Bot, Telegram Bot" className="input-field w-full text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-brand-text-muted mb-1 block">Loại</label>
                            <div className="flex gap-2">
                                {(['CUSTOMER', 'SELLER'] as const).map(t => (
                                    <button key={t} onClick={() => { setKeyType(t); setSelectedPerms([]); }}
                                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${keyType === t ? 'bg-brand-primary text-white' : 'bg-brand-surface-2 text-brand-text-secondary'}`}>
                                        {t === 'CUSTOMER' ? '🛒 Khách hàng' : '🏪 Seller'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Permissions */}
                    <div>
                        <label className="text-xs text-brand-text-muted mb-2 block">Quyền hạn</label>
                        <div className="grid sm:grid-cols-2 gap-2">
                            {availablePerms.map(p => (
                                <label key={p.id} className="flex items-start gap-2 p-2.5 rounded-xl bg-brand-surface-2 hover:bg-brand-surface-3 cursor-pointer transition-all">
                                    <input type="checkbox" checked={selectedPerms.includes(p.id)}
                                        onChange={e => setSelectedPerms(prev => e.target.checked ? [...prev, p.id] : prev.filter(x => x !== p.id))}
                                        className="mt-0.5 accent-brand-primary" />
                                    <div>
                                        <div className="text-xs font-medium text-brand-text-primary">{p.label}</div>
                                        <div className="text-[10px] text-brand-text-muted">{p.description}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <p className="text-[10px] text-brand-text-muted mt-1">Để trống = chọn tất cả quyền</p>
                    </div>

                    {/* Google Sheets (Seller only) */}
                    {keyType === 'SELLER' && (
                        <div className="bg-brand-info/5 border border-brand-info/20 rounded-xl p-4 space-y-2">
                            <label className="text-xs font-medium text-brand-info flex items-center gap-1.5">
                                <FileSpreadsheet className="w-3.5 h-3.5" /> Google Sheets Sync (tùy chọn)
                            </label>
                            <input value={googleSheetUrl} onChange={e => setGoogleSheetUrl(e.target.value)}
                                placeholder="https://docs.google.com/spreadsheets/d/..." className="input-field w-full text-sm" />
                            <p className="text-[10px] text-brand-text-muted">
                                Dán link Google Sheet → Share sheet cho <code className="text-brand-primary">service@chotainguyen.iam.gserviceaccount.com</code> → Hệ thống tự sync stock mỗi 5 phút.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm flex-1">Hủy</button>
                        <button onClick={handleCreate} disabled={creating} className="btn-primary text-sm flex-1 disabled:opacity-50">
                            {creating ? 'Đang tạo...' : 'Tạo API Key'}
                        </button>
                    </div>
                </div>
            )}

            {/* Existing Keys */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full" />
                </div>
            ) : keys.length === 0 ? (
                <div className="card text-center py-12 space-y-3">
                    <Key className="w-12 h-12 text-brand-text-muted mx-auto" />
                    <p className="text-sm text-brand-text-muted">Bạn chưa có API Key nào.</p>
                    <button onClick={() => setShowCreate(true)} className="btn-primary text-sm inline-flex items-center gap-1.5">
                        <Plus className="w-4 h-4" /> Tạo API Key đầu tiên
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {keys.map(k => (
                        <div key={k.id} className={`card !p-4 transition-all ${!k.isActive ? 'opacity-50' : ''}`}>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.type === 'SELLER' ? 'bg-brand-warning/10' : 'bg-brand-primary/10'}`}>
                                        <Key className={`w-5 h-5 ${k.type === 'SELLER' ? 'text-brand-warning' : 'text-brand-primary'}`} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                                            {k.label}
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${k.type === 'SELLER' ? 'bg-brand-warning/10 text-brand-warning' : 'bg-brand-primary/10 text-brand-primary'}`}>
                                                {k.type === 'SELLER' ? 'Seller' : 'Customer'}
                                            </span>
                                            {!k.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-danger/10 text-brand-danger">Đã thu hồi</span>}
                                        </div>
                                        <div className="text-xs text-brand-text-muted font-mono truncate">{k.key}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-right hidden sm:block">
                                        <div className="text-xs text-brand-text-muted">{k.usageCount} lần sử dụng</div>
                                        <div className="text-[10px] text-brand-text-muted">{k.lastUsed ? `Dùng lần cuối: ${new Date(k.lastUsed).toLocaleDateString('vi-VN')}` : 'Chưa dùng'}</div>
                                    </div>
                                    {k.isActive && (
                                        <button onClick={() => handleRevoke(k.id)} className="p-2 rounded-lg text-brand-danger hover:bg-brand-danger/10 transition-colors" title="Thu hồi">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            {/* Permissions tags */}
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {k.permissions.map(p => (
                                    <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-surface-2 text-brand-text-muted font-medium">{p}</span>
                                ))}
                            </div>
                            {k.googleSheetUrl && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-brand-info">
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    <span className="truncate">{k.googleSheetUrl}</span>
                                    {k.googleSheetSyncEnabled ? <span className="text-brand-success">● Đang sync</span> : <span className="text-brand-text-muted">○ Tắt</span>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Quick Start Guide */}
            <div className="card space-y-4">
                <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-brand-primary" /> Bắt đầu nhanh
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-brand-surface-2 rounded-xl p-3 space-y-2">
                        <div className="text-xs font-medium text-brand-text-primary">🔍 Xem sản phẩm</div>
                        <div className="bg-brand-bg rounded-lg p-2 font-mono text-[11px] text-brand-text-secondary break-all">
                            curl -H &quot;x-api-key: YOUR_KEY&quot; \<br />
                            {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/public/products
                        </div>
                    </div>
                    <div className="bg-brand-surface-2 rounded-xl p-3 space-y-2">
                        <div className="text-xs font-medium text-brand-text-primary">🛒 Mua hàng</div>
                        <div className="bg-brand-bg rounded-lg p-2 font-mono text-[11px] text-brand-text-secondary break-all">
                            curl -H &quot;x-api-key: YOUR_KEY&quot; \<br />
                            -X POST -d &#123;&quot;productId&quot;:&quot;prod-1&quot;&#125; \<br />
                            {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/public/purchase
                        </div>
                    </div>
                    <div className="bg-brand-surface-2 rounded-xl p-3 space-y-2">
                        <div className="text-xs font-medium text-brand-text-primary">💰 Xem số dư</div>
                        <div className="bg-brand-bg rounded-lg p-2 font-mono text-[11px] text-brand-text-secondary break-all">
                            curl -H &quot;x-api-key: YOUR_KEY&quot; \<br />
                            {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/public/orders?type=balance
                        </div>
                    </div>
                    <div className="bg-brand-surface-2 rounded-xl p-3 space-y-2">
                        <div className="text-xs font-medium text-brand-text-primary">📦 Xem đơn hàng</div>
                        <div className="bg-brand-bg rounded-lg p-2 font-mono text-[11px] text-brand-text-secondary break-all">
                            curl -H &quot;x-api-key: YOUR_KEY&quot; \<br />
                            {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/public/orders
                        </div>
                    </div>
                </div>
            </div>

            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 flex items-center gap-2 animate-slide-up">
                    <span className="text-sm text-brand-text-primary font-medium">{toast}</span>
                </div>
            )}
        </div>
    );
}
