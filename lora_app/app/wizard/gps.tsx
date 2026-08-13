import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

// expo-location requires a native build — guard against missing module in dev APKs
let ExpoLocation: typeof import("expo-location") | null = null;
try { ExpoLocation = require("expo-location"); } catch { ExpoLocation = null; }

import { AppButton } from "@/components/app-button";
import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";
import Separator from "@/components/separator";
import { WizardProgress } from "@/components/wizard-progress";
import { IconSymbol } from "@/components/ui/icon-symbol";

import { useCommissioning } from "@/hooks/commissioning-context";
import { useTheme } from "@/hooks/use-theme";
import { useWizardBack } from "@/hooks/use-wizard-back";

const AMBER = "#d3b64f";

type PermState = "checking" | "denied" | "granted";
type FixState  = "idle" | "acquiring" | "ok" | "error";

// Minimal shape we need from LocationObject
type GpsResult = { coords: { latitude: number; longitude: number; accuracy: number | null } };

function accuracyLabel(meters: number): { text: string; color: string } {
  if (meters < 5)  return { text: "Excelente", color: "#4caf50" };
  if (meters < 15) return { text: "Buena",      color: "#4caf50" };
  if (meters < 50) return { text: "Aceptable",  color: AMBER };
  return              { text: "Baja",        color: "#f44336" };
}

function formatCoord(deg: number, pos: string, neg: string): string {
  const dir  = deg >= 0 ? pos : neg;
  const abs  = Math.abs(deg);
  const d    = Math.floor(abs);
  const mRaw = (abs - d) * 60;
  const m    = Math.floor(mRaw);
  const s    = ((mRaw - m) * 60).toFixed(2);
  return `${d}° ${m}' ${s}" ${dir}`;
}

