import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthCard, AuthScreenShell } from "@/components/auth/AuthScreenShell";
import { Button } from "@/components/ui/Button";
import { ThemedText } from "@/components/ui/ThemedText";
import { useLanguage } from "@/localization/LanguageProvider";
import { theme } from "@/theme";
import type { AuthStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

// Backend has no forgot-password/reset-password endpoint (confirmed against
// AuthController) — this is intentionally a static contact-support screen,
// not wired to any API. Users sign in with phone + OTP, so this simply points
// them back to phone sign-in / support.
export function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useLanguage();

  return (
    <AuthScreenShell>
      <AuthCard>
        <View style={styles.badge}>
          <Ionicons name="key-outline" size={22} color={theme.colors.primary} />
        </View>

        <View style={styles.copy}>
          <ThemedText variant="title">{t.auth.forgotPassword.title}</ThemedText>
          <ThemedText variant="body" style={styles.body}>
            {t.auth.forgotPassword.body}
          </ThemedText>
        </View>

        <Button
          title={t.common.back}
          icon="chevron-back"
          variant="soft"
          size="lg"
          fullWidth
          onPress={() => navigation.navigate("Login")}
        />
      </AuthCard>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: theme.colors.primary + "3D",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { gap: theme.spacing.sm },
  body: { color: theme.colors.textMuted },
});
