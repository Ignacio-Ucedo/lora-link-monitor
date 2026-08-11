import { useTheme } from "@/hooks/use-theme";
import React, { useState } from "react";
import AppModal from "./app-modal";

import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Sensor = {
  id: string;
  name: string;
  battery: number;
  signal: number;
  active?: boolean;
};

const sensorsMock: Sensor[] = [
  {
    id: "1",
    name: "Pluviómetro Campo",
    battery: 74,
    signal: -77,
    active: true,
  },
  { id: "2", name: "Sensor Norte", battery: 57, signal: -85 },
  { id: "3", name: "Sensor Sur", battery: 88, signal: -80 },
];

export default function SensorSelector() {
  const theme = useTheme();
  const styles = createStyles(theme);

  const [modalVisible, setModalVisible] = useState(false);
  const [activeSensor, setActiveSensor] = useState<Sensor>(sensorsMock[0]);

  const selectSensor = (sensor: Sensor) => {
    setActiveSensor(sensor);
    setModalVisible(false);
  };
  return (
    <>
      {/* SELECTOR */}
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.label}>Sensor:</Text>

        <Text style={styles.sensorName}>{activeSensor.name}</Text>

        <Text style={styles.chevron}>▼</Text>
      </TouchableOpacity>

      {/* MODAL */}
      <AppModal visible={modalVisible}>
        {/* <View style={styles.overlay}> */}
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Seleccionar sensor</Text>

          <FlatList
            data={sensorsMock}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.sensorRow}
                onPress={() => selectSensor(item)}
              >
                <View>
                  <Text style={styles.sensorTitle}>{item.name}</Text>

                  <Text style={styles.sensorMeta}>
                    🔋 {item.battery}% 📡 {item.signal} dBm
                  </Text>
                </View>

                {activeSensor.id === item.id && (
                  <Text style={styles.check}>✓</Text>
                )}
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity style={styles.addButton}>
            <Text style={styles.addText}>+ Vincular nuevo sensor</Text>
          </TouchableOpacity>
        </View>
        {/* </View> */}
      </AppModal>
    </>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    selector: {
      backgroundColor: theme.cardBackground,
      padding: 14,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },

    label: {
      color: theme.gray,
    },

    sensorName: {
      fontWeight: "600",
      color: theme.fontBlue,
    },

    chevron: {
      marginLeft: "auto",
      color: theme.gray,
    },

    overlay: {
      flex: 1,
      justifyContent: "center",
      backgroundColor: theme.modalOverlay,
      paddingHorizontal: 20,
    },

    modal: {
      backgroundColor: theme.cardBackground,
      borderRadius: 16,
      padding: 20,
    },

    modalTitle: {
      fontSize: 18,
      marginBottom: 16,
      color: "white",
      fontWeight: "600",
    },

    sensorRow: {
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomColor: theme.border,
      borderBottomWidth: 1,
    },

    sensorTitle: {
      color: "white",
      fontSize: 16,
    },

    sensorMeta: {
      color: theme.gray,
      marginTop: 3,
    },

    check: {
      color: theme.green,
      fontSize: 20,
    },

    addButton: {
      marginTop: 16,
      padding: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.blue,
      alignItems: "center",
    },

    addText: {
      color: theme.fontBlue,
      fontWeight: "600",
    },
  });
