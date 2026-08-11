import { useTheme } from "@/hooks/use-theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import React from "react";
import {
  GestureResponderEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from "react-native";

type ThemedColor = string | { light?: string; dark?: string };

interface AppButtonProps {
  style?: StyleProp<ViewStyle>;
  title?: string;
  children?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  backgroundColor?: ThemedColor;
  textColor?: string;
  textStyle?: StyleProp<TextStyle>;
  padding?: number;
}

export function AppButton({
  style,
  title,
  children,
  onPress,
  backgroundColor,
  textColor,
  textStyle,
  padding,
}: AppButtonProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const isDisabled = !onPress;

  const resolvedBackground = useThemeColor(
    typeof backgroundColor === "string" ? {} : (backgroundColor ?? {}),
    "buttonBackground",
  );

  const finalBackground =
    typeof backgroundColor === "string" ? backgroundColor : resolvedBackground;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={isDisabled ? 1 : 0.8}
      style={[
        styles.buttonContainer,
        padding === 0
          ? { paddingVertical: padding, paddingHorizontal: padding }
          : { paddingVertical: 10, paddingHorizontal: 12 },
        { backgroundColor: finalBackground },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {children ? (
        children
      ) : (
        <Text
          style={[
            styles.buttonText,
            textColor ? { color: textColor } : { color: theme.text },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    buttonContainer: {
      elevation: 8,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    buttonText: {
      fontSize: 12,
      textAlign: "center",
      textTransform: "uppercase",
    },
    disabled: {},
  });
