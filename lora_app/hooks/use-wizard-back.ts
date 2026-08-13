import { useEffect } from "react";
import { BackHandler } from "react-native";
import { router, useNavigation } from "expo-router";
import { useCommissioning } from "./commissioning-context";
import type { CommissioningStep } from "@/lib/models";

/**
 * Intercepts Android back on wizard screens.
 * Works both when the stack has history (normal flow) and when the app
 * was killed and relaunched (fresh single-screen stack).
 */
export function useWizardBack(stepOnBack: CommissioningStep, routeOnBack: string) {
  const navigation = useNavigation();
  const { goTo } = useCommissioning();

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      goTo(stepOnBack);
      if (navigation.canGoBack()) {
        router.back();
      } else {
        router.replace(routeOnBack as any);
      }
      return true;
    });
    return () => sub.remove();
  }, [navigation, goTo, stepOnBack, routeOnBack]);
}
