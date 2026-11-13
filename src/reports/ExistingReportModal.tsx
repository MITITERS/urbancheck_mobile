import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { imageSource } from "../api/client";
import type { ExistingReport } from "../api/reports";
import { formatDistance } from "../api/validation";
import { CATEGORY_LABEL, STATUS_COLOR, reportStatusLabel } from "./labels";

interface Props {
  /** El reclamo que ya describe el problema; `null` oculta el aviso. */
  report: ExistingReport | null;
  /** Mientras se registra el apoyo. */
  busy?: boolean;
  /** Sumar el me gusta al reclamo existente. */
  onJoin: () => void;
  /** Ir al detalle del reclamo, sin sumarse. */
  onOpen: () => void;
  /** Volver al formulario tal como estaba. */
  onBack: () => void;
}

type Variant = "join" | "supporting" | "author" | "processing";

/**
 * Qué se le ofrece según quién está reportando (US-032).
 *
 * El autor no puede sumarse —nadie apoya su propio reporte— y a quien ya dio
 * me gusta no hay nada que sumarle: a los dos se les dice que ya están.
 */
function variantOf(report: ExistingReport): Variant {
  if (report.is_author) return "author";
  // Todavía no es público: su imagen sigue en el difuminado (US-042). Bloquea
  // el alta igual —el problema ya está reportado y crear otro dejaría dos
  // reclamos del mismo bache— pero no se puede abrir ni apoyar hasta que se
  // publique, así que no se ofrece ninguna de las dos cosas.
  if (report.photo_status !== "procesada") return "processing";
  if (report.is_liked) return "supporting";
  return "join";
}

const COPY: Record<Variant, { title: string; message: string; open: string }> = {
  join: {
    title: "Este problema ya fue reportado",
    message:
      "Otro vecino ya lo reportó. Sumá tu apoyo: ayuda a que el municipio lo valide y lo atienda antes.",
    open: "Ver reclamo",
  },
  supporting: {
    title: "Ya estás apoyando este reclamo",
    message:
      "Este problema ya fue reportado y ya le diste tu apoyo. Podés seguir su avance desde el reclamo.",
    open: "Ver reclamo",
  },
  author: {
    title: "Ya reportaste este problema",
    message: "Este reclamo es tuyo y sigue abierto. Podés ver cómo avanza desde ahí.",
    open: "Ir a mi reclamo",
  },
  processing: {
    title: "Este problema ya fue reportado",
    message:
      "Otro vecino acaba de reportarlo y todavía se está procesando su foto. " +
      "En unos minutos vas a poder verlo y sumarle tu apoyo.",
    open: "Ver reclamo",
  },
};

/**
 * Aviso de que lo que se quiere reportar ya está reportado (US-032).
 *
 * El reporte nuevo no se creó. En vez de una pared, se muestra el reclamo
 * existente y la salida: sumarse con un me gusta, que es lo que lo valida
 * (US-040). El texto evita "duplicado", que al vecino le suena a acusación.
 *
 * "Volver" solo cierra el aviso: el formulario queda con lo que tenía, por si
 * en realidad se estaba reportando otra cosa y hay que cambiar la categoría.
 */
export function ExistingReportModal({ report, busy = false, onJoin, onOpen, onBack }: Props) {
  const variant = report ? variantOf(report) : "join";
  const copy = COPY[variant];
  const distance = report ? formatDistance(report.distance_meters) : null;

  return (
    <Modal
      visible={report !== null}
      transparent
      animationType="fade"
      onRequestClose={onBack}
    >
      <View style={styles.backdrop}>
        {report && (
          <View style={styles.sheet} testID="existing-report">
            <View style={styles.halo}>
              <Ionicons
                name={variant === "join" ? "people" : "checkmark-circle"}
                size={26}
                color="#1a73e8"
              />
            </View>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.message}>{copy.message}</Text>

            <View style={styles.card}>
              <Image source={imageSource(report.photo)} style={styles.photo} />
              <View style={styles.cardBody}>
                <Text style={styles.category}>{CATEGORY_LABEL[report.category]}</Text>
                <View style={styles.statusRow}>
                  <View
                    style={[styles.dot, { backgroundColor: STATUS_COLOR[report.status] }]}
                  />
                  <Text style={styles.status}>{reportStatusLabel(report)}</Text>
                </View>
                <Text style={styles.meta}>
                  {[
                    distance && `A ${distance}`,
                    new Date(report.created_at).toLocaleDateString("es-AR"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <Text style={styles.meta}>
                  {report.like_count === 1
                    ? "1 vecino lo apoya"
                    : `${report.like_count} vecinos lo apoyan`}
                </Text>
              </View>
            </View>

            {variant === "processing" ? null : variant === "join" ? (
              <Pressable
                style={[styles.primary, busy && styles.disabled]}
                onPress={onJoin}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>Sumar mi apoyo</Text>
                )}
              </Pressable>
            ) : (
              <Pressable style={styles.primary} onPress={onOpen}>
                <Text style={styles.primaryText}>{copy.open}</Text>
              </Pressable>
            )}

            {variant === "join" && (
              <Pressable style={styles.secondary} onPress={onOpen} disabled={busy}>
                <Text style={styles.secondaryText}>{copy.open}</Text>
              </Pressable>
            )}
            <Pressable style={styles.secondary} onPress={onBack} disabled={busy}>
              <Text style={styles.backText}>Volver</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: { backgroundColor: "#fff", borderRadius: 14, padding: 20 },
  halo: {
    alignSelf: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#e8f0fe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#111827", textAlign: "center" },
  message: {
    fontSize: 14,
    color: "#4b5563",
    marginTop: 8,
    lineHeight: 20,
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  photo: { width: 84, height: 84, borderRadius: 8, backgroundColor: "#e5e7eb" },
  cardBody: { flex: 1, justifyContent: "center", gap: 4 },
  category: { fontSize: 15, fontWeight: "700", color: "#111827" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 13, color: "#374151", fontWeight: "600" },
  meta: { fontSize: 12, color: "#6b7280" },
  primary: {
    backgroundColor: "#1a73e8",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 18,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.6 },
  secondary: { paddingVertical: 11, alignItems: "center" },
  secondaryText: { color: "#1a73e8", fontWeight: "600", fontSize: 14 },
  backText: { color: "#6b7280", fontWeight: "600", fontSize: 14 },
});
