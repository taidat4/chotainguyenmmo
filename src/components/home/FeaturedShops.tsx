import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { shops } from '@/lib/mock-data';
import ShopCard from '@/components/shared/ShopCard';

export default function FeaturedShops() {
    const featured = shops.filter(s => s.verified).slice(0, 4);

    return (
        <section className="section-padding">
            <div className="max-w-container mx-auto px-4">
                <div className="flex items-end justify-between mb-10">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-3">Gian hàng nổi bật</h2>
                        <p className="text-brand-text-secondary">
                            Những gian hàng hoạt động ổn định, có đánh giá tốt và được nhiều người dùng lựa chọn.
                        </p>
                    </div>
                    <Link href="/gian-hang" className="hidden md:flex items-center gap-1.5 text-sm text-brand-primary font-medium hover:gap-2.5 transition-all shrink-0">
                        Xem tất cả <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {featured.map((shop) => (
                        <ShopCard key={shop.id} shop={shop} />
                    ))}
                </div>
            </div>
        </section>
    );
}
