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
  /**
   * The owner's choice (2026-10-05): the iPhone-style push everywhere — the
   * new page slides in while the old one drifts back and dims. Android only
   * (iOS already uses its own native push for this value).
   */
  animation: "ios_from_right",
  animationDuration: 260,
};

/**
 * Title pages — MovieDetails, SeriesDetails, BookDetails (2026-10-05): the
 * page fades in while rising a little, calmer and more cinematic than a
 * side slide. animationDuration is honoured on iOS; Android uses its own.
 */
export const titleScreenOptions: NativeStackNavigationOptions = {
  animation: "fade_from_bottom",
  animationDuration: 320,
};

/** Modal-presented screens (Subscribe) — same background, sheet-style entrance. */
export const modalScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  presentation: "modal",
  contentStyle: { backgroundColor: theme.colors.background },
  animation: "slide_from_bottom",
};
