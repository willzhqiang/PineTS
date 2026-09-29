import { describe, it, expect } from 'vitest';
import { PineTS } from '../../src/index';

const DAY = 86_400_000;
const bar = (openTime: number, i: number, step: number) => ({
    openTime, open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i + (i % 3), volume: 1000,
    closeTime: openTime + step - 1, quoteAssetVolume: 0, numberOfTrades: 0,
    takerBuyBaseAssetVolume: 0, takerBuyQuoteAssetVolume: 0, ignore: 0,
});

describe('request.security higher-timeframe warmup', () => {
    it('leads a daily secondary in by ~250 daily bars so Wilder ATR is fully seeded', async () => {
        const end = Date.UTC(2026, 8, 28, 20, 0);
        const requested: Record<string, { sDate?: number }> = {};
        const provider = {
            getMarketData: async (_s: string, tf: string, _limit: number, sDate?: number) => {
                requested[tf] = { sDate };
                if (tf === 'D') return Array.from({ length: 300 }, (_, i) => bar(end - (300 - i) * DAY, i, DAY));
                return Array.from({ length: 50 }, (_, i) => bar(end - (50 - i) * 600_000, i, 600_000));
            },
            getSymbolInfo: async () => ({ prefix: 'X', ticker: 'X', tickerid: 'X:X', timezone: 'UTC', session: '24x7', mintick: 0.01 }),
        };
        const pine = new PineTS(provider as any, 'X', '10', 50);
        await pine.run(`//@version=5
indicator("t")
d = request.security(syminfo.tickerid, "D", ta.atr(14))
plot(d, title = "d")`);

        const firstChartBar = end - 50 * 600_000;
        const lead = firstChartBar - (requested['D']?.sDate ?? firstChartBar);
        expect(lead).toBeGreaterThanOrEqual(250 * DAY);
    });
});
