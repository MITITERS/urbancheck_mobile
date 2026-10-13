import { api } from "./client";
import type { Coordinates } from "../location/coordinates";
import type { ReportDetail } from "./reports";

/**
 * Cierre del operario y objeción del ciudadano (US-046 y US-048).
 *
 * Las dos operaciones suben una foto, así que viajan como `multipart`: el
 * cliente detecta el `FormData` y no le pone `Content-Type` a mano.
 */

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

/**
 * El operario registra la resolución del trabajo.
 *
 * Las coordenadas son obligatorias y el servidor las verifica contra el lugar
 * del reporte: la app las valida antes de subir la foto para no hacer esperar
 * una carga que después se rechaza, pero la decisión es del backend.
 */
export function registerResolution(
  id: number,
  { photo, description, coords }: {
    photo: { uri: string; name: string; type: string };
    description: string;
    coords: Coordinates;
  },
) {
  const body = new FormData();
  // El cast es el que exige React Native para adjuntar un archivo local a un
  // FormData: la firma web de `append` no contempla esta forma.
  body.append("photo", photo as unknown as Blob);
  body.append("description", description);
  body.append("latitude", String(coords.latitude));
  body.append("longitude", String(coords.longitude));
  return api.post<ReportDetail>(`/api/operator/reports/${id}/resolve/`, body);
}

/** El autor objeta el cierre: motivo y foto del estado actual, los dos obligatorios. */
export function appealResolution(
  id: number,
  { photo, reason }: {
    photo: { uri: string; name: string; type: string };
    reason: string;
  },
) {
  const body = new FormData();
  body.append("photo", photo as unknown as Blob);
  body.append("reason", reason);
  return api.post<ReportDetail>(`/api/reports/${id}/appeal/`, body);
}
