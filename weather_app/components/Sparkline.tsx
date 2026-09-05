import { useState } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

// El tiempo como dimensión de primer nivel: línea de acento a 0.9 con relleno
// degradado 0.12 → 0 (docs/UX_REDESIGN.md, anexo C).
export function Sparkline({
  values,
  color,
  height = 64,
}: {
  values: number[];
  color: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);

  let line = "";
  let area = "";
  if (width > 0 && values.length >= 2) {
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    // Rango visual mínimo de 2°: el jitter del sensor (±0.1°) no debe
    // dibujarse como montaña.
    const range = Math.max(dataMax - dataMin, 2);
    const mid = (dataMin + dataMax) / 2;
    const min = mid - range / 2;
    const pad = 4;
    const stepX = width / (values.length - 1);
    line = values
      .map((v, i) => {
        const x = i * stepX;
        const y = pad + (height - 2 * pad) * (1 - (v - min) / range);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    area = `${line} L${width},${height} L0,${height} Z`;
  }

  return (
    <View
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {line !== "" && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.12} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#sparkfill)" />
          <Path
            d={line}
            stroke={color}
            strokeOpacity={0.9}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Svg>
      )}
    </View>
  );
}
