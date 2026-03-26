'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, ShoppingCart, Star, Zap, Trash2, Store, Package } from 'lucide-react';
import { useCurrency } from '@/lib/currency';
import { useI18n } from '@/lib/i18n';

interface FavoriteItem {
    id: string;
    productId: string;
    addedAt: string;
    product: {
        id: string;
        name: string;
        slug: string;
        price: number;
        soldCount: number;
        stockCountCached: number;
        ratingAverage: number;
        deliveryType: string;
        status: string;
        images: { url: string }[];
        category: { name: string; slug: string };
        shop: { name: string; slug: string; verified: boolean };
    };
}

export default function FavoritesPage() {
    const { t } = useI18n();
    const { formatVnd: formatCurrency } = useCurrency();
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFavorites = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/favorites', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) setFavorites(data.data);
        } catch {}
        setLoading(false);
    };

    useEffect(() => { fetchFavorites(); }, []);

    const removeFavorite = async (productId: string) => {
        try {
            const token = localStorage.getItem('token') || '';
            const res = await fetch('/api/v1/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ productId }),
            });
            const data = await res.json();
            if (data.success) {
                setFavorites(prev => prev.filter(f => f.productId !== productId));
            }
        } catch {}
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">{t('wishlistTitle')}</h1>
                <p className="text-sm text-brand-text-muted">{t('wishlistSubtitle')}</p>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
                </div>
            ) : favorites.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {favorites.map((fav) => {
                        const p = fav.product;
                        if (!p) return null;
                        return (
                            <div key={fav.id} className="group bg-brand-surface border border-brand-border rounded-2xl overflow-hidden hover:border-brand-primary/30 hover:shadow-card-hover transition-all duration-300">
                                {/* Image */}
                                <div className="relative h-40 bg-gradient-to-br from-brand-surface-2 to-brand-surface-3 flex items-center justify-center overflow-hidden">
                                    {p.images?.[0]?.url ? (
                                        <img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
                                            <ShoppingCart className="w-8 h-8 text-brand-primary/60" />
                                        </div>
                                    )}
                                    {/* Remove button */}
                                    <button
                                        onClick={(e) => { e.preventDefault(); removeFavorite(p.id); }}
                                        className="absolute top-2 right-2 p-2 rounded-xl bg-white/90 text-red-500 hover:bg-red-50 hover:text-red-600 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                                        title="Bỏ yêu thích"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    {/* Favorited badge */}
                                    <div className="absolute top-2 left-2 p-1.5 rounded-lg bg-red-500/90">
                                        <Heart className="w-3.5 h-3.5 text-white fill-white" />
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    <div className="text-[11px] text-brand-text-muted font-medium mb-1.5">{p.category?.name}</div>
                                    <Link href={`/san-pham/${p.slug}`}>
                                        <h3 className="text-sm font-semibold text-brand-text-primary line-clamp-2 hover:text-brand-primary transition-colors mb-2 leading-snug min-h-[2.5em]">{p.name}</h3>
                                    </Link>
                                    <div className="flex items-center gap-2 text-[11px] text-brand-text-muted mb-3">
                                        <span className="flex items-center gap-1">
                                            <Store className="w-3 h-3" />
                                            <span className="truncate max-w-[100px]">{p.shop?.name}</span>
                                        </span>
                                        <span className="flex items-center gap-0.5 text-brand-warning">
                                            <Star className="w-3 h-3 fill-brand-warning" />{p.ratingAverage || 0}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-2 mb-3">
                                        <span className="text-lg font-bold text-brand-primary">{formatCurrency(p.price)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-brand-text-muted mb-3">
                                        <span>Đã bán {p.soldCount}</span>
                                        <span className="flex items-center gap-1">
                                            {p.deliveryType === 'AUTO' ? (
                                                <><Zap className="w-3 h-3 text-brand-info" /><span className="text-brand-info">Tự động</span></>
                                            ) : (
                                                <span>Thủ công</span>
                                            )}
                                        </span>
                                        <span>Kho: {p.stockCountCached || 0}</span>
                                    </div>
                                    <Link href={`/san-pham/${p.slug}`} className="block w-full text-center bg-brand-primary/10 text-brand-primary text-sm font-medium py-2 rounded-xl hover:bg-brand-primary hover:text-white transition-all">
                                        Mua ngay
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="card text-center py-16">
                    <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Heart className="w-8 h-8 text-brand-primary/60" />
                    </div>
                    <h3 className="text-lg font-semibold text-brand-text-primary mb-2">{t('wishlistEmpty')}</h3>
                    <p className="text-sm text-brand-text-muted mb-4">Khám phá sản phẩm và thêm vào danh sách yêu thích</p>
                    <Link href="/danh-muc" className="btn-primary !px-6">
                        Khám phá sản phẩm
                    </Link>
                </div>
            )}
        </div>
    );
}
