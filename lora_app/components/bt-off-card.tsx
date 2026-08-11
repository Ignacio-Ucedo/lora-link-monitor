import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { View } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export default function BtOffCard() {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.card}>
      <IconSymbol
        style={[
          {
            borderRadius: 38,
            backgroundColor: theme.blue,
            padding: 2,
            paddingLeft: 4,
          },
        ]}
        size={64}
        name="dot.radiowaves.left.and.right"
        color={theme.radioLogo}
      />
      <View>
        <ThemedText type="cardTitle">Bluetooth apagado</ThemedText>
      </View>
      <ThemedText type="note">
        Para poder recibir datos en tiempo real, el Bluetooth del teléfono debe
        estar activado.
      </ThemedText>
      <ThemedText style={{ color: theme.red }}>Activá el Bluetooth</ThemedText>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      gap: 22,
      alignItems: "center",
      padding: 22,
    },
  });
