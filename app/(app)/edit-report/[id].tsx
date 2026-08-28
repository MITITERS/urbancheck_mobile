import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

import { imageSource } from "../../../src/api/client";
import { describeApiError, type ApiErrorDescription } from "../../../src/api/errors";
import {
  getReport,
  updateReport,
  type ReportCategory,
  type ReportDetail,
} from "../../../src/api/reports";
import { Notice } from "../../../src/components/Notice";

const CATEGORIES: { value: ReportCategory; label: string; icon: string }[] = [
  { value: "bache", label: "Bache", icon: "construct-outline" },
  { value: "alumbrado", label: "Alumbrado", icon: "bulb-outline" },
  { value: "basura", label: "Basura", icon: "trash-outline" },
  { value: "semaforo", label: "Semáforo", icon: "stopwatch-outline" },
  { value: "vereda", label: "Vereda", icon: "walk-outline" },
  { value: "otro", label: "Otro", icon: "ellipsis-horizontal-outline" },
];

const NOT_EDITABLE = {
  tone: "warning" as const,
  title: "Ya no se puede editar",
  message:
    "El municipio tomó este reporte, así que dejó de ser modificable. Podés seguir su avance desde el detalle.",
};

type NewPhoto = { uri: string; name: string; type: string };

/**
 * Edición de un reporte propio (US-018).
 *
 * Solo tres campos, que son los que el servidor acepta: descripción, categoría
 * y foto. **La ubicación no se edita**: cambiarla convertiría el reporte en otro
 * distinto y dejaría inconsistente el historial de estados ya registrado.
 *
 * Vive fuera de las pestañas, como editar perfil: es una tarea que se abre,
 * se termina y se cierra, no una sección de la app.
 */
export default function EditReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ReportCategory>("bache");
  const [photo, setPhoto] = useState<NewPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ApiErrorDescription | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getReport(Number(id))
      .then((data) => {
        if (cancelled) return;
        setReport(data);
        setDescription(data.description);
        setCategory(data.category);
      })
      .catch((err: unknown) => {
        if (!cancelled) setNotice(describeApiError(err, "No pudimos abrir el reporte"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function pickPhoto(fromCamera: boolean) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      setNotice({
        tone: "warning",
        title: "Permiso necesario",
        message: fromCamera
          ? "Necesitamos acceso a la cámara para sacar la foto nueva."
          : "Necesitamos acceso a la galería para elegir la foto nueva.",
      });
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.8 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;

    // iOS entrega HEIC desde la galería y el backend lo rechaza: se re-codifica
    // siempre a JPEG, igual que en el alta.
    try {
      const context = ImageManipulator.manipulate(asset.uri);
      const rendered = await context.renderAsync();
      const jpeg = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      setPhoto({ uri: jpeg.uri, name: "photo.jpg", type: "image/jpeg" });
    } catch {
      setPhoto({
        uri: asset.uri,
        name: asset.fileName ?? "photo.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
    }
  }

  async function handleSave() {
    if (!description.trim()) {
      setError("La descripción no puede quedar vacía.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const form = new FormData();
      form.append("description", description.trim());
      form.append("category", category);
      // La foto solo viaja si se eligió una nueva: mandar la vieja sería
      // volver a subir el mismo archivo en cada guardado.
      if (photo) {
        form.append("photo", {
          uri: photo.uri,
          name: photo.name,
          type: photo.type,
        } as unknown as Blob);
      }
      await updateReport(Number(id), form);
      router.back();
    } catch (err: unknown) {
      const described = describeApiError(err, "No pudimos guardar los cambios");
      if (described.field === "description") {
        setError(described.message);
      } else {
        setNotice(described);
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

  // El servidor decide si todavía es editable; la pantalla solo lo respeta.
  if (report && !report.can_edit) {
    return (
      <View style={styles.center}>
        <Notice
          visible
          tone={NOT_EDITABLE.tone}
          title={NOT_EDITABLE.title}
          message={NOT_EDITABLE.message}
          actionLabel="Volver"
          onClose={() => router.back()}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Notice
        visible={notice !== null}
        tone={notice?.tone}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        onClose={() => setNotice(null)}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Foto</Text>
        <View style={styles.photoBox}>
          <Image
            source={imageSource(photo?.uri ?? report?.photo ?? "")}
            style={styles.photo}
            resizeMode="cover"
          />
        </View>
        <View style={styles.photoActions}>
          <Pressable style={styles.photoBtn} onPress={() => void pickPhoto(false)}>
            <Ionicons name="images-outline" size={16} color="#1a73e8" />
            <Text style={styles.photoBtnText}>Elegir otra</Text>
          </Pressable>
          <Pressable style={styles.photoBtn} onPress={() => void pickPhoto(true)}>
            <Ionicons name="camera-outline" size={16} color="#1a73e8" />
            <Text style={styles.photoBtnText}>Sacar una</Text>
          </Pressable>
          {photo && (
            <Pressable style={styles.photoBtn} onPress={() => setPhoto(null)}>
              <Ionicons name="arrow-undo-outline" size={16} color="#6b7280" />
              <Text style={[styles.photoBtnText, { color: "#6b7280" }]}>Deshacer</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.label, { marginTop: 22 }]}>Descripción</Text>
        <TextInput
          style={[styles.input, error && styles.inputError]}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          placeholder="Contá qué pasa en el lugar"
          placeholderTextColor="#9ca3af"
        />
        {error && <Text style={styles.errorText}>{error}</Text>}

        <Text style={[styles.label, { marginTop: 22 }]}>Categoría</Text>
        <View style={styles.categories}>
          {CATEGORIES.map((item) => {
            const selected = item.value === category;
            return (
              <Pressable
                key={item.value}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setCategory(item.value)}
              >
                <Ionicons
                  name={item.icon as never}
                  size={15}
                  color={selected ? "#fff" : "#1a73e8"}
                />
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* La ubicación se muestra pero no se toca: es lo que ancla el reporte
            a su municipio y a su historial. */}
        <View style={styles.locked}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.lockedText}>
            La ubicación no se puede cambiar. Si el lugar es otro, cargá un reporte
            nuevo.
          </Text>
        </View>

        <Pressable
          style={[styles.save, saving && styles.saveDisabled]}
          onPress={() => void handleSave()}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>Guardar cambios</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 8 },
  photoBox: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
  },
  photo: { width: "100%", height: 200 },
  photoActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#e8f0fe",
  },
  photoBtnText: { fontSize: 13, fontWeight: "600", color: "#1a73e8" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 12,
    minHeight: 96,
    fontSize: 14,
    color: "#111827",
  },
  inputError: { borderColor: "#e53935" },
  errorText: { color: "#e53935", fontSize: 12, marginTop: 6, fontWeight: "500" },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#c7dbfb",
    backgroundColor: "#fff",
  },
  chipSelected: { backgroundColor: "#1a73e8", borderColor: "#1a73e8" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#1a73e8" },
  chipTextSelected: { color: "#fff" },
  locked: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 22,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
  lockedText: { flex: 1, fontSize: 12.5, color: "#6b7280", lineHeight: 17 },
  save: {
    marginTop: 26,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#1a73e8",
    alignItems: "center",
    justifyContent: "center",
  },
  saveDisabled: { opacity: 0.7 },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
