import { useTheme } from "@/hooks/use-theme";
import { Pressable } from "react-native";
import { ThemedText } from "./themed-text";

interface RangeButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function RangeButton({ label, active, onPress }: RangeButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderBottomWidth: active ? 2 : 0,
        borderBottomColor: active ? theme.tint : "transparent",
      }}
    >
      <ThemedText
        style={{
          color: active ? theme.tint : theme.gray,
          fontSize: 12,
          textTransform: "uppercase",
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}
