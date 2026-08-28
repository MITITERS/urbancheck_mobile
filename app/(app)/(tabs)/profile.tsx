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

import { imageSource } from "../../../src/api/client";
import { logout } from "../../../src/api/auth";
import { listMyReports, type Report } from "../../../src/api/reports";
import {
  getMe,
  participatesAsCitizen,
  type UserProfile,
  type UserRole,
} from "../../../src/api/users";
import { useAuth } from "../../../src/auth/AuthContext";
import { useFloatingTabBarInset } from "../../../src/components/floatingTabBar";

const STATUS_LABEL: Record<string, string> = {
  pendiente_validacion: "Pendiente de validación",
  reportado: "Reportado",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  cancelado: "Cancelado",
  archivado: "Archivado",
};

const CATEGORY_LABEL: Record<string, string> = {
  bache: "Bache",
  alumbrado: "Alumbrado",
  basura: "Basura",
  semaforo: "Semáforo",
  vereda: "Vereda",
  otro: "Otro",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pendiente_validacion: { bg: "#fff3e0", text: "#ef6c00" },
  reportado: { bg: "#e3f2fd", text: "#1565c0" },
  en_proceso: { bg: "#fffde7", text: "#f57f17" },
  resuelto: { bg: "#e8f5e9", text: "#2e7d32" },
  cancelado: { bg: "#ffebee", text: "#c62828" },
  archivado: { bg: "#eceff1", text: "#546e7a" },
};

const CATEGORY_ICON: Record<string, string> = {
  bache: "construct-outline",
  alumbrado: "bulb-outline",
  basura: "trash-outline",
  semaforo: "stopwatch-outline",
  vereda: "walk-outline",
  otro: "ellipsis-horizontal-outline",
};

function formatDate(isoString: string) {
  try {
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return "";
  }
}

// Etiquetas de los cuatro roles de la plataforma (US-017).
const ROLE_LABEL: Record<UserRole, string> = {
  ciudadano: "Ciudadano",
  validador: "Validador",
  agente_municipal: "Agente Municipal",
  admin_plataforma: "Administrador de la plataforma",
};

