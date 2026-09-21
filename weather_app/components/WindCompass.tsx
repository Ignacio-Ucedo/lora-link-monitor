import { View } from "react-native";
import Svg, { Circle, G, Line, Polygon } from "react-native-svg";

// Rosa de 16 rumbos → grados (0 = N, sentido horario). Rótulos en español, como
// los envía el firmware (O = Oeste).
const ROSE: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
  E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSO: 202.5, SO: 225, OSO: 247.5,
  O: 270, ONO: 292.5, NO: 315, NNO: 337.5,
};

// Brújula minimal: anillo tenue, ticks cardinales (el Norte marcado con el color
// de acento) y una aguja tipo compás que apunta al rumbo. Sin texto, para que
// conviva con la estética de las tarjetas.
export function WindCompass({
  direction,
  color,
  size = 36,
}: {
  direction: string;
  color: string;
  size?: number;
}) {
  const angle = ROSE[direction] ?? 0;
  const c = size / 2;
  const r = c - 2;

  const ringColor = "rgba(255,255,255,0.14)";
  const tickColor = "rgba(255,255,255,0.28)";

  // Aguja: rombo esbelto. Mitad norte en acento, mitad sur atenuada.
  const halfW = r * 0.16;
  const north = `${c},${c - r * 0.72} ${c + halfW},${c} ${c - halfW},${c}`;
  const south = `${c},${c + r * 0.42} ${c + halfW},${c} ${c - halfW},${c}`;

  const cardinals: [number, boolean][] = [
    [0, true],
    [90, false],
    [180, false],
    [270, false],
  ];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={ringColor} strokeWidth={1.5} fill="none" />

        {cardinals.map(([a, isNorth]) => {
          const rad = (a * Math.PI) / 180;
          const sin = Math.sin(rad);
          const cos = Math.cos(rad);
          const inner = r - (isNorth ? 4.5 : 3);
          return (
            <Line
              key={a}
              x1={c + r * sin}
              y1={c - r * cos}
              x2={c + inner * sin}
              y2={c - inner * cos}
              stroke={isNorth ? color : tickColor}
              strokeWidth={isNorth ? 1.6 : 1.2}
              strokeLinecap="round"
            />
          );
        })}

        <G rotation={angle} origin={`${c}, ${c}`}>
          <Polygon points={north} fill={color} />
          <Polygon points={south} fill="rgba(255,255,255,0.22)" />
        </G>
        <Circle cx={c} cy={c} r={1.6} fill={color} />
      </Svg>
    </View>
  );
}
