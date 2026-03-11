import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function hash(pw: string) {
    return createHash('sha256').update(pw).digest('hex');
}

async function main() {
    console.log('🌱 Seeding ChoTaiNguyen database...');

    // ============ USERS ============
    const users = await Promise.all([
        prisma.user.create({ data: { username: 'admin', email: 'admin@chotainguyen.vn', passwordHash: hash('Admin@123'), fullName: 'Admin CTN', role: 'SUPER_ADMIN', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'moderator_ha', email: 'mod@chotainguyen.vn', passwordHash: hash('Mod@1234'), fullName: 'Moderator Hà', role: 'ADMIN', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'seller_tai', email: 'seller1@gmail.com', passwordHash: hash('Seller@123'), fullName: 'Nguyễn Văn Tài', role: 'SELLER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'seller_mai', email: 'seller2@gmail.com', passwordHash: hash('Seller@123'), fullName: 'Trần Thị Mai', role: 'SELLER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'seller_dung', email: 'seller3@gmail.com', passwordHash: hash('Seller@123'), fullName: 'Lê Hoàng Dũng', role: 'SELLER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'seller_huong', email: 'seller4@gmail.com', passwordHash: hash('Seller@123'), fullName: 'Phạm Thanh Hương', role: 'SELLER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'seller_tuan', email: 'seller5@gmail.com', passwordHash: hash('Seller@123'), fullName: 'Hoàng Minh Tuấn', role: 'SELLER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'seller_bao', email: 'seller6@gmail.com', passwordHash: hash('Seller@123'), fullName: 'Vũ Quốc Bảo', role: 'SELLER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'buyer_khoi', email: 'buyer1@gmail.com', passwordHash: hash('Buyer@123'), fullName: 'Đỗ Minh Khôi', role: 'USER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'buyer_ha', email: 'buyer2@gmail.com', passwordHash: hash('Buyer@123'), fullName: 'Nguyễn Thu Hà', role: 'USER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'buyer_binh', email: 'buyer3@gmail.com', passwordHash: hash('Buyer@123'), fullName: 'Lý Thanh Bình', role: 'USER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'buyer_nam', email: 'buyer4@gmail.com', passwordHash: hash('Buyer@123'), fullName: 'Trương Hoài Nam', role: 'USER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'buyer_anh', email: 'buyer5@gmail.com', passwordHash: hash('Buyer@123'), fullName: 'Phan Ngọc Ánh', role: 'USER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'buyer_vinh', email: 'buyer6@gmail.com', passwordHash: hash('Buyer@123'), fullName: 'Hồ Quang Vinh', role: 'USER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'buyer_hong', email: 'buyer7@gmail.com', passwordHash: hash('Buyer@123'), fullName: 'Mai Thị Hồng', role: 'USER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'buyer_trung', email: 'buyer8@gmail.com', passwordHash: hash('Buyer@123'), fullName: 'Bùi Đức Trung', role: 'USER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'buyer_phuoc', email: 'buyer9@gmail.com', passwordHash: hash('Buyer@123'), fullName: 'Cao Hữu Phước', role: 'USER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'buyer_lien', email: 'buyer10@gmail.com', passwordHash: hash('Buyer@123'), fullName: 'Dương Thị Liên', role: 'USER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'buyer_an', email: 'buyer11@gmail.com', passwordHash: hash('Buyer@123'), fullName: 'Lưu Bảo An', role: 'USER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
        prisma.user.create({ data: { username: 'buyer_huy', email: 'buyer12@gmail.com', passwordHash: hash('Buyer@123'), fullName: 'Tô Minh Huy', role: 'USER', status: 'ACTIVE', termsAcceptedAt: new Date() } }),
    ]);

    // Create wallets for all users
    for (const u of users) {
        const bal = u.role === 'SUPER_ADMIN' ? 50000000 : u.role === 'ADMIN' ? 10000000 : u.role === 'SELLER' ? 5000000 : Math.floor(Math.random() * 2000000) + 100000;
        await prisma.wallet.create({
            data: { userId: u.id, availableBalance: bal, totalDeposited: bal + Math.floor(bal * 0.3), totalSpent: Math.floor(bal * 0.3) },
        });
    }

    // ============ CATEGORIES ============
    const cats = await Promise.all([
        prisma.category.create({ data: { name: 'Tài khoản', slug: 'tai-khoan', icon: 'UserCircle', sortOrder: 1 } }),
        prisma.category.create({ data: { name: 'Phần mềm', slug: 'phan-mem', icon: 'AppWindow', sortOrder: 2 } }),
        prisma.category.create({ data: { name: 'AI Tools', slug: 'ai-tools', icon: 'Bot', sortOrder: 3 } }),
        prisma.category.create({ data: { name: 'Email', slug: 'email', icon: 'Mail', sortOrder: 4 } }),
        prisma.category.create({ data: { name: 'Mạng xã hội', slug: 'mang-xa-hoi', icon: 'Share2', sortOrder: 5 } }),
        prisma.category.create({ data: { name: 'Proxy & Công cụ', slug: 'proxy-cong-cu', icon: 'Globe', sortOrder: 6 } }),
        prisma.category.create({ data: { name: 'Dịch vụ số', slug: 'dich-vu-so', icon: 'Zap', sortOrder: 7 } }),
        prisma.category.create({ data: { name: 'Khác', slug: 'khac', icon: 'Package', sortOrder: 8 } }),
    ]);

    // ============ SHOPS ============
    const shops = await Promise.all([
        prisma.shop.create({ data: { ownerId: users[2].id, name: 'TaiStore', slug: 'taistore', shortDescription: 'Shop tài khoản premium uy tín #1', status: 'ACTIVE', verified: true, ratingAverage: 4.8, ratingCount: 156, productCount: 12, successfulOrdersCount: 890, responseRate: 98.5, supportTimeText: '8:00 - 22:00', sellerTermsAcceptedAt: new Date() } }),
        prisma.shop.create({ data: { ownerId: users[3].id, name: 'CloudKey VN', slug: 'cloudkey-vn', shortDescription: 'Chuyên key bản quyền phần mềm', status: 'ACTIVE', verified: true, ratingAverage: 4.6, ratingCount: 89, productCount: 8, successfulOrdersCount: 450, responseRate: 95, supportTimeText: '9:00 - 21:00', sellerTermsAcceptedAt: new Date() } }),
        prisma.shop.create({ data: { ownerId: users[4].id, name: 'AI Hub', slug: 'ai-hub', shortDescription: 'Tài khoản AI tools giá tốt', status: 'ACTIVE', verified: true, ratingAverage: 4.9, ratingCount: 234, productCount: 15, successfulOrdersCount: 1200, responseRate: 99, supportTimeText: '24/7', sellerTermsAcceptedAt: new Date() } }),
        prisma.shop.create({ data: { ownerId: users[5].id, name: 'ProxyMaster', slug: 'proxymaster', shortDescription: 'Proxy & tool chất lượng cao', status: 'ACTIVE', verified: false, ratingAverage: 4.3, ratingCount: 45, productCount: 6, successfulOrdersCount: 200, responseRate: 90, supportTimeText: '8:00 - 18:00', sellerTermsAcceptedAt: new Date() } }),
        prisma.shop.create({ data: { ownerId: users[6].id, name: 'DigitalPlus', slug: 'digitalplus', shortDescription: 'Dịch vụ số tiện lợi', status: 'ACTIVE', verified: true, ratingAverage: 4.7, ratingCount: 178, productCount: 10, successfulOrdersCount: 650, responseRate: 97, supportTimeText: '8:00 - 23:00', sellerTermsAcceptedAt: new Date() } }),
        prisma.shop.create({ data: { ownerId: users[7].id, name: 'NewSeller', slug: 'newseller', shortDescription: 'Shop mới đăng ký', status: 'PENDING', verified: false, ratingAverage: 0, ratingCount: 0, productCount: 0, successfulOrdersCount: 0 } }),
    ]);

    // ============ PRODUCTS ============
    const productData = [
        { shop: 0, cat: 2, name: 'ChatGPT Plus 1 tháng', slug: 'chatgpt-plus-1-thang', price: 350000, desc: 'Tài khoản ChatGPT Plus chính chủ, dùng riêng 1 tháng', sold: 456, stock: 25, featured: true, hot: true },
        { shop: 0, cat: 2, name: 'ChatGPT Team slot', slug: 'chatgpt-team-slot', price: 450000, desc: 'Slot trong workspace ChatGPT Team, GPT-4 không giới hạn', sold: 123, stock: 10, featured: true },
        { shop: 2, cat: 2, name: 'Google Gemini Ultra', slug: 'google-gemini-ultra', price: 280000, desc: 'Tài khoản Google One AI Premium với Gemini Ultra', sold: 312, stock: 30, featured: true, hot: true },
        { shop: 2, cat: 2, name: 'Claude Pro 1 tháng', slug: 'claude-pro-1-thang', price: 400000, desc: 'Tài khoản Claude Pro Anthropic', sold: 89, stock: 15 },
        { shop: 2, cat: 2, name: 'Midjourney Standard', slug: 'midjourney-standard', price: 320000, desc: 'Tài khoản Midjourney Standard Plan', sold: 198, stock: 8 },
        { shop: 1, cat: 1, name: 'Canva Pro 1 năm', slug: 'canva-pro-1-nam', price: 150000, desc: 'Tài khoản Canva Pro cá nhân 1 năm', sold: 567, stock: 40, featured: true },
        { shop: 1, cat: 1, name: 'Capcut Pro tháng', slug: 'capcut-pro-thang', price: 50000, desc: 'Tài khoản Capcut Pro 1 tháng đầy đủ tính năng', sold: 890, stock: 50, hot: true },
        { shop: 1, cat: 1, name: 'Capcut Pro năm', slug: 'capcut-pro-nam', price: 400000, desc: 'Tài khoản Capcut Pro 1 năm', sold: 234, stock: 20 },
        { shop: 4, cat: 1, name: 'YouTube Premium 12 tháng', slug: 'youtube-premium-12-thang', price: 180000, desc: 'YouTube Premium gia đình, không quảng cáo', sold: 445, stock: 35, featured: true },
        { shop: 4, cat: 1, name: 'Spotify Premium 6 tháng', slug: 'spotify-premium-6-thang', price: 120000, desc: 'Spotify Premium cá nhân 6 tháng', sold: 678, stock: 28 },
        { shop: 4, cat: 1, name: 'Netflix Premium 1 tháng', slug: 'netflix-premium-1-thang', price: 80000, desc: 'Netflix 4K Premium profile riêng', sold: 345, stock: 15 },
        { shop: 0, cat: 5, name: 'Proxy IPv4 US tháng', slug: 'proxy-ipv4-us-thang', price: 60000, desc: 'Proxy IPv4 static US tốc độ cao', sold: 123, stock: 100 },
        { shop: 3, cat: 5, name: 'Proxy Residential 1GB', slug: 'proxy-residential-1gb', price: 95000, desc: 'Proxy residential rotating 1GB bandwidth', sold: 234, stock: 999 },
        { shop: 3, cat: 5, name: 'SOCKS5 Premium Package', slug: 'socks5-premium-package', price: 150000, desc: 'Gói 50 SOCKS5 proxy premium đa quốc gia', sold: 89, stock: 45 },
        { shop: 2, cat: 1, name: 'Leonardo AI Artisan', slug: 'leonardo-ai-artisan', price: 200000, desc: 'Tài khoản Leonardo AI Artisan Plan', sold: 156, stock: 12 },
        { shop: 4, cat: 6, name: 'SheerID Quân nhân US', slug: 'sheerid-quan-nhan-us', price: 100000, desc: 'SheerID verification quân nhân Hoa Kỳ', sold: 78, stock: 5 },
        { shop: 0, cat: 3, name: 'Gmail cổ 2015', slug: 'gmail-co-2015', price: 25000, desc: 'Tài khoản Gmail tạo năm 2015, full verify', sold: 1234, stock: 200, hot: true },
        { shop: 0, cat: 3, name: 'Outlook Mail Aged', slug: 'outlook-mail-aged', price: 15000, desc: 'Mail Outlook.com cổ 2+ năm', sold: 890, stock: 150 },
        { shop: 1, cat: 4, name: 'Facebook Marketplace US', slug: 'facebook-marketplace-us', price: 45000, desc: 'Tài khoản Facebook US có Marketplace', sold: 567, stock: 80 },
        { shop: 1, cat: 4, name: 'TikTok 1000 followers', slug: 'tiktok-1000-followers', price: 85000, desc: 'Tài khoản TikTok sẵn 1000 followers thật', sold: 234, stock: 25 },
        { shop: 4, cat: 6, name: 'VPN Premium 1 năm', slug: 'vpn-premium-1-nam', price: 200000, desc: 'Key VPN Premium NordVPN/ExpressVPN 1 năm', sold: 345, stock: 18 },
        { shop: 2, cat: 2, name: 'Kling AI 3000 credits', slug: 'kling-ai-3000', price: 300000, desc: 'Tài khoản Kling AI 3000 credits cho video AI', sold: 67, stock: 10 },
        { shop: 3, cat: 5, name: 'RDP Windows US', slug: 'rdp-windows-us', price: 250000, desc: 'Remote Desktop US 4GB RAM 2 CPU', sold: 156, stock: 8 },
        { shop: 3, cat: 5, name: 'VPS Linux SSD', slug: 'vps-linux-ssd', price: 180000, desc: 'VPS Linux 2GB RAM SSD 1 tháng', sold: 89, stock: 12 },
        { shop: 4, cat: 6, name: 'Gói SEO Backlink', slug: 'goi-seo-backlink', price: 500000, desc: '50 backlink DA50+ từ website uy tín', sold: 34, stock: 999 },
        { shop: 0, cat: 7, name: 'Windows 11 Pro Key', slug: 'windows-11-pro-key', price: 150000, desc: 'Key Windows 11 Pro bản quyền vĩnh viễn', sold: 678, stock: 100, featured: true },
        { shop: 1, cat: 7, name: 'Office 365 Family', slug: 'office-365-family', price: 200000, desc: 'Microsoft 365 Family 6 người dùng 1 năm', sold: 456, stock: 30 },
        { shop: 2, cat: 7, name: 'Adobe Creative Cloud', slug: 'adobe-creative-cloud', price: 350000, desc: 'Tài khoản Adobe CC 1 tháng full app', sold: 123, stock: 15 },
        { shop: 4, cat: 6, name: 'Dịch vụ verify KYC', slug: 'dich-vu-verify-kyc', price: 800000, desc: 'Dịch vụ verify KYC cho các nền tảng quốc tế', sold: 23, stock: 5, delivery: 'MANUAL' },
        { shop: 3, cat: 5, name: 'Anti-detect Browser', slug: 'anti-detect-browser', price: 450000, desc: 'License GoLogin/Multilogin 1 tháng 100 profiles', sold: 167, stock: 20 },
    ];

    const products = [];
    for (const p of productData) {
        const prod = await prisma.product.create({
            data: {
                shopId: shops[p.shop].id,
                categoryId: cats[p.cat].id,
                name: p.name,
                slug: p.slug,
                shortDescription: p.desc,
                description: p.desc + '. Sản phẩm được hệ thống giao tự động ngay sau khi thanh toán. Bảo hành theo chính sách của shop.',
                price: p.price,
                status: 'ACTIVE',
                deliveryType: (p as any).delivery || 'AUTO',
                isAutoDelivery: !(p as any).delivery,
                stockCountCached: p.stock,
                soldCount: p.sold,
                ratingAverage: 4 + Math.random(),
                ratingCount: Math.floor(p.sold * 0.3),
                isFeatured: p.featured || false,
                isHot: (p as any).hot || false,
                publishedAt: new Date(),
                approvedAt: new Date(),
                complaintWindowHours: 48,
            },
        });
        products.push(prod);

        // Create stock items
        for (let i = 0; i < Math.min(p.stock, 10); i++) {
            await prisma.stockItem.create({
                data: {
                    productId: prod.id,
                    rawContent: `${p.slug}-item-${i + 1}@example.com|Pass${randomBytes(4).toString('hex')}`,
                    status: 'AVAILABLE',
                },
            });
        }
    }

    // ============ BANNERS ============
    await Promise.all([
        prisma.banner.create({ data: { title: 'Flash Sale AI Tools', subtitle: 'Giảm đến 30% tài khoản AI', position: 1, isActive: true } }),
        prisma.banner.create({ data: { title: 'Chào mừng seller mới', subtitle: 'Đăng ký gian hàng hôm nay — 0% phí tháng đầu', position: 2, isActive: true } }),
        prisma.banner.create({ data: { title: 'Proxy Premium', subtitle: 'Gói proxy residential giá rẻ nhất thị trường', position: 3, isActive: true } }),
        prisma.banner.create({ data: { title: 'Bảo mật tài khoản', subtitle: 'Bật 2FA để bảo vệ ví và đơn hàng', position: 4, isActive: true } }),
        prisma.banner.create({ data: { title: 'Giới thiệu bạn bè', subtitle: 'Nhận 10.000đ cho mỗi người bạn giới thiệu', position: 5, isActive: false } }),
    ]);

    // ============ SETTINGS ============
    await Promise.all([
        prisma.setting.create({ data: { key: 'site_name', value: 'ChoTaiNguyen', group: 'general' } }),
        prisma.setting.create({ data: { key: 'site_description', value: 'Nền tảng giao dịch tài nguyên số', group: 'general' } }),
        prisma.setting.create({ data: { key: 'commission_rate', value: '5', type: 'number', group: 'commission' } }),
        prisma.setting.create({ data: { key: 'min_deposit', value: '10000', type: 'number', group: 'payment' } }),
        prisma.setting.create({ data: { key: 'min_withdrawal', value: '100000', type: 'number', group: 'payment' } }),
        prisma.setting.create({ data: { key: 'order_auto_complete_hours', value: '72', type: 'number', group: 'general' } }),
        prisma.setting.create({ data: { key: 'complaint_window_hours', value: '48', type: 'number', group: 'general' } }),
        prisma.setting.create({ data: { key: 'maintenance_mode', value: 'false', type: 'boolean', group: 'security' } }),
    ]);

    console.log('✅ Seed complete!');
    console.log(`   ${users.length} users`);
    console.log(`   ${cats.length} categories`);
    console.log(`   ${shops.length - 1} active shops`);
    console.log(`   ${products.length} products`);
    console.log(`   5 banners, 8 settings`);
    console.log('\n📋 Login credentials (username / password):');
    console.log('   Admin: admin / Admin@123');
    console.log('   Seller: seller_tai / Seller@123');
    console.log('   Buyer: buyer_khoi / Buyer@123');
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e);
        prisma.$disconnect();
        process.exit(1);
    });
