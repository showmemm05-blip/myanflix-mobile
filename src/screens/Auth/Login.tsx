import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLanguage } from "@/localization/LanguageProvider";
import { AuthScreenShell } from "@/components/auth/AuthScreenShell";
import { PhoneAuthFlow } from "@/components/auth/PhoneAuthFlow";
import type { AuthStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ route, navigation }: Props) {
  const { t } = useLanguage();
  const initialPhone = route.params?.phone;

  return (
    <AuthScreenShell>
      <PhoneAuthFlow
        // Keyed on the pre-filled number: coming back from a password reset
        // starts the flow afresh on that number instead of resuming the
        // password step it left, with a password typed before the reset.
        key={initialPhone ?? ""}
        initialPhone={initialPhone}
        subtitle={t.auth.login.subtitle}
        onForgotPassword={(phone) => navigation.navigate("ForgotPassword", { phone })}
      />
    </AuthScreenShell>
  );
}
