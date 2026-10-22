import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getPublicReport } from "../../src/api/reports";
import { useAuth } from "../../src/auth/AuthContext";
import { shareMessages as t } from "../../src/messages/share";

type Outcome =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: string | null }
  | { kind: "needsSession" };

/**
 * Un enlace compartido abierto con la app instalada (US-030).
 *
 * `https://urbancheck.com.ar/r/<token>` y `urbancheck://r/<token>` llegan acá.
 * Se resuelve el token con el endpoint público —el mismo que usa la versión
 * web— y, con sesión, se pasa directo al detalle del reporte. Si el reporte ya
 * no está disponible se dice, con el motivo cuando lo descartó el municipio
 * (escenario 3).
 *
 * Vive en la raíz y sin guard, como `reset-password`: el enlace puede abrirse
 * con o sin sesión.
 */
export default function SharedReportScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { token: session } = useAuth();
  const [outcome, setOutcome] = useState<Outcome>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    getPublicReport(String(token))
      .then((report) => {
        if (cancelled) return;
        if (session) {
          router.replace(`/(app)/(tabs)/report/${report.id}`);
        } else {
          setOutcome({ kind: "needsSession" });
        }
      })
      .catch((error: { moderation?: { reason?: string } | null }) => {
        if (cancelled) return;
        setOutcome({ kind: "unavailable", reason: error?.moderation?.reason ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [token, session, router]);

  if (outcome.kind === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>{t.opening}</Text>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <View style={styles.icon}>
        <Ionicons
          name={outcome.kind === "unavailable" ? "ban-outline" : "log-in-outline"}
          size={40}
          color="#6b7280"
        />
      </View>
      {outcome.kind === "unavailable" ? (
        <>
          <Text style={styles.title}>{t.unavailableTitle}</Text>
          {outcome.reason ? (
            <>
              <Text style={styles.muted}>{t.discardedBody}</Text>
              <Text style={styles.reason}>{outcome.reason}</Text>
            </>
          ) : (
            <Text style={styles.muted}>{t.unavailableBody}</Text>
          )}
        </>
      ) : (
        <Text style={styles.title}>{t.signInToOpen}</Text>
      )}
      <Pressable style={styles.button} onPress={() => router.replace("/")} accessibilityRole="button">
        <Text style={styles.buttonText}>{t.goHome}</Text>
      </Pressable>
    </View>
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
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111827", textAlign: "center" },
  muted: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  reason: {
    fontSize: 15,
    color: "#1f2937",
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 10,
    alignSelf: "stretch",
    textAlign: "center",
  },
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
