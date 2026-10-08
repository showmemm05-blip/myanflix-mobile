import { memo, useMemo, type ReactNode } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
// Deep import, not the "@expo/vector-icons" root (HubHero explains).
import Ionicons from "@expo/vector-icons/Ionicons";
import { CrownGlyph } from "@/components/common/CrownGlyph";
import { Skeleton } from "@/components/common/Skeleton";
import { BookCover, bookCorners } from "@/components/books/BookCover";
import { HubFallbackArt } from "@/components/hub/HubFallbackArt";
import { HUB_SECTION_GAP, hasMyanmar, joinMeta } from "@/components/hub/hubLayout";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PressableScale } from "@/components/ui/PressableScale";
import { ThemedText } from "@/components/ui/ThemedText";
import { PromoArt } from "@/components/home/PromoArt";
import {
  BROWSE_OPTIONS,
  HOME_ROW_LIMIT,
  PAY_METHODS,
  bestValuePlanId,
  displayAddress,
  isWebUrl,
  perDay,
  promoText,
  visiblePlans,
} from "@/components/home/homeData";
import { useBooksList } from "@/hooks/useBooks";
import { useSubscriptionPlans, useSubscriptionStatus } from "@/hooks/useSubscription";
import { useLanguage } from "@/localization/LanguageProvider";
import { formatDuration } from "@/utils/format";
import { formatKyat } from "@/utils/currency";
import { theme, withAlpha } from "@/theme";
import type { HomeSettings, ShowcasePromo, ShowcaseSpotlight, ShowcaseTitle } from "@/types/home";

/**
 * THE SHOWCASE SECTIONS of Home (owner, 2026-10-08 — HomeMobile.dc.html):
 * the browse chips over the hero, the "Why MyanFlix" value strip, the
 * spotlight banner, the Premium band, the books band, the coming-soon strip
 * and the "Also on the web" card. The existing rows live in HomeRows.tsx.
 *
 * Copy is TRUE by rule (owner's defaults, 2026-10-08): Premium sells "every
 * Premium movie and series"; books are "free to read when you sign in"; the
 * plans and prices are the real ones from GET /subscription-plans (never
 * typed in here); anything editorial — the spotlight, coming-soon cards, the
 * games date, the web address — comes from the admin "Home promos" page, and
 * a section with nothing set simply does not render.
 */

/** Every section under the hero keeps the hubs' rhythm; the first one sits closer. */
function sectionStyle(first: boolean | undefined): StyleProp<ViewStyle> {
  return first ? styles.firstSection : styles.section;
}

/** "{n} days" / "1 day" — the Subscribe screen's own wording. */
function useDaysLabel() {
  const { t } = useLanguage();
  return (days: number) =>
    days === 1 ? t.subscription.planDurationOne : t.subscription.planDuration.replace("{n}", String(days));
}

/* ------------------------------------------------------------------ */
/* Payment chips                                                        */
/* ------------------------------------------------------------------ */

/**
 * The ways to add money as small chips with their colour dot. "art":
 * over a hero scene (the dark glass chip); "panel": inside the Premium band.
 */
