'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
    FileSpreadsheet, Plus, Trash2, CheckCircle2, Settings, RefreshCw,
    Link2, AlertTriangle, Package, ArrowRight, Eye, Save, Table2, Shield, HelpCircle
} from 'lucide-react';

interface TabMapping {
    productId: string;
    productName: string;
    sheetTabName: string;
    columnMapping: {
        dataColumn: string;
        statusColumn: string;
        startRow: number;
    };
}

interface StatusConfig {
    availableValues: string[];
    soldValue: string;
    doNotPullValues: string[];
}

interface SheetConfig {
    sellerId: string;
    googleSheetUrl: string;
    statusConfig: StatusConfig;
    tabMappings: TabMapping[];
    isActive: boolean;
    lastSyncAt?: string;
    lastSyncStatus?: string;
    lastSyncMessage?: string;
    syncIntervalMinutes: number;
    stockSummary?: { productId: string; productName: string; sheetTabName: string; total: number; available: number; sold: number; doNotPull: number }[];
}

// Demo products list (would come from API in production)
const demoProducts = [
    { id: 'prod-1', name: 'Netflix Premium 1 Tháng' },
    { id: 'prod-2', name: 'Spotify Premium 3 Tháng' },
    { id: 'prod-3', name: 'Canva Pro Lifetime' },
    { id: 'prod-4', name: 'ChatGPT Plus Key' },
];

