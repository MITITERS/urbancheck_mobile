import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
  type NotificationKind,
} from "../../../src/api/notifications";

/**
 * Ícono e color por tipo de aviso. El de cambio de estado (US-011) se distingue
 * a simple vista de los sociales de US-033, sin cambiar cómo se renderizan esos.
 */
const KIND_STYLE: Record<
  NotificationKind,
  { icon: keyof typeof Ionicons.glyphMap; color: string; background: string }
> = {
  cambio_estado: { icon: "swap-horizontal", color: "#1a73e8", background: "#e8f0fe" },
  nuevo_comentario: { icon: "chatbubble-outline", color: "#7c3aed", background: "#f3e8ff" },
  nuevo_like: { icon: "heart-outline", color: "#db2777", background: "#fce7f3" },
};

function relativeDate(value: string): string {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Bandeja de avisos: sociales (US-033) y de cambio de estado (US-011). */
export default function NoticesTab() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listNotifications();
      setNotifications(data.results);
    } catch {
      setError("No pudimos cargar tus avisos.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = notifications.filter((item) => !item.is_read).length;

  async function open(notification: Notification) {
    if (!notification.is_read) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item,
        ),
      );
      await markNotificationRead(notification.id).catch(() => load());
    }
    if (notification.report_id) {
      router.push(`/(app)/(tabs)/report/${notification.report_id}`);
    }
  }

  async function readAll() {
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    await markAllNotificationsRead().catch(() => load());
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
      {unread > 0 && (
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {unread} {unread === 1 ? "aviso sin leer" : "avisos sin leer"}
          </Text>
          <Pressable onPress={() => void readAll()}>
            <Text style={styles.headerAction}>Marcar todo como leído</Text>
          </Pressable>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()}>
            <Text style={styles.headerAction}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={56} color="#c7d2fe" />
            <Text style={styles.emptyTitle}>Todavía no tenés avisos</Text>
            <Text style={styles.emptyBody}>
              Acá vas a ver cuándo avanza tu reporte y cuándo alguien interactúa con él.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const style = KIND_STYLE[item.kind];
          return (
            <Pressable
              style={[styles.card, !item.is_read && styles.cardUnread]}
              onPress={() => void open(item)}
            >
              <View style={[styles.iconWrap, { backgroundColor: style.background }]}>
                <Ionicons name={style.icon} size={20} color={style.color} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.meta}>{relativeDate(item.created_at)}</Text>
              </View>
              {!item.is_read && <View style={styles.dot} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerText: { fontSize: 13, color: "#4b5563", fontWeight: "600" },
  headerAction: { fontSize: 13, color: "#1a73e8", fontWeight: "600" },
  errorBox: { backgroundColor: "#fef2f2", padding: 12 },
  errorText: { fontSize: 13, color: "#b91c1c" },
  listContent: { padding: 12, paddingBottom: 100, flexGrow: 1 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: "#1a73e8" },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  message: { fontSize: 14, color: "#111827", lineHeight: 20 },
  meta: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1a73e8" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#374151", marginTop: 12 },
  emptyBody: { fontSize: 14, color: "#6b7280", textAlign: "center", marginTop: 6, lineHeight: 20 },
});
