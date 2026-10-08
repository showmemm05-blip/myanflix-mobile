import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { TopBar } from "@/components/layout/TopBar";
import { GlassBarBackground, GlassTarget, useGlassBar } from "@/components/layout/GlassBar";
import { PageHeading } from "@/components/library/PageHeading";
import { ScreenStackArt, StateBlock } from "@/components/library/LibraryState";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { ProfileStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<ProfileStackParamList, "DownloadCachePlaceholder">;

// No persistent on-device segment cache in v1 — deliberately a disabled
// placeholder, not wired to any functionality yet. Downloads.dc.html's
// "today" state: the page title, then the stacked-screens art and the one
// line saying offline downloads aren't here yet. The board's other states
// (queue, storage meter, Wi-Fi only) need a downloads feature first.
export function DownloadCacheSettingsScreen({ navigation }: Props) {
  const { t } = useLanguage();
  // Opened from Profile, above the tabs, where the dock is hidden — so pad for
  // the phone's own bottom edge, not for the dock (owner, 2026-10-07).
  const bottomClearance = useSafeAreaInsets().bottom + theme.spacing.xl;
  // The glass bar (components/layout/GlassBar): the bar floats over the page,
  // transparent at the top, frosted once the page scrolls under it.
  const glass = useGlassBar();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  useScrollOffset(scrollRef, glass.scrollY);

  return (
    <View style={styles.container}>
      <GlassTarget targetRef={glass.blurTarget}>
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingTop: glass.barHeight, paddingBottom: bottomClearance }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        >
          <PageHeading title={t.settings.downloads} />
          <StateBlock art={<ScreenStackArt />} title={t.settings.downloadsComingSoon} size="section" style={styles.state} />
        </Animated.ScrollView>
      </GlassTarget>

      <GlassBarBackground scrollY={glass.scrollY} height={glass.barHeight} blurTarget={glass.blurTarget} />
      <TopBar
        floating
        touchThrough
        onLayout={glass.onBarLayout}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t.common.back}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1 },
  state: { marginTop: 72 },
});
