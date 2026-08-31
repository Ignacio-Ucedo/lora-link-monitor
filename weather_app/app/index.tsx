import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useWeather } from "@/hooks/WeatherContext";
import { Colors } from "@/constants/theme";

export default function ConnectScreen() {
  const { status, error, connect } = useWeather();
  const router = useRouter();

  useEffect(() => {
    if (status === "connected") {
      router.replace({ pathname: "/dashboard", params: {} });
    }
  }, [status, router]);

  const scanning = status === "scanning";
  const connecting = status === "connecting";
  const busy = scanning || connecting;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🌤</Text>
      <Text style={styles.appName}>WeatherStation</Text>
      <Text style={styles.subtitle}>Conectate a tu estación meteorológica via Bluetooth</Text>

      {busy ? (
        <View style={styles.busyBox}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.busyText}>
            {scanning ? "Buscando WeatherStation…" : "Conectando…"}
          </Text>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={connect}
        >
          <Text style={styles.buttonText}>Conectar</Text>
        </Pressable>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={connect} style={styles.retryButton}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  title: {
    fontSize: 72,
  },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  busyBox: {
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  busyText: {
    color: Colors.textMuted,
    fontSize: 15,
  },
  button: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  errorBox: {
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.red,
    width: "100%",
  },
  errorText: {
    color: Colors.red,
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  retryText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },
});
