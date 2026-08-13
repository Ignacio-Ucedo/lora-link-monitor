import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

let ExpoLocation: typeof import("expo-location") | null = null;
try { ExpoLocation = require("expo-location"); } catch { ExpoLocation = null; }

import { AppButton } from "@/components/app-button";
import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";
import Separator from "@/components/separator";
import { WizardProgress } from "@/components/wizard-progress";
import { IconSymbol } from "@/components/ui/icon-symbol";

import { useCommissioning } from "@/hooks/commissioning-context";
import { useSession } from "@/hooks/session-context";
import { type AckStatus } from "@/hooks/session-context";
import { useTheme } from "@/hooks/use-theme";
import { useWizardBack } from "@/hooks/use-wizard-back";

type GpsState = "idle" | "acquiring" | "ok" | "error";

export default function GatewayIdentifyScreen() {
  const theme = useTheme();
  const { goTo, state, setGatewayName, setGatewayGps, setGatewayWifi } = useCommissioning();
  const { applyDeviceName, applyWifiCredentials } = useSession();
  useWizardBack("gateway_setup", "/wizard/gateway-setup");

  const [name, setName] = useState(state.gatewayName ?? "");
  const [nameStatus, setNameStatus] = useState<AckStatus>("idle");

  const [ssid, setSsid] = useState(state.gatewayWifi?.ssid ?? "");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [wifiStatus, setWifiStatus] = useState<AckStatus>("idle");

  const [gpsState, setGpsState] = useState<GpsState>(state.gatewayGps ? "ok" : "idle");
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(
    state.gatewayGps ?? null,
  );
  const [gpsError, setGpsError] = useState<string | null>(null);

  const handleSendName = () => {
    if (!name.trim() || nameStatus === "pending") return;
    setNameStatus("pending");
    applyDeviceName(name.trim(), (ok) => {
      setNameStatus(ok ? "ok" : "error");
      if (ok) setGatewayName(name.trim());
      setTimeout(() => setNameStatus("idle"), 3000);
    });
  };

  const handleSendWifi = () => {
    if (!ssid.trim() || !password || wifiStatus === "pending") return;
    setWifiStatus("pending");
    applyWifiCredentials(ssid.trim(), password, (ok) => {
      setWifiStatus(ok ? "ok" : "error");
      if (ok) setGatewayWifi(ssid.trim());
      setTimeout(() => setWifiStatus("idle"), 3000);
    });
  };

  const handleGetGps = useCallback(async () => {
    const Loc = ExpoLocation;
    if (!Loc) {
      setGpsState("error");
      setGpsError("Módulo de ubicación no disponible. Recompilá el APK.");
      return;
    }
    setGpsState("acquiring");
    setLocation(null);
    setGpsError(null);
    try {
      const { status } = await Loc.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsState("error");
        setGpsError("Permiso de ubicación denegado.");
        return;
      }
      const loc = await Loc.getCurrentPositionAsync({ accuracy: 4 });
      const coords = { lat: loc.coords.latitude, lon: loc.coords.longitude };
      setLocation(coords);
      setGpsState("ok");
    } catch (e: unknown) {
      setGpsError(e instanceof Error ? e.message : "Error al obtener posición");
      setGpsState("error");
    }
  }, []);

  const handleNext = () => {
    if (location) setGatewayGps(location);
    goTo("node_connect");
    router.push("/wizard/node-connect");
  };

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.background }]}>
      <WizardProgress />
      <View style={[styles.titleBar, { borderBottomColor: theme.border, backgroundColor: theme.eventsCard }]}>
        <ThemedText type="title">IDENTIFICAR GATEWAY</ThemedText>
        <ThemedText style={{ color: theme.gray, fontSize: 11 }}>
          Nombre, posición y red WiFi del gateway
        </ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Name */}
        <ThemedCard gap={10}>
          <ThemedText type="cardTitle">NOMBRE DEL GATEWAY</ThemedText>
          <Separator />
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.background }]}
            placeholder="Ej: Gateway Lote Norte"
            placeholderTextColor={theme.gray}
            value={name}
            onChangeText={setName}
            maxLength={64}
            returnKeyType="done"
            autoFocus
          />
          <View style={styles.actionRow}>
            <AppButton
              onPress={handleSendName}
              backgroundColor={theme.blue}
              style={[styles.actionBtn, { opacity: !name.trim() ? 0.4 : 1 }]}
            >
              {nameStatus === "pending" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText color="#fff" style={{ fontSize: 13, fontWeight: "600" }}>
                  Enviar nombre
                </ThemedText>
              )}
            </AppButton>
            {nameStatus === "ok" && (
              <ThemedText style={{ color: theme.green, fontSize: 12 }}>✓ Aplicado</ThemedText>
            )}
            {nameStatus === "error" && (
              <ThemedText style={{ color: theme.red, fontSize: 12 }}>✗ Error BLE</ThemedText>
            )}
          </View>
        </ThemedCard>

        {/* GPS */}
        <ThemedCard gap={10}>
          <ThemedText type="cardTitle">POSICIÓN DEL GATEWAY</ThemedText>
          <Separator />
          {gpsState === "acquiring" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator size="small" color={theme.blue} />
              <ThemedText style={{ color: theme.gray, fontSize: 12 }}>Obteniendo posición…</ThemedText>
            </View>
          ) : gpsState === "ok" && location ? (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <IconSymbol name="location.fill" size={14} color={theme.green} />
                <ThemedText style={{ fontSize: 13 }}>
                  {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
                </ThemedText>
              </View>
              <AppButton
                onPress={handleGetGps}
                style={{ borderWidth: 1, borderColor: theme.border, paddingVertical: 8 }}
              >
                <ThemedText style={{ color: theme.gray, fontSize: 12 }}>Reintentar</ThemedText>
              </AppButton>
            </View>
          ) : (
            <>
              {gpsState === "error" && gpsError && (
                <ThemedText style={{ color: theme.red, fontSize: 12, marginBottom: 4 }}>
                  {gpsError}
                </ThemedText>
              )}
              <AppButton
                onPress={handleGetGps}
                style={{ borderWidth: 1, borderColor: theme.border, paddingVertical: 10, flexDirection: "row", gap: 6 }}
              >
                <IconSymbol name="location" size={14} color={theme.blue} />
                <ThemedText style={{ color: theme.blue, fontWeight: "600", fontSize: 13 }}>
                  Obtener posición GPS
                </ThemedText>
              </AppButton>
              <ThemedText style={{ color: theme.gray, fontSize: 11 }}>
                Opcional — para mapas de cobertura en ChirpStack
              </ThemedText>
            </>
          )}
        </ThemedCard>

        {/* WiFi */}
        <ThemedCard gap={10}>
          <ThemedText type="cardTitle">RED WiFi</ThemedText>
          <Separator />
          <ThemedText style={{ color: theme.gray, fontSize: 12, lineHeight: 17 }}>
            El gateway usará estas credenciales para conectarse a internet y forwardear paquetes a ChirpStack.
          </ThemedText>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.background }]}
            placeholder="Nombre de la red (SSID)"
            placeholderTextColor={theme.gray}
            value={ssid}
            onChangeText={setSsid}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={64}
            returnKeyType="next"
          />
          <View style={{ position: "relative" }}>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.background, paddingRight: 64 }]}
              placeholder="Contraseña"
              placeholderTextColor={theme.gray}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={128}
              returnKeyType="done"
            />
            <AppButton
              onPress={() => setShowPass((v) => !v)}
              style={styles.eyeBtn}
            >
              <ThemedText style={{ color: theme.gray, fontSize: 11 }}>
                {showPass ? "ocultar" : "ver"}
              </ThemedText>
            </AppButton>
          </View>
          <View style={styles.actionRow}>
            <AppButton
              onPress={handleSendWifi}
              backgroundColor={theme.blue}
              style={[styles.actionBtn, { opacity: !ssid.trim() || !password ? 0.4 : 1 }]}
            >
              {wifiStatus === "pending" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText color="#fff" style={{ fontSize: 13, fontWeight: "600" }}>
                  Configurar WiFi
                </ThemedText>
              )}
            </AppButton>
            {wifiStatus === "ok" && (
              <ThemedText style={{ color: theme.green, fontSize: 12 }}>✓ Configurado</ThemedText>
            )}
            {wifiStatus === "error" && (
              <ThemedText style={{ color: theme.red, fontSize: 12 }}>✗ Error BLE</ThemedText>
            )}
          </View>
        </ThemedCard>

        <AppButton onPress={handleNext} backgroundColor={theme.blue} style={styles.nextBtn}>
          <ThemedText color="#fff" style={{ fontWeight: "bold", letterSpacing: 0.5 }}>
            SIGUIENTE — CONECTAR NODO
          </ThemedText>
        </AppButton>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:     { flex: 1 },
  titleBar:   { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 2 },
  scroll:     { padding: 14, gap: 12 },
  input: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  actionRow:  { flexDirection: "row", alignItems: "center", gap: 12 },
  actionBtn:  { paddingHorizontal: 16, paddingVertical: 10, minWidth: 130 },
  eyeBtn:     { position: "absolute", right: 0, top: 0, bottom: 0, justifyContent: "center", paddingHorizontal: 12 },
  nextBtn:    { paddingVertical: 16, marginTop: 4 },
});
