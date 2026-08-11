import { useTheme } from "@/hooks/use-theme";
import { ReactNode } from "react";
import { Modal, StyleSheet, View } from "react-native";

type AppModalProps = {
  visible?: boolean;
  children?: ReactNode;
};

export default function AppModal({ visible, children }: AppModalProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    //agregar un close
    <Modal visible={visible ?? false} transparent animationType="fade">
      <View style={styles.overlay}>{children}</View>
    </Modal>
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
