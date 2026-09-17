import type { ReactNode } from "react";
import { Pressable, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBar, AppBarAction } from "@/components/layout/AppBar";
import { ThemedText } from "@/components/ui/ThemedText";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import { displayNameOf, initials } from "@/utils/format";
import type { MainTabParamList, RootStackParamList } from "@/navigation/types";

type Navigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  /** Large page title under the wordmark row (Home leaves this empty). */
  title?: string;
  subtitle?: string;
  /** Small uppercase line above the title. */
  eyebrow?: string;
  /** Extra controls between the wordmark and the notification bell. */
  trailing?: ReactNode;
  /** Row pinned below the bar — search field, segmented control, chips. */
  children?: ReactNode;
}

/**
 * Header for TAB ROOT screens: crimson wordmark (the only place brand red is
 * used), notifications with an unread dot, and the profile avatar — over the
 * shared AppBar, so roots and pushed screens are one system.
 */
export function AppTopBar({ title, subtitle, eyebrow, trailing, children }: Props) {
  const navigation = useNavigation<Navigation>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const unreadQuery = useUnreadNotificationCount();
  const hasUnread = (unreadQuery.data ?? 0) > 0;

  return (
    <AppBar
      variant={title || subtitle || eyebrow ? "large" : "compact"}
      title={title}
      subtitle={subtitle}
      eyebrow={eyebrow}
      leading={
        <Pressable
          /**
           * `pop: true` is what makes the wordmark keep its promise. In
           * react-navigation 7, `navigate` reuses a route only when its name
           * matches the CURRENTLY FOCUSED one; with a movie page open on the
           * Home stack, plain navigate pushed a SECOND Home on top of it, so
           * back revealed a stale detail page. `pop: true` pops the Home stack
           * back to the Home already in it. (The bell and avatar below need no
           * flag: they push onto the ROOT stack, above the tabs.)
           */
          onPress={() => navigation.navigate("HomeTab", { screen: "Home", pop: true })}
          style={styles.logoButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t.common.appName}
        >
          <View style={styles.logoMark} />
          <ThemedText variant="section" weight="bold" style={styles.logo}>
            {t.common.appName}
          </ThemedText>
        </Pressable>
      }
      trailing={
        <>
          {trailing}
          <AppBarAction
            icon="notifications-outline"
            onPress={() => navigation.navigate("Notifications")}
            accessibilityLabel={t.notifications.title}
            badge={hasUnread}
          />
          <Pressable
            style={styles.avatarButton}
            onPress={() => navigation.navigate("Profile")}
            accessibilityRole="button"
            accessibilityLabel={t.nav.profile}
          >
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <ThemedText variant="caption" weight="bold">
                  {/* Same avatar as the profile hero, so the same name rule. */}
                  {initials(displayNameOf(user))}
                </ThemedText>
              </View>
            )}
          </Pressable>
        </>
      }
    >
      {children}
    </AppBar>
  );
}

const styles = StyleSheet.create({
  logoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: theme.layout.minTouch,
    paddingRight: theme.spacing.sm,
  },
  logoMark: {
    width: 4,
    height: 18,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brand,
  },
  /** The wordmark is the ONLY element allowed to use the crimson brand colour. */
  logo: { color: theme.colors.brand, letterSpacing: 0.2 },
  avatarButton: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: 32, height: 32, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.borderStrong },
  avatarFallback: { backgroundColor: theme.colors.secondary, alignItems: "center", justifyContent: "center" },
});
