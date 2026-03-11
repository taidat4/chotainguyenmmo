import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { products } from '@/lib/mock-data';
import ProductCard from '@/components/shared/ProductCard';

export default function FeaturedProducts() {
    const featured = products.filter(p => p.isFeatured || p.isHot).slice(0, 8);

    return (
        <section className="section-padding bg-brand-surface/30">
            <div className="max-w-container mx-auto px-4">
                <div className="flex items-end justify-between mb-10">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-3">Sản phẩm nổi bật</h2>
                        <p className="text-brand-text-secondary">
                            Những sản phẩm đang được quan tâm nhiều, cập nhật liên tục từ các gian hàng trên hệ thống.
                        </p>
                    </div>
                    <Link href="/danh-muc" className="hidden md:flex items-center gap-1.5 text-sm text-brand-primary font-medium hover:gap-2.5 transition-all shrink-0">
                        Xem tất cả <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {featured.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
                <div className="mt-8 text-center md:hidden">
                    <Link href="/danh-muc" className="btn-secondary inline-flex items-center gap-2">
                        Xem tất cả sản phẩm <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </section>
    );
}
