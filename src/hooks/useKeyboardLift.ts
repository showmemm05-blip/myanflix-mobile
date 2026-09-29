import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import {
  Keyboard,
  Platform,
  TextInput,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  type View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";

/**
 * Room to keep under a focused field: the action button that follows it
 * (54pt) plus the gap, so "the field is visible" also means "and what to
 * press next is visible".
 */
const FIELD_CLEARANCE = 96;

/**
 * How a field asks its screen to bring it into view. The screen's
 * KeyboardLiftScrollView (or AuthScreenShell) provides the real function;
 * outside one it is a no-op, so a field never has to know where it is
 * mounted.
 */
export const ScrollIntoViewContext = createContext<() => void>(() => {});

export function useScrollIntoView(): () => void {
  return useContext(ScrollIntoViewContext);
}

/**
 * Keeps the focused text field above the software keyboard inside a plain
 * ScrollView — the model AuthScreenShell was built on, shared so every
 * screen with a text field at the bottom (the comment composer on the
 * movie, series, book and player pages) behaves the same way.
 *
 * WHY IT EXISTS. Android's "resize" keyboard mode shrinks the window but
 * does not promise to scroll the focused input into the part that is left,
 * and on this app's phones it did not: the keyboard simply lay over the
 * field. Worse, whether the window resizes at all is not a given (Expo Go
 * on the emulator and the Samsung both kept the full height), and a
 * scroller whose content is shorter than an unshrunken window has nowhere
 * to scroll to. So this does two things:
 *   - when the window kept its height, `keyboardPad` is the keyboard strip
 *     the screen must add UNDER its content (useKeyboardInset reports it,
 *     and 0 once the platform did the moving itself); iOS is excluded
 *     because KeyboardAvoidingView already pads there, and counting the
 *     strip twice is the "action marooned above a keyboard-sized hole" bug;
 *   - on keyboardDidShow, and whenever a field asks (focus moving under an
 *     already-open keyboard), the focused input is measured against the
 *     content block and scrolled — plus the clearance for the button under
 *     it — into the part of the viewport the keyboard leaves.
 * Positions come from layout/scroll events rather than measuring against
 * the scroll view itself, which Fabric does not offset by scroll.
 */
export function useKeyboardLift() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const contentTop = useRef(0);
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);
  /** The tallest the viewport has been — its height with no keyboard up. */
  const fullViewportHeight = useRef(0);

  const keyboardInset = useKeyboardInset(true);
  const keyboardPad = Platform.OS === "android" ? keyboardInset : 0;

  /**
   * `strip` is how much of the full-height viewport the keyboard covers (the
   * event's height plus, on Android, the navigation bar it hides behind —
   * useKeyboardInset's reconstruction). It is taken from the event or the
   * inset hook rather than waited for from layout because the resized
   * window's onLayout and the keyboard event arrive in no fixed order; the
   * smaller of "what layout reports" and "full height minus the strip" is
   * right whichever lands first.
   */
  const scrollFocusedFieldIntoView = useCallback((strip = 0) => {
    const input = TextInput.State.currentlyFocusedInput();
    const content = contentRef.current;
    const scroll = scrollRef.current;
    if (!input || !content || !scroll) return;
    const viewport =
      strip > 0 ? Math.min(viewportHeight.current, fullViewportHeight.current - strip) : viewportHeight.current;
    if (viewport <= 0) return;
    input.measureLayout(content, (_x, y, _w, h) => {
      const fieldBottom = contentTop.current + y + h + FIELD_CLEARANCE;
      const visibleBottom = scrollY.current + viewport;
      if (fieldBottom > visibleBottom) {
        scroll.scrollTo({ y: Math.max(0, fieldBottom - viewport), animated: true });
      }
    });
  }, []);

  useEffect(() => {
    // `Did`, on both platforms: iOS's KeyboardAvoidingView has applied its
    // padding by then, and the event carries the keyboard's height. One
    // frame more lets any layout land.
    const subscription = Keyboard.addListener("keyboardDidShow", (event) => {
      const strip = event.endCoordinates.height + (Platform.OS === "ios" ? 0 : bottomInset);
      requestAnimationFrame(() => scrollFocusedFieldIntoView(strip));
    });
    return () => subscription.remove();
  }, [scrollFocusedFieldIntoView, bottomInset]);

  useEffect(() => {
    // The pad lands one render after the keyboard event, and a scroll asked
    // for before it exists is clamped to nothing — so ask again once it is
    // there.
    if (keyboardPad > 0) requestAnimationFrame(() => scrollFocusedFieldIntoView(keyboardPad));
  }, [keyboardPad, scrollFocusedFieldIntoView]);

  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    viewportHeight.current = height;
    if (height > fullViewportHeight.current) fullViewportHeight.current = height;
  }, []);
  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    contentTop.current = event.nativeEvent.layout.y;
  }, []);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  }, []);
  // The context hands fields a no-argument version: a focus change under an
  // open keyboard has no event to read a height from, and by then layout has
  // long since reported the reduced viewport.
  const scrollFocusedIntoView = useCallback(() => scrollFocusedFieldIntoView(), [scrollFocusedFieldIntoView]);

  return {
    /** Put on the ScrollView. */
    scrollRef,
    onViewportLayout,
    onScroll,
    /** Put on ONE View that wraps everything the ScrollView renders. */
    contentRef,
    onContentLayout,
    /** Extra height to add under the content on Android when the window did not shrink; 0 otherwise. */
    keyboardPad,
    /** Provide through ScrollIntoViewContext so fields can ask for themselves. */
    scrollFocusedIntoView,
  };
}
