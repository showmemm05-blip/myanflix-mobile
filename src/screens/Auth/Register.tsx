import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useLanguage } from "@/localization/LanguageProvider";
import { AuthScreenShell } from "@/components/auth/AuthScreenShell";
import { PhoneAuthFlow } from "@/components/auth/PhoneAuthFlow";
import type { AuthStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { t } = useLanguage();

  return (
    <AuthScreenShell>
      <PhoneAuthFlow
        subtitle={t.auth.register.subtitle}
        onForgotPassword={() => navigation.navigate("ForgotPassword")}
      />
    </AuthScreenShell>
  );
}
