import { Fragment } from "react";
import { View } from "react-native";
import Svg, { Line, Path, Text as SvgText } from "react-native-svg";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "./themed-text";

interface SignalChartProps {
  data: number[];
  color: string;
  label: string;
  unit: string;
  yMin?: number;
  yMax?: number;
}

const W = 320;
const H = 80;
const PL = 34;
const PR = 8;
const PT = 8;
const PB = 8;
const GRID_LINES = 3;

export function SignalChart({ data, color, label, unit, yMin, yMax }: SignalChartProps) {
  const theme = useTheme();
  const cW = W - PL - PR;
  const cH = H - PT - PB;

  if (data.length < 2) {
    return (
      <View style={{ marginBottom: 8 }}>
        <ThemedText style={{ color: theme.gray, fontSize: 11, marginBottom: 4 }}>
          {label}
        </ThemedText>
        <View style={{ height: H, justifyContent: "center", alignItems: "center" }}>
          <ThemedText style={{ color: theme.gray, fontSize: 12 }}>
            Esperando datos…
          </ThemedText>
        </View>
      </View>
    );
  }

  const lo = yMin ?? Math.min(...data) - 2;
  const hi = yMax ?? Math.max(...data) + 2;
  const span = hi - lo || 1;

  const toX = (i: number) => PL + (i / (data.length - 1)) * cW;
  const toY = (v: number) => PT + cH - ((v - lo) / span) * cH;

  const d = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(" ");

  const gridVals: number[] = [];
  for (let i = 0; i < GRID_LINES; i++) {
    gridVals.push(lo + (span / (GRID_LINES - 1)) * i);
  }

  return (
    <View style={{ marginBottom: 8 }}>
      <ThemedText style={{ color: theme.gray, fontSize: 11, marginBottom: 4 }}>
        {label} ({unit})
      </ThemedText>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {gridVals.map((v, i) => {
          const y = toY(v);
          return (
            <Fragment key={i}>
              <Line
                x1={PL} y1={y} x2={W - PR} y2={y}
                stroke={theme.gridGray} strokeDasharray="4 4" strokeWidth={0.8}
              />
              <SvgText
                x={PL - 4} y={y + 4}
                fill={theme.gray} fontSize={9} textAnchor="end"
              >
                {Math.round(v)}
              </SvgText>
            </Fragment>
          );
        })}
        <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
