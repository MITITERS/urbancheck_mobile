import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { ModerationNotice } from "../api/reports";
import { moderationMessages as t } from "../messages/moderation";

/**
 * Lo que ve un vecino que abre un reporte descartado por moderación (US-049).
 *
 * El reporte ya no está publicado, pero el motivo de la decisión es público:
 * es el contrapeso de que el municipio pueda sacar reclamos de la vista. El
 * servidor manda solo el aviso —sin foto, descripción ni autor— y la pantalla
 * no intenta mostrar nada más.
 */
export function ModerationNoticeView({ notice }: { notice: ModerationNotice }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.icon}>
        <Ionicons name="ban-outline" size={44} color="#c62828" />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {t.noticeTitle}
        {notice.number ? ` #${notice.number}` : ""}
      </Text>
      <Text style={styles.body}>{t.noticeBody}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>{t.reasonLabel}</Text>
        <Text style={styles.reason}>{notice.moderation.reason}</Text>
        <Text style={styles.meta}>
          {t.decidedAt(new Date(notice.moderation.decided_at).toLocaleDateString("es-AR"))}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, alignItems: "center", gap: 12 },
  icon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#ffebee",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111827", textAlign: "center" },
  body: { fontSize: 15, color: "#4b5563", textAlign: "center", lineHeight: 21 },
  card: {
    alignSelf: "stretch",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 4,
    marginTop: 8,
  },
  label: { fontSize: 12, fontWeight: "600", color: "#6b7280", textTransform: "uppercase" },
  reason: { fontSize: 15, color: "#1f2937", lineHeight: 21 },
  meta: { fontSize: 12, color: "#6b7280" },
});
