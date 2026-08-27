import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { NoticeTone } from "../api/errors";

interface NoticeProps {
  visible: boolean;
  tone?: NoticeTone;
  title: string;
  message: string;
  actionLabel?: string;
  onClose: () => void;
}

const TONES = {
  warning: {
    icon: "alert-circle" as const,
    accent: "#b45309",
    halo: "#fef3c7",
  },
  error: {
    icon: "close-circle" as const,
    accent: "#b91c1c",
    halo: "#fee2e2",
  },
};

/**
 * Aviso modal de la app, en lugar del `Alert` del sistema.
 *
 * El `Alert` nativo solo acepta dos strings, así que un error de la API
 * terminaba volcado ahí adentro con sus llaves y su código de estado. Acá el
 * mensaje tiene su propio lugar, separado de un título que dice de qué se
 * trata, y el ícono anticipa el tono antes de leer: ámbar para algo que se
 * puede corregir, rojo para algo que falló.
 */
export function Notice({
  visible,
  tone = "error",
  title,
  message,
  actionLabel = "Entendido",
  onClose,
}: NoticeProps) {
  const { icon, accent, halo } = TONES[tone];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Tocar afuera cierra: es lo que espera cualquiera que ya leyó. */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          <View style={[styles.halo, { backgroundColor: halo }]}>
            <Ionicons name={icon} size={30} color={accent} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            onPress={onClose}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  halo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14.5,
    color: "#4b5563",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 22,
  },
  action: {
    alignSelf: "stretch",
    height: 46,
    borderRadius: 12,
    backgroundColor: "#1a73e8",
    alignItems: "center",
    justifyContent: "center",
  },
  actionPressed: { opacity: 0.85 },
  actionText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
