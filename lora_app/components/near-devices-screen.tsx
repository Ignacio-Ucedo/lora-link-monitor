import { StyleSheet } from "react-native";
import { IconSymbol } from "./ui/icon-symbol";

import { useState } from "react";
import { View } from "react-native";
// import { ScrollView } from "react-native-reanimated/lib/typescript/Animated";
import { ScrollView } from "react-native";

import { useTheme } from "@/hooks/use-theme";

import { AppButton } from "./app-button";
import Separator from "./separator";
import { ThemedCard } from "./themed-card";
import { ThemedText } from "./themed-text";

import { BleDevice } from "@/ble/device-storage";

const MOCK_DEVICES: BleDevice[] = [
  { id: "1", name: "LoRaNode_123", rssi: -48 },
  { id: "2", name: "LoRaNode_ABC", rssi: -60 },
  { id: "3", name: "RainNode_45", rssi: -72 },
  { id: "4", name: "LoRaNode_X1", rssi: -80 },
  { id: "5", name: "Pluviometro_LoRa", rssi: -67 },
  { id: "6", name: "LoRaNode_8941", rssi: -90 },
  { id: "7", name: "Sensor_LoRa_Test", rssi: -55 },
  { id: "8", name: "", rssi: -65 },
];

export default function NearDevicesScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [scanStatus, setStatus] = useState<"ok" | "denied" | "unknown">("ok");

  const [foundDevices, setFoundDevices] = useState<Record<string, BleDevice>>(
    {},
  );

  const fluctuateRSSI = (rssi: number) => {
    const variation = Math.floor(Math.random() * 6) - 3;
    return rssi + variation;
  };

  const handleDeviceFound = (device: BleDevice) => {
    setFoundDevices((prev) => ({
      ...prev,
      [device.id]: {
        ...prev[device.id],
        ...device,
      },
    }));

    setStatus("ok");
  };

  const handleError = (error: any) => {
    if (error?.message?.includes("not authorized")) {
      setStatus("denied");
    } else {
      setStatus("unknown");
    }
  };

  const startMockScan = () => {
    setFoundDevices({});

    let index = 0;

    const interval = setInterval(() => {
      if (index >= MOCK_DEVICES.length) {
        clearInterval(interval);
        return;
      }

      const device = MOCK_DEVICES[index];

      handleDeviceFound({
        ...device,
        rssi: fluctuateRSSI(device.rssi),
      });

      index++;
    }, 700);
  };

  const startScan = async () => {
    // reemplazar por scanForDevices(handleDeviceFound, handleError)
    startMockScan();
  };

  const sortedDevices = Object.values(foundDevices).sort(
    (a, b) => b.rssi - a.rssi,
  );

  return (
    <View style={styles.screenContainer}>
      {scanStatus === "ok" ? (
        <>
          <ThemedCard gap={10}>
            <ThemedText type="title">Dispositivos Cercanos</ThemedText>
            <Separator />
            <ThemedText type="note">
              Elegí un dispositivo Base para conectar
            </ThemedText>

            <AppButton onPress={startScan}>
              <ThemedText type="link">Escanear dispositivos</ThemedText>
            </AppButton>
          </ThemedCard>

          {sortedDevices.length !== 0 && (
            <ThemedCard style={styles.deviceList}>
              {sortedDevices.map((device, index) => (
                <ScrollView key={device.id}>
                  <View
                    key={device.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      gap: 10,
                    }}
                  >
                    <IconSymbol
                      style={{
                        borderRadius: 18,
                        padding: 2,
                        paddingLeft: 3,
                        borderWidth: 2,
                        borderColor: theme.green,
                      }}
                      size={24}
                      name="dot.radiowaves.left.and.right"
                      color={theme.radioLogo}
                    />

                    <View style={{ flex: 1 }}>
                      <ThemedText type="link">
                        {device.name || "Dispositivo desconocido"}
                      </ThemedText>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {device.rssi >= -55 ? (
                          <IconSymbol
                            name="radiowaves.right"
                            size={16}
                            color={theme.green}
                          />
                        ) : device.rssi >= -75 ? (
                          <IconSymbol
                            name="radiowaves.right"
                            size={16}
                            color="#d3b64f"
                          />
                        ) : (
                          <IconSymbol
                            name="radiowaves.right"
                            size={16}
                            color={theme.red}
                          />
                        )}

                        <ThemedText type="note">{device.rssi} dBm</ThemedText>
                      </View>
                    </View>

                    <AppButton>
                      <ThemedText>Conectar</ThemedText>
                    </AppButton>
                  </View>

                  {index < sortedDevices.length - 1 && <Separator />}
                </ScrollView>
              ))}
            </ThemedCard>
          )}
        </>
      ) : (
        <View style={styles.denial}>
          <IconSymbol
            style={{
              borderRadius: 38,
              backgroundColor: theme.blue,
              padding: 2,
              paddingLeft: 4,
            }}
            size={64}
            name="dot.radiowaves.left.and.right"
            color={theme.radioLogo}
          />

          <ThemedText type="cardTitle">Permiso denegado</ThemedText>

          <ThemedText type="note">
            Para poder recibir datos en tiempo real, la aplicación debe tener
            permiso para dispositivos cercanos.
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    screenContainer: {
      padding: 18,
      gap: 18,
    },
    deviceList: {
      gap: 80,
      flex: 1,
      paddingVertical: 4,
    },
    denial: {
      gap: 22,
      alignItems: "center",
      padding: 22,
    },
  });
