import type { ReportCategory, ReportStatus } from "../api/reports";

export const CATEGORY_LABEL: Record<ReportCategory, string> = {
  bache: "Bache",
  alumbrado: "Alumbrado",
  basura: "Basura",
  semaforo: "Semáforo",
  vereda: "Vereda",
  otro: "Otro",
};

export const STATUS_LABEL: Record<ReportStatus, string> = {
  pendiente_validacion: "Pendiente de validación",
  reportado: "Reportado",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  cancelado: "Cancelado",
  archivado: "Archivado",
};

/**
 * Color del marcador según el estado.
 *
 * El de "pendiente de validación" es el que más importa distinguir: es el que
 * el validador tiene que salir a verificar.
 */
export const STATUS_COLOR: Record<ReportStatus, string> = {
  pendiente_validacion: "#f59e0b",
  reportado: "#1a73e8",
  en_proceso: "#7c3aed",
  resuelto: "#16a34a",
  cancelado: "#dc2626",
  archivado: "#9ca3af",
};

/** Estados que se dibujan en el mapa; el backend ya excluye el resto. */
export const MAPPED_STATUSES: ReportStatus[] = [
  "pendiente_validacion",
  "reportado",
  "en_proceso",
  "resuelto",
];

/**
 * Cuántos tramos de la dirección se muestran cuando hay que acortarla.
 *
 * Tres alcanzan para ubicar el reporte —«442, La Rioja, General Güemes»— y el
 * resto es lo que agrega el geocodificador: municipio, pedanía, departamento,
 * provincia, país y código postal. En una ficha de dos renglones esa cola no
 * informa y empuja el alto.
 */
const ADDRESS_PARTS = 3;

/** La dirección, sin la cola administrativa del geocodificador. */
export function shortAddress(value: string | null | undefined): string {
  if (!value) return "";
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.slice(0, ADDRESS_PARTS).join(", ");
}
