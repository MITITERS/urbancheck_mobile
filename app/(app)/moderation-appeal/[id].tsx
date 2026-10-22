import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { describeApiError, type ApiErrorDescription } from "../../../src/api/errors";
import { appealModeration } from "../../../src/api/resolution";
import { Notice } from "../../../src/components/Notice";
import { useKeyboardAwareScroll } from "../../../src/components/useKeyboardAwareScroll";
import { moderationMessages as t } from "../../../src/messages/moderation";
import { useInvalidateReports } from "../../../src/queries/reports";

const CONTENT_BOTTOM_PADDING = 40;

/**
 * US-049 — el autor apela el descarte de su reporte por moderación municipal.
 *
 * Usa el mismo mecanismo de apelación que la objeción de un cierre (US-048),
 * pero la pantalla es otra porque pide otra cosa: acá no hay foto que sumar,
 * solo el motivo. La revisa el municipio o la plataforma, y el reporte sigue
 * descartado mientras tanto.
 *
 * **Es una sola.** El aviso está antes de enviar: si se mantiene el
 * descarte, no hay otra oportunidad.
 */
export default function ModerationAppealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const invalidateReports = useInvalidateReports();
  const keyboard = useKeyboardAwareScroll();
  const reasonField = useRef<TextInput>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<ApiErrorDescription | null>(null);

  async function submit() {
    if (reason.trim() === "") {
      setNotice({ tone: "warning", title: t.missingReasonTitle, message: t.missingReasonBody });
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      await appealModeration(Number(id), reason.trim());
      invalidateReports();
      router.back();
    } catch (err: unknown) {
      setNotice(describeApiError(err, t.submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      {...keyboard.scrollViewProps}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: CONTENT_BOTTOM_PADDING + keyboard.keyboardOffset },
      ]}
    >
      <Notice
        visible={notice !== null}
        tone={notice?.tone}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        onClose={() => setNotice(null)}
      />

      <Text style={styles.intro}>{t.formIntro}</Text>

      <View style={styles.warning}>
        <Ionicons name="information-circle-outline" size={18} color="#92400e" />
        <Text style={styles.warningText}>{t.formWarning}</Text>
      </View>

      <TextInput
        style={styles.input}
        value={reason}
        onChangeText={setReason}
        placeholder={t.formPlaceholder}
        multiline
        textAlignVertical="top"
        accessibilityLabel={t.reasonLabel}
        ref={reasonField}
        onFocus={() => keyboard.focusField(reasonField)}
      />

      <Pressable
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={submit}
        disabled={submitting}
        accessibilityRole="button"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t.formSubmit}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fb" },
  content: { padding: 16, gap: 14 },
  intro: { fontSize: 15, color: "#374151", lineHeight: 21 },
  warning: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  warningText: { flex: 1, fontSize: 13, color: "#92400e", lineHeight: 18 },
  input: {
    minHeight: 140,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    fontSize: 15,
  },
  button: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "#c62828",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
