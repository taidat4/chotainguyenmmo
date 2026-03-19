import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/v1/shops/[slug] — Public shop detail + products + owner profile
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;

        const shop = await prisma.shop.findUnique({
            where: { slug },
            include: {
                owner: {
                    select: {
                        id: true,
                        username: true,
                        fullName: true,
                        avatarUrl: true,
                        createdAt: true,
                        lastLoginAt: true,
                    },
                },
                products: {
                    where: { status: 'ACTIVE' },
                    orderBy: { soldCount: 'desc' },
                    include: {
                        images: { take: 1, orderBy: { sortOrder: 'asc' } },
                        variants: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
                        category: { select: { name: true, slug: true } },
                    },
                },
            },
        });

        if (!shop || shop.status !== 'ACTIVE') {
            return NextResponse.json({ success: false, message: 'Gian hàng không tồn tại' }, { status: 404 });
        }

        // Dynamic order count — count actual completed/delivered/paid orders
        const orderCount = await prisma.order.count({
            where: {
                shopId: shop.id,
                status: { in: ['COMPLETED', 'DELIVERED', 'PAID'] },
            },
        });

        // Dynamic rating from reviews
        const reviewAgg = await prisma.review.aggregate({
            where: {
                product: { shopId: shop.id },
                status: 'ACTIVE',
            },
            _avg: { rating: true },
            _count: { rating: true },
        });

        return NextResponse.json({
            success: true,
            data: {
                ...shop,
                successfulOrdersCount: orderCount,
                ratingAverage: Math.round((reviewAgg._avg.rating || 0) * 10) / 10,
                ratingCount: reviewAgg._count.rating || 0,
            },
        });
    } catch (error) {
        console.error('Shop detail error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
