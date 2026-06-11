import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

import { signup } from "../../src/api/auth";
import { useAuth } from "../../src/auth/AuthContext";

export default function RegisterScreen() {
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleRegister() {
    setErrors({});

    if (password.length < 8) {
      setErrors({ password: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Las contraseñas no coinciden." });
      return;
    }

    setLoading(true);
    try {
      const res = await signup({ name, email, password });
      await signIn(res.meta.session_token, false);
    } catch (err: unknown) {
      const data = err as Record<string, unknown>;
      if (data?.errors) {
        const mapped: Record<string, string> = {};
        for (const e of data.errors as Array<{ param?: string; message: string }>) {
          if (e.param) mapped[e.param] = e.message;
        }
        if (Object.keys(mapped).length > 0) {
          setErrors(mapped);
        } else {
          Alert.alert("Error registro", JSON.stringify(data.errors));
        }
      } else if (err instanceof Error) {
        Alert.alert("Error de red", err.message);
      } else {
        Alert.alert("Error inesperado", JSON.stringify(err).slice(0, 300));
      }
    } finally {
      setLoading(false);
    }
  }

  function field(
    label: string,
    value: string,
    onChange: (v: string) => void,
    errorKey: string,
    extra?: object,
  ) {
    return (
      <>
        <TextInput
          style={[styles.input, errors[errorKey] && styles.inputError]}
          placeholder={label}
          value={value}
          onChangeText={onChange}
          {...extra}
        />
        {errors[errorKey] && (
          <Text style={styles.errorText}>{errors[errorKey]}</Text>
        )}
      </>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Crear cuenta</Text>

        {field("Nombre completo", name, setName, "name")}
        {field("Email", email, setEmail, "email", {
          autoCapitalize: "none",
          keyboardType: "email-address",
        })}
        {field("Contraseña (mín. 8 caracteres)", password, setPassword, "password", {
          secureTextEntry: true,
        })}
        {field("Confirmar contraseña", confirmPassword, setConfirmPassword, "confirmPassword", {
          secureTextEntry: true,
        })}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Registrarse</Text>
          )}
        </Pressable>

        <Link href="/(auth)/login" style={styles.link}>
          Ya tengo cuenta
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: "#fff", flexGrow: 1 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    color: "#1a73e8",
  },
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
    marginTop: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: {
    textAlign: "center",
    marginTop: 16,
    color: "#1a73e8",
    fontSize: 14,
  },
});
