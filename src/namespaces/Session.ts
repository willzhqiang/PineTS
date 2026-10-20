// SPDX-License-Identifier: AGPL-3.0-only

import { getDatePartsInTimezone } from './Time';

/**
 * Pine Script `session` namespace.
 *
 * Constants:
 * - session.regular / session.extended — session-type strings for ticker.new()/ticker.modify().
 *
 * Variables:
 * - session.isfirstbar / session.islastbar — first/last bar of the trading session.
 * - session.isfirstbar_regular / session.islastbar_regular — same, for the regular session.
 * - session.ismarket / session.ispremarket / session.ispostmarket — intra-session location.
 *
 * A trading session is a calendar day in `syminfo.timezone`, so session
 * boundaries are detected as trading-day changes between consecutive bars.
 *
 * Regular hours come from `syminfo.session_regular` ("0930-1600"), or from
 * `syminfo.session` when that is itself an hours spec (Alpaca-style providers).
 * With regular hours known, each bar is located by its OPEN time, as on
 * TradingView: `ismarket` inside them, `ispremarket` / `ispostmarket` before /
 * after, and `isfirstbar_regular` / `islastbar_regular` mark the first / last
 * regular bar of the day — so an extended-hours chart's pre-market bars do not
 * count as the market session. Without regular hours (24/7 crypto) every bar is
 * the market session and the regular flags mirror `isfirstbar` / `islastbar`.
 */
export class Session {
    public readonly regular = 'regular';
    public readonly extended = 'extended';

    constructor(private context: any) {}

    private get _timezone(): string {
        return this.context.pine?.syminfo?.timezone || 'UTC';
    }

    /** Regular hours as minutes of the exchange day, or null on a continuous market. */
    private get _regular(): { start: number; end: number } | null {
        if (this.context.pine?.timeframe?.isdwm) return null;
        const si = this.context.pine?.syminfo;
        return parseHours(si?.session_regular) ?? parseHours(si?.session);
    }

    private _minuteOfDay(timestamp: number): number {
        const parts = getDatePartsInTimezone(timestamp, this._timezone);
        return parts.hour * 60 + parts.minute;
    }

    /** Where bar `i` opens relative to the regular hours (`market` when none are known). */
    private _where(i: number): 'pre' | 'market' | 'post' | null {
        const md = this.context.marketData;
        if (!Array.isArray(md) || !md[i]) return null;
        const hours = this._regular;
        // Daily and longer bars ARE the session, whatever time they are stamped with.
        if (!hours || this.context.pine?.timeframe?.isdwm) return 'market';
        const m = this._minuteOfDay(md[i].openTime);
        return m < hours.start ? 'pre' : m >= hours.end ? 'post' : 'market';
    }

    /** Calendar-day key ("Y-M-D" in exchange timezone) of a bar's open time. */
    private _dayKey(timestamp: number): string {
        const parts = getDatePartsInTimezone(timestamp, this._timezone);
        return `${parts.year}-${parts.month}-${parts.day}`;
    }

    public get isfirstbar(): boolean {
        const idx = this.context.idx;
        const md = this.context.marketData;
        if (!Array.isArray(md) || !md[idx]) return false;
        if (idx === 0) return true;
        return this._dayKey(md[idx].openTime) !== this._dayKey(md[idx - 1].openTime);
    }

    public get islastbar(): boolean {
        const idx = this.context.idx;
        const md = this.context.marketData;
        if (!Array.isArray(md) || !md[idx]) return false;
        if (idx === md.length - 1) return true;
        return this._dayKey(md[idx].openTime) !== this._dayKey(md[idx + 1].openTime);
    }

    public get isfirstbar_regular(): boolean {
        if (!this._regular) return this.isfirstbar;
        const idx = this.context.idx;
        const md = this.context.marketData;
        if (this._where(idx) !== 'market') return false;
        return idx === 0 || this._where(idx - 1) !== 'market' || this._dayKey(md[idx].openTime) !== this._dayKey(md[idx - 1].openTime);
    }

    public get islastbar_regular(): boolean {
        const hours = this._regular;
        if (!hours) return this.islastbar;
        const idx = this.context.idx;
        const md = this.context.marketData;
        if (this._where(idx) !== 'market') return false;
        if (idx === md.length - 1) {
            // No next bar yet: the last regular bar is the one whose close reaches the session end.
            const close = md[idx].closeTime;
            return Number.isFinite(close) && this._dayKey(close - 1) === this._dayKey(md[idx].openTime) && this._minuteOfDay(close - 1) + 1 >= hours.end;
        }
        return this._where(idx + 1) !== 'market' || this._dayKey(md[idx].openTime) !== this._dayKey(md[idx + 1].openTime);
    }

    public get ismarket(): boolean {
        return this._where(this.context.idx) === 'market';
    }

    public get ispremarket(): boolean {
        return this._where(this.context.idx) === 'pre';
    }

    public get ispostmarket(): boolean {
        return this._where(this.context.idx) === 'post';
    }
}

/** "0930-1600" (optionally with a ":23456" day list) → minutes of the day; anything else → null. */
function parseHours(spec: unknown): { start: number; end: number } | null {
    if (typeof spec !== 'string') return null;
    const m = /^(\d{2})(\d{2})-(\d{2})(\d{2})(?::\d+)?$/.exec(spec.trim());
    if (!m) return null;
    const start = Number(m[1]) * 60 + Number(m[2]);
    const end = Number(m[3]) * 60 + Number(m[4]);
    return start < end ? { start, end } : null;
}
