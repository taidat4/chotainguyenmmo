'use client';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Code2, Key, ShoppingBag, Search, Wallet, FileSpreadsheet, Shield, Zap } from 'lucide-react';
import Link from 'next/link';

const endpoints = [
    {
        method: 'GET',
        path: '/api/v1/public/products',
        title: 'Danh sách sản phẩm',
        description: 'Lấy tất cả sản phẩm, hỗ trợ tìm kiếm & phân trang',
        params: [
            { name: 'q', type: 'string', desc: 'Từ khóa tìm kiếm' },
            { name: 'id', type: 'string', desc: 'Lấy 1 sản phẩm theo ID' },
            { name: 'category', type: 'string', desc: 'Lọc theo danh mục' },
            { name: 'page', type: 'number', desc: 'Trang (mặc định: 1)' },
            { name: 'limit', type: 'number', desc: 'Số lượng/trang (tối đa 100)' },
        ],
        example: `curl -H "x-api-key: YOUR_KEY" \\
  "https://chotainguyen.vn/api/v1/public/products?q=netflix&limit=5"`,
        response: `{
  "success": true,
  "data": [
    {
      "id": "prod-1",
      "name": "Netflix Premium 1 Tháng",
      "price": 30000,
      "category": "Tài khoản Giải trí",
      "shop": "DigitalStore",
      "inStock": true,
      "stock": 45
    }
  ],
  "pagination": { "page": 1, "total": 12 }
}`,
    },
    {
        method: 'POST',
        path: '/api/v1/public/purchase',
        title: 'Mua sản phẩm',
        description: 'Mua sản phẩm bằng số dư ví. Trả về key/account ngay lập tức.',
        params: [
            { name: 'productId', type: 'string', desc: 'ID sản phẩm (bắt buộc)' },
            { name: 'quantity', type: 'number', desc: 'Số lượng (1-10, mặc định: 1)' },
        ],
        example: `curl -X POST -H "x-api-key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"productId":"prod-1","quantity":2}' \\
  "https://chotainguyen.vn/api/v1/public/purchase"`,
        response: `{
  "success": true,
  "message": "Mua thành công 2x Netflix Premium",
  "data": {
    "orderId": "ORD-M5K2A1",
    "items": [
      "netflix_acc_01@gmail.com:Pass123",
      "netflix_acc_02@gmail.com:Pass456"
    ],
    "totalPrice": 60000,
    "balanceAfter": 4940000
  }
}`,
    },
    {
        method: 'GET',
        path: '/api/v1/public/orders',
        title: 'Lịch sử đơn hàng',
        description: 'Xem tất cả đơn hàng đã mua qua API',
        params: [
            { name: 'page', type: 'number', desc: 'Trang' },
            { name: 'limit', type: 'number', desc: 'Số lượng/trang' },
        ],
        example: `curl -H "x-api-key: YOUR_KEY" \\
  "https://chotainguyen.vn/api/v1/public/orders"`,
        response: `{
  "data": [{
    "orderId": "ORD-M5K2A1",
    "product": "Netflix Premium",
    "items": ["acc@gmail.com:pass"],
    "totalPrice": 30000,
    "status": "COMPLETED"
  }]
}`,
    },
    {
        method: 'GET',
        path: '/api/v1/public/orders?type=balance',
        title: 'Kiểm tra số dư',
        description: 'Xem số dư ví hiện tại',
        params: [],
        example: `curl -H "x-api-key: YOUR_KEY" \\
  "https://chotainguyen.vn/api/v1/public/orders?type=balance"`,
        response: `{
  "data": {
    "balance": 5000000,
    "currency": "VND",
    "username": "taidat"
  }
}`,
    },
];

