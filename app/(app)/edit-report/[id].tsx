import { Ionicons } from "@expo/vector-icons";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
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

import { errorDetail, isSessionExpired } from "../../../src/api/errors";
import {
  type ReportCategory,
  type ReportDetail,
  getReport,
  updateReport,
} from "../../../src/api/reports";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  CATEGORY_VALUES,
  statusLabel,
} from "../../../src/constants/reports";

interface PhotoDraft {
  uri: string;
  name: string;
  type: string;
}

export default function EditReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ReportCategory>("bache");
  const [newPhoto, setNewPhoto] = useState<PhotoDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      try {
        const data = await getReport(Number(id));
        setReport(data);
        setDescription(data.description);
        setCategory(data.category);
      } catch (err) {
        if (!isSessionExpired(err)) {
          Alert.alert("Error", "No se pudo cargar el reporte.");
        }
        setReport(null);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  async function applyPhotoAsset(asset: ImagePicker.ImagePickerAsset) {
    // iOS entrega HEIC desde la galería y el backend (Pillow) lo rechaza:
    // re-codificamos siempre a JPEG, igual que en el alta del reporte.
    try {
      const context = ImageManipulator.manipulate(asset.uri);
      const rendered = await context.renderAsync();
      const jpeg = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      setNewPhoto({ uri: jpeg.uri, name: "photo.jpg", type: "image/jpeg" });
    } catch {
      const name = asset.fileName ?? asset.uri.split("/").pop() ?? "photo.jpg";
      setNewPhoto({ uri: asset.uri, name, type: asset.mimeType ?? "image/jpeg" });
    }
  }

  async function pickFrom(source: "camera" | "library") {
    try {
      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permiso necesario", "No se otorgó acceso.");
        return;
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        await applyPhotoAsset(result.assets[0]);
      }
    } catch (err) {
      Alert.alert("Error", String(err));
    }
  }

  function handlePhotoPress() {
    Alert.alert("Cambiar foto", "Elegí de dónde tomar la nueva foto:", [
      { text: "Cámara", onPress: () => void pickFrom("camera") },
      { text: "Galería", onPress: () => void pickFrom("library") },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  async function handleSave() {
    if (!description.trim()) {
      setErrors({ description: "La descripción no puede quedar vacía." });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      // Solo se manda multipart cuando hay foto nueva; para texto, JSON es más liviano.
      if (newPhoto) {
        const form = new FormData();
        form.append("description", description.trim());
        form.append("category", category);
        form.append("photo", {
          uri: newPhoto.uri,
          name: newPhoto.name,
          type: newPhoto.type,
        } as any);
        await updateReport(Number(id), form);
      } else {
        await updateReport(Number(id), { description: description.trim(), category });
      }
      Alert.alert("Cambios guardados", "Tu reporte se actualizó correctamente.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      if (isSessionExpired(err)) return;
      const data = err as Record<string, unknown>;
      if (Array.isArray(data?.description)) {
        setErrors({ description: String(data.description[0]) });
      } else {
        Alert.alert(
          "No se pudo guardar",
          errorDetail(err, "Ocurrió un error al guardar los cambios."),
        );
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

  if (!report) {
    return (
      <View style={styles.center}>
        <Text style={styles.blockedText}>Reporte no encontrado.</Text>
      </View>
    );
  }

  // US-018: el backend rechaza la edición si el reporte ya está en gestión; acá
  // la bloqueamos antes para explicar el porqué en vez de mostrar un error.
  if (!report.can_edit) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={48} color="#ccc" style={{ marginBottom: 12 }} />
        <Text style={styles.blockedTitle}>Este reporte ya no puede modificarse</Text>
        <Text style={styles.blockedText}>
          Está en estado “{statusLabel(report.status)}” y el municipio ya comenzó a gestionarlo.
        </Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Volver al detalle</Text>
        </Pressable>
      </View>
    );
  }

  const photoUri = newPhoto?.uri ?? report.photo;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f8f9fa" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Foto del incidente</Text>
          <View style={styles.previewContainer}>
            <Image source={{ uri: photoUri }} style={styles.previewImage} />
            <Pressable style={styles.changePhotoBtn} onPress={handlePhotoPress}>
              <Ionicons
                name="camera-reverse"
                size={16}
                color="#1a73e8"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.changePhotoText}>Cambiar</Text>
            </Pressable>
          </View>
          {newPhoto && (
            <View style={styles.hintRow}>
              <Ionicons name="information-circle-outline" size={14} color="#1a73e8" />
              <Text style={styles.hintText}>
                La foto se reemplazará al guardar los cambios.
              </Text>
            </View>
          )}

          <Text style={[styles.label, { marginTop: 20 }]}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.multiline, errors.description && styles.inputError]}
            placeholder="Describí brevemente cuál es el problema…"
            placeholderTextColor="#9ca3af"
            multiline
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              setErrors({});
            }}
          />
          {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}

          <Text style={[styles.label, { marginTop: 20 }]}>Categoría</Text>
          <View style={styles.categoryContainer}>
            {CATEGORY_VALUES.map((value) => {
              const active = category === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategory(value)}
                >
                  <Ionicons
                    name={CATEGORY_ICON[value] as any}
                    size={16}
                    color={active ? "#1a73e8" : "#4b5563"}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {CATEGORY_LABEL[value]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.noteBox}>
            <Ionicons name="location-outline" size={16} color="#6b7280" />
            <Text style={styles.noteText}>
              La ubicación del reporte no puede modificarse. Si es incorrecta, eliminá el
              reporte y creá uno nuevo.
            </Text>
          </View>

          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>Guardar cambios</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#f8f9fa",
  },
  blockedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    textAlign: "center",
    marginBottom: 8,
  },
  blockedText: { fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 19 },
  backBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#e8f0fe",
  },
  backBtnText: { color: "#1a73e8", fontWeight: "600", fontSize: 14 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  label: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8 },
  previewContainer: {
    position: "relative",
    width: "100%",
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  previewImage: { width: "100%", height: "100%" },
  changePhotoBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: "center",
  },
  changePhotoText: { color: "#1a73e8", fontSize: 12, fontWeight: "600" },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  hintText: { fontSize: 11, color: "#1a73e8", fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1f2937",
    backgroundColor: "#fff",
  },
  multiline: { height: 110, textAlignVertical: "top" },
  inputError: { borderColor: "#e53935", backgroundColor: "#fff5f5" },
  errorText: { color: "#e53935", fontSize: 12, marginTop: 6, fontWeight: "500" },
  categoryContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipActive: { backgroundColor: "#e8f0fe", borderColor: "#1a73e8" },
  chipText: { fontSize: 12, color: "#4b5563", fontWeight: "500" },
  chipTextActive: { color: "#1a73e8", fontWeight: "700" },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
  noteText: { flex: 1, fontSize: 12, color: "#6b7280", lineHeight: 17 },
  saveButton: {
    flexDirection: "row",
    backgroundColor: "#1a73e8",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
