'use client';

import { useEffect, useState, useRef } from 'react';
import { FileText, Download, Eye, X, Loader2, Search, Image as ImageIcon, FileSpreadsheet, File } from 'lucide-react';
import { useUI } from '@/components/shared/UIProvider';

interface Invoice {
    id: string;
    invoiceNumber: string;
    orderCode: string;
    buyerName: string;
    sellerName: string;
    subtotal: number;
    vatRate: number;
    vatAmount: number;
    feeAmount: number;
    totalAmount: number;
    taxEnabled: boolean;
    items: string;
    status: string;
    issuedAt: string;
}

export default function SellerInvoicePage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Invoice | null>(null);
    const [search, setSearch] = useState('');
    const [exporting, setExporting] = useState('');
    const invoiceRef = useRef<HTMLDivElement>(null);
    const { showToast } = useUI();

    const fetchInvoices = async () => {
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/seller/invoices', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) setInvoices(data.data);
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchInvoices(); }, []);

    const fmt = (n: number) => n.toLocaleString('vi-VN') + 'đ';
    const fmtDate = (d: string) => {
        try {
            const date = new Date(d);
            return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        } catch { return d; }
    };

    const filtered = invoices.filter(i =>
        i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        i.orderCode.toLowerCase().includes(search.toLowerCase()) ||
        i.buyerName.toLowerCase().includes(search.toLowerCase())
    );

    const totalRevenue = invoices.reduce((s, i) => s + (i.totalAmount - i.feeAmount - i.vatAmount), 0);
    const totalFees = invoices.reduce((s, i) => s + i.feeAmount, 0);
    const totalVat = invoices.reduce((s, i) => s + i.vatAmount, 0);

    // ============ EXPORT FUNCTIONS ============

    // ============ BUILD INVOICE HTML (shared by PDF + Image) ============
    const buildInvoiceHTML = () => {
        if (!selected) return '';
        const taxRow = selected.taxEnabled ? `<div class="total-row"><span>Thuế GTGT (${selected.vatRate}%)</span><span style="color:#e63946">${fmt(selected.vatAmount)}</span></div>` : '';
        const taxLegal = selected.taxEnabled ? `<div style="margin-bottom:8px"><strong>6. Thuế & Phí:</strong> Phí dịch vụ sàn được trừ trực tiếp trên doanh thu. Thuế GTGT theo Luật Thuế GTGT 2024. Thuế TNCN/TNDN theo Luật QLT 2019 (38/2019/QH14) và NĐ 117/2025/NĐ-CP (hiệu lực 01/07/2025).</div>` : '';
        const n = (base: number) => selected.taxEnabled ? base : base - 1;
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hóa đơn ${selected.invoiceNumber}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#1a1a2e;font-size:13px;line-height:1.6;background:#fff}
.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #4361ee;padding-bottom:15px}
.title{font-size:22px;font-weight:bold;color:#4361ee}
.subtitle{font-size:11px;color:#666;margin-top:4px}
.inv-num{color:#4361ee;font-weight:bold;font-size:14px;margin-top:5px;font-family:monospace}
.info-grid{display:flex;gap:15px;margin:15px 0}
.info-box{flex:1;background:#f8f9fa;border-radius:8px;padding:12px;border-left:3px solid #4361ee}
.info-label{font-size:10px;text-transform:uppercase;color:#999;letter-spacing:1px}
.info-value{font-size:13px;font-weight:600;margin-top:3px}
.info-sub{font-size:11px;color:#666;margin-top:2px}
table{width:100%;border-collapse:collapse;margin:15px 0}
th{background:#f1f3f5;padding:8px 12px;text-align:left;font-size:11px;border-bottom:2px solid #dee2e6}
td{padding:8px 12px;border-bottom:1px solid #f1f3f5}
.totals{background:#f8f9fa;border-radius:8px;padding:15px;margin:15px 0}
.total-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
.total-final{display:flex;justify-content:space-between;padding:10px 0 0;border-top:2px solid #4361ee;margin-top:8px;font-size:16px;font-weight:bold;color:#2d6a4f}
.legal{font-size:10.5px;color:#555;margin-top:20px;padding-top:15px;border-top:1px solid #eee;line-height:1.9}
.legal strong{color:#222}
.footer{text-align:center;font-size:10px;color:#999;margin-top:20px;padding-top:10px;border-top:1px solid #eee}
.refs{font-size:10px;color:#888;margin-top:15px;text-align:center;line-height:1.6}
@media print{body{padding:15px}@page{margin:10mm}}
</style></head><body>
<div class="header">
<div class="title">HÓA ĐƠN ĐIỆN TỬ</div>
<div class="subtitle">(Theo Thông tư 78/2021/TT-BTC)</div>
<div class="inv-num">${selected.invoiceNumber}</div>
<div class="subtitle">Ngày phát hành: ${fmtDate(selected.issuedAt)}</div>
</div>
<div class="info-grid">
<div class="info-box"><div class="info-label">Đơn vị bán hàng</div><div class="info-value">${selected.sellerName}</div><div class="info-sub">Sàn: ChoTaiNguyen (chotainguyen.com)</div><div class="info-sub" style="font-size:10px">Nền tảng TMĐT theo NĐ 85/2021/NĐ-CP</div></div>
<div class="info-box"><div class="info-label">Người mua</div><div class="info-value">${selected.buyerName}</div><div class="info-sub">Mã đơn: ${selected.orderCode}</div></div>
</div>
<table><thead><tr><th>Tên hàng hóa/DV</th><th style="text-align:right">Thành tiền</th></tr></thead>
<tbody><tr><td>${selected.items || 'Sản phẩm số'}</td><td style="text-align:right;font-weight:600">${fmt(selected.subtotal)}</td></tr></tbody></table>
<div class="totals">
<div class="total-row"><span>Tiền hàng ${selected.taxEnabled ? '(chưa thuế)' : ''}</span><span>${fmt(selected.subtotal)}</span></div>
${taxRow}
<div class="total-row"><span>Phí dịch vụ sàn TMĐT</span><span style="color:#e63946">-${fmt(selected.feeAmount)}</span></div>
<div class="total-final"><span>Seller nhận thực tế</span><span>${fmt(selected.totalAmount - selected.feeAmount - selected.vatAmount)}</span></div>
</div>
<div class="legal">
<strong>📋 ĐIỀU KHOẢN & CAM KẾT PHÁP LÝ</strong><br/><br/>
<div style="margin-bottom:8px"><strong>1. Tính pháp lý:</strong> Hóa đơn điện tử này có giá trị pháp lý tương đương hóa đơn giấy theo Luật GDĐT 2023 (Luật 20/2023/QH15), NĐ 123/2020/NĐ-CP và TT 78/2021/TT-BTC. Tuân thủ Điều 10 NĐ 123/2020.</div>
<div style="margin-bottom:8px"><strong>2. Cam kết giao dịch:</strong> Sàn ChoTaiNguyen cam kết bảo vệ quyền lợi hợp pháp của cả người mua và người bán. Hoạt động theo NĐ 52/2013/NĐ-CP (sửa đổi NĐ 85/2021/NĐ-CP) và Luật TMĐT 2025.</div>
<div style="margin-bottom:8px"><strong>3. Chính sách hoàn tiền:</strong> Người mua khiếu nại trong 72 giờ. Tiền tạm giữ trong thời gian xử lý. Theo Luật BVQLNTD 2023 (19/2023/QH15), hiệu lực 01/07/2024.</div>
<div style="margin-bottom:8px"><strong>4. Trách nhiệm người bán:</strong> (a) Cung cấp đúng mô tả; (b) Chịu trách nhiệm tính hợp pháp; (c) Tuân thủ bảo hành; (d) Phản hồi khiếu nại đúng hạn.</div>
<div style="margin-bottom:8px"><strong>5. Trách nhiệm sàn:</strong> (a) Nền tảng an toàn; (b) Lưu trữ giao dịch tối thiểu 10 năm; (c) Hỗ trợ tranh chấp; (d) Báo cáo thuế. Sàn không chịu trách nhiệm chất lượng SP do người bán.</div>
${taxLegal}
<div style="margin-bottom:8px"><strong>${n(7)}. Giữ tiền:</strong> Tiền tạm giữ 7 ngày trước khi chuyển vào số dư khả dụng, đảm bảo quyền khiếu nại và phòng chống gian lận.</div>
<div style="margin-bottom:8px"><strong>${n(8)}. Bảo mật:</strong> Thông tin bảo vệ theo NĐ 13/2023/NĐ-CP (hiệu lực 01/07/2023). Cam kết không chia sẻ bên thứ ba trái quy định.</div>
<div style="margin-bottom:8px"><strong>${n(9)}. Tranh chấp:</strong> Thương lượng 15 ngày → Hòa giải 30 ngày → Tòa án theo BLTTDS 2015. Luật áp dụng: Pháp luật Việt Nam.</div>
</div>
<div class="refs">
<strong>Căn cứ pháp lý:</strong><br/>
HĐ điện tử: NĐ 123/2020 + TT 78/2021 • GDĐT: Luật 20/2023/QH15<br/>
TMĐT: NĐ 52/2013 + NĐ 85/2021 • DLCN: NĐ 13/2023 • NTD: Luật 19/2023/QH15<br/>
${selected.taxEnabled ? 'Thuế: NĐ 117/2025 + Luật 38/2019/QH14<br/>' : ''}
</div>
<div class="footer">
© ${new Date().getFullYear()} ChoTaiNguyen — Sàn TMĐT tài nguyên số<br/>
Hóa đơn tạo tự động, có giá trị pháp lý không cần đóng dấu.
</div>
</body></html>`;
    };

    // ======= EXPORT PDF — sử dụng hidden iframe để in (không bị chặn popup) =======
    const exportPDF = () => {
        if (!selected) return;
        setExporting('pdf');
        try {
            const html = buildInvoiceHTML();
            // Tạo iframe ẩn để in
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!iframeDoc) { setExporting(''); return; }
            iframeDoc.open();
            iframeDoc.write(html);
            iframeDoc.close();
            // Đợi render xong rồi in
            setTimeout(() => {
                iframe.contentWindow?.print();
                // Dọn dẹp sau khi in xong
                setTimeout(() => {
                    document.body.removeChild(iframe);
                    setExporting('');
                }, 1000);
            }, 500);
        } catch {
            setExporting('');
            showToast('Không thể xuất PDF. Vui lòng thử lại.', 'error');
        }
    };

    // ======= EXPORT IMAGE — tải file HTML có thể mở & chụp ảnh =======
    const exportImage = () => {
        if (!selected) return;
        setExporting('image');
        try {
            const html = buildInvoiceHTML();
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selected.invoiceNumber}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setExporting('');
            showToast('Đã tải file HTML hóa đơn! Mở file → Ctrl+P → "Save as PDF" hoặc chụp ảnh màn hình.', 'success');
        } catch {
            setExporting('');
            showToast('Không thể tải ảnh. Vui lòng thử lại.', 'error');
        }
    };

    // Export Excel — CSV with UTF-8 BOM for Vietnamese support
    const exportExcel = () => {
        setExporting('excel');
        const headers = ['Số HĐ', 'Mã đơn', 'Ngày', 'Người bán', 'Người mua', 'Sản phẩm', 'Tiền hàng', 'Thuế GTGT', 'Phí sàn', 'Tổng', 'Seller nhận'];
        const rows = invoices.map(i => [
            i.invoiceNumber,
            i.orderCode,
            fmtDate(i.issuedAt),
            i.sellerName,
            i.buyerName,
            `"${i.items}"`,
            i.subtotal,
            i.taxEnabled ? i.vatAmount : 0,
            i.feeAmount,
            i.totalAmount,
            i.totalAmount - i.feeAmount - (i.taxEnabled ? i.vatAmount : 0),
        ]);

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `hoa-don-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        setExporting('');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-brand-text-primary mb-1">Hóa đơn bán hàng</h1>
                    <p className="text-sm text-brand-text-muted">Hóa đơn điện tử tự động tạo cho mỗi đơn hàng. Theo Thông tư 78/2021/TT-BTC.</p>
                </div>
                {/* Bulk export */}
                <button onClick={exportExcel} disabled={invoices.length === 0}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl border border-brand-border text-brand-text-secondary hover:bg-brand-surface-2 transition-all disabled:opacity-40">
                    <FileSpreadsheet className="w-4 h-4" /> Xuất Excel tổng
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="card !p-4">
                    <div className="text-xl font-bold text-brand-primary">{invoices.length}</div>
                    <div className="text-xs text-brand-text-muted mt-1">Tổng hóa đơn</div>
                </div>
                <div className="card !p-4">
                    <div className="text-xl font-bold text-brand-success">{fmt(totalRevenue)}</div>
                    <div className="text-xs text-brand-text-muted mt-1">Doanh thu (sau phí + thuế)</div>
                </div>
                <div className="card !p-4">
                    <div className="text-xl font-bold text-brand-danger">{fmt(totalFees)}</div>
                    <div className="text-xs text-brand-text-muted mt-1">Phí sàn đã trừ</div>
                </div>
                <div className="card !p-4">
                    <div className="text-xl font-bold text-brand-warning">{fmt(totalVat)}</div>
                    <div className="text-xs text-brand-text-muted mt-1">Thuế GTGT</div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo số HD, mã đơn, tên người mua..." className="input-field !pl-10 w-full" />
            </div>

            {/* Invoice List */}
            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-brand-primary animate-spin" /></div>
            ) : filtered.length === 0 ? (
                <div className="card text-center py-16">
                    <FileText className="w-12 h-12 text-brand-text-muted/30 mx-auto mb-3" />
                    <p className="text-sm text-brand-text-muted">{search ? 'Không tìm thấy hóa đơn phù hợp' : 'Chưa có hóa đơn nào. Hóa đơn tạo tự động khi khách mua hàng.'}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(inv => (
                        <div key={inv.id} className="card !p-4 flex items-center gap-4 hover:border-brand-primary/30 transition-all cursor-pointer" onClick={() => setSelected(inv)}>
                            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-brand-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-xs font-mono font-bold text-brand-primary">{inv.invoiceNumber}</span>
                                    <span className="text-[10px] text-brand-text-muted">• {inv.orderCode}</span>
                                </div>
                                <div className="text-xs text-brand-text-muted">Người mua: <strong className="text-brand-text-primary">{inv.buyerName}</strong> • {fmtDate(inv.issuedAt)}</div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-sm font-bold text-brand-success">{fmt(inv.totalAmount - inv.feeAmount - inv.vatAmount)}</div>
                                <div className="text-[10px] text-brand-text-muted">
                                    Phí: -{fmt(inv.feeAmount)}
                                    {inv.taxEnabled && inv.vatAmount > 0 && <> • Thuế: -{fmt(inv.vatAmount)}</>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ============ INVOICE DETAIL MODAL ============ */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slide-up">
                        <div className="p-6 border-b border-brand-border">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-brand-primary" />
                                    <h3 className="text-lg font-bold text-brand-text-primary">HÓA ĐƠN ĐIỆN TỬ</h3>
                                </div>
                                <div className="flex items-center gap-1">
                                    {/* Export buttons */}
                                    <button onClick={exportPDF} disabled={exporting === 'pdf'} title="Xuất PDF"
                                        className="p-2 rounded-lg text-brand-text-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-colors disabled:opacity-50">
                                        {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <File className="w-4 h-4" />}
                                    </button>
                                    <button onClick={exportImage} disabled={exporting === 'image'} title="Tải ảnh PNG"
                                        className="p-2 rounded-lg text-brand-text-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors disabled:opacity-50">
                                        {exporting === 'image' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-brand-surface-2">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-brand-text-muted mb-1">(Theo Thông tư 78/2021/TT-BTC)</div>
                                <div className="text-sm font-mono font-bold text-brand-primary">{selected.invoiceNumber}</div>
                                <div className="text-xs text-brand-text-muted mt-1">Ngày phát hành: {fmtDate(selected.issuedAt)}</div>
                            </div>
                        </div>

                        {/* Capturable content for image export */}
                        <div ref={invoiceRef} className="p-6 space-y-4 bg-white">
                            {/* Thông tin hai bên */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Đơn vị bán hàng</div>
                                    <div className="text-sm font-medium text-brand-text-primary">{selected.sellerName}</div>
                                    <div className="text-xs text-brand-text-muted mt-0.5">Sàn: ChoTaiNguyen (chotainguyen.com)</div>
                                    <div className="text-[10px] text-brand-text-muted mt-0.5">Nền tảng TMĐT theo NĐ 85/2021/NĐ-CP</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3">
                                    <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-1">Người mua</div>
                                    <div className="text-sm font-medium text-brand-text-primary">{selected.buyerName}</div>
                                    <div className="text-xs text-brand-text-muted mt-0.5">Mã đơn: {selected.orderCode}</div>
                                </div>
                            </div>

                            {/* Chi tiết sản phẩm */}
                            <div className="bg-brand-surface-2 rounded-xl p-3 text-xs">
                                <div className="text-[10px] uppercase text-brand-text-muted tracking-wider mb-2 font-semibold">📦 Chi tiết hàng hóa / dịch vụ</div>
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-brand-border/30 text-left">
                                            <th className="py-1 text-brand-text-muted font-medium">Tên hàng hóa/DV</th>
                                            <th className="py-1 text-brand-text-muted font-medium text-right">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-brand-border/10">
                                            <td className="py-1.5 text-brand-text-primary">{selected.items || 'Sản phẩm số / Dịch vụ trực tuyến'}</td>
                                            <td className="py-1.5 text-right font-medium">{fmt(selected.subtotal)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Tổng tiền */}
                            <div className="bg-brand-surface-2 rounded-xl p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-brand-text-muted">Tiền hàng {selected.taxEnabled ? '(chưa thuế)' : ''}</span>
                                    <span className="font-medium">{fmt(selected.subtotal)}</span>
                                </div>
                                {/* CHỈ HIỆN THUẾ KHI ADMIN BẬT */}
                                {selected.taxEnabled && selected.vatRate > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-brand-text-muted">Thuế GTGT ({selected.vatRate}%)</span>
                                        <span className="font-medium text-brand-danger">{fmt(selected.vatAmount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-brand-text-muted">Phí dịch vụ sàn TMĐT</span>
                                    <span className="font-medium text-brand-danger">-{fmt(selected.feeAmount)}</span>
                                </div>
                                <div className="border-t border-brand-border pt-2 flex justify-between text-sm">
                                    <span className="font-semibold">Seller nhận thực tế</span>
                                    <span className="font-bold text-brand-success text-lg">{fmt(selected.totalAmount - selected.feeAmount - selected.vatAmount)}</span>
                                </div>
                            </div>

                            {/* ======= ĐIỀU KHOẢN & CAM KẾT PHÁP LÝ ======= */}
                            <div className="bg-brand-surface-2/50 rounded-xl p-4 space-y-3 text-xs text-brand-text-muted leading-relaxed">
                                <div className="text-[10px] uppercase tracking-wider font-semibold text-brand-text-primary mb-2">📋 Điều khoản & Cam kết pháp lý</div>
                                
                                <div>
                                    <strong className="text-brand-text-primary">1. Tính pháp lý của hóa đơn:</strong> Hóa đơn điện tử này có giá trị pháp lý tương đương hóa đơn giấy theo <em>Luật Giao dịch điện tử 2023 (Luật 20/2023/QH15)</em>, <em>Nghị định 123/2020/NĐ-CP</em> về hóa đơn, chứng từ và <em>Thông tư 78/2021/TT-BTC</em> hướng dẫn thực hiện. Nội dung tuân thủ Điều 10 NĐ 123/2020 về các tiêu thức bắt buộc trên hóa đơn điện tử.
                                </div>
                                <div>
                                    <strong className="text-brand-text-primary">2. Cam kết giao dịch:</strong> Sàn ChoTaiNguyen cam kết bảo vệ quyền lợi hợp pháp của cả người mua và người bán theo đúng quy định pháp luật Việt Nam. Toàn bộ giao dịch được ghi nhận, lưu trữ điện tử và có thể truy xuất khi cần. Sàn hoạt động theo mô hình sàn giao dịch TMĐT theo <em>Nghị định 52/2013/NĐ-CP</em> (sửa đổi bổ sung bởi <em>Nghị định 85/2021/NĐ-CP</em>) và <em>Luật Thương mại điện tử 2025</em>.
                                </div>
                                <div>
                                    <strong className="text-brand-text-primary">3. Chính sách hoàn tiền & khiếu nại:</strong> Người mua có quyền khiếu nại trong vòng <strong>72 giờ</strong> kể từ khi nhận hàng. Trong thời gian khiếu nại, tiền đơn hàng sẽ được tạm giữ. Sàn sẽ xem xét và hoàn tiền nếu sản phẩm không đúng mô tả hoặc không hoạt động theo <em>Luật Bảo vệ quyền lợi người tiêu dùng 2023 (Luật 19/2023/QH15)</em>, có hiệu lực từ 01/07/2024.
                                </div>
                                <div>
                                    <strong className="text-brand-text-primary">4. Trách nhiệm người bán:</strong> Người bán cam kết: (a) Cung cấp sản phẩm/dịch vụ đúng mô tả, chất lượng và nội dung đã công bố; (b) Chịu trách nhiệm hoàn toàn về tính hợp pháp của sản phẩm; (c) Tuân thủ nghĩa vụ bảo hành (nếu có) theo đúng thỏa thuận; (d) Phản hồi khiếu nại của người mua trong thời hạn quy định.
                                </div>
                                <div>
                                    <strong className="text-brand-text-primary">5. Trách nhiệm của sàn:</strong> Sàn ChoTaiNguyen có trách nhiệm: (a) Cung cấp nền tảng giao dịch an toàn; (b) Lưu trữ thông tin giao dịch tối thiểu <strong>10 năm</strong> theo NĐ 52/2013; (c) Hỗ trợ giải quyết tranh chấp giữa các bên; (d) Báo cáo cơ quan thuế theo quy định. Sàn không chịu trách nhiệm về chất lượng sản phẩm do người bán cung cấp.
                                </div>
                                {selected.taxEnabled && (
                                    <div>
                                        <strong className="text-brand-text-primary">6. Thuế & Phí:</strong> Phí dịch vụ sàn được trừ trực tiếp trên doanh thu đơn hàng. Thuế GTGT áp dụng theo <em>Luật Thuế GTGT 2024 (sửa đổi)</em>. Thuế TNCN/TNDN (nếu có) tính theo <em>Luật Quản lý thuế 2019 (Luật 38/2019/QH14)</em> và <em>Nghị định 117/2025/NĐ-CP</em> về quản lý thuế đối với hoạt động kinh doanh TMĐT (hiệu lực 01/07/2025). Mức thuế áp dụng theo biểu thuế lũy tiến do sàn cấu hình.
                                    </div>
                                )}
                                <div>
                                    <strong className="text-brand-text-primary">{selected.taxEnabled ? '7' : '6'}. Giữ tiền & Thanh toán:</strong> Tiền từ mỗi đơn hàng hoàn thành sẽ được tạm giữ <strong>7 ngày</strong> trước khi chuyển vào số dư khả dụng của seller, nhằm đảm bảo quyền khiếu nại của người mua và phòng chống gian lận theo khuyến nghị của Ngân hàng Nhà nước.
                                </div>
                                <div>
                                    <strong className="text-brand-text-primary">{selected.taxEnabled ? '8' : '7'}. Bảo mật thông tin:</strong> Thông tin cá nhân của các bên được thu thập, xử lý và bảo vệ theo <em>Nghị định 13/2023/NĐ-CP</em> về bảo vệ dữ liệu cá nhân (hiệu lực 01/07/2023). Sàn cam kết không chia sẻ thông tin cá nhân cho bên thứ ba trái quy định. Vi phạm có thể bị xử phạt hành chính hoặc xử lý hình sự.
                                </div>
                                <div>
                                    <strong className="text-brand-text-primary">{selected.taxEnabled ? '9' : '8'}. Giải quyết tranh chấp:</strong> Mọi tranh chấp được giải quyết theo trình tự: (a) Thương lượng trực tiếp giữa các bên qua hệ thống sàn — tối đa <strong>15 ngày</strong>; (b) Hòa giải với sự trung gian của sàn — tối đa <strong>30 ngày</strong>; (c) Khởi kiện tại Tòa án nhân dân có thẩm quyền theo <em>Bộ luật Tố tụng dân sự 2015</em>. Luật áp dụng: Pháp luật Việt Nam.
                                </div>
                            </div>

                            {/* Footer pháp lý */}
                            <div className="text-center text-[10px] text-brand-text-muted pt-2 space-y-0.5">
                                <div className="font-semibold text-brand-text-secondary mb-1">Căn cứ pháp lý</div>
                                <div>• Hóa đơn điện tử: <em>NĐ 123/2020/NĐ-CP</em> + <em>TT 78/2021/TT-BTC</em></div>
                                <div>• Giao dịch điện tử: <em>Luật GDĐT 2023 (Luật 20/2023/QH15)</em></div>
                                <div>• Thương mại điện tử: <em>NĐ 52/2013/NĐ-CP</em> sửa đổi bởi <em>NĐ 85/2021/NĐ-CP</em></div>
                                {selected.taxEnabled && <div>• Thuế TMĐT: <em>NĐ 117/2025/NĐ-CP</em> (hiệu lực 01/07/2025)</div>}
                                {selected.taxEnabled && <div>• Quản lý thuế: <em>Luật 38/2019/QH14</em></div>}
                                <div>• Bảo vệ NTD: <em>Luật 19/2023/QH15</em> (hiệu lực 01/07/2024)</div>
                                <div>• Bảo vệ DLCN: <em>NĐ 13/2023/NĐ-CP</em> (hiệu lực 01/07/2023)</div>
                                <div className="font-medium text-brand-text-primary mt-2">© {new Date().getFullYear()} ChoTaiNguyen — Sàn TMĐT tài nguyên số</div>
                                <div className="text-brand-text-muted">Hóa đơn này được tạo tự động và có giá trị pháp lý không cần đóng dấu.</div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="p-4 border-t border-brand-border flex gap-2">
                            <button onClick={exportPDF} disabled={!!exporting}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-brand-danger/10 text-brand-danger hover:bg-brand-danger/20 transition-all disabled:opacity-50">
                                <File className="w-4 h-4" /> Xuất PDF
                            </button>
                            <button onClick={exportImage} disabled={!!exporting}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-all disabled:opacity-50">
                                <ImageIcon className="w-4 h-4" /> Tải ảnh
                            </button>
                            <button onClick={() => { setSelected(null); exportExcel(); }} disabled={!!exporting}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-brand-success/10 text-brand-success hover:bg-brand-success/20 transition-all disabled:opacity-50">
                                <FileSpreadsheet className="w-4 h-4" /> Xuất Excel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
