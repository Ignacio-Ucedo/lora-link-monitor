import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { AmbientGradient } from "@/constants/theme";

// Lienzo ambiental: el fondo entero es el clima. Gradiente vertical de dos
// paradas; la superior es siempre casi negra (contraste del héroe garantizado),
// la inferior lleva el matiz térmico. Ver docs/UX_REDESIGN.md, anexo B.
export function AmbientBackground({ gradient }: { gradient: AmbientGradient }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="ambient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={gradient.top} />
            <Stop offset="1" stopColor={gradient.bottom} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#ambient)" />
      </Svg>
    </View>
  );
}
