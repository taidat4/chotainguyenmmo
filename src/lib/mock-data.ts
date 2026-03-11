// ============================================================
// MOCK DATA - ChoTaiNguyen Marketplace
// ============================================================

export interface Category {
    id: string;
    name: string;
    slug: string;
    icon: string;
    description: string;
    productCount: number;
    subcategories: { id: string; name: string; slug: string }[];
}

export interface Product {
    id: string;
    name: string;
    slug: string;
    shortDescription: string;
    description: string;
    price: number;
    compareAtPrice?: number;
    categoryId: string;
    categoryName: string;
    shopId: string;
    shopName: string;
    sellerId?: string;
    shopVerified: boolean;
    images: string[];
    status: string;
    deliveryType: 'auto' | 'manual';
    stockCount: number;
    soldCount: number;
    ratingAverage: number;
    ratingCount: number;
    isFeatured: boolean;
    isHot: boolean;
    badges: string[];
    complaintWindowHours: number;
    warrantyPolicy: string;
    supportPolicy: string;
    createdAt: string;
    updatedAt: string;
}

export interface Shop {
    id: string;
    name: string;
    slug: string;
    logoUrl: string;
    bannerUrl: string;
    shortDescription: string;
    description: string;
    verified: boolean;
    status: string;
    responseRate: number;
    ratingAverage: number;
    ratingCount: number;
    successfulOrdersCount: number;
    productCount: number;
    joinedAt: string;
}

export interface Review {
    id: string;
    productId: string;
    productName: string;
    shopId: string;
    buyerName: string;
    buyerAvatar: string;
    rating: number;
    content: string;
    createdAt: string;
    verified: boolean;
}

export interface Order {
    id: string;
    orderCode: string;
    productName: string;
    shopName: string;
    quantity: number;
    totalAmount: number;
    status: string;
    paymentStatus: string;
    deliveryType: string;
    createdAt: string;
}

export interface Transaction {
    id: string;
    type: string;
    direction: string;
    amount: number;
    balanceAfter: number;
    description: string;
    createdAt: string;
}

export interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

export interface Banner {
    id: string;
    title: string;
    subtitle: string;
    imageUrl: string;
    link: string;
}

// ============================================================
// CATEGORIES
// ============================================================
export const categories: Category[] = [
    {
        id: 'cat-1',
        name: 'Tài khoản',
        slug: 'tai-khoan',
        icon: 'UserCircle',
        description: 'Tài khoản premium các nền tảng',
        productCount: 0,
        subcategories: [
            { id: 'sub-1-1', name: 'Email', slug: 'email' },
            { id: 'sub-1-2', name: 'Mạng xã hội', slug: 'mang-xa-hoi' },
            { id: 'sub-1-3', name: 'AI', slug: 'ai' },
        ],
    },
    {
        id: 'cat-2',
        name: 'Phần mềm',
        slug: 'phan-mem',
        icon: 'AppWindow',
        description: 'Key bản quyền, license phần mềm',
        productCount: 0,
        subcategories: [
            { id: 'sub-2-1', name: 'Thiết kế', slug: 'thiet-ke' },
            { id: 'sub-2-2', name: 'Văn phòng', slug: 'van-phong' },
        ],
    },
    {
        id: 'cat-3',
        name: 'AI Tools',
        slug: 'ai-tools',
        icon: 'Brain',
        description: 'Công cụ AI, API key, credits',
        productCount: 0,
        subcategories: [],
    },
    {
        id: 'cat-4',
        name: 'Email',
        slug: 'email',
        icon: 'Mail',
        description: 'Tài khoản email, SMTP, hosting',
        productCount: 0,
        subcategories: [],
    },
    {
        id: 'cat-5',
        name: 'Mạng xã hội',
        slug: 'mang-xa-hoi',
        icon: 'Share2',
        description: 'Tài khoản social, followers, tương tác',
        productCount: 0,
        subcategories: [],
    },
    {
        id: 'cat-6',
        name: 'Proxy & Công cụ',
        slug: 'proxy-cong-cu',
        icon: 'Globe',
        description: 'Proxy, VPN, automation tools',
        productCount: 0,
        subcategories: [
            { id: 'sub-6-1', name: 'Proxy', slug: 'proxy' },
            { id: 'sub-6-2', name: 'Automation', slug: 'automation' },
        ],
    },
    {
        id: 'cat-7',
        name: 'Dịch vụ số',
        slug: 'dich-vu-so',
        icon: 'Layers',
        description: 'Hosting, domain, dịch vụ cloud',
        productCount: 0,
        subcategories: [],
    },
    {
        id: 'cat-8',
        name: 'Khác',
        slug: 'khac',
        icon: 'MoreHorizontal',
        description: 'Tài nguyên số khác',
        productCount: 0,
        subcategories: [],
    },
];

