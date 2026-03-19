/**
 * MoMo Payment Gateway — "Thanh Toán Thông Thường" (captureWallet)
 * Based on official docs: https://business.momo.vn → Hướng dẫn tích hợp
 * 
 * KEY: accessKey is used in SIGNATURE only, NOT in request body!
 */

import crypto from 'crypto';

export interface MoMoPaymentRequest {
    orderId: string;
    amount: number;
    orderInfo: string;
    extraData?: string;
}

export interface MoMoPaymentResponse {
    partnerCode: string;
    orderId: string;
    requestId: string;
    amount: number;
    responseTime: number;
    message: string;
    resultCode: number;
    payUrl: string;
    shortLink?: string;
    deeplink?: string;
    qrCodeUrl?: string;
}

function getConfig() {
    const partnerCode = process.env.MOMO_PARTNER_CODE || '';
    const accessKey = process.env.MOMO_ACCESS_KEY || '';
    const secretKey = process.env.MOMO_SECRET_KEY || '';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://chotainguyenmmo.com';
    const isSandbox = process.env.MOMO_SANDBOX === 'true';

    return {
        partnerCode,
        accessKey,
        secretKey,
        redirectUrl: `${baseUrl}/dashboard/nap-tien?momo=callback`,
        ipnUrl: `${baseUrl}/api/v1/wallet/momo/ipn`,
        endpoint: isSandbox
            ? 'https://test-payment.momo.vn/v2/gateway/api/create'
            : 'https://payment.momo.vn/v2/gateway/api/create',
    };
}

/**
 * Create MoMo payment — follows official docs "Thanh Toán Thông Thường"
 * 
 * Mẫu Request from docs:
 * {
 *   "partnerCode": "MOMOT5BZ20231213_TEST",
 *   "requestType": "captureWallet",
 *   "ipnUrl": "https://example.com/momo_ip",
 *   "redirectUrl": "https://momo.vn/",
 *   "orderId": "Partner_Transaction_ID_1721725424433",
 *   "amount": "1000",
 *   "orderInfo": "Thank you for your purchase at MoMo_test",
 *   "requestId": "Request_ID_1721725424433",
 *   "extraData": "eyJza3VzIjoiIn0=",
 *   "signature": "...",
 *   "lang": "en"
 * }
 */
export async function createMoMoPayment(req: MoMoPaymentRequest): Promise<MoMoPaymentResponse> {
    const cfg = getConfig();

    if (!cfg.partnerCode || !cfg.accessKey || !cfg.secretKey) {
        throw new Error('MoMo chưa cấu hình: cần MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY');
    }

    const requestId = 'Request_ID_' + new Date().getTime();
    const amount = String(req.amount);
    const requestType = 'captureWallet';

    // extraData: if already base64 from caller, use as-is; otherwise encode
    const extraData = req.extraData || Buffer.from('{"skus":""}').toString('base64');

    // Signature: accessKey is ONLY here, NOT in body
    // Format from docs: sorted a-z
    const rawSignature =
        'accessKey=' + cfg.accessKey +
        '&amount=' + amount +
        '&extraData=' + extraData +
        '&ipnUrl=' + cfg.ipnUrl +
        '&orderId=' + req.orderId +
        '&orderInfo=' + req.orderInfo +
        '&partnerCode=' + cfg.partnerCode +
        '&redirectUrl=' + cfg.redirectUrl +
        '&requestId=' + requestId +
        '&requestType=' + requestType;

    const signature = crypto.createHmac('sha256', cfg.secretKey)
        .update(rawSignature).digest('hex');

    // Body: matches official docs sample EXACTLY
    // NO accessKey in body!
    const body = {
        partnerCode: cfg.partnerCode,
        requestType: requestType,
        ipnUrl: cfg.ipnUrl,
        redirectUrl: cfg.redirectUrl,
        orderId: req.orderId,
        amount: amount,
        orderInfo: req.orderInfo,
        requestId: requestId,
        extraData: extraData,
        signature: signature,
        lang: 'vi',
    };

    console.log('[MoMo] Creating payment:', JSON.stringify({
        orderId: req.orderId,
        amount,
        endpoint: cfg.endpoint,
        partnerCode: cfg.partnerCode,
    }));

    const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log('[MoMo] Response:', JSON.stringify(data));

    if (data.resultCode !== 0) {
        throw new Error(`MoMo: ${data.message} (code: ${data.resultCode})`);
    }

    return data;
}

/**
 * Verify MoMo IPN callback signature
 * Format from docs: sorted a-z
 */
export function verifyMoMoSignature(params: Record<string, any>): boolean {
    const cfg = getConfig();
    const {
        partnerCode, orderId, requestId, amount, orderInfo,
        orderType, transId, resultCode, message, payType,
        responseTime, extraData, signature,
    } = params;

    const rawSignature =
        'accessKey=' + cfg.accessKey +
        '&amount=' + amount +
        '&extraData=' + extraData +
        '&message=' + message +
        '&orderId=' + orderId +
        '&orderInfo=' + orderInfo +
        '&orderType=' + orderType +
        '&partnerCode=' + partnerCode +
        '&payType=' + payType +
        '&requestId=' + requestId +
        '&responseTime=' + responseTime +
        '&resultCode=' + resultCode +
        '&transId=' + transId;

    const expected = crypto.createHmac('sha256', cfg.secretKey)
        .update(rawSignature).digest('hex');

    return signature === expected;
}
