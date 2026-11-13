import { Ionicons } from "@expo/vector-icons";
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";

/**
 * El lugar de una foto retirada por protección de datos (US-043).
 *
 * Se dibuja en vez de una caja vacía para que un reporte sin imagen no parezca
 * un error de carga: la foto existió y se sacó a propósito.
 */
export function RemovedPhoto({
  style,
  compact = false,
}: {
  style?: StyleProp<ViewStyle>;
  /** En una miniatura no entra el texto: queda solo el ícono. */
  compact?: boolean;
}) {
  return (
    <View
      style={[styles.box, style]}
      accessible
      accessibilityLabel="Imagen retirada por protección de datos"
    >
      <Ionicons name="eye-off-outline" size={compact ? 18 : 24} color="#64748b" />
      {!compact && (
        <Text style={styles.text}>Imagen retirada por protección de datos</Text>
      )}
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
