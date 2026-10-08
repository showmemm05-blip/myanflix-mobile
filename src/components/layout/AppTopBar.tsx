import type { ReactNode } from "react";
import { Pressable, View, StyleSheet, type LayoutChangeEvent } from "react-native";
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
  /**
   * The tab root's own name IN the control row, in place of the wordmark —
   * the Media tab's "Media" (26/32 black, the media-page boards). Spoken as
   * the screen's header.
   */
  heading?: string;
  subtitle?: string;
  /** Small uppercase line above the title. */
  eyebrow?: string;
  /** Extra controls between the wordmark and the notification bell. */
  trailing?: ReactNode;
  /** Row pinned below the bar — search field, segmented control, chips. */
  children?: ReactNode;
  /**
   * Lays the bar OVER artwork (a hero) instead of on the ground: absolutely
   * positioned, clear, with a soft top scrim so the wordmark, bell and avatar
   * stay legible on any image.
   */
  transparent?: boolean;
  /** The bar's whole box — see AppBar's `onLayout`. */
  onLayout?: (event: LayoutChangeEvent) => void;
  /** With `transparent` or `floating`: touches in the bar's empty space reach the page under it — see AppBar's `touchThrough`. */
  touchThrough?: boolean;
  /**
   * Over the page, which scrolls under it, instead of in the layout flow —
   * the glass bar (components/layout/GlassBar). See AppBar's `floating`.
   */
  floating?: boolean;
}

/**
 * Header for TAB ROOT screens (Marquee): a 6×24 crimson bar + the white
 * "MyanFlix" wordmark (or the tab's own `heading`), the bell with a crimson
 * unread dot, and the 32pt profile avatar — over the shared AppBar, so roots
 * and pushed screens are one system.
 */
export function AppTopBar({
  title,
  heading,
  subtitle,
  eyebrow,
  trailing,
  children,
  transparent,
  onLayout,
  touchThrough,
  floating,
}: Props) {
  const navigation = useNavigation<Navigation>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const unreadQuery = useUnreadNotificationCount();
  const hasUnread = (unreadQuery.data ?? 0) > 0;

  return (
    <AppBar
      variant={transparent ? "transparent" : title || subtitle || eyebrow ? "large" : "compact"}
      title={title}
      subtitle={subtitle}
      eyebrow={eyebrow}
      onLayout={onLayout}
      touchThrough={touchThrough}
      floating={floating}
      leading={
        heading ? (
          <ThemedText
            weight="black"
            accessibilityRole="header"
            numberOfLines={1}
            maxFontSizeMultiplier={HEADING_MAX_SCALE}
            style={[styles.heading, MYANMAR_SCRIPT.test(heading) ? styles.headingMyanmar : styles.headingLatin]}
          >
            {heading}
          </ThemedText>
        ) : (
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
            <ThemedText variant="title" weight="black" style={styles.logo}>
              {t.common.appName}
            </ThemedText>
          </Pressable>
        )
      }
      trailing={
        <>
          {trailing}
          <AppBarAction
            icon="notifications-outline"
            onPress={() => navigation.navigate("Notifications")}
            accessibilityLabel={hasUnread ? t.notifications.titleUnread : t.notifications.title}
            badge={hasUnread}
            // Bare on the ground AND over a hero: the boards draw the root
            // bar's bell as a plain glyph either way.
            bare
            overlay={transparent}
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
                <ThemedText variant="label" weight="extrabold" color={theme.colors.onAvatar} style={styles.avatarInitials}>
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

/** A heading this short still has to leave room for three 44pt controls at 2× text on a 320pt phone. */
const HEADING_MAX_SCALE = 1.4;
/** ThemedText's own test: Burmese is never tracked, and needs its taller line. */
const MYANMAR_SCRIPT = /[\u1000-\u109F\uAA60-\uAA7F]/;

const styles = StyleSheet.create({
  /** The board: 26/32 black, -0.03em, 16pt from the edge (the row's 8 + 8). */
  heading: { fontSize: 26, paddingLeft: theme.spacing.sm, flexShrink: 1 },
  headingLatin: { lineHeight: 32, letterSpacing: -0.78 },
  headingMyanmar: { lineHeight: 40, letterSpacing: 0 },
  /** The row's 8pt inset + this 8 = the design's 16pt to the crimson bar. */
  logoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: theme.layout.minTouch,
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
  },
  /** DesignSystem: 6×24, radius 2, crimson. */
  logoMark: {
    width: 6,
    height: 24,
    borderRadius: 2,
    backgroundColor: theme.colors.brand,
  },
  /** 22/28, black, tight — white; the crimson lives in the bar beside it. */
  logo: { fontSize: 22, lineHeight: 28, letterSpacing: -0.66, color: theme.colors.text },
  avatarButton: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  /** 32pt, with the design's 1pt white-at-12% inner ring. */
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.tonal },
  avatarFallback: { backgroundColor: theme.colors.avatar, alignItems: "center", justifyContent: "center" },
  /** Initials are Latin capitals; no tracking at this size. */
  avatarInitials: { letterSpacing: 0 },
});
