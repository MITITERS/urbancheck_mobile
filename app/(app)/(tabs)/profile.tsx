import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { logout } from "../../../src/api/auth";
import { listMyReports, type Report } from "../../../src/api/reports";
import { getMe, type UserProfile } from "../../../src/api/users";
import { useAuth } from "../../../src/auth/AuthContext";
import {
  categoryLabel,
  formatDate,
  statusColors,
  statusLabel,
} from "../../../src/constants/reports";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void Promise.all([
        getMe().then(setUser),
        listMyReports().then((r) => setReports(r.results)),
      ]).finally(() => setLoading(false));
    }, []),
  );

  async function handleLogout() {
    Alert.alert(
      "Cerrar sesión",
      "¿Estás seguro que querés cerrar sesión?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar sesión",
          style: "destructive",
          onPress: async () => {
            await logout().catch(() => {});
            await signOut();
          },
        },
      ],
    );
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
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top > 0 ? insets.top + 16 : 28,
            paddingBottom: 20,
          },
        ]}
      >
        <View style={styles.avatarWrapper}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View
          style={[
            styles.roleBadge,
            user?.role === "municipal"
              ? styles.roleBadgeMunicipal
              : styles.roleBadgeCiudadano,
          ]}
        >
          <Text
            style={[
              styles.roleBadgeText,
              user?.role === "municipal"
                ? styles.roleBadgeTextMunicipal
                : styles.roleBadgeTextCiudadano,
            ]}
          >
            {user?.role === "municipal" ? "Personal Municipal" : "Ciudadano"}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.editBtn}
          onPress={() => router.push("/(app)/edit-profile")}
        >
          <Ionicons name="pencil-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.editBtnText}>Editar perfil</Text>
        </Pressable>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color="#e53935" style={{ marginRight: 6 }} />
          <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Mis reportes</Text>
        {reports.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{reports.length}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={reports}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ paddingBottom: 110 }}
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
            <Ionicons name="document-text-outline" size={48} color="#ccc" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No tenés reportes aún.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  avatarWrapper: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 14,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    backgroundColor: "#1a73e8",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontSize: 36, fontWeight: "bold" },
  name: { fontSize: 22, fontWeight: "bold", color: "#1f2937" },
  email: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  roleBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeMunicipal: { backgroundColor: "#e8f5e9" },
  roleBadgeCiudadano: { backgroundColor: "#e3f2fd" },
  roleBadgeText: { fontSize: 12, fontWeight: "600" },
  roleBadgeTextMunicipal: { color: "#2e7d32" },
  roleBadgeTextCiudadano: { color: "#1565c0" },
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginBottom: 16,
  },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#1a73e8",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1a73e8",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  editBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  logoutBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#fce8e6",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtnText: { color: "#e53935", fontWeight: "600", fontSize: 14 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  sectionTitle: { fontWeight: "700", fontSize: 16, color: "#374151" },
  countBadge: {
    backgroundColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  countBadgeText: { fontSize: 12, fontWeight: "600", color: "#4b5563" },
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },
  reportStats: { flexDirection: "row", gap: 12 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, color: "#6b7280" },
  emptyContainer: { alignItems: "center", justifyContent: "center", padding: 40, marginTop: 20 },
  emptyText: { textAlign: "center", color: "#9ca3af", fontSize: 14, fontWeight: "500" },
});
