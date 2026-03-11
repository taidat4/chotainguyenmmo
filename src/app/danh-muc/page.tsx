import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/shared/ProductCard';
import CategoryCard from '@/components/shared/CategoryCard';
import { products, categories } from '@/lib/mock-data';

export default function AllCategoriesPage() {
    return (
        <>
            <Header />
            <main className="min-h-screen">
                <div className="max-w-container mx-auto px-4 py-8">
                    <h1 className="text-2xl font-bold text-brand-text-primary mb-2">Tất cả danh mục</h1>
                    <p className="text-brand-text-secondary mb-8">
                        Tìm nhanh sản phẩm theo nhóm tài nguyên số bạn cần.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                        {categories.map((cat) => (
                            <CategoryCard key={cat.id} category={cat} />
                        ))}
                    </div>

                    <h2 className="text-xl font-bold text-brand-text-primary mb-6">Tất cả sản phẩm</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {products.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
