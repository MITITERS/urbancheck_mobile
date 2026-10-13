import type { Report } from "../api/reports";
import { participatesAsCitizen, type UserProfile } from "../api/users";

/** Los estados en que un reporte ya salió del feed y del mapa. */
const NOT_PUBLIC_STATUSES: readonly Report["status"][] = ["cancelado", "archivado"];

/**
 * Si a `user` se le ofrece denunciar `report` (US-021, escenarios 7, 8 y 10).
 *
 * No se ofrece sobre el reporte propio —para retirarlo el autor tiene la
 * eliminación de US-019—, ni sobre uno cancelado, archivado o retirado, que ya
 * no es público, ni a las cuentas de trabajo, que usan su cuenta personal.
 *
 * El servidor rechaza los tres casos igual: esto solo evita dibujar un botón
 * que después contesta con un error. Vive en un solo lugar porque la acción
 * está en el feed y en el detalle, y dos copias terminan divergiendo.
 */
export function canReportReport(
  report: Pick<Report, "author" | "status" | "photo_removed_at">,
  user: UserProfile | null,
): boolean {
  if (!participatesAsCitizen(user) || user === null) return false;
  if (user.id === report.author.id) return false;
  if (report.photo_removed_at) return false;
  return !NOT_PUBLIC_STATUSES.includes(report.status);
}
