import { DeviceCard } from "@/components/device-card";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { BleManager } from "react-native-ble-plx";
import { SafeAreaView } from "react-native-safe-area-context";

import { StyleSheet } from "react-native";

import { AppButton } from "@/components/app-button";
import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";
// import { View } from "@/components/themed-view";
import { ChatBox } from "@/components/chat-box";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/hooks/use-theme";
import { Link } from "expo-router";
import { Alert, View } from "react-native";

export default function HomeScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);

  const manager = new BleManager();
  const [bleState, setBleState] = useState<string | null>(null);

  useEffect(() => {
    const subscription = manager.onStateChange((state) => {
      // console.log("Estado BLE:", state);
      setBleState(state);
    }, true);

    return () => subscription.remove();
  }, []);

  const handlePress = () => {
    Alert.alert("!Tocaste el botón!");
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screenContainer, { backgroundColor: theme.background }]}
    >
      <View style={[styles.headerContainer, { borderColor: theme.border }]}>
        {/* <DeviceCard> */}
        <View style={[{ flexDirection: "row", gap: 10, alignItems: "center" }]}>
          <IconSymbol
            style={[
              {
                borderRadius: 18,
                backgroundColor: theme.blue,
                padding: 2,
                paddingLeft: 3,

                borderWidth: 2,
                borderColor: theme.green,
              },
            ]}
            size={24}
            name="dot.radiowaves.left.and.right"
            color={theme.radioLogo}
          />
          <View style={[{ flex: 1 }]}>
            <ThemedText type="title">Telemetría </ThemedText>
            <Link href="/modal">
              <ThemedText style={[{ color: theme.gray }]}>
                Pluviómetro
              </ThemedText>
              <Link.Trigger>
                <ThemedText type="link"> LoRa123</ThemedText>
              </Link.Trigger>
              <Link.Preview />
            </Link>
          </View>

          <AppButton
            onPress={handlePress}
            title="desconectar"
            textColor={theme.red}
            // accessibilityLabel="Learn more about this purple button"
          />
        </View>
        {/* </DeviceCard> */}
        {/* <IconSymbol
            size={20}
            name="antenna.radiowaves.left.and.right"
            color={theme.blue}
          /> */}
        {/* <ThemedText type="title">Mensajería LoRa</ThemedText> */}
      </View>

      {bleState === "PoweredOn" ? (
        <KeyboardAvoidingView
          style={styles.mainContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0} // ajustar si hace falta
        >
          <ThemedCard gap={8} style={{ flex: 1 }}>
            <View
              style={[
                {
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                  paddingBottom: 4,
                },
              ]}
            >
              <ThemedText type="cardTitle">Mensajería</ThemedText>
            </View>

            <ChatBox></ChatBox>
          </ThemedCard>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.mainContainer}>
          <DeviceCard>
            <IconSymbol
              style={[
                {
                  borderRadius: 18,
                  backgroundColor: theme.blue,
                  padding: 2,
                  paddingLeft: 3,
                },
              ]}
              size={24}
              name="dot.radiowaves.left.and.right"
              color={theme.radioLogo}
            />
            <View style={[{ flex: 1 }]}>
              <ThemedText type="cardTitle">Bluetooth apagado</ThemedText>
              <ThemedText style={[{ color: theme.red }]}>
                Activá el Bluetooth
              </ThemedText>
            </View>
          </DeviceCard>
        </View>
      )}
      {/* </KeyboardAvoidingView> */}
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    screenContainer: {
      flex: 1,
    },
    headerContainer: {
      flexDirection: "row",
      gap: 10,
      padding: 20,
      justifyContent: "center",
      alignItems: "center",
      borderBottomWidth: 1,
    },
    mainContainer: {
      padding: 18,
      gap: 20,
      flex: 1,
    },
    channelButton: {
      padding: 10,
    },
  });
