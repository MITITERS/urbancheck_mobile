import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { imageSource } from "../../../src/api/client";
import {
  type FeedCoverage,
  type Report,
  listReports,
} from "../../../src/api/reports";
import { participatesAsCitizen } from "../../../src/api/users";
import { useAuth } from "../../../src/auth/AuthContext";
import ReportFilterBar, {
  EMPTY_FILTERS,
  countActiveFilters,
  type ReportFilterState,
} from "../../../src/components/ReportFilterBar";
import { useDebouncedValue } from "../../../src/hooks/useDebouncedValue";
import { useCurrentLocation } from "../../../src/location/useCurrentLocation";

const CATEGORY_LABEL: Record<string, string> = {
  bache: "Bache",
  alumbrado: "Alumbrado",
  basura: "Basura",
  semaforo: "Semáforo",
  vereda: "Vereda",
  otro: "Otro",
};

const STATUS_LABEL: Record<string, string> = {
  pendiente_validacion: "Pendiente de validación",
  reportado: "Reportado",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  cancelado: "Cancelado",
  archivado: "Archivado",
};

const DENIED_REASON =
  "Necesitamos tu ubicación para armar tu feed: mostramos los reportes del " +
  "municipio en el que estás parado.";
const BLOCKED_REASON =
  "El permiso de ubicación está bloqueado. Habilitalo en los ajustes del " +
  "sistema para ver los reportes de tu zona.";
const NO_POSITION_REASON =
  "No pudimos determinar dónde estás, así que todavía no sabemos qué " +
  "municipio te corresponde.";
const OUT_OF_COVERAGE_TITLE = "Estás fuera del área de cobertura";
const OUT_OF_COVERAGE_BODY =
  "Tu ubicación no cae dentro del radio de ninguna municipalidad adherida a " +
  "UrbanCheck, así que no hay reportes para mostrarte. Si te moviste recién, " +
  "deslizá para actualizar.";

