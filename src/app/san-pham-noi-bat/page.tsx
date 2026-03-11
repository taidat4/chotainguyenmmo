import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/shared/ProductCard';
import { products } from '@/lib/mock-data';
import { Star, TrendingUp, Award, Flame } from 'lucide-react';

export default function FeaturedProductsPage() {
    // Sort by rating & sold count to get top products
    const topRated = [...products]
        .sort((a, b) => b.ratingAverage - a.ratingAverage || b.soldCount - a.soldCount)
        .slice(0, 8);

    const bestSelling = [...products]
        .sort((a, b) => b.soldCount - a.soldCount)
        .slice(0, 8);

    const hotProducts = products.filter(p => p.isHot || p.isFeatured);

    return (
        <>
            <Header />
            <main className="min-h-screen bg-brand-bg">
                {/* Hero Banner */}
                <div className="bg-gradient-to-br from-brand-primary via-brand-secondary to-brand-primary/80 py-12">
                    <div className="max-w-container mx-auto px-4 text-center">
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                            🔥 Sản phẩm nổi bật
                        </h1>
                        <p className="text-white/80 max-w-2xl mx-auto">
                            Tổng hợp sản phẩm bán chạy nhất, đánh giá cao nhất từ các gian hàng uy tín trên ChoTaiNguyen.
                        </p>
                    </div>
                </div>

                <div className="max-w-container mx-auto px-4 py-10 space-y-14">
                    {/* Hot Products */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                                <Flame className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-brand-text-primary">Đang hot</h2>
                                <p className="text-sm text-brand-text-muted">Sản phẩm được quan tâm nhiều nhất hiện tại</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {hotProducts.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </section>

                    {/* Best Selling */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-brand-text-primary">Bán chạy nhất</h2>
                                <p className="text-sm text-brand-text-muted">Top sản phẩm có lượng bán cao nhất trên sàn</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {bestSelling.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </section>

                    {/* Top Rated */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
                                <Star className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-brand-text-primary">Đánh giá cao nhất</h2>
                                <p className="text-sm text-brand-text-muted">Sản phẩm được người mua đánh giá tốt nhất</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {topRated.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </section>
                </div>
            </main>
            <Footer />
        </>
    );
}
