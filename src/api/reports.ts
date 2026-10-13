import { api } from "./client";
import type { Coordinates } from "../location/coordinates";

export type ReportCategory =
  | "bache"
  | "alumbrado"
  | "basura"
  | "semaforo"
  | "vereda"
  | "otro";

export type ReportStatus =
  | "pendiente_validacion"
  | "reportado"
  | "en_proceso"
  // US-046: el operario cierra el trabajo y el reporte queda acá hasta que el
  // autor deja vencer la ventana de objeción (US-047) o la usa apelando
  // (US-048). Quien ejecuta el trabajo no lo certifica solo.
  | "resuelto_pendiente_confirmacion"
  | "resuelto"
  | "cancelado"
  | "archivado";

/**
 * En qué anda el difuminado de una imagen (US-042).
 *
 * Un reporte solo es público cuando llega a `procesada`. En `pendiente` y en
 * `fallida` lo ven únicamente su autor y el panel municipal, así que estos dos
 * valores solo aparecen en el historial propio y en el detalle del autor.
 */
export type PhotoStatus = "pendiente" | "procesada" | "fallida";

export interface ReportAuthor {
  id: number;
  name: string;
  avatar: string | null;
}

export interface StatusHistoryEntry {
  status: ReportStatus;
  created_at: string;
  changed_by: ReportAuthor | null;
}

/**
 * Una comunicación institucional del municipio sobre el reporte (US-024).
 *
 * Responde la **municipalidad**, no una persona: el encabezado lleva el nombre
 * del municipio y la fecha. La identidad individual del agente solo se ve en el
 * panel, con el mismo criterio de protección del personal que US-038 aplica al
 * validador.
 */
export interface OfficialResponse {
  id: number;
  text: string;
  created_at: string;
  /** Nombre de la ciudad del municipio que responde. */
  municipality: string;
}

/**
 * El parte de trabajo con el que un operario cerró el reporte (US-046).
 *
 * Firma el **área operativa**, no la persona: ante el vecino responde la
 * dependencia, con el mismo criterio de protección del personal municipal que
 * se aplica al validador y al agente. La identidad del operario solo se ve en
 * el panel.
 */
export interface ResolutionEvidence {
  id: number;
  /** Nula si se retiró por protección de datos (US-043, escenario 11). */
  photo: string | null;
  photo_removed_at: string | null;
  /** El difuminado de la foto del cierre (US-042, escenario 8). */
  photo_status: PhotoStatus;
  description: string;
  created_at: string;
  /** Nombre del área que ejecutó el trabajo. */
  operational_area: string | null;
}

/** La objeción del autor a un cierre que no resolvió el problema (US-048). */
export interface ResolutionAppeal {
  id: number;
  /** Nula mientras el difuminado no termina (US-042). */
  photo: string | null;
  photo_status: PhotoStatus;
  reason: string;
  created_at: string;
}

export interface Comment {
  id: number;
  author: ReportAuthor;
  text: string;
  created_at: string;
  /** Si lo escribió quien está mirando. Sirve para distinguirlo a la vista. */
  is_mine: boolean;
  /**
   * Si quien mira puede borrarlo: lo escribió, o es su reporte.
   *
   * Son dos derechos distintos —arrepentirse de lo propio, y moderar la propia
   * publicación— y los decide el servidor. La app muestra el botón según esto
   * en lugar de replicar la regla.
   */
  can_delete: boolean;
}

export interface Report {
  id: number;
  /** Nula si se retiró por protección de datos (US-043). */
  photo: string | null;
  /** Cuándo se retiró: es lo que distingue "retirada" de "sin foto". */
  photo_removed_at: string | null;
  /**
   * Hay una denuncia por dato personal sin resolver (US-043). Solo el autor lo
   * ve en `true`: para cualquier otro, un reporte retenido no aparece.
   */
  under_privacy_review: boolean;
  /**
   * El difuminado de la imagen (US-042). Mientras no sea `"procesada"` el
   * reporte no está publicado y `photo` viaja en null: no hay que confundirlo
   * con una foto retirada, que además trae `photo_removed_at`.
   */
  photo_status: PhotoStatus;
  description: string;
  category: ReportCategory;
  latitude: string | null;
  longitude: string | null;
  address: string;
  status: ReportStatus;
  author: ReportAuthor;
  like_count: number;
  comment_count: number;
  created_at: string;
  /** Si el municipio ya se pronunció sobre el reporte (US-024). */
  has_official_response: boolean;
  /**
   * Cuántas veces el autor objetó el cierre (US-048).
   *
   * Un reporte *En proceso* con esto en 1 volvió a gestión porque el vecino
   * objetó la resolución. No es un estado distinto —es el mismo— pero explica
   * por qué está ahí, y `reportStatusLabel()` lo aclara al lado del estado.
   */
  appeal_count: number;
  /** Cuándo se archivó. Nulo mientras no lo esté (US-031). */
  archived_at: string | null;
  /**
   * Cuándo entró a la bandeja del área operativa (US-045). Es la fecha que la
   * bandeja del operario muestra y el criterio con el que el backend la ordena.
   * Nula mientras el reporte no fue asignado.
   */
  area_assigned_at: string | null;
}

