import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { AuthScreenShell } from "@/components/auth/AuthScreenShell";
import { AuthHero } from "@/components/auth/AuthHero";
import { AuthButton, Rise } from "@/components/auth/AuthParts";
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

  /*
   * SessionOffline.dc.html: the sign-in artwork drained of colour, a cloud
   * badge and the title on its bottom edge, the reassurance under it, and the
   * two ways forward pinned to the foot of the screen — white Retry (the one
   * thing to do) over a quiet Log out.
   */
  return (
    <AuthScreenShell
      footer={
        <View style={styles.actions}>
          <AuthButton
            title={t.common.retry}
            icon="refresh-outline"
            variant="play"
            loading={checking}
            onPress={() => {
              void retry();
            }}
          />
          <AuthButton
            title={t.common.logOut}
            icon="log-out-outline"
            variant="secondary"
            disabled={checking}
            onPress={() => {
              void logout();
            }}
          />
        </View>
      }
    >
      <AuthHero size="offline" muted>
        <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="cloud-offline-outline" size={26} color={theme.colors.text} />
        </View>
        <ThemedText variant="display" accessibilityRole="header" style={styles.title}>
          {t.auth.offline.title}
        </ThemedText>
      </AuthHero>

      <View style={styles.page}>
        <ThemedText variant="body" color={theme.colors.textBody} style={styles.body}>
          {t.auth.offline.body}
        </ThemedText>
        {stillOffline && !checking ? (
          <Rise style={styles.still}>
            <View style={styles.stillRow} accessibilityLiveRegion="polite">
              {/* Amber: a nudge to check the connection, not a failure of the app. */}
              <Ionicons name="alert-circle-outline" size={18} color={theme.colors.warning} style={styles.stillIcon} />
              <ThemedText variant="muted" color={theme.colors.textMuted} style={styles.stillText}>
                {t.auth.offline.stillOffline}
              </ThemedText>
            </View>
          </Rise>
        ) : null}
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    // White at 12% over the drained art (the board's frosted disc, without the blur).
    backgroundColor: theme.colors.tonal,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { marginTop: 18 },
  page: { paddingHorizontal: theme.layout.screenPadding },
  body: { marginTop: theme.spacing.sm },
  still: {
    marginTop: 20,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  stillRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stillIcon: { marginTop: 1 },
  stillText: { flex: 1 },
  actions: { gap: 12 },
});
