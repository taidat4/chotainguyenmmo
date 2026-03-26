import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/v1/admin/sellers/[shopId] — Detailed seller profile for admin
export async function GET(
    request: NextRequest,
    { params }: { params: { shopId: string } }
) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    if (!['ADMIN', 'SUPER_ADMIN'].includes((authResult as any).role || '')) {
        return NextResponse.json({ success: false, message: 'Không có quyền' }, { status: 403 });
    }

    const { shopId } = params;

    try {
        const shop = await prisma.shop.findUnique({
            where: { id: shopId },
            include: {
                owner: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        fullName: true,
                        phone: true,
                        createdAt: true,
                        lastLoginAt: true,
                        wallet: {
                            select: {
                                availableBalance: true,
                                heldBalance: true,
                                totalDeposited: true,
                                totalSpent: true,
                                totalWithdrawn: true,
                            },
                        },
                    },
                },
                products: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        price: true,
                        status: true,
                        soldCount: true,
                        stockCountCached: true,
                        ratingAverage: true,
                        images: { select: { url: true }, take: 1 },
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
            },
        });

        if (!shop) {
            return NextResponse.json({ success: false, message: 'Shop không tồn tại' }, { status: 404 });
        }

        // Aggregate order stats
        const [totalOrdersCount, completedOrdersCount, orderRevenue] = await Promise.all([
            prisma.order.count({ where: { shopId } }),
            prisma.order.count({ where: { shopId, status: 'COMPLETED' } }),
            prisma.order.aggregate({
                where: { shopId, status: { in: ['COMPLETED', 'PAID', 'PROCESSING'] } },
                _sum: { totalAmount: true },
            }),
        ]);

        // Complaint stats
        const [totalComplaints, resolvedComplaints] = await Promise.all([
            prisma.complaint.count({ where: { shopId } }),
            prisma.complaint.count({ where: { shopId, status: { in: ['RESOLVED', 'REJECTED'] } } }),
        ]);

        // Recent orders
        const recentOrders = await prisma.order.findMany({
            where: { shopId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                orderCode: true,
                totalAmount: true,
                status: true,
                createdAt: true,
                buyer: { select: { username: true, fullName: true } },
            },
        });

        // Product count by status
        const productStats = await prisma.product.groupBy({
            by: ['status'],
            where: { shopId },
            _count: true,
        });

        // Total products
        const totalProducts = await prisma.product.count({ where: { shopId } });

        // Complaint rate
        const complaintRate = totalOrdersCount > 0
            ? ((totalComplaints / totalOrdersCount) * 100).toFixed(1)
            : '0.0';

        return NextResponse.json({
            success: true,
            data: {
                shop: {
                    id: shop.id,
                    name: shop.name,
                    slug: shop.slug,
                    logoUrl: shop.logoUrl,
                    bannerUrl: shop.bannerUrl,
                    shortDescription: shop.shortDescription,
                    status: shop.status,
                    verified: shop.verified,
                    ratingAverage: shop.ratingAverage || 0,
                    ratingCount: shop.ratingCount || 0,
                    joinedAt: shop.joinedAt,
                    createdAt: shop.createdAt,
                    bankName: shop.bankName,
                    bankAccount: shop.bankAccount,
                    bankAccountName: shop.bankAccountName,
                },
                owner: shop.owner,
                stats: {
                    totalProducts,
                    productStats: productStats.reduce((acc, p) => {
                        acc[p.status] = p._count;
                        return acc;
                    }, {} as Record<string, number>),
                    totalOrders: totalOrdersCount,
                    completedOrders: completedOrdersCount,
                    totalRevenue: orderRevenue._sum?.totalAmount || 0,
                    totalComplaints,
                    resolvedComplaints,
                    complaintRate: parseFloat(complaintRate),
                },
                recentProducts: shop.products,
                recentOrders,
            },
        });
    } catch (error) {
        console.error('Admin seller detail error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