export interface ReportDetail extends Report {
  is_liked: boolean;
  comments: Comment[];
  /**
   * El hilo institucional, en orden cronológico (US-024).
   *
   * Viaja aparte de los comentarios a propósito: un compromiso del municipio no
   * es un comentario de un vecino, y la pantalla los presenta como dos bloques
   * distintos para que no puedan confundirse.
   */
  official_responses: OfficialResponse[];
  /**
   * Los partes de trabajo, en orden cronológico. Son más de uno cuando hubo una
   * apelación: el segundo cierre no pisa al primero (US-048, escenario 9).
   */
  resolution_evidences: ResolutionEvidence[];
  resolution_appeals: ResolutionAppeal[];
  /** Hasta cuándo se puede objetar el cierre. Nulo fuera de esa ventana. */
  objection_deadline: string | null;
  /**
   * Si quien mira puede objetar este cierre ahora mismo (US-048).
   *
   * Lo decide el servidor: son tres condiciones —ser el autor, estar en el
   * estado correcto y no haber gastado la única apelación— y replicarlas acá
   * era garantizar que se fueran divergiendo.
   */
  can_appeal: boolean;
  status_history: StatusHistoryEntry[];
  /**
   * Si quien mira puede editar y eliminar este reporte (US-018 y US-019).
   *
   * Lo decide el servidor: hay que ser el autor **y** el reporte todavía tiene
   * que estar en un estado editable —una vez que el municipio lo toma, deja de
   * serlo—. La app no replica esa regla, la consulta.
   */
  can_edit: boolean;
}

/** La municipalidad que cubre la ubicación del vecino, resumida. */
export interface CoverageMunicipality {
  id: number;
  city: string;
  province: string;
}

/**
 * Resultado de ubicar al vecino dentro de las áreas de cobertura.
 *
 * Solo viaja cuando el feed se pidió con coordenadas. Es lo que separa dos
 * respuestas que llegan igual de vacías: `in_coverage: true` es "todavía no hay
 * reportes en tu municipio" y `false` es "no estás dentro del radio de ninguna
 * municipalidad adherida", que se le explican al vecino de forma distinta.
 */
export interface FeedCoverage {
  in_coverage: boolean;
  municipality: CoverageMunicipality | null;
}

export interface PaginatedReports {
  count: number;
  next: string | null;
  previous: string | null;
  results: Report[];
  coverage?: FeedCoverage;
}

/**
 * Feed público, acotado al municipio donde está parado el vecino.
 *
 * Las coordenadas son opcionales y el servidor decide: con ubicación devuelve
 * únicamente los reportes del municipio que la cubre —ninguno si no la cubre
 * ninguno—, y sin ubicación devuelve el feed completo, que es lo que ven las
 * cuentas de trabajo.
 */
/** Búsqueda y filtros del feed y del mapa (US-006 y US-020). */
export interface ReportFilters {
  search?: string;
  categories?: ReportCategory[];
  statuses?: ReportStatus[];
}

/** Agrega los filtros a la consulta. Los vacíos no viajan. */
function appendFilters(params: URLSearchParams, filters: ReportFilters) {
  if (filters.categories?.length) {
    params.set("category", filters.categories.join(","));
  }
  if (filters.statuses?.length) params.set("status", filters.statuses.join(","));
  const search = filters.search?.trim();
  if (search) params.set("search", search);
}

