import { Component, type ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";

/**
 * The fallback pane, kept as a FUNCTION component so it can read the language
 * store — a boundary itself has to be a class (React ships no hook form of
 * getDerivedStateFromError, and adding a library for it is not worth a
 * dependency). Insets come from the SafeAreaProvider that sits above the
 * boundary in App.tsx, so this still clears the notch with no navigation
 * chrome left on screen.
 */
function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <EmptyState
        icon="alert-circle-outline"
        tone={theme.colors.danger}
        message={t.common.somethingWentWrong}
        actionLabel={t.common.retry}
        onAction={onRetry}
      />
    </View>
  );
}

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * The app's only error boundary, wrapped around the navigator in App.tsx.
 *
 * Why it exists: React 19 unmounts the WHOLE root on an uncaught render
 * error, so without this a single bad value — a date the server never
 * promised, an enum a newer backend invented — leaves a black screen that
 * only a force-quit clears. Several screens here render server data through
 * code that throws rather than degrades, and the two readers plus the player
 * are long-lived screens where losing the tree also loses reading and watch
 * position.
 *
 * Deliberately not logging: `src` has no console calls anywhere, and React
 * already reports a caught error through LogBox in development. There is no
 * telemetry sink in this app to send it to.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  handleRetry = () => {
    // Re-render the same tree. Navigation state is untouched, so this lands
    // the user back exactly where they were — and if whatever threw is still
    // there, the fallback simply comes back rather than the app dying.
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return <ErrorFallback onRetry={this.handleRetry} />;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
});
