'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { Star, CheckCircle, ArrowRight, Package, ShieldCheck, MessageSquare } from 'lucide-react';

export default function AllShopsPage() {
    const { t } = useI18n();
    const [shops, setShops] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/v1/shops')
            .then(r => r.json())
            .then(d => {
                if (d.success) setShops(d.data || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <>
            <Header />
            <main className="min-h-screen">
                <div className="max-w-container mx-auto px-4 py-8">
                    <h1 className="text-2xl font-bold text-brand-text-primary mb-2">{t('shopsTitle')}</h1>
                    <p className="text-brand-text-secondary mb-8">
                        {t('shopsSubtitle')}
                    </p>
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <div className="w-8 h-8 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
                        </div>
                    ) : shops.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 rounded-2xl bg-brand-surface-2 flex items-center justify-center mx-auto mb-4">
                                <Package className="w-8 h-8 text-brand-text-muted" />
                            </div>
                            <p className="text-brand-text-secondary">{t('shopsEmpty')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {shops.map((shop: any) => (
                                <div key={shop.id} className="group bg-brand-surface border border-brand-border rounded-2xl p-5 hover:border-brand-primary/30 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300">
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 flex items-center justify-center shrink-0 border border-brand-border overflow-hidden">
                                            {shop.logoUrl ? (
                                                <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xl font-bold gradient-text">{shop.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-sm font-semibold text-brand-text-primary truncate">{shop.name}</h3>
                                                {shop.verified && <CheckCircle className="w-4 h-4 text-brand-primary shrink-0" />}
                                            </div>
                                            <p className="text-xs text-brand-text-muted line-clamp-2 mb-3">{shop.shortDescription || t('shopsDefaultDesc')}</p>
                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                                                    <Package className="w-3.5 h-3.5 text-brand-text-muted" />
                                                    <span>{shop.productCount || shop._count?.products || 0} {t('catProductsCount')}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-brand-text-muted" />
                                                    <span>{shop.computedSoldCount || shop.soldCount || 0} {t('shopsSuccessOrders')}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                                                    <Star className={`w-3.5 h-3.5 ${(shop.computedRating || shop.ratingAverage || 0) > 0 ? 'text-brand-warning fill-brand-warning' : 'text-brand-text-muted'}`} />
                                                    <span>{shop.computedRating || shop.ratingAverage || 0} ({shop.computedRatingCount || shop.ratingCount || 0})</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
                                                    <MessageSquare className="w-3.5 h-3.5 text-brand-text-muted" />
                                                    <span>{t('shopsResponse')} {shop.responseRate || 0}%</span>
                                                </div>
                                            </div>
                                            <Link href={`/shop/${shop.slug}`} className="inline-flex items-center gap-1.5 text-xs text-brand-primary font-medium hover:gap-2.5 transition-all">
                                                {t('shopsViewShop')} <ArrowRight className="w-3.5 h-3.5" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}
