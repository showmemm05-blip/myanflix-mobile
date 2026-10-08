import { useState, type ReactNode, type Ref } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/ThemedText";
import { FadeInView } from "@/components/ui/FadeInView";
import { BusyDots } from "@/components/ui/BusyDots";
import { useRevealOnFocus } from "@/components/wallet/SheetForm";
import { theme, withAlpha } from "@/theme";

/**
 * The Account area's Marquee form kit (EditProfile, ChangePassword,
 * DeleteAccount, Language, Feedback and Subscribe boards). Area-local on
 * purpose: the shared Button clips its label to one line by default and the
 * shared sheet fields are the money flows' boxed look, while every Account
 * board draws a wrapping label and a 56pt borderless raised field. The busy
 * dots are the shared components/ui/BusyDots, re-exported here so call sites
 * keep their import.
 */

type IconName = keyof typeof Ionicons.glyphMap;

/* ------------------------------------------------------------------------ */
/* Busy dots                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * Marquee's busy state: three pulsing dots, never a spinner (the shared
 * component, 1.2s per dot as the Account boards draw it). Decorative — the
 * control that owns it carries `busy` in its accessibility state. Under reduce
 * motion the dots hold still.
 */
export { BusyDots };

/* ------------------------------------------------------------------------ */
/* Action button                                                             */
/* ------------------------------------------------------------------------ */

export type ActionTone = "primary" | "premium" | "destructive" | "play" | "tonal";

const TONE_FILL: Record<ActionTone, string> = {
  primary: theme.colors.primary,
  premium: theme.colors.premium,
  destructive: theme.colors.dangerStrong,
  play: theme.colors.play,
  tonal: theme.colors.tonalStrong,
};

const TONE_INK: Record<ActionTone, string> = {
  primary: theme.colors.onPrimary,
  premium: theme.colors.onPremium,
  destructive: theme.colors.onDangerStrong,
  play: theme.colors.onPlay,
  tonal: theme.colors.text,
};

/** Fills that dim to a 30% tint (with 55% white ink) while disabled, as the boards draw them. */
const TINTED_WHEN_DISABLED: ReadonlySet<ActionTone> = new Set(["primary", "premium", "destructive"]);

