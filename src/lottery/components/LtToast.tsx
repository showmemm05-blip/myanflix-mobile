import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from "react-native-reanimated";
import { LtIcon } from "@/lottery/components/LtIcon";
import { LtText } from "@/lottery/components/LtText";
import { LT, LT_RADIUS, LT_SHADOW } from "@/lottery/theme/tokens";

export type LtToastKind = "ok" | "warn";

interface Toast {
  id: number;
  text: string;
  kind: LtToastKind;
}

interface ToastApi {
  /**
   * One toast at a time, 4 s, under the top bar. `spoken` replaces the text
   * for screen readers (a number read digit by digit: "Number 0 2 7 copied.").
   */
  show: (text: string, options?: { kind?: LtToastKind; spoken?: string }) => void;
  /** Take the current toast down now (Draw's own undo toast goes in its place: one toast at a time). */
  hide: () => void;
}

const ToastStateContext = createContext<Toast | null>(null);
const ToastApiContext = createContext<ToastApi>({ show: () => {}, hide: () => {} });

const TOAST_MS = 4000;

/**
 * The Lottery's own toast (lt-base 6.13 `.lt-toast`), never the app's dark
 * one: ink fill, paper text 14/20, a 16pt icon (ok green / warn amber), radius
 * 8, the card shadow. One at a time — a new one replaces the old and restarts
 * the 4 s. Every toast is ANNOUNCED once, here, so a screen-reader user hears
 * it whichever host draws it.
 *
 * Hosts: the provider draws one under the Lottery's top bar; LtSheet draws
 * another inside its own Modal window (which covers the page's), so a toast
 * raised from a sheet is seen too.
 */
export function LtToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback<ToastApi["show"]>((text, options) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: nextId.current++, text, kind: options?.kind ?? "ok" });
    AccessibilityInfo.announceForAccessibility(options?.spoken ?? text);
    timer.current = setTimeout(() => {
      timer.current = null;
      setToast(null);
    }, TOAST_MS);
  }, []);
  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastApiContext.Provider value={api}>
      <ToastStateContext.Provider value={toast}>
        {children}
        <LtToastHost />
      </ToastStateContext.Provider>
    </ToastApiContext.Provider>
  );
}

/** `const toast = useLtToast(); toast.show("2 tickets bought for Draw 24.")` */
export function useLtToast(): ToastApi {
  return useContext(ToastApiContext);
}

/** Draws the current toast, 64 under the safe-area top (just under the Lottery's 56pt bar). */
export function LtToastHost() {
  const toast = useContext(ToastStateContext);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  // The host stays mounted (empty) so a leaving toast can play its exit.
  return (
    <View style={[styles.host, { top: insets.top + 64 }]} pointerEvents="box-none">
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={reduceMotion ? FadeIn.duration(120) : FadeInDown.duration(220)}
          exiting={FadeOut.duration(reduceMotion ? 120 : 180)}
          style={styles.toast}
          // Announced by `show`; the host itself stays out of the reading order so it is not read twice.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <LtIcon
            name={toast.kind === "warn" ? "alert" : "check"}
            size={16}
            color={toast.kind === "warn" ? LT.toastWarn : LT.toastOk}
          />
          <LtText role="meta" color={LT.paper} style={styles.text}>
            {toast.text}
          </LtText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 0, right: 0, zIndex: 70, alignItems: "center", paddingHorizontal: 16 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 420,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: LT.ink,
    borderRadius: LT_RADIUS.button,
    boxShadow: LT_SHADOW.s2,
  },
  text: { flexShrink: 1 },
});
