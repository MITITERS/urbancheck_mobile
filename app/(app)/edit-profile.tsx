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
import { Ionicons } from "@expo/vector-icons";

import { getMe, patchMe, type UserProfile } from "../../src/api/users";

export default function EditProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [avatar, setAvatar] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u);
        setName(u.name);
        setIsPublic(u.is_public);
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
      // Django interpreta el multipart, así que el booleano viaja como "true"/"false".
      form.append("is_public", isPublic ? "true" : "false");
      if (avatar) {
        form.append("avatar", {
          uri: avatar.uri,
          name: avatar.name,
          type: avatar.type,
        } as any);
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
        <View style={styles.card}>
          <View style={styles.avatarSection}>
            <Pressable style={styles.avatarWrapper} onPress={pickAvatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>
                    {name?.charAt(0)?.toUpperCase() ?? "?"}
                  </Text>
                </View>
              )}
              <View style={styles.cameraIconContainer}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </Pressable>
            <Text style={styles.changeAvatarText}>Cambiar foto de perfil</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre completo"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={user?.email ?? ""}
              editable={false}
            />
            <Text style={styles.helperText}>El correo no puede ser modificado.</Text>
          </View>

          {/* US-027: control de visibilidad del perfil público. */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Privacidad</Text>
            <Pressable
              style={styles.privacyRow}
              onPress={() => setIsPublic((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: isPublic }}
            >
              <Ionicons
                name={isPublic ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={isPublic ? "#1a73e8" : "#6b7280"}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.privacyTitle}>
                  {isPublic ? "Perfil público" : "Perfil privado"}
                </Text>
                <Text style={styles.privacyHint}>
                  {isPublic
                    ? "Otros usuarios pueden ver tus reportes y desde cuándo participás."
                    : "Otros usuarios solo verán tu nombre y tu foto."}
                </Text>
              </View>
              <View style={[styles.switchTrack, isPublic && styles.switchTrackOn]}>
                <View style={[styles.switchThumb, isPublic && styles.switchThumbOn]} />
              </View>
            </Pressable>
          </View>

          <Pressable
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.saveBtnText}>Guardar cambios</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f8f9fa", flexGrow: 1, justifyContent: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarSection: { alignItems: "center", marginBottom: 28 },
  avatarWrapper: {
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    backgroundColor: "#1a73e8",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontSize: 40, fontWeight: "bold" },
  cameraIconContainer: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#1a73e8",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  changeAvatarText: { color: "#1a73e8", marginTop: 10, fontWeight: "600", fontSize: 14 },
  formGroup: { marginBottom: 18 },
  label: { fontWeight: "600", fontSize: 13, marginBottom: 6, color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#1f2937",
    backgroundColor: "#fff",
  },
  inputError: { borderColor: "#e53935" },
  inputDisabled: { backgroundColor: "#f3f4f6", color: "#6b7280", borderColor: "#e5e7eb" },
  errorText: { color: "#e53935", fontSize: 12, marginTop: 4 },
  helperText: { color: "#9ca3af", fontSize: 11, marginTop: 4 },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fafafa",
  },
  privacyTitle: { fontSize: 14, fontWeight: "600", color: "#1f2937" },
  privacyHint: { fontSize: 11, color: "#6b7280", marginTop: 2, lineHeight: 15 },
  switchTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#d1d5db",
    padding: 3,
    justifyContent: "center",
  },
  switchTrackOn: { backgroundColor: "#1a73e8" },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  switchThumbOn: { alignSelf: "flex-end" },
  saveBtn: {
    flexDirection: "row",
    backgroundColor: "#1a73e8",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: "#1a73e8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
