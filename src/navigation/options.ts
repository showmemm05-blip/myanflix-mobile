import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { theme } from "@/theme";

/**
 * Shared native-stack options. Headers stay off everywhere — every screen
 * renders the shared app bar (components/layout/AppBar) itself — and the scene
 * background is pinned to the theme so pushes never flash a black/white gap.
 * ROUTE NAMES AND PARAMS ARE DEFINED IN navigation/types.ts AND ARE FROZEN.
 */
export const stackScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: theme.colors.background },
  animation: "slide_from_right",
  animationDuration: 260,
};

/** Modal-presented screens (Subscribe) — same background, sheet-style entrance. */
export const modalScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: "modal",
  contentStyle: { backgroundColor: theme.colors.background },
  animation: "slide_from_bottom",
};
