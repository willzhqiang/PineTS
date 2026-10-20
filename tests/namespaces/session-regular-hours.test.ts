import { describe, it, expect } from 'vitest';
import { PineTS } from 'index';

// A US stock chart with extended hours: 15-minute bars from 04:00 to 20:00 New York time.
// TradingView's session flags locate each bar (by its open time) against the REGULAR hours:
// ismarket 09:30–16:00, ispremarket before, ispostmarket after; isfirstbar_regular is the
// 09:30 bar and islastbar_regular the 15:45 bar, while isfirstbar stays the 04:00 bar.
const Q = 900_000;
const ny = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00-04:00`).getTime(); // EDT

function extendedDay(d: string) {
    const out = [];
    for (let t = ny(d, '04:00'); t < ny(d, '20:00'); t += Q) {
        out.push({ openTime: t, closeTime: t + Q, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 });
    }
    return out;
}

const bars = [...extendedDay('2026-09-24'), ...extendedDay('2026-09-25')];
const hhmm = (t: number) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(t);

const provider = (syminfo: Record<string, unknown>) => ({
    getMarketData: async () => bars,
    getSymbolInfo: async () => ({ prefix: 'NYSE', ticker: 'SPY', tickerid: 'NYSE:SPY', timezone: 'America/New_York', mintick: 0.01, ...syminfo }),
});

const code = `
//@version=6
indicator("flags")
plot(session.ismarket ? 1 : 0, "market")
plot(session.ispremarket ? 1 : 0, "pre")
plot(session.ispostmarket ? 1 : 0, "post")
plot(session.isfirstbar_regular ? 1 : 0, "first_reg")
plot(session.islastbar_regular ? 1 : 0, "last_reg")
plot(session.isfirstbar ? 1 : 0, "first")
`;

async function flags(syminfo: Record<string, unknown>) {
    const pine = new PineTS(provider(syminfo) as any, 'SPY', '15', bars.length);
    const { plots } = await pine.run(code);
    const at = (name: string) => plots[name].data.filter((d: any) => d.value === 1).map((d: any) => hhmm(d.time));
    const count = (name: string) => plots[name].data.filter((d: any) => d.value === 1).length;
    return { at, count };
}

describe('session flags on an extended-hours stock chart', () => {
    for (const [label, syminfo] of [
        ['session_regular carries the hours, session the chart type', { session: 'extended', session_regular: '0930-1600' }],
        ['session itself is the hours spec (Alpaca-style providers)', { session: '0930-1600' }],
    ] as const) {
        it(label, async () => {
            const f = await flags(syminfo);
            expect(f.count('market')).toBe(2 * 26); // 09:30 … 15:45
            expect(f.count('pre')).toBe(2 * 22); // 04:00 … 09:15
            expect(f.count('post')).toBe(2 * 16); // 16:00 … 19:45
            expect(f.at('first_reg')).toEqual(['09:30', '09:30']);
            expect(f.at('last_reg')).toEqual(['15:45', '15:45']);
            expect(f.at('first')).toEqual(['04:00', '04:00']);
        });
    }
});

describe('session flags on a daily stock chart', () => {
    it('a daily bar stamped at midnight is still the market session', async () => {
        const DAY = 86_400_000;
        const days = Array.from({ length: 5 }, (_, i) => {
            const t = new Date('2026-09-21T04:00:00Z').getTime() + i * DAY; // 00:00 New York
            return { openTime: t, closeTime: t + DAY, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 };
        });
        const pine = new PineTS(
            { getMarketData: async () => days, getSymbolInfo: async () => ({ ticker: 'SPY', tickerid: 'NYSE:SPY', timezone: 'America/New_York', session: '0930-1600' }) } as any,
            'SPY',
            'D',
            days.length,
        );
        const { plots } = await pine.run(code);
        for (const d of plots['market'].data) expect(d.value).toBe(1);
        for (const d of plots['first_reg'].data) expect(d.value).toBe(1);
    });
});
