import { BleManager } from "react-native-ble-plx";
import { logger } from "@/lib/logger";

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

  // Cancel any stale GATT connection from a previous session (e.g. after ESP32 reset).
  // Android keeps the device "connected" on its side even after the chip reboots,
  // which can cause discoverAllServicesAndCharacteristics to return cached/partial results.
  try { await manager.cancelDeviceConnection(deviceId); } catch {}

  const device = await manager.connectToDevice(deviceId);
  await device.discoverAllServicesAndCharacteristics();

  const services = await device.services();
  for (const svc of services) {
    const chars = await svc.characteristics();
    logger.debug("BLE-MGR", `descubrimiento servicio ${svc.uuid}`, {
      chars: chars.map((c) => `${c.uuid} [${c.isReadable ? "R" : ""}${c.isWritableWithResponse ? "W" : ""}${c.isWritableWithoutResponse ? "w" : ""}${c.isNotifiable ? "N" : ""}]`),
    });
  }

  return device;
}

export function disconnect(deviceId: string) {
  getManager()?.cancelDeviceConnection(deviceId);
}
