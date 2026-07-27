import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  createReport,
  geocodeAddress,
  type GeocodeResult,
  type ReportCategory,
} from "../../../src/api/reports";

const CATEGORIES: { value: ReportCategory; label: string; icon: string }[] = [
  { value: "bache", label: "Bache", icon: "construct-outline" },
  { value: "alumbrado", label: "Alumbrado", icon: "bulb-outline" },
  { value: "basura", label: "Basura", icon: "trash-outline" },
  { value: "semaforo", label: "Semáforo", icon: "stopwatch-outline" },
  { value: "vereda", label: "Vereda", icon: "walk-outline" },
  { value: "otro", label: "Otro", icon: "ellipsis-horizontal-outline" },
];

export default function CreateReportTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ReportCategory>("bache");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [locationMode, setLocationMode] = useState<"gps" | "manual">("gps");
  const [locationFromPhoto, setLocationFromPhoto] = useState(false);
  const [locating, setLocating] = useState(false);
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  // Evita que el autocompletado vuelva a buscar el texto que el propio usuario
  // acaba de elegir de la lista de sugerencias.
  const justSelectedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Intenta extraer coordenadas GPS del EXIF de una imagen.
   * expo-image-picker devuelve GPSLatitude/GPSLongitude como grados decimales
   * (positivos), y GPSLatitudeRef/GPSLongitudeRef ("N"/"S", "E"/"W") indican el signo.
   * Nota: en iOS las fotos tomadas con la cámara no incluyen tags GPS.
   */
  function extractExifLocation(
    exif: Record<string, any> | null | undefined,
  ): { latitude: number; longitude: number } | null {
    if (!exif) return null;
    const rawLat = exif.GPSLatitude;
    const rawLon = exif.GPSLongitude;
    if (typeof rawLat !== "number" || typeof rawLon !== "number") return null;
    if (rawLat === 0 && rawLon === 0) return null;

    const latRef = typeof exif.GPSLatitudeRef === "string" ? exif.GPSLatitudeRef : "N";
    const lonRef = typeof exif.GPSLongitudeRef === "string" ? exif.GPSLongitudeRef : "E";
    const latitude = latRef.toUpperCase() === "S" ? -Math.abs(rawLat) : Math.abs(rawLat);
    const longitude = lonRef.toUpperCase() === "W" ? -Math.abs(rawLon) : Math.abs(rawLon);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
    return { latitude, longitude };
  }

  async function applyPhotoAsset(asset: ImagePicker.ImagePickerAsset) {
    // Extraemos la ubicación del EXIF ANTES de convertir la imagen: la conversión
    // a JPEG elimina los metadatos, pero asset.exif viene directo del picker.
    if (latitude == null && longitude == null && !address.trim()) {
      const coords = extractExifLocation(asset.exif);
      if (coords) {
        setLatitude(coords.latitude);
        setLongitude(coords.longitude);
        setAddress("");
        setLocationMode("gps");
        setLocationFromPhoto(true);
        setErrors((prev) => ({ ...prev, location: "" }));
      }
    }

    // iOS entrega las fotos de la galería en formato HEIC, que el backend (Pillow)
    // rechaza como "imagen inválida". Re-codificamos siempre a JPEG para garantizar
    // un formato compatible.
    try {
      const context = ImageManipulator.manipulate(asset.uri);
      const rendered = await context.renderAsync();
      const jpeg = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.8,
      });
      setPhoto({ uri: jpeg.uri, name: "photo.jpg", type: "image/jpeg" });
    } catch {
      // Si la conversión falla, usamos la imagen original como respaldo.
      const name = asset.fileName ?? asset.uri.split("/").pop() ?? "photo.jpg";
      const type = asset.mimeType ?? "image/jpeg";
      setPhoto({ uri: asset.uri, name, type });
    }
    setErrors((prev) => ({ ...prev, photo: "" }));
  }

  async function pickPhoto() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permiso necesario", "Se necesita acceso a la galería.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.8,
        exif: true,
      });
      if (!result.canceled && result.assets[0]) {
        await applyPhotoAsset(result.assets[0]);
      }
    } catch (err) {
      Alert.alert("Error galería", String(err));
    }
  }

  async function takePhoto() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permiso necesario", "Se necesita acceso a la cámara.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.8,
        exif: true,
      });
      if (!result.canceled && result.assets[0]) {
        await applyPhotoAsset(result.assets[0]);
      }
    } catch (err) {
      Alert.alert("Error cámara", String(err));
    }
  }

  function handlePhotoPress() {
    Alert.alert(
      "Adjuntar Foto",
      "Elegí de dónde querés seleccionar la foto para tu reporte:",
      [
        { text: "Cámara", onPress: takePhoto },
        { text: "Galería", onPress: pickPhoto },
        { text: "Cancelar", style: "cancel" },
      ],
    );
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
      setLocationFromPhoto(false);
      setErrors((prev) => ({ ...prev, location: "" }));
    } catch {
      Alert.alert("Error GPS", "No se pudo obtener la ubicación GPS. Ingresala manualmente.");
    } finally {
      setLocating(false);
    }
  }

  // Autocompletado de direcciones (modo manual). Debounce alto (600ms) + mínimo de
  // caracteres para respetar la política de uso de Nominatim (máx. 1 req/seg) y no
  // buscar en cada pulsación de tecla.
  useEffect(() => {
    if (locationMode !== "manual") {
      setSuggestions([]);
      return;
    }
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    const query = address.trim();
    if (query.length < 4) {
      setSuggestions([]);
      setSearchingAddress(false);
      return;
    }

    let cancelled = false;
    setSearchingAddress(true);
    const timer = setTimeout(async () => {
      try {
        const { results } = await geocodeAddress(query);
        if (!cancelled) setSuggestions(results);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSearchingAddress(false);
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address, locationMode]);

  function selectSuggestion(item: GeocodeResult) {
    justSelectedRef.current = true;
    setAddress(item.display_name);
    setLatitude(item.latitude);
    setLongitude(item.longitude);
    setSuggestions([]);
    setLocationFromPhoto(false);
    setErrors((prev) => ({ ...prev, location: "" }));
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
      form.append("photo", {
        uri: photo!.uri,
        name: photo!.name,
        type: photo!.type,
      } as any);
      form.append("description", description);
      form.append("category", category);
      if (latitude != null) form.append("latitude", latitude.toFixed(6));
      if (longitude != null) form.append("longitude", longitude.toFixed(6));
      if (address) form.append("address", address);

      await createReport(form);
      Alert.alert("¡Reporte enviado!", "Tu reporte fue creado correctamente.", [
        {
          text: "OK",
          onPress: () => {
            // Reset state
            setPhoto(null);
            setDescription("");
            setCategory("bache");
            setLatitude(null);
            setLongitude(null);
            setAddress("");
            setLocationMode("gps");
            setLocationFromPhoto(false);
            setSuggestions([]);
            // Redirect to Feed tab
            router.push("/(app)/(tabs)");
          },
        },
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
      style={{ flex: 1, backgroundColor: "#f8f9fa" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 16 : 24 }]}>
        <Text style={styles.title}>Nuevo Reporte</Text>
        <Text style={styles.subtitle}>Reportá problemas en la vía pública para que el municipio los resuelva.</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* PHOTO SELECTOR */}
          <Text style={styles.label}>Foto del incidente *</Text>
          {photo ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: photo.uri }} style={styles.previewImage} />
              <Pressable style={styles.deletePhotoBtn} onPress={() => setPhoto(null)}>
                <Ionicons name="trash" size={18} color="#fff" />
              </Pressable>
              <Pressable style={styles.changePhotoBtn} onPress={handlePhotoPress}>
                <Ionicons name="camera-reverse" size={16} color="#1a73e8" style={{ marginRight: 4 }} />
                <Text style={styles.changePhotoText}>Cambiar</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.uploadBox, errors.photo && styles.borderError]}
              onPress={handlePhotoPress}
            >
              <Ionicons name="camera-outline" size={40} color={errors.photo ? "#e53935" : "#1a73e8"} />
              <Text style={[styles.uploadTitle, errors.photo && styles.textError]}>
                Tomar foto o subir imagen
              </Text>
              <Text style={styles.uploadSubtitle}>Formatos soportados: JPG, PNG</Text>
            </Pressable>
          )}
          {errors.photo && <Text style={styles.errorText}>{errors.photo}</Text>}

          {/* DESCRIPTION */}
          <Text style={[styles.label, { marginTop: 20 }]}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.multiline, errors.description && styles.inputError]}
            placeholder="Describí brevemente cuál es el problema..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              setErrors((prev) => ({ ...prev, description: "" }));
            }}
          />
          {errors.description && (
            <Text style={styles.errorText}>{errors.description}</Text>
          )}

          {/* CATEGORIES CHIPS */}
          <Text style={[styles.label, { marginTop: 20 }]}>Categoría</Text>
          <View style={styles.categoryContainer}>
            {CATEGORIES.map((c) => {
              const active = category === c.value;
              return (
                <Pressable
                  key={c.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategory(c.value)}
                >
                  <Ionicons
                    name={c.icon as any}
                    size={16}
                    color={active ? "#1a73e8" : "#4b5563"}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* LOCATION SELECTOR */}
          <Text style={[styles.label, { marginTop: 20 }]}>Ubicación del incidente *</Text>

          <View style={styles.segmentRow}>
            <Pressable
              style={[styles.segment, locationMode === "gps" && styles.segmentActive]}
              onPress={() => {
                setLocationMode("gps");
                setAddress("");
                setErrors((prev) => ({ ...prev, location: "" }));
              }}
            >
              <Ionicons
                name="location-outline"
                size={16}
                color={locationMode === "gps" ? "#1a73e8" : "#6b7280"}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.segmentText, locationMode === "gps" && styles.segmentTextActive]}>
                GPS
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segment, locationMode === "manual" && styles.segmentActive]}
              onPress={() => {
                setLocationMode("manual");
                setLatitude(null);
                setLongitude(null);
                setLocationFromPhoto(false);
                setErrors((prev) => ({ ...prev, location: "" }));
              }}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={locationMode === "manual" ? "#1a73e8" : "#6b7280"}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.segmentText, locationMode === "manual" && styles.segmentTextActive]}>
                Dirección
              </Text>
            </Pressable>
          </View>

          {locationMode === "gps" ? (
            <View style={styles.locationContainer}>
              <Pressable
                style={[
                  styles.gpsButton,
                  latitude != null && styles.gpsButtonSuccess,
                  locating && styles.gpsButtonDisabled,
                ]}
                onPress={getLocation}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name={latitude != null ? "checkmark-circle" : "location-outline"}
                      size={18}
                      color="#fff"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.gpsButtonText}>
                      {latitude != null ? "Ubicación GPS Guardada" : "Obtener Ubicación GPS"}
                    </Text>
                  </>
                )}
              </Pressable>
              {latitude != null && longitude != null && (
                <Text style={styles.coordinatesText}>
                  Lat: {latitude.toFixed(6)} | Lon: {longitude.toFixed(6)}
                </Text>
              )}
              {locationFromPhoto && latitude != null && (
                <View style={styles.photoLocationHint}>
                  <Ionicons name="image-outline" size={14} color="#10b981" style={{ marginRight: 4 }} />
                  <Text style={styles.photoLocationHintText}>
                    Ubicación obtenida de la foto
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.locationContainer}>
              <View style={styles.addressInputWrapper}>
                <Ionicons name="map-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputWithIcon, errors.location && styles.inputError]}
                  placeholder="Ej: Av. Corrientes 1234, CABA"
                  placeholderTextColor="#9ca3af"
                  value={address}
                  onChangeText={(t) => {
                    setAddress(t);
                    // El texto ya no corresponde a la sugerencia elegida: descartamos
                    // las coordenadas hasta que el usuario seleccione otra (o el backend
                    // geocodifique la dirección al enviar).
                    setLatitude(null);
                    setLongitude(null);
                    setErrors((prev) => ({ ...prev, location: "" }));
                  }}
                />
              </View>

              {searchingAddress && (
                <View style={styles.addressStatusRow}>
                  <ActivityIndicator size="small" color="#6b7280" />
                  <Text style={styles.addressStatusText}>Buscando dirección…</Text>
                </View>
              )}

              {suggestions.length > 0 && (
                <View style={styles.suggestionsBox}>
                  {suggestions.map((item, i) => (
                    <Pressable
                      key={`${item.latitude},${item.longitude},${i}`}
                      style={[
                        styles.suggestionItem,
                        i < suggestions.length - 1 && styles.suggestionItemBorder,
                      ]}
                      onPress={() => selectSuggestion(item)}
                    >
                      <Ionicons
                        name="location-outline"
                        size={16}
                        color="#1a73e8"
                        style={{ marginRight: 8, marginTop: 1 }}
                      />
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {item.display_name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {latitude != null && longitude != null && (
                <View style={styles.photoLocationHint}>
                  <Ionicons name="checkmark-circle" size={14} color="#10b981" style={{ marginRight: 4 }} />
                  <Text style={styles.photoLocationHintText}>
                    Ubicación fijada · Lat: {latitude.toFixed(5)} | Lon: {longitude.toFixed(5)}
                  </Text>
                </View>
              )}
            </View>
          )}
          {errors.location && (
            <Text style={styles.errorText}>{errors.location}</Text>
          )}

          {/* SUBMIT BUTTON */}
          <Pressable
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>Enviar Reporte</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#1f2937" },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4, lineHeight: 18 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  label: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 8 },
  uploadBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#1a73e8",
    backgroundColor: "#f4f8ff",
    borderRadius: 12,
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  borderError: { borderColor: "#e53935", backgroundColor: "#fff5f5" },
  textError: { color: "#e53935" },
  uploadTitle: { fontSize: 15, fontWeight: "600", color: "#1a73e8", marginTop: 8 },
  uploadSubtitle: { fontSize: 11, color: "#6b7280", marginTop: 4 },
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
  deletePhotoBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(229, 57, 53, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  changePhotoText: { color: "#1a73e8", fontSize: 12, fontWeight: "600" },
  errorText: { color: "#e53935", fontSize: 12, marginTop: 6, fontWeight: "500" },
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
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
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
  chipActive: {
    backgroundColor: "#e8f0fe",
    borderColor: "#1a73e8",
  },
  chipText: { fontSize: 12, color: "#4b5563", fontWeight: "500" },
  chipTextActive: { color: "#1a73e8", fontWeight: "700" },
  locationContainer: {
    alignItems: "stretch",
    gap: 6,
  },
  gpsButton: {
    flexDirection: "row",
    backgroundColor: "#1a73e8",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1a73e8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  gpsButtonSuccess: {
    backgroundColor: "#10b981",
    shadowColor: "#10b981",
  },
  gpsButtonDisabled: { opacity: 0.6 },
  gpsButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  coordinatesText: {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "center",
    fontWeight: "500",
    marginTop: 2,
  },
  photoLocationHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  photoLocationHintText: {
    fontSize: 11,
    color: "#10b981",
    fontWeight: "600",
  },
  segmentRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  segmentTextActive: { color: "#1a73e8", fontWeight: "700" },
  addressInputWrapper: { position: "relative", justifyContent: "center" },
  inputIcon: { position: "absolute", left: 14, zIndex: 1 },
  inputWithIcon: { paddingLeft: 42 },
  addressStatusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  addressStatusText: { fontSize: 12, color: "#6b7280" },
  suggestionsBox: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  suggestionItemBorder: { borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  suggestionText: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 18 },
  submitButton: {
    flexDirection: "row",
    backgroundColor: "#1a73e8",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
    shadowColor: "#1a73e8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
