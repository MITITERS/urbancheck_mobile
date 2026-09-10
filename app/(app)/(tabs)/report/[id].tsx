import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  PanResponder,
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

import { useQueryClient } from "@tanstack/react-query";

import { imageSource } from "../../../../src/api/client";
import {
  addComment,
  deleteComment,
  deleteReport,
  likeReport,
  type Comment,
  type ReportDetail,
  unlikeReport,
} from "../../../../src/api/reports";
import { reportKeys } from "../../../../src/lib/queryKeys";
import { useInvalidateReports, useReport } from "../../../../src/queries/reports";
import { describeApiError } from "../../../../src/api/errors";
import { participatesAsCitizen } from "../../../../src/api/users";
import { useAuth } from "../../../../src/auth/AuthContext";
import { useFloatingTabBarInset } from "../../../../src/components/floatingTabBar";
import { useKeyboardOffset } from "../../../../src/components/useKeyboardVisible";
import {
  STATUS_LABEL,
  reportStatusLabel,
  shortAddress,
} from "../../../../src/reports/labels";
import { canValidateReport } from "../../../../src/validation/canValidateReport";
import { ValidationActions } from "../../../../src/validation/ValidationActions";

// Pasos del flujo principal (happy path) que se van desbloqueando.
//
// El cierre pendiente de confirmación de US-046 es un paso más y no un desvío:
// todo camino a *Resuelto* pasa por ahí, así que la línea de tiempo lo muestra
// como cualquier otro avance en lugar de saltearlo.
const TIMELINE_STEPS = [
  "pendiente_validacion",
  "reportado",
  "en_proceso",
  "resuelto_pendiente_confirmacion",
  "resuelto",
] as const;

