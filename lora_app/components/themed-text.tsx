import { StyleSheet, Text, type TextProps } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedTextProps = TextProps & {
  color?: string;
  type?: "default" | "title" | "cardTitle" | "link" | "note";
};

export function ThemedText({
  style,
  color,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const colorToken =
    type === "cardTitle"
      ? "gray"
      : type === "link"
        ? "brightBlue"
        : type === "note"
          ? "gray"
          : "text";

  const resolvedColor = useThemeColor(
    typeof color === "string" ? {} : (color ?? {}),
    colorToken,
  );

  const finalColor = typeof color === "string" ? color : resolvedColor;

  return (
    <Text
      style={[
        { color: finalColor },
        type === "default" ? styles.default : undefined,
        type === "title" ? styles.title : undefined,
        type === "cardTitle" ? styles.cardTitle : undefined,
        type === "link" ? styles.link : undefined,
        type === "note" ? styles.note : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 14,
    lineHeight: 14,
  },
  title: {
    fontSize: 22,
    lineHeight: 22,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "thin",
    textTransform: "uppercase",
  },
  link: {
    fontSize: 16,
  },
  note: {
    fontSize: 14,
    lineHeight: 18,
    fontStyle: "italic",
  },
});
