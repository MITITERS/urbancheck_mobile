import {
  useCurrentLocation,
  type CurrentLocation,
  type LocationPermissionState,
} from "../location/useCurrentLocation";

export type { LocationPermissionState };

const DENIED_REASON =
  "Necesitamos tu ubicación para confirmar que estás en el lugar del problema.";
const BLOCKED_REASON =
  "El permiso de ubicación está bloqueado. Habilitalo en los ajustes del sistema para poder validar.";

/**
 * Ubicación del validador (US-036 y US-037).
 *
 * Es `useCurrentLocation` con el texto de esta pantalla: la mecánica del
 * permiso es la misma que la del feed y vive en un solo lugar; lo propio del
 * validador es para qué la pide, y eso es lo que se explica acá.
 *
 * La posición de la lista se toma una vez al entrar; la de la acción de validar
 * se pide fresca y con alta precisión (`getFreshPosition`), porque una posición
 * cacheada de hace minutos no prueba que el validador esté en el lugar.
 */
export function useValidatorLocation(): CurrentLocation {
  return useCurrentLocation({
    deniedReason: DENIED_REASON,
    blockedReason: BLOCKED_REASON,
  });
}
