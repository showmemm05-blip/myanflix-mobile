import { Children, Fragment, isValidElement, useId, type ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

const GLOW_HEIGHT = 360;

/**
 * Profile.dc.html's top glow: a soft radial wash from the upper left — gold
 * for a subscriber, crimson otherwise — fading out by three quarters of the
 * way down its 360pt. It sits still behind the bar while the page scrolls
 * over it. Decoration only.
 */
export function ProfileGlow({ premium }: { premium: boolean }) {
  const { width } = useWindowDimensions();
  // useId's shape has changed between React versions (":r0:", "«r0»",
  // "_r_0_"); only plain characters are safe inside url(#…).
  const id = `profile-glow-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const hue = premium ? theme.colors.premium : theme.colors.primary;
  const peak = premium ? 0.2 : 0.18;
  return (
    <View style={styles.glow} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={GLOW_HEIGHT}>
        <Defs>
          {/* radial-gradient(120% 90% at 18% 0%, …) in the board. */}
          <RadialGradient
            id={id}
            gradientUnits="userSpaceOnUse"
            cx={width * 0.18}
            cy={0}
            fx={width * 0.18}
            fy={0}
            rx={width * 1.2}
            ry={GLOW_HEIGHT * 0.9}
          >
            <Stop offset="0" stopColor={hue} stopOpacity={peak} />
            <Stop offset="0.45" stopColor={hue} stopOpacity={peak * 0.3} />
            <Stop offset="0.75" stopColor={hue} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={GLOW_HEIGHT} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const AVATAR = 88;
const RING_GAP = 3;
const RING = 2;

/**
 * The 88pt avatar: the photo, or the user's initials on the avatar disc. A
 * subscriber gets a gold ring and the gold badge; everyone else a quiet
 * white-at-12% ring.
 */
export function ProfileAvatar({
  avatarUrl,
  initials,
  premium,
}: {
  avatarUrl?: string | null;
  initials: string;
  premium: boolean;
}) {
  const { t } = useLanguage();
  return (
    <View style={[styles.avatarRing, { borderColor: premium ? theme.colors.premium : theme.colors.tonal }]}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" transition={180} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <ThemedText variant="title" color={theme.colors.onAvatar} style={styles.avatarInitials}>
            {initials}
          </ThemedText>
        </View>
      )}
      {premium && (
        <View style={styles.badge} accessible accessibilityRole="image" accessibilityLabel={t.library.premiumMember}>
          <Ionicons name="diamond" size={14} color={theme.colors.onPremium} />
        </View>
      )}
    </View>
  );
}

/**
 * A grouped settings panel (#121217, radius 16) whose rows are divided by a
 * hairline — Preferences, Support and Account on Profile.
 */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  // Flatten fragments and drop the `false` a conditional row leaves behind, so
  // the dividers only ever fall BETWEEN rows that actually render.
  const rows: ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      Children.forEach(child.props.children, (inner) => {
        if (inner) rows.push(inner);
      });
    } else if (child) {
      rows.push(child);
    }
  });
  return (
    <View style={styles.group}>
      <ThemedText variant="section" accessibilityRole="header">
        {title}
      </ThemedText>
      <View style={styles.groupPanel}>
        {rows.map((row, index) => (
          <View key={index} style={index > 0 ? styles.groupDivider : undefined}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * One row of a settings panel: a plain 22pt glyph, the label (and an optional
 * quiet second line), and a trailing chevron — or an external-link glyph for a
 * row that leaves the app. Labels wrap instead of truncating.
 */
export function SettingsRow({
  icon,
  label,
  subtitle,
  onPress,
  accessibilityLabel,
  accessibilityRole,
  danger,
  external,
  leadingSubtitle,
  glyph,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityRole?: "button" | "link";
  danger?: boolean;
  external?: boolean;
  /** Something drawn before the subtitle text (the language's flag). */
  leadingSubtitle?: string;
  /**
   * A 22pt glyph of the row's own in place of `icon`, for a mark Ionicons
   * does not have (the withdrawal code's shield-and-lock). `icon` still names
   * the fallback.
   */
  glyph?: ReactNode;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      activeScale={0.98}
      style={[styles.settingsRow, subtitle ? styles.settingsRowTall : null]}
    >
      {glyph ?? <Ionicons name={icon} size={22} color={danger ? theme.colors.danger : theme.colors.textBody} />}
      <View style={styles.settingsText}>
        <ThemedText variant="body" weight="bold" color={danger ? theme.colors.danger : theme.colors.text}>
          {label}
        </ThemedText>
        {subtitle ? (
          <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint}>
            {leadingSubtitle ? `${leadingSubtitle}  ${subtitle}` : subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Ionicons name={external ? "open-outline" : "chevron-forward"} size={20} color={theme.colors.textFaint} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: GLOW_HEIGHT },
  avatarRing: {
    width: AVATAR + 2 * (RING_GAP + RING),
    height: AVATAR + 2 * (RING_GAP + RING),
    borderRadius: (AVATAR + 2 * (RING_GAP + RING)) / 2,
    borderWidth: RING,
    padding: RING_GAP,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  avatarFallback: { backgroundColor: theme.colors.avatar, alignItems: "center", justifyContent: "center" },
  /** 30pt initials; Latin capitals, so no tracking. */
  avatarInitials: { fontSize: 30, letterSpacing: 0 },
  /** The board pins it 2pt outside the 88pt photo; the ring adds 5 around that. */
  badge: {
    position: "absolute",
    right: RING_GAP + RING - 2,
    bottom: RING_GAP + RING - 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: theme.colors.background,
    backgroundColor: theme.colors.premium,
    alignItems: "center",
    justifyContent: "center",
  },
  group: { paddingHorizontal: theme.layout.screenPadding },
  groupPanel: {
    marginTop: 14,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  groupDivider: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 56,
    paddingLeft: theme.layout.screenPadding,
    paddingRight: 12,
    paddingVertical: theme.spacing.sm,
  },
  settingsRowTall: { minHeight: 64, paddingVertical: 11 },
  settingsText: { flex: 1, minWidth: 0 },
});
