import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { describeApiError } from "../../src/api/errors";
import { deleteAccount } from "../../src/api/users";
import { useAuth } from "../../src/auth/AuthContext";
import { PasswordInput } from "../../src/components/PasswordInput";
import { accountMessages as t } from "../../src/messages/account";

/**
 * Baja de la cuenta por el propio vecino (N-09, derecho de supresión).
 *
 * Pide la contraseña y una confirmación más: no hay vuelta atrás. Las cuentas
 * de trabajo no llegan acá —el perfil no ofrece la opción y el backend las
 * rechaza—: siguen con la baja lógica que hace el administrador.
 */
export default function DeleteAccountScreen() {
  const { signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await deleteAccount(password);
      Alert.alert(t.doneTitle, t.doneMessage);
      await signOut();
    } catch (err) {
      // 400 es la contraseña; el resto (el límite de intentos, la red) lo
      // describe el mensaje común.
      const status = (err as { status?: number })?.status;
      setError(status === 400 ? t.wrongPassword : describeApiError(err).message);
    } finally {
      setDeleting(false);
    }
  }

  function handleSubmit() {
    Keyboard.dismiss();
    setError(null);
    if (!password) {
      setError(t.missingPassword);
      return;
    }
    Alert.alert(t.confirmTitle, t.confirmMessage, [
      { text: t.cancel, style: "cancel" },
      { text: t.confirm, style: "destructive", onPress: () => void remove() },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t.intro}</Text>
        {t.consequences.map((line) => (
          <View key={line} style={styles.bulletRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{line}</Text>
          </View>
        ))}

        <Text style={styles.label}>{t.passwordLabel}</Text>
        <PasswordInput
          placeholder={t.passwordPlaceholder}
          value={password}
          onChangeText={setPassword}
          visible={visible}
          onToggle={() => setVisible((v) => !v)}
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, deleting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={deleting}
          accessibilityRole="button"
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t.submit}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 24, gap: 12 },
  intro: { fontSize: 15, color: "#111827", fontWeight: "600" },
  bulletRow: { flexDirection: "row", gap: 8 },
  bullet: { fontSize: 15, color: "#6b7280" },
  bulletText: { flex: 1, fontSize: 14, color: "#374151", lineHeight: 20 },
  label: { marginTop: 12, fontSize: 14, color: "#374151", fontWeight: "600" },
  error: { color: "#e53935", fontSize: 14 },
  button: {
    marginTop: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#e53935",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
