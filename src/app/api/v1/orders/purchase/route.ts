import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, generateOrderCode } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getPlatformSettings } from '@/lib/mock-order-store';

/**
 * POST /api/v1/orders/purchase
 * Auth: Bearer token
 * Body: { productId, variantId?, quantity }
 */

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser(request);
        if (!user) {
            return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập' }, { status: 401 });
        }

        const { productId, variantId, quantity = 1 } = await request.json();

        if (!productId) {
            return NextResponse.json({ success: false, message: 'Thiếu thông tin sản phẩm' }, { status: 400 });
        }

        // Pre-fetch product OUTSIDE transaction to reduce time inside tx
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                shop: { select: { id: true, name: true, ownerId: true, status: true } },
                variants: { where: { isActive: true } },
            },
        });

        if (!product || product.status !== 'ACTIVE') {
            return NextResponse.json({ success: false, message: 'Sản phẩm không tồn tại hoặc đã ngừng bán' }, { status: 404 });
        }
        if (product.shop.status !== 'ACTIVE') {
            return NextResponse.json({ success: false, message: 'Gian hàng hiện không hoạt động' }, { status: 400 });
        }
        if (product.shop.ownerId === user.userId) {
            return NextResponse.json({ success: false, message: 'Không thể mua sản phẩm của chính mình' }, { status: 400 });
        }

        // Determine price
        let unitPrice = product.price;
        let selectedVariantName = '';
        if (variantId) {
            const variant = product.variants.find(v => v.id === variantId);
            if (variant) { unitPrice = variant.price; selectedVariantName = variant.name; }
        } else if (product.variants.length > 0) {
            unitPrice = product.variants[0].price;
            selectedVariantName = product.variants[0].name;
        }

        const totalAmount = unitPrice * quantity;
        const commissionRate = getPlatformSettings().commissionRate;
        const feeAmount = Math.floor(totalAmount * commissionRate / 100);
        const sellerEarning = totalAmount - feeAmount;
        const orderCode = generateOrderCode();
        const isAutoDelivery = product.deliveryType === 'AUTO';

        // Pre-fetch wallets OUTSIDE transaction
        const [buyerWallet, sellerWallet] = await Promise.all([
            prisma.wallet.findUnique({ where: { userId: user.userId } }),
            prisma.wallet.findUnique({ where: { userId: product.shop.ownerId } }),
        ]);

        if (!buyerWallet || buyerWallet.availableBalance < totalAmount) {
            return NextResponse.json({
                success: false,
                message: `Số dư không đủ. Hiện có: ${(buyerWallet?.availableBalance || 0).toLocaleString()}đ, cần: ${totalAmount.toLocaleString()}đ`,
            }, { status: 400 });
        }

        // Pre-fetch stock OUTSIDE transaction for AUTO delivery
        let stockIds: string[] = [];
        let deliveredContent: string | null = null;
        if (isAutoDelivery) {
            const availableStock = await prisma.stockItem.findMany({
                where: { productId, status: 'AVAILABLE' },
                take: quantity,
                orderBy: { createdAt: 'asc' },
                select: { id: true, rawContent: true },
            });
            if (availableStock.length < quantity) {
                return NextResponse.json({
                    success: false,
                    message: `Hết hàng. Chỉ còn ${availableStock.length} sản phẩm`,
                }, { status: 400 });
            }
            stockIds = availableStock.map(s => s.id);
            deliveredContent = availableStock.map(s => s.rawContent).join('\n');
        }

        // MINIMAL transaction — only writes, no reads
        const result = await prisma.$transaction(async (tx) => {
            // 1. Deduct buyer wallet
            const updatedBuyerWallet = await tx.wallet.update({
                where: { userId: user.userId },
                data: { availableBalance: { decrement: totalAmount } },
            });

            // 2. Create order
            const order = await tx.order.create({
                data: {
                    orderCode,
                    buyerId: user.userId,
                    shopId: product.shop.id,
                    status: isAutoDelivery ? 'COMPLETED' : 'PROCESSING',
                    subtotal: totalAmount,
                    feeAmount,
                    totalAmount,
                    paymentStatus: 'PAID',
                    deliveryStatus: isAutoDelivery ? 'DELIVERED' : 'PENDING',
                    paidAt: new Date(),
                    deliveredAt: isAutoDelivery ? new Date() : null,
                    completedAt: isAutoDelivery ? new Date() : null,
                    items: {
                        create: { productId, quantity, unitPrice, total: totalAmount },
                    },
                },
            });

            // 3. Buyer wallet transaction
            await tx.walletTransaction.create({
                data: {
                    walletId: buyerWallet.id,
                    type: 'PURCHASE',
                    direction: 'DEBIT',
                    amount: totalAmount,
                    balanceAfter: updatedBuyerWallet.availableBalance,
                    description: `Mua ${quantity}x ${product.name}${selectedVariantName ? ` (${selectedVariantName})` : ''}`,
                },
            });

            // 4. Credit seller + log (parallel)
            if (sellerWallet) {
                const [updatedSellerWallet] = await Promise.all([
                    tx.wallet.update({
                        where: { userId: product.shop.ownerId },
                        data: { availableBalance: { increment: sellerEarning } },
                    }),
                ]);
                await tx.walletTransaction.create({
                    data: {
                        walletId: sellerWallet.id,
                        type: 'SALE_EARNING',
                        direction: 'CREDIT',
                        amount: sellerEarning,
                        balanceAfter: updatedSellerWallet.availableBalance,
                        description: `Bán ${quantity}x ${product.name} (phí sàn ${commissionRate}%)`,
                    },
                });
            }

            // 5. Mark stock as sold + create delivery + update product counts (parallel)
            const parallelOps: Promise<any>[] = [
                tx.product.update({
                    where: { id: productId },
                    data: { soldCount: { increment: quantity }, stockCountCached: { decrement: quantity } },
                }),
            ];

            if (isAutoDelivery && stockIds.length > 0) {
                parallelOps.push(
                    tx.stockItem.updateMany({
                        where: { id: { in: stockIds } },
                        data: { status: 'SOLD', soldAt: new Date(), orderId: order.id },
                    }),
                    tx.delivery.create({
                        data: { orderId: order.id, content: deliveredContent!, status: 'DELIVERED' },
                    }),
                );
            }
            await Promise.all(parallelOps);

            return { orderCode: order.orderCode, status: order.status, newBalance: updatedBuyerWallet.availableBalance };
        }, { maxWait: 10000, timeout: 15000 });

        return NextResponse.json({
            success: true,
            message: `Mua thành công ${quantity}x ${product.name}`,
            data: {
                order: { orderCode: result.orderCode, status: result.status, deliveredContent },
                newBalance: result.newBalance,
            },
        }, { status: 201 });

    } catch (error: any) {
        console.error('Purchase error:', error);
        const msg = error?.message || '';
        if (msg.includes('Unique constraint')) {
            return NextResponse.json({ success: false, message: 'Đơn hàng trùng, vui lòng thử lại' }, { status: 400 });
        }
        return NextResponse.json({ success: false, message: 'Có lỗi xảy ra khi mua hàng. Vui lòng thử lại.' }, { status: 500 });
    }
}
