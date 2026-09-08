import { Link } from "expo-router";
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
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { login, logout } from "../../src/api/auth";
import { describeApiError } from "../../src/api/errors";
import { useAuth } from "../../src/auth/AuthContext";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleLogin() {
    // El teclado no tiene nada más que hacer acá: si queda abierto, tapa el
    // error que se va a mostrar justo debajo del campo.
    Keyboard.dismiss();
    setErrors({});
    setLoading(true);
    try {
      const res = await login({ email, password });
      await signIn(res.meta.session_token, rememberMe);
    } catch (err: unknown) {
      let currentErr = err;
      const data = currentErr as any;
      if (data?.status === 409) {
        try {
          await logout();
        } catch {}
        try {
          const res = await login({ email, password });
          await signIn(res.meta.session_token, rememberMe);
          return;
        } catch (retryErr) {
          currentErr = retryErr;
        }
      }
      const data2 = currentErr as Record<string, unknown>;
      if (data2?.errors) {
        // El servidor contestó y rechazó las credenciales: eso sí es un
        // usuario o una contraseña que no coinciden.
        const mapped: Record<string, string> = {};
        for (const e of data2.errors as Array<{ param?: string; message: string }>) {
          if (e.param) mapped[e.param] = e.message;
        }
        if (Object.keys(mapped).length > 0) {
          setErrors(mapped);
        } else {
          Alert.alert("Error", "Email o contraseña incorrectos.");
        }
      } else {
        // Cualquier otra cosa —el servidor caído, el túnel de desarrollo sin
        // levantar, el teléfono sin datos— no es una credencial equivocada.
        // Decirlo así mandaba a revisar la contraseña durante media hora.
        const described = describeApiError(currentErr, "No pudimos iniciar sesión");
        Alert.alert(described.title, described.message);
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
      {/*
        El formulario va dentro de un scroll aunque entre en pantalla: es lo que
        da las dos formas de cerrar el teclado que uno espera —arrastrar, y
        tocar fuera de los campos—. Sin él, una vez abierto no había manera de
        bajarlo.
      */}
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <Image
        source={require("../../assets/urbancheck_logo.png")}
        style={styles.logo}
      />

      <TextInput
        style={[styles.input, errors.email && styles.inputError]}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

      <View style={styles.passwordContainer}>
        <TextInput
          style={[styles.passwordInput, errors.password && styles.inputError]}
          placeholder="Contraseña"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          // Último campo: la tecla del teclado envía el formulario, en vez de
          // dejarlo abierto sin nada que hacer.
          returnKeyType="go"
          onSubmitEditing={() => void handleLogin()}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  logo: {
    width: 308,
    height: 308,
    alignSelf: "center",
    marginTop: -50,
    marginBottom: 30,
    resizeMode: "contain",
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
