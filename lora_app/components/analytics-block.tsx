import { useState } from "react";
import { View } from "react-native";
import { Chart } from "./chart";
import { Metric } from "./metric";
import { RangeButton } from "./range-button";
import { ThemedCard } from "./themed-card";

export function AnalyticsBlock() {
  const [range, setRange] = useState<"today" | "7d" | "30d">("today");

  return (
    <ThemedCard gap={18}>
      {/* Range selector */}
      <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
        <RangeButton
          label="30 días"
          active={range === "30d"}
          onPress={() => setRange("30d")}
        />
        <RangeButton
          label="7 días"
          active={range === "7d"}
          onPress={() => setRange("7d")}
        />
        <RangeButton
          label="Hoy"
          active={range === "today"}
          onPress={() => setRange("today")}
        />
      </View>

      {/* Chart*/}

      <Chart range={range}></Chart>

      {/* Aggregates */}
      <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
        <Metric label="Intensidad" value="4,8" unit="mm/h" />
        <Metric label="Promedio/día" value="6,8" unit="mm" />
      </View>
    </ThemedCard>
  );
}
