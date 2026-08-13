import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { AppButton } from "@/components/app-button";
import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";
import Separator from "@/components/separator";
import { WizardProgress } from "@/components/wizard-progress";
import { IconSymbol } from "@/components/ui/icon-symbol";

import { useCommissioning } from "@/hooks/commissioning-context";
import { useTheme } from "@/hooks/use-theme";
import { useWizardBack } from "@/hooks/use-wizard-back";

function SummaryRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.summaryRow}>
      <ThemedText style={{ color: theme.gray, fontSize: 12 }}>{label}</ThemedText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {ok !== undefined && (
          <IconSymbol
            name={ok ? "checkmark.circle.fill" : "xmark.circle.fill"}
            size={14}
            color={ok ? theme.green : theme.red}
          />
        )}
        <ThemedText style={{ fontSize: 13, fontWeight: "500" }}>{value}</ThemedText>
      </View>
    </View>
  );
}

export default function SummaryScreen() {
  const theme = useTheme();
  const { state, reset } = useCommissioning();
  useWizardBack("gps", "/wizard/gps");

  const handleNew = () => {
    reset();
    router.replace("/wizard/home");
  };

  const gwConfig = state.gatewayConfig;
  const nodeConfig = state.nodeConfig;
  const inSync = gwConfig && nodeConfig
    ? gwConfig.sf === nodeConfig.sf && gwConfig.bwKhz === nodeConfig.bwKhz && gwConfig.cr === nodeConfig.cr
    : null;

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.background }]}>
      <WizardProgress />
      <View style={[styles.titleBar, { borderBottomColor: theme.border, backgroundColor: theme.eventsCard }]}>
        <ThemedText type="title">COMISIONAMIENTO COMPLETO</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedCard gap={10} style={{ alignItems: "center" }}>
          <IconSymbol name="checkmark.circle.fill" size={52} color={theme.green} />
          <ThemedText style={{ fontSize: 16, fontWeight: "bold", color: theme.green }}>
            Nodo instalado
          </ThemedText>
          {state.nodeName && (
            <ThemedText style={{ color: theme.gray, fontSize: 13 }}>{state.nodeName}</ThemedText>
          )}
        </ThemedCard>

        <ThemedCard gap={8}>
          <ThemedText type="cardTitle">GATEWAY</ThemedText>
          <Separator />
          <SummaryRow
            label="Nombre"
            value={state.gatewayName ?? "Sin nombre"}
            ok={state.gatewayName !== null}
          />
          <SummaryRow
            label="Config. radio"
            value={gwConfig ? `SF${gwConfig.sf} / ${gwConfig.bwKhz} kHz` : "No configurado"}
            ok={gwConfig !== null}
          />
          <SummaryRow
            label="Red WiFi"
            value={state.gatewayWifi ? state.gatewayWifi.ssid : "No configurada"}
            ok={state.gatewayWifi !== null}
          />
          <SummaryRow
            label="Posición GPS"
            value={state.gatewayGps
              ? `${state.gatewayGps.lat.toFixed(5)}, ${state.gatewayGps.lon.toFixed(5)}`
              : "No registrada"}
            ok={state.gatewayGps !== null}
          />
        </ThemedCard>

        <ThemedCard gap={8}>
          <ThemedText type="cardTitle">NODO</ThemedText>
          <Separator />
          {state.nodeType && (
            <SummaryRow label="Tipo" value={state.nodeType} />
          )}
          <SummaryRow
            label="Config. radio aplicada"
            value={nodeConfig ? `SF${nodeConfig.sf} / ${nodeConfig.bwKhz} kHz` : "No aplicada"}
            ok={nodeConfig !== null}
          />
          {inSync !== null && (
            <SummaryRow
              label="Parámetros sincronizados"
              value={inSync ? "Sí" : "No"}
              ok={inSync}
            />
          )}
          <SummaryRow
            label="Enlace verificado"
            value={state.step === "complete" ? "Sí" : "No"}
            ok={state.step === "complete"}
          />
          <SummaryRow
            label="Posición GPS del nodo"
            value={state.gpsCoords
              ? `${state.gpsCoords.lat.toFixed(5)}, ${state.gpsCoords.lon.toFixed(5)}`
              : "No registrada"}
            ok={state.gpsCoords !== null}
          />
        </ThemedCard>

        <ThemedCard gap={8}>
          <ThemedText style={{ color: theme.gray, fontSize: 12, lineHeight: 18 }}>
            El nodo está operativo. Para registrarlo en la plataforma LoRaWAN (ChirpStack), provisioná DevEUI, JoinEUI y AppKey desde la consola de red.
          </ThemedText>
        </ThemedCard>

        <AppButton onPress={handleNew} backgroundColor={theme.blue} style={styles.btn}>
          <ThemedText color="#fff" style={{ fontWeight: "bold", letterSpacing: 0.5 }}>
            INSTALAR OTRO NODO
          </ThemedText>
        </AppButton>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBar: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  scroll: { padding: 14, gap: 14 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  btn: { paddingVertical: 14 },
});
