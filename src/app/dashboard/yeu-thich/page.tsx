import { products } from '@/lib/mock-data';
import ProductCard from '@/components/shared/ProductCard';
import { Heart } from 'lucide-react';

export default function FavoritesPage() {
    const favoriteProducts = products.slice(0, 8);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-brand-text-primary mb-1">Sản phẩm yêu thích</h1>
                <p className="text-sm text-brand-text-muted">Danh sách các sản phẩm bạn đã lưu để xem lại sau. Hiện có {favoriteProducts.length} sản phẩm.</p>
            </div>

            {favoriteProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {favoriteProducts.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            ) : (
                <div className="card text-center py-16">
                    <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Heart className="w-8 h-8 text-brand-primary/60" />
                    </div>
                    <h3 className="text-lg font-semibold text-brand-text-primary mb-2">Chưa có sản phẩm yêu thích</h3>
                    <p className="text-sm text-brand-text-secondary max-w-sm mx-auto">
                        Nhấn vào biểu tượng trái tim trên sản phẩm để thêm vào danh sách yêu thích.
                    </p>
                </div>
            )}
        </div>
    );
}
