import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/v1/products — Public product listing with filters
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
        const category = searchParams.get('category');
        const shop = searchParams.get('shop');
        const search = searchParams.get('q');
        const sort = searchParams.get('sort') || 'newest';
        const minPrice = searchParams.get('minPrice');
        const maxPrice = searchParams.get('maxPrice');
        const featured = searchParams.get('featured');

        // Build where clause
        const where: Record<string, unknown> = { status: 'ACTIVE' };

        if (category) {
            where.category = { slug: category };
        }
        if (shop) {
            where.shop = { slug: shop };
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { shortDescription: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (minPrice) where.price = { ...((where.price as object) || {}), gte: parseInt(minPrice) };
        if (maxPrice) where.price = { ...((where.price as object) || {}), lte: parseInt(maxPrice) };
        if (featured === 'true') where.isFeatured = true;

        // Sort
        let orderBy: Record<string, string> = { createdAt: 'desc' };
        if (sort === 'price_asc') orderBy = { price: 'asc' };
        else if (sort === 'price_desc') orderBy = { price: 'desc' };
        else if (sort === 'bestselling') orderBy = { soldCount: 'desc' };
        else if (sort === 'rating') orderBy = { ratingAverage: 'desc' };

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    category: { select: { name: true, slug: true } },
                    shop: { select: { name: true, slug: true, verified: true, logoUrl: true } },
                    images: { take: 1, orderBy: { sortOrder: 'asc' } },
                },
            }),
            prisma.product.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                products,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        console.error('List products error:', error);
        return NextResponse.json(
            { success: false, message: 'Lỗi hệ thống', errorCode: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}
