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
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { describeApiError, type ApiErrorDescription } from "../../../src/api/errors";
import { isTooFarError, registerResolution } from "../../../src/api/resolution";
import { Notice } from "../../../src/components/Notice";
import { useKeyboardAwareScroll } from "../../../src/components/useKeyboardAwareScroll";
import { useCurrentLocation } from "../../../src/location/useCurrentLocation";

interface LocalPhoto {
  uri: string;
  name: string;
  type: string;
}

/** Aire al final del formulario, antes de sumarle lo que ocupe el teclado. */
const CONTENT_BOTTOM_PADDING = 40;

/**
 * US-046 — el operario registra la resolución del trabajo.
 *
 * Tres cosas son obligatorias y por motivos distintos: sin foto no hay
 * evidencia de que el trabajo se hizo, sin descripción no se sabe qué se hizo,
 * y sin ubicación no se puede verificar que quien cierra estuvo en el lugar.
 *
 * **La foto se puede sacar con la cámara o elegir de la galería.** El escenario
 * 4 de la historia pedía solo cámara, para que la evidencia correspondiera al
 * trabajo efectivamente ejecutado; se relajó a pedido del producto, porque en la
 * calle la cuadrilla saca las fotos con la cámara del teléfono y las sube
 * después, y obligar a repetir la foto dentro de la app hacía perder la
 * evidencia real.
 *
 * Lo que sostiene la garantía sigue en pie y no se tocó: la **proximidad** se
 * verifica en el servidor contra las coordenadas del reporte, así que el cierre
 * se registra estando en el lugar aunque la foto venga del carrete.
 *
 * La proximidad se verifica **antes** de subir la foto: el backend la vuelve a
 * comprobar y es la fuente de verdad, pero hacer esperar una carga que después
 * se rechaza es maltratar a alguien que está parado en la calle.
 */
