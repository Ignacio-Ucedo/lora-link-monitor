import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
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

const NODE_TYPE_LABELS: Record<string, string> = {
  weather_station: "Estación meteorológica",
  soil_humidity:   "Sensor de humedad de suelo",
  silo_bag:        "Nodo silo bolsa",
  gateway:         "Gateway",
  node:            "Nodo",
};

function nodeTypeLabel(type: string | null): string {
  if (!type) return "Desconocido";
  return NODE_TYPE_LABELS[type] ?? type;
}

export default function NodeIdentifyScreen() {
  const theme = useTheme();
  const { state, goTo, setNodeName } = useCommissioning();
  useWizardBack("node_connect", "/wizard/node-connect");

  const [name, setName] = useState(state.nodeName ?? "");

  const handleNext = () => {
    setNodeName(name.trim());
    goTo("node_config");
    router.push("/wizard/node-setup/config");
  };

  const typeLabel = nodeTypeLabel(state.nodeType);

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.background }]}>
      <WizardProgress />
      <View style={[styles.titleBar, { borderBottomColor: theme.border, backgroundColor: theme.eventsCard }]}>
        <ThemedText type="title">IDENTIFICAR NODO</ThemedText>
        <ThemedText style={{ color: theme.gray, fontSize: 11 }}>
          Tipo detectado y nombre del punto instalado
        </ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Auto-detected type */}
        <ThemedCard gap={10}>
          <ThemedText type="cardTitle">TIPO DE NODO</ThemedText>
          <Separator />
          <View style={styles.typeRow}>
            <IconSymbol name="cpu" size={20} color={theme.blue} />
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontWeight: "600", fontSize: 15 }}>{typeLabel}</ThemedText>
              {state.nodeType && !NODE_TYPE_LABELS[state.nodeType] && (
                <ThemedText style={{ color: theme.gray, fontSize: 11 }}>{state.nodeType}</ThemedText>
              )}
            </View>
            <View style={[styles.autoBadge, { backgroundColor: theme.blue + "22", borderColor: theme.blue }]}>
              <ThemedText style={{ color: theme.blue, fontSize: 10, fontWeight: "600" }}>AUTO</ThemedText>
            </View>
          </View>
          <ThemedText style={{ color: theme.gray, fontSize: 11, lineHeight: 16 }}>
            Detectado automáticamente desde el firmware. No requiere selección manual.
          </ThemedText>
        </ThemedCard>

        {/* Custom name */}
        <ThemedCard gap={10}>
          <ThemedText type="cardTitle">NOMBRE DEL PUNTO</ThemedText>
          <Separator />
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.background }]}
            placeholder="Ej: Sensor Lote Norte — Parcela 3"
            placeholderTextColor={theme.gray}
            value={name}
            onChangeText={setName}
            maxLength={64}
            returnKeyType="done"
            autoFocus
          />
          <ThemedText style={{ color: theme.gray, fontSize: 11 }}>
            Opcional. Identifica este punto en el sistema de gestión.
          </ThemedText>
        </ThemedCard>

        <AppButton onPress={handleNext} backgroundColor={theme.blue} style={styles.nextBtn}>
          <ThemedText color="#fff" style={{ fontWeight: "bold", letterSpacing: 0.5 }}>
            SIGUIENTE — CONFIGURAR RADIO
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
  typeRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  autoBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1 },
  input: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  nextBtn:    { paddingVertical: 16, marginTop: 4 },
});
