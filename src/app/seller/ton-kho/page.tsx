'use client';

import { useState, useRef } from 'react';
import { Upload, Database, FileText, AlertCircle, Plus, Trash2, Search, X, CheckCircle2 } from 'lucide-react';

const initialStock: { id: number; product: string; total: number; available: number; used: number; lastUpload: string; items: string[] }[] = [];

export default function InventoryPage() {
    const [stockItems, setStockItems] = useState(initialStock);
    const [search, setSearch] = useState('');
    const [uploadModal, setUploadModal] = useState<number | null>(null);
    const [uploadText, setUploadText] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
    const [toast, setToast] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const filtered = stockItems.filter(s => !search || s.product.toLowerCase().includes(search.toLowerCase()));

    const stats = {
        total: stockItems.reduce((s, i) => s + i.total, 0),
        available: stockItems.reduce((s, i) => s + i.available, 0),
        used: stockItems.reduce((s, i) => s + i.used, 0),
        low: stockItems.filter(i => i.available > 0 && i.available <= 5).length,
    };

    const handleUpload = () => {
        if (!uploadText.trim() || uploadModal === null) return;
        const lines = uploadText.trim().split('\n').filter(l => l.trim());
        setStockItems(prev => prev.map(s => s.id === uploadModal ? {
            ...s,
            total: s.total + lines.length,
            available: s.available + lines.length,
            items: [...s.items, ...lines],
            lastUpload: new Date().toISOString().split('T')[0],
        } : s));
        setUploadModal(null);
        setUploadText('');
        showToast(`✅ Đã thêm ${lines.length} mục tồn kho`);
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) readFile(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) readFile(file);
    };

    const readFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const lines = text.trim().split('\n').filter(l => l.trim());
            showToast(`📁 Đã đọc file ${file.name} (${lines.length} dòng). Chọn sản phẩm để thêm.`);
        };
        reader.readAsText(file);
    };

    const handleDeleteAll = (id: number) => {
        setStockItems(prev => prev.map(s => s.id === id ? { ...s, available: 0, items: [] } : s));
        setDeleteTarget(null);
        showToast('🗑️ Đã xóa tồn kho');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Quản lý tồn kho</h1>
                    <p className="text-sm text-brand-text-muted">Upload dữ liệu sản phẩm, theo dõi số lượng tồn kho và trạng thái giao hàng tự động.</p>
                </div>
                <button onClick={() => fileRef.current?.click()} className="btn-primary flex items-center gap-2 !py-2 text-sm">
                    <Upload className="w-4 h-4" /> Upload tồn kho
                </button>
                <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleFileSelect} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng tồn kho', value: stats.total, icon: Database, color: 'text-brand-primary' },
                    { label: 'Còn hàng', value: stats.available, icon: FileText, color: 'text-brand-success' },
                    { label: 'Đã sử dụng', value: stats.used, icon: FileText, color: 'text-brand-info' },
                    { label: 'Sắp hết hàng', value: stats.low, icon: AlertCircle, color: 'text-brand-warning' },
                ].map((s, i) => (
                    <div key={i} className="card !p-4">
                        <div className="flex items-center gap-2 mb-2"><s.icon className={`w-4 h-4 ${s.color}`} /><span className="text-xs text-brand-text-muted">{s.label}</span></div>
                        <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Google Sheets Integration */}
            <div className="card">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M3 3h18v18H3V3z" fill="#34A853" rx="2" /><path d="M7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" fill="white" /></svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-brand-text-primary">Nhập từ Google Sheets</h3>
                        <p className="text-xs text-brand-text-muted">Dán URL Google Sheet (phải chia sẻ công khai). Cột A = mã/key/tài khoản.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <input type="url" placeholder="https://docs.google.com/spreadsheets/d/..." className="input-field flex-1 text-sm" />
                    <button className="btn-primary !py-2 text-sm flex items-center gap-1.5 shrink-0" onClick={() => showToast('📊 Đang đồng bộ dữ liệu từ Google Sheets...')}>
                        <Database className="w-4 h-4" /> Đồng bộ
                    </button>
                </div>
            </div>

            {/* Upload Zone */}
            <div
                className={`card border-dashed border-2 transition-all cursor-pointer ${dragOver ? 'border-brand-primary bg-brand-primary/5' : 'border-brand-border hover:border-brand-primary/50'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileRef.current?.click()}
            >
                <div className="text-center py-6">
                    <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-brand-primary' : 'text-brand-text-muted'}`} />
                    <h3 className="text-sm font-semibold text-brand-text-primary mb-1">Kéo thả file hoặc nhấn để upload</h3>
                    <p className="text-xs text-brand-text-muted">Hỗ trợ file .txt, .csv — Mỗi dòng là 1 mục tồn kho (key, tài khoản, link...)</p>
                </div>
            </div>

            {/* Inventory Table */}
            <div className="card !p-0 overflow-hidden">
                <div className="p-4 border-b border-brand-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-brand-text-primary">Tồn kho theo sản phẩm</h3>
                    <div className="relative">
                        <Search className="w-4 h-4 text-brand-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sản phẩm..." className="input-field !py-1.5 !pl-9 text-xs w-[200px]" />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-brand-surface-2/50">
                                <th className="text-left text-xs text-brand-text-muted font-medium py-3 px-4">Sản phẩm</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Tổng</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Còn lại</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Đã dùng</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Trạng thái</th>
                                <th className="text-right text-xs text-brand-text-muted font-medium py-3 px-4">Upload cuối</th>
                                <th className="text-center text-xs text-brand-text-muted font-medium py-3 px-4">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(item => (
                                <tr key={item.id} className="border-t border-brand-border/50 hover:bg-brand-surface-2/30 transition-colors">
                                    <td className="py-3 px-4 text-sm font-medium text-brand-text-primary">{item.product}</td>
                                    <td className="py-3 px-4 text-center text-brand-text-secondary">{item.total}</td>
                                    <td className="py-3 px-4 text-center font-semibold text-brand-success">{item.available}</td>
                                    <td className="py-3 px-4 text-center text-brand-text-muted">{item.used}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`badge text-[10px] ${item.available > 5 ? 'badge-success' : item.available > 0 ? 'badge-warning' : 'badge-danger'}`}>
                                            {item.available > 5 ? 'Còn hàng' : item.available > 0 ? 'Sắp hết' : 'Hết hàng'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right text-xs text-brand-text-muted">{item.lastUpload}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => { setUploadModal(item.id); setUploadText(''); }} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-surface-2 transition-all" title="Upload thêm">
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => setDeleteTarget(item.id)} className="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-surface-2 transition-all" title="Xóa tất cả">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Upload Modal */}
            {uploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setUploadModal(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6 animate-slide-up">
                        <button onClick={() => setUploadModal(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2"><X className="w-5 h-5 text-brand-text-muted" /></button>
                        <h2 className="text-lg font-bold text-brand-text-primary mb-2">📦 Thêm tồn kho</h2>
                        <p className="text-sm text-brand-text-muted mb-4">{stockItems.find(s => s.id === uploadModal)?.product}</p>
                        <textarea rows={8} value={uploadText} onChange={e => setUploadText(e.target.value)} className="input-field resize-none mb-4 font-mono text-xs" placeholder="Mỗi dòng 1 mục tồn kho:&#10;account1@mail.com|password123&#10;account2@mail.com|password456&#10;KEY-XXXXX-XXXXX-001" />
                        <p className="text-xs text-brand-text-muted mb-4">💡 {uploadText.trim() ? `${uploadText.trim().split('\n').filter(l => l.trim()).length} mục sẽ được thêm` : 'Nhập hoặc paste dữ liệu vào đây'}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setUploadModal(null)} className="btn-secondary flex-1 !py-3">Hủy</button>
                            <button onClick={handleUpload} disabled={!uploadText.trim()} className="btn-primary flex-1 !py-3 disabled:opacity-50">Thêm tồn kho</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-sm w-full p-6 animate-slide-up text-center">
                        <Trash2 className="w-12 h-12 text-brand-danger mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-brand-text-primary mb-2">Xóa tất cả tồn kho?</h3>
                        <p className="text-sm text-brand-text-muted mb-5">Toàn bộ tồn kho còn lại của sản phẩm này sẽ bị xóa.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1 !py-3">Hủy</button>
                            <button onClick={() => handleDeleteAll(deleteTarget)} className="flex-1 !py-3 bg-brand-danger text-white rounded-xl font-medium hover:bg-brand-danger/90 transition-all">Xóa</button>
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
