import { useTheme } from "@/hooks/use-theme";
import { StyleSheet, View, type ViewProps } from "react-native";
import { ThemedText } from "./themed-text";
import { IconSymbol } from "./ui/icon-symbol";

export type ThemedViewProps = ViewProps & {
  title: string;
  time: string;
  value: string | null;
};

export function EventItem({
  style,
  title,
  time,
  value,
  ...otherProps
}: ThemedViewProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={[styles.base, style]} {...otherProps}>
      <IconSymbol
        name="smallcircle.fill.circle.fill"
        color={theme.blue}
        size={8}
      ></IconSymbol>
      <ThemedText>{title}</ThemedText>
      <ThemedText style={{ color: theme.gray }}> {time}</ThemedText>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    base: {
      padding: 12,
      paddingVertical: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
  });
