import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import {
  addComment,
  getReport,
  likeReport,
  type ReportDetail,
  unlikeReport,
} from "../../../../src/api/reports";

const STATUS_LABEL: Record<string, string> = {
  pendiente_validacion: "Pendiente de validación",
  reportado: "Reportado",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  cancelado: "Cancelado",
  archivado: "Archivado",
};

// Pasos del flujo principal (happy path) que se van desbloqueando.
const TIMELINE_STEPS = [
  "pendiente_validacion",
  "reportado",
  "en_proceso",
  "resuelto",
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  bache: "Bache",
  alumbrado: "Alumbrado",
  basura: "Basura",
  semaforo: "Semáforo",
  vereda: "Vereda",
  otro: "Otro",
};

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  const mapRef = useRef<MapView>(null);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const containerHeight = useRef(new Animated.Value(240)).current;

  // Left-edge swipe-back gesture (bottom-tabs has no native back gesture).
  const swipeBack = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, g) => {
        const startX = evt.nativeEvent.pageX - g.dx;
        return startX < 30 && g.dx > 12 && Math.abs(g.dy) < 12;
      },
      onPanResponderRelease: (_evt, g) => {
        if (g.dx > 80 && g.vx > 0) {
          router.back();
        }
      },
    }),
  ).current;

  function toggleEnlarged() {
    Animated.timing(containerHeight, {
      toValue: isEnlarged ? 240 : 420,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setIsEnlarged(!isEnlarged);
  }

  useEffect(() => {
    // Reset stale data so previous report's image/content doesn't flash
    setReport(null);
    setLoading(true);
    setImgLoaded(false);
    setActivePage(0);
    void fetchReport();
  }, [id]);

  useEffect(() => {
    if (report?.photo) {
      Image.getSize(
        report.photo,
        (w, h) => {
          setIsPortrait(h > w);
        },
        () => {
          setIsPortrait(false);
        },
      );
    }

    if (report?.latitude && report?.longitude) {
      mapRef.current?.animateToRegion(
        {
          latitude: Number(report.latitude),
          longitude: Number(report.longitude),
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        0,
      );
    }
  }, [report]);

  async function fetchReport() {
    try {
      const data = await getReport(Number(id));
      setReport(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleLike() {
    if (!report) return;
    try {
      if (report.is_liked) {
        await unlikeReport(report.id);
        setReport((r) =>
          r ? { ...r, is_liked: false, like_count: r.like_count - 1 } : r,
        );
      } else {
        await likeReport(report.id);
        setReport((r) =>
          r ? { ...r, is_liked: true, like_count: r.like_count + 1 } : r,
        );
      }
    } catch {
      Alert.alert("Error", "No se pudo procesar el like.");
    }
  }

  async function handleComment() {
    if (!report || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const newComment = await addComment(report.id, commentText.trim());
      setReport((r) =>
        r
          ? {
              ...r,
              comments: [newComment, ...r.comments],
              comment_count: r.comment_count + 1,
            }
          : r,
      );
      setCommentText("");
    } catch {
      Alert.alert("Error", "No se pudo enviar el comentario.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.center}>
        <Text>Reporte no encontrado.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      {...swipeBack.panHandlers}
    >
      <ScrollView style={styles.container}>
        {report.latitude && report.longitude ? (
          <Animated.View style={[styles.mediaContainer, { height: containerHeight }]}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(event) => {
                const slide = Math.round(event.nativeEvent.contentOffset.x / width);
                if (slide !== activePage) {
                  setActivePage(slide);
                }
              }}
              scrollEventThrottle={16}
              style={styles.horizontalScroll}
            >
              <View style={{ width, height: "100%", position: "relative" }}>
                <Image
                  source={{ uri: report.photo }}
                  style={{ width, height: "100%" }}
                  onLoadStart={() => setImgLoaded(false)}
                  onLoad={() => setImgLoaded(true)}
                />
                {!imgLoaded && (
                  <View style={styles.photoSkeleton}>
                    <ActivityIndicator color="#bbb" />
                  </View>
                )}
                {isPortrait && (
                  <Pressable style={styles.resizeBtn} onPress={toggleEnlarged}>
                    <Ionicons
                      name={isEnlarged ? "contract-outline" : "resize-outline"}
                      size={20}
                      color="#333"
                    />
                  </Pressable>
                )}
              </View>
              <View style={{ width, height: "100%", position: "relative" }}>
                <MapView
                  ref={mapRef}
                  style={StyleSheet.absoluteFillObject}
                  initialRegion={{
                    latitude: Number(report.latitude),
                    longitude: Number(report.longitude),
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                  mapType={mapType}
                  scrollEnabled={false}
                  zoomEnabled={true}
                  zoomControlEnabled={true}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  onRegionChangeComplete={(newRegion) => {
                    if (report?.latitude && report?.longitude) {
                      mapRef.current?.animateToRegion(
                        {
                          latitude: Number(report.latitude),
                          longitude: Number(report.longitude),
                          latitudeDelta: newRegion.latitudeDelta,
                          longitudeDelta: newRegion.longitudeDelta,
                        },
                        150,
                      );
                    }
                  }}
                >
                  <Marker
                    coordinate={{
                      latitude: Number(report.latitude),
                      longitude: Number(report.longitude),
                    }}
                  />
                </MapView>
                <Pressable
                  style={styles.mapTypeBtn}
                  onPress={() =>
                    setMapType((m) => (m === "standard" ? "satellite" : "standard"))
                  }
                >
                  <Ionicons
                    name={mapType === "standard" ? "earth-outline" : "map-outline"}
                    size={20}
                    color="#333"
                  />
                </Pressable>
              </View>
            </ScrollView>
            <View style={styles.dotsContainer}>
              <View style={[styles.dot, activePage === 0 && styles.activeDot]} />
              <View style={[styles.dot, activePage === 1 && styles.activeDot]} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.mediaContainer, { height: containerHeight }]}>
            <Image
              source={{ uri: report.photo }}
              style={{ width, height: "100%" }}
              onLoadStart={() => setImgLoaded(false)}
              onLoad={() => setImgLoaded(true)}
            />
            {!imgLoaded && (
              <View style={styles.photoSkeleton}>
                <ActivityIndicator color="#bbb" />
              </View>
            )}
            {isPortrait && (
              <Pressable style={styles.resizeBtn} onPress={toggleEnlarged}>
                <Ionicons
                  name={isEnlarged ? "contract-outline" : "resize-outline"}
                  size={20}
                  color="#333"
                />
              </Pressable>
            )}
          </Animated.View>
        )}

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.category}>
              {CATEGORY_LABEL[report.category] ?? report.category}
            </Text>
            <Text style={styles.status}>
              {STATUS_LABEL[report.status] ?? report.status}
            </Text>
          </View>
          <Text style={styles.description}>{report.description}</Text>
          <Text style={styles.meta}>
            Por {report.author.name} •{" "}
            {new Date(report.created_at).toLocaleDateString("es-AR")}
          </Text>
          {(report.latitude || report.address) && (
            <Text style={styles.location}>
              📍{" "}
              {report.latitude
                ? `${report.latitude}, ${report.longitude}`
                : report.address}
            </Text>
          )}
        </View>

        <Pressable style={styles.likeBtn} onPress={handleLike}>
          <Text style={styles.likeBtnText}>
            {report.is_liked ? "♥" : "♡"} {report.like_count}
          </Text>
        </Pressable>

        {/* Status timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historial de estados</Text>
          {(() => {
            // Fecha en que se alcanzó cada estado (la más antigua si hay varias).
            const reachedAt: Record<string, string> = {};
            report.status_history.forEach((h) => {
              reachedAt[h.status] = h.created_at;
            });

            // Índice del paso alcanzado en el flujo principal.
            let reachedIndex = TIMELINE_STEPS.indexOf(
              report.status as (typeof TIMELINE_STEPS)[number],
            );
            if (reachedIndex === -1) {
              // Estado terminal fuera del flujo (cancelado/archivado):
              // marcamos hasta el último paso presente en el historial.
              for (let i = TIMELINE_STEPS.length - 1; i >= 0; i--) {
                if (reachedAt[TIMELINE_STEPS[i]]) {
                  reachedIndex = i;
                  break;
                }
              }
            }
            const isTerminal =
              report.status === "cancelado" || report.status === "archivado";

            return (
              <>
                <View style={styles.timeline}>
                  {TIMELINE_STEPS.map((step, i) => {
                    const completed = i < reachedIndex;
                    const current = i === reachedIndex && !isTerminal;
                    const active = i <= reachedIndex;
                    return (
                      <View key={step} style={styles.tlStep}>
                        {i > 0 && (
                          <View
                            style={[
                              styles.tlLine,
                              styles.tlLineLeft,
                              i <= reachedIndex && styles.tlLineActive,
                            ]}
                          />
                        )}
                        {i < TIMELINE_STEPS.length - 1 && (
                          <View
                            style={[
                              styles.tlLine,
                              styles.tlLineRight,
                              i < reachedIndex && styles.tlLineActive,
                            ]}
                          />
                        )}
                        <View
                          style={[
                            styles.tlDot,
                            active && styles.tlDotActive,
                            current && styles.tlDotCurrent,
                          ]}
                        >
                          {completed && (
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          )}
                          {current && <View style={styles.tlDotInner} />}
                        </View>
                        <Text
                          style={[styles.tlLabel, active && styles.tlLabelActive]}
                        >
                          {STATUS_LABEL[step]}
                        </Text>
                        {reachedAt[step] && (
                          <Text style={styles.tlDate}>
                            {new Date(reachedAt[step]).toLocaleDateString(
                              "es-AR",
                            )}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>

                {isTerminal && (
                  <View style={styles.tlTerminal}>
                    <Ionicons
                      name={
                        report.status === "cancelado"
                          ? "close-circle"
                          : "archive"
                      }
                      size={16}
                      color={report.status === "cancelado" ? "#c62828" : "#546e7a"}
                    />
                    <Text
                      style={[
                        styles.tlTerminalText,
                        {
                          color:
                            report.status === "cancelado"
                              ? "#c62828"
                              : "#546e7a",
                        },
                      ]}
                    >
                      {STATUS_LABEL[report.status]}
                      {reachedAt[report.status]
                        ? ` • ${new Date(
                            reachedAt[report.status],
                          ).toLocaleDateString("es-AR")}`
                        : ""}
                    </Text>
                  </View>
                )}
              </>
            );
          })()}
        </View>

        {/* Comments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Comentarios ({report.comment_count})
          </Text>
          {report.comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <Text style={styles.commentAuthor}>{c.author.name}</Text>
              <Text style={styles.commentText}>{c.text}</Text>
              <Text style={styles.commentDate}>
                {new Date(c.created_at).toLocaleDateString("es-AR")}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.commentInput}>
          <TextInput
            style={styles.commentField}
            placeholder="Escribí un comentario..."
            value={commentText}
            onChangeText={setCommentText}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, submitting && { opacity: 0.6 }]}
            onPress={handleComment}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendBtnText}>Enviar</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  photo: { width: "100%", height: 240 },
  mediaContainer: {
    position: "relative",
    width: "100%",
    height: 240,
  },
  horizontalScroll: {
    width: "100%",
    height: 240,
  },
  photoSkeleton: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#e9edf2",
    justifyContent: "center",
    alignItems: "center",
  },
  dotsContainer: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  activeDot: {
    backgroundColor: "#fff",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  category: { fontWeight: "bold", color: "#1a73e8", fontSize: 15 },
  status: {
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#e8f0fe",
    color: "#1a73e8",
  },
  description: { fontSize: 15, color: "#333", marginBottom: 8, lineHeight: 22 },
  meta: { fontSize: 12, color: "#888" },
  location: { fontSize: 13, color: "#666", marginTop: 6 },
  likeBtn: {
    margin: 16,
    alignSelf: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e53935",
  },
  likeBtnText: { color: "#e53935", fontWeight: "600", fontSize: 16 },
  sectionTitle: { fontWeight: "bold", fontSize: 15, marginBottom: 10 },
  timeline: { flexDirection: "row", marginTop: 6, paddingHorizontal: 4 },
  tlStep: { flex: 1, alignItems: "center" },
  tlLine: {
    position: "absolute",
    top: 11,
    height: 2,
    backgroundColor: "#e0e0e0",
  },
  tlLineLeft: { left: 0, right: "50%" },
  tlLineRight: { left: "50%", right: 0 },
  tlLineActive: { backgroundColor: "#2e7d32" },
  tlDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
  },
  tlDotActive: { backgroundColor: "#2e7d32", borderColor: "#2e7d32" },
  tlDotCurrent: { backgroundColor: "#fff", borderColor: "#2e7d32" },
  tlDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2e7d32",
  },
  tlLabel: {
    fontSize: 11,
    color: "#aaa",
    textAlign: "center",
    marginTop: 6,
  },
  tlLabelActive: { color: "#333", fontWeight: "600" },
  tlDate: { fontSize: 10, color: "#bbb", marginTop: 2 },
  tlTerminal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
  },
  tlTerminalText: { fontSize: 13, fontWeight: "600" },
  comment: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
  },
  commentAuthor: { fontWeight: "600", fontSize: 13, marginBottom: 2 },
  commentText: { fontSize: 14, color: "#333" },
  commentDate: { fontSize: 11, color: "#aaa", marginTop: 4 },
  commentInput: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    marginBottom: 32,
  },
  commentField: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    maxHeight: 80,
  },
  sendBtn: {
    backgroundColor: "#1a73e8",
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
  },
  sendBtnText: { color: "#fff", fontWeight: "600" },
  mapTypeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  resizeBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
