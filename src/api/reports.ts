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
  | "resuelto"
  | "cancelado"
  | "archivado";

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
  photo: string;
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
}

export interface ReportDetail extends Report {
  is_liked: boolean;
  comments: Comment[];
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
export function listReports(page = 1, coords: Coordinates | null = null) {
  const params = new URLSearchParams({ page: String(page) });
  if (coords) {
    params.set("latitude", String(coords.latitude));
    params.set("longitude", String(coords.longitude));
  }
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
  photo: string;
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
export function listMapReports(coords: Coordinates | null = null) {
  const params = new URLSearchParams();
  if (coords) {
    params.set("latitude", String(coords.latitude));
    params.set("longitude", String(coords.longitude));
  }
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
