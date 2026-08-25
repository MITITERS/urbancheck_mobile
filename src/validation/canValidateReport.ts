import { canValidate, type UserProfile } from "../api/users";
import type { ReportStatus } from "../api/reports";

interface Params {
  user: UserProfile | null;
  status: ReportStatus | undefined;
  /** Municipalidad del reporte, cuando el detalle la expone. */
  reportMunicipalityId?: number | null;
}

/**
 * Única regla de "se muestran las acciones de validación" (US-036).
 *
 * Es una función pura y no un hook para poder evaluarla después de los early
 * returns de la pantalla de detalle, donde el reporte ya está cargado.
 *
 * Son tres condiciones y viven juntas: el usuario puede validar, el reporte
 * está pendiente de validación, y pertenece a su municipalidad. Repartirlas por
 * la vista es la forma segura de que se desincronicen.
 *
 * El backend vuelve a verificar las tres en cada request: esto solo decide qué
 * se dibuja. Cuando el detalle no informa la municipalidad del reporte, se
 * confía en el filtro por jurisdicción del servidor, que ya la aplica.
 */
export function canValidateReport({
  user,
  status,
  reportMunicipalityId,
}: Params): boolean {
  if (!canValidate(user)) return false;
  if (status !== "pendiente_validacion") return false;
  if (
    reportMunicipalityId !== undefined &&
    reportMunicipalityId !== null &&
    user?.municipality?.id !== reportMunicipalityId
  ) {
    return false;
  }
  return true;
}
