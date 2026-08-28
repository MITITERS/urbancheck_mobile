import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { resetPassword } from "../src/api/auth";

export default function ResetPasswordScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleReset() {
    Keyboard.dismiss();
    setErrors({});

    if (!key) {
      Alert.alert("Error", "El enlace de recuperación no es válido.");
      return;
    }
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
      await resetPassword(key, password);
      Alert.alert(
        "¡Listo!",
        "Tu contraseña fue cambiada correctamente. Ya podés iniciar sesión.",
        [{ text: "Ir al login", onPress: () => router.replace("/(auth)/login") }],
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        Alert.alert("Error de red", err.message);
        return;
      }
      const data = err as Record<string, unknown>;
      if (data?.errors) {
        const errors = data.errors as Array<{ param?: string; code?: string; message: string }>;
        const mapped: Record<string, string> = {};
        for (const e of errors) {
          if (e.param) mapped[e.param] = e.message;
        }
        const isKeyError = mapped.key || errors.some((e) => e.code === "invalid_password_reset_token" || e.param === "key");
        if (isKeyError) {
          Alert.alert(
            "Enlace inválido",
            "Este enlace ya fue usado o expiró. Solicitá uno nuevo desde la pantalla de recuperación.",
            [{ text: "OK", onPress: () => router.replace("/(auth)/forgot-password") }],
          );
        } else if (Object.keys(mapped).length > 0) {
          setErrors(mapped);
        } else {
          const msgs = errors.map((e) => e.message).join("\n");
          Alert.alert("Error", msgs || "No se pudo cambiar la contraseña.");
        }
      } else {
        Alert.alert("Error", JSON.stringify(err).slice(0, 300));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* El scroll es lo que permite bajar el teclado arrastrando o tocando
          fuera de los campos. */}
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <Image
        source={require("../assets/urbancheck_logo.png")}
        style={styles.logo}
      />
      <Text style={styles.subtitle}>
        Ingresá tu nueva contraseña para recuperar el acceso.
      </Text>

      <View style={styles.passwordContainer}>
        <TextInput
          style={[styles.passwordInput, errors.password && styles.inputError]}
          placeholder="Nueva contraseña (mín. 8 caracteres)"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable
          style={styles.eyeButton}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Ionicons
            name={showPassword ? "eye-outline" : "eye-off-outline"}
            size={22}
            color="#888"
          />
        </Pressable>
      </View>
      {errors.password ? (
        <Text style={styles.errorText}>{errors.password}</Text>
      ) : null}

      <View style={styles.passwordContainer}>
        <TextInput
          style={[styles.passwordInput, errors.confirmPassword && styles.inputError]}
          placeholder="Confirmar contraseña"
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          returnKeyType="go"
          onSubmitEditing={() => void handleReset()}
        />
        <Pressable
          style={styles.eyeButton}
          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
        >
          <Ionicons
            name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
            size={22}
            color="#888"
          />
        </Pressable>
      </View>
      {errors.confirmPassword ? (
        <Text style={styles.errorText}>{errors.confirmPassword}</Text>
      ) : null}

      {errors.key ? (
        <Text style={styles.errorText}>{errors.key}</Text>
      ) : null}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleReset}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Cambiar contraseña</Text>
        )}
      </Pressable>

      <Link href="/(auth)/login" style={styles.link}>
        Cancelar y volver al login
      </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  logo: {
    width: 150,
    height: 150,
    alignSelf: "center",
    marginBottom: 20,
    resizeMode: "contain",
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
    fontSize: 16,
  },
  passwordContainer: {
    position: "relative",
    justifyContent: "center",
    marginBottom: 4,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    paddingRight: 48,
    fontSize: 16,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 8,
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
  link: {
    textAlign: "center",
    marginTop: 16,
    color: "#1a73e8",
    fontSize: 14,
  },
});
