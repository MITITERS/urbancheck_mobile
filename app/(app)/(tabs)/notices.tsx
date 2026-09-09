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

import { useQueryClient } from "@tanstack/react-query";

import {
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
  type NotificationKind,
  type PaginatedNotifications,
} from "../../../src/api/notifications";
import { useFloatingTabBarInset } from "../../../src/components/floatingTabBar";
import { notificationKeys } from "../../../src/lib/queryKeys";
import { useRefetchOnFocus } from "../../../src/lib/useRefetchOnFocus";
import { useUnread } from "../../../src/notifications/UnreadContext";
import { useNotifications } from "../../../src/queries/notifications";

/**
 * Ícono e color por tipo de aviso. El de cambio de estado (US-011) se distingue
 * a simple vista de los sociales de US-033, sin cambiar cómo se renderizan esos.
 */
type KindStyle = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  background: string;
};

const KIND_STYLE: Record<NotificationKind, KindStyle> = {
  cambio_estado: { icon: "swap-horizontal", color: "#1a73e8", background: "#e8f0fe" },
  nuevo_comentario: { icon: "chatbubble-outline", color: "#7c3aed", background: "#f3e8ff" },
  nuevo_like: { icon: "heart-outline", color: "#db2777", background: "#fce7f3" },
  // La voz del municipio: el mismo azul institucional que el hilo de respuestas
  // oficiales del detalle (US-024).
  respuesta_oficial: { icon: "business", color: "#1a73e8", background: "#e8f0fe" },
  // Los dos avisos de plazo por vencer van en ámbar: piden hacer algo antes de
  // una fecha, y eso es lo que tienen que transmitir de un vistazo.
  proximo_archivado: { icon: "time-outline", color: "#b45309", background: "#fef3c7" },
  proxima_confirmacion: { icon: "hourglass-outline", color: "#b45309", background: "#fef3c7" },
  // El único que no le llega al vecino sino al municipio: algo se objetó.
  apelacion_cierre: { icon: "alert-circle", color: "#c62828", background: "#ffebee" },
};

/**
 * Respaldo para un tipo de aviso que la app todavía no conoce.
 *
 * Existe porque el catálogo lo define el **backend** y la app se actualiza
 * aparte: sin esto, agregar un tipo del lado del servidor rompía la bandeja
 * entera —`KIND_STYLE[kind]` devolvía `undefined` y leerle `background`
 * reventaba el render de toda la lista, no de esa fila—. Es exactamente lo que
 * pasó al sumar los avisos de US-024, US-031, US-047 y US-048.
 *
 * El mensaje lo redacta el servidor, así que un aviso desconocido igual se lee
 * bien; lo único genérico es el ícono.
 */
const UNKNOWN_KIND: KindStyle = {
  icon: "notifications-outline",
  color: "#546e7a",
  background: "#eceff1",
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
  const [markingAll, setMarkingAll] = useState(false);
  const queryClient = useQueryClient();
  const inbox = useNotifications();

  const notifications: Notification[] = inbox.data?.results ?? [];
  const loading = inbox.isPending;
  const error = inbox.isError ? "No pudimos cargar tus avisos." : null;

  /** Reescribe la lista en la caché, que es de donde la pantalla la lee. */
  const patchList = useCallback(
    (update: (items: Notification[]) => Notification[]) => {
      queryClient.setQueryData(
        notificationKeys.list({ page: 1 }),
        (current: PaginatedNotifications | undefined) =>
          current ? { ...current, results: update(current.results) } : current,
      );
    },
    [queryClient],
  );

  // La pantalla queda montada al cambiar de pestaña: sin esto, volver a Avisos
  // mostraría la lista vieja, desalineada con el badge. Refresca solo lo que
  // venció y por detrás, en lugar de recargar de cero con un spinner.
  useRefetchOnFocus(notificationKeys.lists());
  useFocusEffect(
    useCallback(() => {
      void refreshUnread();
    }, [refreshUnread]),
  );

  const load = useCallback(() => {
    void inbox.refetch();
    // `refetch` es estable; incluir `inbox` entero re-crearía esto en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function open(notification: Notification) {
    if (!notification.is_read) {
      patchList((items) =>
        items.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item,
        ),
      );
      applyUnreadDelta(-1);
      await markNotificationRead(notification.id).catch(() => {
        load();
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
    patchList((items) => items.map((item) => ({ ...item, is_read: true })));
    clearUnread();
    try {
      await markAllNotificationsRead();
    } catch {
      // El optimismo no se sostuvo: se vuelve al estado real del servidor en
      // vez de dejar la bandeja mintiendo.
      load();
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
            // El gesto fuerza el pedido, venza o no: es una orden explícita.
            refreshing={inbox.isRefetching}
            onRefresh={load}
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
          const style = KIND_STYLE[item.kind] ?? UNKNOWN_KIND;
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
