import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/ThemedText";
import { theme } from "@/theme";

export type AppBarVariant = "large" | "compact" | "transparent";

interface Props {
  /** Large variant renders this under the control row; compact centres it in the row. */
  title?: string;
  subtitle?: string;
  /** Small uppercase line above a large title. */
  eyebrow?: string;
  onBack?: () => void;
  backAccessibilityLabel?: string;
  /** Replaces the back button (e.g. the MyanFlix wordmark on root screens). */
  leading?: ReactNode;
  /** Right-hand controls. */
  trailing?: ReactNode;
  variant?: AppBarVariant;
  /** Extra row pinned below the bar — search fields, segmented controls, chips. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The ONE app-bar system. Every screen header in the app is this component —
 * `large` for tab roots, `compact` for pushed screens, `transparent` for
 * cinematic screens whose artwork runs under the status bar. Do not introduce
 * a second header primitive.
 */
export function AppBar({
  title,
  subtitle,
  eyebrow,
  onBack,
  backAccessibilityLabel = "Back",
  leading,
  trailing,
  variant = "compact",
  children,
  style,
}: Props) {
  const transparent = variant === "transparent";
  const large = variant === "large";

  const content = (
    <SafeAreaView edges={["top"]} style={transparent ? styles.transparentSafeArea : undefined}>
      <View style={styles.row}>
        <View style={styles.side}>
          {leading ??
            (onBack ? (
              <AppBarAction
                icon="chevron-back"
                onPress={onBack}
                accessibilityLabel={backAccessibilityLabel}
                overlay={transparent}
              />
            ) : null)}
        </View>

        {!large && title ? (
          <ThemedText variant="section" numberOfLines={1} style={styles.compactTitle}>
            {title}
          </ThemedText>
        ) : (
          <View style={styles.compactTitle} />
        )}

        <View style={[styles.side, styles.sideRight]}>{trailing}</View>
      </View>

      {large && (title || subtitle || eyebrow) && (
        <View style={styles.largeBlock}>
          {eyebrow && <ThemedText variant="overline">{eyebrow.toUpperCase()}</ThemedText>}
          {title && (
            <ThemedText variant="title" numberOfLines={1}>
              {title}
            </ThemedText>
          )}
          {subtitle && (
            <ThemedText variant="caption" numberOfLines={2}>
              {subtitle}
            </ThemedText>
          )}
        </View>
      )}

      {children}
    </SafeAreaView>
  );

  if (transparent) {
    return (
      <LinearGradient colors={[theme.colors.scrim, "transparent"]} style={[styles.transparentContainer, style]}>
        {content}
      </LinearGradient>
    );
  }

  return <View style={[styles.solidContainer, style]}>{content}</View>;
}

interface ActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Adds a dark scrim disc so the control stays legible over artwork. */
  overlay?: boolean;
  /** Unread / attention dot. */
  badge?: boolean;
  color?: string;
}

/** The 44pt round control used in every app bar — back, notifications, filters. */
export function AppBarAction({ icon, onPress, accessibilityLabel, overlay, badge, color }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, overlay ? styles.actionOverlay : styles.actionPlain, pressed && styles.actionPressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={21} color={color ?? theme.colors.text} />
      {badge && <View style={styles.badge} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  solidContainer: { backgroundColor: theme.colors.background },
  transparentContainer: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 },
  transparentSafeArea: { backgroundColor: "transparent" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    minHeight: 52,
  },
  side: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, minWidth: theme.layout.minTouch },
  sideRight: { justifyContent: "flex-end" },
  compactTitle: { flex: 1, textAlign: "center" },
  largeBlock: { paddingHorizontal: theme.layout.screenPadding, paddingBottom: theme.spacing.sm, gap: 2 },
  action: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPlain: { backgroundColor: "transparent" },
  actionOverlay: { backgroundColor: theme.colors.overlay, borderWidth: 1, borderColor: theme.colors.ring },
  actionPressed: { opacity: 0.6, transform: [{ scale: 0.94 }] },
  badge: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
});
