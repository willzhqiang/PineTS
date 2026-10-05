// SPDX-License-Identifier: AGPL-3.0-only
// request.security on a higher timeframe whose bars are SESSION-bound (a daily bar 09:30–16:00)
// from a chart that also carries extended-hours bars: a pre/post-market bar opens in the gap
// between two HTF bars. It used to find no HTF bar at all (NaN); it must map to the day it
// belongs to — post-market → that day's finished bar, pre-market → the previous finished bar.

import { describe, it, expect } from 'vitest';
import { findSecContextIdx } from '../../src/namespaces/request/utils/findSecContextIdx';

const H = 3_600_000;
const DAY = 24 * H;
// Three trading days 0, 1, 2 (day d starts at d * DAY); each daily bar runs 09:30–16:00.
const open = [0, 1, 2].map((d) => d * DAY + 9.5 * H);
const close = [0, 1, 2].map((d) => d * DAY + 16 * H);
const at = (d: number, hour: number): number => d * DAY + hour * H;
const idx = (d: number, hour: number, lookahead: boolean, hours = 1): number => findSecContextIdx(at(d, hour), at(d, hour) + hours * H, open, close, lookahead);

describe('findSecContextIdx — session-bound HTF bars', () => {
    it('regular-hours bars are unchanged: previous day mid-session, this day on the last bar', () => {
        expect(idx(1, 10.5, false)).toBe(0);
        expect(idx(1, 15.5, false, 0.5)).toBe(1); // closes with the daily bar
        expect(idx(1, 10.5, true)).toBe(1);
    });

    it('a post-market bar reads that day\'s finished bar (lookahead off and on)', () => {
        expect(idx(1, 17, false)).toBe(1);
        expect(idx(1, 17, true)).toBe(1);
    });

    it('a pre-market bar reads the previous finished bar (off) or the day it precedes (on)', () => {
        expect(idx(2, 5, false)).toBe(1);
        expect(idx(2, 5, true)).toBe(2);
    });

    it('before the first HTF bar there is nothing finished yet (off) — and the first bar on lookahead', () => {
        expect(idx(0, 5, false)).toBe(-1);
        expect(idx(0, 5, true)).toBe(0);
    });

    it('after the last HTF bar the last one is the answer', () => {
        expect(idx(2, 18, false)).toBe(2);
    });

    it('a bar far from every HTF bar (more than a day away) still finds nothing', () => {
        expect(findSecContextIdx(at(9, 12), at(9, 13), open, close, false)).toBe(-1);
    });

    it('tiling HTF bars (no gaps) behave as before', () => {
        const o = [0, DAY, 2 * DAY];
        const c = [DAY, 2 * DAY, 3 * DAY];
        expect(findSecContextIdx(DAY + 3 * H, DAY + 4 * H, o, c, false)).toBe(0);
        expect(findSecContextIdx(DAY + 23 * H, 2 * DAY, o, c, false)).toBe(1);
        expect(findSecContextIdx(DAY + 3 * H, DAY + 4 * H, o, c, true)).toBe(1);
    });
});
