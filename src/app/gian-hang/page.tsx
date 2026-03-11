import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ShopCard from '@/components/shared/ShopCard';
import { shops } from '@/lib/mock-data';

export default function AllShopsPage() {
    return (
        <>
            <Header />
            <main className="min-h-screen">
                <div className="max-w-container mx-auto px-4 py-8">
                    <h1 className="text-2xl font-bold text-brand-text-primary mb-2">Gian hàng trên ChoTaiNguyen</h1>
                    <p className="text-brand-text-secondary mb-8">
                        Khám phá các gian hàng đang hoạt động trên nền tảng, mỗi gian hàng mang đến sản phẩm riêng biệt.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {shops.map((shop) => (
                            <ShopCard key={shop.id} shop={shop} />
                        ))}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
