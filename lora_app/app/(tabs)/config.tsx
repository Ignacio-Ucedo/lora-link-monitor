import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton } from "@/components/app-button";
import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";
import Separator from "@/components/separator";

import { useSession } from "@/hooks/session-context";
import { useTheme } from "@/hooks/use-theme";
import type { RadioConfig } from "@/lib/models";

// ─── Tooltip labels ───────────────────────────────────────────────────────────

const TIPS: Record<string, string> = {
  freq:
    "Frecuencia de operación del canal RF. Para AU915 usar entre 915 y 928 MHz. TX y RX deben coincidir exactamente.",
  sf:
    "Spreading Factor: mayor SF = mayor alcance y sensibilidad, pero menor velocidad y más tiempo en el aire. SF7 es el más rápido; SF12 el de mayor alcance.",
  bw:
    "Ancho de banda del canal. Mayor BW = más velocidad, pero menor sensibilidad. 125 kHz es el estándar LoRa para balance entre alcance y tasa de datos.",
  cr:
    "Coding Rate: nivel de corrección de errores (FEC). 4/5 es el más eficiente; 4/8 añade más redundancia para entornos con mucho ruido RF.",
  tx:
    "Potencia de transmisión. Mayor potencia = mayor alcance, pero mayor consumo. Límite regulatorio habitual en AU915: ~14–17 dBm desde la radio.",
};

// ─── Components ───────────────────────────────────────────────────────────────

function FieldLabel({
  label,
  tipKey,
  open,
  onToggle,
}: {
  label: string;
  tipKey: string;
  open: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ThemedText type="cardTitle">{label}</ThemedText>
        <TouchableOpacity onPress={onToggle} hitSlop={8}>
          <ThemedText style={{ color: open ? theme.blue : theme.gray, fontSize: 15 }}>ⓘ</ThemedText>
        </TouchableOpacity>
      </View>
      {open && (
        <ThemedText style={{ color: theme.gray, fontSize: 11, lineHeight: 17 }}>
          {TIPS[tipKey]}
        </ThemedText>
      )}
    </View>
  );
}

