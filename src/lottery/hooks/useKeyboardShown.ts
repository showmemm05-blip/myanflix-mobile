import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Whether the soft keyboard is up — a COPY of TabBar.tsx's private hook (same
 * events react-navigation's own bar uses for `tabBarHideOnKeyboard`: iOS
 * announces the keyboard before it moves, Android only once it is there).
 * Copied rather than exported from TabBar so the white Lottery never imports
 * from the dark dock; both must stay in step.
 *
 * Used by the Lottery dock (it steps aside while typing) and the buy bar
 * (it drops into the dock's place).
 */
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setShown(true));
    const hide = Keyboard.addListener(hideEvent, () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}
