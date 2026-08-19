import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { isSessionExpired } from "../../../src/api/errors";
import {
  type Report,
  type ReportFilters,
  likeReport,
  listReports,
  unlikeReport,
} from "../../../src/api/reports";
import ReportFilterBar, {
  EMPTY_FILTERS,
  type ReportFilterState,
  countActiveFilters,
} from "../../../src/components/ReportFilterBar";
import { categoryLabel, statusColors, statusLabel } from "../../../src/constants/reports";
import { useDebouncedValue } from "../../../src/hooks/useDebouncedValue";

interface CardProps {
  item: Report;
  onToggleLike: (report: Report) => void;
  onOpenAuthor: (authorId: number) => void;
}

function ReportCard({ item, onToggleLike, onOpenAuthor }: CardProps) {
  const router = useRouter();
  const colors = statusColors(item.status);

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/(app)/(tabs)/report/${item.id}`)}
    >
      <Image source={{ uri: item.photo }} style={styles.photo} />
      <View style={styles.cardBody}>
        <View style={styles.row}>
          <Text style={styles.category}>{categoryLabel(item.category)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusBadgeText, { color: colors.text }]}>
              {statusLabel(item.status)}
            </Text>
          </View>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.footer}>
          <Pressable
            onPress={() => onOpenAuthor(item.author.id)}
            hitSlop={8}
            accessibilityLabel={`Ver perfil de ${item.author.name}`}
          >
            <Text style={styles.authorLink} numberOfLines={1}>
              {item.author.name}
            </Text>
          </Pressable>

          <View style={styles.stats}>
            <Pressable
              style={styles.likeBtn}
              onPress={() => onToggleLike(item)}
              hitSlop={8}
              accessibilityLabel={item.is_liked ? "Quitar like" : "Dar like"}
            >
              <Ionicons
                name={item.is_liked ? "heart" : "heart-outline"}
                size={18}
                color={item.is_liked ? "#e53935" : "#888"}
              />
              <Text style={[styles.statText, item.is_liked && styles.statTextLiked]}>
                {item.like_count}
              </Text>
            </Pressable>
            <View style={styles.stat}>
              <Ionicons name="chatbubble-outline" size={16} color="#888" />
              <Text style={styles.statText}>{item.comment_count}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY_FILTERS);

  const debouncedSearch = useDebouncedValue(filters.search, 400);
  // Se serializan las listas para usarlas como dependencia estable de los efectos:
  // un array nuevo en cada render dispararía una recarga por render.
  const categoryKey = filters.categories.join(",");
  const statusKey = filters.statuses.join(",");

  // Los criterios vigentes viven en una ref para que `fetchPage` sea estable y
  // `useFocusEffect` no se vuelva a disparar cada vez que cambia un filtro.
  const criteriaRef = useRef<ReportFilters>({});
  criteriaRef.current = {
    search: debouncedSearch,
    categories: filters.categories,
    statuses: filters.statuses,
  };

  const fetchPage = useCallback(async (p: number) => {
    try {
      const data = await listReports(p, criteriaRef.current);
      setReports((prev) => (p === 1 ? data.results : [...prev, ...data.results]));
      setTotal(data.count);
      setHasMore(!!data.next);
      setPage(p);
    } catch (err) {
      if (!isSessionExpired(err)) {
        Alert.alert("Error", "No se pudieron cargar los reportes.");
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchPage(1);
    }, [fetchPage]),
  );

  // Recarga desde la primera página cuando cambian búsqueda o filtros. Se saltea
  // el primer render porque `useFocusEffect` ya trae la página inicial.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setLoading(true);
    void fetchPage(1);
  }, [debouncedSearch, categoryKey, statusKey, fetchPage]);

  function onRefresh() {
    setRefreshing(true);
    void fetchPage(1);
  }

  function loadMore() {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    void fetchPage(page + 1);
  }

  /** Like optimista: se pinta al instante y se revierte si el backend falla. */
  async function toggleLike(report: Report) {
    const optimistic = {
      is_liked: !report.is_liked,
      like_count: report.like_count + (report.is_liked ? -1 : 1),
    };
    setReports((prev) =>
      prev.map((r) => (r.id === report.id ? { ...r, ...optimistic } : r)),
    );
    try {
      const result = report.is_liked
        ? await unlikeReport(report.id)
        : await likeReport(report.id);
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? { ...r, is_liked: result.liked, like_count: result.like_count }
            : r,
        ),
      );
    } catch (err) {
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? { ...r, is_liked: report.is_liked, like_count: report.like_count }
            : r,
        ),
      );
      if (isSessionExpired(err)) {
        Alert.alert("Sesión expirada", "Iniciá sesión de nuevo para dar like.");
      } else {
        Alert.alert("Error", "No se pudo registrar tu like.");
      }
    }
  }

  const isFiltering = debouncedSearch.trim().length > 0 || countActiveFilters(filters) > 0;

  return (
    <View style={styles.container}>
      <ReportFilterBar
        filters={filters}
        onChange={setFilters}
        resultLabel={
          isFiltering && !loading
            ? `${total} ${total === 1 ? "reporte encontrado" : "reportes encontrados"}`
            : undefined
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => String(r.id)}
          renderItem={({ item }) => (
            <ReportCard
              item={item}
              onToggleLike={toggleLike}
              onOpenAuthor={(id) => router.push(`/(app)/user/${id}`)}
            />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          // Cierra el teclado de la búsqueda al arrastrar la lista.
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#1a73e8"]}
              tintColor="#1a73e8"
            />
          }
          contentContainerStyle={{ paddingBottom: 110 }}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ margin: 16 }} /> : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={isFiltering ? "search-outline" : "document-text-outline"}
                size={48}
                color="#ccc"
                style={{ marginBottom: 12 }}
              />
              <Text style={styles.emptyTitle}>
                {isFiltering
                  ? "No hay reportes que coincidan con la búsqueda."
                  : "No hay reportes aún."}
              </Text>
              {isFiltering && (
                <Pressable
                  style={styles.resetBtn}
                  onPress={() => setFilters(EMPTY_FILTERS)}
                >
                  <Text style={styles.resetBtnText}>Limpiar búsqueda y filtros</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  category: { fontWeight: "bold", color: "#1a73e8", flexShrink: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },
  description: { fontSize: 14, color: "#333", marginBottom: 10 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 10,
  },
  authorLink: {
    fontSize: 12,
    color: "#1a73e8",
    fontWeight: "600",
    maxWidth: 160,
  },
  stats: { flexDirection: "row", alignItems: "center", gap: 14 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, color: "#6b7280" },
  statTextLiked: { color: "#e53935", fontWeight: "600" },
  emptyContainer: { alignItems: "center", justifyContent: "center", padding: 40, marginTop: 40 },
  emptyTitle: { textAlign: "center", color: "#9ca3af", fontSize: 14, fontWeight: "500" },
  resetBtn: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#e8f0fe",
  },
  resetBtnText: { color: "#1a73e8", fontSize: 13, fontWeight: "600" },
});
