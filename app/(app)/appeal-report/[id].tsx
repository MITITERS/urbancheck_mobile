import { useLocalSearchParams, useRouter } from "expo-router";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { describeApiError, type ApiErrorDescription } from "../../../src/api/errors";
import { appealResolution } from "../../../src/api/resolution";
import { Notice } from "../../../src/components/Notice";
import { useKeyboardAwareScroll } from "../../../src/components/useKeyboardAwareScroll";

interface LocalPhoto {
  uri: string;
  name: string;
  type: string;
}

/** Aire al final del formulario, antes de sumarle lo que ocupe el teclado. */
const CONTENT_BOTTOM_PADDING = 40;

/**
 * US-048 — el autor objeta el cierre de su reporte.
 *
 * Es el control humano sobre el cierre: el operario certifica su propio
 * trabajo, y esto es lo que impide que esa certificación sea la única palabra.
 *
 * Motivo y foto son los dos obligatorios. Una apelación sin evidencia no se
 * distingue de una objeción caprichosa y no reabre trabajo municipal, así que
 * la foto se saca con la cámara por el mismo criterio que el cierre de US-046.
 *
 * **Es una sola por reporte.** El aviso está en pantalla antes de enviar, no
 * después: el segundo cierre del operario es definitivo, y quien objeta tiene
 * que saberlo mientras decide si le conviene hacerlo ahora.
 */
export default function AppealReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<ApiErrorDescription | null>(null);
  // Mismo caso que el cierre del operario: el motivo es el último campo y el
  // teclado lo tapa entero.
  const reasonField = useRef<TextInput>(null);
  const keyboard = useKeyboardAwareScroll();

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") {
      setNotice({
        tone: "warning",
        title: "Permiso necesario",
        message: "Necesitamos acceso a la cámara para ver cómo está el problema hoy.",
      });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      quality: 0.8,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;

    try {
      const context = ImageManipulator.manipulate(asset.uri);
      const rendered = await context.renderAsync();
      const jpeg = await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.8,
      });
      setPhoto({ uri: jpeg.uri, name: "appeal.jpg", type: "image/jpeg" });
    } catch {
      setPhoto({
        uri: asset.uri,
        name: asset.fileName ?? "appeal.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
    }
  }

  async function submit() {
    if (!photo) {
      setNotice({
        tone: "warning",
        title: "Falta la foto",
        message: "Sacá una foto de cómo está el problema ahora.",
      });
      return;
    }
    if (reason.trim() === "") {
      setNotice({
        tone: "warning",
        title: "Falta el motivo",
        message: "Contá por qué el problema no quedó resuelto.",
      });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      await appealResolution(Number(id), { photo, reason: reason.trim() });
      router.back();
    } catch (err: unknown) {
      setNotice(describeApiError(err, "No pudimos registrar tu objeción"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      {...keyboard.scrollViewProps}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: CONTENT_BOTTOM_PADDING + keyboard.keyboardOffset },
      ]}
    >
      <Notice
        visible={notice !== null}
        tone={notice?.tone}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        onClose={() => setNotice(null)}
      />

      <Text style={styles.warning}>
        Podés objetar el cierre una sola vez. Si el municipio vuelve a
        intervenir, ese segundo cierre es definitivo.
      </Text>

      <Text style={styles.label}>Foto del problema hoy</Text>
      {photo ? (
        <Pressable onPress={() => void takePhoto()}>
          <Image source={{ uri: photo.uri }} style={styles.preview} />
          <Text style={styles.retake}>Sacar otra foto</Text>
        </Pressable>
      ) : (
        <Pressable
          style={styles.cameraBtn}
          onPress={() => void takePhoto()}
          accessibilityRole="button"
          accessibilityLabel="Sacar una foto del estado actual del problema"
        >
          <Ionicons name="camera" size={26} color="#e53935" />
          <Text style={styles.cameraBtnText}>Sacar foto</Text>
        </Pressable>
      )}

      <Text style={styles.label}>¿Por qué no quedó resuelto?</Text>
      <TextInput
        ref={reasonField}
        onFocus={() => keyboard.focusField(reasonField)}
        style={styles.input}
        value={reason}
        onChangeText={setReason}
        placeholder="El bache sigue igual que antes, no lo taparon."
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        accessibilityLabel="Motivo de la objeción"
      />

      <Pressable
        style={[styles.submit, submitting && styles.submitDisabled]}
        onPress={() => void submit()}
        disabled={submitting}
        accessibilityRole="button"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Objetar el cierre</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, gap: 10 },
  warning: {
    fontSize: 13,
    color: "#b71c1c",
    backgroundColor: "#ffebee",
    borderRadius: 8,
    padding: 10,
  },
  label: { fontSize: 15, fontWeight: "700", color: "#263238", marginTop: 6 },
  cameraBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffcdd2",
    borderStyle: "dashed",
    backgroundColor: "#fff5f5",
  },
  cameraBtnText: { color: "#e53935", fontWeight: "700", fontSize: 15 },
  preview: { width: "100%", height: 220, borderRadius: 12, backgroundColor: "#eceff1" },
  retake: { marginTop: 6, color: "#1a73e8", fontWeight: "600", textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 10,
    padding: 12,
    minHeight: 96,
    fontSize: 15,
    color: "#263238",
  },
  submit: {
    marginTop: 6,
    backgroundColor: "#e53935",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
