// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Generic Pine Script timeframe parsing.
 *
 * Pine timeframes are "<multiplier><unit>", not a fixed list. Accepted spellings:
 *
 * | Input                         | Meaning        | Canonical |
 * | ----------------------------- | -------------- | --------- |
 * | `"10"`, `10`, `"10m"`         | 10 minutes     | `"10"`    |
 * | `"1h"`, `"2H"`, `"120"`       | hours          | `"60"`, `"120"` |
 * | `"30S"`, `"30s"`              | seconds        | `"30S"`   |
 * | `"D"`, `"1D"`, `"1d"`, `"3D"` | days           | `"D"`, `"3D"` |
 * | `"W"`, `"2W"`                 | weeks          | `"W"`, `"2W"` |
 * | `"M"`, `"1M"`, `"3M"`, `"12M"`| months         | `"M"`, `"3M"`, `"12M"` |
 *
 * Case matters only for the ambiguous letter: with a multiplier, lowercase `m` is minutes and uppercase `M`
 * is months (`"10m"` vs `"10M"`); a bare `"m"`/`"M"` means one month.
 */

export type TimeframeUnit = 'second' | 'minute' | 'day' | 'week' | 'month';

export interface ParsedTimeframe {
    /** Canonical Pine spelling (minutes as plain integers, `D`/`W`/`M` for multiplier 1). */
    canonical: string;
    unit: TimeframeUnit;
    /** Multiplier in `unit` (hours are folded into minutes: `"2h"` → 120 minutes). */
    multiplier: number;
    /** Nominal duration in seconds. Week = 7d, month = 30d — for ordering/ratio math, not calendar grouping. */
    seconds: number;
}

const SECONDS_PER: Record<TimeframeUnit, number> = {
    second: 1,
    minute: 60,
    day: 86_400,
    week: 7 * 86_400,
    month: 30 * 86_400,
};

const cache = new Map<string, ParsedTimeframe | null>();

/**
 * Parse any Pine-style timeframe. Returns `null` for anything that is not a positive
 * "<n><unit>" timeframe (empty, `"0"`, `"abc"`, `"1x"`, ...).
 */
export function parseTimeframe(tf: string | number | null | undefined): ParsedTimeframe | null {
    if (tf === null || tf === undefined) return null;
    const raw = String(tf).trim();
    if (raw === '') return null;

    const hit = cache.get(raw);
    if (hit !== undefined) return hit;

    const parsed = parseUncached(raw);
    cache.set(raw, parsed);
    return parsed;
}

function parseUncached(raw: string): ParsedTimeframe | null {
    const m = /^(\d*)([A-Za-z]?)$/.exec(raw);
    if (!m) return null;
    const [, digits, letter] = m;
    if (digits === '' && letter === '') return null;

    const n = digits === '' ? 1 : parseInt(digits, 10);
    if (!Number.isSafeInteger(n) || n <= 0) return null;

    let unit: TimeframeUnit;
    let multiplier = n;
    switch (letter) {
        case '': // bare integer = minutes (Pine convention)
            unit = 'minute';
            break;
        case 'm':
            // "10m" = 10 minutes, but a bare "m" keeps its historical meaning of one month (like "d", "w")
            unit = digits === '' ? 'month' : 'minute';
            break;
        case 'h':
        case 'H':
            unit = 'minute';
            multiplier = n * 60;
            break;
        case 's':
        case 'S':
            unit = 'second';
            break;
        case 'd':
        case 'D':
            unit = 'day';
            break;
        case 'w':
        case 'W':
            unit = 'week';
            break;
        case 'M': // uppercase M = months, lowercase m = minutes
            unit = 'month';
            break;
        default:
            return null;
    }

    return { canonical: canonicalize(unit, multiplier), unit, multiplier, seconds: multiplier * SECONDS_PER[unit] };
}

function canonicalize(unit: TimeframeUnit, multiplier: number): string {
    switch (unit) {
        case 'minute':
            return String(multiplier);
        case 'second':
            return `${multiplier}S`;
        case 'day':
            return multiplier === 1 ? 'D' : `${multiplier}D`;
        case 'week':
            return multiplier === 1 ? 'W' : `${multiplier}W`;
        case 'month':
            return multiplier === 1 ? 'M' : `${multiplier}M`;
    }
}

/** Canonical spelling, or `null` when the input is not a valid timeframe. */
export function canonicalTimeframe(tf: string | number | null | undefined): string | null {
    return parseTimeframe(tf)?.canonical ?? null;
}

/** Nominal duration in seconds, or `null` when invalid. */
export function timeframeSeconds(tf: string | number | null | undefined): number | null {
    return parseTimeframe(tf)?.seconds ?? null;
}

export function isValidTimeframe(tf: string | number | null | undefined): boolean {
    return parseTimeframe(tf) !== null;
}

/** Negative / zero / positive like `Array.prototype.sort`; throws on an invalid timeframe. */
export function compareTimeframes(a: string, b: string): number {
    const sa = timeframeSeconds(a);
    const sb = timeframeSeconds(b);
    if (sa === null || sb === null) throw new Error('Invalid timeframe');
    return sa - sb;
}