function OptionGroup<T extends string | number>({
  options,
  value,
  onSelect,
  format,
}: {
  options: readonly T[];
  value: T;
  onSelect: (v: T) => void;
  format?: (v: T) => string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.optionGroup}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <TouchableOpacity
            key={String(opt)}
            onPress={() => onSelect(opt)}
            style={[
              styles.optionBtn,
              {
                backgroundColor: active ? theme.blue : theme.buttonBackground,
                borderColor: active ? theme.blue : theme.border,
              },
            ]}
          >
            <ThemedText
              color={active ? "#fff" : theme.text}
              style={{ fontSize: 12 }}
            >
              {format ? format(opt) : String(opt)}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function NumInput({
  value,
  onChange,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.numInput, { borderColor: theme.border, backgroundColor: theme.buttonBackground }]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        style={[styles.numInputText, { color: theme.text }]}
        placeholderTextColor={theme.gray}
      />
      {suffix && (
        <ThemedText style={{ color: theme.gray, fontSize: 12, marginRight: 8 }}>
          {suffix}
        </ThemedText>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const SF_OPTIONS = [7, 8, 9, 10, 11, 12] as const;
const BW_OPTIONS = [125, 250, 500] as const;
const CR_OPTIONS = ["4/5", "4/6", "4/7", "4/8"] as const;
const TX_OPTIONS = [-9, 0, 10, 14, 17, 22] as const;

export default function ConfigScreen() {
  const theme = useTheme();
  const { radioConfig, applyConfig, configAckStatus } = useSession();

  const [freq, setFreq] = useState(
    (radioConfig.freqHz / 1_000_000).toFixed(3),
  );
  const [sf, setSf] = useState<RadioConfig["sf"]>(radioConfig.sf);
  const [bw, setBw] = useState<RadioConfig["bwKhz"]>(radioConfig.bwKhz);
  const [cr, setCr] = useState<RadioConfig["cr"]>(radioConfig.cr);
  const [tx, setTx] = useState<RadioConfig["txPowerDbm"]>(radioConfig.txPowerDbm);
  const [openTip, setOpenTip] = useState<string | null>(null);

  const toggleTip = (key: string) =>
    setOpenTip((prev) => (prev === key ? null : key));

  const handleApply = () => {
    const freqHz = Math.round(parseFloat(freq) * 1_000_000);
    if (isNaN(freqHz) || freqHz < 400_000_000 || freqHz > 960_000_000) return;
    applyConfig({ freqHz, sf, bwKhz: bw, cr, txPowerDbm: tx });
  };

  const ackColor =
    configAckStatus === "ok"
      ? theme.green
      : configAckStatus === "error"
        ? theme.red
        : configAckStatus === "pending"
          ? theme.blue
          : theme.gray;

  const ackLabel =
    configAckStatus === "ok"
      ? "✓ Aplicado"
      : configAckStatus === "error"
        ? "✗ Error"
        : configAckStatus === "pending"
          ? "Aplicando…"
          : "";

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.titleBar, { borderBottomColor: theme.border, backgroundColor: theme.eventsCard }]}>
        <ThemedText type="title">CONFIG. RADIO</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedCard gap={14}>
          {/* Frecuencia */}
          <View style={styles.field}>
            <FieldLabel label="Frecuencia" tipKey="freq" open={openTip === "freq"} onToggle={() => toggleTip("freq")} />
            <NumInput value={freq} onChange={setFreq} suffix="MHz" />
          </View>

          <Separator />

          {/* SF */}
          <View style={styles.field}>
            <FieldLabel label="Spreading Factor" tipKey="sf" open={openTip === "sf"} onToggle={() => toggleTip("sf")} />
            <OptionGroup options={SF_OPTIONS} value={sf} onSelect={setSf} />
          </View>

          <Separator />

          {/* BW */}
          <View style={styles.field}>
            <FieldLabel label="Bandwidth" tipKey="bw" open={openTip === "bw"} onToggle={() => toggleTip("bw")} />
            <OptionGroup
              options={BW_OPTIONS}
              value={bw}
              onSelect={setBw}
              format={(v) => `${v} kHz`}
            />
          </View>

          <Separator />

          {/* CR */}
          <View style={styles.field}>
            <FieldLabel label="Coding Rate" tipKey="cr" open={openTip === "cr"} onToggle={() => toggleTip("cr")} />
            <OptionGroup options={CR_OPTIONS} value={cr} onSelect={setCr} />
          </View>

          <Separator />

          {/* TX Power */}
          <View style={styles.field}>
            <FieldLabel label="TX Power" tipKey="tx" open={openTip === "tx"} onToggle={() => toggleTip("tx")} />
            <OptionGroup
              options={TX_OPTIONS}
              value={tx}
              onSelect={setTx}
              format={(v) => `${v} dBm`}
            />
          </View>
        </ThemedCard>

        {/* Configuración activa */}
        <ThemedCard gap={8}>
          <ThemedText type="cardTitle">CONFIGURACIÓN ACTIVA</ThemedText>
          <Separator />
          <View style={styles.activeRow}>
            <ThemedText style={{ color: theme.gray, fontSize: 12 }}>Frecuencia</ThemedText>
            <ThemedText style={{ fontSize: 13 }}>
              {(radioConfig.freqHz / 1_000_000).toFixed(3)} MHz
            </ThemedText>
          </View>
          <View style={styles.activeRow}>
            <ThemedText style={{ color: theme.gray, fontSize: 12 }}>SF / BW / CR</ThemedText>
            <ThemedText style={{ fontSize: 13 }}>
              SF{radioConfig.sf} / {radioConfig.bwKhz} kHz / {radioConfig.cr}
            </ThemedText>
          </View>
          <View style={styles.activeRow}>
            <ThemedText style={{ color: theme.gray, fontSize: 12 }}>TX Power</ThemedText>
            <ThemedText style={{ fontSize: 13 }}>{radioConfig.txPowerDbm} dBm</ThemedText>
          </View>
        </ThemedCard>

        {/* Aplicar */}
        <View style={styles.applyRow}>
          <AppButton
            onPress={configAckStatus === "pending" ? undefined : handleApply}
            backgroundColor={theme.blue}
            style={styles.applyBtn}
          >
            <ThemedText color="#fff" style={{ fontWeight: "bold", letterSpacing: 1 }}>
              APLICAR
            </ThemedText>
          </AppButton>
          {ackLabel !== "" && (
            <ThemedText color={ackColor} style={{ fontSize: 13 }}>
              {ackLabel}
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  scroll: { padding: 14, gap: 14 },
  field: { gap: 8 },
  optionGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  numInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 6,
    paddingLeft: 10,
  },
  numInputText: { flex: 1, fontSize: 14, paddingVertical: 8 },
  activeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  applyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  applyBtn: {
    flex: 1,
    paddingVertical: 14,
  },
});
