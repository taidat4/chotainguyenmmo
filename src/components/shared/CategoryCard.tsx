import React from 'react';
import Link from 'next/link';
import { ArrowRight, UserCircle, AppWindow, Brain, Mail, Share2, Globe, Layers, MoreHorizontal } from 'lucide-react';
import type { Category } from '@/lib/mock-data';

const iconMap: Record<string, React.ElementType> = {
    UserCircle, AppWindow, Brain, Mail, Share2, Globe, Layers, MoreHorizontal,
};

export default function CategoryCard({ category }: { category: Category }) {
    const Icon = iconMap[category.icon] || Layers;

    return (
        <Link
            href={`/danh-muc/${category.slug}`}
            className="group bg-brand-surface border border-brand-border rounded-2xl p-5 hover:border-brand-primary/30 hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 flex items-center gap-4"
        >
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary/15 to-brand-secondary/15 flex items-center justify-center shrink-0 group-hover:from-brand-primary/25 group-hover:to-brand-secondary/25 transition-all">
                <Icon className="w-6 h-6 text-brand-primary" />
            </div>

            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-brand-text-primary mb-0.5 group-hover:text-brand-primary transition-colors">
                    {category.name}
                </h3>
                <p className="text-xs text-brand-text-muted">{category.productCount} sản phẩm</p>
            </div>

            <ArrowRight className="w-4 h-4 text-brand-text-muted group-hover:text-brand-primary group-hover:translate-x-1 transition-all shrink-0" />
        </Link>
    );
}
