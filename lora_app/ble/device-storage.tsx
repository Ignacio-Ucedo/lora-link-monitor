import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_KEY = "knownDevice";

export type BleDevice = {
  id: string;
  name: string;
  rssi: number;
};

export async function getKnownDevice() {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_KEY);

    if (!stored) {
      return null;
    }

    const device = JSON.parse(stored);

    if (!device?.id) {
      return null;
    }

    return device;
  } catch (err) {
    console.error("Error leyendo dispositivo conocido", err);
    return null;
  }
}

export async function saveKnownDevice(device: BleDevice) {
  try {
    await AsyncStorage.setItem(
      DEVICE_KEY,
      JSON.stringify({
        id: device.id,
        name: device.name,
      }),
    );
  } catch (err) {
    console.error("Error guardando dispositivo", err);
  }
}

export async function clearKnownDevice() {
  await AsyncStorage.removeItem(DEVICE_KEY);
}
