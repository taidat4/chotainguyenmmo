'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatBox from '@/components/shared/ChatBox';
import { Loader2 } from 'lucide-react';

function MessagesContent() {
    const searchParams = useSearchParams();
    const shopPartnerId = searchParams.get('shop');

    // Build context card from query params
    const productId = searchParams.get('productId');
    const productName = searchParams.get('productName');
    const productPrice = searchParams.get('productPrice');
    const productImage = searchParams.get('productImage');
    const orderId = searchParams.get('orderId');
    const orderCode = searchParams.get('orderCode');

    const contextCard = productId ? {
        type: 'product' as const,
        id: productId,
        name: productName || 'Sản phẩm',
        price: productPrice ? Number(productPrice) : undefined,
        image: productImage || undefined,
    } : orderId ? {
        type: 'order' as const,
        id: orderId,
        code: orderCode || orderId,
    } : undefined;

    return (
        <ChatBox
            initialPartnerId={shopPartnerId}
            contextCard={contextCard}
            title="Tin nhắn"
            subtitle="Trao đổi với Admin hoặc các shop bạn đã mua hàng."
            roleLabelPartner={(type) => type === 'admin' ? '🛡️ Admin' : type === 'shop' ? '🏪 Shop' : '👤 Người dùng'}
        />
    );
}

export default function MessagesPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-brand-primary" /></div>}>
            <MessagesContent />
        </Suspense>
    );
}
