import { useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { AppButton } from "@/components/app-button";
import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";
import Separator from "@/components/separator";
import { WizardProgress } from "@/components/wizard-progress";

import { useNodeSession } from "@/hooks/node-session-context";
import { useCommissioning } from "@/hooks/commissioning-context";
import { useTheme } from "@/hooks/use-theme";
import type { RadioConfig } from "@/lib/models";

const AMBER = "#d3b64f";

const TIPS: Record<string, string> = {
  sf:  "Spreading Factor: mayor SF = mayor alcance y sensibilidad, pero menor velocidad y más tiempo en el aire. SF7 es el más rápido; SF12 el de mayor alcance.",
  bw:  "Ancho de banda del canal. Mayor BW = más velocidad, pero menor sensibilidad. 125 kHz es el estándar LoRa para balance entre alcance y tasa de datos.",
  cr:  "Coding Rate: nivel de corrección de errores (FEC). 4/5 es el más eficiente; 4/8 añade más redundancia para entornos con mucho ruido RF.",
  tx:  "Potencia de transmisión. Mayor potencia = mayor alcance, pero mayor consumo. Límite regulatorio habitual en AU915: ~14–17 dBm desde la radio.",
};

function FieldLabel({ label, tipKey, open, onToggle }: {
  label: string; tipKey: string; open: boolean; onToggle: () => void;
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
        <ThemedText style={{ color: theme.gray, fontSize: 11, lineHeight: 17 }}>{TIPS[tipKey]}</ThemedText>
      )}
    </View>
  );
}

const SF_OPTIONS = [7, 8, 9, 10, 11, 12] as const;
const BW_OPTIONS = [125, 250, 500] as const;
const CR_OPTIONS = ["4/5", "4/6", "4/7", "4/8"] as const;
const TX_OPTIONS = [-9, 0, 10, 14, 17, 22] as const;

