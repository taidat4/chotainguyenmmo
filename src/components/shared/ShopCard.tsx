import Link from 'next/link';
import { Star, CheckCircle, ArrowRight, Package, ShieldCheck, MessageSquare } from 'lucide-react';
import type { Shop } from '@/lib/mock-data';

export default function ShopCard({ shop }: { shop: Shop }) {
    return (
        <div className="group bg-brand-surface border border-brand-border rounded-2xl p-5 hover:border-brand-primary/30 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center shrink-0 border border-brand-border">
                    <span className="text-xl font-bold gradient-text">{shop.name.charAt(0)}</span>
                </div>

                <div className="flex-1 min-w-0">
                    {/* Name + Verified */}
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-brand-text-primary truncate">{shop.name}</h3>
                        {shop.verified && (
                            <CheckCircle className="w-4 h-4 text-brand-primary shrink-0" />
                        )}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-brand-text-muted line-clamp-2 mb-3">{shop.shortDescription}</p>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                            <Package className="w-3.5 h-3.5 text-brand-text-muted" />
                            <span>{shop.productCount} sản phẩm</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                            <ShieldCheck className="w-3.5 h-3.5 text-brand-text-muted" />
                            <span>{shop.successfulOrdersCount} đơn thành công</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                            <Star className="w-3.5 h-3.5 text-brand-warning fill-brand-warning" />
                            <span>{shop.ratingAverage} ({shop.ratingCount})</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                            <MessageSquare className="w-3.5 h-3.5 text-brand-text-muted" />
                            <span>Phản hồi {shop.responseRate}%</span>
                        </div>
                    </div>

                    {/* Action */}
                    <Link
                        href={`/shop/${shop.slug}`}
                        className="inline-flex items-center gap-1.5 text-xs text-brand-primary font-medium hover:gap-2.5 transition-all"
                    >
                        Xem gian hàng <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
