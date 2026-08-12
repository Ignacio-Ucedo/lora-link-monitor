import { evaluateLinkQuality, LINK_THRESHOLDS } from "../link-quality";
import { SessionStatistics } from "../models";

const NOW = 10_000;

function stats(overrides: Partial<SessionStatistics> = {}): SessionStatistics {
  return {
    txCount: 100,
    rxCount: 100,
    lostCount: 0,
    pdr: 100,
    lastPacketTs: NOW - 1000,
    avgIntervalMs: 2000,
    metrics: {
      rssiCurrent: -65,
      rssiMin: -75,
      rssiMax: -60,
      rssiAvg: -65,
      snrCurrent: 8,
      snrMin: 6,
      snrMax: 10,
      snrAvg: 8,
    },
    ...overrides,
  };
}

describe("evaluateLinkQuality", () => {
  describe("NO_LINK", () => {
    it("sin paquetes recibidos", () => {
      expect(evaluateLinkQuality(stats({ rxCount: 0 }), NOW)).toBe("NO_LINK");
    });

    it("lastPacketTs nulo", () => {
      expect(evaluateLinkQuality(stats({ lastPacketTs: null }), NOW)).toBe("NO_LINK");
    });

    it("último paquete hace más de 10s", () => {
      const stale = NOW - LINK_THRESHOLDS.noLinkTimeoutMs - 1;
      expect(evaluateLinkQuality(stats({ lastPacketTs: stale }), NOW)).toBe("NO_LINK");
    });

    it("métricas nulas", () => {
      expect(evaluateLinkQuality(stats({ metrics: null }), NOW)).toBe("NO_LINK");
    });
  });

  describe("EXCELLENT", () => {
    it("cumple todos los umbrales EXCELLENT", () => {
      const s = stats({
        pdr: 98,
        metrics: { rssiCurrent: -70, rssiMin: -70, rssiMax: -70, rssiAvg: -70, snrCurrent: 7, snrMin: 7, snrMax: 7, snrAvg: 7 },
      });
      expect(evaluateLinkQuality(s, NOW)).toBe("EXCELLENT");
    });

    it("PDR perfecta con señal excelente", () => {
      expect(evaluateLinkQuality(stats({ pdr: 100 }), NOW)).toBe("EXCELLENT");
    });
  });

  describe("GOOD", () => {
    it("PDR 95%, RSSI -80, SNR 4 → GOOD", () => {
      const s = stats({
        pdr: 95,
        metrics: { rssiCurrent: -80, rssiMin: -80, rssiMax: -80, rssiAvg: -80, snrCurrent: 4, snrMin: 4, snrMax: 4, snrAvg: 4 },
      });
      expect(evaluateLinkQuality(s, NOW)).toBe("GOOD");
    });

    it("PDR 97% pero RSSI por debajo de EXCELLENT → GOOD", () => {
      const s = stats({
        pdr: 97,
        metrics: { rssiCurrent: -75, rssiMin: -75, rssiMax: -75, rssiAvg: -75, snrCurrent: 5, snrMin: 5, snrMax: 5, snrAvg: 5 },
      });
      expect(evaluateLinkQuality(s, NOW)).toBe("GOOD");
    });
  });

  describe("ACCEPTABLE", () => {
    it("PDR 85%, RSSI -90, SNR 0 → ACCEPTABLE", () => {
      const s = stats({
        pdr: 85,
        metrics: { rssiCurrent: -90, rssiMin: -90, rssiMax: -90, rssiAvg: -90, snrCurrent: 0, snrMin: 0, snrMax: 0, snrAvg: 0 },
      });
      expect(evaluateLinkQuality(s, NOW)).toBe("ACCEPTABLE");
    });

    it("PDR 90% pero SNR negativo → POOR (snrAvg < umbral ACCEPTABLE)", () => {
      const s = stats({
        pdr: 90,
        metrics: { rssiCurrent: -85, rssiMin: -85, rssiMax: -85, rssiAvg: -85, snrCurrent: -1, snrMin: -1, snrMax: -1, snrAvg: -1 },
      });
      expect(evaluateLinkQuality(s, NOW)).toBe("POOR");
    });
  });

  describe("POOR", () => {
    it("PDR muy baja pero hay recepción → POOR", () => {
      const s = stats({
        rxCount: 5,
        pdr: 10,
        metrics: { rssiCurrent: -110, rssiMin: -110, rssiMax: -110, rssiAvg: -110, snrCurrent: -10, snrMin: -10, snrMax: -10, snrAvg: -10 },
      });
      expect(evaluateLinkQuality(s, NOW)).toBe("POOR");
    });

    it("PDR 84% (justo bajo ACCEPTABLE) → POOR", () => {
      const s = stats({
        pdr: 84,
        metrics: { rssiCurrent: -90, rssiMin: -90, rssiMax: -90, rssiAvg: -90, snrCurrent: 0, snrMin: 0, snrMax: 0, snrAvg: 0 },
      });
      expect(evaluateLinkQuality(s, NOW)).toBe("POOR");
    });
  });

  describe("timeout de NO_LINK", () => {
    it("justo dentro del timeout → no NO_LINK", () => {
      const recent = NOW - LINK_THRESHOLDS.noLinkTimeoutMs + 1;
      const s = stats({ lastPacketTs: recent, pdr: 50 });
      expect(evaluateLinkQuality(s, NOW)).not.toBe("NO_LINK");
    });

    it("exactamente en el límite del timeout → aún activo (check es estrictamente mayor)", () => {
      const exact = NOW - LINK_THRESHOLDS.noLinkTimeoutMs;
      // nowMs - lastPacketTs == noLinkTimeoutMs, pero el check es >, no >=
      expect(evaluateLinkQuality(stats({ lastPacketTs: exact }), NOW)).not.toBe("NO_LINK");
    });
  });
});
