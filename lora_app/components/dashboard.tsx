import { StyleSheet } from "react-native";

import { AnalyticsBlock } from "@/components/analytics-block";
import { AppButton } from "@/components/app-button";
import { EventItem } from "@/components/event-item";
import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Alert, View } from "react-native";

import SensorSelector from "@/components/sensor-selector";
import { useTheme } from "@/hooks/use-theme";
import { ScrollView } from "react-native";
import Separator from "./separator";

export default function Dashboard() {
  const theme = useTheme();
  const styles = createStyles(theme);

  const handlePress = () => {
    Alert.alert("!Tocaste el botón!");
  };

  const events = [
    {
      title: "Lluvia intensa detectada",
      time: "23/04 · 18:32",
      value: "12.4 mm/h",
    },
    {
      title: "Sin datos (2h)",
      time: "22/04 · 04:00 → 06:00",
      value: null,
    },
    {
      title: "Sin datos (2h)",
      time: "22/04 · 04:00 → 06:00",
      value: null,
    },
    {
      title: "Sin datos (2h)",
      time: "22/04 · 04:00 → 06:00",
      value: null,
    },
    {
      title: "Sin datos (2h)",
      time: "22/04 · 04:00 → 06:00",
      value: null,
    },
  ];

  return (
    <>
      <View style={styles.headerContainer}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
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
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <ThemedText type="title">Base</ThemedText>
              <ThemedText type="title" style={{ color: theme.fontBlue }}>
                {" "}
                Lora123
              </ThemedText>
            </View>
          </View>
          <AppButton onPress={handlePress} padding={0}>
            <IconSymbol
              style={{ padding: 4 }}
              size={22}
              name="gearshape.fill"
              color={theme.blue}
            />
          </AppButton>
        </View>
        <Separator></Separator>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: "4",
            }}
          >
            <IconSymbol
              name="dot.radiowaves.right"
              color={theme.blue}
              size={12}
            ></IconSymbol>
            <ThemedText style={{ color: theme.gray }}>
              Sensores activos: 3/3
            </ThemedText>
          </View>
          <View
            style={{ gap: 2, flexDirection: "row", alignItems: "flex-end" }}
          >
            <ThemedText style={{ color: theme.gray }}>58%</ThemedText>
            <IconSymbol
              name="battery.100"
              size={16}
              color={theme.blue}
            ></IconSymbol>
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.mainContainer}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <SensorSelector></SensorSelector>

            <AppButton
              backgroundColor={theme.cardBackground}
              onPress={handlePress}
              padding={0}
              style={{ aspectRatio: "1/1" }}
            >
              <IconSymbol
                style={{ padding: 4, alignSelf: "center" }}
                size={22}
                name="slider.horizontal.3"
                color={theme.fontBlue}
              />
            </AppButton>
          </View>
        </View>
        {/*summary section down below*/}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ThemedCard gap={10} style={{ flex: 1 }}>
            <View
              style={[
                {
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                  paddingBottom: 4,
                },
              ]}
            >
              <ThemedText type="cardTitle">Hoy</ThemedText>
            </View>

            <ThemedText style={{ color: theme.gray }}>
              Precipitación Total
            </ThemedText>
            <View
              style={[{ gap: 8, flexDirection: "row", alignItems: "flex-end" }]}
            >
              <IconSymbol
                name="drop.triangle"
                color={theme.turquoise}
              ></IconSymbol>
              <ThemedText
                style={{ fontSize: 32, fontWeight: "300", lineHeight: 36 }}
              >
                24,7
              </ThemedText>
              <ThemedText
                style={{ fontSize: 24, lineHeight: 24, fontWeight: "300" }}
              >
                mm
              </ThemedText>
            </View>
            <View
              style={{ gap: 4, flexDirection: "row", alignItems: "center" }}
            >
              <IconSymbol
                name="smallcircle.fill.circle.fill"
                color={theme.green}
                size={10}
              ></IconSymbol>
              <ThemedText style={{ color: theme.gray, fontSize: 12 }}>
                Última lectura: hace 3 min
              </ThemedText>
            </View>
          </ThemedCard>

          <ThemedCard gap={10} style={{ width: "40%" }}>
            <View
              style={[
                {
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                  paddingBottom: 4,
                },
              ]}
            >
              <ThemedText type="cardTitle">Sensor</ThemedText>
            </View>

            <View style={{ justifyContent: "space-between", flex: 1 }}>
              <View style={{ gap: 4 }}>
                <ThemedText style={{ color: theme.gray }}> Estado</ThemedText>
                <View style={styles.statusContainer}>
                  <IconSymbol
                    name="checkmark.shield.fill"
                    size={16}
                    color={theme.green}
                  ></IconSymbol>
                  <ThemedText color={theme.green}>Activo</ThemedText>
                </View>
              </View>

              <View
                style={[
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  },
                ]}
              >
                <View
                  style={[
                    { gap: 2, flexDirection: "row", alignItems: "center" },
                  ]}
                >
                  <IconSymbol
                    name="battery.100"
                    size={16}
                    color={theme.green}
                  ></IconSymbol>
                  <ThemedText style={{ fontSize: 12 }}>78%</ThemedText>
                </View>

                <View
                  style={[
                    { gap: 2, flexDirection: "row", alignItems: "center" },
                  ]}
                >
                  <IconSymbol
                    name="radiowaves.right"
                    size={16}
                    color={theme.green}
                  ></IconSymbol>
                  <ThemedText style={{ fontSize: 12 }}>-78 dBm</ThemedText>
                </View>
              </View>
            </View>
          </ThemedCard>
        </View>

        <AnalyticsBlock />

        {/* Events block down below */}
        <View style={{ maxHeight: 200, gap: 10 }}>
          <ThemedText type="cardTitle">Historial de Eventos</ThemedText>

          <ScrollView
            nestedScrollEnabled
            style={{
              backgroundColor: theme.eventsCard,
              padding: 8,
              borderRadius: 12,
            }}
          >
            {events.map((event, index) => (
              <View key={index}>
                <EventItem {...event} />
                {index < events.length - 1 && <Separator />}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    headerContainer: {
      gap: 18,
      padding: 18,
      borderBottomWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.eventsCard,
    },
    mainContainer: {
      padding: 18,
      rowGap: 20,
    },

    statusContainer: {
      flexDirection: "row",
      gap: 4,
      alignItems: "center",
      backgroundColor: theme.buttonBackground,
      borderRadius: 12,
      padding: 4,
      paddingRight: 8,
      alignSelf: "flex-start",
    },
  });