// ============================================================
// SHOPS
// ============================================================
export const shops: Shop[] = [];

// ============================================================
// PRODUCTS
// ============================================================
export const products: Product[] = [
    {
        id: 'prod-1',
        name: 'ChatGPT Plus - Tài khoản 1 tháng',
        slug: 'chatgpt-plus-tai-khoan-1-thang',
        shortDescription: 'Tài khoản ChatGPT Plus chính chủ, sử dụng GPT-4, DALL-E 3 và các tính năng premium.',
        description: 'Tài khoản ChatGPT Plus đã kích hoạt sẵn, sử dụng đầy đủ GPT-4, Code Interpreter, DALL-E 3, Advanced Data Analysis. Giao ngay sau thanh toán. Bảo hành 30 ngày.',
        price: 350000,
        compareAtPrice: 450000,
        categoryId: 'cat-3',
        categoryName: 'AI Tools',
        shopId: 'shop-4',
        shopName: 'AI Resource Center',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/chatgpt.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 48,
        soldCount: 1230,
        ratingAverage: 4.8,
        ratingCount: 156,
        isFeatured: true,
        isHot: true,
        badges: ['Bán chạy', 'Tự động'],
        complaintWindowHours: 72,
        warrantyPolicy: 'Bảo hành 30 ngày kể từ ngày mua. Hỗ trợ thay thế nếu tài khoản gặp vấn đề từ phía hệ thống.',
        supportPolicy: 'Hỗ trợ qua hệ thống khiếu nại trong giờ hành chính.',
        createdAt: '2025-01-10',
        updatedAt: '2026-03-08',
    },
    {
        id: 'prod-2',
        name: 'Canva Pro - 1 năm',
        slug: 'canva-pro-1-nam',
        shortDescription: 'Canva Pro cá nhân 1 năm, sử dụng đầy đủ template, xóa nền, resize và hơn thế.',
        description: 'Tài khoản Canva Pro 1 năm, nâng cấp trên email cá nhân của bạn. Sử dụng đầy đủ tính năng premium: xóa nền, Brand Kit, resize thiết kế, 100GB dung lượng lưu trữ.',
        price: 120000,
        compareAtPrice: 180000,
        categoryId: 'cat-2',
        categoryName: 'Phần mềm',
        shopId: 'shop-1',
        shopName: 'DigitalVN Store',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/canva.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 120,
        soldCount: 890,
        ratingAverage: 4.7,
        ratingCount: 112,
        isFeatured: true,
        isHot: false,
        badges: ['Nổi bật', 'Tự động'],
        complaintWindowHours: 48,
        warrantyPolicy: 'Bảo hành 12 tháng. Hỗ trợ gia hạn nếu Canva thu hồi.',
        supportPolicy: 'Hỗ trợ kỹ thuật qua chat trong vòng 24 giờ.',
        createdAt: '2025-02-05',
        updatedAt: '2026-03-07',
    },
    {
        id: 'prod-3',
        name: 'Windows 11 Pro - Key bản quyền',
        slug: 'windows-11-pro-key',
        shortDescription: 'Key kích hoạt Windows 11 Pro bản quyền vĩnh viễn, hỗ trợ cài đặt từ xa.',
        description: 'Key Windows 11 Pro Retail, kích hoạt online trực tiếp trên máy. Bản quyền vĩnh viễn, không giới hạn thời gian. Hỗ trợ cài đặt từ xa miễn phí.',
        price: 250000,
        compareAtPrice: 350000,
        categoryId: 'cat-2',
        categoryName: 'Phần mềm',
        shopId: 'shop-2',
        shopName: 'ProKey Hub',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/windows-11.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 200,
        soldCount: 2150,
        ratingAverage: 4.9,
        ratingCount: 328,
        isFeatured: true,
        isHot: true,
        badges: ['Bán chạy', 'Tự động', 'Vĩnh viễn'],
        complaintWindowHours: 72,
        warrantyPolicy: 'Bảo hành vĩnh viễn. Hỗ trợ thay key nếu không kích hoạt được.',
        supportPolicy: 'Hỗ trợ cài đặt từ xa miễn phí qua TeamViewer/AnyDesk.',
        createdAt: '2024-11-20',
        updatedAt: '2026-03-08',
    },
    {
        id: 'prod-4',
        name: 'Proxy Residential US - 1GB',
        slug: 'proxy-residential-us-1gb',
        shortDescription: 'Proxy residential IP Mỹ, băng thông 1GB, tốc độ cao, IP xoay tự động.',
        description: 'Proxy residential chất lượng cao với IP từ Mỹ. Băng thông 1GB, hỗ trợ HTTP/HTTPS/SOCKS5. Xoay IP tự động hoặc sticky session.',
        price: 85000,
        categoryId: 'cat-6',
        categoryName: 'Proxy & Công cụ',
        shopId: 'shop-3',
        shopName: 'CloudNet Solutions',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/connected.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 500,
        soldCount: 780,
        ratingAverage: 4.5,
        ratingCount: 89,
        isFeatured: false,
        isHot: true,
        badges: ['Hot', 'Tự động'],
        complaintWindowHours: 24,
        warrantyPolicy: 'Bảo hành băng thông đầy đủ. Hoàn tiền nếu không sử dụng được.',
        supportPolicy: 'Hỗ trợ setup proxy trong vòng 1 giờ.',
        createdAt: '2025-01-15',
        updatedAt: '2026-03-06',
    },
    {
        id: 'prod-5',
        name: 'Gmail cổ 2018 - Sẵn 2FA',
        slug: 'gmail-co-2018-san-2fa',
        shortDescription: 'Tài khoản Gmail tạo từ 2018, đã bật 2FA, trust cao, phù hợp chạy ads.',
        description: 'Gmail aged 2018, đã verify số điện thoại và bật 2FA. Profile đầy đủ, phù hợp cho chạy Google Ads, SEO, hoặc dùng làm email chính.',
        price: 25000,
        categoryId: 'cat-4',
        categoryName: 'Email',
        shopId: 'shop-6',
        shopName: 'MailPro Services',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/gmail.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 350,
        soldCount: 4200,
        ratingAverage: 4.3,
        ratingCount: 256,
        isFeatured: false,
        isHot: true,
        badges: ['Hot', 'Tự động', 'Số lượng lớn'],
        complaintWindowHours: 24,
        warrantyPolicy: 'Bảo hành 7 ngày. Đổi nếu không login được.',
        supportPolicy: 'Hỗ trợ đổi trong giờ hành chính.',
        createdAt: '2024-12-01',
        updatedAt: '2026-03-08',
    },
    {
        id: 'prod-6',
        name: 'Spotify Premium - 6 tháng',
        slug: 'spotify-premium-6-thang',
        shortDescription: 'Tài khoản Spotify Premium cá nhân 6 tháng, nghe nhạc không quảng cáo.',
        description: 'Spotify Premium Individual 6 tháng, nghe nhạc không quảng cáo, tải offline, chất lượng cao. Tài khoản riêng, giao tự động.',
        price: 45000,
        categoryId: 'cat-1',
        categoryName: 'Tài khoản',
        shopId: 'shop-1',
        shopName: 'DigitalVN Store',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/spotify.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 80,
        soldCount: 560,
        ratingAverage: 4.4,
        ratingCount: 78,
        isFeatured: false,
        isHot: false,
        badges: ['Tự động'],
        complaintWindowHours: 48,
        warrantyPolicy: 'Bảo hành thời gian sử dụng. Đổi nếu bị thu hồi.',
        supportPolicy: 'Hỗ trợ đổi trong vòng 24 giờ.',
        createdAt: '2025-03-01',
        updatedAt: '2026-03-05',
    },
    {
        id: 'prod-7',
        name: 'Office 365 - Key vĩnh viễn',
        slug: 'office-365-key-vinh-vien',
        shortDescription: 'Key kích hoạt Office 365 vĩnh viễn, bao gồm Word, Excel, PowerPoint, Outlook.',
        description: 'Key Office 365 kích hoạt trên tài khoản Microsoft cá nhân. Bao gồm Word, Excel, PowerPoint, Outlook, OneDrive 1TB. Bản quyền vĩnh viễn.',
        price: 180000,
        compareAtPrice: 250000,
        categoryId: 'cat-2',
        categoryName: 'Phần mềm',
        shopId: 'shop-2',
        shopName: 'ProKey Hub',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/microsoft-office-2019.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 150,
        soldCount: 1800,
        ratingAverage: 4.7,
        ratingCount: 245,
        isFeatured: true,
        isHot: false,
        badges: ['Nổi bật', 'Tự động', 'Vĩnh viễn'],
        complaintWindowHours: 72,
        warrantyPolicy: 'Bảo hành vĩnh viễn. Hỗ trợ kích hoạt miễn phí.',
        supportPolicy: 'Hỗ trợ kỹ thuật qua chat.',
        createdAt: '2024-10-15',
        updatedAt: '2026-03-07',
    },
    {
        id: 'prod-8',
        name: 'Claude Pro - 1 tháng',
        slug: 'claude-pro-1-thang',
        shortDescription: 'Tài khoản Claude Pro (Anthropic) 1 tháng, truy cập Claude 3.5 Sonnet không giới hạn.',
        description: 'Claude Pro subscription 1 tháng, sử dụng Claude 3.5 Sonnet, Claude 3 Opus với rate limit cao. Phù hợp cho lập trình, viết content, phân tích dữ liệu.',
        price: 420000,
        compareAtPrice: 500000,
        categoryId: 'cat-3',
        categoryName: 'AI Tools',
        shopId: 'shop-4',
        shopName: 'AI Resource Center',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/bot.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 30,
        soldCount: 450,
        ratingAverage: 4.9,
        ratingCount: 67,
        isFeatured: true,
        isHot: true,
        badges: ['Bán chạy', 'Tự động', 'Premium'],
        complaintWindowHours: 72,
        warrantyPolicy: 'Bảo hành 30 ngày. Đổi tài khoản nếu gặp vấn đề.',
        supportPolicy: 'Hỗ trợ ưu tiên cao qua hệ thống khiếu nại.',
        createdAt: '2025-04-20',
        updatedAt: '2026-03-08',
    },
    {
        id: 'prod-9',
        name: 'Facebook Ads Account - Xác minh BM',
        slug: 'facebook-ads-account-xac-minh-bm',
        shortDescription: 'Tài khoản quảng cáo Facebook đã xác minh, thuộc BM, sẵn sàng chạy ads.',
        description: 'Facebook Ads Account trong Business Manager, đã xác minh danh tính, limit cao. Phù hợp cho agency và freelancer chạy ads.',
        price: 200000,
        categoryId: 'cat-5',
        categoryName: 'Mạng xã hội',
        shopId: 'shop-5',
        shopName: 'SocialBoost VN',
        shopVerified: false,
        images: ['https://img.icons8.com/color/480/facebook-ads.png'],
        status: 'active',
        deliveryType: 'manual',
        stockCount: 15,
        soldCount: 320,
        ratingAverage: 4.2,
        ratingCount: 45,
        isFeatured: false,
        isHot: false,
        badges: ['Thủ công'],
        complaintWindowHours: 48,
        warrantyPolicy: 'Bảo hành 48 giờ. Đổi nếu tài khoản bị khóa trước thời hạn.',
        supportPolicy: 'Hỗ trợ setup ads cơ bản.',
        createdAt: '2025-02-10',
        updatedAt: '2026-03-03',
    },
    {
        id: 'prod-10',
        name: 'Midjourney - Tài khoản Standard',
        slug: 'midjourney-standard',
        shortDescription: 'Tài khoản Midjourney Standard plan, tạo ảnh AI không giới hạn ở Relax mode.',
        description: 'Midjourney Standard subscription, 15 giờ Fast mode/tháng, unlimited Relax mode. Tạo ảnh AI chất lượng cao cho thiết kế, marketing, content.',
        price: 280000,
        categoryId: 'cat-3',
        categoryName: 'AI Tools',
        shopId: 'shop-4',
        shopName: 'AI Resource Center',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/paint-palette.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 25,
        soldCount: 380,
        ratingAverage: 4.8,
        ratingCount: 52,
        isFeatured: true,
        isHot: false,
        badges: ['Nổi bật', 'Tự động'],
        complaintWindowHours: 72,
        warrantyPolicy: 'Bảo hành 30 ngày.',
        supportPolicy: 'Hỗ trợ hướng dẫn sử dụng.',
        createdAt: '2025-03-10',
        updatedAt: '2026-03-08',
    },
    {
        id: 'prod-11',
        name: 'Netflix Premium - 1 tháng',
        slug: 'netflix-premium-1-thang',
        shortDescription: 'Tài khoản Netflix Premium UHD 4K, profile riêng, sử dụng 1 tháng.',
        description: 'Netflix Premium plan, xem phim 4K UHD trên 4 thiết bị, profile riêng cho bạn. Tài khoản chia sẻ, không thay đổi mật khẩu.',
        price: 35000,
        categoryId: 'cat-1',
        categoryName: 'Tài khoản',
        shopId: 'shop-1',
        shopName: 'DigitalVN Store',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/netflix.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 60,
        soldCount: 1500,
        ratingAverage: 4.3,
        ratingCount: 198,
        isFeatured: false,
        isHot: true,
        badges: ['Hot', 'Tự động'],
        complaintWindowHours: 24,
        warrantyPolicy: 'Bảo hành 30 ngày. Cập nhật nếu mật khẩu thay đổi.',
        supportPolicy: 'Hỗ trợ đổi profile trong vòng 24 giờ.',
        createdAt: '2025-01-05',
        updatedAt: '2026-03-08',
    },
    {
        id: 'prod-12',
        name: 'Notion Plus - 1 năm',
        slug: 'notion-plus-1-nam',
        shortDescription: 'Notion Plus plan cá nhân, unlimited blocks, file upload không giới hạn.',
        description: 'Notion Plus (trước đây là Personal Pro) 1 năm. Unlimited blocks, file upload không giới hạn, version history 30 ngày.',
        price: 95000,
        categoryId: 'cat-2',
        categoryName: 'Phần mềm',
        shopId: 'shop-1',
        shopName: 'DigitalVN Store',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/notion.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 40,
        soldCount: 210,
        ratingAverage: 4.6,
        ratingCount: 34,
        isFeatured: false,
        isHot: false,
        badges: ['Tự động'],
        complaintWindowHours: 48,
        warrantyPolicy: 'Bảo hành 12 tháng.',
        supportPolicy: 'Hỗ trợ qua chat.',
        createdAt: '2025-05-01',
        updatedAt: '2026-03-04',
    },
    {
        id: 'prod-13',
        name: 'RDP Windows Server - 1 tháng',
        slug: 'rdp-windows-server-1-thang',
        shortDescription: 'Remote Desktop Windows Server 2022, 4GB RAM, 2 vCPU, SSD 60GB.',
        description: 'VPS Windows Server 2022 với Remote Desktop, cấu hình 4GB RAM, 2 vCPU, SSD 60GB, bandwidth không giới hạn. Uptime 99.9%.',
        price: 150000,
        categoryId: 'cat-7',
        categoryName: 'Dịch vụ số',
        shopId: 'shop-3',
        shopName: 'CloudNet Solutions',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/remote-desktop.png'],
        status: 'active',
        deliveryType: 'manual',
        stockCount: 20,
        soldCount: 340,
        ratingAverage: 4.5,
        ratingCount: 56,
        isFeatured: false,
        isHot: false,
        badges: ['Thủ công'],
        complaintWindowHours: 48,
        warrantyPolicy: 'Bảo hành thời gian sử dụng.',
        supportPolicy: 'Hỗ trợ kỹ thuật 24/7.',
        createdAt: '2025-01-20',
        updatedAt: '2026-03-05',
    },
    {
        id: 'prod-14',
        name: 'Adobe Creative Cloud - 1 năm',
        slug: 'adobe-creative-cloud-1-nam',
        shortDescription: 'Adobe Creative Cloud full apps: Photoshop, Illustrator, Premiere Pro, After Effects...',
        description: 'Adobe Creative Cloud tất cả ứng dụng 1 năm. Bao gồm Photoshop, Illustrator, Premiere Pro, After Effects, Lightroom, InDesign và 20+ apps khác. 100GB cloud.',
        price: 480000,
        compareAtPrice: 650000,
        categoryId: 'cat-2',
        categoryName: 'Phần mềm',
        shopId: 'shop-2',
        shopName: 'ProKey Hub',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/adobe-creative-cloud.png'],
        status: 'active',
        deliveryType: 'manual',
        stockCount: 10,
        soldCount: 185,
        ratingAverage: 4.7,
        ratingCount: 28,
        isFeatured: true,
        isHot: false,
        badges: ['Nổi bật', 'Premium', 'Thủ công'],
        complaintWindowHours: 72,
        warrantyPolicy: 'Bảo hành 12 tháng đầy đủ.',
        supportPolicy: 'Hỗ trợ cài đặt và kích hoạt.',
        createdAt: '2025-02-15',
        updatedAt: '2026-03-06',
    },
    {
        id: 'prod-15',
        name: 'Instagram Followers - 1000',
        slug: 'instagram-followers-1000',
        shortDescription: '1000 followers Instagram chất lượng, profile đầy đủ, tăng dần tự nhiên.',
        description: 'Dịch vụ tăng 1000 followers Instagram, tài khoản có ảnh đại diện và bài đăng. Tăng dần trong 3-5 ngày, tỷ lệ rơi thấp.',
        price: 35000,
        categoryId: 'cat-5',
        categoryName: 'Mạng xã hội',
        shopId: 'shop-5',
        shopName: 'SocialBoost VN',
        shopVerified: false,
        images: ['https://img.icons8.com/color/480/instagram-new.png'],
        status: 'active',
        deliveryType: 'manual',
        stockCount: 999,
        soldCount: 2800,
        ratingAverage: 4.1,
        ratingCount: 156,
        isFeatured: false,
        isHot: true,
        badges: ['Hot', 'Thủ công'],
        complaintWindowHours: 48,
        warrantyPolicy: 'Bảo hành 30 ngày rơi followers.',
        supportPolicy: 'Hỗ trợ bù nếu rơi quá 20%.',
        createdAt: '2025-04-10',
        updatedAt: '2026-03-07',
    },
    {
        id: 'prod-16',
        name: 'TikTok Ads Account - Aged',
        slug: 'tiktok-ads-account-aged',
        shortDescription: 'Tài khoản TikTok Ads cổ, đã verify, sẵn sàng chạy quảng cáo.',
        description: 'TikTok Ads Account aged 6+ tháng, verified, whitelist zone tốt. Phù hợp cho agency và freelancer.',
        price: 380000,
        categoryId: 'cat-5',
        categoryName: 'Mạng xã hội',
        shopId: 'shop-5',
        shopName: 'SocialBoost VN',
        shopVerified: false,
        images: ['https://img.icons8.com/color/480/tiktok.png'],
        status: 'active',
        deliveryType: 'manual',
        stockCount: 8,
        soldCount: 95,
        ratingAverage: 4.2,
        ratingCount: 18,
        isFeatured: false,
        isHot: false,
        badges: ['Thủ công'],
        complaintWindowHours: 48,
        warrantyPolicy: 'Bảo hành 24 giờ.',
        supportPolicy: 'Hỗ trợ setup.',
        createdAt: '2025-06-25',
        updatedAt: '2026-03-02',
    },
    {
        id: 'prod-17',
        name: 'Grammarly Premium - 1 năm',
        slug: 'grammarly-premium-1-nam',
        shortDescription: 'Grammarly Premium cá nhân, kiểm tra ngữ pháp, phong cách viết nâng cao.',
        description: 'Grammarly Premium full feature: tone detection, clarity, plagiarism check, GrammarlyGO AI. Tài khoản riêng.',
        price: 110000,
        categoryId: 'cat-2',
        categoryName: 'Phần mềm',
        shopId: 'shop-1',
        shopName: 'DigitalVN Store',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/grammarly.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 55,
        soldCount: 390,
        ratingAverage: 4.6,
        ratingCount: 62,
        isFeatured: false,
        isHot: false,
        badges: ['Tự động'],
        complaintWindowHours: 48,
        warrantyPolicy: 'Bảo hành 12 tháng.',
        supportPolicy: 'Hỗ trợ đổi nếu lỗi.',
        createdAt: '2025-03-15',
        updatedAt: '2026-03-06',
    },
    {
        id: 'prod-18',
        name: 'OpenAI API Key - $50 Credits',
        slug: 'openai-api-key-50-credits',
        shortDescription: 'API key OpenAI với $50 credits, dùng cho GPT-4, DALL-E, Whisper.',
        description: 'API key OpenAI platform, đã nạp sẵn $50 credits. Dùng trực tiếp cho development, chatbot, automation.',
        price: 950000,
        categoryId: 'cat-3',
        categoryName: 'AI Tools',
        shopId: 'shop-4',
        shopName: 'AI Resource Center',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/artificial-intelligence.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 18,
        soldCount: 210,
        ratingAverage: 4.8,
        ratingCount: 38,
        isFeatured: true,
        isHot: false,
        badges: ['Nổi bật', 'Tự động'],
        complaintWindowHours: 72,
        warrantyPolicy: 'Bảo hành credits đầy đủ.',
        supportPolicy: 'Hỗ trợ kỹ thuật.',
        createdAt: '2025-04-05',
        updatedAt: '2026-03-08',
    },
    {
        id: 'prod-19',
        name: 'VPS Cloud SSD - 2GB RAM',
        slug: 'vps-cloud-ssd-2gb-ram',
        shortDescription: 'VPS Cloud SSD 2GB RAM, 1 vCPU, 20GB SSD, bandwidth không giới hạn.',
        description: 'VPS Cloud hiệu năng cao, SSD NVMe, cài sẵn Ubuntu hoặc Windows theo yêu cầu. Uptime 99.9%.',
        price: 75000,
        categoryId: 'cat-7',
        categoryName: 'Dịch vụ số',
        shopId: 'shop-3',
        shopName: 'CloudNet Solutions',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/cloud-server.png'],
        status: 'active',
        deliveryType: 'manual',
        stockCount: 30,
        soldCount: 420,
        ratingAverage: 4.6,
        ratingCount: 73,
        isFeatured: false,
        isHot: false,
        badges: ['Thủ công', 'Còn hàng'],
        complaintWindowHours: 48,
        warrantyPolicy: 'Bảo hành thời gian sử dụng.',
        supportPolicy: 'Hỗ trợ kỹ thuật 24/7.',
        createdAt: '2025-02-10',
        updatedAt: '2026-03-04',
    },
    {
        id: 'prod-20',
        name: 'YouTube Premium - 6 tháng',
        slug: 'youtube-premium-6-thang',
        shortDescription: 'YouTube Premium cá nhân, không quảng cáo, tải video offline.',
        description: 'YouTube Premium cá nhân 6 tháng: không quảng cáo, phát nền, YouTube Music Premium đi kèm.',
        price: 55000,
        categoryId: 'cat-1',
        categoryName: 'Tài khoản',
        shopId: 'shop-1',
        shopName: 'DigitalVN Store',
        shopVerified: true,
        images: ['https://img.icons8.com/color/480/youtube-play.png'],
        status: 'active',
        deliveryType: 'auto',
        stockCount: 42,
        soldCount: 680,
        ratingAverage: 4.4,
        ratingCount: 95,
        isFeatured: false,
        isHot: false,
        badges: ['Tự động'],
        complaintWindowHours: 48,
        warrantyPolicy: 'Bảo hành thời gian sử dụng.',
        supportPolicy: 'Hỗ trợ đổi nếu hết hạn sớm.',
        createdAt: '2025-05-10',
        updatedAt: '2026-03-07',
    },
];

