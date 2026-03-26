/**
 * Reset Script: Xóa toàn bộ dữ liệu giao dịch, doanh thu, gian hàng, sản phẩm
 * GIỮ LẠI: Users, Categories, Banners, Pages, Settings
 * 
 * Chạy: npx ts-node prisma/reset-data.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetData() {
  console.log('🚀 Bắt đầu reset dữ liệu hệ thống ChoTaiNguyen...\n');

  // Use a transaction to ensure all-or-nothing
  await prisma.$transaction(async (tx) => {

    // ─── 1. Xóa quảng cáo ───
    const adImpressions = await tx.adImpression.deleteMany();
    console.log(`✅ Đã xóa ${adImpressions.count} ad impressions`);
    const adCampaigns = await tx.adCampaign.deleteMany();
    console.log(`✅ Đã xóa ${adCampaigns.count} ad campaigns`);

    // ─── 2. Xóa hóa đơn ───
    const invoices = await tx.invoice.deleteMany();
    console.log(`✅ Đã xóa ${invoices.count} invoices`);

    // ─── 3. Xóa khiếu nại ───
    const complaintMessages = await tx.complaintMessage.deleteMany();
    console.log(`✅ Đã xóa ${complaintMessages.count} complaint messages`);
    const complaints = await tx.complaint.deleteMany();
    console.log(`✅ Đã xóa ${complaints.count} complaints`);

    // ─── 4. Xóa delivery & order items ───
    const deliveries = await tx.delivery.deleteMany();
    console.log(`✅ Đã xóa ${deliveries.count} deliveries`);
    const orderItems = await tx.orderItem.deleteMany();
    console.log(`✅ Đã xóa ${orderItems.count} order items`);

    // ─── 5. Xóa đơn hàng ───
    const orders = await tx.order.deleteMany();
    console.log(`✅ Đã xóa ${orders.count} orders`);

    // ─── 6. Xóa reviews ───
    const reviews = await tx.review.deleteMany();
    console.log(`✅ Đã xóa ${reviews.count} reviews`);

    // ─── 7. Xóa favorites ───
    const favorites = await tx.favorite.deleteMany();
    console.log(`✅ Đã xóa ${favorites.count} favorites`);

    // ─── 8. Xóa stock ───
    const stockItems = await tx.stockItem.deleteMany();
    console.log(`✅ Đã xóa ${stockItems.count} stock items`);
    const stockBatches = await tx.stockBatch.deleteMany();
    console.log(`✅ Đã xóa ${stockBatches.count} stock batches`);

    // ─── 9. Xóa sản phẩm liên quan ───
    const productImages = await tx.productImage.deleteMany();
    console.log(`✅ Đã xóa ${productImages.count} product images`);
    const productTagMaps = await tx.productTagMap.deleteMany();
    console.log(`✅ Đã xóa ${productTagMaps.count} product tag maps`);
    const productVariants = await tx.productVariant.deleteMany();
    console.log(`✅ Đã xóa ${productVariants.count} product variants`);

    // ─── 10. Xóa sản phẩm ───
    const products = await tx.product.deleteMany();
    console.log(`✅ Đã xóa ${products.count} products`);

    // ─── 11. Xóa product tags (orphaned) ───
    const productTags = await tx.productTag.deleteMany();
    console.log(`✅ Đã xóa ${productTags.count} product tags`);

    // ─── 12. Xóa tài chính ───
    const usdtPaymentLogs = await tx.usdtPaymentLog.deleteMany();
    console.log(`✅ Đã xóa ${usdtPaymentLogs.count} USDT payment logs`);
    const usdtTransferEvents = await tx.usdtTransferEvent.deleteMany();
    console.log(`✅ Đã xóa ${usdtTransferEvents.count} USDT transfer events`);
    const usdtScanCheckpoints = await tx.usdtScanCheckpoint.deleteMany();
    console.log(`✅ Đã xóa ${usdtScanCheckpoints.count} USDT scan checkpoints`);
    const bankTransactions = await tx.bankTransaction.deleteMany();
    console.log(`✅ Đã xóa ${bankTransactions.count} bank transactions`);
    const deposits = await tx.deposit.deleteMany();
    console.log(`✅ Đã xóa ${deposits.count} deposits`);
    const withdrawals = await tx.withdrawal.deleteMany();
    console.log(`✅ Đã xóa ${withdrawals.count} withdrawals`);

    // ─── 13. Xóa wallet transactions & reset wallets ───
    const walletTxns = await tx.walletTransaction.deleteMany();
    console.log(`✅ Đã xóa ${walletTxns.count} wallet transactions`);

    const wallets = await tx.wallet.updateMany({
      data: {
        availableBalance: 0,
        heldBalance: 0,
        totalDeposited: 0,
        totalSpent: 0,
        totalRefunded: 0,
        totalWithdrawn: 0,
      },
    });
    console.log(`✅ Đã reset ${wallets.count} wallets về 0đ`);

    // ─── 14. Xóa gian hàng ───
    const shops = await tx.shop.deleteMany();
    console.log(`✅ Đã xóa ${shops.count} shops`);

    // ─── 15. Xóa tin nhắn ───
    const conversationMessages = await tx.conversationMessage.deleteMany();
    console.log(`✅ Đã xóa ${conversationMessages.count} conversation messages`);
    const conversations = await tx.conversation.deleteMany();
    console.log(`✅ Đã xóa ${conversations.count} conversations`);

    // ─── 16. Xóa thông báo ───
    const notifications = await tx.notification.deleteMany();
    console.log(`✅ Đã xóa ${notifications.count} notifications`);

    // ─── 17. Xóa audit logs ───
    const auditLogs = await tx.auditLog.deleteMany();
    console.log(`✅ Đã xóa ${auditLogs.count} audit logs`);

    // ─── 18. Xóa terms acceptance ───
    const termsAcceptances = await tx.termsAcceptance.deleteMany();
    console.log(`✅ Đã xóa ${termsAcceptances.count} terms acceptances`);

    // ─── 19. Chuyển SELLER về USER (vì shop đã xóa) ───
    const sellers = await tx.user.updateMany({
      where: { role: 'SELLER' },
      data: { role: 'USER' },
    });
    console.log(`✅ Đã chuyển ${sellers.count} SELLER → USER`);

    // Reset category product counts
    const categories = await tx.category.updateMany({
      data: { productCount: 0 },
    });
    console.log(`✅ Đã reset productCount cho ${categories.count} categories`);
  }, {
    timeout: 60000, // 60s timeout for large datasets
  });

  console.log('\n🎉 Reset hoàn tất! Hệ thống đã sẵn sàng hoạt động chính thức.');
  console.log('📋 Dữ liệu giữ lại: Users, Categories, Banners, Pages, Settings');
}

resetData()
  .catch((e) => {
    console.error('❌ Lỗi khi reset:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
