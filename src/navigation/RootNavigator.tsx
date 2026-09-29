import { useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthNavigator } from "@/navigation/AuthNavigator";
import { SessionOfflineScreen } from "@/screens/Auth/SessionOffline";
import { MainTabNavigator } from "@/navigation/MainTabNavigator";
import { PlayerScreen } from "@/screens/Player/Player";
import { BookReaderScreen } from "@/screens/Books/BookReader";
import { NotificationsScreen } from "@/screens/Notifications/Notifications";
import { ProfileOverviewScreen } from "@/screens/Profile/ProfileOverview";
import { useRealtimeWallet } from "@/hooks/useRealtimeWallet";
import { useAuthStore } from "@/store/authStore";
import { hydrateReaderPrefs } from "@/store/readerPrefsStore";
import { stackScreenOptions } from "@/navigation/options";
import type { RootStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  // Only this slice, not the whole useAuth() bundle: that hook also subscribes
  // to `user`, so every rename and avatar upload re-rendered the navigator.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const sessionUnreachable = useAuthStore((s) => s.sessionUnreachable);
  useRealtimeWallet();

  /**
   * Reader prefs hydrate HERE, not in BookReader, because the reader stopped
   * being the only consumer: BookDetails reads `readingLanguage` to choose the
   * edition it opens, and writes it when the user changes language. Armed only
   * by the reader, the first book of a session got edition[0] instead of the
   * saved language, that screen's write was dropped (the flusher bails until
   * something has hydrated), and after a logout the next account's choice was
   * written into the previous account's blob — re-running this on [userId]
   * repoints the write key the moment the user changes.
   *
   * Cost is one small AsyncStorage read, and it is off the splash path:
   * App.tsx renders null until its isReady gate passes, so this navigator
   * mounts after first paint with auth bootstrapping already resolved.
   */
  useEffect(() => {
    void hydrateReaderPrefs(userId);
  }, [userId]);

  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          {/*
           * No entrance animation, deliberately. Picking an episode from a
           * series page opens this screen, and with the stack's default slide
           * that read as leaving one page for another instead of simply
           * starting that episode. The player is a full-bleed black surface
           * either way, so appearing instantly costs nothing visually and
           * removes 260ms of waiting from every episode start.
           *
           * Picking the NEXT episode while watching no longer comes through
           * here at all: Player.handleSelectEpisode swaps the episode inside
           * the mounted screen and only rewrites this route's params, because
           * the `replace` it used to do tore the whole player down and read as
           * a page refresh.
           */}
          <Stack.Screen
            name="Player"
            component={PlayerScreen}
            options={{ presentation: "fullScreenModal", animation: "none" }}
          />
          <Stack.Screen name="BookReader" component={BookReaderScreen} options={{ presentation: "fullScreenModal" }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Profile" component={ProfileOverviewScreen} />
        </>
      ) : sessionUnreachable ? (
        // A saved session the server could not be asked about yet — kept,
        // with a retry, rather than thrown away for the sign-in screen (H-20).
        <Stack.Screen name="SessionOffline" component={SessionOfflineScreen} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}
