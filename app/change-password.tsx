import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { changePassword } from "../src/api/auth";
import { useAuth } from "../src/auth/AuthContext";
import { PasswordInput } from "../src/components/PasswordInput";

const MIN_LENGTH = 8;

/**
 * Cambio obligatorio de contraseña en el primer ingreso (US-017, US-035).
 *
 * No tiene salida más que completar el cambio o cerrar sesión: el guard del
 * layout raíz mantiene esta pantalla como única accesible mientras el backend
 * indique que la contraseña sigue siendo la temporal del alta.
 */
export default function ChangePasswordScreen() {
  const { refreshUser, signOut } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Cada campo decide si se ve: elegir una contraseña nueva a ciegas, y
  // repetirla, es la forma más fácil de trabarse en esta pantalla.
  const [visible, setVisible] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  async function handleSubmit() {
    Keyboard.dismiss();
    setError(null);
    if (next.length < MIN_LENGTH) {
      setError(`La contraseña nueva debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (next !== confirm) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setSaving(true);
    try {
      await changePassword(current, next);
      await refreshUser();
    } catch (err) {
      const detail = (err as { errors?: { message?: string }[] })?.errors?.[0]?.message;
      setError(detail ?? "No pudimos cambiar la contraseña. Revisá los datos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Ionicons name="lock-closed-outline" size={48} color="#1a73e8" />
        <Text style={styles.title}>Cambiá tu contraseña</Text>
        <Text style={styles.subtitle}>
          Estás usando la contraseña temporal que te dieron en el alta. Definí una
          propia para poder continuar.
        </Text>

        <PasswordInput
          placeholder="Contraseña actual"
          value={current}
          onChangeText={setCurrent}
          visible={visible.current}
          onToggle={() => setVisible((v) => ({ ...v, current: !v.current }))}
        />
        <PasswordInput
          placeholder="Contraseña nueva"
          value={next}
          onChangeText={setNext}
          visible={visible.next}
          onToggle={() => setVisible((v) => ({ ...v, next: !v.next }))}
        />
        <PasswordInput
          placeholder="Repetir contraseña nueva"
          value={confirm}
          onChangeText={setConfirm}
          visible={visible.confirm}
          onToggle={() => setVisible((v) => ({ ...v, confirm: !v.confirm }))}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Guardar contraseña</Text>
          )}
        </Pressable>

        <Pressable onPress={() => void signOut()} style={styles.link}>
          <Text style={styles.linkText}>Cerrar sesión</Text>
        </Pressable>
        <View style={styles.spacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 24, paddingTop: 80, alignItems: "center" },
  title: { fontSize: 22, fontWeight: "bold", marginTop: 16, color: "#111827" },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  error: { color: "#dc2626", fontSize: 13, alignSelf: "flex-start", marginBottom: 8 },
  button: {
    width: "100%",
    backgroundColor: "#1a73e8",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  link: { marginTop: 20 },
  linkText: { color: "#6b7280", fontSize: 14 },
  spacer: { height: 40 },
});
