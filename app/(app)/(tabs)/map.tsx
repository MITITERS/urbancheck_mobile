import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Callout, Marker, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import {
  listMapReports,
  type FeedCoverage,
  type ReportMarker,
} from "../../../src/api/reports";
import { participatesAsCitizen } from "../../../src/api/users";
import { useAuth } from "../../../src/auth/AuthContext";
import { useFloatingTabBarInset } from "../../../src/components/floatingTabBar";
import { useCurrentLocation } from "../../../src/location/useCurrentLocation";
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

const DENIED_REASON =
  "Necesitamos tu ubicación para armar tu mapa: mostramos los reportes del " +
  "municipio en el que estás parado.";
const BLOCKED_REASON =
  "El permiso de ubicación está bloqueado. Habilitalo en los ajustes del " +
  "sistema para ver los reportes de tu zona.";
const OUT_OF_COVERAGE =
  "Estás fuera del área de cobertura: tu ubicación no cae dentro del radio de " +
  "ninguna municipalidad adherida a UrbanCheck, así que no hay reportes para " +
  "mostrarte en el mapa.";

/**
 * Mapa de reportes, acotado al municipio donde está parado el vecino.
 *
 * Muestra exactamente lo mismo que el feed y con el mismo criterio —el mapa se
 * puede desplazar, pero eso no lo convierte en una ventana a los municipios
 * vecinos—; lo único que cambia es la forma de presentarlo.
 *
 * La ubicación se pide siempre, aunque no siempre acote: al validador y al
 * agente les sirve igual para centrar la vista donde están, y su jurisdicción
 * ya la resuelve el servidor por su cuenta.
 */
export default function MapTab() {
  const router = useRouter();
  const { user } = useAuth();
  // Ante la duda se acota, igual que en el feed: solo las cuentas de trabajo,
  // que se identifican por su rol, quedan exentas.
  const scopedToLocation = user === null || participatesAsCitizen(user);
  const { permission, coords, reason, request, getFreshPosition } =
    useCurrentLocation({
      deniedReason: DENIED_REASON,
      blockedReason: BLOCKED_REASON,
    });
  const mapRef = useRef<MapView>(null);
  // La leyenda y los controles se apoyan sobre la barra flotante, que no ocupa
  // lugar en el layout: sin este alto quedan tapados por ella.
  const tabBarInset = useFloatingTabBarInset();
  const [centering, setCentering] = useState(false);

  const [markers, setMarkers] = useState<ReportMarker[]>([]);
  const [coverage, setCoverage] = useState<FeedCoverage | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scopeCoords = scopedToLocation ? coords : null;
  // Sin ubicación no hay mapa que pedir para el vecino: el servidor devolvería
  // los reportes de todos los municipios.
  const canQuery = !scopedToLocation || coords !== null;

  const load = useCallback(async () => {
    if (!canQuery) {
      setMarkers([]);
      setCoverage(null);
      setLoading(false);
      return [] as ReportMarker[];
    }
    setError(null);
    try {
      const data = await listMapReports(scopeCoords);
      setMarkers(data.results);
      setCoverage(data.coverage ?? null);
      return data.results;
    } catch {
      setError("No pudimos cargar el mapa. Probá de nuevo.");
      return [] as ReportMarker[];
    } finally {
      setLoading(false);
    }
  }, [canQuery, scopeCoords]);

  useEffect(() => {
    if (permission === "checking") return;
    let cancelled = false;

    async function start() {
      const results = await load();
      if (cancelled) return;

      // La vista arranca donde está el usuario; si no dio permiso, sobre el
      // primer reporte, y si no hay ninguno, sobre el municipio.
      if (coords) {
        setRegion({
          ...coords,
          latitudeDelta: MARKER_DELTA,
          longitudeDelta: MARKER_DELTA,
        });
        return;
      }

      const first = results[0];
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

    void start();
    return () => {
      cancelled = true;
    };
  }, [coords, load, permission]);

  /**
   * Lleva la vista a donde está el usuario, con una lectura del momento.
   *
   * Pide la posición fresca en vez de reusar la del arranque: el botón dice
   * "mi ubicación", y la de hace diez minutos ya no lo es. Sin permiso, el
   * botón sirve para concederlo, que es el paso que falta.
   */
  async function goToMyLocation() {
    if (centering) return;
    setCentering(true);
    try {
      const target = (await getFreshPosition()) ?? coords;
      if (!target) {
        // Sin ninguna posición lo que falta es el permiso, así que el botón
        // pasa a servir para concederlo.
        await request();
        return;
      }
      mapRef.current?.animateToRegion(
        {
          ...target,
          latitudeDelta: MARKER_DELTA,
          longitudeDelta: MARKER_DELTA,
        },
        450,
      );
    } finally {
      setCentering(false);
    }
  }

  if (loading || region === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const locationNotice =
    scopedToLocation && (permission === "denied" || permission === "blocked")
      ? reason
      : null;
  const isOutOfCoverage = coverage !== null && !coverage.in_coverage;
  const city = coverage?.municipality?.city ?? null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        // El punto azul del sistema: se dibuja con su halo de precisión y se
        // mueve solo mientras la pantalla está abierta.
        showsUserLocation={permission === "granted"}
        // El botón nativo queda apagado a propósito: abajo hay uno con
        // etiqueta, que además existe en las dos plataformas por igual.
        showsMyLocationButton={false}
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

      {!error && locationNotice && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{locationNotice}</Text>
          {permission !== "blocked" && (
            <Pressable onPress={() => void request()}>
              <Text style={styles.bannerAction}>Permitir ubicación</Text>
            </Pressable>
          )}
        </View>
      )}

      {!error && !locationNotice && isOutOfCoverage && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{OUT_OF_COVERAGE}</Text>
        </View>
      )}

      {!error && !locationNotice && !isOutOfCoverage && markers.length === 0 && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {city
              ? `Todavía no hay reportes geolocalizados en ${city}.`
              : "Todavía no hay reportes geolocalizados para mostrar."}
          </Text>
        </View>
      )}

      <Pressable
        style={[styles.myLocation, { bottom: tabBarInset }]}
        onPress={() => void goToMyLocation()}
        hitSlop={6}
      >
        {centering ? (
          <ActivityIndicator size="small" color="#1a73e8" />
        ) : (
          <Ionicons name="locate" size={18} color="#1a73e8" />
        )}
        <Text style={styles.myLocationText}>Mi ubicación</Text>
      </Pressable>

      <View style={[styles.legend, { bottom: tabBarInset }]}>
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
    // Deja libre la columna de los controles de arriba a la derecha: el texto
    // pasaba por debajo del botón de recargar.
    right: 64,
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
    left: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  myLocation: {
    position: "absolute",
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.97)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  myLocationText: { fontSize: 13, fontWeight: "600", color: "#1a73e8" },
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
