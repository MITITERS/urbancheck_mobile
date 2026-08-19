import { api } from "./client";

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
  /** El backend marca los comentarios propios para habilitar Eliminar. */
  is_mine: boolean;
}

export interface Report {
  id: number;
  photo: string;
  description: string;
  category: ReportCategory;
  status: ReportStatus;
  author: ReportAuthor;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  created_at: string;
  edited_at: string | null;
}

export interface ReportDetail extends Report {
  latitude: string | null;
  longitude: string | null;
  address: string;
  comments: Comment[];
  status_history: StatusHistoryEntry[];
  /** True solo si soy el autor y el reporte todavía admite cambios. */
  can_edit: boolean;
}

/** Marcador del mapa: payload mínimo para pintar el pin y su popup. */
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

export interface PaginatedReports {
  count: number;
  next: string | null;
  previous: string | null;
  results: Report[];
}

export interface ReportFilters {
  categories?: ReportCategory[];
  statuses?: ReportStatus[];
  search?: string;
  mine?: boolean;
  author?: number;
}

// Se arma a mano en vez de con URLSearchParams: el polyfill de React Native es
// parcial y no garantiza toString() en todas las versiones.
function buildQuery(filters: ReportFilters = {}, page?: number): string {
  const parts: string[] = [];
  const add = (key: string, value: string) =>
    parts.push(`${key}=${encodeURIComponent(value)}`);

  if (page != null) add("page", String(page));
  if (filters.categories?.length) add("category", filters.categories.join(","));
  if (filters.statuses?.length) add("status", filters.statuses.join(","));
  if (filters.search?.trim()) add("search", filters.search.trim());
  if (filters.mine) add("mine", "true");
  if (filters.author != null) add("author", String(filters.author));

  return parts.length ? `?${parts.join("&")}` : "";
}

export function listReports(page = 1, filters: ReportFilters = {}) {
  return api.get<PaginatedReports>(`/api/reports/${buildQuery(filters, page)}`);
}

export function listMyReports(page = 1) {
  return api.get<PaginatedReports>(`/api/reports/${buildQuery({ mine: true }, page)}`);
}

export function listUserReports(userId: number, page = 1) {
  return api.get<PaginatedReports>(`/api/reports/${buildQuery({ author: userId }, page)}`);
}

/** Marcadores del mapa. No está paginado: devuelve todos los reportes activos. */
export function listMapMarkers(filters: ReportFilters = {}) {
  return api.get<{ results: ReportMarker[] }>(`/api/reports/map/${buildQuery(filters)}`);
}

export function getReport(id: number) {
  return api.get<ReportDetail>(`/api/reports/${id}/`);
}

export function createReport(data: FormData) {
  return api.post<Report>("/api/reports/", data);
}

/** Edición del autor (US-018). Acepta FormData cuando se reemplaza la foto. */
export function updateReport(
  id: number,
  data: FormData | { description?: string; category?: ReportCategory },
) {
  return api.patch<ReportDetail>(`/api/reports/${id}/`, data);
}

export function deleteReport(id: number) {
  return api.delete<void>(`/api/reports/${id}/`);
}

export interface LikeResponse {
  liked: boolean;
  like_count: number;
}

export function likeReport(id: number) {
  return api.post<LikeResponse>(`/api/reports/${id}/like/`);
}

export function unlikeReport(id: number) {
  return api.delete<LikeResponse>(`/api/reports/${id}/like/`);
}

export function getComments(id: number) {
  return api.get<Comment[]>(`/api/reports/${id}/comments/`);
}

export function addComment(id: number, text: string) {
  return api.post<Comment>(`/api/reports/${id}/comments/`, { text });
}

export function deleteComment(commentId: number) {
  return api.delete<void>(`/api/comments/${commentId}/`);
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
