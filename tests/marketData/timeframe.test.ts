import { describe, it, expect } from 'vitest';
import { parseTimeframe, canonicalTimeframe, timeframeSeconds, compareTimeframes, isValidTimeframe } from '../../src/marketData/timeframe';

describe('parseTimeframe', () => {
    it.each([
        ['1', '1', 60],
        ['10', '10', 600],
        [10, '10', 600],
        ['2', '2', 120],
        ['90', '90', 5400],
        ['10m', '10', 600],
        ['1h', '60', 3600],
        ['4H', '240', 14400],
        ['120', '120', 7200],
        ['30S', '30S', 30],
        ['45s', '45S', 45],
        ['D', 'D', 86400],
        ['1D', 'D', 86400],
        ['1d', 'D', 86400],
        ['3D', '3D', 3 * 86400],
        ['W', 'W', 604800],
        ['2w', '2W', 2 * 604800],
        ['M', 'M', 30 * 86400],
        ['m', 'M', 30 * 86400],
        ['1M', 'M', 30 * 86400],
        ['3M', '3M', 90 * 86400],
        ['12M', '12M', 360 * 86400],
    ] as [string | number, string, number][])('%s -> %s (%ds)', (input, canonical, seconds) => {
        const p = parseTimeframe(input)!;
        expect(p.canonical).toBe(canonical);
        expect(p.seconds).toBe(seconds);
    });

    it('distinguishes lowercase m (minutes) from uppercase M (months)', () => {
        expect(canonicalTimeframe('10m')).toBe('10');
        expect(canonicalTimeframe('10M')).toBe('10M');
    });

    it.each(['', ' ', '0', '-5', 'abc', '1x', '1.5', 'D1', null, undefined])('rejects %s', (input) => {
        expect(parseTimeframe(input as any)).toBeNull();
        expect(isValidTimeframe(input as any)).toBe(false);
    });

    it('orders by nominal duration', () => {
        const tfs = ['D', '10', '3', '1h', '2', '20', 'W', '45S', '4', 'M'];
        expect([...tfs].sort(compareTimeframes)).toEqual(['45S', '2', '3', '4', '10', '20', '1h', 'D', 'W', 'M']);
        expect(timeframeSeconds('nope')).toBeNull();
        expect(() => compareTimeframes('10', 'nope')).toThrow('Invalid timeframe');
    });
});
