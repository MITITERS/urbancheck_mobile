import { Ionicons } from "@expo/vector-icons";
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

import { isSessionExpired } from "../../../src/api/errors";
import { type Report, listUserReports } from "../../../src/api/reports";
import { type PublicProfile, getPublicProfile } from "../../../src/api/users";
import {
  categoryLabel,
  formatDate,
  statusColors,
  statusLabel,
} from "../../../src/constants/reports";

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = Number(id);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await getPublicProfile(userId);
        if (cancelled) return;
        setProfile(data);

        // Un perfil privado no lista reportes: nos ahorramos la petición.
        if (!data.is_public) {
          setReports([]);
          setHasMore(false);
          return;
        }
        const listed = await listUserReports(userId, 1);
        if (cancelled) return;
        setReports(listed.results);
        setHasMore(!!listed.next);
        setPage(1);
      } catch (err) {
        if (!cancelled && !isSessionExpired(err)) {
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const listed = await listUserReports(userId, next);
      setReports((prev) => [...prev, ...listed.results]);
      setHasMore(!!listed.next);
      setPage(next);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-outline" size={48} color="#ccc" style={{ marginBottom: 12 }} />
        <Text style={styles.emptyText}>No se pudo cargar el perfil.</Text>
      </View>
    );
  }

  const header = (
    <>
      <View style={styles.header}>
        {profile.avatar ? (
          <Image source={{ uri: profile.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {profile.name?.charAt(0)?.toUpperCase() ?? "?"}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{profile.name}</Text>

        {profile.is_public ? (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{profile.report_count ?? 0}</Text>
              <Text style={styles.statLabel}>
                {profile.report_count === 1 ? "reporte" : "reportes"}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {profile.date_joined ? formatDate(profile.date_joined) : "—"}
              </Text>
              <Text style={styles.statLabel}>miembro desde</Text>
            </View>
          </View>
        ) : (
          <View style={styles.privateBadge}>
            <Ionicons name="lock-closed" size={14} color="#6b7280" />
            <Text style={styles.privateBadgeText}>Perfil privado</Text>
          </View>
        )}
      </View>

      {profile.is_public && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Reportes publicados</Text>
        </View>
      )}
    </>
  );

  if (!profile.is_public) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.privateBody}>
          <Ionicons name="eye-off-outline" size={44} color="#ccc" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>
            Este usuario configuró su perfil como privado, así que sus reportes no son
            visibles.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reports}
        keyExtractor={(r) => String(r.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 40 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} /> : null}
        renderItem={({ item }) => {
          const colors = statusColors(item.status);
          return (
            <Pressable
              style={styles.reportCard}
              onPress={() => router.push(`/(app)/(tabs)/report/${item.id}`)}
            >
              <View style={styles.reportRow}>
                <Text style={styles.reportCategory}>{categoryLabel(item.category)}</Text>
                <Text style={styles.reportDate}>{formatDate(item.created_at)}</Text>
              </View>
              <Text style={styles.reportDesc} numberOfLines={2}>
                {item.description}
              </Text>
              <View style={styles.reportFooter}>
                <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: colors.text }]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
                <View style={styles.reportStats}>
                  <View style={styles.stat}>
                    <Ionicons name="heart-outline" size={14} color="#888" />
                    <Text style={styles.statText}>{item.like_count}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Ionicons name="chatbubble-outline" size={14} color="#888" />
                    <Text style={styles.statText}>{item.comment_count}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="document-text-outline"
              size={44}
              color="#ccc"
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.emptyText}>Este usuario todavía no publicó reportes.</Text>
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
    padding: 32,
    backgroundColor: "#f8f9fa",
  },
  header: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: "#fff",
    marginBottom: 12,
  },
  avatarPlaceholder: {
    backgroundColor: "#1a73e8",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontSize: 34, fontWeight: "bold" },
  name: { fontSize: 21, fontWeight: "bold", color: "#1f2937" },
  statsRow: { flexDirection: "row", alignItems: "center", marginTop: 18, gap: 20 },
  statBox: { alignItems: "center", minWidth: 90 },
  statValue: { fontSize: 16, fontWeight: "700", color: "#1f2937" },
  statLabel: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: "#e5e7eb" },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  privateBadgeText: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  privateBody: { alignItems: "center", justifyContent: "center", padding: 40 },
  sectionHeader: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 8 },
  sectionTitle: { fontWeight: "700", fontSize: 16, color: "#374151" },
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  reportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reportCategory: { fontWeight: "700", color: "#1f2937", fontSize: 14 },
  reportDate: { fontSize: 12, color: "#9ca3af" },
  reportDesc: { color: "#4b5563", fontSize: 13, lineHeight: 18, marginBottom: 12 },
  reportFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 10,
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },
  reportStats: { flexDirection: "row", gap: 12 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, color: "#6b7280" },
  emptyContainer: { alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { textAlign: "center", color: "#9ca3af", fontSize: 14, lineHeight: 20 },
});
