import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { RootNavigator } from "@/navigation/RootNavigator";
import { AppErrorBoundary } from "@/components/common/AppErrorBoundary";
import { bootstrapAuth, subscribeToUnauthorized } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { hasLanguageHydrated, onLanguageHydrated } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import { ApiError } from "@/utils/errors";

/**
 * The app face, required by FILE rather than imported from
 * "@expo-google-fonts/noto-sans-myanmar". That package's generated index.js
 * `require()`s all nine weights it ships and Metro does no tree shaking, so
 * importing anything from its root — `useFonts` included — bundles 1.6 MB of
 * TTF to load the four faces below. `useFonts` therefore comes from expo-font
 * directly; the google-fonts one is only a thin wrapper over its `loadAsync`
 * and has the identical `[loaded, error]` contract. The package declares no
 * `exports` map, so these per-weight subpaths are legal.
 *
 * These four faces are what `theme.font` names, so every `ThemedText` in the
 * app depends on them. Adding a weight to `theme.font` means adding it here.
 */
const NotoSansMyanmar_400Regular = require("@expo-google-fonts/noto-sans-myanmar/400Regular/NotoSansMyanmar_400Regular.ttf");
const NotoSansMyanmar_500Medium = require("@expo-google-fonts/noto-sans-myanmar/500Medium/NotoSansMyanmar_500Medium.ttf");
const NotoSansMyanmar_600SemiBold = require("@expo-google-fonts/noto-sans-myanmar/600SemiBold/NotoSansMyanmar_600SemiBold.ttf");
const NotoSansMyanmar_700Bold = require("@expo-google-fonts/noto-sans-myanmar/700Bold/NotoSansMyanmar_700Bold.ttf");

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * The defaults every hook inherits. Both of these were previously React
 * Query's own, and neither of React Query's own suits this app:
 *
 * - `staleTime: 0` meant ~22 hooks that never set their own refetched on every
 *   mount, so re-opening a title ten seconds later re-issued the movie, the
 *   subscription and the comments. This is a FLOOR: the 18 hooks that state a
 *   deliberate window (30s for search, Infinity for the signed playlist) still
 *   win, and `invalidateQueries` refetches active queries regardless of it, so
 *   nothing a mutation touches goes stale-by-surprise.
 * - `retry: 3` treats an answer as a blip. `api/client.ts` throws an ApiError
 *   for every non-2xx envelope, so a 401/403/404 was retried three times with
 *   backoff — ~7s of doomed requests on a session expiry instead of one.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) =>
        failureCount < 2 &&
        !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

/**
 * React Query's `refetchOnWindowFocus` is on by default and means nothing in
 * React Native — there is no window to focus, and nothing here ever taught it
 * otherwise, so it was dead code. AppState is the equivalent signal.
 *
 * Why it is worth turning on: every screen in this app is long-lived (the tab
 * roots stay mounted, the player is never unmounted), so "refetch on mount"
 * stops firing after the first pass through the app. Without this, the wallet
 * balance and the unread badge keep showing whatever they held when the phone
 * went in a pocket. This only pays off next to the `staleTime` floor above —
 * on its own it would fire a request per mounted query every time the app came
 * forward; with the floor, anything fetched in the last 30s is left alone.
 */
function onAppStateChange(status: AppStateStatus) {
  focusManager.setFocused(status === "active");
}

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    primary: theme.colors.primary,
    text: theme.colors.text,
    border: theme.colors.border,
  },
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansMyanmar_400Regular,
    NotoSansMyanmar_500Medium,
    NotoSansMyanmar_600SemiBold,
    NotoSansMyanmar_700Bold,
  });
  const isAuthBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const [languageHydrated, setLanguageHydrated] = useState(hasLanguageHydrated());

  useEffect(() => {
    bootstrapAuth();
    // The forced-logout path clears the query cache as well as the auth store,
    // and it runs outside React — so it is handed the one client this module
    // owns (the same instance QueryClientProvider below publishes).
    return subscribeToUnauthorized(queryClient);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (languageHydrated) return;
    return onLanguageHydrated(() => setLanguageHydrated(true));
  }, [languageHydrated]);

  // The error arm matters: expo-font leaves `loaded` false FOREVER when
  // loadAsync rejects (it only sets the error), and this flag gates first
  // paint and SplashScreen.hideAsync. Falling back to the system face is
  // strictly better than an app that never starts.
  const isReady = (fontsLoaded || !!fontError) && !isAuthBootstrapping && languageHydrated;

  // NOT an onLayout handler, despite the Expo recipe this came from: the tree
  // below returns null until `isReady`, so the root view cannot lay out while
  // the splash is still the thing on screen. Hide it the moment fonts, auth
  // bootstrap and language hydration have all landed.
  useEffect(() => {
    if (isReady) SplashScreen.hideAsync().catch(() => {});
  }, [isReady]);

  if (!isReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          {/* Inside the providers, outside the navigator: the fallback still
              gets the language store, the query client and the safe-area
              insets, and a render throw anywhere in the app costs the screen
              instead of the whole root. */}
          <AppErrorBoundary>
            <NavigationContainer theme={navigationTheme}>
              <RootNavigator />
            </NavigationContainer>
          </AppErrorBoundary>
          <StatusBar style="light" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
