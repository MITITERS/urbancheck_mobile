/**
 * Consultas de reportes: la caché por encima del transporte.
 *
 * Viven aparte de `api/reports.ts` a propósito. Ese módulo sabe hablar con el
 * servidor y nada más; este sabe cuándo hace falta preguntarle. Separarlos deja
 * probar cada capa por su lado —un test puede sustituir el fetcher y seguir
 * ejerciendo el hook de verdad, que es imposible cuando los dos viven en el
 * mismo archivo y el hook llama al fetcher por referencia interna—.
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getReport,
  likeReport,
  listMapReports,
  listMyReports,
  listReports,
  listReportsByAuthor,
  unlikeReport,
  type ReportFilters,
} from "../api/reports";
import type { Coordinates } from "../location/coordinates";
import { reportKeys, userKeys } from "../lib/queryKeys";

/**
 * El feed, cacheado por página, ubicación y filtros.
 *
 * Los tres van en la clave porque los tres cambian el resultado: dos filtros
 * distintos son dos listas distintas, y compartirles la entrada haría que al
 * cambiar de filtro se viera un instante la lista anterior como si fuera la
 * nueva.
 */
export function useReports(
  page = 1,
  coords: Coordinates | null = null,
  filters: ReportFilters = {},
) {
  return useQuery({
    queryKey: reportKeys.list({ page, coords, filters }),
    queryFn: () => listReports(page, coords, filters),
  });
}

/** Los marcadores del mapa, con el mismo recorte que el feed. */
export function useMapReports(
  coords: Coordinates | null = null,
  filters: ReportFilters = {},
  enabled = true,
) {
  return useQuery({
    queryKey: reportKeys.list({ map: true, coords, filters }),
    queryFn: () => listMapReports(coords, filters),
    enabled,
  });
}

/** Lo que reportó quien mira, para su perfil. */
export function useMyReports(page = 1, enabled = true) {
  return useQuery({
    queryKey: reportKeys.list({ mine: true, page }),
    queryFn: () => listMyReports(page),
    enabled,
  });
}

/** Lo que reportó otra persona, para su perfil público (US-027). */
export function useReportsByAuthor(authorId: number, page = 1, enabled = true) {
  return useQuery({
    queryKey: reportKeys.list({ author: authorId, page }),
    queryFn: () => listReportsByAuthor(authorId, page),
    enabled: enabled && Number.isFinite(authorId),
  });
}

/** El detalle de un reporte. */
export function useReport(id: number) {
  return useQuery({
    queryKey: reportKeys.detail(id),
    queryFn: () => getReport(id),
    enabled: Number.isFinite(id),
  });
}

/**
 * Dar y sacar me gusta, con todo lo que depende de eso al día.
 *
 * Invalida el dominio entero de reportes y no solo el detalle: el mismo reporte
 * aparece en el feed, en el mapa y en dos perfiles, y el contador tiene que
 * coincidir en los cuatro lugares. Además, un me gusta puede **validar el
 * reporte** al cruzar el umbral (US-040), así que lo que cambia no es solo un
 * número: es el estado.
 */
export function useToggleLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, liked }: { id: number; liked: boolean }) =>
      liked ? unlikeReport(id) : likeReport(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}

/**
 * Invalida todo lo que muestra reportes.
 *
 * Lo usan las pantallas que escriben desde fuera del listado —crear, editar,
 * borrar, cerrar, objetar— para que al volver no haya que esperar el
 * `staleTime`: lo que cambió se ve al instante.
 */
export function useInvalidateReports() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: reportKeys.all });
    // El perfil muestra contadores que salen de los reportes.
    void queryClient.invalidateQueries({ queryKey: userKeys.all });
  };
}

/**
 * El feed con su paginación, cacheado entero.
 *
 * Va con `useInfiniteQuery` y no con una consulta por página porque las páginas
 * del feed son **una sola lista**: al volver a la pestaña hay que recuperar
 * todo lo que se venía scrolleando, no la primera página. Antes se perdía —el
 * estado vivía en la pantalla— y había que volver a bajar desde arriba.
 *
 * La ubicación y los filtros van en la clave: dos filtros distintos son dos
 * listas distintas, y compartirles la entrada mostraría un instante la lista
 * anterior como si fuera la nueva.
 */
export function useInfiniteReports(
  coords: Coordinates | null,
  filters: ReportFilters,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: reportKeys.list({ feed: true, coords, filters }),
    queryFn: ({ pageParam }) => listReports(pageParam, coords, filters),
    initialPageParam: 1,
    // `next` es la URL de la siguiente; alcanza con saber si existe.
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
    enabled,
  });
}
