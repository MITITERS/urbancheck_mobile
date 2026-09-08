import { api } from "./client";
import type { ReportAuthor, ReportStatus } from "./reports";

/**
 * Los tipos de aviso que emite el backend, espejo de `Notification.Kind`.
 *
 * **Si allá se agrega uno, hay que agregarlo acá.** No por el tipo en sí —el
 * `string` llega igual— sino porque la bandeja los rotula con un ícono por
 * tipo, y hasta que existió el respaldo de `KIND_STYLE` un tipo desconocido
 * rompía la pantalla entera.
 */
export type NotificationKind =
  | "nuevo_comentario"
  | "nuevo_like"
  | "cambio_estado"
  // Comunicación institucional del municipio sobre el reporte (US-024).
  | "respuesta_oficial"
  // Aviso previo al archivado por inactividad (US-031).
  | "proximo_archivado"
  // Aviso previo a que venza el plazo para objetar un cierre (US-047).
  | "proxima_confirmacion"
  // Le llega al agente y al operario cuando el vecino objeta (US-048).
  | "apelacion_cierre";

export interface Notification {
  id: number;
  kind: NotificationKind;
  actor: ReportAuthor | null;
  report_id: number | null;
  message: string;
  /** Solo en los avisos de cambio de estado; vacío en los sociales. */
  previous_status: ReportStatus | "";
  new_status: ReportStatus | "";
  reason: string;
  is_read: boolean;
  created_at: string;
}

export interface PaginatedNotifications {
  count: number;
  next: string | null;
  previous: string | null;
  results: Notification[];
}

export function listNotifications(page = 1) {
  return api.get<PaginatedNotifications>(`/api/notifications/?page=${page}`);
}

export function markNotificationRead(id: number) {
  return api.post<Notification>(`/api/notifications/${id}/read/`);
}

export function markAllNotificationsRead() {
  return api.post<{ updated: number }>("/api/notifications/read_all/");
}

/** Contador del badge de la pestaña de avisos: incluye los dos tipos. */
export function getUnreadCount() {
  return api.get<{ unread: number }>("/api/notifications/unread_count/");
}

export interface NotificationPreference {
  kind: NotificationKind;
  label: string;
  description: string;
  /** "social" o "estado": la pantalla agrupa por esto. */
  group: string;
  enabled: boolean;
}

export function getNotificationPreferences() {
  return api.get<NotificationPreference[]>("/api/notification-preferences/");
}

export function setNotificationPreference(kind: NotificationKind, enabled: boolean) {
  return api.patch<NotificationPreference[]>("/api/notification-preferences/", {
    kind,
    enabled,
  });
}
