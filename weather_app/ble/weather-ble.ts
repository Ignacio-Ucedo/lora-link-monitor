import { BleManager, Device, Subscription } from "react-native-ble-plx";
import { Buffer } from "buffer";
import {
  DEVICE_NAME,
  SERVICE_UUID,
  CHARACTERISTIC_UUID,
  CONFIG_CHARACTERISTIC_UUID,
} from "@/constants/ble";

export type StationConfig = { intervalMs: number; north: number };

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

  // Filtrar por service UUID en lugar de nombre: en Android el nombre puede
  // llegar null en scans sin filtro por restricciones de privacidad del SO.
  manager.startDeviceScan([SERVICE_UUID], null, (error, device) => {
    if (error) {
      onError(error);
      return;
    }
    if (device) {
      onDevice(device);
    }
  });

  return { stop: () => manager.stopDeviceScan() };
}

export async function connectToWeatherStation(deviceId: string): Promise<Device> {
  const manager = getManager();
  if (!manager) throw new Error("BLE no disponible");

  try { await manager.cancelDeviceConnection(deviceId); } catch {}

  const device = await manager.connectToDevice(deviceId, { requestMTU: 512 });
  await device.discoverAllServicesAndCharacteristics();
  return device;
}

export function subscribeToWeatherData(
  device: Device,
  onData: (payload: {
    t: number | null;
    h: number | null;
    w: number | null;
    d: string | null;
    r: number | null;
  }) => void,
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
        const decoded = Buffer.from(characteristic.value, "base64").toString("utf-8");
        // Recortar cualquier byte sobrante después del objeto JSON (algunos
        // firmwares mandan el buffer completo con relleno tras el `}`).
        const end = decoded.lastIndexOf("}");
        const json = end >= 0 ? decoded.slice(0, end + 1) : decoded;
        const parsed = JSON.parse(json);
        // Sanear: campos ausentes o no numéricos quedan en null; la UI oculta
        // la métrica en vez de inventar un cero (honestidad con pocos datos).
        const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
        onData({
          t: num(parsed.t),
          h: num(parsed.h),
          w: num(parsed.w),
          d: typeof parsed.d === "string" ? parsed.d : null,
          r: num(parsed.r),
        });
      } catch {
        // malformed payload — ignore
      }
    },
  );
}

// Lee la config actual de la estación (intervalo de muestreo y Norte de veleta).
export async function readStationConfig(device: Device): Promise<StationConfig | null> {
  const c = await device.readCharacteristicForService(
    SERVICE_UUID,
    CONFIG_CHARACTERISTIC_UUID,
  );
  if (!c?.value) return null;
  try {
    const decoded = Buffer.from(c.value, "base64").toString("utf-8");
    const end = decoded.lastIndexOf("}");
    const json = end >= 0 ? decoded.slice(0, end + 1) : decoded;
    const p = JSON.parse(json);
    return {
      intervalMs: typeof p.interval_ms === "number" ? p.interval_ms : 2000,
      north: typeof p.north === "number" ? p.north : 0,
    };
  } catch {
    return null;
  }
}

// Escribe un comando JSON en la característica de config y devuelve el estado
// resultante (el firmware refleja la config nueva en el mismo atributo).
export async function writeStationCommand(
  device: Device,
  cmd: Record<string, unknown>,
): Promise<StationConfig | null> {
  const payload = Buffer.from(JSON.stringify(cmd), "utf-8").toString("base64");
  await device.writeCharacteristicWithResponseForService(
    SERVICE_UUID,
    CONFIG_CHARACTERISTIC_UUID,
    payload,
  );
  return readStationConfig(device);
}

export function getBleManager() {
  return getManager();
}

export function disconnectDevice(deviceId: string) {
  getManager()?.cancelDeviceConnection(deviceId);
}

// Destruye el BleManager y libera el cliente GATT nativo. Imprescindible al
// desmontar: si no se llama, cada recarga de JS (hot reload / relanzar la app)
// deja un cliente GATT vivo en el stack Bluetooth del sistema. Esos clientes
// filtrados siguen suscritos a la characteristic y hacen que Android descarte
// las notificaciones de la conexión nueva (error bta_gattc: notif no registrada).
export function destroyManager() {
  _manager?.destroy();
  _manager = null;
}
