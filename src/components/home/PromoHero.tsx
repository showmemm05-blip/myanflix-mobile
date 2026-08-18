import { useEffect, useMemo, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ui/ThemedText";
import { Button } from "@/components/ui/Button";
import { FadeInView } from "@/components/ui/FadeInView";
import { Skeleton } from "@/components/common/Skeleton";
import { AuroraBackdrop } from "@/components/common/AuroraBackdrop";
import { useHomeLayout } from "@/hooks/useHomeLayout";
import { useLanguage } from "@/localization/LanguageProvider";
import type { Language } from "@/localization/translations";
import { theme, withAlpha } from "@/theme";

interface Props {
  /** True only when the subscription status has loaded AND is active. */
  isMember: boolean;
  expiresAt: string | null;
  statusLoading: boolean;
  /**
   * The status request FAILED. Distinct from `isMember: false`, and the
   * distinction is the whole point: collapsing "not a member" and "we could not
   * ask" sells a subscription to somebody who already pays for one every time
   * they open the app on a bad connection.
   */
  statusError: boolean;
  onSubscribe: () => void;
  onBrowseMovies: () => void;
  onBrowseSeries: () => void;
}

/**
 * The opening frame of the advertisement page — a TITLE CARD, drawn entirely in
 * code. There is no photograph here: the composition is a raking aurora, a
 * cropped film rail, a two-ink headline that finishes itself with a rule, one
 * line of body copy, and one instrument.
 *
 * THE POSTER IS PRINTED ONCE. The eyebrow, the headline, the subhead and the
 * finishing rule are identical for a member, a guest, a failed status and a
 * still-loading one — so resolving `useSubscriptionStatus` moves nothing on
 * screen and never flashes the wrong pitch. Only the ink BETWEEN the day-rail
 * band's two hairlines changes, and every row in that band reserves the SAME
 * height in all four states, at every OS text size (the skeletons are measured
 * in `fontScale`d line heights, not raw pixels — that is what makes the claim
 * true above 100% text).
 *
 * Roles, strictly: violet = actions (Button fills only), gold = the offer,
 * emerald = a live term, amber = a real deadline the server returned. Crimson
 * appears ZERO times — `AppTopBar` owns the wordmark and this hero must not
 * repeat it, in a lockup or in copy.
 *
 * Two deliberate restraints on colour. The member's day count is set in `text`,
 * not emerald: emerald is the money colour and `OfferTicket` prints a real
 * kyat balance in that exact hex a screen-inch below, so spending it on a
 * DURATION as well made one hue mean two things. And the urgent state
 * extinguishes every gold mark on the hero, because amber next to gold is ten
 * degrees of hue apart at the same value — the one moment the page has
 * something urgent to say, it must be the only warm thing on screen.
 *
 * The container has a `minHeight` and never a `height`, and flows its content
 * DOWN. Burmese, 200% OS text and stacked CTAs grow the box; nothing is ever
 * cropped off the top the way the old fixed-height + `flex-end` build was.
 */

/* ---------------------------------------------------------------- constants */

/** 30 slots, always — one month of term at a constant 5pt pitch. */
const RULER_SLOTS = 30;
const TICK_WIDTH = 2;
const TICK_GAP = 3;
const TICK_PITCH = TICK_WIDTH + TICK_GAP;
/** Natural measure: 147pt. NEVER stretched to fill the row — that is a progress bar. */
const RULER_WIDTH = RULER_SLOTS * TICK_WIDTH + (RULER_SLOTS - 1) * TICK_GAP;
const SLOTS = Array.from({ length: RULER_SLOTS }, (_, i) => i);
const isWeekMark = (index: number) => index % 7 === 6;

const DAY_MS = 86_400_000;
/** Below this the band switches from "a live term" to "a real deadline". */
const URGENT_DAYS = 7;

/**
 * The sprocket ink falls off down the strip: the `night` aurora falls from
 * {0.15,0} toward {0.75,1}, so the rail is lit at the top and dissolves into
 * the page — the geometry knows where the lamp is.
 *
 * INTERPOLATED across however many holes the width gives us, and derived from
 * `colors.text`. The previous four-entry table ran flat after the fourth hole
 * (a graded head followed by a constant grey tail is not a falloff) and spelled
 * three `rgba(245,246,250,…)` literals by hand, which would silently desync the
 * moment the text token moved.
 */
const SPROCKET_TOP = 0.3;
const SPROCKET_BOTTOM = 0.09;
const sprocketInk = (index: number, count: number) =>
  withAlpha(
    theme.colors.text,
    SPROCKET_TOP -
      (SPROCKET_TOP - SPROCKET_BOTTOM) * (count > 1 ? index / (count - 1) : 0),
  );

/** Joined to `home.hero.proofPoints` BY INDEX — the copy stays 3 items. */
const PROOF_ICONS: readonly (keyof typeof Ionicons.glyphMap)[] = [
  "sparkles-outline",
  "language-outline",
  "film-outline",
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * "13 Sep 2026" — a designed date, never `toLocaleDateString()`'s "9/13/2026".
 * `Intl` is present under Hermes on Expo 54, but the try/catch is mandatory:
 * a missing `my-MM` locale must degrade to a readable date, not throw inside a
 * marketing hero.
 */
function formatDate(value: string, language: Language): string {
  const date = new Date(value);
  try {
    return new Intl.DateTimeFormat(language === "mm" ? "my-MM" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * The clock, as STATE.
 *
 * Reading `Date.now()` during render makes the render non-idempotent and, worse,
 * stale: an app resumed from the background across midnight keeps printing
 * yesterday's numeral and yesterday's lit run until something unrelated
 * re-renders it. This re-reads the clock when the app returns to the foreground,
 * and only if the calendar day actually moved — so a routine backgrounding does
 * not restart the ruler's reveal.
 */
function useToday(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      setNow((previous) =>
        new Date(previous).toDateString() === new Date().toDateString()
          ? previous
          : Date.now(),
      );
    });
    return () => subscription.remove();
  }, []);

  return now;
}

/* ------------------------------------------------------------------- pieces */

interface RulerProps {
  /** How many of the 30 slots are lit, already clamped to 0–30. */
  lit: number;
  /** Ink for the lit run — `finance`, or `warning` inside the last week. */
  accent: string;
  unlitWeek: string;
  unlitDay: string;
  /** Term runs past the frame: the right edge fades instead of printing "30+". */
  overflowing: boolean;
  weekHeight: number;
  dayHeight: number;
}

/**
 * The instrument. ONE animated view, not thirty: the base rail is static, and
 * the lit layer (children absolutely positioned, so the clip reflows nothing)
 * is revealed by a single animated width. Thirty per-tick layout animations in
 * the same frame as the rest of the page is exactly the cost a mid-range
 * Android cannot absorb.
 */
function Ruler({
  lit,
  accent,
  unlitWeek,
  unlitDay,
  overflowing,
  weekHeight,
  dayHeight,
}: RulerProps) {
  const reduceMotion = useReducedMotion();
  const litWidth = lit > 0 ? lit * TICK_PITCH - TICK_GAP : 0;
  const clipWidth = useSharedValue(reduceMotion ? litWidth : 0);
  // Lit day marks at 60% keep the week ruler legible THROUGH the lit run — a
  // solid block of emerald stops being a measure. `withAlpha`, never `+ "99"`:
  // `accent` is a state-chosen token and is not always 6-digit hex.
  const litDay = withAlpha(accent, 0.6);

  useEffect(() => {
    if (reduceMotion) {
      clipWidth.value = litWidth;
      return;
    }
    clipWidth.value = 0;
    clipWidth.value = withDelay(
      380,
      withTiming(litWidth, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
  }, [clipWidth, litWidth, reduceMotion]);

  const clipStyle = useAnimatedStyle(() => ({ width: clipWidth.value }));

  return (
    <View
      style={{ width: RULER_WIDTH, height: weekHeight }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <View style={[StyleSheet.absoluteFill, styles.rulerRow]}>
        {SLOTS.map((slot) => (
          <View
            key={slot}
            style={{
              width: TICK_WIDTH,
              height: isWeekMark(slot) ? weekHeight : dayHeight,
              borderRadius: 1,
              backgroundColor: isWeekMark(slot) ? unlitWeek : unlitDay,
            }}
          />
        ))}
      </View>

      {lit > 0 && (
        <Animated.View style={[styles.rulerClip, clipStyle]}>
          {SLOTS.slice(0, lit).map((slot) => (
            <View
              key={slot}
              style={{
                position: "absolute",
                left: slot * TICK_PITCH,
                bottom: 0,
                width: TICK_WIDTH,
                height: isWeekMark(slot) ? weekHeight : dayHeight,
                borderRadius: 1,
                backgroundColor: isWeekMark(slot) ? accent : litDay,
              }}
            />
          ))}
        </Animated.View>
      )}

      {overflowing && (
        <LinearGradient
          colors={[withAlpha(accent, 0), litDay]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.rulerOverflow}
        />
      )}
    </View>
  );
}

interface ProofRowProps {
  points: readonly string[];
  /** Rotates to stacked rows — see `stackedProof`, which is true nearly always. */
  stacked: boolean;
}

/**
 * The third material: no fill at all, just a hairline frame. Icons are muted
 * OUTLINES — the old build tinted its checkmarks `finance`, spending the money
 * colour on "4K HDR streaming".
 */
function ProofRow({ points, stacked }: ProofRowProps) {
  if (stacked) {
    return (
      <View style={styles.proofColumn}>
        {points.map((point, index) => (
          <View
            key={point}
            style={[
              styles.proofStackCell,
              index > 0 && styles.proofStackDivider,
            ]}
          >
            <Ionicons
              name={PROOF_ICONS[index] ?? "ellipse-outline"}
              size={14}
              color={theme.colors.textMuted}
            />
            <ThemedText
              variant="label"
              numberOfLines={2}
              style={styles.proofLabel}
            >
              {point}
            </ThemedText>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.proofRow}>
      {points.map((point, index) => (
        <View key={point} style={styles.proofCellWrap}>
          {index > 0 && <View style={styles.proofDivider} />}
          <View style={styles.proofCell}>
            <Ionicons
              name={PROOF_ICONS[index] ?? "ellipse-outline"}
              size={14}
              color={theme.colors.textMuted}
            />
            <ThemedText
              variant="label"
              numberOfLines={1}
              style={styles.proofLabel}
            >
              {point}
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}

/* --------------------------------------------------------------------- hero */

export function PromoHero({
  isMember,
  expiresAt,
  statusLoading,
  statusError,
  onSubscribe,
  onBrowseMovies,
  onBrowseSeries,
}: Props) {
  const { t, language } = useLanguage();
  const {
    height: windowHeight,
    fontScale,
    gutter,
    contentWidth,
    isCompact,
    isWide,
    isTablet,
  } = useHomeLayout();
  const reduceMotion = useReducedMotion();
  const isMM = language === "mm";
  const now = useToday();

  /* ---- the poster's measure (state-independent) ---- */

  // A FLOOR, never a height. There is no `height` anywhere in this component.
  const minHeight = Math.max(
    392 * Math.min(fontScale, 1.3),
    Math.min(windowHeight * 0.56, isTablet ? 520 : 480),
  );

  const headline = useMemo(() => {
    const multiplier =
      (isTablet ? 1.45 : isWide ? 1.36 : isCompact ? 1.14 : 1.28) *
      (isMM ? 0.8 : 1);
    // 200% OS text grows the headline sub-linearly — a display face that
    // doubles eats the fold, and this one (Noto Sans Myanmar Bold) does not
    // carry 56pt gracefully in either script.
    const guard = clamp(1 / fontScale, 0.74, 1);
    const fontSize = Math.round(
      theme.type.display.fontSize * multiplier * guard,
    );
    return {
      fontSize,
      // 1.5 for Myanmar, not 1.36: the script stacks consonants and hangs
      // subscript marks below the baseline, and Android's text layout clips
      // those below roughly 1.4 — at display sizes the clip is unmissable.
      lineHeight: Math.round(fontSize * (isMM ? 1.5 : 1.06)),
      letterSpacing: -(fontSize * 0.026),
    };
  }, [fontScale, isCompact, isMM, isTablet, isWide]);

  // ONE definition of the readable column, shared with every other section and
  // with the OfferTicket that tears off this hero's bottom edge. The private
  // 560/620/720 ramp this used to carry put the tablet headline 100pt to the
  // left of the ticket it is supposed to read as one object with.
  const sprockets = useMemo(
    () => Array.from({ length: isCompact ? 9 : 11 }, (_, i) => i),
    [isCompact],
  );

  const lines = t.home.hero.headlineLines;
  const leadingLines = lines.slice(0, -1);
  const lastLine = lines[lines.length - 1] ?? "";

  // The finishing rule draws itself from the exact pixel the last word ends at.
  const ruleScale = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      ruleScale.value = 1;
      return;
    }
    ruleScale.value = withDelay(
      260,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
  }, [reduceMotion, ruleScale]);
  const ruleStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: ruleScale.value }],
  }));

  /* ---- the term ---- */

  // Three mutually exclusive resolved states, plus loading. `unknown` exists so
  // a paying member on a dead connection is never shown the guest pitch.
  const unknown = !statusLoading && statusError && !isMember;
  const guest = !statusLoading && !statusError && !isMember;

  const expiryTime = expiresAt ? new Date(expiresAt).getTime() : NaN;
  const hasExpiry = Number.isFinite(expiryTime);
  // Clamped at 0, ALWAYS. A backend that returns isActive with a past date is a
  // bug; a negative numeral printed at 30pt would be worse than the bug.
  const days = hasExpiry
    ? Math.max(0, Math.ceil((expiryTime - now) / DAY_MS))
    : null;
  const urgent = isMember && days !== null && days <= URGENT_DAYS;
  const formattedDate =
    expiresAt && hasExpiry ? formatDate(expiresAt, language) : null;

  // While the status resolves — or after it failed — the spine is role-free
  // ink. A role colour there would be a claim about a state nobody knows yet.
  const accent = statusLoading
    ? theme.colors.borderStrong
    : unknown
      ? theme.colors.textMuted
      : isMember
        ? urgent
          ? theme.colors.warning
          : theme.colors.finance
        : theme.colors.premium;

  // Amber and gold are ten degrees of hue apart at the same value. In the last
  // week of a term the hero gives up every gold mark it has so the deadline is
  // the only warm thing on the page.
  const goldBloom = urgent ? 0 : guest ? 0.46 : 0.24;
  const ruleInk = urgent ? theme.colors.text : theme.colors.premium;
  const ruleColors: readonly [string, string] = [
    withAlpha(ruleInk, urgent ? 0.26 : 0.9),
    withAlpha(ruleInk, 0),
  ];

  const daysUnit = days === 1 ? t.home.hero.dayLeft : t.home.hero.daysLeft;
  const measureLabel =
    days === null
      ? t.subscription.active
      : days === 0
        ? t.home.hero.expiresToday
        : `${days} ${daysUnit}`;

  const bandLabel = statusLoading
    ? t.common.loading
    : unknown
      ? t.home.hero.a11yUnknown
      : isMember
        ? formattedDate
          ? t.home.hero.a11yMember
              .replace("{date}", formattedDate)
              .replace("{days}", measureLabel)
          : `${t.home.hero.eyebrowMember} · ${t.subscription.active}`
        : t.home.hero.a11yGuest;

  const untilLine =
    formattedDate === null
      ? null
      : (urgent ? t.home.hero.renewSoon : t.home.hero.activeUntil).replace(
          "{date}",
          formattedDate,
        );

  /* ---- reserved heights: the band must not move when the query lands ---- */

  // Every one of these is a LINE HEIGHT times the OS text scale, which is what
  // the resolved text will actually occupy. Raw pixel skeletons only matched at
  // 100% text and dropped the whole page ~90pt at 200% the moment the status
  // arrived.
  const overlineHeight = Math.round(theme.type.overline.lineHeight * fontScale);
  const displayHeight = Math.round(theme.type.display.lineHeight * fontScale);
  const captionHeight = Math.round(theme.type.caption.lineHeight * fontScale);
  // Button `size="lg"`: 16pt padding top and bottom around a `body` line box.
  const buttonHeight = Math.max(
    54,
    Math.round(32 + theme.type.body.lineHeight * fontScale),
  );

  /* ---- the band's inner ink ---- */

  const rulerProps = {
    weekHeight: isTablet ? 34 : 22,
    dayHeight: isTablet ? 20 : 12,
  };

  // The ruler is drawn unlit for a guest and for an unresolved status — an
  // empty measure is honest. It is dropped only for an active member whose
  // term has no parseable end date, which is the one case with nothing to plot.
  const showRuler = !(isMember && days === null);
  const showUntil = !isMember || untilLine !== null;

  // Both of these used to be `isCompact` (< 380pt), which put a 393pt iPhone
  // and a 411pt Pixel on the horizontal branch — where "Start your membership"
  // gets ~98pt of label box and all three proof points ellipsize. The
  // horizontal forms earn their place on a tablet in English, and nowhere else.
  const stackedProof = !isTablet || isMM || fontScale > 1.15;
  const stackedActions = !isWide || fontScale > 1.15;

  const browseMovies = (variant: "solid" | "outline") => (
    <Button
      title={t.home.cta.browseMovies}
      icon="film-outline"
      variant={variant}
      size="lg"
      onPress={onBrowseMovies}
      fullWidth={stackedActions}
      style={stackedActions ? undefined : styles.action}
    />
  );

  return (
    <View
      style={[
        styles.container,
        {
          minHeight,
          paddingHorizontal: gutter,
          paddingTop: isTablet ? theme.spacing.xxl : theme.spacing.lg,
        },
      ]}
    >
      {/* L1 — the raking light. Fully dissolved back to `background` by y≈300,
          which is the guarantee every contrast figure below the band rests on. */}
      <AuroraBackdrop tone="night" anchor="top" height={300} intensity={0.5} />

      {/* L2 — the hand-off bloom into the gold OfferTicket that tears off this
          edge. Damped for a member (an emerald state marker must never sit in a
          gold field — that is how the old "Active" pill went invisible) and
          extinguished entirely for an urgent one. */}
      {goldBloom > 0 && (
        <AuroraBackdrop
          tone="gold"
          anchor="bottom"
          height={200}
          intensity={goldBloom}
        />
      )}

      {/* L3 — the film rail, cropped by the trim and lit from the top-left. */}
      <View
        pointerEvents="none"
        style={[styles.filmRail, { left: isTablet ? gutter - 22 : 0 }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {sprockets.map((slot) => (
          <View
            key={slot}
            style={[
              styles.sprocket,
              { backgroundColor: sprocketInk(slot, sprockets.length) },
            ]}
          />
        ))}
      </View>

      {/* ---- 3.1 + 3.2 — the lead rule and the eyebrow ----
          The rule is NEUTRAL ink. It used to be gold, which made eight separate
          gold events on a guest's screen; at that density the one gold mark
          that should stop the eye (the offer) is competing with the wallpaper. */}
      <FadeInView
        from="bottom"
        style={[styles.column, { maxWidth: contentWidth }]}
      >
        <View style={[styles.leadRule, isTablet && styles.leadRuleWide]} />
        <ThemedText
          variant="overline"
          color={theme.colors.textMuted}
          style={[styles.eyebrow, !isMM && styles.upper]}
        >
          {t.home.hero.eyebrow}
        </ThemedText>
      </FadeInView>

      {/* ---- 3.3 — the headline, printed once, two inks, one finishing rule ----
          ONE entrance for the whole block rather than one per line: three
          staggered layout animations here plus the band, the actions and the
          campaign deck below all landed in the same frames on cold start. */}
      <FadeInView from="bottom" delay={80} duration={340}>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={lines.join(" ")}
          style={[
            styles.column,
            styles.headlineBlock,
            { maxWidth: contentWidth },
          ]}
        >
          {leadingLines.map((line, index) => (
            <ThemedText
              // Index, not the string: two identical lines in some future
              // translation is a legal setting and a duplicate React key.
              key={index}
              variant="display"
              numberOfLines={isMM ? 3 : 2}
              style={headline}
              importantForAccessibility="no-hide-descendants"
            >
              {line}
            </ThemedText>
          ))}

          <View style={styles.lastLineRow}>
            <ThemedText
              variant="display"
              color={theme.colors.textMuted}
              numberOfLines={isMM ? 3 : 2}
              style={[headline, styles.lastLineText]}
              importantForAccessibility="no-hide-descendants"
            >
              {lastLine}
            </ThemedText>
            <Animated.View
              pointerEvents="none"
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.finishingRule,
                { marginBottom: Math.round(headline.fontSize * 0.22) },
                ruleStyle,
              ]}
            >
              <LinearGradient
                colors={ruleColors}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        </View>
      </FadeInView>

      {/* ---- 3.3b — the one reading-size line on the card. Without it the ramp
              jumps straight from a 38pt display face to 11–13pt legend, which
              is why the composition read as arranged rather than written. Full
              `text` ink over the night wash: 14.2:1 at its worst. ---- */}
      <FadeInView from="bottom" delay={180} duration={340}>
        <ThemedText
          variant="body"
          color={theme.colors.text}
          style={[
            styles.subhead,
            { maxWidth: Math.round(contentWidth * 0.88) },
          ]}
        >
          {t.home.hero.subhead}
        </ThemedText>
      </FadeInView>

      {/* ---- 3.4 — THE DAY RAIL BAND. Full-bleed, two hairlines that never
              move, an instrument between them. Not a card: the moment this
              becomes a rounded panel the hero reads as a settings row. ---- */}
      <FadeInView
        from="bottom"
        delay={280}
        style={[
          styles.band,
          { marginHorizontal: -gutter, paddingHorizontal: gutter },
        ]}
      >
        <View
          accessible
          accessibilityLabel={bandLabel}
          // Without this the screen reader never learns the band went from
          // "Loading…" to a real term.
          accessibilityLiveRegion="polite"
          style={{ maxWidth: contentWidth }}
        >
          {/* Row A — the head */}
          <View
            style={[
              styles.bandHead,
              { minHeight: Math.max(22, overlineHeight + 8) },
            ]}
          >
            <View style={[styles.spine, { backgroundColor: accent }]} />
            {statusLoading ? (
              <Skeleton width={140} height={overlineHeight} radius="sm" />
            ) : (
              <ThemedText
                variant="overline"
                color={accent}
                style={[styles.bandOverline, !isMM && styles.upper]}
              >
                {unknown
                  ? t.home.hero.eyebrowUnknown
                  : isMember
                    ? t.home.hero.eyebrowMember
                    : t.home.hero.eyebrowGuest}
              </ThemedText>
            )}
          </View>

          <View style={isTablet ? styles.bandSplit : undefined}>
            {/* Row B — the measure. Same reserved height in EVERY state. */}
            <View
              style={[
                styles.bandMeasure,
                { minHeight: displayHeight },
                isTablet && styles.bandSplitLeft,
              ]}
            >
              {statusLoading ? (
                <Skeleton width={120} height={displayHeight} radius="sm" />
              ) : unknown ? (
                // `section`, a rank below the guest pitch's `title` and two
                // below the member's `display`: "we don't know" is the one
                // thing in this band that must not shout. It also fits the
                // string on one line inside the reserved `display` height, so
                // resolving into this state still moves nothing.
                <ThemedText
                  variant="section"
                  color={theme.colors.textMuted}
                  numberOfLines={2}
                >
                  {t.home.hero.statusUnknown}
                </ThemedText>
              ) : isMember && days !== null && days > 0 ? (
                <>
                  {/* `text`, not `accent`. Emerald is the wallet's colour and a
                      real kyat balance is printed in it a screen-inch below;
                      the day count is a duration, and it is also the biggest
                      thing a paying member sees, so it must not read as a
                      receipt. The state still speaks — through the spine and
                      the lit run of the ruler. */}
                  <ThemedText
                    variant="display"
                    tabular
                    color={urgent ? accent : theme.colors.text}
                  >
                    {String(days)}
                  </ThemedText>
                  <ThemedText
                    variant="muted"
                    color={theme.colors.textMuted}
                    style={styles.measureUnit}
                  >
                    {daysUnit}
                  </ThemedText>
                </>
              ) : isMember ? (
                <ThemedText variant="title" color={accent}>
                  {measureLabel}
                </ThemedText>
              ) : (
                <ThemedText variant="title">
                  {t.home.hero.guestMeasure}
                </ThemedText>
              )}
            </View>

            {/* Row C — the rail and the until line. Skipped entirely, rather
                than left hollow, in the one state that has neither: an active
                member whose expiry the API did not return. */}
            {(statusLoading || showRuler || showUntil) && (
              <View
                style={[styles.bandRail, isTablet && styles.bandSplitRight]}
              >
                {(statusLoading || showRuler) && (
                  <Ruler
                    {...rulerProps}
                    lit={
                      statusLoading || !isMember || days === null
                        ? 0
                        : clamp(days, 0, RULER_SLOTS)
                    }
                    accent={accent}
                    unlitWeek={
                      guest
                        ? withAlpha(theme.colors.premium, 0.2)
                        : theme.colors.borderStrong
                    }
                    unlitDay={theme.colors.border}
                    overflowing={
                      isMember && days !== null && days > RULER_SLOTS
                    }
                  />
                )}

                {statusLoading ? (
                  <Skeleton width={170} height={captionHeight} radius="sm" />
                ) : unknown ? (
                  <View style={styles.untilRow}>
                    <Ionicons
                      name="cloud-offline-outline"
                      size={13}
                      color={theme.colors.textMuted}
                    />
                    <ThemedText
                      variant="caption"
                      numberOfLines={2}
                      style={styles.untilText}
                    >
                      {t.home.hero.statusUnknownHint}
                    </ThemedText>
                  </View>
                ) : isMember ? (
                  untilLine && (
                    <View style={styles.untilRow}>
                      <Ionicons
                        name="time-outline"
                        size={13}
                        color={theme.colors.text}
                      />
                      {/* Two lines in BOTH scripts. "Renew to keep watching ·
                          until 13 Sep 2026" passes the available measure around
                          120% text, and truncating it deletes exactly the
                          information this treatment exists to add. */}
                      <ThemedText
                        variant="caption"
                        tabular
                        color={theme.colors.text}
                        numberOfLines={2}
                        style={styles.untilText}
                      >
                        {untilLine}
                      </ThemedText>
                    </View>
                  )
                ) : (
                  <View style={styles.untilRow}>
                    <Ionicons
                      name="wallet-outline"
                      size={13}
                      color={theme.colors.textMuted}
                    />
                    <ThemedText
                      variant="caption"
                      numberOfLines={2}
                      style={styles.untilText}
                    >
                      {t.home.hero.guestUntil}
                    </ThemedText>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </FadeInView>

      {/* ---- 3.5 + 3.6 — actions and proof, as ONE group ---- */}
      <FadeInView
        from="bottom"
        delay={400}
        style={[styles.column, { maxWidth: contentWidth }]}
      >
        <View style={[styles.actions, stackedActions && styles.actionsStacked]}>
          {statusLoading ? (
            <>
              {/* Both at one size, and in row mode carried by the same flex
                  rule as the buttons: a placeholder that is not the shape of
                  the thing it stands in for makes the resolve look like a
                  layout jump even when the height never changes. */}
              <View style={stackedActions ? styles.column : styles.action}>
                <Skeleton width="100%" height={buttonHeight} radius="2xl" />
              </View>
              <View style={stackedActions ? styles.column : styles.action}>
                <Skeleton width="100%" height={buttonHeight} radius="2xl" />
              </View>
            </>
          ) : guest ? (
            <>
              {/* VIOLET, not gold. Gold is the offer's frame; violet is what a
                  tap does. A solid gold pill sitting inside the gold bloom is
                  the same gold-on-gold pairing that made the old member pill
                  disappear, and it left the guest state with no single mark
                  that stops the eye. */}
              <Button
                title={t.home.hero.primaryCta}
                icon="sparkles"
                size="lg"
                onPress={onSubscribe}
                fullWidth={stackedActions}
                style={stackedActions ? undefined : styles.action}
              />
              {/* `outline`, not `ghost`: a borderless transparent pill with a
                  muted label next to a 54pt solid one reads as a caption, not
                  as the second of two destinations. */}
              {browseMovies("outline")}
            </>
          ) : (
            // Member AND unknown: browse only. Nothing here sells a
            // subscription to somebody we could not ask about.
            <>
              {browseMovies("solid")}
              <Button
                title={t.home.cta.browseSeries}
                icon="tv-outline"
                variant="outline"
                size="lg"
                onPress={onBrowseSeries}
                fullWidth={stackedActions}
                style={stackedActions ? undefined : styles.action}
              />
            </>
          )}
        </View>

        <ProofRow points={t.home.hero.proofPoints} stacked={stackedProof} />
      </FadeInView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    // The page's own paper. NOT surfaceSunken — a darker slab under an opaque
    // navy app bar reads as a pasted panel instead of the top of the page.
    backgroundColor: theme.colors.background,
    // Content flows DOWN, and the box only ever grows.
    justifyContent: "flex-start",
    // Required only so the film rail is cropped by the trim.
    overflow: "hidden",
    paddingBottom: theme.spacing.xl + 28,
  },
  column: { width: "100%" },

  /* --- L3, the film rail --- */
  filmRail: {
    position: "absolute",
    top: 88,
    bottom: 128,
    width: 7,
    justifyContent: "space-between",
    alignItems: "center",
  },
  sprocket: { width: 7, height: 12, borderRadius: 2 },

  /* --- 3.1 / 3.2 --- */
  leadRule: {
    width: 56,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.borderStrong,
    marginBottom: theme.spacing.sm,
  },
  leadRuleWide: { width: 88 },
  /** `letterSpacing` is an OVERRIDE of the overline token, not a new size. */
  eyebrow: { letterSpacing: 1.8, marginBottom: theme.spacing.md },
  /** English only: a no-op in Burmese that can disturb shaping on some Androids. */
  upper: { textTransform: "uppercase" },

  /* --- 3.3 --- */
  headlineBlock: { marginBottom: theme.spacing.md },
  lastLineRow: { flexDirection: "row", alignItems: "flex-end" },
  /** A long Burmese last line shortens the rule toward its 24pt floor rather
      than shaving it to a zero-width sliver. */
  lastLineText: { flexShrink: 1 },
  finishingRule: {
    flex: 1,
    minWidth: 24,
    height: 2,
    marginLeft: 12,
    borderRadius: 1,
    overflow: "hidden",
    transformOrigin: "left center",
  },

  /* --- 3.3b --- */
  subhead: { marginBottom: theme.spacing.lg },

  /* --- 3.4, the band --- */
  band: {
    width: "100%",
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  bandHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    marginBottom: 10,
  },
  /** Rhymes with AppTopBar's 4×18 crimson logoMark in GEOMETRY only — it is
      tinted by state, never by brand, and never repeats the wordmark. */
  spine: {
    width: 3,
    minHeight: 20,
    alignSelf: "stretch",
    borderRadius: theme.radius.pill,
  },
  bandOverline: { letterSpacing: 1.6, flexShrink: 1 },
  bandMeasure: {
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "wrap",
    rowGap: 6,
    marginBottom: 10,
  },
  measureUnit: { marginLeft: theme.spacing.sm, marginBottom: 4 },
  bandRail: { alignItems: "flex-start", gap: 8 },
  bandSplit: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.spacing.xl,
  },
  bandSplitLeft: { flex: 1, marginBottom: 0 },
  bandSplitRight: { alignItems: "flex-end" },
  rulerRow: { flexDirection: "row", alignItems: "flex-end", gap: TICK_GAP },
  rulerClip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
  },
  rulerOverflow: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 24,
  },
  untilRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  untilText: { flexShrink: 1 },

  /* --- 3.5 --- */
  actions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  actionsStacked: { flexDirection: "column", alignItems: "stretch" },
  // `flexBasis: 0` is the whole alignment fix. With `flexGrow` alone each button
  // keeps its CONTENT width and the pair only shares the leftover space, so
  // "Browse Movies" rendered visibly wider than "Browse Series" — two buttons
  // that are meant to be peers, set at two different sizes. Zeroing the basis
  // makes the split exact, whatever the labels say in either language.
  // Applied in ROW mode only: in a column `flexGrow` is vertical growth, which
  // is height the row never meant to give away.
  action: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 160 },

  /* --- 3.6 --- */
  proofRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
  },
  proofCellWrap: { flex: 1, flexDirection: "row", alignItems: "center" },
  proofCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 6,
  },
  proofDivider: { width: 1, height: 20, backgroundColor: theme.colors.border },
  proofLabel: { flexShrink: 1 },
  proofColumn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
  },
  proofStackCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.md - 4,
  },
  proofStackDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
});