export default function GpsScreen() {
  const theme = useTheme();
  const { goTo, setGpsCoords } = useCommissioning();
  useWizardBack("verify_link", "/wizard/node-setup/verify");

  const [perm, setPerm]         = useState<PermState>("checking");
  const [fix,  setFix]          = useState<FixState>("idle");
  const [location, setLocation] = useState<GpsResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Request permission once on mount
  useEffect(() => {
    if (!ExpoLocation) { setPerm("denied"); return; }
    ExpoLocation.requestForegroundPermissionsAsync().then(({ status }) => {
      setPerm(status === "granted" ? "granted" : "denied");
    });
  }, []);

  // Auto-start acquisition once permission is granted
  useEffect(() => {
    if (perm === "granted" && fix === "idle") acquire();
  }, [perm]); // eslint-disable-line react-hooks/exhaustive-deps

  const acquire = useCallback(async () => {
    const Loc = ExpoLocation;
    if (!Loc) {
      setFix("error");
      setErrorMsg("Módulo de ubicación no disponible en este build. Recompilá el APK.");
      return;
    }
    setFix("acquiring");
    setLocation(null);
    setErrorMsg(null);
    try {
      const loc = await Loc.getCurrentPositionAsync({ accuracy: 4 }); // Accuracy.High
      setLocation(loc);
      setFix("ok");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Error al obtener posición");
      setFix("error");
    }
  }, []);

  const handleConfirm = () => {
    if (!location) return;
    setGpsCoords({ lat: location.coords.latitude, lon: location.coords.longitude });
    goTo("complete");
    router.push("/wizard/summary");
  };

  const handleSkip = () => {
    goTo("complete");
    router.push("/wizard/summary");
  };

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.background }]}>
      <WizardProgress />
      <View style={[styles.titleBar, { borderBottomColor: theme.border, backgroundColor: theme.eventsCard }]}>
        <ThemedText type="title">REGISTRAR POSICIÓN</ThemedText>
        <ThemedText style={{ color: theme.gray, fontSize: 11 }}>
          Coordenadas del nodo instalado
        </ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Permission denied or native module missing */}
        {perm === "denied" && (
          <ThemedCard gap={12} style={{ borderLeftWidth: 3, borderLeftColor: AMBER }}>
            <ThemedText style={{ color: AMBER, fontWeight: "600", fontSize: 13 }}>
              {ExpoLocation ? "Permiso de ubicación denegado" : "GPS no disponible en este build"}
            </ThemedText>
            <ThemedText style={{ color: theme.text, fontSize: 12, lineHeight: 18 }}>
              {ExpoLocation
                ? "Habilitá el permiso de ubicación para esta app en Configuración → Aplicaciones."
                : "El módulo nativo de ubicación no está compilado en este APK. Recompilá con ./gradlew assembleDebug."}
            </ThemedText>
          </ThemedCard>
        )}

        {/* Acquiring */}
        {perm === "granted" && fix === "acquiring" && (
          <ThemedCard gap={14} style={{ alignItems: "center" }}>
            <ActivityIndicator size="large" color={theme.blue} />
            <ThemedText style={{ color: theme.gray, fontSize: 13, textAlign: "center" }}>
              Obteniendo posición GPS…{"\n"}Esto puede demorar unos segundos.
            </ThemedText>
          </ThemedCard>
        )}

        {/* Error */}
        {fix === "error" && (
          <ThemedCard gap={10} style={{ borderLeftWidth: 3, borderLeftColor: "#f44336" }}>
            <ThemedText style={{ color: "#f44336", fontWeight: "600", fontSize: 13 }}>
              No se pudo obtener la posición
            </ThemedText>
            {errorMsg && (
              <ThemedText style={{ color: theme.gray, fontSize: 12 }}>{errorMsg}</ThemedText>
            )}
            <AppButton onPress={acquire} style={{ borderWidth: 1, borderColor: theme.border }}>
              <ThemedText style={{ color: theme.blue, fontWeight: "600" }}>Reintentar</ThemedText>
            </AppButton>
          </ThemedCard>
        )}

        {/* Location obtained */}
        {fix === "ok" && location && (() => {
          const { latitude, longitude, accuracy } = location.coords;
          const acc = accuracy ?? 999;
          const { text: accLabel, color: accColor } = accuracyLabel(acc);
          return (
            <>
              <ThemedCard gap={10}>
                <View style={styles.coordHeader}>
                  <IconSymbol name="location.fill" size={18} color={theme.green} />
                  <ThemedText type="cardTitle">POSICIÓN OBTENIDA</ThemedText>
                </View>
                <Separator />

                <View style={styles.row}>
                  <ThemedText style={{ color: theme.gray, fontSize: 12 }}>Latitud</ThemedText>
                  <ThemedText style={{ fontSize: 13, fontWeight: "500" }}>
                    {formatCoord(latitude, "N", "S")}
                  </ThemedText>
                </View>
                <View style={styles.row}>
                  <ThemedText style={{ color: theme.gray, fontSize: 12 }}>Longitud</ThemedText>
                  <ThemedText style={{ fontSize: 13, fontWeight: "500" }}>
                    {formatCoord(longitude, "E", "O")}
                  </ThemedText>
                </View>
                <View style={styles.row}>
                  <ThemedText style={{ color: theme.gray, fontSize: 12 }}>Decimal</ThemedText>
                  <ThemedText style={{ fontSize: 12, color: theme.gray }}>
                    {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  </ThemedText>
                </View>

                <Separator />

                <View style={styles.row}>
                  <ThemedText style={{ color: theme.gray, fontSize: 12 }}>Precisión</ThemedText>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <ThemedText style={{ fontSize: 12, color: theme.gray }}>
                      ±{acc.toFixed(0)} m
                    </ThemedText>
                    <View style={[styles.accBadge, { backgroundColor: accColor + "22", borderColor: accColor }]}>
                      <ThemedText style={{ color: accColor, fontSize: 11, fontWeight: "600" }}>
                        {accLabel}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </ThemedCard>

              {acc >= 50 && (
                <ThemedCard gap={6} style={{ borderLeftWidth: 3, borderLeftColor: AMBER }}>
                  <ThemedText style={{ color: AMBER, fontSize: 12, fontWeight: "600" }}>
                    Precisión baja
                  </ThemedText>
                  <ThemedText style={{ color: theme.text, fontSize: 12, lineHeight: 18 }}>
                    Esperá unos segundos más o reintentá al aire libre para mejorar la precisión.
                  </ThemedText>
                  <AppButton onPress={acquire} style={{ borderWidth: 1, borderColor: theme.border, marginTop: 4 }}>
                    <ThemedText style={{ color: theme.blue, fontWeight: "600", fontSize: 13 }}>
                      Reintentar
                    </ThemedText>
                  </AppButton>
                </ThemedCard>
              )}

              <AppButton onPress={handleConfirm} backgroundColor={theme.green} style={styles.mainBtn}>
                <IconSymbol name="checkmark" size={14} color="#fff" />
                <ThemedText color="#fff" style={{ fontWeight: "bold", letterSpacing: 0.5 }}>
                  CONFIRMAR POSICIÓN
                </ThemedText>
              </AppButton>
            </>
          );
        })()}

        {/* Skip */}
        <AppButton onPress={handleSkip} style={[styles.skipBtn, { borderColor: theme.border }]}>
          <ThemedText style={{ color: theme.gray, fontSize: 13 }}>
            Continuar sin GPS
          </ThemedText>
        </AppButton>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1 },
  titleBar:    { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 2 },
  scroll:      { padding: 14, gap: 12 },
  coordHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  row:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  mainBtn:     { paddingVertical: 16, flexDirection: "row", gap: 8 },
  skipBtn:     { paddingVertical: 12, borderWidth: 1, borderRadius: 8 },
});
