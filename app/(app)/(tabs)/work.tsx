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
import { Ionicons } from "@expo/vector-icons";

import { imageSource } from "../../../src/api/client";
import { describeApiError } from "../../../src/api/errors";
import { listAssignedWork } from "../../../src/api/operator";
import type { Report } from "../../../src/api/reports";
import { useFloatingTabBarInset } from "../../../src/components/floatingTabBar";
import { CATEGORY_LABEL } from "../../../src/reports/labels";

/**
 * US-045 — la bandeja del operario.
 *
 * Se alimenta **exclusivamente** del área a la que pertenece y del estado En
 * proceso, y las dos condiciones las aplica el servidor: acá no hay filtros que
 * elegir porque no hay nada que el operario pueda ampliar. Tampoco hay
 * asignación por persona: el reporte se asigna a un área y cualquier operario
 * de esa área puede tomarlo.
 *
 * El orden viene del backend, del más demorado al más reciente, para que el
 * trabajo atrasado quede a la vista.
 */
export default function WorkInboxScreen() {
  const router = useRouter();
  const tabBarInset = useFloatingTabBarInset();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWork = useCallback(async () => {
    try {
      const data = await listAssignedWork();
      setReports(data.results);
      setError(null);
    } catch (err: unknown) {
      // El 403 de una cuenta o un área desactivadas trae su propio motivo
      // (US-044, escenario 9): se muestra tal cual en lugar de un texto genérico.
      setError(describeApiError(err, "No pudimos cargar tus trabajos").message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Al volver a la pestaña, y no solo al montarla: después de registrar una
  // resolución el reporte cerrado tiene que desaparecer de inmediato.
  useFocusEffect(
    useCallback(() => {
      void fetchWork();
    }, [fetchWork]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={44} color="#c62828" />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          style={styles.retryBtn}
          onPress={() => {
            setLoading(true);
            void fetchWork();
          }}
        >
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={reports}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={[
        styles.list,
        { paddingBottom: tabBarInset },
        reports.length === 0 && styles.listEmpty,
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void fetchWork();
          }}
        />
      }
      ListEmptyComponent={
        // Estado vacío explícito: una lista en blanco no distingue "no hay
        // trabajo" de "algo falló" (escenario 9).
        <View style={styles.empty}>
          <Ionicons name="checkmark-done-outline" size={56} color="#b0bec5" />
          <Text style={styles.emptyTitle}>No hay trabajos pendientes</Text>
          <Text style={styles.emptyText}>
            Cuando el municipio le asigne un reporte a tu área, aparece acá.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => router.push(`/(app)/work-report/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Trabajo ${CATEGORY_LABEL[item.category] ?? item.category}`}
        >
          <Image source={imageSource(item.photo)} style={styles.thumb} />
          <View style={styles.cardBody}>
            <Text style={styles.category}>
              {CATEGORY_LABEL[item.category] ?? item.category}
            </Text>
            <Text style={styles.address} numberOfLines={1}>
              {item.address || "Sin dirección cargada"}
            </Text>
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={styles.date}>
              Asignado el{" "}
              {new Date(
                item.area_assigned_at ?? item.created_at,
              ).toLocaleDateString("es-AR")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#b0bec5" />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  errorText: { color: "#c62828", textAlign: "center", fontSize: 15 },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: "#1a73e8",
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "700" },
  list: { padding: 12, gap: 10 },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 8, padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#455a64" },
  emptyText: { fontSize: 14, color: "#78909c", textAlign: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: "#eceff1" },
  cardBody: { flex: 1, gap: 2 },
  category: { fontSize: 15, fontWeight: "700", color: "#263238" },
  address: { fontSize: 13, color: "#546e7a" },
  description: { fontSize: 13, color: "#37474f" },
  date: { fontSize: 12, color: "#90a4ae", marginTop: 2 },
})
