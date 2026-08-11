import { LinkQuality, SessionStatistics } from "./models";

// Provisional heuristic thresholds — to be calibrated with real field measurements.
// PDR is the primary signal; RSSI avg and SNR avg are secondary.
export const LINK_THRESHOLDS = {
  noLinkTimeoutMs: 10_000,
  excellent:  { pdr: 98, rssiAvg: -70, snrAvg: 7 },
  good:       { pdr: 95, rssiAvg: -80, snrAvg: 4 },
  acceptable: { pdr: 85, rssiAvg: -90, snrAvg: 0 },
} as const;

export function evaluateLinkQuality(
  stats: SessionStatistics,
  nowMs: number,
): LinkQuality {
  if (stats.rxCount === 0 || stats.lastPacketTs === null) return "NO_LINK";
  if (nowMs - stats.lastPacketTs > LINK_THRESHOLDS.noLinkTimeoutMs) return "NO_LINK";

  const m = stats.metrics;
  if (!m) return "NO_LINK";

  const t = LINK_THRESHOLDS;

  if (stats.pdr >= t.excellent.pdr && m.rssiAvg >= t.excellent.rssiAvg && m.snrAvg >= t.excellent.snrAvg)
    return "EXCELLENT";
  if (stats.pdr >= t.good.pdr && m.rssiAvg >= t.good.rssiAvg && m.snrAvg >= t.good.snrAvg)
    return "GOOD";
  if (stats.pdr >= t.acceptable.pdr && m.rssiAvg >= t.acceptable.rssiAvg && m.snrAvg >= t.acceptable.snrAvg)
    return "ACCEPTABLE";
  if (stats.rxCount > 0) return "POOR";
  return "NO_LINK";
}
