import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { AuthScreenShell, AuthTicket } from "@/components/auth/AuthScreenShell";
import { Button } from "@/components/ui/Button";
import { ThemedText } from "@/components/ui/ThemedText";
import { restoreSession, useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/localization/LanguageProvider";
import { useAuthStore } from "@/store/authStore";
import { theme } from "@/theme";

/**
 * Shown instead of the sign-in screen when the app starts with a saved session
 * but cannot reach the server to confirm it (audit H-20). The session is kept:
 * "Try again" re-runs the same check the boot ran, and the app opens as soon
 * as it gets an answer. Sending the user to sign in here would cost them a
 * password and an SMS code for what is only a weak signal or a redeploy.
 *
 * It retries on its own when the app comes back to the foreground — the usual
 * cure is switching Wi-Fi or data on in the system settings and coming back.
 * "Log out" stays available for someone who wants to leave anyway.
 */
export function SessionOfflineScreen() {
  const { t } = useLanguage();
  const { logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [stillOffline, setStillOffline] = useState(false);
  const checkingRef = useRef(false);

  const retry = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    try {
      await restoreSession();
    } catch {
      // The keystore itself failed — there is no session left to wait for.
      useAuthStore.getState().clearUser();
    } finally {
      checkingRef.current = false;
      setChecking(false);
      // Still here means still unreachable; on success or a rejected session
      // the navigator has already moved on and this screen is going away.
      setStillOffline(useAuthStore.getState().sessionUnreachable);
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void retry();
    });
    return () => subscription.remove();
  }, [retry]);

  return (
    <AuthScreenShell>
      <AuthTicket
        stub={
          <View style={styles.actions}>
            <Button
              title={t.common.retry}
              icon="refresh-outline"
              size="lg"
              fullWidth
              loading={checking}
              disabled={checking}
              onPress={() => {
                void retry();
              }}
            />
            <Button
              title={t.common.logOut}
              icon="log-out-outline"
              variant="ghost"
              size="lg"
              fullWidth
              disabled={checking}
              onPress={() => {
                void logout();
              }}
            />
          </View>
        }
      >
        <View style={styles.badge}>
          <Ionicons name="cloud-offline-outline" size={22} color={theme.colors.primary} />
        </View>

        <View style={styles.copy}>
          <ThemedText variant="title">{t.auth.offline.title}</ThemedText>
          <ThemedText variant="body" style={styles.body}>
            {t.auth.offline.body}
          </ThemedText>
          {stillOffline && !checking ? (
            <ThemedText variant="caption" style={styles.body} accessibilityLiveRegion="polite">
              {t.auth.offline.stillOffline}
            </ThemedText>
          ) : null}
        </View>
      </AuthTicket>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primary + "3D",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { gap: theme.spacing.sm },
  body: { color: theme.colors.textMuted },
  actions: { gap: theme.spacing.sm },
});
