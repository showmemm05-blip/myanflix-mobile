import { forwardRef, useCallback, type ForwardedRef } from "react";
import { ScrollView, View, type ScrollViewInstance, type ScrollViewProps } from "react-native";
import { ScrollIntoViewContext, useKeyboardLift, type KeyboardLiftBlock } from "@/hooks/useKeyboardLift";

export interface KeyboardLiftScrollViewProps extends ScrollViewProps {
  /**
   * How much of the viewport's bottom edge something floating covers while
   * the keyboard is up (the Lottery buy bar riding on it, gap included): the
   * lift keeps the field above it too. See useKeyboardLift.
   */
  keyboardObstruction?: number;
  /** The block round the one field, lifted whole (label, field, help line, action row). See useKeyboardLift. */
  liftBlock?: KeyboardLiftBlock;
}

/**
 * A ScrollView that keeps its focused text field above the keyboard — the
 * comment composer at the foot of the detail screens is why it exists. Same
 * props as ScrollView; the screen keeps its KeyboardAvoidingView for iOS
 * exactly as before. Everything it renders is wrapped in one measured View
 * (a field's position is read against that block) and, on Android, followed
 * by the keyboard strip when the window did not shrink — see
 * useKeyboardLift for the why.
 */
export const KeyboardLiftScrollView = forwardRef<ScrollViewInstance, KeyboardLiftScrollViewProps>(function KeyboardLiftScrollView(
  // 32ms is plenty for the lift (it only notes the offset); a screen whose top
  // bar fades with this scroll (the glass on the detail screens) passes 16.
  { children, onLayout, onScroll, scrollEventThrottle = 32, keyboardObstruction = 0, liftBlock, ...rest },
  forwardedRef: ForwardedRef<ScrollViewInstance>,
) {
  const lift = useKeyboardLift({ obstruction: keyboardObstruction, block: liftBlock });

  // One node, two owners: the lift measures against it, and a screen that
  // also scrolls it (the player's "new title starts at the top") keeps its
  // own ref.
  const setScrollRef = useCallback(
    (node: ScrollViewInstance | null) => {
      lift.scrollRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [lift.scrollRef, forwardedRef],
  );

  return (
    <ScrollView
      ref={setScrollRef}
      {...rest}
      onLayout={(event) => {
        lift.onViewportLayout(event);
        onLayout?.(event);
      }}
      onScroll={(event) => {
        lift.onScroll(event);
        onScroll?.(event);
      }}
      scrollEventThrottle={scrollEventThrottle}
    >
      <View ref={lift.contentRef} onLayout={lift.onContentLayout}>
        <ScrollIntoViewContext.Provider value={lift.scrollFocusedIntoView}>{children}</ScrollIntoViewContext.Provider>
        {lift.keyboardPad > 0 && <View style={{ height: lift.keyboardPad }} />}
      </View>
    </ScrollView>
  );
});
