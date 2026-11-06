import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useWallet } from "@/hooks/useWallet";
import { COMPONENT_COPY } from "@/lottery/components/copy";
import { LeaveSheet } from "@/lottery/components/LeaveSheet";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LtEmblem } from "@/lottery/components/Ornaments";
import { LT_COPY } from "@/lottery/copy";
import { ks } from "@/lottery/data/format";
import { LT, LT_LAYOUT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

export interface LotteryTopBarProps {
  /**
   * root — every tab page: the emblem chip ("MyanFlix", which opens the
   * "Leave the lottery?" sheet) and the balance chip.
   * page — a page pushed inside a tab (Check my tickets): its own back link
   * and a two-line title.
   * detail — a page pushed inside a tab, the cleaner form (both dream pages,
   * canvas "Dream detail, simpler", owner 3 Nov 2026): a round back button,
   * one centred line ("Dream Number 1000"), the balance chip.
   */
  variant: "root" | "page" | "detail";
  /** page: the back link's word ("Home", "Dreams"). */
  backLabel?: string;
  /** page / detail: the back control's spoken name; defaults to "Back to {backLabel}". */
  backA11y?: string;
  /** page / detail: overrides what back does (one page back by default). */
  onBack?: () => void;
  /** page: a kicker over a Literata 18 title ("Dream Number" / "1000"); detail: the two words on one line. */
  title?: { pre: string; big: string };
}

/** Under this width the emblem chip keeps its emblem only (it keeps its spoken name). */
const NARROW = 360;

/**
 * THE LOTTERY'S TOP BAR (lt-base 5 `.lt-top`): 56pt on warm paper under the
 * status bar, a hairline below — IN the layout flow above the scroll view
 * (LotteryScreen), which is what "sticky" means here. The Lottery is its own
 * white app: this bar replaces the MyanFlix bar entirely.
 *
 * Its left end has NO back arrow (owner, 23 Oct 2026: users tapped the bare
 * "‹" by accident and lost their place in the lottery). In its place the
 * emblem chip (board `.lt-brandchip`): the seal emblem and the word "MyanFlix"
 * in one quiet pill, which opens the "Leave the lottery?" sheet — the hub,
 * MyanFlix, the wallet, or stay. A page pushed inside a tab keeps its own
 * "‹ Home" link: that is in-page navigation, not a way out.
 *
 * The balance chip (the MyanFlix wallet, hooks/useWallet — "—" until it has
 * loaded) only shows the balance: it opens nothing (owner, 27 Oct 2026 — the
 * wallet page is the Leave sheet's "Wallet" row now). It is 32pt; the emblem
 * chip is 36 with a 4pt slop. There is no profile avatar (owner, 27 Oct
 * 2026): the account lives in MyanFlix, not in the Lottery.
 *
 * The emblem chip drops the keyboard before its sheet opens (as the Draw
 * page's openConfirm does): on the Draw tab the ticket input keeps focus on
 * purpose, and on iOS a transparent Modal leaves it first responder, so the
 * number pad would stay up over the bottom sheet and hide its rows.
 */
export function LotteryTopBar({ variant, backLabel, backA11y, onBack, title }: LotteryTopBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const wallet = useWallet();
  const balance = wallet.data?.balance;
  const [leaveOpen, setLeaveOpen] = useState(false);
  const root = variant === "root";
  const detail = variant === "detail";

  const back = onBack ?? (() => navigation.goBack());
  const backWord = backLabel ?? COMPONENT_COPY.topBar.back;
  const chipWord = width >= NARROW;

  return (
    <View style={[styles.bar, { paddingTop: insets.top, height: insets.top + LT_LAYOUT.topBarH }]}>
      {/* The side insets only matter held sideways (a notch or rounded corner at the side). */}
      {/* detail (canvas `.lt-top--clean`): 12pt gaps and a 12pt right gutter, so the chip sits where the board draws it. */}
      <View
        style={[
          styles.row,
          detail && styles.detailRow,
          { paddingLeft: 16 + insets.left, paddingRight: (detail ? 12 : 16) + insets.right },
        ]}
      >
        {root ? (
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setLeaveOpen(true);
            }}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={LT_COPY.leave.chipA11y}
            accessibilityHint={LT_COPY.leave.chipHint}
            accessibilityState={{ expanded: leaveOpen }}
            style={({ pressed }) => [
              styles.chip,
              !chipWord && styles.chipEmblemOnly,
              (pressed || leaveOpen) && styles.chipPressed,
            ]}
          >
            {({ pressed }) => (
              <>
                <LtEmblem size={24} />
                {chipWord ? (
                  <LtText
                    role="metaB"
                    color={pressed || leaveOpen ? LT.ink : LT.ink2}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.3}
                  >
                    {LT_COPY.leave.chip}
                  </LtText>
                ) : null}
              </>
            )}
          </Pressable>
        ) : detail ? (
          <>
            <Pressable
              onPress={back}
              accessibilityRole="button"
              accessibilityLabel={backA11y ?? (backLabel ? COMPONENT_COPY.topBar.backA11y(backLabel) : backWord)}
              hitSlop={4}
              style={({ pressed }) => [styles.backDisc, pressed && styles.backDiscPressed]}
            >
              <LtIcon name="back" size={20} color={LT.ink} />
            </Pressable>
            <View style={styles.detailTitle} accessible accessibilityRole="header" accessibilityLabel={title ? `${title.pre} ${title.big}` : undefined}>
              {title ? (
                <LtText
                  role="h"
                  style={styles.detailLine}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                >
                  {`${title.pre} ${title.big}`}
                </LtText>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <Pressable
              onPress={back}
              accessibilityRole="button"
              accessibilityLabel={backA11y ?? (backLabel ? COMPONENT_COPY.topBar.backA11y(backLabel) : backWord)}
              hitSlop={{ top: 6, bottom: 6 }}
              style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
            >
              <LtIcon name="back" size={20} color={LT.ink2} />
              <LtText role="metaB" color={LT.ink2} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {backWord}
              </LtText>
            </Pressable>
            <View
              style={styles.pageTitle}
              accessible
              accessibilityRole="header"
              accessibilityLabel={title ? `${title.pre} ${title.big}` : undefined}
            >
              {title ? (
                <>
                  <LtText role="kicker" numberOfLines={1} maxFontSizeMultiplier={1.3}>
                    {title.pre}
                  </LtText>
                  <LtText role="h" style={styles.pageBig} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                    {title.big}
                  </LtText>
                </>
              ) : null}
            </View>
          </>
        )}

        <View style={styles.end}>
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={balance === undefined ? LT_COPY.balanceLoadingA11y : LT_COPY.balanceA11y(ks(balance))}
            style={styles.balance}
          >
            <LtText role="buttonSm" tabular numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {balance === undefined ? "—" : ks(balance)}
            </LtText>
          </View>
        </View>
      </View>

      {root ? <LeaveSheet visible={leaveOpen} onClose={() => setLeaveOpen(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: LT.paper,
    borderBottomWidth: 1,
    borderBottomColor: LT.line,
    zIndex: 40,
  },
  row: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  detailRow: { gap: 12 },
  /**
   * Board `.lt-brandchip`: emblem 24 + "MyanFlix" (600 14/20 ink-2) in one
   * pill, 36 tall (44 with the slop), cream-1 under a 1pt line; pressed or
   * open = cream-2 under line-strong, the word in full ink.
   */
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: LT_RADIUS.round,
    backgroundColor: LT.cream1,
    borderWidth: 1,
    borderColor: LT.line,
  },
  chipEmblemOnly: { paddingRight: 6 },
  chipPressed: { backgroundColor: LT.cream2, borderColor: LT.lineStrong },
  /** lt-base `.lt-back`: pulled 6 into the gutter with no left padding, so the chevron sits where the board draws it. */
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 44,
    marginLeft: -6,
    paddingRight: 6,
    borderRadius: LT_RADIUS.button,
  },
  backPressed: { backgroundColor: LT.cream },
  /** detail (canvas `.lt-backdisc`): a 40 white disc under a line-strong ring, the chevron in full ink. */
  backDisc: {
    width: 40,
    height: 40,
    marginLeft: -4,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.lineStrong,
    boxShadow: LT_SHADOW.s1,
  },
  backDiscPressed: { backgroundColor: LT.cream },
  /** detail: the one line sits centred in whatever is left between the disc and the chip, never touching either. */
  detailTitle: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  /** Literata 700 18/24, tabular so "1000" and "100" keep their width. */
  detailLine: { fontSize: 18, lineHeight: 24, textAlign: "center" },
  pageTitle: {
    justifyContent: "center",
    minWidth: 0,
    minHeight: 44,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: LT.line,
    flexShrink: 1,
  },
  pageBig: { fontSize: 18, lineHeight: 22 },
  end: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 },
  balance: {
    height: 32,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: LT_RADIUS.round,
    backgroundColor: LT.cream,
    borderWidth: 1,
    borderColor: LT.line,
    boxShadow: LT_SHADOW.s1,
  },
});
