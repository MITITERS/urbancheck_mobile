import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import { imageSource } from "../../../src/api/client";
import { describeApiError } from "../../../src/api/errors";
import { operatorKeys } from "../../../src/lib/queryKeys";
import { useRefetchOnFocus } from "../../../src/lib/useRefetchOnFocus";
import { useAssignedReport } from "../../../src/queries/operator";
import { CATEGORY_LABEL } from "../../../src/reports/labels";

/**
 * US-045 — el detalle de un trabajo de la bandeja del operario.
 *
 * Pantalla propia y no la del feed: el operario ve lo que necesita para llegar
 * al lugar y entender el problema, sin las acciones de vecino —comentar, dar me
 * gusta, editar— que su rol no tiene. Reusar la del ciudadano habría obligado a
 * esconder media pantalla con condicionales.
 *
 * Un reporte que no está asignado a su área responde 404 y la pantalla lo dice:
 * el recorte lo hace el servidor, no un filtro de acá.
 */
export default function WorkReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const query = useAssignedReport(Number(id));
  // Al enfocarse y no solo al montar: se vuelve acá desde el formulario de
  // cierre, y el reporte tiene que reflejar que ya se cerró.
  useRefetchOnFocus(operatorKeys.details());

  const report = query.data ?? null;
  const loading = query.isPending;
  const error = query.isError
    ? describeApiError(query.error, "No pudimos abrir este trabajo").message
    : null;

  /**
   * Abre las coordenadas en la aplicación de mapas del dispositivo
   * (escenario 4). Cada plataforma tiene su esquema: `maps:` en iOS, `geo:` en
   * Android. Si ninguno resuelve, se cae a Google Maps en el navegador, que
   * existe en los dos.
   */
  async function openInMaps(latitude: string, longitude: string) {
    const coords = `${latitude},${longitude}`;
    const native =
      Platform.OS === "ios"
        ? `maps:0,0?q=${coords}`
        : `geo:0,0?q=${coords}`;
    try {
      if (await Linking.canOpenURL(native)) {
        await Linking.openURL(native);
        return;
      }
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${coords}`);
    } catch {
      Alert.alert(
        "No pudimos abrir el mapa",
        "Copiá la dirección y buscala en tu aplicación de mapas.",
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  if (error !== null || report === null) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={44} color="#c62828" />
        <Text style={styles.errorText}>
          {error ?? "Este trabajo no está asignado a tu área."}
        </Text>
      </View>
    );
  }

  const hasCoordinates = report.latitude !== null && report.longitude !== null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Image source={imageSource(report.photo)} style={styles.photo} />

      <View style={styles.section}>
        <Text style={styles.category}>
          {CATEGORY_LABEL[report.category] ?? report.category}
        </Text>
        <Text style={styles.description}>{report.description}</Text>
        {report.area_assigned_at && (
          <Text style={styles.meta}>
            Asignado a tu área el{" "}
            {new Date(report.area_assigned_at).toLocaleDateString("es-AR")}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ubicación</Text>
        <Text style={styles.address}>{report.address || "Sin dirección cargada"}</Text>
        {hasCoordinates && (
          <>
            <Pressable
              style={styles.map}
              onPress={() => void openInMaps(report.latitude!, report.longitude!)}
              accessibilityRole="button"
              accessibilityLabel="Abrir la ubicación en la aplicación de mapas"
            >
              <MapView
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
                initialRegion={{
                  latitude: Number(report.latitude),
                  longitude: Number(report.longitude),
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: Number(report.latitude),
                    longitude: Number(report.longitude),
                  }}
                />
              </MapView>
            </Pressable>
            <Pressable
              style={styles.navigateBtn}
              onPress={() => void openInMaps(report.latitude!, report.longitude!)}
            >
              <Ionicons name="navigate-outline" size={18} color="#fff" />
              <Text style={styles.navigateText}>Cómo llegar</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* US-046: el cierre solo se ofrece mientras el trabajo esté vigente. Un
          reporte ya cerrado muestra su parte de trabajo en lugar del botón —el
          escenario 11 no admite un segundo cierre— y el backend lo rechaza
          igual si se intenta. */}
      {report.status === "en_proceso" ? (
        <Pressable
          style={styles.closeBtn}
          onPress={() => router.push(`/(app)/close-report/${report.id}`)}
          accessibilityRole="button"
        >
          <Ionicons name="checkmark-done" size={20} color="#fff" />
          <Text style={styles.closeBtnText}>Registrar la resolución</Text>
        </Pressable>
      ) : (
        report.resolution_evidences.map((evidence) => (
          <View key={evidence.id} style={styles.section}>
            <Text style={styles.sectionTitle}>Resolución registrada</Text>
            <Image source={{ uri: evidence.photo }} style={styles.evidencePhoto} />
            <Text style={styles.description}>{evidence.description}</Text>
            <Text style={styles.meta}>
              {new Date(evidence.created_at).toLocaleDateString("es-AR")}
            </Text>
          </View>
        ))
      )}

      {/* Las respuestas oficiales del municipio también le sirven al operario:
          son el compromiso que se asumió con el vecino sobre este trabajo. */}
      {report.official_responses.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Respuestas oficiales</Text>
          {report.official_responses.map((response) => (
            <View key={response.id} style={styles.official}>
              <Text style={styles.officialHeader}>
                {response.municipality} ·{" "}
                {new Date(response.created_at).toLocaleDateString("es-AR")}
              </Text>
              <Text style={styles.officialText}>{response.text}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7f9" },
  content: { paddingBottom: 32 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  errorText: { color: "#c62828", textAlign: "center", fontSize: 15 },
  photo: { width: "100%", height: 240, backgroundColor: "#eceff1" },
  section: {
    backgroundColor: "#fff",
    marginTop: 10,
    padding: 16,
    gap: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#78909c", textTransform: "uppercase" },
  category: { fontSize: 18, fontWeight: "700", color: "#263238" },
  description: { fontSize: 15, lineHeight: 22, color: "#37474f" },
  meta: { fontSize: 13, color: "#90a4ae" },
  address: { fontSize: 15, color: "#37474f" },
  map: { height: 180, borderRadius: 10, overflow: "hidden", backgroundColor: "#eceff1" },
  navigateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1a73e8",
    paddingVertical: 12,
    borderRadius: 10,
  },
  navigateText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#16a34a",
    marginTop: 10,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  closeBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  evidencePhoto: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    backgroundColor: "#eceff1",
  },
  // Sin filete lateral, igual que en el detalle del vecino: corría el contenido
  // respecto del margen opuesto y pisaba la esquina redondeada.
  official: {
    borderWidth: 1,
    borderColor: "#c6dafc",
    backgroundColor: "#e8f0fe",
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  officialHeader: { fontSize: 12, fontWeight: "700", color: "#1a73e8", textTransform: "uppercase" },
  officialText: { fontSize: 15, lineHeight: 22, color: "#263238" },
})
