import { BleManager } from "react-native-ble-plx";

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

export function scanForDevices(
  onDevice: (device: any) => void,
  onError: (error: any) => void,
) {
  const manager = getManager();
  if (!manager) {
    onError(new Error("BLE no disponible en este entorno. Usá el APK compilado."));
    return { stop: () => {} };
  }

  manager.startDeviceScan(null, null, (error, device) => {
    if (error) {
      onError(error);
      return;
    }
    if (device?.name?.startsWith("LORA")) {
      onDevice(device);
    }
  });

  return {
    stop: () => manager.stopDeviceScan(),
  };
}

export async function connectToDevice(deviceId: string) {
  const manager = getManager();
  if (!manager) throw new Error("BLE no disponible");
  const device = await manager.connectToDevice(deviceId);
  await device.discoverAllServicesAndCharacteristics();
  return device;
}

export function disconnect(deviceId: string) {
  getManager()?.cancelDeviceConnection(deviceId);
}
