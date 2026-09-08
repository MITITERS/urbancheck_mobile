import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { imageSource } from "../../../src/api/client";
import { describeApiError } from "../../../src/api/errors";
import { listReportsByAuthor, type Report } from "../../../src/api/reports";
import { getPublicProfile, type PublicProfile } from "../../../src/api/users";
import { useAuth } from "../../../src/auth/AuthContext";
import { CATEGORY_LABEL, STATUS_COLOR, STATUS_LABEL } from "../../../src/reports/labels";

function formatMonth(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

/**
 * Perfil público de otra persona (US-027).
 *
 * Muestra lo que el servidor decide mostrar, y nada más: si el perfil está en
 * privado, `date_joined` y `report_count` vienen nulos y el listado de reportes
 * vuelve vacío. La pantalla no infiere nada de esa ausencia —lo dice el campo
 * `is_public`— y lo explica en lugar de mostrar un perfil a medias sin motivo.
 */
export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMe = user !== null && user.id === Number(id);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getPublicProfile(Number(id))
      .then(async (data) => {
        if (cancelled) return;
        setProfile(data);
        if (!data.is_public) {
          setReports([]);
          return;
        }
        const { results } = await listReportsByAuthor(Number(id));
        if (!cancelled) setReports(results);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeApiError(err, "No pudimos abrir el perfil").message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error !== null || profile === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "No encontramos ese perfil."}</Text>
      </View>
    );
  }

  const header = (
    <View style={styles.hero}>
      {profile.avatar ? (
        <Image source={imageSource(profile.avatar)} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarInitial}>
            {profile.name?.charAt(0)?.toUpperCase() ?? "?"}
          </Text>
        </View>
      )}
      <Text style={styles.name}>{profile.name || "Vecino"}</Text>
      {isMe && <Text style={styles.meHint}>Así te ven los demás</Text>}

      {profile.is_public ? (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.report_count ?? 0}</Text>
            <Text style={styles.statLabel}>
              {profile.report_count === 1 ? "Reporte" : "Reportes"}
            </Text>
          </View>
          {profile.date_joined && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  <Ionicons name="calendar-outline" size={17} color="#1f2937" />
                </Text>
                <Text style={styles.statLabel}>
                  Desde {formatMonth(profile.date_joined)}
                </Text>
              </View>
            </>
          )}
        </View>
      ) : (
        <View style={styles.privateBox}>
          <Ionicons name="lock-closed-outline" size={18} color="#6b7280" />
          <Text style={styles.privateText}>
            Este perfil es privado. Su actividad no se muestra.
          </Text>
        </View>
      )}

      {profile.is_public && (
        <Text style={styles.sectionTitle}>
          {reports.length > 0 ? "Sus reportes" : ""}
        </Text>
      )}
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      ListHeaderComponent={header}
      data={reports}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={{ paddingBottom: 32 }}
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => router.push(`/(app)/(tabs)/report/${item.id}`)}
        >
          <Image source={imageSource(item.photo)} style={styles.cardPhoto} />
          <View style={styles.cardBody}>
            <Text style={styles.cardCategory}>
              {CATEGORY_LABEL[item.category] ?? item.category}
            </Text>
            <Text style={styles.cardDesc} numberOfLines={2}>
              {item.description}
            </Text>
            <View style={styles.cardFooter}>
              <View style={[styles.dot, { backgroundColor: STATUS_COLOR[item.status] }]} />
              <Text style={styles.cardStatus}>
                {STATUS_LABEL[item.status] ?? item.status}
              </Text>
            </View>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        profile.is_public ? (
          <Text style={styles.empty}>
            {isMe
              ? "Todavía no publicaste ningún reporte."
              : "Todavía no publicó ningún reporte."}
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6f8" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { color: "#6b7280", fontSize: 14, textAlign: "center" },
  hero: { alignItems: "center", paddingTop: 24, paddingHorizontal: 20 },
  avatar: { width: 86, height: 86, borderRadius: 43 },
  avatarPlaceholder: {
    backgroundColor: "#1a73e8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontSize: 34, fontWeight: "bold" },
  name: { fontSize: 20, fontWeight: "700", color: "#1f2937", marginTop: 12 },
  meHint: { fontSize: 12.5, color: "#9ca3af", marginTop: 2 },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: 18,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
  },
  stat: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  statValue: { fontSize: 19, fontWeight: "700", color: "#1f2937" },
  statLabel: { fontSize: 11.5, color: "#6b7280", marginTop: 2, textAlign: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: "#eef0f3" },
  privateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "stretch",
    marginTop: 18,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
  },
  privateText: { flex: 1, fontSize: 13, color: "#6b7280", lineHeight: 18 },
  sectionTitle: {
    alignSelf: "flex-start",
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2937",
    marginTop: 22,
  },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    marginHorizontal: 16,
    marginTop: 10,
  },
  cardPressed: { backgroundColor: "#f7f9fc" },
  cardPhoto: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#e5e7eb" },
  cardBody: { flex: 1, justifyContent: "center" },
  cardCategory: { fontWeight: "700", color: "#1f2937", fontSize: 14 },
  cardDesc: { color: "#4b5563", fontSize: 13, marginTop: 2 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardStatus: { fontSize: 12, color: "#6b7280" },
  empty: { textAlign: "center", color: "#9ca3af", fontSize: 13.5, marginTop: 28 },
});
