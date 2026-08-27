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
