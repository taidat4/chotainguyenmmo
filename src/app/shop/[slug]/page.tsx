'use client';

import { use } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/shared/ProductCard';
import { shops, products, reviews } from '@/lib/mock-data';
import { CheckCircle, Star, Package, ShieldCheck, MessageSquare, Calendar, ChevronDown } from 'lucide-react';

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const shop = shops.find(s => s.slug === slug) || shops[0];
    const shopProducts = products.filter(p => p.shopId === shop.id);
    const shopReviews = reviews.filter(r => r.shopId === shop.id);

    return (
        <>
            <Header />
            <main className="min-h-screen">
                {/* Shop Banner */}
                <div className="relative h-48 md:h-64 bg-gradient-to-r from-brand-primary/20 to-brand-secondary/20">
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-bg to-transparent" />
                </div>

                <div className="max-w-container mx-auto px-4 -mt-16 relative z-10">
                    {/* Shop Header */}
                    <div className="card mb-8">
                        <div className="flex flex-col md:flex-row items-start gap-6">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center border-2 border-brand-border shrink-0">
                                <span className="text-3xl font-bold gradient-text">{shop.name.charAt(0)}</span>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <h1 className="text-xl font-bold text-brand-text-primary">{shop.name}</h1>
                                    {shop.verified && (
                                        <span className="badge-primary flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Đã xác minh
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-brand-text-secondary mb-4">{shop.description}</p>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                                    {[
                                        { icon: Package, label: 'Sản phẩm', value: shop.productCount },
                                        { icon: ShieldCheck, label: 'Đơn thành công', value: shop.successfulOrdersCount },
                                        { icon: Star, label: 'Đánh giá', value: `${shop.ratingAverage} (${shop.ratingCount})` },
                                        { icon: MessageSquare, label: 'Phản hồi', value: `${shop.responseRate}%` },
                                        { icon: Calendar, label: 'Tham gia', value: shop.joinedAt },
                                    ].map((stat, i) => (
                                        <div key={i} className="text-center bg-brand-surface-2 rounded-xl py-3 px-2">
                                            <stat.icon className="w-4 h-4 text-brand-primary mx-auto mb-1" />
                                            <div className="text-sm font-semibold text-brand-text-primary">{stat.value}</div>
                                            <div className="text-[10px] text-brand-text-muted">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Products */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-brand-text-primary">Sản phẩm ({shopProducts.length})</h2>
                            <div className="relative">
                                <select className="input-field !py-2 text-sm pr-8 appearance-none cursor-pointer min-w-[150px]">
                                    <option>Mới nhất</option>
                                    <option>Bán chạy</option>
                                    <option>Giá thấp → cao</option>
                                    <option>Giá cao → thấp</option>
                                </select>
                                <ChevronDown className="w-4 h-4 text-brand-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>
                        {shopProducts.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {shopProducts.map(product => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>
                        ) : (
                            <div className="card text-center py-16">
                                <div className="text-4xl mb-4">🛍️</div>
                                <h3 className="text-lg font-semibold text-brand-text-primary mb-2">Gian hàng chưa đăng sản phẩm nào</h3>
                                <p className="text-sm text-brand-text-secondary">Các sản phẩm sẽ xuất hiện tại đây khi người bán bắt đầu đăng bán.</p>
                            </div>
                        )}
                    </div>

                    {/* Reviews */}
                    <div className="mb-12">
                        <h2 className="text-lg font-bold text-brand-text-primary mb-6">Đánh giá gian hàng ({shopReviews.length})</h2>
                        <div className="space-y-4">
                            {shopReviews.map(review => (
                                <div key={review.id} className="card">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                            <span className="text-white text-xs font-bold">{review.buyerName.charAt(0)}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-brand-text-primary">{review.buyerName}</div>
                                            <div className="text-xs text-brand-text-muted">{review.productName}</div>
                                        </div>
                                        <div className="flex items-center gap-0.5">
                                            {[...Array(review.rating)].map((_, j) => (
                                                <Star key={j} className="w-3.5 h-3.5 text-brand-warning fill-brand-warning" />
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-sm text-brand-text-secondary">{review.content}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
