import { api } from "./client";
import type { ReportAuthor } from "./reports";

export type NotificationKind = "nuevo_comentario" | "cambio_estado" | "nuevo_like";

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  actor: ReportAuthor | null;
  /** Reporte al que navega el aviso. Null si el aviso no está ligado a uno. */
  report_id: number | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface PaginatedNotifications {
  count: number;
  next: string | null;
  previous: string | null;
  results: AppNotification[];
}

export function listNotifications(page = 1, unreadOnly = false) {
  const unread = unreadOnly ? "&unread=true" : "";
  return api.get<PaginatedNotifications>(`/api/notifications/?page=${page}${unread}`);
}

export function getUnreadCount() {
  return api.get<{ unread: number }>("/api/notifications/unread_count/");
}

export function markNotificationRead(id: number) {
  return api.post<AppNotification>(`/api/notifications/${id}/read/`);
}

export function markAllNotificationsRead() {
  return api.post<{ updated: number }>("/api/notifications/read_all/");
}

export function deleteNotification(id: number) {
  return api.delete<void>(`/api/notifications/${id}/`);
}
