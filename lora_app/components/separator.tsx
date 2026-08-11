import { useTheme } from "@/hooks/use-theme";

import { StyleSheet, View } from "react-native";

export default function Separator() {
  const theme = useTheme();
  const styles = createStyles(theme);

  return <View style={styles.separator}></View>;
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    separator: {
      height: 0.6,
      backgroundColor: theme.border,
    },
  });