export const PayChips = memo(function PayChips({ tone }: { tone: "art" | "panel" }) {
  const { t } = useLanguage();
  const names = PAY_METHODS.map((method) => method.name);
  return (
    <View
      style={styles.payChips}
      accessible
      accessibilityLabel={t.home.payMethodsA11y.replace("{list}", names.join(", "))}
    >
      {PAY_METHODS.map((method) => (
        <View key={method.name} style={[styles.payChip, tone === "art" ? styles.payChipArt : styles.payChipPanel]}>
          <View style={[styles.payDot, { backgroundColor: method.dot }]} />
          <ThemedText variant="label" weight="bold" color={tone === "art" ? theme.colors.text : theme.colors.textBody}>
            {method.name}
          </ThemedText>
        </View>
      ))}
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Why MyanFlix — the value strip                                       */
/* ------------------------------------------------------------------ */

/** The board's stroke icons (24 × 24). */
const VALUE_ICONS = {
  stories:
    "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4",
  hd: "M5 12.5a7 7 0 0 1 14 0M8.5 16a3.5 3.5 0 0 1 7 0M12 19.5h.01M2 9a10 10 0 0 1 20 0",
  books: "M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5zM12 6v13.5",
  pay: "M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5zM15 12h2.5",
} as const;

/** Four static tiles in a rail (translated, no request). */
export const ValueStrip = memo(function ValueStrip({ first }: { first?: boolean }) {
  const { t } = useLanguage();
  const tiles = [
    { key: "stories", icon: VALUE_ICONS.stories, title: t.home.valueStoriesTitle, line: t.home.valueStoriesLine },
    { key: "hd", icon: VALUE_ICONS.hd, title: t.home.valueHdTitle, line: t.home.valueHdLine },
    { key: "books", icon: VALUE_ICONS.books, title: t.home.valueBooksTitle, line: t.home.valueBooksLine },
    { key: "pay", icon: VALUE_ICONS.pay, title: t.home.valuePayTitle, line: t.home.valuePayLine },
  ];
  return (
    <View style={first ? styles.valueFirst : styles.section}>
      <SectionHeader eyebrow={t.home.whyKicker} title={t.home.whyTitle} titleLines={3} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {tiles.map((tile) => (
          <View key={tile.key} style={styles.valueTile} accessible accessibilityLabel={`${tile.title}: ${tile.line}`}>
            <View style={styles.valueIcon}>
              <Svg width={22} height={22} viewBox="0 0 24 24" pointerEvents="none">
                <Path
                  d={tile.icon}
                  fill="none"
                  stroke={theme.colors.link}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={styles.valueText}>
              <ThemedText weight="extrabold" style={styles.valueTitle}>
                {tile.title}
              </ThemedText>
              <ThemedText variant="caption" weight="regular" color={theme.colors.textMuted} numberOfLines={3}>
                {tile.line}
              </ThemedText>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Spotlight                                                            */
/* ------------------------------------------------------------------ */

const SPOTLIGHT_FOOT = [
  withAlpha(theme.colors.background, 0),
  withAlpha(theme.colors.background, 0.78),
  withAlpha(theme.colors.background, 0.94),
] as const;

/** The spotlight's landscape picture: the promo's own upload, else the title's widest art. */
function spotlightImage(spotlight: ShowcaseSpotlight): string | null {
  const title = spotlight.title;
  return spotlight.promo?.imageUrl ?? title.coverUrl ?? title.thumbnailUrl ?? title.posterUrl ?? null;
}

/**
 * The "New this week" banner (board section 4): the team's SPOTLIGHT pick
 * (its kicker, line and picture when set), or — when none is set — the
 * newest published movie, said so plainly ("Just added"). Nothing at all →
 * nothing rendered.
 */
export const SpotlightBanner = memo(function SpotlightBanner({
  spotlight,
  onPrimary,
  onDetails,
  first,
}: {
  spotlight: ShowcaseSpotlight | null;
  onPrimary: (title: ShowcaseTitle) => void;
  onDetails: (title: ShowcaseTitle) => void;
  first?: boolean;
}) {
  const { t, language } = useLanguage();
  if (!spotlight) return null;
  const { promo, title } = spotlight;
  const picked = spotlight.source === "PROMO";
  const chip = (promo && promoText(language, promo.kickerEn, promo.kickerMm)) ?? (picked ? t.home.spotlightChip : t.home.spotlightNewestChip);
  const aside = picked ? t.home.spotlightPicked : t.home.spotlightNewest;
  const line = (promo && promoText(language, promo.bodyEn, promo.bodyMm)) ?? (title.description || null);
  const meta = joinMeta([
    title.type === "BOOK" ? title.author : null,
    title.releaseYear && title.releaseYear > 0 ? title.releaseYear : null,
    title.genre,
    title.type === "MOVIE" ? formatDuration(title.durationMinutes) : null,
  ]);
  const isBook = title.type === "BOOK";
  const primaryLabel =
    (promo && promoText(language, promo.ctaLabelEn, promo.ctaLabelMm)) ?? (isBook ? t.home.read : t.player.play);
  const image = spotlightImage(spotlight);

  return (
    <View style={[sectionStyle(first), styles.inset]} accessibilityLabel={t.home.spotlightA11y}>
      <View style={styles.spotlight}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {image ? (
            <Image
              source={{ uri: image }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              accessible={false}
            />
          ) : (
            <HubFallbackArt seed={title.id} format="landscape" />
          )}
          <LinearGradient colors={SPOTLIGHT_FOOT} locations={[0, 0.45, 1]} style={styles.spotlightFoot} />
        </View>
        <View style={styles.spotlightCopy}>
          <View style={styles.spotlightTags} accessible accessibilityLabel={`${chip}, ${aside}`}>
            <View style={styles.spotlightChip}>
              <ThemedText variant="label" weight="extrabold" color={theme.colors.onPrimary} style={styles.noTrack}>
                {chip}
              </ThemedText>
            </View>
            <ThemedText variant="caption" weight="extrabold" color={theme.colors.link} style={styles.shrink}>
              {aside}
            </ThemedText>
          </View>
          <ThemedText
            weight="black"
            accessibilityRole="header"
            maxFontSizeMultiplier={1.5}
            style={[styles.spotlightTitle, hasMyanmar(title.title) && styles.spotlightTitleMyanmar]}
            numberOfLines={2}
          >
            {title.title}
          </ThemedText>
          {line ? (
            <ThemedText variant="muted" color={theme.colors.textBody} numberOfLines={2} style={styles.gap4}>
              {line}
            </ThemedText>
          ) : null}
          {meta ? (
            <ThemedText variant="caption" color={theme.colors.textMuted} tabular numberOfLines={1} style={styles.gap4}>
              {meta}
            </ThemedText>
          ) : null}
          <View style={styles.spotlightActions}>
            <Pressable
              onPress={() => onPrimary(title)}
              accessibilityRole="button"
              accessibilityLabel={t.hub.actionTitleA11y.replace("{action}", primaryLabel).replace("{title}", title.title)}
              style={({ pressed }) => [styles.spotlightPlay, pressed && styles.pressed]}
            >
              <Ionicons name={isBook ? "book-outline" : "play"} size={18} color={theme.colors.onPlay} />
              <ThemedText weight="extrabold" color={theme.colors.onPlay} numberOfLines={1} style={styles.shrink}>
                {primaryLabel}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => onDetails(title)}
              accessibilityRole="button"
              accessibilityLabel={t.hub.moreAbout.replace("{title}", title.title)}
              style={({ pressed }) => [styles.spotlightInfo, pressed && styles.pressed]}
            >
              <Ionicons name="information-circle-outline" size={22} color={theme.colors.text} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Premium band                                                         */
/* ------------------------------------------------------------------ */

/**
 * The real plans side by side (BEST VALUE on the longest), what a plan
 * includes (true copy), gold Subscribe + tonal Add money with the payment
 * chips. A subscriber sees "Your plan · expires <date>" and Extend. A guest
 * gets the pitch and "Sign in to subscribe" — GET /subscription-plans is
 * members-only, so a guest is never shown (or asked for) prices.
 */
export const PremiumBand = memo(function PremiumBand({
  signedIn,
  onSubscribe,
  onAddMoney,
  onSignIn,
  first,
}: {
  signedIn: boolean;
  onSubscribe: () => void;
  onAddMoney: () => void;
  onSignIn: () => void;
  first?: boolean;
}) {
  const { t } = useLanguage();
  const daysLabel = useDaysLabel();
  const plansQuery = useSubscriptionPlans({ enabled: signedIn });
  const statusQuery = useSubscriptionStatus({ enabled: signedIn });
  const plans = useMemo(() => visiblePlans(plansQuery.data), [plansQuery.data]);
  const bestId = bestValuePlanId(plans);
  const status = signedIn ? statusQuery.data : undefined;
  const subscribed = !!status?.isActive;

  let planBlock: ReactNode = null;
  if (signedIn) {
    if (plansQuery.isLoading) {
      planBlock = (
        <View style={styles.plans} accessible accessibilityRole="progressbar" accessibilityLabel={t.common.loading}>
          <Skeleton height={132} radius="lg" style={styles.planCell} />
          <Skeleton height={132} radius="lg" style={styles.planCell} />
        </View>
      );
    } else if (plans.length === 0) {
      planBlock = (
        <ThemedText variant="caption" color={theme.colors.textMuted} style={styles.gap16}>
          {plansQuery.isError ? t.home.plansUnavailable : t.subscription.noPlans}
        </ThemedText>
      );
    } else {
      planBlock = (
        <View style={styles.plans}>
          {plans.map((plan) => {
            const best = plan.id === bestId;
            const price = formatKyat(plan.price);
            const days = daysLabel(plan.durationDays);
            const day = perDay(plan);
            const dayLine = (day.exact ? t.home.planPerDay : t.home.planPerDayAbout).replace("{price}", formatKyat(day.amount));
            const a11y = (best ? t.home.planBestA11y : t.home.planA11y)
              .replace("{name}", plan.name)
              .replace("{price}", price)
              .replace("{days}", days);
            return (
              <View key={plan.id} style={[styles.planCell, styles.plan, best && styles.planBest]} accessible accessibilityLabel={a11y}>
                <View style={styles.planHead}>
                  <ThemedText
                    variant="caption"
                    weight="extrabold"
                    color={best ? theme.colors.premium : theme.colors.textMuted}
                    numberOfLines={1}
                    style={styles.shrink}
                  >
                    {plan.name.toUpperCase()}
                  </ThemedText>
                  {best ? (
                    <View style={styles.bestBadge}>
                      <ThemedText variant="overline" color={theme.colors.onPremium} style={styles.noTrack}>
                        {t.home.bestValue.toUpperCase()}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText weight="black" tabular style={styles.planPrice}>
                  {price}
                </ThemedText>
                <ThemedText variant="caption" color={theme.colors.textMuted} tabular>
                  {`${t.home.planFor.replace("{days}", days)} · ${dayLine}`}
                </ThemedText>
                <View style={styles.planItems}>
                  {[t.home.planEveryPremium, t.home.planStreams].map((item) => (
                    <View key={item} style={styles.planItem}>
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={best ? theme.colors.premium : theme.colors.textMuted}
                        style={styles.planTick}
                      />
                      <ThemedText variant="caption" weight="regular" color={theme.colors.textBody} style={styles.shrink}>
                        {item}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      );
    }
  }

  return (
    <View style={[sectionStyle(first), styles.inset]}>
      <View style={styles.premium}>
        {/* The board's `linear-gradient(160deg, #1F1908 0%, #121217 55%)`. */}
        <LinearGradient
          colors={PREMIUM_WASH}
          locations={[0, 0.55]}
          start={PREMIUM_WASH_START}
          end={PREMIUM_WASH_END}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.premiumGlow} pointerEvents="none" />
        <View style={styles.premiumHead}>
          <View style={styles.premiumTag}>
            <CrownGlyph size={11} color={theme.colors.premium} />
            <ThemedText variant="overline" color={theme.colors.premium}>
              {t.movie.premium.toUpperCase()}
            </ThemedText>
          </View>
          <ThemedText variant="label" color={theme.colors.textFaint} numberOfLines={1} style={styles.shrink}>
            {t.home.premiumAside}
          </ThemedText>
        </View>
        <ThemedText variant="title" accessibilityRole="header" style={styles.gap10}>
          {t.home.premiumTitle}
        </ThemedText>
        <ThemedText variant="body" color={theme.colors.textBody} style={styles.gap6}>
          {t.home.premiumBody}
        </ThemedText>

        {planBlock}

        {subscribed && status ? (
          <View style={styles.yourPlan} accessible>
            <ThemedText variant="label" color={theme.colors.textFaint}>
              {t.home.yourPlan}
            </ThemedText>
            <ThemedText variant="muted" weight="bold" color={theme.colors.text} tabular>
              {status.expiresAt
                ? t.home.yourPlanLine
                    .replace("{plan}", status.planName ?? t.movie.premium)
                    .replace("{date}", new Date(status.expiresAt).toLocaleDateString())
                : (status.planName ?? t.subscription.active)}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.premiumActions}>
          {signedIn ? (
            <>
              <BandButton
                tone="gold"
                label={subscribed ? t.home.extend : t.home.ctaSubscribe}
                glyph={<CrownGlyph size={16} color={theme.colors.onPremium} />}
                onPress={onSubscribe}
              />
              <BandButton
                tone="tonal"
                label={t.subscription.addMoney}
                glyph={<Ionicons name="add" size={20} color={theme.colors.finance} />}
                onPress={onAddMoney}
              />
            </>
          ) : (
            <BandButton
              tone="gold"
              label={t.home.signInToSubscribe}
              glyph={<CrownGlyph size={16} color={theme.colors.onPremium} />}
              onPress={onSignIn}
            />
          )}
        </View>

        <View style={styles.gap14}>
          <PayChips tone="panel" />
        </View>
        <ThemedText variant="caption" weight="regular" color={theme.colors.textFaint} style={styles.gap10}>
          {`${t.home.premiumNote} ${t.home.booksFree}`}
        </ThemedText>
      </View>
    </View>
  );
});

function BandButton({
  tone,
  label,
  glyph,
  onPress,
}: {
  tone: "gold" | "tonal";
  label: string;
  glyph: ReactNode;
  onPress: () => void;
}) {
  const gold = tone === "gold";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.bandButton, gold ? styles.bandGold : styles.bandTonal, pressed && styles.pressed]}
    >
      {glyph}
      <ThemedText
        weight={gold ? "extrabold" : "bold"}
        color={gold ? theme.colors.onPremium : theme.colors.text}
        numberOfLines={2}
        style={styles.bandLabel}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Books band                                                           */
/* ------------------------------------------------------------------ */

/** The board's fanned covers: three 5:7 covers, tilted out from the middle. */
const FAN = [
  { left: 0, top: 22, rotate: "-12deg", z: 1 },
  { left: 29, top: 12, rotate: "-2deg", z: 2 },
  { left: 58, top: 18, rotate: "10deg", z: 3 },
] as const;
const FAN_COVER_WIDTH = 76;

/**
 * "Read on MyanFlix" (board section 8). Signed in: the three newest books
 * fanned out (the same GET /books the "New on the shelf" row under it uses —
 * one request for both) and "Open the shelf". A guest: drawn covers, the
 * pitch and "Sign in to read", with no /books call (it is members-only).
 * A signed-in catalogue with no books hides the band.
 */
export const BooksBand = memo(function BooksBand({
  signedIn,
  onOpenShelf,
  onSignIn,
  first,
}: {
  signedIn: boolean;
  onOpenShelf: () => void;
  onSignIn: () => void;
  first?: boolean;
}) {
  const { t } = useLanguage();
  const query = useBooksList({ limit: HOME_ROW_LIMIT }, { ...BROWSE_OPTIONS, enabled: signedIn });
  const books = query.data?.items;
  if (signedIn && query.isSuccess && (books?.length ?? 0) === 0) return null;
  const fan = signedIn ? (books ?? []).slice(0, FAN.length) : [];

  return (
    <View style={sectionStyle(first)}>
      <View style={[styles.inset]}>
        <View style={styles.booksBand}>
          <View style={styles.fan} accessible={false} importantForAccessibility="no-hide-descendants">
            {FAN.map((spot, i) => {
              // The front cover (the last) is the newest book.
              const book = fan[FAN.length - 1 - i];
              return (
                <View
                  key={i}
                  style={[
                    styles.fanCover,
                    bookCorners("sm"),
                    { left: spot.left, top: spot.top, zIndex: spot.z, transform: [{ rotate: spot.rotate }] },
                  ]}
                >
                  {book ? (
                    <BookCover title={book.title} coverUrl={book.coverUrl} style={styles.fill} />
                  ) : signedIn && query.isLoading ? (
                    <Skeleton height={Math.round(FAN_COVER_WIDTH * 1.4)} radius="sm" />
                  ) : (
                    <HubFallbackArt seed={`books-band-${i}`} format="poster" />
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.booksCopy}>
            <ThemedText variant="caption" weight="semibold" color={theme.colors.textFaint}>
              {t.books.title}
            </ThemedText>
            <ThemedText variant="title" accessibilityRole="header" style={styles.booksTitle}>
              {t.home.booksTitle}
            </ThemedText>
            <ThemedText variant="caption" weight="regular" color={theme.colors.textMuted} style={styles.gap6}>
              {t.home.booksPitch}
            </ThemedText>
            <Pressable
              onPress={signedIn ? onOpenShelf : onSignIn}
              accessibilityRole="button"
              accessibilityLabel={signedIn ? t.home.openShelf : t.home.signInToRead}
              style={({ pressed }) => [
                styles.booksButton,
                signedIn ? styles.booksButtonTonal : styles.booksButtonCrimson,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText variant="muted" weight={signedIn ? "bold" : "extrabold"} color={theme.colors.text}>
                {signedIn ? t.home.openShelf : t.home.signInToRead}
              </ThemedText>
              {signedIn ? <Ionicons name="chevron-forward" size={16} color={theme.colors.text} /> : null}
            </Pressable>
          </View>
        </View>
        <ThemedText variant="label" weight="regular" color={theme.colors.textFaint} style={styles.gap10}>
          {t.home.booksFree}
        </ThemedText>
      </View>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Coming soon                                                          */
/* ------------------------------------------------------------------ */

/** The Premium band's warm wash (board: 160deg, a gold-tinted dark into the surface). */
const PREMIUM_WASH = ["#1F1908", theme.colors.surface] as const;
const PREMIUM_WASH_START = { x: 0.33, y: 0.03 };
const PREMIUM_WASH_END = { x: 0.67, y: 0.97 };
const CARD_FOOT = [withAlpha(theme.colors.background, 0), withAlpha(theme.colors.background, 0.85)] as const;

/**
 * The live COMING_SOON promos as 200pt cards (the team's picture, else the
 * linked title's art, else the preset scene), each with its date chip when
 * the team gave one — then the games teaser when it is switched on in the
 * Home settings ("Coming soon" unless a date text is set). Empty → the
 * whole strip is gone.
 */
export const ComingSoonStrip = memo(function ComingSoonStrip({
  promos,
  settings,
  onPromo,
  first,
}: {
  promos: readonly ShowcasePromo[];
  settings: HomeSettings | null;
  onPromo: (promo: ShowcasePromo) => void;
  first?: boolean;
}) {
  const { t, language } = useLanguage();
  const games = !!settings?.gamesTeaserEnabled;
  if (promos.length === 0 && !games) return null;

  return (
    <View style={sectionStyle(first)}>
      <SectionHeader eyebrow={t.home.comingKicker} title={t.home.comingTitle} titleLines={2} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {promos.map((promo) => {
          const title = promoText(language, promo.titleEn, promo.titleMm) ?? "";
          const line = promoText(language, promo.bodyEn, promo.bodyMm);
          const note = promoText(language, promo.kickerEn, promo.kickerMm);
          const chip = promo.dateText?.trim() || t.home.comingSoonChip;
          const image =
            promo.imageUrl ?? promo.target?.coverUrl ?? promo.target?.thumbnailUrl ?? promo.target?.posterUrl ?? null;
          const actionable = promo.ctaTarget !== "NONE";
          return (
            <ComingCard
              key={promo.id}
              title={title}
              chip={chip}
              line={line}
              note={note}
              art={
                image ? (
                  <Image
                    source={{ uri: image }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                    accessible={false}
                  />
                ) : (
                  <PromoArt preset={promo.artPreset} frame="card" />
                )
              }
              onPress={actionable ? () => onPromo(promo) : undefined}
            />
          );
        })}
        {games ? (
          <ComingCard
            title={t.home.gamesTitle}
            chip={settings?.gamesTeaserDateText?.trim() || t.home.comingSoonChip}
            chipTone="crimson"
            line={t.home.gamesLine}
            note={null}
            art={<PromoArt preset="GAMES" frame="card" />}
          />
        ) : null}
      </ScrollView>
    </View>
  );
});

function ComingCard({
  title,
  chip,
  chipTone = "dark",
  line,
  note,
  art,
  onPress,
}: {
  title: string;
  chip: string;
  chipTone?: "dark" | "crimson";
  line: string | null;
  note: string | null;
  art: ReactNode;
  onPress?: () => void;
}) {
  const label = [title, chip, line, note].filter(Boolean).join(", ");
  const body = (
    <>
      <View style={styles.comingArt}>
        {art}
        <LinearGradient colors={CARD_FOOT} style={styles.comingFoot} pointerEvents="none" />
        <View style={[styles.comingChip, chipTone === "crimson" ? styles.comingChipCrimson : styles.comingChipDark]}>
          <ThemedText
            variant="label"
            weight="extrabold"
            color={chipTone === "crimson" ? theme.colors.link : theme.colors.textBody}
            numberOfLines={1}
            style={styles.noTrack}
          >
            {chip}
          </ThemedText>
        </View>
        <ThemedText
          weight="black"
          color={withAlpha(theme.colors.text, 0.86)}
          numberOfLines={2}
          style={[styles.comingTitle, hasMyanmar(title) && styles.comingTitleMyanmar]}
        >
          {hasMyanmar(title) ? title : title.toUpperCase()}
        </ThemedText>
      </View>
      {line ? (
        <ThemedText variant="muted" weight="bold" numberOfLines={2} style={styles.gap8}>
          {line}
        </ThemedText>
      ) : null}
      {note ? (
        <ThemedText variant="label" weight="regular" color={theme.colors.textFaint} numberOfLines={1}>
          {note}
        </ThemedText>
      ) : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.comingCard} accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.comingCard}>
      {body}
    </PressableScale>
  );
}

/* ------------------------------------------------------------------ */
/* Also on the web                                                      */
/* ------------------------------------------------------------------ */

/** The bottom card — only when the Home settings carry a web address. Opens it in the browser. */
export const AlsoOnWeb = memo(function AlsoOnWeb({ webUrl, first }: { webUrl: string | null; first?: boolean }) {
  const { t } = useLanguage();
  if (!isWebUrl(webUrl)) return null;
  const address = displayAddress(webUrl);
  return (
    <View style={[sectionStyle(first), styles.inset]}>
      <PressableScale
        onPress={() => void Linking.openURL(webUrl.trim()).catch(() => {})}
        accessibilityRole="link"
        accessibilityLabel={t.home.webOpenA11y.replace("{address}", address)}
        style={styles.web}
      >
        <View style={styles.webIcon}>
          <Ionicons name="desktop-outline" size={28} color={theme.colors.link} />
        </View>
        <View style={styles.shrinkFill}>
          <ThemedText weight="extrabold" style={styles.webTitle}>
            {t.home.webTitle}
          </ThemedText>
          <ThemedText variant="caption" weight="regular" color={theme.colors.textMuted} style={styles.gap2}>
            {t.home.webBody}
          </ThemedText>
          <View style={styles.webPill}>
            <ThemedText variant="label" weight="bold" color={theme.colors.textBody} numberOfLines={1}>
              {address}
            </ThemedText>
          </View>
        </View>
      </PressableScale>
    </View>
  );
});

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  section: { marginTop: HUB_SECTION_GAP },
  firstSection: { marginTop: 10 },
  /** The value strip opens the page under the hero's dots row (board: 28pt). */
  valueFirst: { marginTop: 20 },
  inset: { paddingHorizontal: theme.layout.screenPadding },
  rail: { paddingHorizontal: theme.layout.screenPadding, gap: 10 },
  shrink: { flexShrink: 1 },
  shrinkFill: { flex: 1, minWidth: 0 },
  fill: { width: "100%", height: "100%" },
  noTrack: { letterSpacing: 0 },
  gap2: { marginTop: 2 },
  gap4: { marginTop: 4 },
  gap6: { marginTop: 6 },
  gap8: { marginTop: 8 },
  gap10: { marginTop: 10 },
  gap14: { marginTop: 14 },
  gap16: { marginTop: 16 },
  pressed: { opacity: 0.8 },

  /* pay chips */
  payChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  payChip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 28, paddingHorizontal: 10, borderRadius: 14 },
  payChipArt: { backgroundColor: withAlpha(theme.colors.background, 0.6), borderWidth: 1, borderColor: theme.colors.borderStrong },
  payChipPanel: { backgroundColor: theme.colors.surfaceElevated },
  payDot: { width: 8, height: 8, borderRadius: 4 },

  /* value strip */
  valueTile: {
    width: 200,
    minHeight: 132,
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceElevated,
    justifyContent: "space-between",
    gap: 10,
  },
  valueIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: { gap: 4 },
  valueTitle: { fontSize: 15, lineHeight: 20 },

  /* spotlight */
  spotlight: {
    minHeight: 236,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
    justifyContent: "flex-end",
  },
  spotlightFoot: { position: "absolute", left: 0, right: 0, bottom: 0, height: "80%" },
  spotlightCopy: { padding: 16, paddingTop: 56 },
  spotlightTags: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  spotlightChip: {
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 6,
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  spotlightTitle: { marginTop: 8, fontSize: 26, lineHeight: 30, letterSpacing: -0.8 },
  spotlightTitleMyanmar: { lineHeight: 40, letterSpacing: 0 },
  spotlightActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  spotlightPlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.play,
    flexShrink: 1,
  },
  spotlightInfo: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.button,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.tonalStrong,
  },

  /* premium band */
  premium: {
    padding: 20,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.premium, 0.35),
  },
  premiumGlow: {
    position: "absolute",
    right: -60,
    top: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: withAlpha(theme.colors.premium, 0.12),
  },
  premiumHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  premiumTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.premiumSoft,
  },
  plans: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  /** Two per row. */
  planCell: { flexBasis: "47%", flexGrow: 1 },
  plan: { padding: 14, borderRadius: 14, backgroundColor: theme.colors.surfaceElevated },
  planBest: { borderWidth: 1.5, borderColor: theme.colors.premium },
  planHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, minHeight: 18 },
  bestBadge: {
    minHeight: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    justifyContent: "center",
    backgroundColor: theme.colors.premium,
  },
  planPrice: { marginTop: 4, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  planItems: { gap: 2, marginTop: 10 },
  planItem: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  planTick: { marginTop: 2 },
  yourPlan: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.premiumSoft,
    gap: 2,
  },
  premiumActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  bandButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.button,
  },
  bandGold: { backgroundColor: theme.colors.premium },
  bandTonal: { backgroundColor: theme.colors.tonalStrong },
  bandLabel: { fontSize: 16, flexShrink: 1, textAlign: "center" },

  /* books band */
  booksBand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 204,
    padding: 18,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  fan: { width: 134, height: 150 },
  fanCover: {
    position: "absolute",
    width: FAN_COVER_WIDTH,
    aspectRatio: 5 / 7,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceElevated,
    ...theme.shadow.md,
  },
  booksCopy: { flex: 1, minWidth: 0 },
  booksTitle: { marginTop: 4, fontSize: 22, lineHeight: 28 },
  booksButton: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.button,
  },
  booksButtonTonal: { backgroundColor: theme.colors.tonalStrong },
  booksButtonCrimson: { backgroundColor: theme.colors.primary },

  /* coming soon */
  comingCard: { width: 200 },
  comingArt: {
    width: 200,
    height: 150,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  comingFoot: { position: "absolute", left: 0, right: 0, bottom: 0, height: 90 },
  comingChip: {
    position: "absolute",
    left: 10,
    top: 10,
    maxWidth: 180,
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 6,
    justifyContent: "center",
  },
  comingChipDark: { backgroundColor: theme.colors.artBadge },
  comingChipCrimson: { backgroundColor: withAlpha(theme.colors.primary, 0.2) },
  comingTitle: { position: "absolute", left: 12, right: 12, bottom: 12, fontSize: 16, lineHeight: 18, letterSpacing: -0.3 },
  comingTitleMyanmar: { lineHeight: 26, letterSpacing: 0 },

  /* web */
  web: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceElevated,
  },
  webIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primarySoft,
  },
  webTitle: { fontSize: 17, lineHeight: 24 },
  webPill: {
    alignSelf: "flex-start",
    minHeight: 26,
    marginTop: 8,
    paddingHorizontal: 10,
    borderRadius: 13,
    justifyContent: "center",
    backgroundColor: theme.colors.tonalSoft,
  },
});
