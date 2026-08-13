import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { AppButton } from "@/components/app-button";
import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";
import Separator from "@/components/separator";
import { IconSymbol } from "@/components/ui/icon-symbol";

import { useCommissioning } from "@/hooks/commissioning-context";
import { useTheme } from "@/hooks/use-theme";

const STEP_LABELS: Record<string, string> = {
  gateway_setup:     "Configurando gateway",
  gateway_identify:  "Identificando gateway",
  node_connect:      "Conectando nodo",
  node_identify:     "Identificando nodo",
  node_config:       "Configurando nodo",
  verify_link:       "Verificando enlace",
  gps:               "Registrando posición",
  complete:          "Completado",
};

const STEP_ROUTES: Record<string, string> = {
  gateway_setup:     "/wizard/gateway-setup",
  gateway_identify:  "/wizard/gateway-identify",
  node_connect:      "/wizard/node-connect",
  node_identify:     "/wizard/node-identify",
  node_config:       "/wizard/node-setup/config",
  verify_link:       "/wizard/node-setup/verify",
  gps:               "/wizard/gps",
  complete:          "/wizard/summary",
};

export default function HomeScreen() {
  const theme = useTheme();
  const { state, goTo, startNew, reset } = useCommissioning();

  const hasActive =
    state.step !== "idle" && state.step !== "complete" && state.startedAt !== null;

  const handleGatewaySetup = () => {
    goTo("gateway_setup");
    router.push("/wizard/gateway-setup");
  };

  const handleNewCommission = () => {
    startNew();
    router.push("/wizard/node-connect");
  };

  const handleResume = () => {
    const route = STEP_ROUTES[state.step];
    if (route) router.push(route as any);
  };

  const handleReset = () => {
    reset();
  };

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.eventsCard }]}>
        <ThemedText type="title">COMISIONAMIENTO LoRa</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Resume card */}
        {hasActive && (
          <ThemedCard gap={12}>
            <View style={styles.resumeHeader}>
              <View style={[styles.indicator, { backgroundColor: theme.blue }]} />
              <ThemedText style={{ fontWeight: "600", fontSize: 14 }}>
                Instalación en curso
              </ThemedText>
            </View>
            <Separator />
            <View style={styles.resumeInfo}>
              <ThemedText style={{ color: theme.gray, fontSize: 12 }}>
                {STEP_LABELS[state.step] ?? state.step}
              </ThemedText>
              {state.nodeName && (
                <ThemedText style={{ fontSize: 13 }}>{state.nodeName}</ThemedText>
              )}
            </View>
            <View style={styles.resumeActions}>
              <AppButton
                onPress={handleResume}
                backgroundColor={theme.blue}
                style={{ flex: 1, paddingVertical: 10 }}
              >
                <ThemedText color="#fff" style={{ fontWeight: "600", textAlign: "center" }}>
                  Retomar
                </ThemedText>
              </AppButton>
              <TouchableOpacity onPress={handleReset} style={styles.abandonBtn} hitSlop={8}>
                <ThemedText style={{ color: theme.gray, fontSize: 13 }}>Abandonar</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedCard>
        )}

        {/* Gateway setup (optional) */}
        <ThemedCard gap={10}>
          <View style={styles.optionHeader}>
            <IconSymbol name="antenna.radiowaves.left.and.right" size={20} color={theme.gray} />
            <ThemedText style={{ fontWeight: "600", fontSize: 14 }}>
              Paso 0 — Configurar gateway
            </ThemedText>
          </View>
          <ThemedText style={{ color: theme.gray, fontSize: 12, lineHeight: 18 }}>
            Verificá y ajustá los parámetros de radio del gateway. Hacé esto una vez por red, o cuando cambiés la configuración global.
          </ThemedText>
          <AppButton onPress={handleGatewaySetup} style={styles.optionBtn}>
            <ThemedText style={{ color: theme.blue, fontWeight: "600" }}>
              Ir al gateway
            </ThemedText>
          </AppButton>
        </ThemedCard>

        {/* Primary CTA */}
        <AppButton
          onPress={handleNewCommission}
          backgroundColor={theme.blue}
          style={styles.primaryBtn}
        >
          <ThemedText color="#fff" style={{ fontWeight: "bold", fontSize: 15, letterSpacing: 0.5 }}>
            INSTALAR NODO
          </ThemedText>
        </AppButton>

        <ThemedText style={{ color: theme.gray, fontSize: 11, textAlign: "center", lineHeight: 16 }}>
          El gateway ya debe estar encendido y configurado antes de instalar un nodo.
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  scroll: { padding: 16, gap: 14 },
  resumeHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  indicator: { width: 8, height: 8, borderRadius: 4 },
  resumeInfo: { gap: 4 },
  resumeActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  abandonBtn: { paddingHorizontal: 4, paddingVertical: 8 },
  optionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  optionBtn: { paddingVertical: 10 },
  primaryBtn: { paddingVertical: 16 },
});
