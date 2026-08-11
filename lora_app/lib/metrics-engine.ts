import { EMPTY_STATS, Packet, RadioMetrics, SessionStatistics } from "./models";

export class MetricsEngine {
  private packets: Packet[] = [];
  private receivedSeqs = new Set<number>();
  private firstSeq: number | null = null;
  private lastSeq: number | null = null;
  private intervals: number[] = [];
  private lastTs: number | null = null;

  reset() {
    this.packets = [];
    this.receivedSeqs = new Set();
    this.firstSeq = null;
    this.lastSeq = null;
    this.intervals = [];
    this.lastTs = null;
  }

  addPacket(p: Packet) {
    this.packets.push(p);
    this.receivedSeqs.add(p.seq);

    if (this.firstSeq === null || p.seq < this.firstSeq) this.firstSeq = p.seq;
    if (this.lastSeq === null || p.seq > this.lastSeq) this.lastSeq = p.seq;

    if (this.lastTs !== null) this.intervals.push(p.timestamp - this.lastTs);
    this.lastTs = p.timestamp;
  }

  getStatistics(): SessionStatistics {
    const rxCount = this.receivedSeqs.size;
    if (rxCount === 0) return { ...EMPTY_STATS };

    const txCount = this.lastSeq! - this.firstSeq! + 1;
    const lostCount = Math.max(0, txCount - rxCount);
    const pdr = (rxCount / txCount) * 100;
    const avgIntervalMs =
      this.intervals.length > 0
        ? this.intervals.reduce((a, b) => a + b, 0) / this.intervals.length
        : null;

    return {
      txCount,
      rxCount,
      lostCount,
      pdr,
      lastPacketTs: this.lastTs,
      avgIntervalMs,
      metrics: this.computeRadioMetrics(),
    };
  }

  private computeRadioMetrics(): RadioMetrics {
    const rssis = this.packets.map((p) => p.rssi);
    const snrs = this.packets.map((p) => p.snr);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      rssiCurrent: rssis[rssis.length - 1],
      rssiMin: Math.min(...rssis),
      rssiMax: Math.max(...rssis),
      rssiAvg: avg(rssis),
      snrCurrent: snrs[snrs.length - 1],
      snrMin: Math.min(...snrs),
      snrMax: Math.max(...snrs),
      snrAvg: avg(snrs),
    };
  }
}
