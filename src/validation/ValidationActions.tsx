import { useState } from "react";
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

import {
  isTooFarError,
  rejectReport,
  validateReport,
  type Coordinates,
} from "../api/validation";
import { useValidatorLocation } from "./useValidatorLocation";

interface Props {
  reportId: number;
  /** Se llama tras validar o rechazar, para refrescar detalle, feed y bandeja. */
  onCompleted: () => void;
}

type PendingAction = "validate" | "reject" | null;

/**
 * Acciones de validación en terreno (US-036).
 *
 * Sin ubicación las acciones se muestran **deshabilitadas y con la razón**, no
 * ocultas: esconderlas dejaría al validador sin saber por qué no puede hacer su
 * trabajo. La posición se toma fresca al ejecutar la acción, nunca cacheada.
 */
export function ValidationActions({ reportId, onCompleted }: Props) {
  const { permission, reason, request, getFreshPosition } = useValidatorLocation();
  const [pending, setPending] = useState<PendingAction>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const locationReady = permission === "granted";

  async function run(action: Exclude<PendingAction, null>) {
    setBusy(true);
    try {
      const coords = await getFreshPosition();
      if (!coords) {
        Alert.alert(
          "Sin ubicación",
          "No pudimos obtener tu posición. Revisá el permiso e intentá de nuevo.",
        );
        return;
      }
      await execute(action, coords);
      setPending(null);
      setRejectReason("");
      onCompleted();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function execute(action: Exclude<PendingAction, null>, coords: Coordinates) {
    if (action === "validate") {
      await validateReport(reportId, coords);
      Alert.alert("Reporte validado", "Ya es visible para la comunidad.");
      return;
    }
    await rejectReport(reportId, coords, rejectReason.trim());
    Alert.alert("Reporte rechazado", "El vecino recibe el aviso con el motivo.");
  }

  function showError(error: unknown) {
    if (isTooFarError(error)) {
      // El backend manda la distancia real: sirve mucho más que "estás lejos".
      Alert.alert("Estás demasiado lejos", error.detail);
      return;
    }
    const detail = (error as { detail?: string })?.detail;
    Alert.alert("No pudimos completar la acción", detail ?? "Intentá de nuevo.");
  }

  function confirm(action: Exclude<PendingAction, null>) {
    if (action === "reject" && rejectReason.trim() === "") {
      Alert.alert("Falta el motivo", "Contale al vecino por qué rechazás el reporte.");
      return;
    }
    void run(action);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark-outline" size={20} color="#1a73e8" />
        <Text style={styles.title}>Validación en terreno</Text>
      </View>

      {!locationReady && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{reason}</Text>
          {permission === "denied" && (
            <Pressable onPress={() => void request()} style={styles.noticeAction}>
              <Text style={styles.noticeActionText}>Permitir ubicación</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.validate, !locationReady && styles.disabled]}
          disabled={!locationReady || busy}
          onPress={() => setPending("validate")}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
          <Text style={styles.buttonText}>Validar</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.reject, !locationReady && styles.disabled]}
          disabled={!locationReady || busy}
          onPress={() => setPending("reject")}
        >
          <Ionicons name="close-circle-outline" size={18} color="#b91c1c" />
          <Text style={[styles.buttonText, styles.rejectText]}>Rechazar</Text>
        </Pressable>
      </View>

      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPending(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {pending === "validate" ? "¿Validar este reporte?" : "¿Rechazar este reporte?"}
            </Text>
            <Text style={styles.sheetBody}>
              {pending === "validate"
                ? "Confirmás que el problema existe y está en el lugar indicado. El reporte pasa a Reportado."
                : "El reporte pasa a Cancelado y deja de verse en el feed y en el mapa."}
            </Text>

            {pending === "reject" && (
              <TextInput
                style={styles.input}
                placeholder="Motivo del rechazo"
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
              />
            )}

            <View style={styles.sheetActions}>
              <Pressable
                style={styles.sheetCancel}
                onPress={() => setPending(null)}
                disabled={busy}
              >
                <Text style={styles.sheetCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetConfirm, busy && styles.disabled]}
                onPress={() => pending && confirm(pending)}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sheetConfirmText}>
                    {pending === "validate" ? "Validar" : "Rechazar"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f0f6ff",
    borderWidth: 1,
    borderColor: "#d6e4ff",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: "700", color: "#1a3a6b" },
  notice: {
    backgroundColor: "#fff7ed",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  noticeText: { fontSize: 13, color: "#9a3412", lineHeight: 18 },
  noticeAction: { marginTop: 8 },
  noticeActionText: { fontSize: 13, fontWeight: "600", color: "#1a73e8" },
  actions: { flexDirection: "row", gap: 10 },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  validate: { backgroundColor: "#1a73e8" },
  reject: { backgroundColor: "#fee2e2" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  rejectText: { color: "#b91c1c" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: { backgroundColor: "#fff", borderRadius: 14, padding: 20 },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  sheetBody: { fontSize: 14, color: "#4b5563", marginTop: 8, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
    minHeight: 72,
    textAlignVertical: "top",
    fontSize: 14,
  },
  sheetActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20 },
  sheetCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  sheetCancelText: { color: "#6b7280", fontWeight: "600" },
  sheetConfirm: {
    backgroundColor: "#1a73e8",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: "center",
  },
  sheetConfirmText: { color: "#fff", fontWeight: "600" },
});