function OptionGroup<T extends string | number>({ options, value, onSelect, format }: {
  options: readonly T[]; value: T; onSelect: (v: T) => void; format?: (v: T) => string;
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
            style={[styles.optionBtn, { backgroundColor: active ? theme.blue : theme.buttonBackground, borderColor: active ? theme.blue : theme.border }]}
          >
            <ThemedText color={active ? "#fff" : theme.text} style={{ fontSize: 12 }}>
              {format ? format(opt) : String(opt)}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function NodeConfigScreen() {
  const theme = useTheme();
  const { nodeRadioConfig, configAckStatus, applyNodeConfig, deviceInfo } = useNodeSession();
  const { state: commState, setNodeConfig, goTo } = useCommissioning();

  const base = nodeRadioConfig ?? commState.gatewayConfig ?? {
    freqHz: 916_800_000, sf: 7, bwKhz: 125, cr: "4/5", txPowerDbm: 14,
  } as RadioConfig;

  const [sf, setSf] = useState<RadioConfig["sf"]>(base.sf);
  const [bw, setBw] = useState<RadioConfig["bwKhz"]>(base.bwKhz);
  const [cr, setCr] = useState<RadioConfig["cr"]>(base.cr);
  const [tx, setTx] = useState<RadioConfig["txPowerDbm"]>(base.txPowerDbm);
  const [openTip, setOpenTip] = useState<string | null>(null);

  const toggleTip = (key: string) => setOpenTip((prev) => (prev === key ? null : key));

  const gwConfig = commState.gatewayConfig;

  const syncWithGateway = () => {
    if (!gwConfig) return;
    setSf(gwConfig.sf);
    setBw(gwConfig.bwKhz);
    setCr(gwConfig.cr);
    setTx(gwConfig.txPowerDbm);
  };

  const isInSync = gwConfig
    ? sf === gwConfig.sf && bw === gwConfig.bwKhz && cr === gwConfig.cr && base.freqHz === gwConfig.freqHz
    : null;

  const diffs: string[] = gwConfig ? [
    base.freqHz !== gwConfig.freqHz ? `Freq: nodo ${(base.freqHz / 1_000_000).toFixed(3)} MHz → gateway ${(gwConfig.freqHz / 1_000_000).toFixed(3)} MHz` : "",
    sf !== gwConfig.sf   ? `SF: nodo SF${sf} → gateway SF${gwConfig.sf}` : "",
    bw !== gwConfig.bwKhz ? `BW: nodo ${bw} kHz → gateway ${gwConfig.bwKhz} kHz` : "",
    cr !== gwConfig.cr   ? `CR: nodo ${cr} → gateway ${gwConfig.cr}` : "",
  ].filter(Boolean) : [];

  const handleApply = () => {
    const freqHz = gwConfig?.freqHz ?? base.freqHz;
    const config: RadioConfig = { freqHz, sf, bwKhz: bw, cr, txPowerDbm: tx };
    applyNodeConfig(config, (ok) => {
      if (ok) {
        setNodeConfig(config);
        goTo("verify_link");
        router.push("/wizard/node-setup/verify");
      }
    });
  };

  const ackColor = configAckStatus === "ok" ? theme.green : configAckStatus === "error" ? theme.red : configAckStatus === "pending" ? theme.blue : theme.gray;
  const ackLabel = configAckStatus === "ok" ? "✓ Aplicado" : configAckStatus === "error" ? "✗ Error" : configAckStatus === "pending" ? "Aplicando…" : "";

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.background }]}>
      <WizardProgress />
      <View style={[styles.titleBar, { borderBottomColor: theme.border, backgroundColor: theme.eventsCard }]}>
        <ThemedText type="title">CONFIG. NODO</ThemedText>
        {deviceInfo && (
          <ThemedText style={{ color: theme.gray, fontSize: 11 }}>{deviceInfo.name}</ThemedText>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Gateway config reference */}
        {gwConfig && (
          <ThemedCard gap={8}>
            <ThemedText type="cardTitle">CONFIG. DEL GATEWAY</ThemedText>
            <Separator />
            <View style={styles.activeRow}>
              <ThemedText style={{ color: theme.gray, fontSize: 12 }}>Frecuencia</ThemedText>
              <ThemedText style={{ fontSize: 13 }}>{(gwConfig.freqHz / 1_000_000).toFixed(3)} MHz</ThemedText>
            </View>
            <View style={styles.activeRow}>
              <ThemedText style={{ color: theme.gray, fontSize: 12 }}>SF / BW / CR</ThemedText>
              <ThemedText style={{ fontSize: 13 }}>SF{gwConfig.sf} / {gwConfig.bwKhz} kHz / {gwConfig.cr}</ThemedText>
            </View>
          </ThemedCard>
        )}

        {/* Sync status */}
        {isInSync === true && (
          <ThemedCard gap={6} style={{ borderLeftWidth: 3, borderLeftColor: theme.green }}>
            <ThemedText style={{ fontSize: 12, color: theme.green, fontWeight: "600" }}>
              ✓ Parámetros sincronizados con el gateway
            </ThemedText>
          </ThemedCard>
        )}
        {isInSync === false && (
          <ThemedCard gap={10} style={{ borderLeftWidth: 3, borderLeftColor: AMBER }}>
            <ThemedText style={{ fontSize: 12, color: AMBER, fontWeight: "600" }}>
              ⚠ El nodo no se comunicará con el gateway
            </ThemedText>
            {diffs.map((d) => (
              <ThemedText key={d} style={{ fontSize: 11, color: theme.gray, lineHeight: 16 }}>{d}</ThemedText>
            ))}
            <AppButton
              onPress={syncWithGateway}
              backgroundColor={theme.blue}
              style={{ paddingVertical: 10, marginTop: 2 }}
            >
              <ThemedText color="#fff" style={{ fontWeight: "600", fontSize: 13 }}>
                Adoptar config del gateway
              </ThemedText>
            </AppButton>
          </ThemedCard>
        )}

        <ThemedCard gap={14}>
          <View style={styles.field}>
            <FieldLabel label="Spreading Factor" tipKey="sf" open={openTip === "sf"} onToggle={() => toggleTip("sf")} />
            <OptionGroup options={SF_OPTIONS} value={sf} onSelect={setSf} />
          </View>
          <Separator />
          <View style={styles.field}>
            <FieldLabel label="Bandwidth" tipKey="bw" open={openTip === "bw"} onToggle={() => toggleTip("bw")} />
            <OptionGroup options={BW_OPTIONS} value={bw} onSelect={setBw} format={(v) => `${v} kHz`} />
          </View>
          <Separator />
          <View style={styles.field}>
            <FieldLabel label="Coding Rate" tipKey="cr" open={openTip === "cr"} onToggle={() => toggleTip("cr")} />
            <OptionGroup options={CR_OPTIONS} value={cr} onSelect={setCr} />
          </View>
          <Separator />
          <View style={styles.field}>
            <FieldLabel label="TX Power" tipKey="tx" open={openTip === "tx"} onToggle={() => toggleTip("tx")} />
            <OptionGroup options={TX_OPTIONS} value={tx} onSelect={setTx} format={(v) => `${v} dBm`} />
          </View>
        </ThemedCard>

        <View style={styles.applyRow}>
          <AppButton
            onPress={configAckStatus === "pending" ? undefined : handleApply}
            backgroundColor={theme.blue}
            style={styles.applyBtn}
          >
            <ThemedText color="#fff" style={{ fontWeight: "bold", letterSpacing: 1 }}>
              APLICAR Y CONTINUAR
            </ThemedText>
          </AppButton>
          {ackLabel !== "" && <ThemedText color={ackColor} style={{ fontSize: 13 }}>{ackLabel}</ThemedText>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBar: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 2 },
  scroll: { padding: 14, gap: 14 },
  field: { gap: 8 },
  optionGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  activeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  applyRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  applyBtn: { flex: 1, paddingVertical: 14 },
});
