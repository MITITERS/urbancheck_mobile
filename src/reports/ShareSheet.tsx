import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Linking, Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { shareMessages as t } from "../messages/share";

interface Props {
  visible: boolean;
  onClose: () => void;
  url: string;
  /** El texto que acompaña al enlace: qué es y dónde. */
  message: string;
}

/**
 * Compartir un reporte (US-030, escenario 1): WhatsApp, Instagram o copiar el
 * enlace, y el resto de las apps del teléfono en «Más opciones».
 *
 * Instagram no recibe texto por URL —no tiene un esquema como el de WhatsApp—,
 * así que esa opción abre la hoja del sistema, donde Instagram aparece si está
 * instalada. Ningún módulo nativo nuevo salvo `expo-clipboard`: el resto es
 * `Linking` y `Share` de React Native.
 */
export function ShareSheet({ visible, onClose, url, message }: Props) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const text = `${message} ${url}`;

  async function viaWhatsApp() {
    const encoded = encodeURIComponent(text);
    try {
      await Linking.openURL(`whatsapp://send?text=${encoded}`);
    } catch {
      // Sin la app instalada se abre WhatsApp Web, que también lo resuelve.
      await Linking.openURL(`https://wa.me/?text=${encoded}`).catch(() => {});
    }
    onClose();
  }

  async function viaSystemSheet() {
    await Share.share({ message: text, url }).catch(() => {});
    onClose();
  }

  async function copy() {
    await Clipboard.setStringAsync(url);
    setCopied(true);
  }

  function close() {
    setCopied(false);
    onClose();
  }

  const options = [
    { key: "whatsapp", icon: "logo-whatsapp", tint: "#25d366", label: t.whatsapp, onPress: viaWhatsApp },
    { key: "instagram", icon: "logo-instagram", tint: "#d62976", label: t.instagram, onPress: viaSystemSheet },
    {
      key: "copy",
      icon: copied ? "checkmark-circle" : "link-outline",
      tint: copied ? "#16a34a" : "#1a73e8",
      label: copied ? t.copied : t.copy,
      onPress: copy,
    },
    { key: "more", icon: "share-outline", tint: "#4b5563", label: t.more, onPress: viaSystemSheet },
  ] as const;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={t.cancel} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">
          {t.sheetTitle}
        </Text>
        <Text style={styles.hint}>{t.sheetHint}</Text>
        <View style={styles.options}>
          {options.map((option) => (
            <Pressable
              key={option.key}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              onPress={option.onPress}
              accessibilityRole="button"
              accessibilityLabel={option.label}
            >
              <View style={[styles.icon, { backgroundColor: `${option.tint}1a` }]}>
                <Ionicons name={option.icon} size={26} color={option.tint} />
              </View>
              <Text style={styles.optionLabel}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.cancel} onPress={close} accessibilityRole="button">
          <Text style={styles.cancelText}>{t.cancel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.35)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#111827" },
  hint: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  options: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  option: { alignItems: "center", width: "24%", paddingVertical: 6, borderRadius: 12 },
  optionPressed: { backgroundColor: "#f3f4f6" },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  optionLabel: { fontSize: 12, color: "#374151", textAlign: "center" },
  cancel: {
    marginTop: 18,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 15, fontWeight: "600", color: "#374151" },
});
