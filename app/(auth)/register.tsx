import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

import { signup } from "../../src/api/auth";
import { useAuth } from "../../src/auth/AuthContext";

export default function RegisterScreen() {
  const { signIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleRegister() {
    const tempErrors: Record<string, string> = {};

    // Validate Name
    if (!name.trim()) {
      tempErrors.name = "El nombre completo es obligatorio.";
    } else if (name.trim().split(" ").length < 2) {
      tempErrors.name = "Por favor, ingresá tu nombre y apellido.";
    }

    // Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      tempErrors.email = "El correo electrónico es obligatorio.";
    } else if (!emailRegex.test(email.trim())) {
      tempErrors.email = "El correo electrónico no es válido.";
    }

    // Validate Password
    if (!password) {
      tempErrors.password = "La contraseña es obligatoria.";
    } else if (password.length < 8) {
      tempErrors.password = "La contraseña debe tener al menos 8 caracteres.";
    }

    // Validate Confirm Password
    if (!confirmPassword) {
      tempErrors.confirmPassword = "Debes confirmar tu contraseña.";
    } else if (password !== confirmPassword) {
      tempErrors.confirmPassword = "Las contraseñas no coinciden.";
    }

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
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
        <Image
          source={require("../../assets/urbancheck_logo.png")}
          style={styles.logo}
        />

        {field("Nombre completo", name, setName, "name")}
        {field("Email", email, setEmail, "email", {
          autoCapitalize: "none",
          keyboardType: "email-address",
        })}

        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.passwordInput, errors.password && styles.inputError]}
            placeholder="Contraseña (mín. 8 caracteres)"
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
        {errors.password && (
          <Text style={styles.errorText}>{errors.password}</Text>
        )}

        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.passwordInput, errors.confirmPassword && styles.inputError]}
            placeholder="Confirmar contraseña"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
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
        {errors.confirmPassword && (
          <Text style={styles.errorText}>{errors.confirmPassword}</Text>
        )}

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
  container: { padding: 24, backgroundColor: "#fff", flexGrow: 1, justifyContent: "center" },
  logo: {
    width: 150,
    height: 150,
    alignSelf: "center",
    marginBottom: 20,
    resizeMode: "contain",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  passwordContainer: {
    position: "relative",
    justifyContent: "center",
    marginBottom: 12,
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
