// SPDX-License-Identifier: AGPL-3.0-only

/** How far from an HTF bar a gap bar may open and still belong to it. */
const GAP_REACH_MS = 24 * 3_600_000;

export function findSecContextIdx(
    myOpenTime: number,
    myCloseTime: number,
    openTime: number[],
    closeTime: number[],
    lookahead: boolean = false,
    isRealtime: boolean = false
): number {
    // `j` is the HTF bar the chart bar belongs to; what it reads from it is decided below.
    let j = -1;
    for (let i = 0; i < openTime.length; i++) {
        // Match based on where the LTF bar opens, not requiring full containment.
        // This handles bars that straddle HTF boundaries (e.g. a weekly bar that
        // opens in July but closes in August).
        if (openTime[i] <= myOpenTime && myOpenTime < closeTime[i]) {
            j = i;
            break;
        }
    }
    if (j === -1) j = gapBarIdx(myOpenTime, openTime, closeTime);
    if (j === -1) return -1;

    if (lookahead) {
        return j;
    }
    // For lookahead=false (default):
    // If the HTF bar is closed (myCloseTime >= closeTime[j]), we can use its value (j).
    // If the HTF bar is still open, we must use the previous bar (j-1) to avoid future leak.
    // Exception: on the realtime (last) bar, TradingView returns the current developing
    // HTF values (j) — lookahead_off only prevents future leak on historical bars.
    if (isRealtime) {
        return j;
    }
    return myCloseTime >= closeTime[j] ? j : j - 1;
}

/**
 * The HTF bar a chart bar belongs to when it opens in the GAP between two HTF bars — what a
 * chart that carries extended hours does to session-bound HTF bars (a daily bar 09:30–16:00:
 * the pre- and post-market bars open outside every daily bar). It belongs to whichever
 * neighbour it is nearer to: a post-market bar to the day that just ended, a pre-market bar
 * to the day about to start. HTF bars that tile (no gaps) never reach this. A bar more than
 * a day away from both neighbours belongs to neither (-1).
 */
function gapBarIdx(myOpenTime: number, openTime: number[], closeTime: number[]): number {
    const n = openTime.length;
    if (n === 0) return -1;
    if (myOpenTime < openTime[0]) return openTime[0] - myOpenTime <= GAP_REACH_MS ? 0 : -1;
    for (let i = 0; i < n; i++) {
        if (closeTime[i] > myOpenTime) continue;
        const next = i + 1 < n ? openTime[i + 1] : Infinity;
        if (myOpenTime >= next) continue;
        const sinceClose = myOpenTime - closeTime[i];
        const untilNext = next - myOpenTime;
        if (untilNext < sinceClose && untilNext <= GAP_REACH_MS) return i + 1;
        return sinceClose <= GAP_REACH_MS ? i : -1;
    }
    return -1;
}
