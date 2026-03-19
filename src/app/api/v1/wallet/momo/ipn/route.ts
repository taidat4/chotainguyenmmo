import { NextRequest, NextResponse } from 'next/server';
import { verifyMoMoSignature } from '@/lib/momo';
import prisma from '@/lib/prisma';

// POST /api/v1/wallet/momo/ipn — MoMo IPN Callback (webhook)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('[MoMo IPN] Received:', JSON.stringify(body));

        // Verify signature
        if (!verifyMoMoSignature(body)) {
            console.error('[MoMo IPN] Invalid signature');
            return NextResponse.json({ status: 1, message: 'Invalid signature' });
        }

        // Check payment result
        if (body.resultCode !== 0) {
            console.log('[MoMo IPN] Payment failed:', body.message);
            return NextResponse.json({ status: 0, message: 'ok' });
        }

        // Extract user info from extraData
        let userId: string = '';
        let amount: number = 0;
        try {
            const extraData = JSON.parse(Buffer.from(body.extraData, 'base64').toString('utf-8'));
            userId = extraData.userId;
            amount = extraData.amount || body.amount;
        } catch {
            console.error('[MoMo IPN] Failed to parse extraData');
            return NextResponse.json({ status: 1, message: 'Invalid extraData' });
        }

        if (!userId) {
            console.error('[MoMo IPN] No userId in extraData');
            return NextResponse.json({ status: 1, message: 'No userId' });
        }

        // Credit user wallet via Prisma
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
            console.error('[MoMo IPN] Wallet not found for user:', userId);
            return NextResponse.json({ status: 1, message: 'Wallet not found' });
        }

        const newBalance = wallet.availableBalance + amount;
        await prisma.$transaction([
            prisma.wallet.update({
                where: { userId },
                data: { availableBalance: newBalance, totalDeposited: { increment: amount } },
            }),
            prisma.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'DEPOSIT',
                    direction: 'CREDIT',
                    amount,
                    balanceAfter: newBalance,
                    description: `Nạp tiền qua MoMo — ${body.orderId || 'N/A'}`,
                },
            }),
        ]);

        console.log(`[MoMo IPN] ✅ Credited ${amount}đ to user ${userId}. New balance: ${newBalance}đ`);

        // MoMo requires 204 or { status: 0 } response
        return NextResponse.json({ status: 0, message: 'ok' });
    } catch (error) {
        console.error('[MoMo IPN] Error:', error);
        return NextResponse.json({ status: 1, message: 'Internal error' });
    }
}
