import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { TermsOfService } from "../api/users";
import { termsMessages as t } from "../messages/terms";

/**
 * El texto completo de los términos (RN-10), para leerlo desde el registro sin
 * perder lo que ya se cargó en el formulario.
 */
export function TermsModal({
  terms,
  visible,
  onClose,
}: {
  terms: TermsOfService;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>{t.modalTitle}</Text>
        <Text style={styles.version}>{t.version(terms.version)}</Text>
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.text}>{terms.text}</Text>
        </ScrollView>
        <Pressable style={styles.button} onPress={onClose} accessibilityRole="button">
          <Text style={styles.buttonText}>{t.modalClose}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", color: "#111827" },
  version: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  body: { flex: 1, marginTop: 16 },
  bodyContent: { paddingBottom: 24 },
  text: { fontSize: 15, color: "#374151", lineHeight: 22 },
  button: {
    backgroundColor: "#1a73e8",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
