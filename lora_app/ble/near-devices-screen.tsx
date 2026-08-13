import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { AppButton } from "@/components/app-button";
import Separator from "@/components/separator";
import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";

import { scanForDevices, connectToDevice } from "@/ble/ble-manager";
import { saveKnownDevice } from "@/ble/device-storage";
import { useSession } from "@/hooks/session-context";
import { useTheme } from "@/hooks/use-theme";
import { GatewayBleTransport } from "@/lib/transport";

type FoundDevice = { id: string; name: string; rssi: number };

export default function NearDevicesScreen({
  onConnected,
}: {
  onConnected: () => void;
}) {
  const theme = useTheme();
  const { switchToBle } = useSession();

  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<Record<string, FoundDevice>>({});
  const [connecting, setConnecting] = useState<string | null>(null);
  const [permDenied, setPermDenied] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const scanHandle = useRef<{ stop: () => void } | null>(null);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopScan = () => {
    scanHandle.current?.stop();
    scanHandle.current = null;
    if (scanTimer.current) clearTimeout(scanTimer.current);
    setScanning(false);
  };

  const startScan = () => {
    setFound({});
    setConnectError(null);
    setPermDenied(false);
    setScanning(true);

    scanHandle.current = scanForDevices(
      (device: any) => {
        setFound((prev) => ({
          ...prev,
          [device.id]: {
            id: device.id,
            name: device.name ?? "LORA Device",
            rssi: device.rssi ?? -100,
          },
        }));
      },
      (err: any) => {
        const msg: string = err?.message ?? "";
        if (msg.includes("not authorized")) {
          setPermDenied(true);
        } else if (msg.includes("powered off") || msg.includes("BluetoothLE")) {
          setConnectError("Bluetooth apagado. Activalo e intentá de nuevo.");
        } else {
          setConnectError("Error al escanear: " + msg);
        }
        stopScan();
      },
    );

    scanTimer.current = setTimeout(stopScan, 10_000);
  };

  const handleConnect = async (device: FoundDevice) => {
    stopScan();
    setConnecting(device.id);
    setConnectError(null);
    try {
      const connected = await connectToDevice(device.id);
      await saveKnownDevice(device);
      switchToBle(new GatewayBleTransport(connected));
      onConnected();
    } catch {
      setConnectError(`No se pudo conectar a ${device.name}`);
      setConnecting(null);
    }
  };

  useEffect(() => () => stopScan(), []);

  const sorted = Object.values(found).sort((a, b) => b.rssi - a.rssi);

  if (permDenied) {
    return (
      <View style={styles.center}>
        <IconSymbol size={48} name="dot.radiowaves.left.and.right" color={theme.gray} />
        <ThemedText style={{ color: theme.gray, textAlign: "center", marginTop: 12, lineHeight: 20 }}>
          Permiso BLE denegado. Habilitá "Dispositivos cercanos" en los permisos de la app.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedCard gap={10}>
        <ThemedText style={{ color: theme.gray, fontSize: 13, lineHeight: 18 }}>
          Se muestran dispositivos BLE cuyo nombre empieza con "LORA". Asegurate que el ESP32 esté encendido.
        </ThemedText>
        <AppButton onPress={scanning ? stopScan : startScan}>
          <ThemedText style={{ color: theme.blue, fontWeight: "600" }}>
            {scanning ? "Detener búsqueda" : "Buscar dispositivos"}
          </ThemedText>
        </AppButton>
        {scanning && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator size="small" color={theme.blue} />
            <ThemedText style={{ color: theme.gray, fontSize: 12 }}>Buscando…</ThemedText>
          </View>
        )}
      </ThemedCard>

      {connectError && (
        <ThemedText style={{ color: theme.red, fontSize: 13, textAlign: "center" }}>
          {connectError}
        </ThemedText>
      )}

      {sorted.length > 0 && (
        <ThemedCard gap={0}>
          {sorted.map((device, index) => (
            <View key={device.id}>
              <View style={styles.deviceRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ fontWeight: "600", fontSize: 14 }}>{device.name}</ThemedText>
                  <ThemedText style={{ color: theme.gray, fontSize: 12 }}>{device.rssi} dBm</ThemedText>
                </View>
                {connecting === device.id ? (
                  <ActivityIndicator size="small" color={theme.blue} />
                ) : (
                  <AppButton
                    onPress={connecting === null ? () => handleConnect(device) : undefined}
                    backgroundColor={theme.blue}
                    style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                  >
                    <ThemedText color="#fff" style={{ fontSize: 13 }}>Conectar</ThemedText>
                  </AppButton>
                )}
              </View>
              {index < sorted.length - 1 && <Separator />}
            </View>
          ))}
        </ThemedCard>
      )}

      {!scanning && sorted.length === 0 && !connectError && (
        <View style={styles.center}>
          <ThemedText style={{ color: theme.gray, fontSize: 13, textAlign: "center" }}>
            Sin dispositivos encontrados. Presioná "Buscar dispositivos" para iniciar el escaneo.
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  center: { alignItems: "center", padding: 24 },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
});
