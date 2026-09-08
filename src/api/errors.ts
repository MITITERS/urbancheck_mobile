/**
 * Traduce un error de la API a algo que se le pueda mostrar a una persona.
 *
 * El cliente lanza el cuerpo de la respuesta tal cual —`{"location": "...",
 * "status": 400}`—, así que sin esto las pantallas terminaban haciendo
 * `JSON.stringify` del error y mostrando las llaves, las comillas y el código
 * de estado. Eso no es un aviso: es un volcado.
 *
 * Vive acá y no en cada pantalla porque el formato de error de DRF es uno solo
 * —un campo con su mensaje, `detail`, o `non_field_errors`— y descifrarlo en
 * cada `catch` era garantizar que cada uno lo hiciera un poco distinto.
 */

export type NoticeTone = "warning" | "error";

export interface ApiErrorDescription {
  /** Campo del formulario al que corresponde, si el error apunta a uno. */
  field?: string;
  tone: NoticeTone;
  title: string;
  message: string;
}

/** Claves que no son campos del formulario sino metadatos de la respuesta. */
const NOT_A_FIELD = new Set(["status", "code"]);

const FIELD_TITLES: Record<string, string> = {
  photo: "Revisá la foto",
  avatar: "Revisá la imagen",
  description: "Revisá la descripción",
  category: "Revisá la categoría",
  location: "Revisá la ubicación",
  address: "Revisá la dirección",
  latitude: "Revisá la ubicación",
  longitude: "Revisá la ubicación",
  name: "Revisá el nombre",
  email: "Revisá el email",
};

const NETWORK = {
  tone: "error" as const,
  title: "Sin conexión",
  message:
    "No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.",
};

/**
 * Cómo se ve una falla de red de verdad, según la plataforma.
 *
 * Existe porque antes **cualquier** `Error` se reportaba como "sin conexión", y
 * eso hacía indistinguible un problema de red de uno del dispositivo —una foto
 * que no se pudo leer, un permiso que falló—. El síntoma es el mismo en
 * pantalla y las causas no tienen nada que ver, así que el usuario probaba con
 * otra red y volvía a fallar.
 */
const NETWORK_FAILURES = [
  // React Native, iOS y Android.
  "Network request failed",
  // `fetch` del navegador, que usa el panel.
  "Failed to fetch",
  "NetworkError",
  "Load failed",
];

function isNetworkFailure(error: Error): boolean {
  return NETWORK_FAILURES.some((needle) => error.message.includes(needle));
}

const SESSION_EXPIRED = {
  tone: "error" as const,
  title: "Tu sesión expiró",
  message: "Iniciá sesión de nuevo para continuar.",
};

/** `["mensaje"]` y `"mensaje"` son las dos formas en que DRF manda lo mismo. */
function firstMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstMessage(item);
      if (message) return message;
    }
  }
  return null;
}

export function describeApiError(
  error: unknown,
  fallbackTitle = "Algo salió mal",
): ApiErrorDescription {
  if (error instanceof Error) {
    if (error.message === "SESSION_EXPIRED") return SESSION_EXPIRED;
    if (isNetworkFailure(error)) return NETWORK;
    // Un error del dispositivo —la foto que no se pudo leer, la ubicación que
    // no se pudo obtener— no es un problema de red y decirlo como si lo fuera
    // manda a buscar la causa donde no está. Se muestra lo que realmente pasó.
    return {
      tone: "error",
      title: fallbackTitle,
      message: error.message,
    };
  }

  if (error && typeof error === "object") {
    const data = error as Record<string, unknown>;

    // `detail` y `non_field_errors` hablan de la operación entera, no de un
    // campo: no hay dónde marcarlos en el formulario.
    const general =
      firstMessage(data.detail) ?? firstMessage(data.non_field_errors);
    if (general) {
      return { tone: "error", title: fallbackTitle, message: general };
    }

    for (const [field, value] of Object.entries(data)) {
      if (NOT_A_FIELD.has(field)) continue;
      const message = firstMessage(value);
      if (message) {
        return {
          field,
          // Un error de validación lo puede arreglar quien está mirando la
          // pantalla; no es una falla, es algo para corregir.
          tone: "warning",
          title: FIELD_TITLES[field] ?? fallbackTitle,
          message,
        };
      }
    }
  }

  return {
    tone: "error",
    title: fallbackTitle,
    message: "No pudimos completar la operación. Probá de nuevo en un momento.",
  };
}
