import { QueryClient } from "@tanstack/react-query";

/** Un 4xx no se arregla reintentando: solo se reintentan red y 5xx. */
const MAX_RETRIES = 2;

const CLIENT_ERROR_MIN = 400;
const CLIENT_ERROR_MAX = 500;

/**
 * Cuánto tiempo un dato se considera fresco antes de refrescarlo por detrás.
 *
 * Treinta segundos, igual que el panel. Es lo que hace que volver a una pestaña
 * muestre lo que ya se tenía **al instante** en lugar de un spinner: dentro de
 * la ventana no se pide nada, y fuera de ella se pide en segundo plano mientras
 * se sigue viendo lo anterior.
 */
export const DEFAULT_STALE_TIME_MS = 30_000;

/**
 * Cuánto sobrevive en memoria un dato que ya nadie mira.
 *
 * Cinco minutos. En una app de pestañas uno entra y sale de la misma pantalla
 * todo el tiempo: con una ventana corta el feed se descartaría entre visitas y
 * volvería a arrancar de cero, que es justo lo que se quiere evitar.
 */
export const DEFAULT_GC_TIME_MS = 5 * 60_000;

/**
 * El cliente lanza el cuerpo de la respuesta con `status` adentro (ver
 * `api/client.ts`), no una clase de error propia. Por eso se mira la forma.
 */
function statusOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  const status = statusOf(error);
  if (status !== null && status >= CLIENT_ERROR_MIN && status < CLIENT_ERROR_MAX) {
    return false;
  }
  return true;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        gcTime: DEFAULT_GC_TIME_MS,
        retry: shouldRetry,
        // En React Native no hay ventana que enfocar: el equivalente es volver
        // a la pantalla, y de eso se ocupa `useRefetchOnFocus()`. Dejarlo en
        // `true` acá no haría nada y confundiría a quien lo lea.
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Una escritura fallida no se reintenta sola: decide la persona.
        retry: false,
      },
    },
  });
}

export const queryClient = createQueryClient();
