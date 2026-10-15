import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { describeApiError } from "../api/errors";
import {
  complaintConflict,
  fileComplaint,
  type ComplaintConflict,
  type ComplaintReceipt,
} from "../api/reports";
import { useComplaintReasons, useInvalidateReports } from "../queries/reports";

/** El mismo tope que valida el backend. */
export const COMPLAINT_COMMENT_MAX_LENGTH = 500;

export const REASON_REQUIRED_MESSAGE = "Elegí un motivo para enviar la denuncia.";

const CONFLICT_TITLE: Record<ComplaintConflict, string> = {
  complaint_already_filed: "Ya denunciaste este reporte",
  report_not_public: "El reporte ya no está publicado",
  image_already_removed: "La imagen ya se retiró",
};

interface Props {
  /** El reporte que se denuncia; `null` oculta el formulario. */
  reportId: number | null;
  onClose: () => void;
  /**
   * Corre cuando el vecino cierra la confirmación. Recibe el acuse para que la
   * pantalla sepa si el reporte acaba de dejar de verse (dato personal).
   */
  onSubmitted?: (receipt: ComplaintReceipt) => void;
}

/**
 * El formulario del botón *Denunciar* (US-021): motivo obligatorio, comentario
 * opcional.
 *
 * Los motivos vienen del servidor, cada uno con su destinatario; la app no
 * tiene una copia. El texto de la confirmación también: es el que distingue la
 * revisión del municipio del plazo de 24 horas de la RN-12.
 *
 * Es el mismo componente en el feed y en el detalle, para que la acción no se
 * comporte distinto según dónde se la encuentre.
 */
export function ComplaintModal({ reportId, onClose, onSubmitted }: Props) {
  const visible = reportId !== null;
  const reasons = useComplaintReasons(visible);
  const invalidateReports = useInvalidateReports();
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [missingReason, setMissingReason] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cada denuncia arranca en blanco: lo elegido para un reporte no puede
  // quedar marcado al abrir el formulario sobre otro.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cada denuncia arranca en blanco al abrir el formulario sobre otro reporte
    setReason(null);
    setComment("");
    setMissingReason(false);
  }, [reportId]);

  async function submit() {
    if (reportId === null || isSubmitting) return;
    if (reason === null) {
      setMissingReason(true);
      return;
    }
    setIsSubmitting(true);
    try {
      const receipt = await fileComplaint(reportId, reason, comment);
      // Solo el motivo de dato personal saca el reporte del feed y del mapa;
      // una denuncia de contenido no cambia nada de lo que se ve.
      if (receipt.recipient === "admin_plataforma") invalidateReports();
      onClose();
      Alert.alert("Denuncia recibida", receipt.detail, [
        { text: "Entendido", onPress: () => onSubmitted?.(receipt) },
      ]);
    } catch (error) {
      const conflict = complaintConflict(error);
      if (conflict) {
        onClose();
        Alert.alert(CONFLICT_TITLE[conflict], (error as { detail?: string }).detail ?? "");
        return;
      }
      const described = describeApiError(error, "No se pudo enviar la denuncia");
      Alert.alert(described.title, described.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="complaint-form">
          <Text style={styles.title}>Denunciar reporte</Text>
          <Text style={styles.message}>
            ¿Por qué lo denunciás? El autor no va a saber quién lo hizo.
          </Text>

          {reasons.isPending ? (
            <ActivityIndicator style={styles.loading} color="#1a73e8" />
          ) : reasons.isError ? (
            <View style={styles.loading}>
              <Text style={styles.error}>No pudimos cargar los motivos.</Text>
              <Pressable onPress={() => void reasons.refetch()}>
                <Text style={styles.retry}>Reintentar</Text>
              </Pressable>
            </View>
          ) : (
            <View accessibilityRole="radiogroup" style={styles.reasons}>
              {reasons.data.map((option) => {
                const selected = option.value === reason;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.reason, selected && styles.reasonSelected]}
                    onPress={() => {
                      setReason(option.value);
                      setMissingReason(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    disabled={isSubmitting}
                  >
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={selected ? "#1a73e8" : "#9ca3af"}
                    />
                    <Text style={styles.reasonText}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {missingReason && <Text style={styles.error}>{REASON_REQUIRED_MESSAGE}</Text>}

          <TextInput
            style={styles.comment}
            value={comment}
            onChangeText={setComment}
            placeholder="Comentario (opcional)"
            placeholderTextColor="#9ca3af"
            accessibilityLabel="Comentario (opcional)"
            maxLength={COMPLAINT_COMMENT_MAX_LENGTH}
            multiline
            editable={!isSubmitting}
          />

          <Pressable
            style={[styles.primary, isSubmitting && styles.disabled]}
            onPress={() => void submit()}
            disabled={isSubmitting || !reasons.isSuccess}
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Enviar denuncia</Text>
            )}
          </Pressable>
          <Pressable style={styles.secondary} onPress={onClose} disabled={isSubmitting}>
            <Text style={styles.secondaryText}>Cancelar</Text>
          </Pressable>
        </View>
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
  title: { fontSize: 17, fontWeight: "700", color: "#111827" },
  message: { fontSize: 14, color: "#4b5563", marginTop: 6, lineHeight: 20 },
  loading: { marginVertical: 20, alignItems: "center", gap: 8 },
  reasons: { marginTop: 14, gap: 8 },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  reasonSelected: { borderColor: "#1a73e8", backgroundColor: "#e8f0fe" },
  reasonText: { flex: 1, fontSize: 14, color: "#111827" },
  error: { fontSize: 13, color: "#dc2626", marginTop: 8 },
  retry: { color: "#1a73e8", fontWeight: "600", fontSize: 14 },
  comment: {
    marginTop: 14,
    minHeight: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    fontSize: 14,
    color: "#111827",
    textAlignVertical: "top",
  },
  primary: {
    backgroundColor: "#1a73e8",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 16,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  disabled: { opacity: 0.6 },
  secondary: { paddingVertical: 11, alignItems: "center" },
  secondaryText: { color: "#6b7280", fontWeight: "600", fontSize: 14 },
});
