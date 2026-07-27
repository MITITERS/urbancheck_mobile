import type { ReportCategory, ReportStatus } from "../api/reports";

/**
 * Etiquetas, íconos y colores de categorías y estados.
 *
 * Vivían duplicados en cada pantalla (feed, detalle, perfil, alta). Se centralizan
 * acá porque el mapa necesita además un color por categoría para los marcadores, y
 * tener dos fuentes de verdad de los colores era garantía de que se desincronizaran.
 */

export const CATEGORY_LABEL: Record<ReportCategory, string> = {
  bache: "Bache",
  alumbrado: "Alumbrado",
  basura: "Basura",
  semaforo: "Semáforo",
  vereda: "Vereda",
  otro: "Otro",
};

export const CATEGORY_ICON: Record<ReportCategory, string> = {
  bache: "construct-outline",
  alumbrado: "bulb-outline",
  basura: "trash-outline",
  semaforo: "stopwatch-outline",
  vereda: "walk-outline",
  otro: "ellipsis-horizontal-outline",
};

/** Color del marcador en el mapa (US-010: "marcadores de colores por categoría"). */
export const CATEGORY_COLOR: Record<ReportCategory, string> = {
  bache: "#e65100",
  alumbrado: "#f9a825",
  basura: "#2e7d32",
  semaforo: "#c62828",
  vereda: "#6a1b9a",
  otro: "#455a64",
};

export const STATUS_LABEL: Record<ReportStatus, string> = {
  pendiente_validacion: "Pendiente de validación",
  reportado: "Reportado",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  cancelado: "Cancelado",
  archivado: "Archivado",
};

export const STATUS_COLORS: Record<ReportStatus, { bg: string; text: string }> = {
  pendiente_validacion: { bg: "#fff3e0", text: "#ef6c00" },
  reportado: { bg: "#e3f2fd", text: "#1565c0" },
  en_proceso: { bg: "#fffde7", text: "#f57f17" },
  resuelto: { bg: "#e8f5e9", text: "#2e7d32" },
  cancelado: { bg: "#ffebee", text: "#c62828" },
  archivado: { bg: "#eceff1", text: "#546e7a" },
};

/** Orden en que se ofrecen los filtros y el selector de categoría. */
export const CATEGORY_VALUES: ReportCategory[] = [
  "bache",
  "alumbrado",
  "basura",
  "semaforo",
  "vereda",
  "otro",
];

/**
 * Estados que se ofrecen como filtro. Se omiten `cancelado` y `archivado`: no
 * son problemáticas activas y filtrar por ellas no aporta al ciudadano.
 */
export const FILTERABLE_STATUS_VALUES: ReportStatus[] = [
  "pendiente_validacion",
  "reportado",
  "en_proceso",
  "resuelto",
];

export function categoryLabel(value: string): string {
  return CATEGORY_LABEL[value as ReportCategory] ?? value;
}

export function statusLabel(value: string): string {
  return STATUS_LABEL[value as ReportStatus] ?? value;
}

export function statusColors(value: string) {
  return STATUS_COLORS[value as ReportStatus] ?? { bg: "#f5f5f5", text: "#666" };
}

export function categoryColor(value: string): string {
  return CATEGORY_COLOR[value as ReportCategory] ?? CATEGORY_COLOR.otro;
}

export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${day}/${month}/${d.getFullYear()}`;
  } catch {
    return "";
  }
}
