/**
 * MB Bank Service — Ported from Credit-Flow Manager (working implementation)
 * Uses apicanhan.com API to check bank transactions
 */

interface MBTransaction {
    transaction_id: string;
    amount: number;
    description: string;
    transaction_date: string;
    type: string;
}

export class MBBankService {
    private apiUrl: string;
    private apiKey: string;
    private username: string;
    private password: string;
    private accountNo: string;

    constructor() {
        this.apiUrl = process.env.MBBANK_API_URL || 'https://apicanhan.com/api/mbbankv3';
        this.apiKey = process.env.MBBANK_API_KEY || '';
        this.username = process.env.MBBANK_USERNAME || '';
        this.password = process.env.MBBANK_PASSWORD || '';
        this.accountNo = process.env.MBBANK_ACCOUNT || '';
    }

    async getTransactions(limit = 20): Promise<MBTransaction[] | null> {
        if (!this.apiKey || !this.accountNo) {
            console.log('[MBBank] Missing API key or account number');
            return null;
        }

        try {
            const params = new URLSearchParams({
                key: this.apiKey,
                username: this.username || this.accountNo,
                password: this.password || '',
                accountNo: this.accountNo,
            });

            const url = `${this.apiUrl}?${params.toString()}`;
            console.log(`[MBBank] Fetching: ${this.apiUrl}?key=***&username=${this.username}&accountNo=${this.accountNo}`);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(url, {
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) {
                console.log(`[MBBank] API error: HTTP ${response.status}`);
                return null;
            }

            const data = await response.json();
            console.log(`[MBBank] API status: ${data.status}, message: ${data.message || 'none'}`);

            if (data.status !== 'success') {
                console.log(`[MBBank] API returned error: ${data.message || 'Unknown'}`);
                return null;
            }

            const txList = data.transactions || [];
            if (!Array.isArray(txList)) {
                console.log('[MBBank] transactions is not an array');
                return null;
            }

            console.log(`[MBBank] Got ${txList.length} transactions from API`);

            // Return ALL transactions (not just IN), map with fallback fields like Credit-Flow
            return txList.slice(0, limit).map((t: any) => ({
                transaction_id: String(t.transactionNumber || t.refNo || t.transactionID || t.id || ''),
                amount: Number(t.creditAmount || t.amount || 0),
                description: (t.description || t.addDescription || '').toUpperCase(),
                transaction_date: t.transactionDate || '',
                type: t.type || (Number(t.creditAmount || 0) > 0 ? 'IN' : 'OUT'),
            }));
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('[MBBank] API request timeout (30s)');
            } else {
                console.log(`[MBBank] API request error: ${error.message}`);
            }
            return null;
        }
    }

    private normalize(s: string): string {
        return s.toUpperCase().replace(/\s/g, '').replace(/_/g, '');
    }

    async checkDeposit(content: string, amount: number): Promise<MBTransaction | null> {
        const transactions = await this.getTransactions();
        if (!transactions) return null;

        const contentNormalized = this.normalize(content);
        console.log(`[MBBank] Checking for: code="${contentNormalized}", amount=${amount}`);
        console.log(`[MBBank] Total transactions to search: ${transactions.length}`);

        for (const tx of transactions) {
            // Skip zero/negative amounts
            if (tx.amount <= 0) continue;

            const txDescNormalized = this.normalize(tx.description);

            // Log each transaction for debugging
            console.log(`[MBBank]   TX: amount=${tx.amount}, desc="${tx.description.substring(0, 60)}"`);

            // Check if description contains deposit code
            const codeMatch = txDescNormalized.includes(contentNormalized);
            // Check if amount matches (with tolerance)
            const amountMatch = Math.abs(Math.round(tx.amount) - amount) < 100; // 100đ tolerance

            if (codeMatch && amountMatch) {
                console.log(`[MBBank] ✓ MATCH FOUND: ${tx.transaction_id} — ${tx.amount}đ`);
                return tx;
            }

            // Also try matching code only (amount might be slightly different due to bank fees)
            if (codeMatch) {
                console.log(`[MBBank] ✓ CODE MATCH (amount differs): txAmount=${tx.amount} vs expected=${amount}`);
                return tx;
            }
        }

        console.log(`[MBBank] ✗ No matching transaction found`);
        return null;
    }

    async testConnection(): Promise<boolean> {
        const transactions = await this.getTransactions(1);
        return transactions !== null;
    }
}

// QR code URL generator
export function generateQRUrl(accountNo: string, amount: number, content: string): string {
    const safeContent = encodeURIComponent(content);
    return `https://img.vietqr.io/image/MB-${accountNo}-compact.png?amount=${amount}&addInfo=${safeContent}`;
}

// Singleton
let mbBankService: MBBankService | null = null;

export function getMBBankService(): MBBankService {
    if (!mbBankService) {
        mbBankService = new MBBankService();
    }
    return mbBankService;
}
