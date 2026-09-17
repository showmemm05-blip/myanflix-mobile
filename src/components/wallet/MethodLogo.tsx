import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
// Deep import, not the "@expo/vector-icons" root: that barrel statically
// require()s all 15 icon sets, bundling 19 TTFs (4 MB). Don't "tidy" it back.
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/theme";

interface Props {
  logoUrl: string | null | undefined;
  size?: number;
}

export function MethodLogo({ logoUrl, size = 20 }: Props) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: Math.max(theme.radius.xs, size / 4) }]}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={{ width: size, height: size }} contentFit="cover" transition={100} />
      ) : (
        <Ionicons name="card-outline" size={size * 0.6} color={theme.colors.textFaint} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