export default function CloseReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<ApiErrorDescription | null>(null);
  // El campo de descripción es el último del formulario: sin esto el teclado lo
  // tapa y el operario escribe a ciegas el parte de trabajo. Es el mismo hook
  // que usan el alta y la edición de un reporte, que ya resolvieron esto.
  const descriptionField = useRef<TextInput>(null);
  const keyboard = useKeyboardAwareScroll();

  const location = useCurrentLocation({
    deniedReason:
      "Necesitamos tu ubicación para confirmar que estás en el lugar del trabajo.",
    blockedReason:
      "El permiso de ubicación está bloqueado. Habilitalo en los ajustes del sistema para poder cerrar reportes.",
  });

  /**
   * Toma la foto con la cámara o la elige del carrete, según ``fromCamera``.
   *
   * Los dos caminos terminan igual: re-codificando a JPEG. iOS entrega HEIC
   * —sobre todo desde la galería— y Pillow lo rechaza como imagen inválida, así
   * que la conversión no es opcional. Si falla, se usa el archivo original como
   * respaldo antes que quedarse sin foto.
   */
  async function pickPhoto(fromCamera: boolean) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      setNotice({
        tone: "warning",
        title: "Permiso necesario",
        message: fromCamera
          ? "Necesitamos acceso a la cámara para registrar la evidencia."
          : "Necesitamos acceso a la galería para elegir la foto del trabajo.",
      });
      return;
    }

    try {
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
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
        setPhoto({ uri: jpeg.uri, name: "resolution.jpg", type: "image/jpeg" });
      } catch {
        setPhoto({
          uri: asset.uri,
          name: asset.fileName ?? "resolution.jpg",
          type: asset.mimeType ?? "image/jpeg",
        });
      }
    } catch {
      // Abrir la cámara o la galería puede fallar por su cuenta. Se dice acá y
      // no se deja caer al catch del envío, que hablaría de otra cosa.
      setNotice({
        tone: "error",
        title: fromCamera ? "No pudimos abrir la cámara" : "No pudimos abrir la galería",
        message: "Probá de nuevo. Si sigue pasando, revisá los permisos de la app.",
      });
    }
  }

  async function submit() {
    if (!photo) {
      setNotice({
        tone: "warning",
        title: "Falta la foto",
        message: "Sacá una foto del trabajo terminado para registrar el cierre.",
      });
      return;
    }
    if (description.trim() === "") {
      setNotice({
        tone: "warning",
        title: "Falta la descripción",
        message: "Contá qué trabajo hiciste para que el vecino y el municipio lo vean.",
      });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      // Lectura del momento y no la de hace minutos: es la que se compara
      // contra las coordenadas del reporte.
      const coords = await location.getFreshPosition();
      if (!coords) {
        setNotice({
          tone: "warning",
          title: "Sin ubicación",
          message:
            location.reason ??
            "Necesitamos tu ubicación para confirmar que estás en el lugar.",
        });
        return;
      }

      await registerResolution(Number(id), {
        photo,
        description: description.trim(),
        coords,
      });
      // Vuelve a la bandeja, que se recarga al enfocarse: el reporte cerrado
      // desaparece de la lista de trabajos pendientes.
      router.back();
    } catch (err: unknown) {
      if (isTooFarError(err)) {
        setNotice({
          tone: "warning",
          title: "Estás lejos del lugar",
          message: err.detail,
        });
        return;
      }
      setNotice(describeApiError(err, "No pudimos registrar el cierre"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      {...keyboard.scrollViewProps}
      // El teclado se suma al espacio de abajo: sin eso el scroll no tiene a
      // dónde ir y el campo enfocado no puede subir por encima de él.
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

      <Text style={styles.label}>Foto del trabajo terminado</Text>
      <Text style={styles.help}>
        Es la evidencia de que el trabajo se ejecutó. Sacala en el momento o
        elegí la que ya tenés en el teléfono.
      </Text>
      {photo && <Image source={{ uri: photo.uri }} style={styles.preview} />}
      <View style={styles.photoActions}>
        <Pressable
          style={styles.photoBtn}
          onPress={() => void pickPhoto(true)}
          accessibilityRole="button"
          accessibilityLabel="Sacar la foto del trabajo terminado con la cámara"
        >
          <Ionicons name="camera" size={22} color="#1a73e8" />
          <Text style={styles.photoBtnText}>
            {photo ? "Sacar otra" : "Sacar foto"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.photoBtn}
          onPress={() => void pickPhoto(false)}
          accessibilityRole="button"
          accessibilityLabel="Elegir la foto del trabajo terminado de la galería"
        >
          <Ionicons name="images-outline" size={22} color="#1a73e8" />
          <Text style={styles.photoBtnText}>Desde la galería</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>¿Qué trabajo hiciste?</Text>
      <TextInput
        ref={descriptionField}
        onFocus={() => keyboard.focusField(descriptionField)}
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="Se rellenó el bache con asfalto en frío y se compactó."
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        accessibilityLabel="Descripción del trabajo realizado"
      />

      <Text style={styles.disclaimer}>
        El vecino tiene un plazo para objetar el cierre. Si no lo objeta, el
        reporte queda confirmado como resuelto.
      </Text>

      <Pressable
        style={[styles.submit, submitting && styles.submitDisabled]}
        onPress={() => void submit()}
        disabled={submitting}
        accessibilityRole="button"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Registrar la resolución</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, gap: 10 },
  label: { fontSize: 15, fontWeight: "700", color: "#263238", marginTop: 6 },
  help: { fontSize: 13, color: "#78909c" },
  photoActions: { flexDirection: "row", gap: 10 },
  photoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbdefb",
    borderStyle: "dashed",
    backgroundColor: "#f5faff",
  },
  photoBtnText: { color: "#1a73e8", fontWeight: "700", fontSize: 14 },
  preview: { width: "100%", height: 220, borderRadius: 12, backgroundColor: "#eceff1" },
  input: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 10,
    padding: 12,
    minHeight: 96,
    fontSize: 15,
    color: "#263238",
  },
  disclaimer: {
    fontSize: 13,
    color: "#78909c",
    backgroundColor: "#f5f7f9",
    borderRadius: 8,
    padding: 10,
  },
  submit: {
    marginTop: 6,
    backgroundColor: "#1a73e8",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
