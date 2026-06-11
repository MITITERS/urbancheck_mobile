import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

import { requestPasswordReset } from "../../src/api/auth";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      setError("No se pudo enviar el email. Verificá la dirección ingresada.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <KeyboardAvoidingView style={styles.container}>
        <Text style={styles.successTitle}>¡Email enviado!</Text>
        <Text style={styles.successText}>
          Revisá tu bandeja de entrada y seguí el enlace para restablecer tu
          contraseña. El enlace expira en 24 horas.
        </Text>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Recuperar contraseña</Text>
      <Text style={styles.subtitle}>
        Ingresá tu email y te enviaremos un enlace para restablecer tu
        contraseña.
      </Text>

      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Enviar enlace</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 8, color: "#1a73e8" },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
    fontSize: 16,
  },
  inputError: { borderColor: "#e53935" },
  errorText: { color: "#e53935", fontSize: 12, marginBottom: 8 },
  button: {
    backgroundColor: "#1a73e8",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  successTitle: { fontSize: 22, fontWeight: "bold", color: "#2e7d32", marginBottom: 12 },
  successText: { fontSize: 15, color: "#444", lineHeight: 22 },
});
