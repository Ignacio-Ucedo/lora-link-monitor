import { useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Colors } from "@/constants/theme";

type Props = {
  directionDeg: number;
  speedKmh: number;
};

export function WindGauge({ directionDeg, speedKmh }: Props) {
  const rotation = useSharedValue(directionDeg);

  useEffect(() => {
    rotation.value = withTiming(directionDeg, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [directionDeg, rotation]);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.compass}>
        <Text style={styles.north}>N</Text>
        <Animated.View style={[styles.arrow, arrowStyle]}>
          <View style={styles.arrowHead} />
          <View style={styles.arrowTail} />
        </Animated.View>
        <Text style={styles.speed}>{speedKmh.toFixed(1)}</Text>
        <Text style={styles.unit}>km/h</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  compass: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  north: {
    position: "absolute",
    top: 6,
    fontSize: 10,
    color: Colors.accent,
    fontWeight: "700",
  },
  arrow: {
    alignItems: "center",
    height: 60,
    justifyContent: "center",
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: Colors.accent,
  },
  arrowTail: {
    width: 2,
    height: 20,
    backgroundColor: Colors.textMuted,
  },
  speed: {
    position: "absolute",
    bottom: 10,
    fontSize: 11,
    color: Colors.text,
    fontWeight: "600",
  },
  unit: {
    display: "none",
  },
});
