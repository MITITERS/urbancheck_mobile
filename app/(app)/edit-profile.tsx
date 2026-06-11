import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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

import { getMe, patchMe, type UserProfile } from "../../src/api/users";
import { uriToBlob } from "../../src/api/client";

export default function EditProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u);
        setName(u.name);
      })
      .finally(() => setLoading(false));
  }, []);

  async function pickAvatar() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permiso necesario", "Se necesita acceso a la galería.\nEstado: " + perm.status);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.uri;
        setAvatar({
          uri,
          name: uri.split("/").pop() ?? "avatar.jpg",
          type: asset.mimeType ?? "image/jpeg",
        });
      }
    } catch (err) {
      Alert.alert("Error galería", String(err));
    }
  }

  async function handleSave() {
    setErrors({});
    if (!name.trim()) {
      setErrors({ name: "El nombre es obligatorio." });
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.append("name", name);
      if (avatar) {
        const blob = await uriToBlob(avatar.uri);
        form.append("avatar", blob, avatar.name);
      }
      await patchMe(form);
      Alert.alert("¡Listo!", "Tu perfil fue actualizado.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const data = err as Record<string, string[]>;
      if (data?.name) {
        setErrors({ name: data.name[0] });
      } else if (err instanceof Error) {
        Alert.alert("Error de red", err.message);
      } else {
        Alert.alert("Error servidor", JSON.stringify(err).slice(0, 300));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const avatarUri = avatar?.uri ?? user?.avatar ?? null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.avatarContainer} onPress={pickAvatar}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {name?.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <Text style={styles.changeAvatarText}>Cambiar foto</Text>
        </Pressable>

        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          value={name}
          onChangeText={setName}
          placeholder="Tu nombre"
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          value={user?.email ?? ""}
          editable={false}
        />

        <Pressable
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Guardar cambios</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  avatarContainer: { alignItems: "center", marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    backgroundColor: "#1a73e8",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontSize: 36, fontWeight: "bold" },
  changeAvatarText: { color: "#1a73e8", marginTop: 8, fontWeight: "600" },
  label: { fontWeight: "600", fontSize: 14, marginBottom: 6, color: "#444" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 4,
  },
  inputError: { borderColor: "#e53935" },
  inputDisabled: { backgroundColor: "#f5f5f5", color: "#999" },
  errorText: { color: "#e53935", fontSize: 12, marginBottom: 8 },
  saveBtn: {
    backgroundColor: "#1a73e8",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
