import { useThemeColor } from "@/hooks/use-theme-color";
import { StyleSheet, View, type ViewProps } from "react-native";

export type ThemedViewProps = ViewProps & {
  background?: string;
  gap?: number;
};

export function ThemedCard({
  style,
  background,
  gap,
  ...otherProps
}: ThemedViewProps) {
  const resolvedBackground = useThemeColor(
    typeof background === "string" ? {} : (background ?? {}),
    "cardBackground",
  );

  const finalBackground =
    typeof background === "string" ? background : resolvedBackground;

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: finalBackground, gap: gap },
        style,
      ]}
      {...otherProps}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    padding: 12,
  },
});
