import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { type Report, listReports } from "../../src/api/reports";

const CATEGORY_LABEL: Record<string, string> = {
  bache: "Bache",
  alumbrado: "Alumbrado",
  basura: "Basura",
  semaforo: "Semáforo",
  vereda: "Vereda",
  otro: "Otro",
};

const STATUS_LABEL: Record<string, string> = {
  reportado: "Reportado",
  en_revision: "En revisión",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  rechazado: "Rechazado",
};

function ReportCard({ item }: { item: Report }) {
  const router = useRouter();
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/(app)/report/${item.id}`)}
    >
      <Image source={{ uri: item.photo }} style={styles.photo} />
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

export default function FeedScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void fetchPage(1);
    }, [])
  );

  async function fetchPage(p: number) {
    try {
      const data = await listReports(p);
      if (p === 1) {
        setReports(data.results);
      } else {
        setReports((prev) => [...prev, ...data.results]);
      }
      setHasMore(!!data.next);
      setPage(p);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    void fetchPage(page + 1);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reports}
        keyExtractor={(r) => String(r.id)}
        renderItem={({ item }) => <ReportCard item={item} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ margin: 16 }} /> : null
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay reportes aún.</Text>
        }
      />
      <Pressable
        style={styles.fab}
        onPress={() => router.push("/(app)/create-report")}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
      <Pressable
        style={styles.profileBtn}
        onPress={() => router.push("/(app)/profile")}
      >
        <Text style={styles.profileBtnText}>Mi perfil</Text>
      </Pressable>
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
  category: { fontWeight: "bold", color: "#1a73e8", marginBottom: 4 },
  description: { fontSize: 14, color: "#333", marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  meta: { fontSize: 12, color: "#888" },
  emptyText: { textAlign: "center", marginTop: 40, color: "#888" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1a73e8",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  fabText: { color: "#fff", fontSize: 28, lineHeight: 30 },
  profileBtn: {
    position: "absolute",
    left: 20,
    bottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    elevation: 3,
  },
  profileBtnText: { color: "#1a73e8", fontWeight: "600" },
});
