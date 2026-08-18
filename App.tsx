import { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts, NotoSansMyanmar_400Regular, NotoSansMyanmar_500Medium, NotoSansMyanmar_600SemiBold, NotoSansMyanmar_700Bold } from "@expo-google-fonts/noto-sans-myanmar";
import { RootNavigator } from "@/navigation/RootNavigator";
import { bootstrapAuth, subscribeToUnauthorized } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { hasLanguageHydrated, onLanguageHydrated } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

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
  const [fontsLoaded] = useFonts({
    NotoSansMyanmar_400Regular,
    NotoSansMyanmar_500Medium,
    NotoSansMyanmar_600SemiBold,
    NotoSansMyanmar_700Bold,
  });
  const isAuthBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const [languageHydrated, setLanguageHydrated] = useState(hasLanguageHydrated());

  useEffect(() => {
    bootstrapAuth();
    return subscribeToUnauthorized();
  }, []);

  useEffect(() => {
    if (languageHydrated) return;
    return onLanguageHydrated(() => setLanguageHydrated(true));
  }, [languageHydrated]);

  const isReady = fontsLoaded && !isAuthBootstrapping && languageHydrated;

  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!isReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer theme={navigationTheme}>
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="light" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
