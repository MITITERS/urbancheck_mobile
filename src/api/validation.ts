import { api } from "./client";
import type { Coordinates } from "../location/coordinates";
import type { ReportAuthor, ReportCategory, ReportStatus } from "./reports";

/** Un reporte de la bandeja de pendientes de validación (US-037). */
export interface PendingReport {
  id: number;
  photo: string;
  category: ReportCategory;
  description: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  status: ReportStatus;
  created_at: string;
  /** Nula cuando no se enviaron coordenadas: la pantalla funciona sin permiso. */
  distance_meters: number | null;
  author: ReportAuthor;
}

export interface PaginatedPending {
  count: number;
  next: string | null;
  previous: string | null;
  results: PendingReport[];
}

/**
 * Re-exportada para no romper los usos existentes: la forma es la misma que
 * consume el feed acotado por ubicación, así que la definición vive en
 * `src/location/coordinates.ts` y no en la API de validación.
 */
export type { Coordinates };

/** Error específico de "estás demasiado lejos", con la distancia real. */
export interface TooFarError {
  code: "too_far";
  detail: string;
  distance_meters: number;
  radius_meters: number;
}

export function isTooFarError(error: unknown): error is TooFarError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "too_far"
  );
}

export function listPendingValidation(coords: Coordinates | null, page = 1) {
  const params = new URLSearchParams({ page: String(page) });
  if (coords) {
    params.set("latitude", String(coords.latitude));
    params.set("longitude", String(coords.longitude));
  }
  return api.get<PaginatedPending>(`/api/validation/reports/?${params}`);
}

export function validateReport(id: number, coords: Coordinates) {
  return api.post<PendingReport>(`/api/validation/reports/${id}/validate/`, coords);
}

export function rejectReport(id: number, coords: Coordinates, reason: string) {
  return api.post<PendingReport>(`/api/validation/reports/${id}/reject/`, {
    ...coords,
    reason,
  });
}

/** "320 m" por debajo del kilómetro, "1.4 km" por encima. */
export function formatDistance(meters: number | null): string | null {
  if (meters === null) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
