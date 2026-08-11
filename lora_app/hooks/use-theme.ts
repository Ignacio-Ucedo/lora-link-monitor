import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export const useTheme = () => {
  const colorScheme = useColorScheme() ?? "light";
  return Colors[colorScheme];
};