export function listReports(
  page = 1,
  coords: Coordinates | null = null,
  filters: ReportFilters = {},
) {
  const params = new URLSearchParams({ page: String(page) });
  if (coords) {
    params.set("latitude", String(coords.latitude));
    params.set("longitude", String(coords.longitude));
  }
  appendFilters(params, filters);
  return api.get<PaginatedReports>(`/api/reports/?${params}`);
}

export function listMyReports(page = 1) {
  return api.get<PaginatedReports>(`/api/reports/?mine=true&page=${page}`);
}

/**
 * Reportes de una persona, para su perfil público (US-027).
 *
 * No se acota por ubicación: es la obra de alguien, no el feed del barrio. Si
 * esa persona tiene el perfil en privado, el servidor devuelve la lista vacía a
 * cualquiera que no sea ella.
 */
export function listReportsByAuthor(authorId: number, page = 1) {
  return api.get<PaginatedReports>(`/api/reports/?author=${authorId}&page=${page}`);
}

/** Marcadores geolocalizados, sin paginar: el mapa los necesita todos. */
export interface ReportMarker {
  id: number;
  photo: string | null;
  category: ReportCategory;
  status: ReportStatus;
  latitude: string;
  longitude: string;
  address: string;
  like_count: number;
}

export interface MapReports {
  results: ReportMarker[];
  coverage?: FeedCoverage;
}

/**
 * Marcadores del mapa, acotados igual que el feed.
 *
 * Con ubicación el servidor devuelve solo los del municipio que la cubre: el
 * mapa se puede desplazar y hacer zoom, pero lo que muestra sigue siendo el
 * municipio del vecino, no el del vecino de al lado.
 */
export function listMapReports(
  coords: Coordinates | null = null,
  filters: ReportFilters = {},
) {
  const params = new URLSearchParams();
  if (coords) {
    params.set("latitude", String(coords.latitude));
    params.set("longitude", String(coords.longitude));
  }
  appendFilters(params, filters);
  const query = params.toString();
  return api.get<MapReports>(`/api/reports/map/${query ? `?${query}` : ""}`);
}

export function getReport(id: number) {
  return api.get<ReportDetail>(`/api/reports/${id}/`);
}

export function createReport(data: FormData) {
  return api.post<Report>("/api/reports/", data);
}

/**
 * El reclamo que ya describe el problema que se quería reportar (US-032).
 *
 * Trae lo necesario para ofrecer sumarse sin otra llamada: si quien reporta ya
 * lo apoya, si es el autor y a qué distancia está del punto cargado.
 */
export interface ExistingReport extends Report {
  number: number;
  is_liked: boolean;
  is_author: boolean;
  /** Metros hasta el punto que se quiso reportar. */
  distance_meters: number | null;
}

/**
 * Lo que responde el backend cuando el problema ya está reportado: un `409`
 * con código propio. El reporte nuevo **no se creó**.
 */
export interface ReportAlreadyExists {
  status: 409;
  code: "report_already_exists";
  detail: string;
  existing_report: ExistingReport;
}

/**
 * Si el error de `createReport` es que el problema ya estaba reportado.
 *
 * Mira el código y no solo el `409`: otro conflicto no trae el reclamo
 * existente, y tratarlo como este rompería la pantalla que lo muestra.
 */
export function isReportAlreadyExists(
  error: unknown,
): error is ReportAlreadyExists {
  if (!error || typeof error !== "object") return false;
  const data = error as Record<string, unknown>;
  return (
    data.status === 409 &&
    data.code === "report_already_exists" &&
    typeof data.existing_report === "object" &&
    data.existing_report !== null
  );
}

/**
 * Edita un reporte propio (US-018): descripción, categoría y foto.
 *
 * La ubicación no se edita: cambiarla convertiría el reporte en otro distinto y
 * dejaría inconsistente el historial ya registrado. Va como `FormData` porque
 * puede llevar una foto nueva.
 */
export function updateReport(id: number, data: FormData) {
  return api.patch<ReportDetail>(`/api/reports/${id}/`, data);
}

/** Borra un reporte propio (US-019). Solo mientras el municipio no lo tomó. */
export function deleteReport(id: number) {
  return api.delete(`/api/reports/${id}/`);
}

export function likeReport(id: number) {
  return api.post(`/api/reports/${id}/like/`);
}

export function unlikeReport(id: number) {
  return api.delete(`/api/reports/${id}/like/`);
}

export function getComments(id: number) {
  return api.get<Comment[]>(`/api/reports/${id}/comments/`);
}

