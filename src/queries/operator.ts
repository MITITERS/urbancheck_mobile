/** Consultas del operario. Ver `queries/reports.ts` sobre por qué van aparte. */

import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getAssignedReport,
  listAssignedWork,
  listResolvedWork,
} from "../api/operator";
import { operatorKeys, reportKeys } from "../lib/queryKeys";

/**
 * La bandeja de trabajo, cacheada (US-045).
 *
 * El listado se sigue pidiendo al servidor, pero ya no desde cero cada vez que
 * se entra a la pestaña: la caché devuelve lo último al instante y refresca por
 * detrás si venció. `useRefetchOnFocus()` es lo que dispara ese refresco.
 */
export function useAssignedWork(page = 1) {
  return useQuery({
    queryKey: operatorKeys.list({ page }),
    queryFn: () => listAssignedWork(page),
  });
}

/** Los trabajos que este operario cerró (US-046). */
export function useResolvedWork(page = 1) {
  return useQuery({
    queryKey: operatorKeys.list({ history: true, page }),
    queryFn: () => listResolvedWork(page),
  });
}

/** El detalle de un trabajo. */
export function useAssignedReport(id: number) {
  return useQuery({
    queryKey: operatorKeys.detail(id),
    queryFn: () => getAssignedReport(id),
    enabled: Number.isFinite(id),
  });
}

/**
 * Invalida la bandeja, el historial y el detalle del operario.
 *
 * Lo usa el cierre en terreno: el trabajo cerrado tiene que salir de la bandeja
 * y aparecer en el historial de inmediato, no cuando venza la caché. También
 * toca los reportes, porque el mismo reporte cambió de estado para el vecino.
 */
export function useInvalidateOperatorWork() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: operatorKeys.all });
    void queryClient.invalidateQueries({ queryKey: reportKeys.all });
  };
}
