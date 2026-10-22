import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { PublicModeration } from "../api/reports";
import { moderationMessages as t } from "../messages/moderation";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR");
}

/**
 * El descarte por moderación municipal de un reporte (US-049).
 *
 * El motivo se muestra siempre: es público. La apelación —el botón o en qué
 * quedó— solo llega cuando quien mira es el autor, porque el servidor solo a él
 * le manda `can_appeal` y `appeal`.
 */
export function ModerationBanner({
  reportId,
  moderation,
}: {
  reportId: number;
  moderation: PublicModeration;
}) {
  const router = useRouter();
  const appeal = moderation.appeal;

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.header}>
        <Ionicons name="ban-outline" size={18} color="#c62828" />
        <Text style={styles.title}>{t.bannerTitle}</Text>
      </View>
      <Text style={styles.label}>{t.reasonLabel}</Text>
      <Text style={styles.reason}>{moderation.reason}</Text>
      <Text style={styles.meta}>{t.decidedAt(formatDate(moderation.decided_at))}</Text>

      {appeal?.status === "pendiente" && <Text style={styles.state}>{t.appealPending}</Text>}
      {appeal?.status === "rechazada" && (
        <View style={styles.resolution}>
          <Text style={styles.state}>{t.appealRejected}</Text>
          {!!appeal.resolution_reason && (
            <Text style={styles.meta}>
              {t.appealResolutionLabel}: {appeal.resolution_reason}
            </Text>
          )}
        </View>
      )}

      {moderation.can_appeal && (
        <>
          <Text style={styles.hint}>{t.appealHint}</Text>
          <Pressable
            style={styles.button}
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/moderation-appeal/${reportId}`)}
          >
            <Ionicons name="megaphone-outline" size={17} color="#fff" />
            <Text style={styles.buttonText}>{t.appealButton}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#fecaca",
    gap: 4,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  title: { fontSize: 15, fontWeight: "700", color: "#b91c1c" },
  label: { fontSize: 12, fontWeight: "600", color: "#6b7280", textTransform: "uppercase" },
  reason: { fontSize: 15, color: "#1f2937", lineHeight: 21 },
  meta: { fontSize: 12, color: "#6b7280" },
  state: { fontSize: 13, color: "#374151", marginTop: 8, fontWeight: "600" },
  resolution: { gap: 2 },
  hint: { fontSize: 13, color: "#4b5563", marginTop: 10, lineHeight: 18 },
  button: {
    marginTop: 10,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#c62828",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