/** Una fila de acción: ícono, etiqueta y el chevron que anticipa que abre algo. */
function ActionRow({
  icon,
  label,
  tint = "#1a73e8",
  onPress,
  last = false,
}: {
  icon: string;
  label: string;
  tint?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionRow,
        !last && styles.actionRowDivider,
        pressed && styles.actionRowPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.actionIcon, { backgroundColor: `${tint}14` }]}>
        <Ionicons name={icon as never} size={19} color={tint} />
      </View>
      <Text style={[styles.actionLabel, { color: tint === "#1a73e8" ? "#1f2937" : tint }]}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={18} color="#c3c8d0" />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarInset = useFloatingTabBarInset();
  const [user, setUser] = useState<UserProfile | null>(null);
  // Las cuentas de trabajo no reportan, así que «Mis reportes» no les aplica:
  // mostrarles la sección vacía es prometerles algo que no van a poder llenar.
  const isCitizen = participatesAsCitizen(user);
  const isMunicipalRole = user !== null && !isCitizen;
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void getMe()
        .then(async (profile) => {
          setUser(profile);
          // No se piden si no van a mostrarse: una request menos en cada
          // entrada al perfil del personal municipal.
          if (!participatesAsCitizen(profile)) {
            setReports([]);
            return;
          }
          const { results } = await listMyReports();
          setReports(results);
        })
        .finally(() => setLoading(false));
    }, []),
  );

  async function handleLogout() {
    Alert.alert("Cerrar sesión", "¿Estás seguro que querés cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await logout().catch(() => {});
          await signOut();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Las tres cifras salen de la misma lista que se muestra abajo: así lo que
  // dice el resumen y lo que se ve al scrollear no pueden discrepar.
  const inProgress = reports.filter((r) => r.status === "en_proceso").length;
  const resolved = reports.filter((r) => r.status === "resuelto").length;

  const header = (
    <>
      <View style={[styles.hero, { paddingTop: insets.top > 0 ? insets.top + 20 : 32 }]}>
        <View style={styles.avatarRing}>
          {user?.avatar ? (
            <Image source={imageSource(user.avatar)} style={styles.avatar} />
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
        <View style={styles.roleBadge}>
          <Ionicons
            name={isMunicipalRole ? "briefcase" : "person"}
            size={12}
            color="#fff"
          />
          <Text style={styles.roleBadgeText}>
            {ROLE_LABEL[user?.role ?? "ciudadano"]}
          </Text>
        </View>
      </View>

      {/* El resumen monta sobre el borde del encabezado: ata las dos zonas en
          lugar de dejar una franja de color y una lista sueltas. */}
      {isCitizen && (
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{reports.length}</Text>
            <Text style={styles.statLabel}>Reportes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: "#f57f17" }]}>{inProgress}</Text>
            <Text style={styles.statLabel}>En proceso</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: "#2e7d32" }]}>{resolved}</Text>
            <Text style={styles.statLabel}>Resueltos</Text>
          </View>
        </View>
      )}

      <View style={[styles.card, !isCitizen && { marginTop: -28 }]}>
        <ActionRow
          icon="person-circle-outline"
          label="Editar perfil"
          onPress={() => router.push("/(app)/edit-profile")}
        />
        <ActionRow
          icon="notifications-outline"
          label="Notificaciones"
          onPress={() => router.push("/(app)/notification-preferences")}
          last
        />
      </View>

      <View style={styles.card}>
        <ActionRow
          icon="log-out-outline"
          label="Cerrar sesión"
          tint="#e53935"
          onPress={handleLogout}
          last
        />
      </View>

      {isCitizen && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mis reportes</Text>
          {reports.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{reports.length}</Text>
            </View>
          )}
        </View>
      )}
    </>
  );

  return (
    <FlatList
      style={styles.container}
      // La pantalla entera scrollea: con el encabezado fijo, en un teléfono
      // chico las acciones se comían la lista.
      ListHeaderComponent={header}
      data={isCitizen ? reports : []}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={{ paddingBottom: tabBarInset }}
      renderItem={({ item }) => {
        const colors = STATUS_COLORS[item.status] ?? { bg: "#f5f5f5", text: "#666" };
        return (
          <Pressable
            style={({ pressed }) => [styles.reportCard, pressed && styles.reportCardPressed]}
            onPress={() => router.push(`/(app)/(tabs)/report/${item.id}`)}
          >
            <View style={styles.reportRow}>
              <View style={styles.reportTitle}>
                <View style={[styles.categoryIcon, { backgroundColor: colors.bg }]}>
                  <Ionicons
                    name={(CATEGORY_ICON[item.category] ?? "ellipse-outline") as never}
                    size={15}
                    color={colors.text}
                  />
                </View>
                <Text style={styles.reportCategory}>
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </Text>
              </View>
              <Text style={styles.reportDate}>{formatDate(item.created_at)}</Text>
            </View>
            <Text style={styles.reportDesc} numberOfLines={2}>
              {item.description}
            </Text>
            <View style={styles.reportFooter}>
              <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
                <Text style={[styles.statusBadgeText, { color: colors.text }]}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </Text>
              </View>
              <View style={styles.reportStats}>
                <View style={styles.reportStat}>
                  <Ionicons name="heart-outline" size={14} color="#9ca3af" />
                  <Text style={styles.statText}>{item.like_count}</Text>
                </View>
                <View style={styles.reportStat}>
                  <Ionicons name="chatbubble-outline" size={14} color="#9ca3af" />
                  <Text style={styles.statText}>{item.comment_count}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        isCitizen ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="megaphone-outline" size={26} color="#1a73e8" />
            </View>
            <Text style={styles.emptyTitle}>Todavía no reportaste nada</Text>
            <Text style={styles.emptyText}>
              Cuando cargues un problema de la vía pública, vas a poder seguir su
              estado desde acá.
            </Text>
            <Pressable
              style={styles.emptyAction}
              onPress={() => router.push("/(app)/(tabs)/create-tab")}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.emptyActionText}>Crear mi primer reporte</Text>
            </Pressable>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6f8" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    // Deja lugar para la tarjeta de cifras, que monta sobre este borde.
    paddingBottom: 52,
    backgroundColor: "#1a73e8",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatarRing: {
    padding: 4,
    borderRadius: 54,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginBottom: 14,
  },
  avatar: { width: 92, height: 92, borderRadius: 46 },
  avatarPlaceholder: {
    backgroundColor: "#0f56b3",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontSize: 36, fontWeight: "bold" },
  name: { fontSize: 22, fontWeight: "700", color: "#fff", textAlign: "center" },
  email: { fontSize: 13.5, color: "rgba(255,255,255,0.82)", marginTop: 4 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  roleBadgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: -28,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "700", color: "#1f2937" },
  statLabel: { fontSize: 11.5, color: "#6b7280", marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: "#eef0f3" },

  card: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  actionRowDivider: { borderBottomWidth: 1, borderBottomColor: "#f1f3f5" },
  actionRowPressed: { backgroundColor: "#f7f9fc" },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: "600" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 26,
    marginBottom: 4,
  },
  sectionTitle: { fontWeight: "700", fontSize: 17, color: "#1f2937" },
  countBadge: {
    backgroundColor: "#e8f0fe",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  countBadgeText: { fontSize: 12, fontWeight: "700", color: "#1a73e8" },

  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  reportCardPressed: { backgroundColor: "#f7f9fc" },
  reportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reportTitle: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  reportCategory: { fontWeight: "700", color: "#1f2937", fontSize: 14.5 },
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
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  reportStats: { flexDirection: "row", gap: 12 },
  reportStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, color: "#6b7280" },

  emptyCard: {
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#e8f0fe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 15.5, fontWeight: "700", color: "#1f2937", marginBottom: 6 },
  emptyText: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1a73e8",
    paddingHorizontal: 18,
    height: 42,
    borderRadius: 21,
  },
  emptyActionText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
