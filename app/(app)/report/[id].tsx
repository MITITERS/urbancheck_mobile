import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  addComment,
  getReport,
  likeReport,
  type ReportDetail,
  unlikeReport,
} from "../../../src/api/reports";

const STATUS_LABEL: Record<string, string> = {
  reportado: "Reportado",
  en_revision: "En revisión",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  rechazado: "Rechazado",
};

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
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetchReport();
  }, [id]);

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
    >
      <ScrollView style={styles.container}>
        <Image source={{ uri: report.photo }} style={styles.photo} />

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

        {/* Status history */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historial de estados</Text>
          {report.status_history.map((h, i) => (
            <View key={i} style={styles.historyItem}>
              <Text style={styles.historyStatus}>
                {STATUS_LABEL[h.status] ?? h.status}
              </Text>
              <Text style={styles.historyMeta}>
                {new Date(h.created_at).toLocaleDateString("es-AR")}
                {h.changed_by ? ` • ${h.changed_by.name}` : ""}
              </Text>
            </View>
          ))}
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
  historyItem: { marginBottom: 8 },
  historyStatus: { fontWeight: "600", fontSize: 13 },
  historyMeta: { fontSize: 12, color: "#888" },
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
});
