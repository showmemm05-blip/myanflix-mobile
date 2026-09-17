import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "@/screens/Auth/Login";
import { ForgotPasswordScreen } from "@/screens/Auth/ForgotPassword";
import { stackScreenOptions } from "@/navigation/options";
import type { AuthStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      {/*
       * One phone+OTP flow signs in OR creates the account (see PhoneAuthFlow's
       * header), so there is no separate Register route to register.
       */}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
