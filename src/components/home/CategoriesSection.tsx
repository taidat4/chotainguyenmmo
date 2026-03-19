import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import prisma from '@/lib/prisma';

export default async function CategoriesSection() {
    let categories: any[] = [];
    try {
        categories = await prisma.category.findMany({
            where: { isActive: true, parentId: null },
            orderBy: { sortOrder: 'asc' },
            include: {
                _count: { select: { products: { where: { status: 'ACTIVE' } } } },
            },
        });
    } catch { }

    // Show max 6 categories in a single compact row
    const shown = categories.slice(0, 6);

    return (
        <section className="py-4">
            <div className="max-w-container mx-auto px-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {shown.map((cat) => (
                        <Link
                            key={cat.id}
                            href={`/danh-muc/${cat.slug}`}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-surface border border-brand-border rounded-full hover:border-brand-primary/30 hover:bg-brand-primary/5 transition-all shrink-0 group"
                        >
                            <span className="text-sm font-medium text-brand-text-secondary group-hover:text-brand-primary transition-colors">{cat.name}</span>
                            <span className="text-[10px] text-brand-text-muted bg-brand-surface-2 px-1.5 py-0.5 rounded-full">{cat._count?.products || 0}</span>
                        </Link>
                    ))}
                    {categories.length > 6 && (
                        <Link href="/danh-muc" className="flex items-center gap-1 px-4 py-2 text-sm text-brand-primary font-medium hover:gap-2 transition-all shrink-0">
                            Tất cả <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    )}
                </div>
            </div>
        </section>
    );
}
