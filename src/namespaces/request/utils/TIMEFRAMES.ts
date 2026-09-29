// SPDX-License-Identifier: AGPL-3.0-only

import { canonicalTimeframe } from '../../../marketData/timeframe';

/**
 * @deprecated Informational list of common timeframes only. Timeframes are no longer
 * restricted to this list; use `parseTimeframe()` / `timeframeSeconds()` from
 * `marketData/timeframe` for validation and ordering.
 */
export const TIMEFRAMES = ['1', '3', '5', '15', '30', '45', '60', '120', '180', '240', 'D', 'W', 'M'];

/**
 * Normalize a timeframe string to the canonical Pine Script format
 * (minutes as plain integers, `D`/`W`/`M` for a multiplier of 1, `NS` for seconds).
 * Any valid "<n><unit>" is accepted; unrecognised input is returned unchanged.
 */
export function normalizeTimeframe(tf: string): string {
    return canonicalTimeframe(tf) ?? tf;
}
