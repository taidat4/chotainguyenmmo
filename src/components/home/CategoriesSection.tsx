import { categories } from '@/lib/mock-data';
import CategoryCard from '@/components/shared/CategoryCard';

export default function CategoriesSection() {
    return (
        <section className="section-padding">
            <div className="max-w-container mx-auto px-4">
                <div className="text-center mb-10">
                    <h2 className="text-2xl md:text-3xl font-bold text-brand-text-primary mb-3">Danh mục nổi bật</h2>
                    <p className="text-brand-text-secondary max-w-lg mx-auto">
                        Tìm nhanh những nhóm tài nguyên số được quan tâm nhiều nhất trên hệ thống.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {categories.map((cat) => (
                        <CategoryCard key={cat.id} category={cat} />
                    ))}
                </div>
            </div>
        </section>
    );
}
