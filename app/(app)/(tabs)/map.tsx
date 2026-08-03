import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Callout, Marker, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isSessionExpired } from "../../../src/api/errors";
import { tabBarClearance } from "../../../src/constants/layout";
import { type ReportMarker, listMapMarkers } from "../../../src/api/reports";
import ReportFilterBar, {
  EMPTY_FILTERS,
  type ReportFilterState,
} from "../../../src/components/ReportFilterBar";
import {
  categoryColor,
  categoryLabel,
  statusColors,
  statusLabel,
} from "../../../src/constants/reports";
import { useDebouncedValue } from "../../../src/hooks/useDebouncedValue";

// Encuadre por defecto (CABA) cuando todavía no hay ni GPS ni marcadores.
const FALLBACK_REGION: Region = {
  latitude: -34.6037,
  longitude: -58.3816,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const ZOOM_DELTA = 0.01;

type GpsState = "unknown" | "granted" | "denied" | "disabled";

export default function MapTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [markers, setMarkers] = useState<ReportMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY_FILTERS);
  const [gpsState, setGpsState] = useState<GpsState>("unknown");
  const [myLocation, setMyLocation] = useState<Location.LocationObjectCoords | null>(null);
  // Solo se centra automáticamente en el usuario la primera vez que se obtiene su
  // posición; después mandar el encuadre sería pelearle al gesto de arrastre.
  const hasCenteredRef = useRef(false);

  const debouncedSearch = useDebouncedValue(filters.search, 400);
  const categoryKey = filters.categories.join(",");
  const statusKey = filters.statuses.join(",");

  const criteriaRef = useRef<ReportFilterState>(EMPTY_FILTERS);
  criteriaRef.current = { ...filters, search: debouncedSearch };

  const fetchMarkers = useCallback(async () => {
    try {
      const { results } = await listMapMarkers(criteriaRef.current);
      setMarkers(results);
    } catch (err) {
      if (!isSessionExpired(err)) {
        setMarkers([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchMarkers();
    }, [fetchMarkers]),
  );

  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setLoading(true);
    void fetchMarkers();
  }, [debouncedSearch, categoryKey, statusKey, fetchMarkers]);

  // US-022: seguimiento de la posición propia mientras el mapa está montado.
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    async function startWatching() {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (!cancelled) setGpsState("disabled");
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (!cancelled) setGpsState("denied");
        return;
      }
      if (cancelled) return;
      setGpsState("granted");

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          // Solo emite al moverse 10 m: suficiente para "en tiempo real" a pie y
          // mucho más barato en batería que un intervalo fijo.
          distanceInterval: 10,
        },
        (position) => {
          if (cancelled) return;
          setMyLocation(position.coords);
          if (!hasCenteredRef.current) {
            hasCenteredRef.current = true;
            mapRef.current?.animateToRegion(
              {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              },
              600,
            );
          }
        },
      );
    }

    void startWatching().catch(() => {
      if (!cancelled) setGpsState("denied");
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  function centerOnMe() {
    if (!myLocation) {
      openLocationSettings();
      return;
    }
    mapRef.current?.animateToRegion(
      {
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        latitudeDelta: ZOOM_DELTA,
        longitudeDelta: ZOOM_DELTA,
      },
      500,
    );
  }

  function openLocationSettings() {
    if (Platform.OS === "ios") {
      void Linking.openURL("app-settings:");
    } else {
      void Linking.openSettings();
    }
  }

  const gpsUnavailable = gpsState === "denied" || gpsState === "disabled";

  return (
    <View style={styles.container}>
      <ReportFilterBar filters={filters} onChange={setFilters} />

      {gpsUnavailable && (
        <View style={styles.gpsBanner}>
          <Ionicons name="location-outline" size={18} color="#ef6c00" />
          <Text style={styles.gpsBannerText}>
            {gpsState === "disabled"
              ? "El GPS está desactivado. Activalo para ver tu ubicación, o ubicá los reportes manualmente en el mapa."
              : "Sin permiso de ubicación. Podés activarlo desde Ajustes o mover el mapa manualmente."}
          </Text>
          <Pressable onPress={openLocationSettings} hitSlop={8}>
            <Text style={styles.gpsBannerAction}>Ajustes</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={FALLBACK_REGION}
          showsUserLocation={gpsState === "granted"}
          showsMyLocationButton={false}
          // El mapa ocupa toda la pantalla: sin esto, el teclado de la búsqueda
          // solo se cierra con la tecla "Buscar" del sistema.
          onPress={() => Keyboard.dismiss()}
          onPanDrag={() => Keyboard.dismiss()}
        >
          {markers.map((marker) => {
            const colors = statusColors(marker.status);
            return (
              <Marker
                key={marker.id}
                coordinate={{
                  latitude: Number(marker.latitude),
                  longitude: Number(marker.longitude),
                }}
                pinColor={categoryColor(marker.category)}
                tracksViewChanges={false}
              >
                <Callout
                  tooltip
                  onPress={() => router.push(`/(app)/(tabs)/report/${marker.id}`)}
                >
                  <View style={styles.callout}>
                    <Image source={{ uri: marker.photo }} style={styles.calloutPhoto} />
                    <View style={styles.calloutBody}>
                      <Text style={styles.calloutCategory}>
                        {categoryLabel(marker.category)}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: colors.text }]}>
                          {statusLabel(marker.status)}
                        </Text>
                      </View>
                      {!!marker.address && (
                        <Text style={styles.calloutAddress} numberOfLines={2}>
                          {marker.address}
                        </Text>
                      )}
                      <Text style={styles.calloutHint}>Tocá para ver el detalle</Text>
                    </View>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>

        {loading && (
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color="#1a73e8" />
            <Text style={styles.loadingPillText}>Cargando reportes…</Text>
          </View>
        )}

        {!loading && markers.length === 0 && (
          <View style={styles.loadingPill}>
            <Ionicons name="search-outline" size={16} color="#6b7280" />
            <Text style={styles.loadingPillText}>
              No hay reportes que coincidan con el filtro.
            </Text>
          </View>
        )}

        <Pressable
          // La barra de pestañas flota sobre el mapa: se apoya el botón por
          // encima de ella en vez de fijar un alto que no contempla el notch.
          style={[styles.locateBtn, { bottom: tabBarClearance(insets.bottom) }]}
          onPress={centerOnMe}
          accessibilityLabel="Centrar en mi ubicación"
        >
          <Ionicons
            name={myLocation ? "locate" : "locate-outline"}
            size={22}
            color={myLocation ? "#1a73e8" : "#9ca3af"}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  mapWrapper: { flex: 1, position: "relative" },
  gpsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff3e0",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  gpsBannerText: { flex: 1, fontSize: 12, color: "#8a5200", lineHeight: 16 },
  gpsBannerAction: { fontSize: 12, fontWeight: "700", color: "#ef6c00" },
  loadingPill: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingPillText: { fontSize: 12, color: "#4b5563", fontWeight: "500" },
  locateBtn: {
    position: "absolute",
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  callout: {
    width: 220,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  calloutPhoto: { width: "100%", height: 96 },
  calloutBody: { padding: 10, gap: 6 },
  calloutCategory: { fontSize: 14, fontWeight: "700", color: "#1f2937" },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },
  calloutAddress: { fontSize: 11, color: "#6b7280", lineHeight: 15 },
  calloutHint: { fontSize: 10, color: "#1a73e8", fontWeight: "600" },
});
