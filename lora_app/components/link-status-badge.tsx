import { StyleSheet, View } from "react-native";
import type { LinkQuality } from "@/lib/models";
import { ThemedText } from "@/components/themed-text";

const CONFIG: Record<LinkQuality, { label: string; bg: string }> = {
  EXCELLENT:  { label: "EXCELENTE",  bg: "#4fd363" },
  GOOD:       { label: "BUENO",      bg: "#4f88d3" },
  ACCEPTABLE: { label: "ACEPTABLE",  bg: "#d3b64f" },
  POOR:       { label: "DEFICIENTE", bg: "#d3784f" },
  NO_LINK:    { label: "SIN ENLACE", bg: "#fa5151" },
};

export function LinkStatusBadge({
  quality,
  large = false,
}: {
  quality: LinkQuality;
  large?: boolean;
}) {
  const { label, bg } = CONFIG[quality];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, large && styles.large]}>
      <ThemedText color="#fff" style={large ? styles.largeText : styles.smallText}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  large: {
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 18,
    alignSelf: "center",
  },
  smallText: { fontSize: 12, fontWeight: "bold", letterSpacing: 1 },
  largeText: { fontSize: 26, fontWeight: "bold", letterSpacing: 2 },
});
