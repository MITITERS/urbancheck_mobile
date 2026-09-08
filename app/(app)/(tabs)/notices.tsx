import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
import { useFloatingTabBarInset } from "../../../src/components/floatingTabBar";
import { useUnread } from "../../../src/notifications/UnreadContext";

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
  const tabBarInset = useFloatingTabBarInset();
  // El contador sale del backend, no de la lista: la bandeja está paginada, así
  // que contar lo que hay en pantalla daría de menos con más de una página.
  const { unread, refreshUnread, applyUnreadDelta, clearUnread } = useUnread();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

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

  // Cubre también el montaje, porque la pantalla se monta ya enfocada: un
  // `useEffect` además de esto dispararía dos veces el mismo pedido. Hace falta
  // en cada foco porque la pantalla queda montada al cambiar de pestaña, y sin
  // esto volver a Avisos muestra la lista vieja, desalineada con el badge.
  useFocusEffect(
    useCallback(() => {
      void load();
      void refreshUnread();
    }, [load, refreshUnread]),
  );

  async function open(notification: Notification) {
    if (!notification.is_read) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item,
        ),
      );
      applyUnreadDelta(-1);
      await markNotificationRead(notification.id).catch(() => {
        void load();
        void refreshUnread();
      });
    }
    if (notification.report_id) {
      router.push(`/(app)/(tabs)/report/${notification.report_id}`);
    }
  }

  async function readAll() {
    if (unread === 0 || markingAll) return;
    setMarkingAll(true);
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    clearUnread();
    try {
      await markAllNotificationsRead();
    } catch {
      // El optimismo no se sostuvo: se vuelve al estado real del servidor en
      // vez de dejar la bandeja mintiendo.
      await load();
      await refreshUnread();
    } finally {
      setMarkingAll(false);
    }
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
      {/* La barra se muestra siempre que haya avisos, no solo cuando hay sin
          leer: si apareciera y desapareciera, el botón sería difícil de
          encontrar justo cuando se lo busca. Sin nada pendiente queda
          deshabilitado y dice por qué. */}
      {notifications.length > 0 && (
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {unread > 0
              ? `${unread} ${unread === 1 ? "aviso sin leer" : "avisos sin leer"}`
              : "Estás al día"}
          </Text>
          <Pressable
            style={[styles.readAllButton, unread === 0 && styles.readAllButtonDisabled]}
            onPress={() => void readAll()}
            disabled={unread === 0 || markingAll}
            accessibilityRole="button"
            accessibilityLabel="Marcar todos los avisos como leídos"
            accessibilityState={{ disabled: unread === 0 || markingAll }}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-done"
                  size={15}
                  color={unread === 0 ? "#9ca3af" : "#fff"}
                />
                <Text
                  style={[
                    styles.readAllText,
                    unread === 0 && styles.readAllTextDisabled,
                  ]}
                >
                  Marcar todo como leído
                </Text>
              </>
            )}
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
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarInset }]}
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
  readAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1a73e8",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minHeight: 34,
  },
  readAllButtonDisabled: { backgroundColor: "#eef1f5" },
  readAllText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  readAllTextDisabled: { color: "#9ca3af" },
  errorBox: { backgroundColor: "#fef2f2", padding: 12 },
  errorText: { fontSize: 13, color: "#b91c1c" },
  // `paddingBottom` lo pone la pantalla: sale del alto de la barra flotante.
  listContent: { padding: 12, flexGrow: 1 },
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
