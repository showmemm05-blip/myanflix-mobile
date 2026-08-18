import { StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { TopBar } from "@/components/layout/TopBar";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { LibraryStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<LibraryStackParamList, "DownloadCachePlaceholder">;

// No persistent on-device segment cache in v1 — deliberately a disabled
// placeholder, not wired to any functionality yet.
export function DownloadCacheSettingsScreen({ navigation }: Props) {
  const { t } = useLanguage();

  return (
    <View style={styles.container}>
      <AuroraBackdrop tone="night" height={340} intensity={0.5} />
      <TopBar title={t.settings.downloads} onBack={() => navigation.goBack()} backAccessibilityLabel={t.common.back} />

      <EmptyState
        icon="cloud-offline-outline"
        title={t.settings.downloads}
        message={t.settings.downloadsComingSoon}
        tone={theme.colors.textMuted}
        style={styles.empty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  empty: { paddingBottom: theme.layout.tabBarClearance },
});
