import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
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

import { createReport, type ReportCategory } from "../../src/api/reports";
import { uriToBlob } from "../../src/api/client";

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: "bache", label: "Bache" },
  { value: "alumbrado", label: "Alumbrado" },
  { value: "basura", label: "Basura" },
  { value: "semaforo", label: "Semáforo" },
  { value: "vereda", label: "Vereda" },
  { value: "otro", label: "Otro" },
];

export default function CreateReportScreen() {
  const router = useRouter();
  const [photo, setPhoto] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ReportCategory>("bache");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function pickPhoto() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permiso necesario", "Se necesita acceso a la galería.\nEstado: " + perm.status);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.uri;
        const name = uri.split("/").pop() ?? "photo.jpg";
        const type = asset.mimeType ?? "image/jpeg";
        setPhoto({ uri, name, type });
      }
    } catch (err) {
      Alert.alert("Error galería", String(err));
    }
  }

  async function takePhoto() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permiso necesario", "Se necesita acceso a la cámara.\nEstado: " + perm.status);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.uri;
        const name = uri.split("/").pop() ?? "photo.jpg";
        const type = asset.mimeType ?? "image/jpeg";
        setPhoto({ uri, name, type });
      }
    } catch (err) {
      Alert.alert("Error cámara", String(err));
    }
  }

  async function getLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso denegado",
          "No se pudo obtener la ubicación. Ingresala manualmente.",
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      setAddress("");
    } catch {
      Alert.alert("Error", "No se pudo obtener la ubicación GPS. Ingresala manualmente.");
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit() {
    const newErrors: Record<string, string> = {};
    if (!photo) newErrors.photo = "La foto es obligatoria.";
    if (!description.trim()) newErrors.description = "La descripción es obligatoria.";
    if (!latitude && !longitude && !address.trim()) {
      newErrors.location = "Ingresá una ubicación (GPS o dirección).";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const form = new FormData();
      const blob = await uriToBlob(photo!.uri);
      form.append("photo", blob, photo!.name);
      form.append("description", description);
      form.append("category", category);
      if (latitude != null) form.append("latitude", String(latitude));
      if (longitude != null) form.append("longitude", String(longitude));
      if (address) form.append("address", address);

      await createReport(form);
      Alert.alert("¡Reporte enviado!", "Tu reporte fue creado correctamente.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const data = err as Record<string, unknown>;
      if (data?.photo) {
        setErrors({ photo: String((data.photo as string[])[0]) });
      } else if (err instanceof Error) {
        Alert.alert("Error de red", err.message);
      } else {
        Alert.alert("Error servidor", JSON.stringify(err).slice(0, 300));
      }
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.sectionLabel}>Foto *</Text>
        <View style={styles.photoRow}>
          <Pressable style={styles.photoBtn} onPress={pickPhoto}>
            <Text style={styles.photoBtnText}>Galería</Text>
          </Pressable>
          <Pressable style={styles.photoBtn} onPress={takePhoto}>
            <Text style={styles.photoBtnText}>Cámara</Text>
          </Pressable>
        </View>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.preview} />
        ) : (
          <Text style={styles.placeholder}>Sin foto seleccionada</Text>
        )}
        {errors.photo && <Text style={styles.errorText}>{errors.photo}</Text>}

        <Text style={styles.sectionLabel}>Descripción *</Text>
        <TextInput
          style={[styles.input, styles.multiline, errors.description && styles.inputError]}
          placeholder="Describí el problema..."
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />
        {errors.description && (
          <Text style={styles.errorText}>{errors.description}</Text>
        )}

        <Text style={styles.sectionLabel}>Categoría</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.value}
              style={[
                styles.categoryChip,
                category === c.value && styles.categoryChipActive,
              ]}
              onPress={() => setCategory(c.value)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  category === c.value && styles.categoryChipTextActive,
                ]}
              >
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Ubicación *</Text>
        <Pressable style={styles.gpsBtn} onPress={getLocation} disabled={locating}>
          {locating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.gpsBtnText}>
              {latitude != null ? "✓ Ubicación GPS obtenida" : "Usar GPS"}
            </Text>
          )}
        </Pressable>
        <Text style={styles.orText}>— o ingresá la dirección manualmente —</Text>
        <TextInput
          style={[styles.input, errors.location && styles.inputError]}
          placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
          value={address}
          onChangeText={(t) => {
            setAddress(t);
            if (t) { setLatitude(null); setLongitude(null); }
          }}
        />
        {errors.location && (
          <Text style={styles.errorText}>{errors.location}</Text>
        )}

        <Pressable
          style={[styles.submitBtn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Enviar reporte</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#fff" },
  sectionLabel: { fontWeight: "600", fontSize: 15, marginTop: 16, marginBottom: 6 },
  photoRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  photoBtn: {
    flex: 1,
    backgroundColor: "#e8f0fe",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  photoBtnText: { color: "#1a73e8", fontWeight: "600" },
  preview: { width: "100%", height: 200, borderRadius: 8, marginBottom: 4 },
  placeholder: { color: "#999", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 4,
  },
  multiline: { height: 100, textAlignVertical: "top" },
  inputError: { borderColor: "#e53935" },
  errorText: { color: "#e53935", fontSize: 12, marginBottom: 4 },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  categoryChipActive: { borderColor: "#1a73e8", backgroundColor: "#e8f0fe" },
  categoryChipText: { color: "#666", fontSize: 13 },
  categoryChipTextActive: { color: "#1a73e8", fontWeight: "600" },
  gpsBtn: {
    backgroundColor: "#1a73e8",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  gpsBtnText: { color: "#fff", fontWeight: "600" },
  orText: { textAlign: "center", color: "#999", fontSize: 12, marginBottom: 8 },
  submitBtn: {
    backgroundColor: "#1a73e8",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 32,
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