// ============================================================
// REVIEWS
// ============================================================
export const reviews: Review[] = [];

// ============================================================
// SAMPLE USER DATA
// ============================================================
export const sampleOrders: Order[] = [];

export const sampleTransactions: Transaction[] = [];

export const sampleNotifications: Notification[] = [];

export const banners: Banner[] = [
    { id: 'banner-1', title: 'Khám phá chợ tài nguyên số hiện đại', subtitle: 'Tìm kiếm sản phẩm nhanh hơn, theo dõi giao dịch dễ hơn và quản lý mọi thứ trên một nền tảng duy nhất.', imageUrl: '/banners/banner1.png', link: '/danh-muc/ai-tools' },
    { id: 'banner-2', title: 'Dành cho người bán muốn vận hành gọn hơn', subtitle: 'Tạo shop, quản lý tồn kho, theo dõi doanh thu và xử lý đơn hàng trong Seller Center.', imageUrl: '/banners/banner2.png', link: '/seller' },
    { id: 'banner-3', title: 'Tập trung mọi giao dịch vào một hệ thống rõ ràng', subtitle: 'Ví nội bộ, thông báo, lịch sử đơn hàng và quy trình hỗ trợ được hiển thị minh bạch.', imageUrl: '/banners/banner3.png', link: '/huong-dan' },
];

// ============================================================
// SELLER DASHBOARD DATA
// ============================================================
export const sellerDashboardData = {
    revenueToday: 0,
    revenueMonth: 0,
    newOrders: 0,
    pendingWithdrawal: 0,
    activeProducts: 0,
    openComplaints: 0,
    revenueChart: [] as { date: string; revenue: number; orders: number }[],
};

// ============================================================
// ADMIN DASHBOARD DATA
// ============================================================
export const adminDashboardData = {
    totalUsers: 0,
    totalShops: 0,
    totalRevenue: 0,
    ordersToday: 0,
    openComplaints: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    revenueChart: [] as { month: string; revenue: number }[],
};
