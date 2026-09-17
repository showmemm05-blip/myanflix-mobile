import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  HomeTab: { active: "home", inactive: "home-outline" },
  SearchTab: { active: "film", inactive: "film-outline" },
  WalletTab: { active: "wallet", inactive: "wallet-outline" },
  LibraryTab: { active: "albums", inactive: "albums-outline" },
  SettingsTab: { active: "settings", inactive: "settings-outline" },
};

const ORDER = ["HomeTab", "SearchTab", "WalletTab", "LibraryTab", "SettingsTab"];

/**
 * Floating glass tab bar — one blurred capsule that hovers above the content,
 * with a violet capsule sliding under the active tab. All five destinations are
 * peers; the whole bar is safe-area aware and every item is a 64pt target.
 */
export function CustomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { t } = useLanguage();
  const bottomOffset = Math.max(insets.bottom, theme.spacing.sm) + theme.spacing.xs;

  const labels: Record<string, string> = {
    HomeTab: t.nav.home,
    SearchTab: t.nav.media,
    WalletTab: t.nav.wallet,
    LibraryTab: t.nav.library,
    SettingsTab: t.profile.settings,
  };

  const goTo = (routeName: string, routeKey: string, focused: boolean) => {
    const event = navigation.emit({ type: "tabPress", target: routeKey, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  return (
    <View style={[styles.wrapper, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.container}>
        <BlurView intensity={70} tint="dark" style={[StyleSheet.absoluteFill, styles.glassClip]} />
        <View style={[StyleSheet.absoluteFill, styles.tint, styles.glassClip]} />
        <View style={styles.row}>
          {ORDER.map((name) => {
            const index = state.routes.findIndex((r) => r.name === name);
            const route = state.routes[index];
            if (!route) return null;
            const focused = state.index === index;

            return (
              <TabItem
                key={route.key}
                icons={ICONS[name]}
                label={labels[name]}
                focused={focused}
                onPress={() => goTo(name, route.key, focused)}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

interface TabItemProps {
  icons: { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap };
  label: string;
  focused: boolean;
  onPress: () => void;
}

function TabItem({ icons, label, focused, onPress }: TabItemProps) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, { damping: 16, stiffness: 240 });
  }, [focused, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.85 + progress.value * 0.15 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -progress.value * 1.5 }] }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: 0.75 + progress.value * 0.25 }));

  const color = focused ? theme.colors.primary : theme.colors.textFaint;

  return (
    <Pressable
      onPress={onPress}
      style={styles.item}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.pill, pillStyle]} pointerEvents="none" />
      <Animated.View style={iconStyle}>
        <Ionicons name={focused ? icons.active : icons.inactive} size={21} color={color} />
      </Animated.View>
      <Animated.View style={labelStyle}>
        <ThemedText variant="caption" weight={focused ? "bold" : "semibold"} numberOfLines={1} style={[styles.label, { color }]}>
          {label}
        </ThemedText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: theme.spacing.md,
    right: theme.spacing.md,
    // Read the token directly — the tab-bar height has one home, the theme.
    height: theme.layout.tabBarHeight,
  },
  container: {
    flex: 1,
    borderRadius: theme.radius["3xl"],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderStrong,
    ...theme.shadow.lg,
  },
  glassClip: { borderRadius: theme.radius["3xl"], overflow: "hidden" },
  tint: {
    // Real blur (BlurView above) plus a translucent tint on top — the tint
    // keeps labels legible on platforms where blur underperforms without
    // going fully opaque, so the bar still reads as glass.
    backgroundColor: theme.colors.surface + "D6",
    borderTopWidth: 1,
    borderTopColor: theme.colors.ring,
  },
  row: { flex: 1, flexDirection: "row", alignItems: "stretch", paddingHorizontal: theme.spacing.xs },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  pill: {
    ...StyleSheet.absoluteFill,
    top: 8,
    bottom: 8,
    left: 6,
    right: 6,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primary + "2E",
  },
  label: { fontSize: 10, lineHeight: 13 },
});
