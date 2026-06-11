import { api } from "./client";

export type ReportCategory =
  | "bache"
  | "alumbrado"
  | "basura"
  | "semaforo"
  | "vereda"
  | "otro";

export type ReportStatus =
  | "reportado"
  | "en_revision"
  | "en_proceso"
  | "resuelto"
  | "rechazado";

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

export interface PaginatedReports {
  count: number;
  next: string | null;
  previous: string | null;
  results: Report[];
}

export function listReports(page = 1) {
  return api.get<PaginatedReports>(`/api/reports/?page=${page}`);
}

export function listMyReports(page = 1) {
  return api.get<PaginatedReports>(`/api/reports/?mine=true&page=${page}`);
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
