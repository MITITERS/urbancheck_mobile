import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { useQueryClient } from "@tanstack/react-query";

import {
  setNotificationPreference,
  type NotificationPreference,
} from "../../src/api/notifications";
import { notificationKeys } from "../../src/lib/queryKeys";
import { useNotificationPreferences } from "../../src/queries/notifications";

const GROUP_TITLE: Record<string, string> = {
  social: "Actividad en tus reportes",
  estado: "Avance de tus reportes",
  otros: "Otros avisos",
};

/**
 * Preferencias de notificaciones (US-025).
 *
 * La pantalla no tiene lista propia de tipos: recorre el catálogo que devuelve
 * el backend, así que un tipo nuevo aparece acá solo. Cada switch guarda al
 * instante, con actualización optimista y rollback si el guardado falla: un
 * botón de guardar sería una fuente de cambios perdidos.
 */
export default function NotificationPreferencesScreen() {
  const queryClient = useQueryClient();
  const query = useNotificationPreferences();
  const [saveError, setSaveError] = useState<string | null>(null);

  const preferences: NotificationPreference[] = query.data ?? [];
  const loading = query.isPending;
  const error = query.isError ? "No pudimos cargar tus preferencias." : saveError;

  const key = notificationKeys.list({ preferences: true });

  async function toggle(preference: NotificationPreference, enabled: boolean) {
    // El interruptor tiene que moverse en el acto: se escribe la caché primero
    // y se revierte si el servidor rechaza. Sin botón de guardar, esperar la
    // respuesta para mover el control se lee como que no reaccionó.
    const previous = queryClient.getQueryData<NotificationPreference[]>(key);
    setSaveError(null);
    queryClient.setQueryData(key, (current: NotificationPreference[] | undefined) =>
      (current ?? []).map((item) =>
        item.kind === preference.kind ? { ...item, enabled } : item,
      ),
    );
    try {
      queryClient.setQueryData(
        key,
        await setNotificationPreference(preference.kind, enabled),
      );
    } catch {
      queryClient.setQueryData(key, previous);
      setSaveError("No pudimos guardar el cambio. Intentá de nuevo.");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const groups = [...new Set(preferences.map((item) => item.group))];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Elegí qué avisos querés recibir en el teléfono. Los que desactives siguen
        apareciendo en tu bandeja: solo dejamos de enviarte la notificación.
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void query.refetch()}>
            <Text style={styles.retry}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      {groups.map((group) => (
        <View key={group} style={styles.group}>
          <Text style={styles.groupTitle}>{GROUP_TITLE[group] ?? group}</Text>
          {preferences
            .filter((item) => item.group === group)
            .map((preference) => (
              <View key={preference.kind} style={styles.row}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{preference.label}</Text>
                  <Text style={styles.rowDescription}>{preference.description}</Text>
                </View>
                <Switch
                  value={preference.enabled}
                  onValueChange={(value) => void toggle(preference, value)}
                  trackColor={{ true: "#1a73e8" }}
                />
              </View>
            ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  content: { padding: 16, paddingBottom: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  intro: { fontSize: 14, color: "#4b5563", lineHeight: 20, marginBottom: 20 },
  errorBox: { backgroundColor: "#fef2f2", padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { fontSize: 13, color: "#b91c1c" },
  retry: { fontSize: 13, color: "#1a73e8", fontWeight: "600", marginTop: 6 },
  group: { marginBottom: 24 },
  groupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "600", color: "#111827" },
  rowDescription: { fontSize: 13, color: "#6b7280", marginTop: 2, lineHeight: 18 },
});
