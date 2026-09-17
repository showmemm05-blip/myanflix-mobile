import { ScrollView, View, StyleSheet } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ui/ThemedText";
import { PressableScale } from "@/components/ui/PressableScale";
import { Surface } from "@/components/ui/Surface";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme, withAlpha } from "@/theme";
import type { LibraryStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LibraryStackParamList, "LibraryOverview">;

interface Row {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  onPress: () => void;
  /** Dimmed row for a destination that is still a placeholder. */
  quiet?: boolean;
}

export function LibraryOverviewScreen({ navigation }: Props) {
  const { t } = useLanguage();

  const rows: Row[] = [
    {
      label: t.profile.watchHistory,
      icon: "time-outline",
      tone: theme.colors.primary,
      onPress: () => navigation.navigate("WatchHistory"),
    },
    {
      label: t.profile.favorites,
      icon: "heart-outline",
      tone: theme.colors.danger,
      onPress: () => navigation.navigate("Favorites"),
    },
    {
      label: t.settings.downloads,
      icon: "download-outline",
      tone: theme.colors.textMuted,
      onPress: () => navigation.navigate("DownloadCachePlaceholder"),
      quiet: true,
    },
  ];

  return (
    <View style={styles.container}>
      <AuroraBackdrop tone="violet" height={380} intensity={0.65} />
      {/* See Wallet: the tab bar names the tab, so the heading was one row of
          screen spent repeating it. No title also drops AppBar to compact. */}
      <AppTopBar />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {rows.map((row) => (
          <PressableScale key={row.label} onPress={row.onPress} accessibilityLabel={row.label}>
            <Surface radius="xl" style={styles.row}>
              <View
                style={[
                  styles.iconTile,
                  { backgroundColor: withAlpha(row.tone, 0.12), borderColor: withAlpha(row.tone, 0.2) },
                ]}
              >
                <Ionicons name={row.icon} size={20} color={row.tone} />
              </View>
              <ThemedText
                variant="body"
                weight="semibold"
                numberOfLines={1}
                style={[styles.rowLabel, row.quiet && styles.rowLabelQuiet]}
              >
                {row.label}
              </ThemedText>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textFaint} />
            </Surface>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.layout.screenPadding,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.layout.tabBarClearance,
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    minHeight: 72,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1 },
  rowLabelQuiet: { color: theme.colors.textMuted },
});
