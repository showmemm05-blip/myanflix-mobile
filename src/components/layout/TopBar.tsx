import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
}: Props) {
  return (
    <AppBar
      variant={transparent ? "transparent" : large ? "large" : "compact"}
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      backAccessibilityLabel={backAccessibilityLabel}
      style={style}
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
