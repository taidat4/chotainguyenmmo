'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/shared/ProductCard';
import { products } from '@/lib/mock-data';
import { Search, SlidersHorizontal } from 'lucide-react';

function SearchResults() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q') || '';

    const filteredProducts = query
        ? products.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.description.toLowerCase().includes(query.toLowerCase()) ||
            p.categoryName.toLowerCase().includes(query.toLowerCase()) ||
            p.shopName.toLowerCase().includes(query.toLowerCase())
        )
        : products;

    return (
        <>
            <Header />
            <main className="min-h-screen bg-brand-bg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                    {/* Search Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <Search className="w-6 h-6 text-brand-primary" />
                            <h1 className="text-2xl font-bold text-brand-text-primary">
                                {query ? `Kết quả tìm kiếm: "${query}"` : 'Tất cả sản phẩm'}
                            </h1>
                        </div>
                        <p className="text-sm text-brand-text-muted">
                            Tìm thấy <span className="font-semibold text-brand-primary">{filteredProducts.length}</span> sản phẩm
                        </p>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex items-center gap-3 mb-6 flex-wrap">
                        <div className="flex items-center gap-2 text-sm text-brand-text-muted">
                            <SlidersHorizontal className="w-4 h-4" />
                            <span>Sắp xếp:</span>
                        </div>
                        {['Phổ biến', 'Mới nhất', 'Giá thấp', 'Giá cao', 'Bán chạy'].map((filter) => (
                            <button key={filter} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-border text-brand-text-secondary hover:border-brand-primary hover:text-brand-primary hover:bg-brand-primary/5 transition-all">
                                {filter}
                            </button>
                        ))}
                    </div>

                    {/* Results Grid */}
                    {filteredProducts.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {filteredProducts.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <Search className="w-16 h-16 text-brand-text-muted/30 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-brand-text-primary mb-2">Không tìm thấy sản phẩm</h3>
                            <p className="text-sm text-brand-text-muted">
                                Thử tìm kiếm với từ khóa khác hoặc <a href="/san-pham" className="text-brand-primary hover:underline">xem tất cả sản phẩm</a>.
                            </p>
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full" />
            </div>
        }>
            <SearchResults />
        </Suspense>
    );
}
