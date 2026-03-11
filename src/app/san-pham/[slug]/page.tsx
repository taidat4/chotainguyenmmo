'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/shared/ProductCard';
import { useAuth } from '@/lib/auth-context';
import { products, reviews, shops } from '@/lib/mock-data';
import { formatCurrency } from '@/lib/utils';
import {
    Star, Heart, ShoppingCart, Zap, Clock, Shield, CheckCircle,
    ChevronRight, Package, MessageSquare, Minus, Plus, Store,
    Loader2, AlertCircle, CheckCircle2, X, Copy, ExternalLink
} from 'lucide-react';

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const router = useRouter();
    const { user, updateUser } = useAuth();
    const product = products.find(p => p.slug === slug) || products[0];
    const shop = shops.find(s => s.id === product.shopId);
    const productReviews = reviews.filter(r => r.productId === product.id);
    const relatedProducts = products.filter(p => p.categoryId === product.categoryId && p.id !== product.id).slice(0, 4);
    const [quantity, setQuantity] = useState(1);
    const [activeTab, setActiveTab] = useState('description');

    // Purchase states
    const [showConfirm, setShowConfirm] = useState(false);
    const [purchasing, setPurchasing] = useState(false);
    const [purchaseResult, setPurchaseResult] = useState<{ success: boolean; message: string; order?: { orderCode: string; deliveredContent?: string; status: string }; newBalance?: number } | null>(null);
    const [copied, setCopied] = useState(false);

    const handleBuyClick = () => {
        if (!user) {
            router.push('/dang-nhap');
            return;
        }
        setShowConfirm(true);
    };

    const handleConfirmPurchase = async () => {
        setPurchasing(true);
        try {
            const res = await fetch('/api/v1/orders/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: product.id, quantity }),
            });
            const data = await res.json();
            setShowConfirm(false);
            setPurchaseResult(data);
            if (data.success && data.data) {
                updateUser({ walletBalance: data.data.newBalance });
                setPurchaseResult({ success: true, message: data.message, order: data.data.order, newBalance: data.data.newBalance });
            } else {
                setPurchaseResult({ success: false, message: data.message });
            }
        } catch {
            setShowConfirm(false);
            setPurchaseResult({ success: false, message: 'Không thể kết nối server' });
        }
        setPurchasing(false);
    };

    const handleCopyContent = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const tabs = [
        { id: 'description', label: 'Mô tả' },
        { id: 'delivery', label: 'Giao hàng' },
        { id: 'reviews', label: `Đánh giá (${productReviews.length})` },
        { id: 'policy', label: 'Chính sách' },
        { id: 'faq', label: 'Câu hỏi thường gặp' },
    ];

    return (
        <>
            <Header />
            <main className="min-h-screen">
                <div className="max-w-container mx-auto px-4 py-6">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-brand-text-muted mb-6">
                        <Link href="/" className="hover:text-brand-primary transition-colors">Trang chủ</Link>
                        <ChevronRight className="w-3 h-3" />
                        <Link href="/danh-muc" className="hover:text-brand-primary transition-colors">Danh mục</Link>
                        <ChevronRight className="w-3 h-3" />
                        <span className="text-brand-text-secondary">{product.categoryName}</span>
                        <ChevronRight className="w-3 h-3" />
                        <span className="text-brand-text-primary truncate max-w-[200px]">{product.name}</span>
                    </nav>

                    {/* Product Main */}
                    <div className="grid lg:grid-cols-5 gap-8 mb-12">
                        {/* Gallery */}
                        <div className="lg:col-span-2">
                            <div className="card !p-0 overflow-hidden">
                                <div className="aspect-square bg-gradient-to-br from-brand-surface-2 to-brand-surface-3 flex items-center justify-center">
                                    <div className="w-32 h-32 rounded-3xl bg-brand-primary/10 flex items-center justify-center">
                                        <Package className="w-16 h-16 text-brand-primary/40" />
                                    </div>
                                </div>
                            </div>
                            {/* Thumbnails */}
                            <div className="flex gap-2 mt-3">
                                {[1, 2, 3].map((_, i) => (
                                    <div key={i} className={`w-16 h-16 rounded-xl bg-brand-surface-2 border ${i === 0 ? 'border-brand-primary' : 'border-brand-border'} flex items-center justify-center cursor-pointer hover:border-brand-primary/50 transition-all`}>
                                        <Package className="w-6 h-6 text-brand-text-muted" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Product Info */}
                        <div className="lg:col-span-3">
                            {/* Badges */}
                            <div className="flex flex-wrap gap-2 mb-3">
                                {product.badges.map((badge, i) => (
                                    <span key={i} className={`badge ${badge === 'Bán chạy' ? 'badge-danger' : badge === 'Nổi bật' ? 'badge-primary' : badge === 'Tự động' ? 'badge-info' : badge === 'Uy tín' ? 'badge-success' : 'badge-neutral'}`}>
                                        {badge}
                                    </span>
                                ))}
                            </div>

                            {/* Title */}
                            <h1 className="text-xl md:text-2xl font-bold text-brand-text-primary mb-3">{product.name}</h1>

                            {/* Seller */}
                            <Link href={`/shop/${shop?.slug}`} className="inline-flex items-center gap-2 mb-4 group">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                    <span className="text-[10px] text-white font-bold">{product.shopName.charAt(0)}</span>
                                </div>
                                <span className="text-sm text-brand-text-secondary group-hover:text-brand-primary transition-colors">{product.shopName}</span>
                                {product.shopVerified && <CheckCircle className="w-4 h-4 text-brand-primary" />}
                            </Link>

                            {/* Price */}
                            <div className="flex items-baseline gap-3 mb-4">
                                <span className="text-3xl font-bold text-brand-primary">{formatCurrency(product.price)}</span>
                                {product.compareAtPrice && (
                                    <span className="text-lg text-brand-text-muted line-through">{formatCurrency(product.compareAtPrice)}</span>
                                )}
                                {product.compareAtPrice && (
                                    <span className="badge-danger">-{Math.round((1 - product.price / product.compareAtPrice) * 100)}%</span>
                                )}
                            </div>

                            {/* Meta Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                <div className="bg-brand-surface-2 rounded-xl p-3 text-center">
                                    <div className="text-xs text-brand-text-muted mb-1">Đã bán</div>
                                    <div className="text-sm font-bold text-brand-text-primary">{product.soldCount}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3 text-center">
                                    <div className="text-xs text-brand-text-muted mb-1">Tồn kho</div>
                                    <div className="text-sm font-bold text-brand-success">{product.stockCount}</div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3 text-center">
                                    <div className="text-xs text-brand-text-muted mb-1">Đánh giá</div>
                                    <div className="flex items-center justify-center gap-1">
                                        <Star className="w-3.5 h-3.5 text-brand-warning fill-brand-warning" />
                                        <span className="text-sm font-bold text-brand-text-primary">{product.ratingAverage}</span>
                                        <span className="text-xs text-brand-text-muted">({product.ratingCount})</span>
                                    </div>
                                </div>
                                <div className="bg-brand-surface-2 rounded-xl p-3 text-center">
                                    <div className="text-xs text-brand-text-muted mb-1">Giao hàng</div>
                                    <div className="flex items-center justify-center gap-1">
                                        {product.deliveryType === 'auto' ? (
                                            <>
                                                <Zap className="w-3.5 h-3.5 text-brand-info" />
                                                <span className="text-sm font-bold text-brand-info">Tự động</span>
                                            </>
                                        ) : (
                                            <span className="text-sm font-bold text-brand-text-primary">Thủ công</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Description */}
                            <p className="text-sm text-brand-text-secondary leading-relaxed mb-6">{product.shortDescription}</p>

                            {/* Quantity & Buy */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="flex items-center border border-brand-border rounded-xl">
                                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3 text-brand-text-muted hover:text-brand-text-primary transition-colors">
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="px-4 text-sm font-semibold text-brand-text-primary min-w-[40px] text-center">{quantity}</span>
                                    <button onClick={() => setQuantity(Math.min(product.stockCount, quantity + 1))} className="p-3 text-brand-text-muted hover:text-brand-text-primary transition-colors">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="text-sm text-brand-text-muted">
                                    Tổng: <span className="text-brand-primary font-bold text-lg">{formatCurrency(product.price * quantity)}</span>
                                </div>
                            </div>

                            <div className="flex gap-3 mb-6">
                                <button onClick={handleBuyClick} className="btn-primary flex-1 flex items-center justify-center gap-2 !py-3.5">
                                    <ShoppingCart className="w-5 h-5" /> {user ? 'Mua ngay' : 'Đăng nhập để mua'}
                                </button>
                                <button className="btn-secondary !px-4">
                                    <Heart className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Trust Info */}
                            <div className="space-y-2.5">
                                {[
                                    { icon: Zap, label: product.deliveryType === 'auto' ? 'Giao ngay sau thanh toán' : 'Xử lý trong thời gian quy định', color: 'text-brand-info' },
                                    { icon: Clock, label: `Hỗ trợ khiếu nại trong ${product.complaintWindowHours} giờ`, color: 'text-brand-warning' },
                                    { icon: Shield, label: product.warrantyPolicy.split('.')[0], color: 'text-brand-success' },
                                    { icon: MessageSquare, label: product.supportPolicy, color: 'text-brand-text-muted' },
                                ].map((info, i) => (
                                    <div key={i} className="flex items-center gap-2.5 text-sm text-brand-text-secondary">
                                        <info.icon className={`w-4 h-4 ${info.color} shrink-0`} />
                                        <span>{info.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="mb-12">
                        <div className="flex gap-1 border-b border-brand-border mb-6 overflow-x-auto">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${activeTab === tab.id
                                        ? 'text-brand-primary border-brand-primary'
                                        : 'text-brand-text-muted border-transparent hover:text-brand-text-secondary'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="card">
                            {activeTab === 'description' && (
                                <div className="prose prose-sm max-w-none text-brand-text-secondary leading-relaxed">
                                    <p>{product.description}</p>
                                </div>
                            )}
                            {activeTab === 'delivery' && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Zap className="w-5 h-5 text-brand-info" />
                                        <div>
                                            <div className="text-sm font-medium text-brand-text-primary">
                                                {product.deliveryType === 'auto' ? 'Giao hàng tự động' : 'Giao hàng thủ công'}
                                            </div>
                                            <div className="text-xs text-brand-text-muted">
                                                {product.deliveryType === 'auto' ? 'Giao ngay sau thanh toán' : 'Xử lý trong thời gian quy định'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'reviews' && (
                                <div className="space-y-4">
                                    {productReviews.length > 0 ? productReviews.map(review => (
                                        <div key={review.id} className="border-b border-brand-border pb-4 last:border-0 last:pb-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                                    <span className="text-white text-xs font-bold">{review.buyerName.charAt(0)}</span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-brand-text-primary">{review.buyerName}</div>
                                                    <div className="flex items-center gap-1">
                                                        {[...Array(review.rating)].map((_, j) => (
                                                            <Star key={j} className="w-3 h-3 text-brand-warning fill-brand-warning" />
                                                        ))}
                                                    </div>
                                                </div>
                                                {review.verified && <span className="badge-success ml-auto">Đã mua</span>}
                                            </div>
                                            <p className="text-sm text-brand-text-secondary">{review.content}</p>
                                        </div>
                                    )) : (
                                        <p className="text-sm text-brand-text-muted text-center py-8">Chưa có đánh giá nào cho sản phẩm này.</p>
                                    )}
                                </div>
                            )}
                            {activeTab === 'policy' && (
                                <div className="space-y-4 text-sm text-brand-text-secondary">
                                    <div>
                                        <h4 className="font-medium text-brand-text-primary mb-1">Bảo hành</h4>
                                        <p>{product.warrantyPolicy}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-brand-text-primary mb-1">Hỗ trợ</h4>
                                        <p>{product.supportPolicy}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-brand-text-primary mb-1">Khiếu nại</h4>
                                        <p>Người dùng có thể gửi khiếu nại trong {product.complaintWindowHours} giờ kể từ khi nhận hàng.</p>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'faq' && (
                                <div className="space-y-4 text-sm text-brand-text-secondary">
                                    <div>
                                        <h4 className="font-medium text-brand-text-primary mb-1">Sau khi mua, nhận hàng ở đâu?</h4>
                                        <p>Thông tin giao hàng sẽ hiển thị ngay trong mục Đơn hàng của tôi sau khi thanh toán thành công.</p>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-brand-text-primary mb-1">Nếu sản phẩm lỗi thì sao?</h4>
                                        <p>Bạn có thể tạo khiếu nại trong thời gian hỗ trợ để được xem xét và xử lý.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Seller Info */}
                    {shop && (
                        <div className="card mb-12">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center border border-brand-border">
                                    <span className="text-xl font-bold gradient-text">{shop.name.charAt(0)}</span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-brand-text-primary">{shop.name}</h3>
                                        {shop.verified && <CheckCircle className="w-4 h-4 text-brand-primary" />}
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-xs text-brand-text-muted">
                                        <span>{shop.productCount} sản phẩm</span>
                                        <span>⭐ {shop.ratingAverage}</span>
                                        <span>Phản hồi {shop.responseRate}%</span>
                                    </div>
                                </div>
                                <Link href={`/shop/${shop.slug}`} className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-1.5">
                                    <Store className="w-4 h-4" /> Xem gian hàng
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Related Products */}
                    {relatedProducts.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold text-brand-text-primary mb-6">Sản phẩm liên quan</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                {relatedProducts.map(p => (
                                    <ProductCard key={p.id} product={p} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <Footer />

            {/* Purchase Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !purchasing && setShowConfirm(false)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-md w-full p-6 animate-slide-up">
                        <button onClick={() => !purchasing && setShowConfirm(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2">
                            <X className="w-5 h-5 text-brand-text-muted" />
                        </button>

                        <h2 className="text-lg font-bold text-brand-text-primary mb-4">Xác nhận mua hàng</h2>

                        <div className="bg-brand-surface-2 rounded-xl p-4 mb-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                                    <Package className="w-6 h-6 text-brand-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-brand-text-primary truncate">{product.name}</div>
                                    <div className="text-xs text-brand-text-muted">{product.shopName}</div>
                                </div>
                            </div>
                            <div className="flex justify-between text-sm border-t border-brand-border pt-3">
                                <span className="text-brand-text-muted">Đơn giá</span>
                                <span className="text-brand-text-primary font-medium">{formatCurrency(product.price)}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-brand-text-muted">Số lượng</span>
                                <span className="text-brand-text-primary font-medium">x{quantity}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-brand-text-muted">Giao hàng</span>
                                <span className="text-brand-info font-medium">{product.deliveryType === 'auto' ? '⚡ Tự động' : '📦 Thủ công'}</span>
                            </div>
                            <div className="border-t border-brand-border mt-3 pt-3 flex justify-between">
                                <span className="text-sm font-semibold text-brand-text-primary">Tổng thanh toán</span>
                                <span className="text-lg font-bold text-brand-primary">{formatCurrency(product.price * quantity)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm mb-5 bg-brand-success/5 border border-brand-success/10 rounded-xl px-4 py-2.5">
                            <span className="text-brand-text-muted">Số dư ví hiện tại</span>
                            <span className="text-brand-success font-bold">{formatCurrency(user?.walletBalance || 0)}</span>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirm(false)} disabled={purchasing} className="btn-secondary flex-1 !py-3">Hủy</button>
                            <button onClick={handleConfirmPurchase} disabled={purchasing} className="btn-primary flex-1 !py-3 flex items-center justify-center gap-2">
                                {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                                {purchasing ? 'Đang xử lý...' : 'Xác nhận mua'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase Result Modal */}
            {purchaseResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPurchaseResult(null)} />
                    <div className="relative bg-brand-surface border border-brand-border rounded-2xl shadow-card-hover max-w-lg w-full p-6 animate-slide-up">
                        <button onClick={() => setPurchaseResult(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-brand-surface-2">
                            <X className="w-5 h-5 text-brand-text-muted" />
                        </button>

                        {purchaseResult.success ? (
                            <>
                                <div className="text-center mb-5">
                                    <div className="w-16 h-16 rounded-full bg-brand-success/10 flex items-center justify-center mx-auto mb-3">
                                        <CheckCircle2 className="w-8 h-8 text-brand-success" />
                                    </div>
                                    <h2 className="text-xl font-bold text-brand-text-primary">Mua hàng thành công!</h2>
                                    <p className="text-sm text-brand-text-muted mt-1">Mã đơn: <span className="font-mono font-semibold text-brand-primary">{purchaseResult.order?.orderCode}</span></p>
                                </div>

                                {purchaseResult.order?.deliveredContent && (
                                    <div className="bg-brand-surface-2 border border-brand-border rounded-xl p-4 mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-semibold text-brand-text-primary">📦 Thông tin sản phẩm</h3>
                                            <button
                                                onClick={() => handleCopyContent(purchaseResult.order!.deliveredContent!)}
                                                className="flex items-center gap-1 text-xs text-brand-primary hover:underline"
                                            >
                                                <Copy className="w-3 h-3" /> {copied ? 'Đã copy!' : 'Copy'}
                                            </button>
                                        </div>
                                        <pre className="text-xs text-brand-text-secondary bg-brand-bg rounded-lg p-3 whitespace-pre-wrap font-mono border border-brand-border/50">
                                            {purchaseResult.order.deliveredContent}
                                        </pre>
                                    </div>
                                )}

                                {purchaseResult.order?.status === 'paid' && (
                                    <div className="flex items-center gap-2 bg-brand-warning/10 border border-brand-warning/20 text-brand-warning text-sm rounded-xl px-4 py-3 mb-4">
                                        <Clock className="w-4 h-4 shrink-0" />
                                        Sản phẩm giao thủ công — shop sẽ gửi trong vòng 24 giờ.
                                    </div>
                                )}

                                <div className="flex items-center justify-between text-sm bg-brand-surface-2 rounded-xl px-4 py-3 mb-5">
                                    <span className="text-brand-text-muted">Số dư ví còn lại</span>
                                    <span className="text-brand-success font-bold">{formatCurrency(purchaseResult.newBalance || 0)}</span>
                                </div>

                                <div className="flex gap-3">
                                    <Link href="/dashboard/don-hang" className="btn-secondary flex-1 !py-3 text-center flex items-center justify-center gap-2">
                                        <Package className="w-4 h-4" /> Xem đơn hàng
                                    </Link>
                                    <button onClick={() => setPurchaseResult(null)} className="btn-primary flex-1 !py-3">Tiếp tục mua sắm</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-5">
                                    <div className="w-16 h-16 rounded-full bg-brand-danger/10 flex items-center justify-center mx-auto mb-3">
                                        <AlertCircle className="w-8 h-8 text-brand-danger" />
                                    </div>
                                    <h2 className="text-xl font-bold text-brand-text-primary">Mua hàng thất bại</h2>
                                    <p className="text-sm text-brand-danger mt-2">{purchaseResult.message}</p>
                                </div>
                                <div className="flex gap-3">
                                    <Link href="/dashboard/vi" className="btn-secondary flex-1 !py-3 text-center">Nạp tiền</Link>
                                    <button onClick={() => setPurchaseResult(null)} className="btn-primary flex-1 !py-3">Thử lại</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
