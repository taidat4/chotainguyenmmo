import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/v1/products/[slug]
 * Fetch a single product by slug with full detail for the product page
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        const product = await prisma.product.findFirst({
            where: { slug, status: 'ACTIVE' },
            include: {
                category: { select: { name: true, slug: true } },
                shop: {
                    select: {
                        name: true,
                        slug: true,
                        verified: true,
                        logoUrl: true,
                        ratingAverage: true,
                        ownerId: true,
                        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
                    },
                },
                images: { orderBy: { sortOrder: 'asc' } },
                variants: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' },
                    select: { id: true, name: true, price: true, warrantyDays: true, isActive: true },
                },
            },
        });

        if (!product) {
            return NextResponse.json(
                { success: false, message: 'Sản phẩm không tồn tại hoặc đã ngừng bán' },
                { status: 404 }
            );
        }

        // Flatten shop productCount
        const data = {
            ...product,
            shop: {
                name: product.shop.name,
                slug: product.shop.slug,
                verified: product.shop.verified,
                logoUrl: product.shop.logoUrl,
                ratingAverage: product.shop.ratingAverage,
                ownerId: product.shop.ownerId,
                productCount: (product.shop as any)._count?.products || 0,
            },
        };

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[Product Detail] Error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi server' },
            { status: 500 }
        );
    }
}
