import { Link } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { signup, logout } from "../../src/api/auth";
import { describeApiError } from "../../src/api/errors";
import { useAuth } from "../../src/auth/AuthContext";
import { useKeyboardAwareScroll } from "../../src/components/useKeyboardAwareScroll";

/** Aire al final del formulario, antes de sumarle lo que ocupe el teclado. */
const CONTENT_BOTTOM_PADDING = 24;

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
  // Son cuatro campos más el logo: en un teléfono chico el teclado tapaba la
  // confirmación de contraseña y el botón, y se escribía a ciegas. El hook mide
  // cuánto tapa el teclado de verdad y sube solo al campo enfocado, igual que
  // en el alta y el cierre de un reporte.
  const nameField = useRef<TextInput>(null);
  const emailField = useRef<TextInput>(null);
  const passwordField = useRef<TextInput>(null);
  const confirmField = useRef<TextInput>(null);
  const keyboard = useKeyboardAwareScroll();

  async function handleRegister() {
    // Si queda abierto, tapa los errores de validación que se muestran debajo
    // de cada campo.
    Keyboard.dismiss();
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
      let currentErr = err;
      const data = currentErr as any;
      if (data?.status === 409) {
        try {
          await logout();
        } catch {}
        try {
          const res = await signup({ name, email, password });
          await signIn(res.meta.session_token, false);
          return;
        } catch (retryErr) {
          currentErr = retryErr;
        }
      }
      const data2 = currentErr as Record<string, unknown>;
      if (data2?.errors) {
        const mapped: Record<string, string> = {};
        for (const e of data2.errors as Array<{ param?: string; message: string }>) {
          if (e.param) mapped[e.param] = e.message;
        }
        if (Object.keys(mapped).length > 0) {
          setErrors(mapped);
        } else {
          const described = describeApiError(currentErr, "No pudimos crear la cuenta");
          Alert.alert(described.title, described.message);
        }
      } else {
        // Sin volcar el error crudo: el servidor caído y el túnel sin levantar
        // se ven igual desde acá, y ninguno de los dos es culpa de lo que se
        // escribió en el formulario.
        const described = describeApiError(currentErr, "No pudimos crear la cuenta");
        Alert.alert(described.title, described.message);
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
    // El ref y el `onFocus` van juntos o el hook no tiene qué revelar: uno dice
    // qué campo medir y el otro cuándo.
    ref: React.RefObject<TextInput | null>,
    extra?: object,
  ) {
    return (
      <>
        <TextInput
          ref={ref}
          onFocus={() => keyboard.focusField(ref)}
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
    <ScrollView
      style={styles.screen}
      {...keyboard.scrollViewProps}
      // Arrastrá y el teclado se baja. Sin esto quedaba arriba para siempre.
      keyboardDismissMode="on-drag"
      // El teclado se suma al espacio de abajo: sin ese lugar el scroll no
      // tiene a dónde ir y el último campo no puede subir por encima de él.
      contentContainerStyle={[
        styles.container,
        { paddingBottom: CONTENT_BOTTOM_PADDING + keyboard.keyboardOffset },
      ]}
    >
      <Image
        source={require("../../assets/urbancheck_logo.png")}
        style={styles.logo}
      />

      {field("Nombre completo", name, setName, "name", nameField)}
      {field("Email", email, setEmail, "email", emailField, {
        autoCapitalize: "none",
        keyboardType: "email-address",
      })}

      <View style={styles.passwordContainer}>
        <TextInput
          ref={passwordField}
          onFocus={() => keyboard.focusField(passwordField)}
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
          ref={confirmField}
          onFocus={() => keyboard.focusField(confirmField)}
          style={[styles.passwordInput, errors.confirmPassword && styles.inputError]}
          placeholder="Confirmar contraseña"
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          // Último campo del formulario: la tecla del teclado envía, en vez de
          // dejarlo abierto tapando los errores de validación.
          returnKeyType="go"
          onSubmitEditing={() => void handleRegister()}
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  // `paddingBottom` lo pone el componente, que le suma el alto del teclado.
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    backgroundColor: "#fff",
    flexGrow: 1,
    justifyContent: "center",
  },
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