export function addComment(id: number, text: string) {
  return api.post<Comment>(`/api/reports/${id}/comments/`, { text });
}

/** El acuse de una denuncia por dato personal visible (US-043, escenario 1). */
export interface PrivacyRequestReceipt {
  id: number;
  report: number;
  evidence: number | null;
  reason: "dato_personal";
  status: "pendiente";
  received_at: string;
  deadline: string;
  /** El texto de confirmación, con el plazo tal como lo configura el backend. */
  detail: string;
}

/**
 * Denuncia una imagen que muestra un rostro o una patente sin difuminar
 * (US-043). Sin `evidenceId` es la foto del reporte; con él, la de ese cierre.
 *
 * El reporte queda oculto para todos menos su autor en el mismo momento: no
 * hay umbral, basta esta denuncia.
 */
export function requestPrivacyReview(reportId: number, evidenceId?: number) {
  return api.post<PrivacyRequestReceipt>(
    `/api/reports/${reportId}/privacy-request/`,
    evidenceId === undefined ? {} : { evidence: evidenceId },
  );
}

/**
 * Los dos `409` de la denuncia, por código: ya hay una en curso del mismo
 * vecino sobre esa imagen (escenario 9), o la imagen ya se retiró.
 */
export function privacyRequestConflict(
  error: unknown,
): "privacy_request_pending" | "image_already_removed" | null {
  if (!error || typeof error !== "object") return null;
  const data = error as Record<string, unknown>;
  if (data.status !== 409) return null;
  return data.code === "privacy_request_pending" || data.code === "image_already_removed"
    ? data.code
    : null;
}

/** A quién le llega una denuncia: lo decide su motivo (US-021, escenario 3). */
export type ComplaintRecipient = "agente_municipal" | "admin_plataforma";

/** Un motivo del catálogo del botón *Denunciar* (US-021, escenario 2). */
export interface ComplaintReason {
  value: string;
  label: string;
  recipient: ComplaintRecipient;
}

/** El acuse de una denuncia (US-021, escenario 1). */
export interface ComplaintReceipt {
  id: number;
  report: number;
  reason: string;
  recipient: ComplaintRecipient;
  comment: string;
  received_at: string;
  /**
   * El texto de confirmación, que distingue al destinatario: la revisión del
   * municipio, o el plazo de la RN-12 si el motivo es un dato personal.
   */
  detail: string;
}

/**
 * El catálogo de motivos. Lo sirve el backend para que la app no tenga una
 * copia: el motivo y su destinatario se declaran una sola vez, allá.
 */
export function listComplaintReasons() {
  return api.get<ComplaintReason[]>("/api/reports/complaint-reasons/");
}

/**
 * Denuncia un reporte (US-021). El comentario es opcional y solo se manda si
 * tiene algo.
 *
 * No oculta nada ni cambia el estado del reporte, salvo el motivo de dato
 * personal, que lo retiene hasta que se revisa (US-043).
 */
export function fileComplaint(reportId: number, reason: string, comment = "") {
  const text = comment.trim();
  return api.post<ComplaintReceipt>(
    `/api/reports/${reportId}/complaints/`,
    text ? { reason, comment: text } : { reason },
  );
}

const COMPLAINT_CONFLICTS = [
  "complaint_already_filed",
  "report_not_public",
  "image_already_removed",
] as const;

export type ComplaintConflict = (typeof COMPLAINT_CONFLICTS)[number];

/**
 * Los `409` de una denuncia, por código: ya la presentó por ese motivo
 * (escenario 6), el reporte dejó de estar publicado (escenario 8), o la imagen
 * ya se retiró.
 */
export function complaintConflict(error: unknown): ComplaintConflict | null {
  if (!error || typeof error !== "object") return null;
  const data = error as Record<string, unknown>;
  if (data.status !== 409) return null;
  return COMPLAINT_CONFLICTS.find((code) => code === data.code) ?? null;
}

/** Borra un comentario (US-009). Lo permite su autor o el dueño del reporte. */
export function deleteComment(id: number) {
  return api.delete(`/api/comments/${id}/`);
}

export interface GeocodeResult {
  display_name: string;
  latitude: number;
  longitude: number;
}

export function geocodeAddress(query: string) {
  return api.get<{ results: GeocodeResult[] }>(
    `/api/reports/geocode/?q=${encodeURIComponent(query)}`,
  );
}
