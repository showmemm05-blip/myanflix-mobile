import { createContext, useMemo, useState, type ReactNode, type Ref, type RefObject } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type StyleProp,
  type ViewInstance,
  type ViewStyle,
} from "react-native";
import { KeyboardLiftScrollView } from "@/components/common/KeyboardLiftScrollView";
import type { KeyboardLiftBlock } from "@/hooks/useKeyboardLift";
import { LotteryTopBar, type LotteryTopBarProps } from "@/lottery/components/LotteryTopBar";
import { useLtClearance } from "@/lottery/hooks/useLtClearance";
import { LT, LT_LAYOUT, LT_SPACE } from "@/lottery/theme/tokens";

/**
 * The buy bar reports its COVER here: how far its top edge stands above the
 * page's keyboard-free bottom edge — above the window's bottom while the
 * keyboard is down, above the keyboard's top (or the shrunken window's
 * bottom) while it rides on the keyboard. The screen keeps that much, plus
 * air, clear under its content and tells the keyboard lift about it, so the
 * ticket's Add row can never end up under the bar. A bar reports 0 as it
 * unmounts; no bar, no report.
 */
export const BuyBarCoverContext = createContext<(cover: number) => void>(() => {});

export interface LotteryScreenProps {
  topBar: LotteryTopBarProps;
  children?: ReactNode;
  /** The page footer (LotteryFooter), last in the column. */
  footer?: ReactNode;
  /** Draw and DreamTickets: the content clears the buy bar too (212 above the inset, not 100). */
  withBuyBar?: boolean;
  /** Drawn over the page after the scroll view — the BuyBar. */
  overlay?: ReactNode;
  scrollRef?: Ref<ScrollViewInstance>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Extra style for the 560pt content column (e.g. a different top padding). */
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Draw: the block round the typed-on ticket (label, ticket, help line, Quick
   * pick · Clear, Add), kept whole above the keyboard and the buy bar riding
   * on it — the keyboard lift's `block`.
   */
  keyboardBlock?: RefObject<ViewInstance | null>;
}

/**
 * THE LOTTERY PAGE SHELL (lt-base `.lt-main`): warm paper, the Lottery top bar
 * IN FLOW above the scroll (it never scrolls away), then one column — 16pt
 * gutters, at most 560 wide and centred on tablets, 32pt between sections,
 * 16 on top — whose bottom clears the floating dock (or the dock + buy bar)
 * on this device.
 *
 * Typing: taps on buttons go through while the keyboard is up, a drag
 * dismisses it, and the focused field is kept above the keyboard (the app's
 * KeyboardLiftScrollView; iOS also pads with KeyboardAvoidingView, as the app's
 * own screens do). The dock steps aside by itself (LotteryDock).
 *
 * With a buy bar the bottom padding is the larger of the board's 212 and the
 * bar's measured cover plus air (BuyBarCoverContext): while the keyboard is
 * up the bar rides on it, and the lift keeps the focused field — on Draw the
 * whole ticket block — above the bar, not only above the keyboard.
 */
export function LotteryScreen({
  topBar,
  children,
  footer,
  withBuyBar = false,
  overlay,
  scrollRef,
  onScroll,
  contentStyle,
  keyboardBlock,
}: LotteryScreenProps) {
  const clearance = useLtClearance();
  const [barCover, setBarCover] = useState(0);
  const liftBlock = useMemo<KeyboardLiftBlock | undefined>(
    () => (keyboardBlock ? { ref: keyboardBlock, clearance: LT_LAYOUT.contentAir } : undefined),
    [keyboardBlock],
  );
  // iOS's KeyboardAvoidingView and Android's resize (or the lift's pad) already
  // keep the keyboard itself out of the content: only the bar above it is added.
  const paddingBottom = withBuyBar ? Math.max(clearance.bar, barCover + LT_LAYOUT.contentAir) : clearance.dock;
  return (
    <BuyBarCoverContext.Provider value={setBarCover}>
      <View style={styles.screen}>
        <LotteryTopBar {...topBar} />
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <KeyboardLiftScrollView
            ref={scrollRef}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            style={styles.fill}
            contentContainerStyle={{ paddingBottom }}
            keyboardObstruction={barCover}
            liftBlock={liftBlock}
          >
            <View style={[styles.column, contentStyle]}>
              {children}
              {footer}
            </View>
          </KeyboardLiftScrollView>
        </KeyboardAvoidingView>
        {overlay}
      </View>
    </BuyBarCoverContext.Provider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: LT.paper },
  fill: { flex: 1 },
  column: {
    width: "100%",
    maxWidth: LT_SPACE.contentMax,
    alignSelf: "center",
    paddingTop: LT_SPACE.s4,
    paddingHorizontal: LT_SPACE.gutter,
    gap: LT_SPACE.section,
  },
});
