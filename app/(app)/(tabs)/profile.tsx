import { useFocusEffect, useRouter } from "expo-router";
import { Fragment, useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { listResolvedWork } from "../../../src/api/operator";
import { listMyReports, type Report } from "../../../src/api/reports";
import {
  getMe,
  isOperator,
  participatesAsCitizen,
  type UserProfile,
  type UserRole,
} from "../../../src/api/users";
import { useAuth } from "../../../src/auth/AuthContext";
import { useFloatingTabBarInset } from "../../../src/components/floatingTabBar";
import { reportStatusLabel } from "../../../src/reports/labels";

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
  resuelto_pendiente_confirmacion: { bg: "#f1f8e9", text: "#558b2f" },
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

// Etiquetas de los cinco roles de la plataforma (US-017, ampliado por US-044).
const ROLE_LABEL: Record<UserRole, string> = {
  ciudadano: "Ciudadano",
  validador: "Validador",
  operario: "Operario",
  agente_municipal: "Agente Municipal",
  admin_plataforma: "Administrador de la plataforma",
};

/**
 * Una fila del historial del perfil.
 *
 * Vecino y operario miran dos listas distintas —lo que reportó uno, lo que
 * cerró el otro— pero la fila es la misma tarjeta, y la única diferencia de
 * datos es `resolved_at`, que solo trae el historial del operario. Un tipo con
 * ese campo opcional deja que la tarjeta se escriba una vez en lugar de
 * duplicarla por rol.
 */
type ProfileReport = Report & { resolved_at?: string };

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
  // El operario sí tiene obra propia que mostrar, aunque no reporte: los
  // trabajos que cerró (US-046). Es la misma idea que «Mis reportes» del
  // vecino —el registro de lo que hizo esta persona— y por eso comparte la
  // sección, el resumen y la tarjeta en lugar de tener una pantalla aparte.
  const operator = isOperator(user);
  const hasHistory = isCitizen || operator;
  const [reports, setReports] = useState<ProfileReport[]>([]);
  // Arranca desplegada, como la de comentarios del detalle: plegada por defecto
  // se lee como que no hay reportes, y el contador no alcanza para desmentirlo.
  const [reportsOpen, setReportsOpen] = useState(true);
  const chevronSpin = useRef(new Animated.Value(1)).current;
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void getMe()
        .then(async (profile) => {
          setUser(profile);
          if (isOperator(profile)) {
            const { results } = await listResolvedWork();
            setReports(results);
            return;
          }
          // No se piden si no van a mostrarse: una request menos en cada
          // entrada al perfil del resto del personal municipal.
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

  function toggleReports() {
    const opening = !reportsOpen;
    setReportsOpen(opening);
    Animated.timing(chevronSpin, {
      toValue: opening ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

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
  const awaitingConfirmation = reports.filter(
    (r) => r.status === "resuelto_pendiente_confirmacion",
  ).length;

  // Cada rol mide lo suyo, pero con la misma tarjeta de tres cifras. Las del
  // operario cuentan **cierres**, no reportes: el total es cuántos trabajos
  // cerró, y las otras dos en qué quedó cada uno. Un cierre objetado (US-048)
  // volvió a *En proceso* y solo suma en el total: la acción sobre ese trabajo
  // está en la bandeja, que es de donde se lo retoma, y no acá.
  const stats = operator
    ? [
        { value: reports.length, label: "Cerrados", color: "#1f2937" },
        { value: awaitingConfirmation, label: "A confirmar", color: "#558b2f" },
        { value: resolved, label: "Confirmados", color: "#2e7d32" },
      ]
    : [
        { value: reports.length, label: "Reportes", color: "#1f2937" },
        { value: inProgress, label: "En proceso", color: "#f57f17" },
        { value: resolved, label: "Resueltos", color: "#2e7d32" },
      ];

  const sectionTitle = operator ? "Trabajos resueltos" : "Mis reportes";

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
      {hasHistory && (
        <View style={styles.statsCard}>
          {stats.map((stat, index) => (
            <Fragment key={stat.label}>
              {index > 0 && <View style={styles.statDivider} />}
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: stat.color }]}>
                  {stat.value}
                </Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            </Fragment>
          ))}
        </View>
      )}

      {/* Sin tarjeta de cifras no hay nada montado sobre el borde del
          encabezado, así que las acciones suben a ocupar ese hueco. */}
      <View style={[styles.card, !hasHistory && { marginTop: -28 }]}>
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

      {hasHistory && (
        <Pressable
          style={styles.sectionHeader}
          onPress={toggleReports}
          accessibilityRole="button"
          accessibilityState={{ expanded: reportsOpen }}
          accessibilityLabel={`${sectionTitle}, ${reports.length}`}
        >
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          {reports.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{reports.length}</Text>
            </View>
          )}
          {/* La flecha ocupa el resto de la fila: el área tocable es el
              encabezado entero, no el ícono solo. */}
          <Animated.View
            style={{
              marginLeft: "auto",
              transform: [
                {
                  rotate: chevronSpin.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["-90deg", "0deg"],
                  }),
                },
              ],
            }}
          >
            <Ionicons name="chevron-down" size={18} color="#6b7280" />
          </Animated.View>
        </Pressable>
      )}
    </>
  );

  return (
    <FlatList
      style={styles.container}
      // La pantalla entera scrollea: con el encabezado fijo, en un teléfono
      // chico las acciones se comían la lista.
      ListHeaderComponent={header}
      data={hasHistory && reportsOpen ? reports : []}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={{ paddingBottom: tabBarInset }}
      renderItem={({ item }) => {
        const colors = STATUS_COLORS[item.status] ?? { bg: "#f5f5f5", text: "#666" };
        return (
          <Pressable
            style={({ pressed }) => [styles.reportCard, pressed && styles.reportCardPressed]}
            // El detalle del feed no existe para el operario —la navegación lo
            // deja afuera por rol—, así que su fila abre la pantalla de trabajo,
            // que además es la que muestra el parte de cierre ya registrado.
            onPress={() =>
              router.push(
                operator
                  ? `/(app)/work-report/${item.id}`
                  : `/(app)/(tabs)/report/${item.id}`,
              )
            }
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
              {/* Al vecino le importa cuándo lo reportó; al operario, cuándo lo
                  cerró. Es la fecha con la que el servidor ordena cada lista. */}
              <Text style={styles.reportDate}>
                {operator && item.resolved_at
                  ? `Cerrado ${formatDate(item.resolved_at)}`
                  : formatDate(item.created_at)}
              </Text>
            </View>
            <Text style={styles.reportDesc} numberOfLines={2}>
              {item.description}
            </Text>
            <View style={styles.reportFooter}>
              <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
                <Text style={[styles.statusBadgeText, { color: colors.text }]}>
                  {reportStatusLabel(item)}
                  {/* Un reporte archivado sale del feed y del mapa, así que
                      este listado es el único lugar donde el autor lo vuelve a
                      encontrar: la fecha explica desde cuándo (US-031). */}
                  {item.archived_at ? ` · ${formatDate(item.archived_at)}` : ""}
                </Text>
              </View>
              {/* Los me gusta y los comentarios son la repercusión entre
                  vecinos: al operario no le dicen nada sobre su trabajo y en su
                  fila serían ruido. */}
              {!operator && (
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
              )}
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        // Plegada no hay vacío que mostrar: la lista está guardada, no vacía.
        hasHistory && reportsOpen ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name={operator ? "hammer-outline" : "megaphone-outline"}
                size={26}
                color="#1a73e8"
              />
            </View>
            <Text style={styles.emptyTitle}>
              {operator
                ? "Todavía no cerraste ningún trabajo"
                : "Todavía no reportaste nada"}
            </Text>
            <Text style={styles.emptyText}>
              {operator
                ? "Cuando registres la resolución de un trabajo de tu área, te queda acá."
                : "Cuando cargues un problema de la vía pública, vas a poder seguir su estado desde acá."}
            </Text>
            {/* La salida es a donde está el trabajo por hacer: el vecino carga
                un reporte, el operario abre su bandeja. */}
            <Pressable
              style={styles.emptyAction}
              onPress={() =>
                router.push(
                  operator ? "/(app)/(tabs)/work" : "/(app)/(tabs)/create-tab",
                )
              }
            >
              <Ionicons name={operator ? "hammer" : "add"} size={18} color="#fff" />
              <Text style={styles.emptyActionText}>
                {operator ? "Ver mis trabajos" : "Crear mi primer reporte"}
              </Text>
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
