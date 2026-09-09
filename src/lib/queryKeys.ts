/**
 * Convención de claves de consulta
 * --------------------------------
 * Cada clave es un array que va de lo más general a lo más específico:
 *
 *   [dominio]                    -> todo lo de un dominio
 *   [dominio, 'list']            -> todas las listas de ese dominio
 *   [dominio, 'list', filtros]   -> una lista concreta
 *   [dominio, 'detail', id]      -> un detalle concreto
 *
 * TanStack Query hace match por prefijo, y esa es la razón de esta forma:
 * `invalidateQueries({ queryKey: reportKeys.all })` refresca el feed, el mapa,
 * el detalle y el perfil de una, sin que quien hizo la acción tenga que saber
 * qué pantallas están montadas.
 *
 * Reglas:
 * - Nunca armar una clave a mano en una pantalla: se agrega una fábrica acá.
 * - El objeto de filtros va último y tiene que ser serializable.
 * - La municipalidad no va nunca en una clave: la API ya acota por jurisdicción.
 */

type Filters = Record<string, unknown>;

function domainKeys<const D extends string>(domain: D) {
  return {
    all: [domain] as const,
    lists: () => [domain, "list"] as const,
    list: (filters: Filters = {}) => [domain, "list", filters] as const,
    details: () => [domain, "detail"] as const,
    detail: (id: number | string) => [domain, "detail", id] as const,
  };
}

export const reportKeys = domainKeys("reportes");
export const userKeys = domainKeys("usuarios");
export const notificationKeys = domainKeys("notificaciones");
export const validationKeys = domainKeys("validacion");
export const operatorKeys = domainKeys("operario");

export { domainKeys };
