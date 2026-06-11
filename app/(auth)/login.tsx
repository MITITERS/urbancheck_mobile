import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { login } from "../../src/api/auth";
import { useAuth } from "../../src/auth/AuthContext";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleLogin() {
    setErrors({});
    setLoading(true);
    try {
      const res = await login({ email, password });
      await signIn(res.meta.session_token, rememberMe);
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
          Alert.alert("Error", "Email o contraseña incorrectos.");
        }
      } else {
        Alert.alert("Error", "Email o contraseña incorrectos.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>UrbanCheck</Text>

      <TextInput
        style={[styles.input, errors.email && styles.inputError]}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

      <TextInput
        style={[styles.input, errors.password && styles.inputError]}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {errors.password && (
        <Text style={styles.errorText}>{errors.password}</Text>
      )}

      <View style={styles.rememberRow}>
        <Text>Recordarme</Text>
        <Switch value={rememberMe} onValueChange={setRememberMe} />
      </View>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Ingresar</Text>
        )}
      </Pressable>

      <Link href="/(auth)/forgot-password" style={styles.link}>
        ¿Olvidaste tu contraseña?
      </Link>
      <Link href="/(auth)/register" style={styles.link}>
        Crear cuenta
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 32,
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
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  button: {
    backgroundColor: "#1a73e8",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
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
