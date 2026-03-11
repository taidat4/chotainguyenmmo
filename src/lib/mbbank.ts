/**
 * MB Bank Service — Port from MY_BOT Python to TypeScript
 * Uses apicanhan.com API to check bank transactions
 */

interface MBTransaction {
    transaction_id: string;
    amount: number;
    description: string;
    transaction_date: string;
    type: string;
}

interface MBApiResponse {
    status: string;
    transactions?: Array<{
        transactionID: string;
        amount: number;
        description: string;
        transactionDate: string;
        type: string;
    }>;
    message?: string;
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
        try {
            const params = new URLSearchParams({
                key: this.apiKey,
                username: this.username,
                password: this.password,
                accountNo: this.accountNo,
            });

            const response = await fetch(`${this.apiUrl}?${params}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                console.error(`❌ MB Bank API HTTP ${response.status}`);
                return null;
            }

            const data: MBApiResponse = await response.json();

            if (data.status === 'success' && data.transactions) {
                const inTransactions = data.transactions
                    .filter(t => t.type === 'IN')
                    .slice(0, limit)
                    .map(t => ({
                        transaction_id: t.transactionID || '',
                        amount: Number(t.amount) || 0,
                        description: t.description || '',
                        transaction_date: t.transactionDate || '',
                        type: t.type || 'IN',
                    }));

                return inTransactions;
            }

            console.warn(`⚠️ MB Bank API error: ${data.message}`);
            return null;
        } catch (error) {
            console.error(`❌ MB Bank API error:`, error);
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

        for (const tx of transactions) {
            if (Math.round(tx.amount) !== amount) continue;

            const txDescNormalized = this.normalize(tx.description);
            if (txDescNormalized.includes(contentNormalized)) {
                return tx;
            }
        }

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
