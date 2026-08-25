import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}

/**
 * Campo de contraseña con la opción de ver lo que se escribe.
 *
 * Mismo patrón visual que el login y el registro, extraído a un componente
 * para no repetirlo por cuarta vez.
 */
export function PasswordInput({
  placeholder,
  value,
  onChangeText,
  visible,
  onToggle,
}: Props) {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        onChangeText={onChangeText}
      />
      <Pressable
        style={styles.eyeButton}
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        <Ionicons
          name={visible ? "eye-outline" : "eye-off-outline"}
          size={22}
          color="#888"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "center",
    width: "100%",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 48,
    fontSize: 15,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
});