interface ActionButtonProps {
  title: string;
  onPress: () => void;
  tone?: ActionTone;
  icon?: IconName;
  /** Replaces the icon + title row; receives the current ink colour. */
  renderContent?: (ink: string) => ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** 52 for the sheets' commit buttons, 56 for Subscribe. */
  height?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The boards' full-width commit button: radius 12, an 800 16pt label that
 * WRAPS rather than truncating (long Burmese at large text sizes), press =
 * scale .96 (an opacity dip under reduce motion), busy = three dots.
 */
export function ActionButton({
  title,
  onPress,
  tone = "primary",
  icon,
  renderContent,
  loading = false,
  disabled = false,
  height = 52,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ActionButtonProps) {
  const reduceMotion = useReducedMotion();
  const inactive = disabled || loading;
  const dimmed = disabled && !loading;
  const tinted = TINTED_WHEN_DISABLED.has(tone);
  const fill = dimmed && tinted ? withAlpha(TONE_FILL[tone], 0.3) : TONE_FILL[tone];
  const ink = dimmed && tinted ? withAlpha(theme.colors.text, 0.55) : TONE_INK[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.action,
        { minHeight: height, backgroundColor: fill },
        dimmed && !tinted && styles.actionDimmed,
        loading && styles.actionBusy,
        pressed && !inactive && (reduceMotion ? styles.pressedStill : styles.pressed),
        style,
      ]}
    >
      {loading ? (
        <BusyDots color={ink} />
      ) : renderContent ? (
        renderContent(ink)
      ) : (
        <View style={styles.actionRow}>
          {icon ? <Ionicons name={icon} size={20} color={ink} /> : null}
          <ThemedText weight="extrabold" style={[styles.actionLabel, { color: ink }]}>
            {title}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------------ */
/* Sheet header                                                              */
/* ------------------------------------------------------------------------ */

interface SheetHeaderProps {
  onClose: () => void;
  closeLabel: string;
  /** Greys the close (opacity .4) while a request it would interrupt is running. */
  closeDisabled?: boolean;
  /** "left" is Edit profile's layout: close · centred title · spacer. */
  closeSide?: "left" | "right";
  /** Edit profile's centred 17pt title (closeSide "left"). */
  centerTitle?: string;
  /** What sits beside a right-hand close: an icon disc or a title block. */
  children?: ReactNode;
}

/**
 * Grabber + the row that carries the round close. Handed to BottomSheet's
 * `header`, so it stays the drag handle. The close is the boards' 36pt disc
 * (white at 12%) inside a 44pt target.
 */
export function SheetHeader({
  onClose,
  closeLabel,
  closeDisabled = false,
  closeSide = "right",
  centerTitle,
  children,
}: SheetHeaderProps) {
  const reduceMotion = useReducedMotion();
  const close = (
    <Pressable
      onPress={onClose}
      disabled={closeDisabled}
      accessibilityRole="button"
      accessibilityLabel={closeLabel}
      accessibilityState={{ disabled: closeDisabled }}
      style={({ pressed }) => [
        styles.closeTarget,
        closeSide === "left" ? styles.closeLeft : styles.closeRight,
        closeDisabled && styles.closeDisabled,
        pressed && !closeDisabled && (reduceMotion ? styles.pressedStill : styles.pressed),
      ]}
    >
      <View style={styles.closeDisc}>
        <Ionicons name="close" size={18} color={theme.colors.text} />
      </View>
    </Pressable>
  );

  return (
    <View style={styles.header}>
      <View style={styles.grabber} />
      {closeSide === "left" ? (
        <View style={styles.headerRowCentered}>
          {close}
          <ThemedText
            weight="extrabold"
            accessibilityRole="header"
            style={styles.centerTitle}
          >
            {centerTitle}
          </ThemedText>
          <View style={styles.closeSpacer} />
        </View>
      ) : (
        <View style={styles.headerRow}>
          <View style={styles.headerLead}>{children}</View>
          {close}
        </View>
      )}
    </View>
  );
}

/** The 56/64pt tinted disc that heads a sheet (lock, trash). */
export function IconDisc({
  icon,
  color,
  fill,
  size = 56,
  iconSize = 26,
}: {
  icon: IconName;
  color: string;
  fill: string;
  size?: number;
  iconSize?: number;
}) {
  return (
    <View
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: fill }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Ionicons name={icon} size={iconSize} color={color} />
    </View>
  );
}

/** A sheet's 24pt title and its one quiet line. */
export function SheetIntro({
  title,
  subtitle,
  subtitleTone = "muted",
  style,
}: {
  title: string;
  subtitle?: string;
  /** "danger" is Delete account's bold red "This can't be undone." */
  subtitleTone?: "muted" | "danger";
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.intro, style]}>
      <ThemedText variant="title" accessibilityRole="header">
        {title}
      </ThemedText>
      {subtitle ? (
        subtitleTone === "danger" ? (
          <ThemedText variant="body" weight="bold" color={theme.colors.danger}>
            {subtitle}
          </ThemedText>
        ) : (
          <ThemedText variant="muted" color={theme.colors.textMuted}>
            {subtitle}
          </ThemedText>
        )
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------------ */
/* Fields                                                                    */
/* ------------------------------------------------------------------------ */

/** The 13pt bold label over a field (ChangePassword / Feedback boards). */
export function FieldCaption({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <ThemedText variant="caption" weight="bold" color={theme.colors.textMuted}>
        {children}
      </ThemedText>
    </View>
  );
}

interface AccountFieldProps extends TextInputProps {
  /** Paints the 2pt red ring while this field is reporting an error. */
  invalid?: boolean;
  /** Adds the eye toggle to a `secureTextEntry` field. */
  revealable?: boolean;
  revealAccessibilityLabel?: string;
  hideAccessibilityLabel?: string;
  /** Handed to the TextInput so a multi-field form can hop focus on "next". */
  ref?: Ref<TextInput>;
}

/**
 * The boards' text field: 56pt, radius 16, the raised #1C1C23 fill, no
 * border; a 2pt crimson ring while focused and a 2pt red ring while invalid.
 * Brings itself into view above the keyboard through SheetForm.
 */
export function AccountField({
  invalid,
  revealable,
  revealAccessibilityLabel,
  hideAccessibilityLabel,
  secureTextEntry,
  editable = true,
  style,
  onFocus,
  onBlur,
  ref,
  ...rest
}: AccountFieldProps) {
  const reveal = useRevealOnFocus();
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const showToggle = !!revealable && !!secureTextEntry;

  return (
    <View
      style={[
        styles.fieldShell,
        focused && styles.fieldFocused,
        invalid && styles.fieldInvalid,
        !editable && styles.fieldDisabled,
      ]}
    >
      <TextInput
        ref={ref}
        placeholderTextColor={theme.colors.textFaint}
        selectionColor={theme.colors.primary}
        {...rest}
        editable={editable}
        secureTextEntry={secureTextEntry && !revealed}
        onFocus={(event) => {
          setFocused(true);
          reveal();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.fieldInput, style]}
      />
      {showToggle ? (
        <Pressable
          onPress={() => setRevealed((value) => !value)}
          disabled={!editable}
          style={({ pressed }) => [styles.revealToggle, pressed && styles.togglePressed]}
          accessibilityRole="button"
          accessibilityLabel={revealed ? hideAccessibilityLabel : revealAccessibilityLabel}
          accessibilityState={{ selected: revealed }}
        >
          <Ionicons name={revealed ? "eye-off-outline" : "eye-outline"} size={20} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The Feedback board's message box: 132pt, radius 16, raised fill. */
export function AccountTextArea({ style, onFocus, onBlur, editable = true, ...rest }: TextInputProps) {
  const reveal = useRevealOnFocus();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={theme.colors.textFaint}
      selectionColor={theme.colors.primary}
      multiline
      // Android centres multiline text vertically without this.
      textAlignVertical="top"
      {...rest}
      editable={editable}
      onFocus={(event) => {
        setFocused(true);
        reveal();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[styles.textArea, focused && styles.fieldFocused, !editable && styles.fieldDisabled, style]}
    />
  );
}

/** A message that belongs to ONE field, right under it, with the board's alert glyph. */
export function InlineError({ children }: { children: ReactNode }) {
  return (
    <View style={styles.inlineError} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={14} color={theme.colors.danger} style={styles.inlineErrorIcon} />
      <ThemedText variant="caption" weight="semibold" color={theme.colors.danger} style={styles.flexText}>
        {children}
      </ThemedText>
    </View>
  );
}

/* ------------------------------------------------------------------------ */
/* Notices and success                                                       */
/* ------------------------------------------------------------------------ */

/**
 * A form-level message above the commit button: a soft red (or, for "you
 * already have it", info-blue) fill, no border, 14pt semibold ink.
 * `children` hangs under the text, aligned with it (Subscribe's Add money).
 */
export function Notice({
  message,
  tone = "danger",
  children,
}: {
  message: string;
  tone?: "danger" | "info";
  children?: ReactNode;
}) {
  const ink = tone === "info" ? theme.colors.info : theme.colors.danger;
  return (
    <View
      style={[styles.notice, { backgroundColor: tone === "info" ? theme.colors.infoSoft : theme.colors.dangerSoft }]}
    >
      <View style={styles.noticeRow} accessible accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Ionicons
          name={tone === "info" ? "information-circle-outline" : "alert-circle-outline"}
          size={16}
          color={ink}
          style={styles.noticeIcon}
        />
        <ThemedText variant="muted" weight="semibold" color={ink} style={styles.flexText}>
          {message}
        </ThemedText>
      </View>
      {children ? <View style={styles.noticeExtra}>{children}</View> : null}
    </View>
  );
}

/**
 * The confirmation that replaces a form: an 88pt green disc with a tick that
 * rises in (a plain fade under reduce motion), the 24pt title and one line.
 */
export function SuccessPanel({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.success} accessibilityLiveRegion="polite">
      <FadeInView from="bottom" duration={340}>
        <View style={styles.successDisc} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Ionicons name="checkmark" size={40} color={theme.colors.finance} />
        </View>
      </FadeInView>
      <ThemedText variant="title" accessibilityRole="header" style={styles.centerText}>
        {title}
      </ThemedText>
      {body ? (
        <ThemedText variant="body" color={theme.colors.textBody} style={[styles.centerText, styles.successBody]}>
          {body}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * SheetForm's pinned action bar, restyled to the boards: the sheet's own
 * #121217 fill with no hairline, and 12pt between a notice and the button.
 */
export const accountActionBar: ViewStyle = {
  backgroundColor: theme.colors.surface,
  borderTopWidth: 0,
  gap: 12,
};

const styles = StyleSheet.create({
  action: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.button,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.spacing.sm },
  /** `flexShrink` lets a long label wrap inside the row instead of overflowing it. */
  actionLabel: { flexShrink: 1, fontSize: 16, textAlign: "center" },
  actionDimmed: { opacity: 0.45 },
  actionBusy: { opacity: 0.85 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedStill: { opacity: 0.8 },

  header: { paddingTop: theme.spacing.sm },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.grabber,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm, marginTop: 4 },
  headerRowCentered: { flexDirection: "row", alignItems: "center", minHeight: 48, marginTop: 4 },
  headerLead: { flex: 1, minWidth: 0, paddingTop: theme.spacing.sm },
  centerTitle: { flex: 1, fontSize: 17, textAlign: "center" },
  closeTarget: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  /** The board's close sits 8pt from the sheet edge, i.e. 8pt into the 16pt margin. */
  closeRight: { marginRight: -8 },
  closeLeft: { marginLeft: -8 },
  closeSpacer: { width: theme.layout.minTouch - 8 },
  closeDisabled: { opacity: 0.4 },
  closeDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.tonal,
    alignItems: "center",
    justifyContent: "center",
  },
  disc: { alignItems: "center", justifyContent: "center" },
  intro: { gap: 4 },

  fieldShell: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: theme.colors.surfaceElevated,
    paddingLeft: 14,
    paddingRight: 4,
  },
  fieldFocused: { borderColor: theme.colors.primary },
  fieldInvalid: { borderColor: theme.colors.danger },
  fieldDisabled: { opacity: 0.6 },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    paddingRight: 10,
    color: theme.colors.text,
    fontFamily: theme.font.regular,
    fontSize: 17,
  },
  revealToggle: {
    width: theme.layout.minTouch,
    height: theme.layout.minTouch,
    borderRadius: theme.layout.minTouch / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  togglePressed: { opacity: 0.7 },
  textArea: {
    minHeight: 132,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: theme.colors.surfaceElevated,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    color: theme.colors.text,
    fontFamily: theme.font.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  inlineError: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: theme.spacing.sm },
  inlineErrorIcon: { marginTop: 2 },
  flexText: { flex: 1 },

  notice: {
    borderRadius: theme.radius.button,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  noticeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  noticeIcon: { marginTop: 2 },
  /** Lines the extra up with the message text: 16pt icon + 10pt gap. */
  noticeExtra: { marginLeft: 26 },

  success: { alignItems: "center", paddingTop: 28, gap: theme.spacing.sm },
  successDisc: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  successBody: { maxWidth: 360 },
  centerText: { textAlign: "center" },
});
