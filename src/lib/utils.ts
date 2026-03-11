export function cn(...inputs: (string | undefined | null | false)[]) {
    return inputs.filter(Boolean).join(' ');
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

export function formatDate(date: string): string {
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(date));
}

export function formatDateTime(date: string): string {
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(date));
}

export function getStatusColor(status: string): string {
    const map: Record<string, string> = {
        active: 'success',
        completed: 'success',
        delivered: 'success',
        approved: 'success',
        verified: 'success',
        resolved: 'success',
        paid: 'info',
        pending: 'warning',
        pending_review: 'warning',
        pending_payment: 'warning',
        processing: 'warning',
        open: 'warning',
        under_review: 'info',
        delivering: 'info',
        rejected: 'danger',
        suspended: 'danger',
        disputed: 'danger',
        cancelled: 'neutral',
        paused: 'neutral',
        archived: 'neutral',
        refunded: 'warning',
        draft: 'neutral',
        out_of_stock: 'warning',
    };
    return map[status.toLowerCase()] || 'neutral';
}

export function getStatusLabel(status: string): string {
    const map: Record<string, string> = {
        active: 'Đang hoạt động',
        completed: 'Hoàn tất',
        delivered: 'Đã giao',
        approved: 'Đã duyệt',
        verified: 'Đã xác minh',
        resolved: 'Đã xử lý',
        paid: 'Đã thanh toán',
        pending: 'Đang chờ',
        pending_review: 'Chờ duyệt',
        pending_payment: 'Chờ thanh toán',
        processing: 'Đang xử lý',
        open: 'Mới tạo',
        under_review: 'Đang xem xét',
        delivering: 'Đang giao',
        rejected: 'Từ chối',
        suspended: 'Tạm ngưng',
        disputed: 'Tranh chấp',
        cancelled: 'Đã hủy',
        paused: 'Tạm dừng',
        archived: 'Đã lưu trữ',
        refunded: 'Hoàn tiền',
        draft: 'Bản nháp',
        out_of_stock: 'Hết hàng',
        seller_replied: 'Seller đã phản hồi',
        waiting_user: 'Chờ người dùng',
    };
    return map[status.toLowerCase()] || status;
}