function ReportCard({ item }: { item: Report }) {
  const router = useRouter();
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/(app)/(tabs)/report/${item.id}`)}
    >
      <Image source={imageSource(item.photo)} style={styles.photo} />
      <View style={styles.cardBody}>
        <Text style={styles.category}>{CATEGORY_LABEL[item.category] ?? item.category}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.row}>
          <Text style={styles.meta}>{STATUS_LABEL[item.status] ?? item.status}</Text>
          <Text style={styles.meta}>
            ♥ {item.like_count}  💬 {item.comment_count}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Feed del vecino, acotado al municipio donde está parado.
 *
 * La app manda la ubicación y el servidor resuelve la jurisdicción con el mismo
 * criterio con el que asigna un reporte nuevo: el vecino ve exactamente el
 * municipio al que le va a llegar lo que reporte. Fuera de toda cobertura no se
 * muestra nada y se explica por qué, en lugar de un feed vacío sin motivo.
 *
 * Las cuentas de trabajo no se acotan por ubicación: el validador y el agente
 * ya están atados a su municipalidad del lado del servidor, y hacerles pedir el
 * permiso de ubicación acá no cambiaría lo que ven.
 */
export default function FeedScreen() {
  const { user } = useAuth();
  // Ante la duda se acota: si el perfil todavía no cargó, mostrar el feed de
  // todos los municipios es justo lo que esta pantalla no debe hacer. Solo las
  // cuentas de trabajo, que se identifican por su rol, quedan exentas.
  const scopedToLocation = user === null || participatesAsCitizen(user);
  const { permission, coords, reason, request } = useCurrentLocation({
    deniedReason: DENIED_REASON,
    blockedReason: BLOCKED_REASON,
    enabled: scopedToLocation,
  });

  const [filters, setFilters] = useState<ReportFilterState>(EMPTY_FILTERS);
  // La búsqueda se retrasa para no disparar una petición por tecla; las
  // categorías y los estados son un toque, así que van directo.
  const search = useDebouncedValue(filters.search, 400);
  const categoryKey = filters.categories.join(",");
  const statusKey = filters.statuses.join(",");

  const [reports, setReports] = useState<Report[]>([]);
  const [coverage, setCoverage] = useState<FeedCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sin ubicación no hay feed que pedir: el servidor devolvería el de todos los
  // municipios, que es justamente lo que esta pantalla no debe mostrar.
  const canQuery = !scopedToLocation || coords !== null;

  const fetchPage = useCallback(
    async (p: number) => {
      try {
        const data = await listReports(p, coords, {
          search,
          categories: filters.categories,
          statuses: filters.statuses,
        });
        setReports((prev) => (p === 1 ? data.results : [...prev, ...data.results]));
        setCoverage(data.coverage ?? null);
        setHasMore(!!data.next);
        setPage(p);
        setError(null);
      } catch {
        // Sin esto la promesa quedaba sin atrapar y el error terminaba en la
        // consola en lugar de en la pantalla.
        setError("No pudimos cargar el feed. Deslizá para reintentar.");
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    // `categoryKey` y `statusKey` son las listas serializadas: sin eso, un
    // array nuevo en cada render volvería a crear la función y a pedir todo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coords, search, categoryKey, statusKey],
  );

  useFocusEffect(
    useCallback(() => {
      if (permission === "checking") return;
      if (!canQuery) {
        // El permiso se resolvió y no hay posición: no hay nada que pedir, pero
        // la pantalla tiene que dejar de mostrar el spinner y explicarlo.
        setReports([]);
        setCoverage(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      void fetchPage(1);
    }, [canQuery, fetchPage, permission]),
  );

  function onRefresh() {
    setRefreshing(true);
    if (!canQuery) {
      // Deslizar hacia abajo es el gesto con el que se reintenta: si el permiso
      // se puede volver a pedir, se pide.
      void request().finally(() => setRefreshing(false));
      return;
    }
    void fetchPage(1);
  }

  function loadMore() {
    // `reports.length` no es una optimización: `FlatList` dispara
    // `onEndReached` ya en el primer render, cuando la lista está vacía y la
    // página 1 todavía viaja. Pedir la 2 ahí es pedir una página que puede no
    // existir, y el servidor responde 404.
    if (!hasMore || loadingMore || loading || !canQuery) return;
    if (reports.length === 0) return;
    setLoadingMore(true);
    void fetchPage(page + 1);
  }

  const locationNotice =
    permission === "denied" || permission === "blocked"
      ? reason
      : permission === "granted" && coords === null
        ? NO_POSITION_REASON
        : null;
  const isOutOfCoverage = coverage !== null && !coverage.in_coverage;
  const city = coverage?.municipality?.city ?? null;
  const isFiltering = search.trim().length > 0 || countActiveFilters(filters) > 0;

  return (
    <View style={styles.container}>
      {/* La barra vive fuera de la lista y no se esconde mientras carga: si
          desapareciera con cada búsqueda, no habría dónde corregir el texto. */}
      <ReportFilterBar filters={filters} onChange={setFilters} />

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {locationNotice && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{locationNotice}</Text>
          {permission !== "blocked" && (
            <Pressable onPress={() => void request()}>
              <Text style={styles.noticeAction}>Permitir ubicación</Text>
            </Pressable>
          )}
        </View>
      )}

      {city && (
        <View style={styles.scopeBar}>
          <Text style={styles.scopeText}>Reportes de {city}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
      <FlatList
        data={reports}
        keyExtractor={(r) => String(r.id)}
        renderItem={({ item }) => <ReportCard item={item} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#1a73e8"]}
            tintColor="#1a73e8"
          />
        }
        contentContainerStyle={{ paddingBottom: 110, flexGrow: 1 }}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ margin: 16 }} /> : null
        }
        ListEmptyComponent={
          isOutOfCoverage ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>{OUT_OF_COVERAGE_TITLE}</Text>
              <Text style={styles.emptyBody}>{OUT_OF_COVERAGE_BODY}</Text>
            </View>
          ) : locationNotice ? (
            // El motivo ya está explicado arriba: repetirlo acá sería decir dos
            // veces lo mismo en la misma pantalla.
            <View style={styles.emptyBox} />
          ) : isFiltering ? (
            // No es lo mismo que no haya reportes: acá los hay, pero ninguno
            // coincide. Y se ofrece salir del filtro, que es lo que uno quiere.
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Sin resultados</Text>
              <Text style={styles.emptyBody}>
                Ningún reporte coincide con lo que buscaste.
              </Text>
              <Pressable
                style={styles.clearFilters}
                onPress={() => setFilters(EMPTY_FILTERS)}
              >
                <Text style={styles.clearFiltersText}>Limpiar la búsqueda</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              {city ? `Todavía no hay reportes en ${city}.` : "No hay reportes aún."}
            </Text>
          )
        }
      />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  notice: { backgroundColor: "#fff7ed", padding: 12 },
  errorBox: { backgroundColor: "#fef2f2", padding: 12 },
  errorText: { fontSize: 13, color: "#b91c1c" },
  noticeText: { fontSize: 13, color: "#9a3412", lineHeight: 18 },
  noticeAction: { fontSize: 13, fontWeight: "600", color: "#1a73e8", marginTop: 6 },
  scopeBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#eef4fe",
  },
  scopeText: { fontSize: 12, fontWeight: "600", color: "#1a73e8" },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 10,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  photo: { width: "100%", height: 160 },
  cardBody: { padding: 12 },
  category: { fontWeight: "bold", color: "#1a73e8", marginBottom: 4 },
  description: { fontSize: 14, color: "#333", marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  meta: { fontSize: 12, color: "#888" },
  emptyText: { textAlign: "center", marginTop: 40, color: "#888" },
  clearFilters: {
    marginTop: 14,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e8f0fe",
    alignItems: "center",
    justifyContent: "center",
  },
  clearFiltersText: { color: "#1a73e8", fontWeight: "700", fontSize: 14 },
  emptyBox: { paddingHorizontal: 28, paddingTop: 56, alignItems: "center" },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
});
