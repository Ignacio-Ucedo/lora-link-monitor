import { useTheme } from "@/hooks/use-theme";
import { View } from "react-native";
import { ThemedText } from "./themed-text";
import { IconSymbol } from "./ui/icon-symbol";

interface MetricProps {
  label: string;
  value: string | number;
  unit: string;
}

export function Metric({ label, value, unit }: MetricProps) {
  const theme = useTheme();

  const iconName = label === "Intensidad" ? "speedometer" : "waveform";

  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <ThemedText style={{ color: theme.gray, fontSize: 12 }}>
        {label.toUpperCase()}
      </ThemedText>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <IconSymbol
          name={iconName}
          size={26}
          color={theme.turquoise}
        ></IconSymbol>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
          <ThemedText type="title">{value}</ThemedText>
          <ThemedText style={{ fontSize: 14, color: theme.gray }}>
            {unit}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}
