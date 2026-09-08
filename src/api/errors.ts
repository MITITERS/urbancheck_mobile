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
    return error.message === "SESSION_EXPIRED" ? SESSION_EXPIRED : NETWORK;
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
