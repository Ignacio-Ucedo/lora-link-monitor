import { StyleSheet } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import AppModal from "./app-modal";
import BtOffCard from "./bt-off-card";

export default function BtOffModal() {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <AppModal visible={true}>
      <BtOffCard></BtOffCard>
    </AppModal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      paddingHorizontal: 20,
      justifyContent: "center",
      backgroundColor: theme.modalOverlay,
    },
  });
