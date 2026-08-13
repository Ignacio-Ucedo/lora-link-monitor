import { View, StyleSheet } from "react-native";
import { useCommissioning } from "@/hooks/commissioning-context";
import { useTheme } from "@/hooks/use-theme";
import { ThemedText } from "./themed-text";

const STEPS = [
  { id: "gateway_setup", label: "Gateway" },
  { id: "node_connect", label: "Nodo" },
  { id: "node_config",  label: "Config" },
  { id: "verify_link",  label: "Enlace" },
  { id: "gps",          label: "GPS" },
  { id: "complete",     label: "Listo" },
] as const;

type StepId = typeof STEPS[number]["id"];

// New steps that share a dot with an existing step
const STEP_ALIASES: Record<string, string> = {
  gateway_identify: "gateway_setup",
  node_identify:    "node_connect",
};

function stepIndex(id: StepId | string): number {
  const resolved = STEP_ALIASES[id] ?? id;
  return STEPS.findIndex((s) => s.id === resolved);
}

export function WizardProgress() {
  const { state } = useCommissioning();
  const theme = useTheme();
  const current = stepIndex(state.step);

  return (
    <View style={[styles.bar, { backgroundColor: theme.eventsCard, borderBottomColor: theme.border }]}>
      {STEPS.map((step, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <View key={step.id} style={styles.step}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: done
                    ? theme.green
                    : active
                    ? theme.blue
                    : theme.border,
                },
              ]}
            />
            <ThemedText
              style={{
                fontSize: 9,
                color: active ? theme.blue : done ? theme.green : theme.gray,
                marginTop: 3,
              }}
            >
              {step.label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  step: {
    alignItems: "center",
    gap: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
