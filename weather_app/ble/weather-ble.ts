import { BleManager, Device, Subscription } from "react-native-ble-plx";
import { Buffer } from "buffer";
import { DEVICE_NAME, SERVICE_UUID, CHARACTERISTIC_UUID } from "@/constants/ble";

let _manager: BleManager | null = null;

function getManager(): BleManager | null {
  if (!_manager) {
    try {
      _manager = new BleManager();
    } catch {
      return null;
    }
  }
  return _manager;
}

export function scanForWeatherStation(
  onDevice: (device: Device) => void,
  onError: (error: Error) => void,
): { stop: () => void } {
  const manager = getManager();
  if (!manager) {
    onError(new Error("BLE no disponible. Usá el APK compilado."));
    return { stop: () => {} };
  }

  manager.startDeviceScan(null, null, (error, device) => {
    if (error) {
      onError(error);
      return;
    }
    if (device?.name === DEVICE_NAME) {
      onDevice(device);
    }
  });

  return { stop: () => manager.stopDeviceScan() };
}

export async function connectToWeatherStation(deviceId: string): Promise<Device> {
  const manager = getManager();
  if (!manager) throw new Error("BLE no disponible");

  try { await manager.cancelDeviceConnection(deviceId); } catch {}

  const device = await manager.connectToDevice(deviceId);
  await device.discoverAllServicesAndCharacteristics();
  return device;
}

export function subscribeToWeatherData(
  device: Device,
  onData: (payload: { t: number | null; h: number | null; w: number; d: string | null }) => void,
  onError: (error: Error) => void,
): Subscription {
  return device.monitorCharacteristicForService(
    SERVICE_UUID,
    CHARACTERISTIC_UUID,
    (error, characteristic) => {
      if (error) {
        onError(error);
        return;
      }
      if (!characteristic?.value) return;
      try {
        const json = Buffer.from(characteristic.value, "base64").toString("utf-8");
        const parsed = JSON.parse(json);
        onData(parsed);
      } catch {
        // malformed payload — ignore
      }
    },
  );
}

export function disconnectDevice(deviceId: string) {
  getManager()?.cancelDeviceConnection(deviceId);
}
