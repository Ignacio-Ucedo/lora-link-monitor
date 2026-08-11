import { StyleSheet } from "react-native";

import { View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import BtOffCard from "./bt-off-card";

export default function BtOffScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.screenContainer}>
      <BtOffCard></BtOffCard>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    screenContainer: {
      padding: 18,
      flex: 1,
      justifyContent: "center",
    },
  });
