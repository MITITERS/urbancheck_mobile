import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { isSessionExpired } from "../../../src/api/errors";
import {
  type AppNotification,
  type NotificationKind,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../../src/api/notifications";

const KIND_ICON: Record<NotificationKind, string> = {
  nuevo_comentario: "chatbubble-ellipses",
  cambio_estado: "sync-circle",
  nuevo_like: "heart",
};

const KIND_COLOR: Record<NotificationKind, string> = {
  nuevo_comentario: "#1a73e8",
  cambio_estado: "#f57f17",
  nuevo_like: "#e53935",
};

/** "hace 3 h", "ayer", "12/07/2026" — según qué tan reciente sea el aviso. */
function relativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  const diffMinutes = Math.floor((Date.now() - then) / 60000);
  if (diffMinutes < 1) return "recién";
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return new Date(isoString).toLocaleDateString("es-AR");
}

export default function NoticesTab() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(async (p: number) => {
    try {
      const data = await listNotifications(p);
      setNotifications((prev) => (p === 1 ? data.results : [...prev, ...data.results]));
      setHasMore(!!data.next);
      setPage(p);
    } catch (err) {
      if (!isSessionExpired(err)) {
        Alert.alert("Error", "No se pudieron cargar los avisos.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchPage(1);
    }, [fetchPage]),
  );

  function loadMore() {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    void fetchPage(page + 1);
  }

  async function openNotification(item: AppNotification) {
    // Se marca como leída de forma optimista: el usuario ya la vio al tocarla.
    if (!item.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
      );
      void markNotificationRead(item.id).catch(() => {});
    }
    if (item.report_id != null) {
      router.push(`/(app)/(tabs)/report/${item.report_id}`);
    }
  }

  async function handleReadAll() {
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      setNotifications(previous);
      Alert.alert("Error", "No se pudieron marcar los avisos como leídos.");
    }
  }

  async function handleDelete(item: AppNotification) {
    const previous = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== item.id));
    try {
      await deleteNotification(item.id);
    } catch {
      setNotifications(previous);
      Alert.alert("Error", "No se pudo descartar el aviso.");
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <View style={styles.toolbar}>
          <Text style={styles.toolbarText}>
            {unreadCount} {unreadCount === 1 ? "aviso sin leer" : "avisos sin leer"}
          </Text>
          <Pressable onPress={handleReadAll} hitSlop={8}>
            <Text style={styles.toolbarAction}>Marcar todo como leído</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={{ paddingBottom: 110 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void fetchPage(1);
            }}
            colors={["#1a73e8"]}
            tintColor="#1a73e8"
          />
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} /> : null}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.item, !item.is_read && styles.itemUnread]}
            onPress={() => void openNotification(item)}
          >
            <View
              style={[styles.iconCircle, { backgroundColor: `${KIND_COLOR[item.kind]}1a` }]}
            >
              <Ionicons
                name={KIND_ICON[item.kind] as any}
                size={20}
                color={KIND_COLOR[item.kind]}
              />
            </View>

            <View style={styles.itemBody}>
              <Text style={[styles.message, !item.is_read && styles.messageUnread]}>
                {item.message}
              </Text>
              <Text style={styles.time}>{relativeTime(item.created_at)}</Text>
            </View>

            {!item.is_read && <View style={styles.unreadDot} />}

            <Pressable
              onPress={() => void handleDelete(item)}
              hitSlop={10}
              style={styles.deleteBtn}
              accessibilityLabel="Descartar aviso"
            >
              <Ionicons name="close" size={18} color="#c0c4cc" />
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="notifications-outline"
              size={56}
              color="#ccc"
              style={{ marginBottom: 14 }}
            />
            <Text style={styles.emptyTitle}>No tenés avisos</Text>
            <Text style={styles.emptySubtitle}>
              Acá vas a ver cuándo alguien comenta tus reportes o cambia su estado.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  toolbarText: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  toolbarAction: { fontSize: 12, color: "#1a73e8", fontWeight: "700" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  itemUnread: { borderColor: "#c7dcfb", backgroundColor: "#f7faff" },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  itemBody: { flex: 1 },
  message: { fontSize: 13, color: "#4b5563", lineHeight: 18 },
  messageUnread: { color: "#1f2937", fontWeight: "600" },
  time: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1a73e8",
  },
  deleteBtn: { padding: 2 },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151", marginBottom: 6 },
  emptySubtitle: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 19,
  },
});
