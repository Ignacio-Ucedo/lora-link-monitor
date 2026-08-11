import { useTheme } from "@/hooks/use-theme";
import Svg, { Line, Rect, Text } from "react-native-svg";

type ChartProps = {
  range: "7d" | "30d" | "today";
};

export type RainDataPoint = {
  label: string;
  value: number;
};

export const dataToday: RainDataPoint[] = [
  { label: "01", value: 2 },
  { label: "02", value: 4 },
  { label: "03", value: 3 },
  { label: "04", value: 7 },
  { label: "05", value: 12 },
  { label: "06", value: 6 },
  { label: "07", value: 0 },
  { label: "08", value: 5 },
  { label: "09", value: 9 },
  { label: "10", value: 14 },
  { label: "11", value: 8 },
  { label: "12", value: 3 },
];

export const data7d: RainDataPoint[] = [
  { label: "18", value: 4 },
  { label: "19", value: 9 },
  { label: "20", value: 26 },
  { label: "21", value: 15 },
  { label: "22", value: 5 },
  { label: "23", value: 21 },
  { label: "24", value: 6 },
];

export const data30d: RainDataPoint[] = [
  { label: "1", value: 3 },
  { label: "2", value: 0 },
  { label: "3", value: 5 },
  { label: "4", value: 8 },
  { label: "5", value: 12 },
  { label: "6", value: 4 },
  { label: "7", value: 0 },
  { label: "8", value: 7 },
  { label: "9", value: 9 },
  { label: "10", value: 3 },
  { label: "11", value: 15 },
  { label: "12", value: 18 },
  { label: "13", value: 6 },
  { label: "14", value: 0 },
  { label: "15", value: 2 },
  { label: "16", value: 4 },
  { label: "17", value: 10 },
  { label: "18", value: 6 },
  { label: "19", value: 9 },
  { label: "20", value: 26 },
  { label: "21", value: 15 },
  { label: "22", value: 5 },
  { label: "23", value: 21 },
  { label: "24", value: 6 },
  { label: "25", value: 0 },
  { label: "26", value: 4 },
  { label: "27", value: 7 },
  { label: "28", value: 11 },
  { label: "29", value: 5 },
  { label: "30", value: 2 },
];

export function getDataForRange(range: "7d" | "30d" | "today") {
  switch (range) {
    case "7d":
      return data7d;

    case "30d":
      return data30d;

    case "today":
      return dataToday;
  }
}

export function Chart({ range }: ChartProps) {
  const theme = useTheme();

  const width = 320;
  const height = 160;

  const paddingLeft = 30;
  const paddingBottom = 20;
  const paddingTop = 10;
  const paddingRight = 10;

  const fontSize = 10;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const data = getDataForRange(range);
  const maxValue = Math.max(...data.map((d) => d.value));
  const count = data.length;

  const stepX = chartWidth / count;
  const barWidth = stepX * 0.6;

  const gridCount = 4;
  const stepY = chartHeight / (gridCount - 1);
  const vertLabels: { value: number; y: number }[] = [];

  for (let i = 0; i < gridCount; i++) {
    const value = Math.round((maxValue / (gridCount - 1)) * i);
    const y = paddingTop + chartHeight - stepY * i;

    vertLabels.push({ value, y });
  }

  return (
    <Svg width="100%" height={160}>
      {/* vertical labels */}
      {vertLabels.map((l, i) => (
        <Text
          key={i}
          x={paddingLeft - fontSize}
          y={l.y + fontSize / 3}
          fill={theme.gray}
          fontSize={fontSize}
          textAnchor="middle"
        >
          {l.value}
        </Text>
      ))}

      {/* grid lines */}
      {vertLabels.map((l, i) => (
        <Line
          key={i}
          x1={paddingLeft}
          // y1= {l.y - (fontSize/2)}
          y1={l.y}
          x2={width + paddingRight}
          y2={l.y}
          stroke={theme.gridGray}
          strokeDasharray="4 4"
          fill={theme.gray}
        ></Line>
      ))}

      {/* bars */}
      {data.map((d, i) => {
        const barHeight = (d.value / maxValue) * chartHeight;
        const x = paddingLeft + i * stepX;
        const y = paddingTop + chartHeight - barHeight;

        return (
          <Rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill={theme.brightBlue}
          />
        );
      })}

      {/* horizontal labels */}
      {data.map((d, i) => {
        const barHeight = (d.value / maxValue) * chartHeight;
        const x = paddingLeft + i * stepX;
        const y = paddingTop + chartHeight - barHeight;

        return (
          <Text
            key={i}
            x={x + barWidth / 2}
            y={paddingBottom + chartHeight + paddingTop}
            fill={theme.gray}
            fontSize={fontSize}
            textAnchor="middle"
          >
            {d.label}
          </Text>
        );
      })}
    </Svg>
  );
}
