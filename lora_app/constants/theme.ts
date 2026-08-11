/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
    cardBackground: "#e8e8e8",
    navBakground: "#c2c2c2",
    radioLogo: "#fff",
    border: "#141924",
    buttonBackground: "#fff",
    turquoise: "#19bdcb",
    gray: "#838383",
    red: "#fa5151",
    green: "#4fd363",
    blue: "#4f88d3",
    brightBlue: "#4FA3FF",
    fontBlue: "#7fd3ff",
    gridGray: "#444",
    eventsCard: "#1419248e",
    modalOverlay: "#00000080",
  },
  dark: {
    text: "#ECEDEE",
    background: "#0f121d",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    cardBackground: "#1c2330",
    navBakground: "#10141e",
    radioLogo: "#fff",
    border: "#2b3243",
    buttonBackground: "#1d2639",
    turquoise: "#19bdcb",
    gray: "#9aa4b5",
    red: "#fa5151",
    green: "#4fd363",
    blue: "#4f88d3",
    brightBlue: "#4FA3FF",
    fontBlue: "#7fd3ff",
    gridGray: "#444",
    eventsCard: "#161b28",
    modalOverlay: "#00000080",
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
