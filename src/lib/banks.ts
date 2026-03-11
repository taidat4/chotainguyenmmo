/**
 * Danh sách ngân hàng Việt Nam — đầy đủ
 * Dùng chung cho tất cả dropdown chọn ngân hàng
 */

export const VIETNAMESE_BANKS = [
    // Ngân hàng thương mại nhà nước
    { code: 'AGRIBANK', name: 'Agribank', fullName: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam' },
    { code: 'BIDV', name: 'BIDV', fullName: 'Ngân hàng Đầu tư và Phát triển Việt Nam' },
    { code: 'VCB', name: 'Vietcombank', fullName: 'Ngân hàng Ngoại thương Việt Nam' },
    { code: 'CTG', name: 'VietinBank', fullName: 'Ngân hàng Công thương Việt Nam' },

    // Ngân hàng thương mại cổ phần lớn
    { code: 'ACB', name: 'ACB', fullName: 'Ngân hàng Á Châu' },
    { code: 'HDB', name: 'HDBank', fullName: 'Ngân hàng Phát triển TP.HCM' },
    { code: 'MBB', name: 'MB Bank', fullName: 'Ngân hàng Quân đội' },
    { code: 'MSB', name: 'MSB', fullName: 'Ngân hàng Hàng Hải Việt Nam' },
    { code: 'SHB', name: 'SHB', fullName: 'Ngân hàng Sài Gòn - Hà Nội' },
    { code: 'STB', name: 'Sacombank', fullName: 'Ngân hàng Sài Gòn Thương Tín' },
    { code: 'TCB', name: 'Techcombank', fullName: 'Ngân hàng Kỹ thương Việt Nam' },
    { code: 'TPB', name: 'TPBank', fullName: 'Ngân hàng Tiên Phong' },
    { code: 'VPB', name: 'VPBank', fullName: 'Ngân hàng Việt Nam Thịnh Vượng' },
    { code: 'VIB', name: 'VIB', fullName: 'Ngân hàng Quốc tế Việt Nam' },
    { code: 'SSB', name: 'SeABank', fullName: 'Ngân hàng Đông Nam Á' },
    { code: 'EIB', name: 'Eximbank', fullName: 'Ngân hàng Xuất Nhập Khẩu Việt Nam' },
    { code: 'LPB', name: 'LPBank', fullName: 'Ngân hàng Bưu điện Liên Việt' },
    { code: 'OCB', name: 'OCB', fullName: 'Ngân hàng Phương Đông' },
    { code: 'SCB', name: 'SCB', fullName: 'Ngân hàng Sài Gòn' },

    // Ngân hàng thương mại cổ phần khác
    { code: 'ABB', name: 'ABBank', fullName: 'Ngân hàng An Bình' },
    { code: 'BAB', name: 'BacABank', fullName: 'Ngân hàng Bắc Á' },
    { code: 'BVB', name: 'BaoVietBank', fullName: 'Ngân hàng Bảo Việt' },
    { code: 'KLB', name: 'KienlongBank', fullName: 'Ngân hàng Kiên Long' },
    { code: 'NAB', name: 'NamABank', fullName: 'Ngân hàng Nam Á' },
    { code: 'NCB', name: 'NCB', fullName: 'Ngân hàng Quốc Dân' },
    { code: 'PGB', name: 'PGBank', fullName: 'Ngân hàng Xăng Dầu Petrolimex' },
    { code: 'PVCB', name: 'PVcomBank', fullName: 'Ngân hàng Đại Chúng Việt Nam' },
    { code: 'SGB', name: 'SaigonBank', fullName: 'Ngân hàng Sài Gòn Công Thương' },
    { code: 'VAB', name: 'VietABank', fullName: 'Ngân hàng Việt Á' },
    { code: 'VBB', name: 'VietBank', fullName: 'Ngân hàng Việt Nam Thương Tín' },
    { code: 'VNCB', name: 'VietCapitalBank', fullName: 'Ngân hàng Bản Việt' },
    { code: 'GPB', name: 'GPBank', fullName: 'Ngân hàng Dầu Khí Toàn Cầu' },
    { code: 'DOB', name: 'DongABank', fullName: 'Ngân hàng Đông Á' },

    // Ngân hàng liên doanh / nước ngoài phổ biến
    { code: 'IVB', name: 'IndovinaBank', fullName: 'Ngân hàng Indovina' },
    { code: 'WOO', name: 'Woori Bank', fullName: 'Ngân hàng Woori Việt Nam' },
    { code: 'SCVN', name: 'Standard Chartered', fullName: 'Standard Chartered Việt Nam' },
    { code: 'HSBC', name: 'HSBC', fullName: 'HSBC Việt Nam' },
    { code: 'SHBVN', name: 'Shinhan Bank', fullName: 'Ngân hàng Shinhan Việt Nam' },
    { code: 'UOB', name: 'UOB', fullName: 'United Overseas Bank Việt Nam' },
    { code: 'CIMB', name: 'CIMB', fullName: 'CIMB Việt Nam' },
    { code: 'COOPBANK', name: 'Co-opBank', fullName: 'Ngân hàng Hợp tác xã Việt Nam' },
    { code: 'CAKE', name: 'CAKE by VPBank', fullName: 'Ngân hàng số CAKE' },
    { code: 'UBANK', name: 'Ubank by VPBank', fullName: 'Ngân hàng số Ubank' },
    { code: 'TIMO', name: 'Timo', fullName: 'Ngân hàng số Timo by Bản Việt' },

    // Ví điện tử
    { code: 'MOMO', name: 'MoMo', fullName: 'Ví MoMo' },
    { code: 'ZALOPAY', name: 'ZaloPay', fullName: 'Ví ZaloPay' },
    { code: 'VNPAY', name: 'VNPay', fullName: 'Ví VNPay' },
    { code: 'VIETTELPAY', name: 'Viettel Money', fullName: 'Viettel Money (Viettel Pay)' },
    { code: 'SHOPEEPAY', name: 'ShopeePay', fullName: 'Ví ShopeePay' },
] as const;

export type BankCode = typeof VIETNAMESE_BANKS[number]['code'];
