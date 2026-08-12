import { MetricsEngine } from "../metrics-engine";
import { Packet } from "../models";

function pkt(seq: number, timestamp: number, rssi = -70, snr = 7): Packet {
  return { seq, timestamp, rssi, snr, temp: 24, hum: 60, bat: 3.9 };
}

describe("MetricsEngine", () => {
  let engine: MetricsEngine;

  beforeEach(() => {
    engine = new MetricsEngine();
  });

  describe("estado vacío", () => {
    it("devuelve EMPTY_STATS sin paquetes", () => {
      const s = engine.getStatistics();
      expect(s.rxCount).toBe(0);
      expect(s.txCount).toBe(0);
      expect(s.lostCount).toBe(0);
      expect(s.pdr).toBe(0);
      expect(s.lastPacketTs).toBeNull();
      expect(s.avgIntervalMs).toBeNull();
      expect(s.metrics).toBeNull();
    });
  });

  describe("paquete único", () => {
    it("computa PDR 100% y sin pérdidas", () => {
      engine.addPacket(pkt(1, 1000));
      const s = engine.getStatistics();
      expect(s.rxCount).toBe(1);
      expect(s.txCount).toBe(1);
      expect(s.lostCount).toBe(0);
      expect(s.pdr).toBeCloseTo(100);
    });

    it("no computa avgIntervalMs con un solo paquete", () => {
      engine.addPacket(pkt(1, 1000));
      expect(engine.getStatistics().avgIntervalMs).toBeNull();
    });

    it("registra lastPacketTs", () => {
      engine.addPacket(pkt(1, 5000));
      expect(engine.getStatistics().lastPacketTs).toBe(5000);
    });
  });

  describe("secuencia sin pérdidas", () => {
    it("PDR 100% con seq consecutivos", () => {
      engine.addPacket(pkt(0, 0));
      engine.addPacket(pkt(1, 2000));
      engine.addPacket(pkt(2, 4000));
      const s = engine.getStatistics();
      expect(s.rxCount).toBe(3);
      expect(s.txCount).toBe(3);
      expect(s.lostCount).toBe(0);
      expect(s.pdr).toBeCloseTo(100);
    });

    it("avgIntervalMs correcto", () => {
      engine.addPacket(pkt(0, 0));
      engine.addPacket(pkt(1, 2000));
      engine.addPacket(pkt(2, 4000));
      expect(engine.getStatistics().avgIntervalMs).toBeCloseTo(2000);
    });

    it("avgIntervalMs con intervalos variables", () => {
      engine.addPacket(pkt(0, 0));
      engine.addPacket(pkt(1, 1000));
      engine.addPacket(pkt(2, 3000));
      // intervalos: 1000, 2000 → avg 1500
      expect(engine.getStatistics().avgIntervalMs).toBeCloseTo(1500);
    });
  });

  describe("detección de pérdidas (gap detection)", () => {
    it("detecta un paquete perdido", () => {
      engine.addPacket(pkt(0, 0));
      engine.addPacket(pkt(2, 2000)); // seq 1 faltante
      const s = engine.getStatistics();
      expect(s.txCount).toBe(3); // 0..2 → 3 enviados
      expect(s.rxCount).toBe(2);
      expect(s.lostCount).toBe(1);
      expect(s.pdr).toBeCloseTo((2 / 3) * 100);
    });

    it("detecta múltiples paquetes perdidos", () => {
      engine.addPacket(pkt(0, 0));
      engine.addPacket(pkt(5, 2000)); // 1, 2, 3, 4 perdidos
      const s = engine.getStatistics();
      expect(s.txCount).toBe(6);
      expect(s.rxCount).toBe(2);
      expect(s.lostCount).toBe(4);
      expect(s.pdr).toBeCloseTo((2 / 6) * 100);
    });

    it("detecta pérdida al final de la secuencia", () => {
      engine.addPacket(pkt(0, 0));
      engine.addPacket(pkt(1, 2000));
      engine.addPacket(pkt(3, 4000)); // seq 2 perdido
      const s = engine.getStatistics();
      expect(s.lostCount).toBe(1);
      expect(s.pdr).toBeCloseTo((3 / 4) * 100);
    });
  });

  describe("radio metrics (RSSI / SNR)", () => {
    it("calcula min, max, avg y current correctamente", () => {
      engine.addPacket(pkt(0, 0,    -60, 10));
      engine.addPacket(pkt(1, 2000, -80,  4));
      engine.addPacket(pkt(2, 4000, -70,  7));
      const m = engine.getStatistics().metrics!;
      expect(m.rssiMin).toBe(-80);
      expect(m.rssiMax).toBe(-60);
      expect(m.rssiAvg).toBeCloseTo((-60 + -80 + -70) / 3);
      expect(m.rssiCurrent).toBe(-70);
      expect(m.snrMin).toBe(4);
      expect(m.snrMax).toBe(10);
      expect(m.snrAvg).toBeCloseTo((10 + 4 + 7) / 3);
      expect(m.snrCurrent).toBe(7);
    });

    it("con un solo paquete: min == max == avg == current", () => {
      engine.addPacket(pkt(0, 0, -75, 5));
      const m = engine.getStatistics().metrics!;
      expect(m.rssiMin).toBe(-75);
      expect(m.rssiMax).toBe(-75);
      expect(m.rssiAvg).toBe(-75);
      expect(m.rssiCurrent).toBe(-75);
    });
  });

  describe("reset()", () => {
    it("limpia todo el estado acumulado", () => {
      engine.addPacket(pkt(0, 0));
      engine.addPacket(pkt(1, 2000));
      engine.reset();
      const s = engine.getStatistics();
      expect(s.rxCount).toBe(0);
      expect(s.metrics).toBeNull();
      expect(s.lastPacketTs).toBeNull();
    });

    it("acepta paquetes nuevos tras reset", () => {
      engine.addPacket(pkt(99, 0));
      engine.reset();
      engine.addPacket(pkt(5, 1000));
      const s = engine.getStatistics();
      expect(s.rxCount).toBe(1);
      expect(s.txCount).toBe(1);
    });
  });
});
