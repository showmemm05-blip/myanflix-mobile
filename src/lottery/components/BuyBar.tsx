import { memo, useContext, useEffect, useState, type Ref } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type ViewInstance } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { BuyBarCoverContext } from "@/lottery/components/LotteryScreen";
import { LtButton } from "@/lottery/components/LtButton";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LT, LT_EASE, LT_LAYOUT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

/** The keyboard's own gap to the bar when the bar rides on it. */
const KEYBOARD_GAP = 12;

/**
 * THE BUY BAR (lt-base 5c; Draw and DreamTickets): a floating white panel
 * with the dock's side insets and max width, 12 above the dock — one caption
 * line ("Draw 24 · 1,000 Ks each" + the wallet) and the one red action.
 *
 * While the keyboard is up the dock steps aside and the bar drops into the
 * dock's place (`keyboardUp`, from `useKeyboardShown()`). Where the window
 * does not shrink for the keyboard (iOS; Android "pan") the bar rides on the
 * keyboard instead: `useKeyboardInset` (hooks/, read-only here) measures the
 * strip and reports 0 when the platform already moved the window. Reduced
 * motion: it steps without sliding.
 *
 * The screen renders it as LotteryScreen's `overlay` with `withBuyBar`, so
 * the content clears it (212 above the inset). The bar also measures itself
 * and reports its cover — how far its top stands above the page's
 * keyboard-free bottom edge — through BuyBarCoverContext, so the screen pads
 * for the real bar (a two-line caption, a large text size) and the keyboard
 * lift keeps the ticket's Add row above the bar while typing.
 */
export const BuyBar = memo(function BuyBar({
  caption,
  walletText,
  label,
  onPress,
  disabled = false,
  keyboardUp,
  accessibilityLabel,
  captionA11y,
  captionLines = 1,
  buyRef,
}: {
  caption: string;
  walletText?: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  keyboardUp: boolean;
  accessibilityLabel?: string;
  /** The caption's spoken form when it differs (Draw: "Number 5 8 1 2 0 6 · Draw 24"). Optional; added by group B. */
  captionA11y?: string;
  /**
   * Lines the caption may take (1 by default). Draw allows 2: "3 numbers +
   * 047319 typed · Draw 24" beside the wallet can wrap on a narrow phone, and
   * its page keeps 16 more clear above the bar for it (the board's rule).
   */
  captionLines?: number;
  /** The red button, so the screen can move a screen reader to it (Draw, after Confirm closes with rows left). */
  buyRef?: Ref<ViewInstance>;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // Listening from the start, not only once the keyboard is up: iOS announces
  // the keyboard's frame once, on keyboardWillShow, and a listener added by the
  // render that follows it has already missed it (RN caches the frame only
  // from keyboardDidShow). The strip is 0 while the keyboard is down anyway.
  const keyboardStrip = useKeyboardInset(true);
  const rest = insets.bottom + LT_LAYOUT.dockLift + LT_LAYOUT.dockH + LT_LAYOUT.barGap;
  /** Typing: the bar's bottom edge above the keyboard's top (where the window already shrank, above its bottom). */
  const ride = keyboardStrip > 0 ? KEYBOARD_GAP : insets.bottom + LT_LAYOUT.dockLift;
  const target = keyboardUp ? keyboardStrip + ride : rest;

  const bottom = useSharedValue(target);
  useEffect(() => {
    bottom.value = reduceMotion ? target : withTiming(target, { duration: 240, easing: LT_EASE });
  }, [target, reduceMotion, bottom]);
  const place = useAnimatedStyle(() => ({ bottom: bottom.value }));

  // The cover (LotteryScreen pads and lifts for it): the bar's measured height
  // over its bottom edge's lift above the page's keyboard-free bottom.
  const [height, setHeight] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next !== height) setHeight(next);
  };
  const reportCover = useContext(BuyBarCoverContext);
  const cover = height > 0 ? (keyboardUp ? ride : rest) + height : 0;
  useEffect(() => {
    reportCover(cover);
  }, [reportCover, cover]);
  useEffect(() => () => reportCover(0), [reportCover]);

  return (
    <Animated.View style={[styles.wrapper, place]} pointerEvents="box-none" onLayout={onLayout}>
      <View style={styles.panel}>
        <View style={styles.caption}>
          <LtText
            role="micro"
            color={LT.ink2}
            tabular
            numberOfLines={captionLines}
            style={styles.captionText}
            accessibilityLabel={captionA11y}
          >
            {caption}
          </LtText>
          {walletText ? (
            <View style={styles.wallet}>
              <LtIcon name="wallet" size={14} color={LT.ink3} />
              <LtText role="micro" color={LT.ink3} tabular numberOfLines={1}>
                {walletText}
              </LtText>
            </View>
          ) : null}
        </View>
        <LtButton
          variant="primary"
          size="block"
          label={label}
          onPress={onPress}
          disabled={disabled}
          accessibilityLabel={accessibilityLabel}
          buttonRef={buyRef}
        />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: LT_LAYOUT.dockSide,
  },
  panel: {
    width: "100%",
    maxWidth: LT_LAYOUT.dockMax,
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: LT.white,
    borderWidth: 1,
    borderColor: LT.line,
    borderRadius: LT_RADIUS.buybar,
    boxShadow: LT_SHADOW.float,
  },
  caption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 16,
    paddingHorizontal: 4,
  },
  captionText: { flexShrink: 1 },
  wallet: { flexDirection: "row", alignItems: "center", gap: 4 },
});
