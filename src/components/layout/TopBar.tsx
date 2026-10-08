import type { ReactNode } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppBar, AppBarAction } from "@/components/layout/AppBar";

interface Props {
  title?: string;
  onBack?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  /** Overlays the screen with a scrim instead of sitting in the layout flow. */
  transparent?: boolean;
  children?: ReactNode;
  /** Quiet second line (large variant only). */
  subtitle?: string;
  /** Renders the title below the controls at display size instead of centred. */
  large?: boolean;
  /** Extra right-hand controls, rendered before `rightIcon`. */
  trailing?: ReactNode;
  rightAccessibilityLabel?: string;
  backAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Over the page, which scrolls under it, instead of in the layout flow —
   * the glass bar (components/layout/GlassBar). See AppBar's `floating`.
   */
  floating?: boolean;
  /** The bar's whole box — a floating or transparent bar's screen measures it here. */
  onLayout?: (event: LayoutChangeEvent) => void;
  /** Floating or transparent: the bar's empty space passes touches through — see AppBar's `touchThrough`. */
  touchThrough?: boolean;
}

/**
 * Header for PUSHED screens (details, transactions, settings sub-pages).
 * A thin wrapper over the shared AppBar — same bar, compact posture.
 */
export function TopBar({
  title,
  onBack,
  rightIcon,
  onRightPress,
  transparent,
  children,
  subtitle,
  large,
  trailing,
  rightAccessibilityLabel,
  backAccessibilityLabel,
  style,
  floating,
  onLayout,
  touchThrough,
}: Props) {
  return (
    <AppBar
      variant={transparent ? "transparent" : large ? "large" : "compact"}
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      backAccessibilityLabel={backAccessibilityLabel}
      style={style}
      floating={floating}
      onLayout={onLayout}
      touchThrough={touchThrough}
      trailing={
        <>
          {trailing}
          {rightIcon && (
            <AppBarAction
              icon={rightIcon}
              onPress={onRightPress ?? (() => {})}
              overlay={transparent}
              accessibilityLabel={rightAccessibilityLabel}
            />
          )}
        </>
      }
    >
      {children}
    </AppBar>
  );
}