export default function SellerSheetsPage() {
    const { user } = useAuth();
    const [config, setConfig] = useState<SheetConfig | null>(null);
    const [defaults, setDefaults] = useState<{ statusConfig: StatusConfig } | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');

    // Form state
    const [sheetUrl, setSheetUrl] = useState('');
    const [availableVals, setAvailableVals] = useState('');
    const [soldVal, setSoldVal] = useState('Đã bán');
    const [doNotPullVals, setDoNotPullVals] = useState('');
    const [syncInterval, setSyncInterval] = useState(5);

    // Add mapping form
    const [showAddMapping, setShowAddMapping] = useState(false);
    const [newProductId, setNewProductId] = useState('');
    const [newTabName, setNewTabName] = useState('');
    const [newDataCol, setNewDataCol] = useState('A:C');
    const [newStatusCol, setNewStatusCol] = useState('D');
    const [newStartRow, setNewStartRow] = useState(2);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

    useEffect(() => { loadConfig(); }, []);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/sheets?sellerId=${user?.id}`);
            const data = await res.json();
            if (data.success) {
                if (data.data) {
                    setConfig(data.data);
                    setSheetUrl(data.data.googleSheetUrl);
                    setAvailableVals(data.data.statusConfig.availableValues.join(', '));
                    setSoldVal(data.data.statusConfig.soldValue);
                    setDoNotPullVals(data.data.statusConfig.doNotPullValues.join(', '));
                    setSyncInterval(data.data.syncIntervalMinutes);
                }
                if (data.defaults) {
                    setDefaults(data.defaults);
                    if (!data.data) {
                        setAvailableVals(data.defaults.statusConfig.availableValues.join(', '));
                        setSoldVal(data.defaults.statusConfig.soldValue);
                        setDoNotPullVals(data.defaults.statusConfig.doNotPullValues.join(', '));
                    }
                }
            }
        } catch { }
        setLoading(false);
    };

    const handleSaveConfig = async () => {
        if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
            showToast('❌ URL không hợp lệ — phải là link Google Sheets');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/v1/sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sellerId: user?.id,
                    sellerName: user?.fullName,
                    googleSheetUrl: sheetUrl,
                    statusConfig: {
                        availableValues: availableVals.split(',').map(s => s.trim()).filter(Boolean),
                        soldValue: soldVal.trim(),
                        doNotPullValues: doNotPullVals.split(',').map(s => s.trim()).filter(Boolean),
                    },
                    syncIntervalMinutes: syncInterval,
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('✅ Đã lưu cấu hình!');
                loadConfig();
            }
        } catch { showToast('❌ Lỗi lưu cấu hình'); }
        setSaving(false);
    };

    const handleAddMapping = async () => {
        if (!newProductId || !newTabName.trim()) {
            showToast('❌ Vui lòng chọn sản phẩm và nhập tên tab');
            return;
        }
        try {
            const product = demoProducts.find(p => p.id === newProductId);
            const res = await fetch('/api/v1/sheets', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sellerId: user?.id,
                    mapping: {
                        productId: newProductId,
                        productName: product?.name || '',
                        sheetTabName: newTabName.trim(),
                        columnMapping: {
                            dataColumn: newDataCol.trim(),
                            statusColumn: newStatusCol.trim(),
                            startRow: newStartRow,
                        },
                    },
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('✅ ' + data.message);
                setShowAddMapping(false);
                setNewProductId('');
                setNewTabName('');
                loadConfig();
            } else {
                showToast('❌ ' + data.message);
            }
        } catch { showToast('❌ Lỗi thêm liên kết'); }
    };

    const handleRemoveMapping = async (productId: string) => {
        if (!confirm('Xóa liên kết này?')) return;
        try {
            const res = await fetch(`/api/v1/sheets?sellerId=${user?.id}&productId=${productId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast('✅ Đã xóa');
                loadConfig();
            }
        } catch { showToast('❌ Lỗi'); }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-brand-info" /> Google Sheets Sync
                    </h1>
                    <p className="text-sm text-brand-text-muted mt-1">Kết nối Google Sheets để quản lý tồn kho tự động. Hệ thống chỉ lấy hàng có trạng thái phù hợp.</p>
                </div>
                {config?.lastSyncStatus && (
                    <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full ${config.lastSyncStatus === 'success' ? 'bg-brand-success/10 text-brand-success' : config.lastSyncStatus === 'error' ? 'bg-brand-danger/10 text-brand-danger' : 'bg-brand-warning/10 text-brand-warning'}`}>
                        <span className="w-2 h-2 rounded-full bg-current" />
                        {config.lastSyncStatus === 'success' ? 'Đã sync' : config.lastSyncStatus === 'error' ? 'Lỗi sync' : 'Đang sync...'}
                    </div>
                )}
            </div>

            {/* Step 1: Google Sheet URL */}
            <div className="card space-y-4">
                <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-brand-primary" /> Bước 1: Kết nối Google Sheet
                </h3>
                <div>
                    <label className="text-xs text-brand-text-muted mb-1 block">URL Google Sheet</label>
                    <input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/1abc.../edit" className="input-field w-full text-sm" />
                </div>
                <div className="bg-brand-info/5 border border-brand-info/20 rounded-xl p-3">
                    <p className="text-xs text-brand-text-secondary">
                        <strong>📋 Hướng dẫn:</strong> Share Google Sheet với <code className="text-brand-primary font-medium bg-brand-primary/5 px-1 rounded">service@chotainguyen.iam.gserviceaccount.com</code> (quyền Viewer)
                    </p>
                </div>
            </div>

            {/* Step 2: Status Config */}
            <div className="card space-y-4">
                <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                    <Shield className="w-4 h-4 text-brand-primary" /> Bước 2: Quy tắc trạng thái
                </h3>
                <div className="bg-brand-warning/5 border border-brand-warning/20 rounded-xl p-3 text-xs text-brand-text-secondary space-y-1">
                    <p><strong>⚠️ Quan trọng:</strong> Cấu hình này quyết định web sẽ lấy hàng nào và KHÔNG lấy hàng nào.</p>
                    <p>• Cột trạng thái trong sheet phải chứa đúng giá trị bạn đặt bên dưới.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-brand-text-muted mb-1 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-brand-success inline-block" />
                            Trạng thái SẼ LẤY hàng (ngăn cách bởi dấu phẩy)
                        </label>
                        <input value={availableVals} onChange={e => setAvailableVals(e.target.value)}
                            placeholder="Available, Có sẵn, OK, Còn hàng" className="input-field w-full text-sm" />
                        <p className="text-[10px] text-brand-text-muted mt-1">Web chỉ lấy sản phẩm có trạng thái nằm trong danh sách này</p>
                    </div>
                    <div>
                        <label className="text-xs text-brand-text-muted mb-1 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-brand-danger inline-block" />
                            Trạng thái TUYỆT ĐỐI KHÔNG LẤY (ngăn cách bởi dấu phẩy)
                        </label>
                        <input value={doNotPullVals} onChange={e => setDoNotPullVals(e.target.value)}
                            placeholder="Đã bán, SOLD, Hết hạn, Lỗi, Reserved" className="input-field w-full text-sm" />
                        <p className="text-[10px] text-brand-text-muted mt-1">Web sẽ KHÔNG BAO GIỜ lấy sản phẩm có trạng thái này</p>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-brand-text-muted mb-1 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-brand-warning inline-block" />
                            Khi bán xong, ghi trạng thái gì?
                        </label>
                        <input value={soldVal} onChange={e => setSoldVal(e.target.value)}
                            placeholder="Đã bán" className="input-field w-full text-sm" />
                        <p className="text-[10px] text-brand-text-muted mt-1">Sau khi khách mua xong, cột trạng thái sẽ tự đổi thành giá trị này</p>
                    </div>
                    <div>
                        <label className="text-xs text-brand-text-muted mb-1">Tần suất sync (phút)</label>
                        <input type="number" value={syncInterval} onChange={e => setSyncInterval(parseInt(e.target.value) || 5)}
                            min={1} max={60} className="input-field w-full text-sm" />
                    </div>
                </div>

                <button onClick={handleSaveConfig} disabled={saving} className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
                    <Save className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
            </div>

            {/* Step 3: Tab Mapping */}
            <div className="card space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                        <Table2 className="w-4 h-4 text-brand-primary" /> Bước 3: Liên kết Sản phẩm ↔ Tab Sheet
                    </h3>
                    <button onClick={() => setShowAddMapping(true)} className="btn-primary !py-1.5 text-xs flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> Thêm liên kết
                    </button>
                </div>

                <div className="bg-brand-surface-2 border border-brand-border rounded-xl p-3 text-xs text-brand-text-secondary">
                    <p><strong>💡 Mỗi sản phẩm được liên kết với 1 tab (sheet) riêng.</strong></p>
                    <p className="mt-1">Ví dụ: Sản phẩm &quot;Netflix Premium&quot; → tab &quot;Netflix&quot; trong Google Sheets. Sản phẩm &quot;Spotify Key&quot; → tab &quot;Spotify_Keys&quot;.</p>
                </div>

                {/* Add mapping form */}
                {showAddMapping && (
                    <div className="bg-brand-primary/5 border-2 border-brand-primary/20 rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-semibold text-brand-primary">Thêm liên kết mới</h4>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-brand-text-muted mb-1 block">Sản phẩm trên web *</label>
                                <select value={newProductId} onChange={e => setNewProductId(e.target.value)} className="input-field w-full text-sm">
                                    <option value="">— Chọn sản phẩm —</option>
                                    {demoProducts.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-brand-text-muted mb-1 block">Tên tab trong Google Sheet *</label>
                                <input value={newTabName} onChange={e => setNewTabName(e.target.value)}
                                    placeholder="VD: Netflix, Spotify_Keys, Sheet1" className="input-field w-full text-sm" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs text-brand-text-muted mb-1 flex items-center gap-1">
                                    Cột dữ liệu
                                    <HelpCircle className="w-3 h-3" />
                                </label>
                                <input value={newDataCol} onChange={e => setNewDataCol(e.target.value)}
                                    placeholder="A:C" className="input-field w-full text-sm" />
                                <p className="text-[10px] text-brand-text-muted mt-0.5">A hoặc A:C (nhiều cột)</p>
                            </div>
                            <div>
                                <label className="text-xs text-brand-text-muted mb-1 block">Cột trạng thái</label>
                                <input value={newStatusCol} onChange={e => setNewStatusCol(e.target.value)}
                                    placeholder="D" className="input-field w-full text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-brand-text-muted mb-1 block">Dòng bắt đầu</label>
                                <input type="number" value={newStartRow} onChange={e => setNewStartRow(parseInt(e.target.value) || 2)}
                                    min={1} className="input-field w-full text-sm" />
                                <p className="text-[10px] text-brand-text-muted mt-0.5">Bỏ header (thường = 2)</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowAddMapping(false)} className="btn-secondary text-xs flex-1">Hủy</button>
                            <button onClick={handleAddMapping} className="btn-primary text-xs flex-1">Lưu liên kết</button>
                        </div>
                    </div>
                )}

                {/* Existing mappings */}
                {config?.tabMappings && config.tabMappings.length > 0 ? (
                    <div className="space-y-2">
                        {config.tabMappings.map(m => {
                            const summary = config.stockSummary?.find(s => s.productId === m.productId);
                            return (
                                <div key={m.productId} className="flex items-center justify-between bg-brand-surface-2 rounded-xl p-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Package className="w-5 h-5 text-brand-primary shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-brand-text-primary truncate">{m.productName}</div>
                                            <div className="text-xs text-brand-text-muted flex items-center gap-2 flex-wrap">
                                                <span>Tab: <strong className="text-brand-info">{m.sheetTabName}</strong></span>
                                                <span>|</span>
                                                <span>Cột: {m.columnMapping.dataColumn} (data), {m.columnMapping.statusColumn} (status)</span>
                                                <span>|</span>
                                                <span>Từ dòng {m.columnMapping.startRow}</span>
                                            </div>
                                            {summary && (
                                                <div className="flex items-center gap-3 mt-1 text-[10px]">
                                                    <span className="text-brand-text-muted">Tổng: <strong>{summary.total}</strong></span>
                                                    <span className="text-brand-success">Có sẵn: <strong>{summary.available}</strong></span>
                                                    <span className="text-brand-danger">Đã bán: <strong>{summary.sold}</strong></span>
                                                    <span className="text-brand-warning">Không lấy: <strong>{summary.doNotPull}</strong></span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveMapping(m.productId)} className="p-2 rounded-lg text-brand-danger hover:bg-brand-danger/10 shrink-0">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-6 text-sm text-brand-text-muted">
                        <Table2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Chưa có liên kết nào. Bấm &quot;Thêm liên kết&quot; để bắt đầu.</p>
                    </div>
                )}
            </div>

            {/* Visual Guide */}
            <div className="card space-y-4">
                <h3 className="text-sm font-semibold text-brand-text-primary flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-brand-primary" /> Hướng dẫn cách hoạt động
                </h3>
                <div className="bg-brand-surface-2 rounded-xl p-4 space-y-3">
                    <div className="grid sm:grid-cols-3 gap-4">
                        <div className="text-center space-y-2">
                            <div className="w-10 h-10 rounded-xl bg-brand-success/10 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-5 h-5 text-brand-success" />
                            </div>
                            <div className="text-xs font-medium text-brand-text-primary">✅ Web SẼ LẤY</div>
                            <div className="text-[10px] text-brand-text-muted">Khi cột trạng thái chứa:<br /><strong className="text-brand-success">{availableVals || 'Available, Có sẵn...'}</strong></div>
                        </div>
                        <div className="text-center space-y-2">
                            <div className="w-10 h-10 rounded-xl bg-brand-danger/10 flex items-center justify-center mx-auto">
                                <AlertTriangle className="w-5 h-5 text-brand-danger" />
                            </div>
                            <div className="text-xs font-medium text-brand-text-primary">🚫 Web KHÔNG LẤY</div>
                            <div className="text-[10px] text-brand-text-muted">Khi cột trạng thái chứa:<br /><strong className="text-brand-danger">{doNotPullVals || 'Đã bán, Hết hạn...'}</strong></div>
                        </div>
                        <div className="text-center space-y-2">
                            <div className="w-10 h-10 rounded-xl bg-brand-warning/10 flex items-center justify-center mx-auto">
                                <ArrowRight className="w-5 h-5 text-brand-warning" />
                            </div>
                            <div className="text-xs font-medium text-brand-text-primary">📝 Sau khi bán</div>
                            <div className="text-[10px] text-brand-text-muted">Tự động ghi vào sheet:<br /><strong className="text-brand-warning">{soldVal || 'Đã bán'}</strong></div>
                        </div>
                    </div>
                </div>

                <div className="bg-brand-surface-2 rounded-xl p-4 overflow-x-auto">
                    <p className="text-xs font-semibold text-brand-text-secondary mb-2">📊 Ví dụ Google Sheet (tab: &quot;Netflix&quot;)</p>
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="border-b-2 border-brand-border">
                                <th className="text-left p-2 text-brand-text-muted font-medium bg-brand-bg">A - Account</th>
                                <th className="text-left p-2 text-brand-text-muted font-medium bg-brand-bg">B - Password</th>
                                <th className="text-left p-2 text-brand-text-muted font-medium bg-brand-bg">C - Email</th>
                                <th className="text-left p-2 text-brand-text-muted font-medium bg-brand-bg">D - Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="font-mono">
                            <tr className="border-b border-brand-border/50 bg-brand-success/5">
                                <td className="p-2">netflix_001</td><td className="p-2">Pass@123</td><td className="p-2">acc1@gmail.com</td>
                                <td className="p-2 text-brand-success font-semibold">✅ Available</td>
                            </tr>
                            <tr className="border-b border-brand-border/50 bg-brand-success/5">
                                <td className="p-2">netflix_002</td><td className="p-2">Pass@456</td><td className="p-2">acc2@gmail.com</td>
                                <td className="p-2 text-brand-success font-semibold">✅ Có sẵn</td>
                            </tr>
                            <tr className="border-b border-brand-border/50 opacity-40 bg-brand-danger/5">
                                <td className="p-2">netflix_003</td><td className="p-2">Pass@789</td><td className="p-2">acc3@gmail.com</td>
                                <td className="p-2 text-brand-danger font-semibold">🚫 Đã bán</td>
                            </tr>
                            <tr className="border-b border-brand-border/50 opacity-40 bg-brand-danger/5">
                                <td className="p-2">netflix_004</td><td className="p-2">Pass@111</td><td className="p-2">acc4@gmail.com</td>
                                <td className="p-2 text-brand-danger font-semibold">🚫 Hết hạn</td>
                            </tr>
                            <tr className="bg-brand-success/5">
                                <td className="p-2">netflix_005</td><td className="p-2">Pass@222</td><td className="p-2">acc5@gmail.com</td>
                                <td className="p-2 text-brand-success font-semibold">✅ OK</td>
                            </tr>
                        </tbody>
                    </table>
                    <p className="text-[10px] text-brand-text-muted mt-2">→ Web chỉ lấy dòng 2, 3, 6 (trạng thái Available/Có sẵn/OK). Dòng 4, 5 bị bỏ qua (Đã bán/Hết hạn).</p>
                </div>
            </div>

            {toast && (
                <div className="fixed bottom-6 right-6 z-50 bg-brand-surface border border-brand-border rounded-xl shadow-card-hover px-5 py-3 animate-slide-up">
                    <span className="text-sm text-brand-text-primary font-medium">{toast}</span>
                </div>
            )}
        </div>
    );
}
