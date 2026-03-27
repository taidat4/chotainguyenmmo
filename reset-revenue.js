const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
    const s = await p.shop.findFirst({ where: { name: { contains: 'Shop MMO' } } });
    if (!s) { console.log('Ko tim thay shop'); return; }
    console.log('Shop:', s.name);
    
    const orderIds = (await p.order.findMany({ where: { shopId: s.id }, select: { id: true } })).map(o => o.id);
    console.log('Orders:', orderIds.length);
    
    if (orderIds.length === 0) { console.log('Khong co don'); return; }
    
    // Delete all related records in order
    await p.delivery.deleteMany({ where: { orderId: { in: orderIds } } });
    await p.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await p.order.deleteMany({ where: { id: { in: orderIds } } });
    await p.product.updateMany({ where: { shopId: s.id }, data: { soldCount: 0 } });
    
    console.log('Da xoa', orderIds.length, 'don hang. Doanh thu = 0!');
})().finally(() => p.$disconnect());
