import { api } from "./client";
import type { Report, ReportDetail } from "./reports";

/**
 * Bandeja de trabajo del operario (US-045).
 *
 * El área y la municipalidad **no** viajan como parámetro: las resuelve el
 * servidor desde el usuario autenticado. Por eso este módulo no recibe ningún
 * identificador de área — si lo recibiera, la app estaría en condiciones de
 * pedir el trabajo de otra.
 */
export interface PaginatedWork {
  count: number;
  next: string | null;
  previous: string | null;
  results: Report[];
}

/**
 * Los reportes En proceso asignados al área del operario, del más demorado al
 * más reciente. El orden y el filtro los aplica el backend.
 */
export function listAssignedWork(page = 1) {
  return api.get<PaginatedWork>(`/api/operator/reports/?page=${page}`);
}

/**
 * El detalle de un trabajo de la bandeja.
 *
 * Un reporte que no está asignado al área del operario responde 404, con el
 * mismo criterio de US-034: no existe para él.
 */
export function getAssignedReport(id: number) {
  return api.get<ReportDetail>(`/api/operator/reports/${id}/`);
}

/**
 * Un trabajo que el operario ya cerró, para su historial (US-046).
 *
 * `resolved_at` es la fecha de **su** último cierre sobre ese reporte, y no
 * `closed_at` del reporte: después de una apelación el cierre siguiente puede
 * ser de otro operario del área, y el historial es de la persona.
 */
export type ResolvedWork = Report & { resolved_at: string };

export interface PaginatedResolvedWork {
  count: number;
  next: string | null;
  previous: string | null;
  results: ResolvedWork[];
}

/**
 * Los reportes que este operario cerró, del último al primero.
 *
 * El equivalente de «Mis reportes» del vecino: el vecino ve lo que reportó, el
 * operario lo que resolvió. Igual que la bandeja, no recibe ningún
 * identificador: quién cerró lo resuelve el servidor desde la sesión.
 *
 * El estado que trae cada fila es el **actual**, no el del momento del cierre:
 * un trabajo que el vecino objetó volvió a *En proceso* (US-048) y tiene que
 * verse así también acá.
 */
export function listResolvedWork(page = 1) {
  return api.get<PaginatedResolvedWork>(
    `/api/operator/reports/history/?page=${page}`,
  );
}
