import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";

/**
 * El lugar de una foto que todavía no terminó de difuminarse (US-042).
 *
 * Mismo criterio que `RemovedPhoto`: una caja vacía se lee como un error de
 * carga, y acá no falló nada —o falló, y hay que decirlo—. Solo lo ve quien
 * subió la foto: para cualquier otro el reporte todavía no existe.
 */
export function ProcessingPhoto({
  failed = false,
  style,
  compact = false,
}: {
  /** El difuminado se agotó sin poder procesarla y no se va a publicar. */
  failed?: boolean;
  style?: StyleProp<ViewStyle>;
  /** En una miniatura no entra el texto: queda solo el ícono. */
  compact?: boolean;
}) {
  const label = failed
    ? "No pudimos procesar la imagen"
    : "Procesando la imagen para difuminar rostros y patentes";

  return (
    <View style={[styles.box, style]} accessible accessibilityLabel={label}>
      {failed ? (
        <Ionicons name="alert-circle-outline" size={compact ? 18 : 24} color="#b45309" />
      ) : (
        <ActivityIndicator color="#64748b" size={compact ? "small" : "large"} />
      )}
      {!compact && <Text style={styles.text}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
  },
  text: { fontSize: 13, color: "#64748b", textAlign: "center" },
});
