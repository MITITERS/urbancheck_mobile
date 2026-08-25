import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Callout, Marker, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import { listMapReports, type ReportMarker } from "../../../src/api/reports";
import {
  CATEGORY_LABEL,
  MAPPED_STATUSES,
  STATUS_COLOR,
  STATUS_LABEL,
} from "../../../src/reports/labels";

/** Villa María: punto de partida cuando no hay ubicación ni marcadores. */
const FALLBACK_REGION: Region = {
  latitude: -32.4103,
  longitude: -63.24,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const MARKER_DELTA = 0.05;

export default function MapTab() {
  const router = useRouter();
  const [markers, setMarkers] = useState<ReportMarker[]>([]);
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showsUser, setShowsUser] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listMapReports();
      setMarkers(data.results);
      return data.results;
    } catch {
      setError("No pudimos cargar el mapa. Probá de nuevo.");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const results = await load();
      if (cancelled) return;

      // La vista arranca donde está el usuario; si no dio permiso, sobre el
      // primer reporte, y si no hay ninguno, sobre el municipio.
      const permission = await Location.getForegroundPermissionsAsync();
      const granted =
        permission.granted ||
        (await Location.requestForegroundPermissionsAsync()).granted;
      if (cancelled) return;
      setShowsUser(granted);

      if (granted) {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).catch(() => null);
        if (!cancelled && position) {
          setRegion({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            latitudeDelta: MARKER_DELTA,
            longitudeDelta: MARKER_DELTA,
          });
          return;
        }
      }

      const first = results[0];
      if (!cancelled) {
        setRegion(
          first
            ? {
                latitude: Number(first.latitude),
                longitude: Number(first.longitude),
                latitudeDelta: MARKER_DELTA,
                longitudeDelta: MARKER_DELTA,
              }
            : FALLBACK_REGION,
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (loading || region === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={region}
        showsUserLocation={showsUser}
        showsMyLocationButton={showsUser}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{
              latitude: Number(marker.latitude),
              longitude: Number(marker.longitude),
            }}
            pinColor={STATUS_COLOR[marker.status]}
          >
            <Callout onPress={() => router.push(`/(app)/(tabs)/report/${marker.id}`)}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>
                  {CATEGORY_LABEL[marker.category] ?? marker.category}
                </Text>
                <Text style={styles.calloutStatus}>
                  {STATUS_LABEL[marker.status] ?? marker.status}
                </Text>
                {!!marker.address && (
                  <Text style={styles.calloutAddress} numberOfLines={2}>
                    {marker.address}
                  </Text>
                )}
                <Text style={styles.calloutLink}>Ver detalle</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {error && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
          <Pressable onPress={() => void load()}>
            <Text style={styles.bannerAction}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      {!error && markers.length === 0 && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Todavía no hay reportes geolocalizados para mostrar.
          </Text>
        </View>
      )}

      <View style={styles.legend}>
        {MAPPED_STATUSES.map((status) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]} />
            <Text style={styles.legendText}>{STATUS_LABEL[status]}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.refresh} onPress={() => void load()} hitSlop={8}>
        <Ionicons name="refresh" size={20} color="#1a73e8" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  map: { flex: 1 },
  callout: { minWidth: 160, paddingVertical: 4 },
  calloutTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  calloutStatus: { fontSize: 13, color: "#4b5563", marginTop: 2 },
  calloutAddress: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  calloutLink: { fontSize: 13, color: "#1a73e8", fontWeight: "600", marginTop: 6 },
  banner: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  bannerText: { fontSize: 13, color: "#4b5563" },
  bannerAction: { fontSize: 13, color: "#1a73e8", fontWeight: "600", marginTop: 6 },
  legend: {
    position: "absolute",
    bottom: 96,
    left: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 11, color: "#374151" },
  refresh: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
