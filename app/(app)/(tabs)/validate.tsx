import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";

import {
  formatDistance,
  listPendingValidation,
  type PendingReport,
} from "../../../src/api/validation";
import { CATEGORY_LABEL } from "../../../src/reports/labels";
import { useValidatorLocation } from "../../../src/validation/useValidatorLocation";

/**
 * Bandeja de reportes pendientes de validación (US-037).
 *
 * La pestaña solo existe para validadores activos: el layout la oculta para el
 * resto. El orden por cercanía lo resuelve el backend en la base; acá solo se
 * envían las coordenadas cuando el permiso está concedido, porque la pantalla
 * tiene que funcionar igual sin él.
 *
 * Es una lista y nada más: la vista geográfica de los reportes vive en la
 * pestaña Mapa, que ya los muestra con el pendiente de validación distinguido
 * por color. Duplicarla acá era ofrecer dos veces lo mismo.
 */
export default function ValidateTab() {
  const router = useRouter();
  const { coords, permission, reason, request } = useValidatorLocation();
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listPendingValidation(coords);
      setReports(data.results);
    } catch {
      setError("No pudimos cargar la bandeja. Probá de nuevo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [coords]);

  useEffect(() => {
    // La ubicación se pide una vez al entrar; no se re-consulta en cada scroll.
    if (permission === "checking") return;
    void load();
  }, [load, permission]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {permission !== "granted" && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {reason} Mientras tanto, la bandeja se ordena por fecha.
          </Text>
          {permission === "denied" && (
            <Pressable onPress={() => void request()}>
              <Text style={styles.noticeAction}>Permitir ubicación</Text>
            </Pressable>
          )}
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()}>
            <Text style={styles.noticeAction}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      <FlatList
          data={reports}
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
              <Ionicons name="checkmark-done-outline" size={56} color="#c7d2fe" />
              <Text style={styles.emptyTitle}>No hay reportes por validar</Text>
              <Text style={styles.emptyBody}>
                Cuando un vecino cargue un reporte en tu municipio, aparece acá.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/(app)/(tabs)/report/${item.id}`)}
            >
              <Image source={{ uri: item.photo }} style={styles.thumb} />
              <View style={styles.cardBody}>
                <Text style={styles.cardCategory}>
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </Text>
                <Text style={styles.cardAddress} numberOfLines={1}>
                  {item.address || "Sin dirección"}
                </Text>
                <Text style={styles.cardMeta}>
                  {new Date(item.created_at).toLocaleDateString("es-AR")}
                  {formatDistance(item.distance_meters)
                    ? ` • a ${formatDistance(item.distance_meters)}`
                    : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </Pressable>
          )}
        />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  notice: { backgroundColor: "#fff7ed", padding: 12 },
  noticeText: { fontSize: 13, color: "#9a3412", lineHeight: 18 },
  noticeAction: { fontSize: 13, fontWeight: "600", color: "#1a73e8", marginTop: 6 },
  errorBox: { backgroundColor: "#fef2f2", padding: 12 },
  errorText: { fontSize: 13, color: "#b91c1c" },
  listContent: { padding: 12, paddingBottom: 100, flexGrow: 1 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#e5e7eb" },
  cardBody: { flex: 1 },
  cardCategory: { fontSize: 15, fontWeight: "700", color: "#111827" },
  cardAddress: { fontSize: 13, color: "#4b5563", marginTop: 2 },
  cardMeta: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#374151", marginTop: 12 },
  emptyBody: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
});
