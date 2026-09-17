import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, useWindowDimensions, type KeyboardEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * How much of the window's bottom edge the software keyboard is covering, in
 * dp — and 0 whenever nothing has to move because of it.
 *
 * Anything that sizes itself against the space left over needs this: the
 * suggestion panel hangs under the search field and must stop above the
 * keyboard rather than behind it.
 *
 * WHY IT IS USUALLY ZERO ON ANDROID. With Expo's default
 * `softwareKeyboardLayoutMode: "resize"` the window itself shrinks to the space
 * above the keyboard, so `useWindowDimensions().height` ALREADY excludes the
 * strip — subtracting it a second time would shorten the panel twice. Rather
 * than hard-code that per platform ("pan" mode, a future RN change or a
 * tablet's floating keyboard would each break the assumption silently), the
 * window is measured: if it shrank when the keyboard appeared, the platform has
 * already done the moving and this reports 0. iOS never resizes, so there the
 * full strip is the honest answer.
 *
 * On Android the event reports the strip MINUS the navigation bar, which sits
 * in front of the keyboard; safe-area's bottom inset is exactly that bar (it
 * masks `ime()` out), so adding it back reconstructs the true distance, counted
 * once. iOS already reports the full distance.
 *
 * This is the same measurement BottomSheet makes for its own lift. It is
 * deliberately a COPY rather than an import from there: that hook is private to
 * the sheet, it is coupled to the sheet's Modal window (see its comment on
 * `useAnimatedKeyboard`), and a working dismissible sheet is not something the
 * suggestion panel should be able to break. If a third caller ever appears,
 * that is the moment to make the sheet share this one.
 */
export function useKeyboardInset(enabled: boolean): number {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const [inset, setInset] = useState(0);

  /**
   * The tallest this window has been seen, which is its height with no keyboard
   * up. A window that resizes for the keyboard drops well below it; one that
   * does not stays exactly on it.
   */
  const fullHeight = useRef(windowHeight);
  if (windowHeight > fullHeight.current) fullHeight.current = windowHeight;
  // Well above rotation jitter and toolbar changes, far below any keyboard.
  const windowResized = fullHeight.current - windowHeight > 80;

  useEffect(() => {
    // Nothing is listening while the panel is closed — there is no layout to
    // protect, and the listener would re-render the screen on every keyboard.
    if (!enabled) return;
    // Android only ever emits the `Did` pair; iOS's `Will` pair carries the
    // final height at the START of its animation, so the panel resizes with the
    // keyboard instead of snapping after it.
    const ios = Platform.OS === "ios";
    const strip = (height: number) => (windowResized ? 0 : Math.round(height + (ios ? 0 : bottomInset)));

    // The panel opens ON TOP of a keyboard that is usually already up — the
    // field was focused before the panel existed, so no show event is coming.
    // RN caches the live frame between its own did-show/did-hide, so read it
    // once on mount.
    const standing = Keyboard.metrics();
    if (standing) setInset(strip(standing.height));

    const subscriptions = [
      Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (event: KeyboardEvent) => {
        const height = strip(event.endCoordinates.height);
        setInset((current) => (current === height ? current : height));
      }),
      Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setInset(0)),
    ];
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      setInset(0);
    };
  }, [enabled, bottomInset, windowResized]);

  return enabled ? inset : 0;
}
