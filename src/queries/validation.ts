/** Consultas de validación. Ver `queries/reports.ts` sobre por qué van aparte. */

import { useQuery } from "@tanstack/react-query";

import { listPendingValidation } from "../api/validation";
import type { Coordinates } from "../location/coordinates";
import { validationKeys } from "../lib/queryKeys";

/**
 * La bandeja de pendientes del validador (US-037).
 *
 * La ubicación va en la clave porque ordena el resultado: la lista viene por
 * cercanía, así que la de otro punto es otra lista.
 */
export function usePendingValidation(
  coords: Coordinates | null,
  page = 1,
  enabled = true,
) {
  return useQuery({
    queryKey: validationKeys.list({ coords, page }),
    queryFn: () => listPendingValidation(coords, page),
    enabled,
  });
}
