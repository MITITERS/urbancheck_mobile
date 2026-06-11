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

import { logout } from "../../src/api/auth";
import { listMyReports, type Report } from "../../src/api/reports";
import { getMe, type UserProfile } from "../../src/api/users";
import { useAuth } from "../../src/auth/AuthContext";

const STATUS_LABEL: Record<string, string> = {
  reportado: "Reportado",
  en_revision: "En revisión",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  rechazado: "Rechazado",
};

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
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
      <View style={styles.header}>
        {user?.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.role}>{user?.role === "municipal" ? "Municipal" : "Ciudadano"}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.editBtn}
          onPress={() => router.push("/(app)/edit-profile")}
        >
          <Text style={styles.editBtnText}>Editar perfil</Text>
        </Pressable>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Cerrar sesión</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Mis reportes</Text>
      <FlatList
        data={reports}
        keyExtractor={(r) => String(r.id)}
        renderItem={({ item }) => (
          <Pressable
            style={styles.reportItem}
            onPress={() => router.push(`/(app)/report/${item.id}`)}
          >
            <Text style={styles.reportCategory}>{item.category}</Text>
            <Text style={styles.reportDesc} numberOfLines={1}>
              {item.description}
            </Text>
            <Text style={styles.reportStatus}>
              {STATUS_LABEL[item.status] ?? item.status}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No tenés reportes aún.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { alignItems: "center", padding: 24, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  avatarPlaceholder: {
    backgroundColor: "#1a73e8",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontSize: 32, fontWeight: "bold" },
  name: { fontSize: 20, fontWeight: "bold", color: "#222" },
  email: { fontSize: 14, color: "#666", marginTop: 4 },
  role: { fontSize: 12, color: "#888", marginTop: 4 },
  actions: { flexDirection: "row", gap: 12, padding: 16 },
  editBtn: {
    flex: 1,
    backgroundColor: "#e8f0fe",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  editBtnText: { color: "#1a73e8", fontWeight: "600" },
  logoutBtn: {
    flex: 1,
    backgroundColor: "#fce8e6",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  logoutBtnText: { color: "#e53935", fontWeight: "600" },
  sectionTitle: { fontWeight: "bold", fontSize: 15, paddingHorizontal: 16, marginBottom: 8 },
  reportItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 8,
  },
  reportCategory: { fontWeight: "600", color: "#1a73e8", width: 80 },
  reportDesc: { flex: 1, color: "#333", fontSize: 13 },
  reportStatus: { fontSize: 12, color: "#888" },
  emptyText: { textAlign: "center", color: "#aaa", padding: 24 },
});
