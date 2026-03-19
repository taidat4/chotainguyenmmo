import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getPlatformSettings } from '@/lib/mock-order-store';

/**
 * Seller Stats API — Dashboard data
 * GET — Returns seller stats (revenue, orders, products, complaints, etc.)
 */

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
        const shop = await prisma.shop.findUnique({ where: { ownerId: authResult.userId } });
        if (!shop) {
            return NextResponse.json({
                success: true,
                data: {
                    revenueToday: 0, revenueMonth: 0, newOrders: 0, pendingWithdrawal: 0,
                    activeProducts: 0, openComplaints: 0, totalOrders: 0, completedOrders: 0,
                    recentOrders: [], topProducts: [],
                },
            });
        }

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Get orders
        const [allOrders, todayOrders, monthOrders, pendingOrders] = await Promise.all([
            prisma.order.count({ where: { shopId: shop.id } }),
            prisma.order.findMany({
                where: { shopId: shop.id, createdAt: { gte: startOfDay }, paymentStatus: 'PAID' },
                select: { totalAmount: true },
            }),
            prisma.order.findMany({
                where: { shopId: shop.id, createdAt: { gte: startOfMonth }, paymentStatus: 'PAID' },
                select: { totalAmount: true },
            }),
            prisma.order.count({
                where: { shopId: shop.id, status: { in: ['PENDING', 'PAID', 'PROCESSING'] } },
            }),
        ]);

        // Products & complaints
        const [activeProducts, openComplaints, completedOrders] = await Promise.all([
            prisma.product.count({ where: { shopId: shop.id, status: 'ACTIVE' } }),
            prisma.order.count({ where: { shopId: shop.id, status: 'DISPUTED' } }),
            prisma.order.count({ where: { shopId: shop.id, status: 'COMPLETED' } }),
        ]);

        // Pending withdrawals
        const pendingWithdrawals = await prisma.withdrawal.aggregate({
            where: { userId: authResult.userId, status: 'PENDING' },
            _sum: { amount: true },
        });

        // Recent orders
        const recentOrders = await prisma.order.findMany({
            where: { shopId: shop.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                items: { include: { product: { select: { name: true } } } },
                buyer: { select: { fullName: true, username: true } },
            },
        });

        // Get fee data from all orders
        const [todayOrdersFull, monthOrdersFull] = await Promise.all([
            prisma.order.findMany({
                where: { shopId: shop.id, createdAt: { gte: startOfDay }, paymentStatus: 'PAID' },
                select: { totalAmount: true, feeAmount: true },
            }),
            prisma.order.findMany({
                where: { shopId: shop.id, createdAt: { gte: startOfMonth }, paymentStatus: 'PAID' },
                select: { totalAmount: true, feeAmount: true },
            }),
        ]);

        const revenueToday = todayOrdersFull.reduce((s, o) => s + (o.totalAmount - o.feeAmount), 0);
        const revenueMonth = monthOrdersFull.reduce((s, o) => s + (o.totalAmount - o.feeAmount), 0);
        const feesToday = todayOrdersFull.reduce((s, o) => s + o.feeAmount, 0);
        const feesMonth = monthOrdersFull.reduce((s, o) => s + o.feeAmount, 0);

        // Get held balance
        const sellerWallet = await prisma.wallet.findUnique({ where: { userId: authResult.userId } });
        const commissionRate = getPlatformSettings().commissionRate;

        return NextResponse.json({
            success: true,
            data: {
                revenueToday,
                revenueMonth,
                feesToday,
                feesMonth,
                commissionRate,
                heldBalance: sellerWallet?.heldBalance || 0,
                availableBalance: sellerWallet?.availableBalance || 0,
                newOrders: pendingOrders,
                pendingWithdrawal: pendingWithdrawals._sum.amount || 0,
                activeProducts,
                openComplaints,
                totalOrders: allOrders,
                completedOrders,
                recentOrders: recentOrders.map(o => ({
                    id: o.id,
                    orderCode: o.orderCode,
                    productName: o.items[0]?.product?.name || 'N/A',
                    buyerName: o.buyer.fullName || o.buyer.username,
                    quantity: o.items.reduce((s, i) => s + i.quantity, 0),
                    totalAmount: o.totalAmount,
                    feeAmount: o.feeAmount,
                    sellerEarning: o.totalAmount - o.feeAmount,
                    status: o.status.toLowerCase(),
                    createdAt: o.createdAt.toISOString(),
                })),
            },
        });
    } catch (error) {
        console.error('[Seller Stats] Error:', error);
        return NextResponse.json({ success: false, message: 'Lỗi hệ thống' }, { status: 500 });
    }
}