export default function ApiDocsPage() {
    return (
        <>
            <Header />
            <main className="min-h-screen bg-brand-bg">
                {/* Hero */}
                <div className="bg-gradient-to-b from-brand-surface to-brand-bg border-b border-brand-border">
                    <div className="container-custom py-12 text-center space-y-4">
                        <div className="flex items-center justify-center gap-2.5 mb-3">
                            <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
                                <Code2 className="w-6 h-6 text-brand-primary" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-brand-text-primary">ChoTaiNguyen API</h1>
                        <p className="text-brand-text-muted text-sm max-w-lg mx-auto">
                            Tích hợp API để mua hàng tự động, xây dựng bot Telegram, hoặc kết nối vào hệ thống bán hàng của bạn.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <Link href="/dashboard/api-keys" className="btn-primary text-sm flex items-center gap-1.5">
                                <Key className="w-4 h-4" /> Tạo API Key
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="container-custom py-10 space-y-10">
                    {/* Auth Section */}
                    <section className="card space-y-4">
                        <h2 className="text-lg font-bold text-brand-text-primary flex items-center gap-2">
                            <Shield className="w-5 h-5 text-brand-primary" /> Xác thực (Authentication)
                        </h2>
                        <p className="text-sm text-brand-text-secondary">
                            Tất cả API yêu cầu <strong>API Key</strong>. Truyền key qua header hoặc query param:
                        </p>
                        <div className="bg-brand-surface-2 rounded-xl p-4 font-mono text-sm text-brand-text-secondary space-y-1.5">
                            <div><span className="text-brand-info">// Header (khuyên dùng)</span></div>
                            <div>x-api-key: <span className="text-brand-success">ctn_live_xxxxxxxxxxxx</span></div>
                            <div className="mt-2"><span className="text-brand-info">// Query param</span></div>
                            <div>?api_key=<span className="text-brand-success">ctn_live_xxxxxxxxxxxx</span></div>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-3 mt-4">
                            <div className="bg-brand-surface-2 rounded-xl p-3 text-center">
                                <Zap className="w-5 h-5 text-brand-warning mx-auto mb-1" />
                                <div className="text-xs font-medium text-brand-text-primary">Rate Limit</div>
                                <div className="text-[10px] text-brand-text-muted">60-120 req/phút</div>
                            </div>
                            <div className="bg-brand-surface-2 rounded-xl p-3 text-center">
                                <Wallet className="w-5 h-5 text-brand-success mx-auto mb-1" />
                                <div className="text-xs font-medium text-brand-text-primary">Thanh toán</div>
                                <div className="text-[10px] text-brand-text-muted">Trừ từ số dư ví</div>
                            </div>
                            <div className="bg-brand-surface-2 rounded-xl p-3 text-center">
                                <FileSpreadsheet className="w-5 h-5 text-brand-info mx-auto mb-1" />
                                <div className="text-xs font-medium text-brand-text-primary">Google Sheets</div>
                                <div className="text-[10px] text-brand-text-muted">Seller sync stock</div>
                            </div>
                        </div>
                    </section>

                    {/* Endpoints */}
                    {endpoints.map((ep, i) => (
                        <section key={i} className="card space-y-4">
                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${ep.method === 'GET' ? 'bg-brand-success/15 text-brand-success' : 'bg-brand-warning/15 text-brand-warning'}`}>
                                    {ep.method}
                                </span>
                                <code className="text-sm font-mono text-brand-text-primary">{ep.path}</code>
                            </div>
                            <h3 className="text-base font-semibold text-brand-text-primary">{ep.title}</h3>
                            <p className="text-sm text-brand-text-muted">{ep.description}</p>

                            {ep.params.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-brand-text-secondary mb-2">Parameters</h4>
                                    <div className="bg-brand-surface-2 rounded-xl overflow-hidden">
                                        {ep.params.map((p, j) => (
                                            <div key={j} className="flex items-center gap-3 px-4 py-2 border-b border-brand-border last:border-0">
                                                <code className="text-xs font-mono text-brand-primary w-24 shrink-0">{p.name}</code>
                                                <span className="text-[10px] text-brand-text-muted bg-brand-bg px-1.5 py-0.5 rounded">{p.type}</span>
                                                <span className="text-xs text-brand-text-secondary">{p.desc}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-xs font-semibold text-brand-text-secondary mb-2">Request</h4>
                                    <pre className="bg-[#1e1e2e] text-[#cdd6f4] rounded-xl p-4 text-xs overflow-x-auto font-mono leading-relaxed">{ep.example}</pre>
                                </div>
                                <div>
                                    <h4 className="text-xs font-semibold text-brand-text-secondary mb-2">Response</h4>
                                    <pre className="bg-[#1e1e2e] text-[#a6e3a1] rounded-xl p-4 text-xs overflow-x-auto font-mono leading-relaxed">{ep.response}</pre>
                                </div>
                            </div>
                        </section>
                    ))}

                    {/* Google Sheets for Sellers */}
                    <section className="card space-y-4">
                        <h2 className="text-lg font-bold text-brand-text-primary flex items-center gap-2">
                            <FileSpreadsheet className="w-5 h-5 text-brand-info" /> Google Sheets Sync (Seller)
                        </h2>
                        <p className="text-sm text-brand-text-secondary">
                            Seller có thể quản lý tồn kho trực tiếp trên Google Sheets. Hệ thống tự động đồng bộ mỗi 5 phút.
                        </p>
                        <div className="bg-brand-info/5 border border-brand-info/20 rounded-xl p-5 space-y-3">
                            <h4 className="text-sm font-semibold text-brand-info">Cách thiết lập:</h4>
                            <ol className="text-sm text-brand-text-secondary space-y-2 list-decimal list-inside">
                                <li>Tạo Google Sheet với cột: <code className="text-brand-primary">Key/Account | Password | Email | Status</code></li>
                                <li>Share sheet với <code className="text-brand-primary font-medium">service@chotainguyen.iam.gserviceaccount.com</code> (quyền Viewer)</li>
                                <li>Vào <Link href="/dashboard/api-keys" className="text-brand-primary underline">Dashboard → API Keys</Link> → Dán link sheet</li>
                                <li>Hệ thống tự động sync stock. Khi khách mua, dòng sẽ được đánh dấu <code className="text-brand-danger">Đã bán</code></li>
                            </ol>
                        </div>
                        <div className="bg-brand-surface-2 rounded-xl p-4">
                            <h4 className="text-xs font-semibold text-brand-text-secondary mb-2">Ví dụ Google Sheet:</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-brand-border">
                                            <th className="text-left p-2 font-medium text-brand-text-muted">Key/Account</th>
                                            <th className="text-left p-2 font-medium text-brand-text-muted">Password</th>
                                            <th className="text-left p-2 font-medium text-brand-text-muted">Email</th>
                                            <th className="text-left p-2 font-medium text-brand-text-muted">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-mono">
                                        <tr className="border-b border-brand-border/50"><td className="p-2 text-brand-text-primary">netflix_001</td><td className="p-2">Pass@123</td><td className="p-2">acc1@gmail.com</td><td className="p-2 text-brand-success">Available</td></tr>
                                        <tr className="border-b border-brand-border/50"><td className="p-2 text-brand-text-primary">netflix_002</td><td className="p-2">Pass@456</td><td className="p-2">acc2@gmail.com</td><td className="p-2 text-brand-success">Available</td></tr>
                                        <tr className="opacity-50"><td className="p-2 text-brand-text-primary">netflix_003</td><td className="p-2">Pass@789</td><td className="p-2">acc3@gmail.com</td><td className="p-2 text-brand-danger">Đã bán</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
            <Footer />
        </>
    );
}
