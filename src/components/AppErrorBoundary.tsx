import type { ErrorBoundaryProps } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { errorMessages as t } from "../messages/errors";

/**
 * Lo que se ve si una pantalla falla al dibujarse (N-20).
 *
 * Lo exporta `app/_layout.tsx` como `ErrorBoundary`, que es como Expo Router
 * lo toma: sin él, un error de renderizado cerraba la app en producción.
 * «Reintentar» vuelve a montar la pantalla.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  if (__DEV__) console.error("Error de renderizado", error);
  return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={48} color="#e53935" />
      <Text style={styles.title}>{t.boundaryTitle}</Text>
      <Text style={styles.body}>{t.boundaryBody}</Text>
      <RetryButton onPress={() => void retry()} />
    </View>
  );
}

export function RetryButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress} accessibilityRole="button">
      <Text style={styles.buttonText}>{t.retry}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "#fff",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111827", textAlign: "center" },
  body: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  button: {
    marginTop: 8,
    paddingHorizontal: 24,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#1a73e8",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