// Aire al final del contenido scrolleable. Con el cajón de comentarios fijo
// abajo, el scroll termina donde empieza el cajón: alcanza con un respiro.
const SCROLL_BOTTOM_PADDING = 16;

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
  const { user } = useAuth();
  // La barra de pestañas flota sobre el contenido: sin este espacio reservado,
  // el cajón de comentarios queda debajo de ella y no se puede ni leer ni tocar.
  const tabBarInset = useFloatingTabBarInset();
  // Cuánto tapa el teclado de lo que hay anclado abajo. Ya viene descontado lo
  // que la ventana se achicó sola, si es que se achicó.
  const keyboardOffset = useKeyboardOffset();
  const queryClient = useQueryClient();
  const invalidateReports = useInvalidateReports();
  const query = useReport(Number(id));
  const report = query.data ?? null;

  /** Reescribe el reporte en la caché, que es de donde la pantalla lo lee. */
  const setReport = useCallback(
    (update: (current: ReportDetail | null) => ReportDetail | null) => {
      queryClient.setQueryData(
        reportKeys.detail(Number(id)),
        (current: ReportDetail | undefined) => update(current ?? null) ?? undefined,
      );
    },
    [id, queryClient],
  );

  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  const mapRef = useRef<MapView>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [isEnlarged, setIsEnlarged] = useState(false);
  // Los comentarios arrancan a la vista: esconderlos por defecto se lee como
  // que no hay ninguno. El desplegable es para poder achicar la sección cuando
  // la conversación se hace larga, no para ocultarla.
  const [commentsOpen, setCommentsOpen] = useState(true);
  const chevronSpin = useRef(new Animated.Value(1)).current;
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

  function toggleComments() {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    Animated.timing(chevronSpin, {
      toValue: opening ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

  function toggleEnlarged() {
    Animated.timing(containerHeight, {
      toValue: isEnlarged ? 240 : 420,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setIsEnlarged(!isEnlarged);
  }

  // Al cambiar de reporte se resetea lo que es de la pantalla y no del dato: la
  // foto cargada y la página del carrusel. El reporte en sí lo cambia la caché,
  // porque su clave incluye el id.
  useEffect(() => {
    setImgLoaded(false);
    setActivePage(0);
  }, [id]);

  useEffect(() => {
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

  const loading = query.isPending;

  async function handleLike() {
    if (!report) return;
    try {
      if (report.is_liked) {
        await unlikeReport(report.id);
        setReport((r: ReportDetail | null) =>
          r ? { ...r, is_liked: false, like_count: r.like_count - 1 } : r,
        );
      } else {
        await likeReport(report.id);
        setReport((r: ReportDetail | null) =>
          r ? { ...r, is_liked: true, like_count: r.like_count + 1 } : r,
        );
      }
      // Un me gusta puede **validar el reporte** al cruzar el umbral (US-040):
      // lo que cambia no es solo un contador, es el estado, y eso se ve en el
      // feed, en el mapa y en el perfil. El ajuste local de arriba mueve el
      // corazón en el acto; esto pone al día todo lo demás.
      invalidateReports();
    } catch {
      Alert.alert("Error", "No se pudo procesar el like.");
    }
  }

  async function handleComment() {
    if (!report || !commentText.trim()) return;
    setSubmitting(true);
    try {
      const newComment = await addComment(report.id, commentText.trim());
      setReport((r: ReportDetail | null) =>
        r
          ? {
              ...r,
              comments: [newComment, ...r.comments],
              comment_count: r.comment_count + 1,
            }
          : r,
      );
      setCommentText("");
      // Con la sección plegada, el comentario recién publicado no se vería: se
      // despliega sola, que es donde el usuario lo está buscando.
      if (!commentsOpen) toggleComments();
      // El comentario ya se fue: el teclado no tiene por qué seguir tapando la
      // lista donde el usuario quiere verlo aparecer.
      Keyboard.dismiss();
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

  // US-036: validar, rechazar, o nada. La regla vive en un solo lugar.
  const showValidationActions = canValidateReport({
    user,
    status: report.status,
  });
  // Las cuentas de trabajo leen el reporte y los comentarios de los vecinos,
  // pero no aportan: se esconden los controles, no el contenido.
  const canParticipate = participatesAsCitizen(user);
  /**
   * Cuánto se levanta el cajón de comentarios.
   *
   * Con el teclado cerrado, lo que tiene que esquivar es la barra de pestañas,
   * que flota sobre el contenido. Con el teclado abierto, lo que tapa el
   * teclado: `useKeyboardOffset()` lo mide en lugar de deducirlo de la
   * plataforma, que era lo que fallaba —en Android *edge-to-edge* la ventana no
   * se achica, así que suponer que sí dejaba el cajón debajo del teclado—.
   */
  const composerBottom = keyboardOffset > 0 ? keyboardOffset : tabBarInset;
  const isAuthor = user !== null && user.id === report.author.id;

  function confirmDelete() {
    Alert.alert(
      "¿Eliminar el reporte?",
      "Se borra para siempre, junto con sus comentarios y sus me gusta. No se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => void handleDelete(),
        },
      ],
    );
  }

  function confirmDeleteComment(comment: Comment) {
    Alert.alert(
      "¿Eliminar el comentario?",
      comment.is_mine
        ? "Se borra para siempre."
        : `Se borra el comentario de ${comment.author.name}. No se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => void handleDeleteComment(comment.id),
        },
      ],
    );
  }

  async function handleDeleteComment(commentId: number) {
    try {
      await deleteComment(commentId);
      // Se saca de la lista en el momento, sin volver a pedir el reporte: lo
      // único que cambió es que ese comentario ya no está.
      setReport((prev: ReportDetail | null) =>
        prev === null
          ? prev
          : {
              ...prev,
              comments: prev.comments.filter((c) => c.id !== commentId),
              comment_count: Math.max(0, prev.comment_count - 1),
            },
      );
    } catch (err: unknown) {
      const described = describeApiError(err, "No pudimos eliminar el comentario");
      Alert.alert(described.title, described.message);
    }
  }

  async function handleDelete() {
    try {
      await deleteReport(Number(id));
      invalidateReports();
      router.back();
    } catch (err: unknown) {
      // El servidor lo rechaza si el municipio lo tomó mientras la pantalla
      // estaba abierta: se dice, en vez de quedar como promesa sin atrapar.
      const described = describeApiError(err, "No pudimos eliminar el reporte");
      Alert.alert(described.title, described.message);
    }
  }

  return (
    <View style={{ flex: 1 }} {...swipeBack.panHandlers}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        // Sin ajuste automático de insets: el cajón de comentarios ya no vive
        // acá adentro, así que este scroll no tiene que esquivar el teclado.
        // Lo esquiva el contenedor, que achica esta lista y sube el cajón.
        contentContainerStyle={{
          // Sin cajón —una cuenta de trabajo no comenta— el contenido tiene que
          // dejar libre la barra de pestañas flotante por su cuenta.
          paddingBottom: canParticipate ? SCROLL_BOTTOM_PADDING : tabBarInset,
        }}
        // Con el teclado abierto, el primer toque sobre algo tocable de esta
        // lista solo lo cerraría, sin llegar al elemento. («Enviar» ya no
        // depende de esto: vive fuera del scroll.)
        keyboardShouldPersistTaps="handled"
        // Arrastrar la pantalla cierra el teclado, que es lo que el usuario
        // espera cuando quiere volver a leer los comentarios.
        keyboardDismissMode="on-drag"
      >
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
                  source={imageSource(report.photo)}
                  style={{ width, height: "100%" }}
                  onLoadStart={() => setImgLoaded(false)}
                  onLoad={() => setImgLoaded(true)}
                />
                {!imgLoaded && (
                  <View style={styles.photoSkeleton}>
                    <ActivityIndicator color="#bbb" />
                  </View>
                )}
                {/* Siempre disponible: antes solo aparecía si la foto era
                    vertical, y con una apaisada —o si `Image.getSize` fallaba,
                    que es fácil detrás de un túnel— no había forma de ampliarla. */}
                <Pressable
                  style={styles.resizeBtn}
                  onPress={toggleEnlarged}
                  accessibilityLabel={isEnlarged ? "Achicar la foto" : "Ampliar la foto"}
                >
                  <Ionicons
                    name={isEnlarged ? "contract-outline" : "resize-outline"}
                    size={20}
                    color="#333"
                  />
                </Pressable>
              </View>
              <View style={{ width, height: "100%", position: "relative" }}>
                <MapView
                  ref={mapRef}
                  style={StyleSheet.absoluteFill}
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
              source={imageSource(report.photo)}
              style={{ width, height: "100%" }}
              onLoadStart={() => setImgLoaded(false)}
              onLoad={() => setImgLoaded(true)}
            />
            {!imgLoaded && (
              <View style={styles.photoSkeleton}>
                <ActivityIndicator color="#bbb" />
              </View>
            )}
            <Pressable
              style={styles.resizeBtn}
              onPress={toggleEnlarged}
              accessibilityLabel={isEnlarged ? "Achicar la foto" : "Ampliar la foto"}
            >
              <Ionicons
                name={isEnlarged ? "contract-outline" : "resize-outline"}
                size={20}
                color="#333"
              />
            </Pressable>
          </Animated.View>
        )}

        {showValidationActions && (
          <ValidationActions
            reportId={report.id}
            onCompleted={() => {
              // Validar o rechazar cambia el estado: se refresca el detalle y
              // todo lo que lo lista.
              void query.refetch();
              invalidateReports();
            }}
          />
        )}

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.category}>
              {CATEGORY_LABEL[report.category] ?? report.category}
            </Text>
            <Text style={styles.status}>
              {reportStatusLabel(report)}
            </Text>
          </View>
          <Text style={styles.description}>{report.description}</Text>
          <Text style={styles.meta}>
            Por{" "}
            <Text
              style={styles.authorLink}
              onPress={() => router.push(`/(app)/user/${report.author.id}`)}
              suppressHighlighting
            >
              {report.author.name}
            </Text>{" "}
            • {new Date(report.created_at).toLocaleDateString("es-AR")}
          </Text>
          {/* La dirección primero y las coordenadas solo como último recurso.
              Estaba al revés: con coordenadas cargadas —o sea, casi siempre—
              mostraba «-32.410300, -63.240000», que no le dice nada a nadie, y
              la calle quedaba escondida.

              Va acortada con `shortAddress()`: el geocodificador devuelve la
              jerarquía entera —municipio, pedanía, departamento, provincia,
              país y código postal— y en un renglón esa cola no informa. El
              mapa de acá arriba ya ubica el punto exacto. */}
          {(report.address || report.latitude) && (
            <Text style={styles.location} numberOfLines={2}>
              📍{" "}
              {report.address
                ? shortAddress(report.address)
                : `${report.latitude}, ${report.longitude}`}
            </Text>
          )}
        </View>

        {/* Editar y eliminar son del autor, y solo mientras el reporte sigue
            sin validar —lo confirme un validador en terreno (US-036) o lo
            confirmen los vecinos (US-040)—. Quién y cuándo lo decide el
            servidor con `can_edit`: la app no replica la regla de estados. */}
        {report.can_edit && (
          <View style={styles.ownerActions}>
            <Pressable
              style={styles.ownerBtn}
              onPress={() => router.push(`/(app)/edit-report/${report.id}`)}
            >
              <Ionicons name="create-outline" size={17} color="#1a73e8" />
              <Text style={styles.ownerBtnText}>Editar</Text>
            </Pressable>
            <Pressable
              style={[styles.ownerBtn, styles.ownerBtnDanger]}
              onPress={confirmDelete}
            >
              <Ionicons name="trash-outline" size={17} color="#e53935" />
              <Text style={[styles.ownerBtnText, { color: "#e53935" }]}>Eliminar</Text>
            </Pressable>
          </View>
        )}

        {/* Al autor se le explica por qué dejó de poder editarlo, en lugar de
            que los botones desaparezcan sin motivo.

            No se nombra quién validó: desde US-040 el reporte también se valida
            por las confirmaciones de los vecinos, y decir "un validador" le
            atribuía a una persona algo que no hizo —la misma trampa que el
            aviso de cambio de estado—. */}
        {isAuthor && !report.can_edit && (
          <Text style={styles.ownerLocked}>
            Este reporte ya fue validado, así que no se puede editar ni
            eliminar.
          </Text>
        )}

        {canParticipate ? (
          <Pressable style={styles.likeBtn} onPress={handleLike}>
            <Text style={styles.likeBtnText}>
              {report.is_liked ? "♥" : "♡"} {report.like_count}
            </Text>
          </Pressable>
        ) : (
          // El contador se sigue viendo: es información del reporte. Lo que se
          // saca es poder tocarlo.
          <View style={styles.likeCount}>
            <Text style={styles.likeCountText}>♡ {report.like_count}</Text>
          </View>
        )}

        {/* La evidencia de resolución (US-046) y la objeción del vecino
            (US-048). Va antes que las respuestas oficiales porque es lo último
            que pasó, y con tratamiento propio: un parte de trabajo no es un
            compromiso institucional ni un comentario de un vecino.

            Firma el **área operativa**, no la persona: la identidad del
            operario se ve únicamente en el panel (escenario 12). */}
        {report.resolution_evidences.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resolución del municipio</Text>
            {/* Una sola línea de tiempo, ordenada por fecha. Antes eran dos
                listas seguidas —todos los cierres y después todas las
                objeciones— y con una apelación en el medio el hilo quedaba al
                revés de como pasó: los dos cierres juntos y la objeción al
                final, como si el vecino hubiera objetado el trabajo final.

                El orden real es cierre → objeción → cierre, y así se lee. Se
                ordena por `created_at` y no por el vínculo evidencia-objeción
                porque ese vínculo no viaja en la respuesta del ciudadano; la
                fecha alcanza y es lo que de verdad define la secuencia. */}
            {[
              ...report.resolution_evidences.map((evidence) => ({
                kind: "evidence" as const,
                at: evidence.created_at,
                evidence,
              })),
              ...report.resolution_appeals.map((appeal) => ({
                kind: "appeal" as const,
                at: appeal.created_at,
                appeal,
              })),
            ]
              .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
              .map((entry) =>
                entry.kind === "evidence" ? (
                  <View key={`e${entry.evidence.id}`} style={styles.resolutionCard}>
                    <View style={styles.officialHeader}>
                      <Ionicons name="hammer" size={14} color="#16a34a" />
                      <Text style={styles.resolutionArea}>
                        {entry.evidence.operational_area ?? "Área operativa"}
                      </Text>
                      <Text style={styles.officialDate}>
                        {new Date(entry.evidence.created_at).toLocaleDateString(
                          "es-AR",
                        )}
                      </Text>
                    </View>
                    <Text style={styles.officialText}>
                      {entry.evidence.description}
                    </Text>
                    {entry.evidence.photo && (
                      <Image
                        source={{ uri: entry.evidence.photo }}
                        style={styles.resolutionPhoto}
                      />
                    )}
                  </View>
                ) : (
                  <View key={`a${entry.appeal.id}`} style={styles.appealCard}>
                    <View style={styles.officialHeader}>
                      <Ionicons name="alert-circle" size={14} color="#c62828" />
                      {/* La objeción la ve cualquier vecino, no solo quien la
                          hizo: en segunda persona le decía "objetaste" a todo
                          el que abriera el reporte. Quien objeta es siempre el
                          autor —US-048 no habilita a nadie más—, así que para
                          el resto alcanza con nombrarlo. */}
                      <Text style={styles.appealTitle}>
                        {isAuthor
                          ? "Objetaste este cierre"
                          : "El vecino que reportó objetó el cierre"}
                      </Text>
                      <Text style={styles.officialDate}>
                        {new Date(entry.appeal.created_at).toLocaleDateString(
                          "es-AR",
                        )}
                      </Text>
                    </View>
                    <Text style={styles.officialText}>{entry.appeal.reason}</Text>
                    {/* La foto de la objeción **no se mostraba**, aunque el
                        backend la manda y el vecino la sube al objetar. Es la
                        mitad que faltaba: la gracia del hilo es comparar la
                        foto del cierre con la del estado real. */}
                    {entry.appeal.photo && (
                      <Image
                        source={{ uri: entry.appeal.photo }}
                        style={styles.resolutionPhoto}
                      />
                    )}
                  </View>
                ),
              )}

            {/* El plazo y la acción de objetar son del autor y solo mientras
                corre la ventana. Las dos condiciones las decide el servidor con
                `can_appeal`: la app no replica la regla (US-048). */}
            {/* El plazo se le explica a cada uno desde donde le toca: al
                autor, como algo que puede hacer; al resto, como el estado del
                trámite. Antes le decía "tenés tiempo de objetar" a cualquiera
                que abriera el reporte. */}
            {report.objection_deadline && (
              <Text style={styles.deadline}>
                {isAuthor
                  ? `Tenés tiempo de objetar el cierre hasta el ${new Date(
                      report.objection_deadline,
                    ).toLocaleDateString("es-AR")}. Si no lo objetás, el reporte queda confirmado como resuelto.`
                  : `El vecino que reportó puede objetar el cierre hasta el ${new Date(
                      report.objection_deadline,
                    ).toLocaleDateString("es-AR")}. Si no lo objeta, el reporte queda confirmado como resuelto.`}
              </Text>
            )}
            {report.can_appeal && (
              <Pressable
                style={styles.appealBtn}
                onPress={() => router.push(`/(app)/appeal-report/${report.id}`)}
                accessibilityRole="button"
              >
                <Ionicons name="alert-circle-outline" size={18} color="#c62828" />
                <Text style={styles.appealBtnText}>El problema sigue: objetar</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* El hilo institucional (US-024).
            Va antes del historial y de los comentarios, y con un tratamiento
            visual propio: un compromiso del municipio no es un comentario de un
            vecino ni un parte de trabajo, y el escenario 10 pide justamente que
            los tres bloques no puedan confundirse.
            Quien firma es la municipalidad: la identidad del agente que la
            publicó se ve únicamente en el panel. */}
        {report.official_responses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Respuestas oficiales</Text>
            {report.official_responses.map((response) => (
              <View key={response.id} style={styles.officialCard}>
                <View style={styles.officialHeader}>
                  <Ionicons name="business" size={14} color="#1a73e8" />
                  <Text style={styles.officialMunicipality}>
                    {response.municipality}
                  </Text>
                  <Text style={styles.officialDate}>
                    {new Date(response.created_at).toLocaleDateString("es-AR")}
                  </Text>
                </View>
                <Text style={styles.officialText}>{response.text}</Text>
              </View>
            ))}
          </View>
        )}

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
                      {reportStatusLabel(report)}
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
          {/* El encabezado entero es el control: tocar solo la flecha, que es
              chica, obliga a apuntar. */}
          <Pressable
            style={styles.commentsHeader}
            onPress={toggleComments}
            accessibilityRole="button"
            accessibilityState={{ expanded: commentsOpen }}
            accessibilityLabel={`Comentarios, ${report.comment_count}`}
          >
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
              Comentarios ({report.comment_count})
            </Text>
            <Animated.View
              style={{
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

          {commentsOpen && report.comments.length === 0 && (
            <Text style={styles.noComments}>Todavía no hay comentarios.</Text>
          )}

          {commentsOpen &&
            report.comments.map((c) => (
              <View key={c.id} style={styles.comment}>
                <View style={styles.commentHeader}>
                  <Text
                    style={[styles.commentAuthor, styles.authorLink]}
                    onPress={() => router.push(`/(app)/user/${c.author.id}`)}
                    suppressHighlighting
                  >
                    {c.is_mine ? "Vos" : c.author.name}
                  </Text>
                  {/* Quién puede borrarlo lo decide el servidor con `can_delete`:
                      el autor del comentario, o el dueño de la publicación. */}
                  {c.can_delete && (
                    <Pressable
                      onPress={() => confirmDeleteComment(c)}
                      hitSlop={10}
                      accessibilityLabel="Eliminar comentario"
                    >
                      <Ionicons name="trash-outline" size={16} color="#9ca3af" />
                    </Pressable>
                  )}
                </View>
                <Text style={styles.commentText}>{c.text}</Text>
                <Text style={styles.commentDate}>
                  {new Date(c.created_at).toLocaleDateString("es-AR")}
                </Text>
              </View>
            ))}
        </View>

      </ScrollView>

      {/*
        El cajón vive fuera del scroll y anclado abajo, como el de cualquier
        chat. Adentro, el teclado tapaba lo que se escribía: iOS lleva el campo
        a la vista una sola vez, al enfocarlo, y después el campo crece hacia
        abajo con cada renglón nuevo —por eso empeoraba cuanto más largo era el
        comentario—. Anclado, crece hacia arriba y el cursor nunca se va abajo.
      */}
      {canParticipate && (
        <View style={[styles.commentInput, { marginBottom: composerBottom }]}>
          <TextInput
            style={styles.commentField}
            placeholder="Escribí un comentario..."
            value={commentText}
            onChangeText={setCommentText}
            multiline
            // Al enfocar, la lista se lleva al final: con el teclado abierto el
            // alto útil es la mitad, y sin esto uno escribe mirando la foto en
            // vez de la conversación que está respondiendo. El retraso deja que
            // el teclado termine de subir y el layout ya esté achicado.
            onFocus={() => {
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
            }}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Sin filete lateral: el borde de un solo lado corría el contenido tres
  // píxeles respecto del otro margen —la foto quedaba con 15 a la izquierda y
  // 12 a la derecha— y pisaba la esquina redondeada por la que pasaba. El color
  // ya lo dan el ícono y el título; el contorno completo solo cierra la
  // tarjeta.
  resolutionCard: {
    borderWidth: 1,
    borderColor: "#c8e6c9",
    backgroundColor: "#e8f5e9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 6,
  },
  resolutionArea: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16a34a",
    textTransform: "uppercase",
  },
  resolutionPhoto: {
    width: "100%",
    height: 180,
    borderRadius: 6,
    backgroundColor: "#eceff1",
  },
  appealCard: {
    borderWidth: 1,
    borderColor: "#ffcdd2",
    backgroundColor: "#ffebee",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 6,
  },
  appealTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#c62828",
    textTransform: "uppercase",
  },
  deadline: { fontSize: 13, color: "#78909c", marginTop: 4 },
  appealBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ffcdd2",
    backgroundColor: "#fff5f5",
  },
  appealBtnText: { color: "#c62828", fontWeight: "700", fontSize: 15 },
  officialCard: {
    borderWidth: 1,
    borderColor: "#c6dafc",
    backgroundColor: "#e8f0fe",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 6,
  },
  officialHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  officialMunicipality: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1a73e8",
    textTransform: "uppercase",
  },
  officialDate: { fontSize: 12, color: "#78909c" },
  officialText: { fontSize: 15, lineHeight: 22, color: "#263238" },
  ownerActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  ownerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#e8f0fe",
  },
  ownerBtnDanger: { backgroundColor: "#fce8e6" },
  ownerBtnText: { fontSize: 14, fontWeight: "700", color: "#1a73e8" },
  ownerLocked: {
    paddingHorizontal: 16,
    marginTop: 4,
    fontSize: 12.5,
    color: "#9ca3af",
    lineHeight: 17,
  },
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
    ...StyleSheet.absoluteFill,
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
  commentsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // El área tocable llega hasta los bordes de la sección, no solo al texto.
    paddingVertical: 4,
    marginTop: -4,
  },
  noComments: { fontSize: 13, color: "#9ca3af", marginBottom: 4 },
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
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commentAuthor: { fontWeight: "600", fontSize: 13, marginBottom: 2 },
  // El nombre lleva al perfil público: se marca en el color de acción para que
  // se note que es tocable, sin subrayarlo como un link de web.
  authorLink: { color: "#1a73e8", fontWeight: "600" },
  commentText: { fontSize: 14, color: "#333" },
  commentDate: { fontSize: 11, color: "#aaa", marginTop: 4 },
  likeCount: {
    margin: 16,
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  likeCountText: { fontSize: 16, color: "#6b7280" },
  commentInput: {
    flexDirection: "row",
    // Se alinean abajo: cuando el campo crece con el texto, el botón queda a
    // la altura del último renglón en vez de estirarse con él.
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    // Fuera del scroll, el cajón tiene que pintar su propio fondo.
    backgroundColor: "#fff",
  },
  commentField: {
    flex: 1,
    minHeight: 40,
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
    // Alto explícito: la fila ya no estira sus hijos —se alinean abajo— así
    // que sin esto el botón se encogería al alto de su texto.
    height: 40,
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
