const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

/** Si la API se alcanza por un túnel de desarrollo (ver `imageSource`). */
const TUNNELED_API = /ngrok|trycloudflare|loca\.lt/.test(BASE_URL);

let _sessionToken: string | null = null;
let _onUnauthorized: (() => void) | null = null;

export function setSessionToken(token: string | null) {
  _sessionToken = token;
}

export function setUnauthorizedHandler(handler: () => void) {
  _onUnauthorized = handler;
}

/** Cabeceras comunes a los dos transportes. */
function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extra,
  };
  if (_sessionToken) {
    headers["X-Session-Token"] = _sessionToken;
  }
  return headers;
}

/**
 * Traduce una respuesta ya leída al contrato que esperan las pantallas.
 *
 * Lo comparten `fetch` y `XMLHttpRequest` para que una misma respuesta del
 * servidor produzca exactamente el mismo error por los dos caminos: si cada
 * transporte armara el suyo, un 400 se vería distinto según hubiera foto o no.
 */
function resolveResponse<T>(status: number, statusText: string, text: string): T {
  if (status === 401 || status === 410) {
    _onUnauthorized?.();
    throw new Error("SESSION_EXPIRED");
  }

  if (status < 200 || status >= 300) {
    let errorData: any;
    try {
      errorData = JSON.parse(text);
    } catch {
      errorData = { detail: statusText };
    }
    if (errorData && typeof errorData === "object") {
      errorData.status = status;
    }
    throw errorData;
  }

  if (status === 204 || text === "") {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

/**
 * Sube un `FormData` por `XMLHttpRequest` en lugar de `fetch`.
 *
 * **No es una preferencia de estilo: con `fetch` no se puede subir un archivo.**
 * Desde el SDK 57 Expo reemplaza el `fetch` global por el suyo, que arma el
 * multipart en JavaScript y solo entiende `string`, `Blob` u objetos con
 * `bytes`. La forma propia de React Native para un archivo local —`{ uri, name,
 * type }`, la que devuelven la cámara y la galería— cae en su `throw`:
 * *Unsupported FormDataPart implementation*.
 *
 * `XMLHttpRequest` va directo al módulo de red nativo, que sí la entiende y
 * además **transmite el archivo desde el disco** en vez de cargarlo entero en
 * memoria. Expo no lo reemplaza.
 *
 * Existe la variable `EXPO_PUBLIC_USE_RN_FETCH=1`, que devuelve el `fetch` de
 * React Native y está puesta en el `.env`. **No alcanza**: en Expo Go los
 * valores del `.env` viven en un módulo que se evalúa después del runtime de
 * Expo, así que cuando este lee la variable todavía vale `undefined` y termina
 * instalando su `fetch` igual. Solo funciona en un build de producción, donde
 * el valor se incrusta. Este camino no depende de ese orden.
 */
function upload<T>(
  path: string,
  method: string,
  body: FormData,
  headers: Record<string, string>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${BASE_URL}${path}`);
    // Sin `Content-Type`: lo pone XHR con el `boundary` del multipart, y
    // fijarlo a mano rompe el cuerpo.
    Object.entries(headers).forEach(([name, value]) =>
      xhr.setRequestHeader(name, value),
    );
    xhr.onload = () => {
      try {
        resolve(resolveResponse<T>(xhr.status, xhr.statusText, xhr.responseText));
      } catch (error) {
        reject(error);
      }
    };
    // El mensaje es el de `fetch`, a propósito: `describeApiError` lo reconoce
    // como falla de red y lo cuenta como tal.
    xhr.onerror = () => reject(new Error("Network request failed"));
    xhr.ontimeout = () => reject(new Error("Network request failed"));
    xhr.send(body);
  });
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = buildHeaders(options.headers as Record<string, string>);

  if (options.body instanceof FormData) {
    return upload<T>(path, options.method ?? "POST", options.body, headers);
  }

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = response.status === 204 ? "" : await response.text();
  return resolveResponse<T>(response.status, response.statusText, text);
}

/**
 * `source` para una imagen que sirve el backend.
 *
 * Existe por el túnel de desarrollo: **ngrok responde su página de aviso en
 * lugar del archivo** cuando el `User-Agent` parece un navegador, y ahí la foto
 * llega como HTML y no se ve. El header `ngrok-skip-browser-warning` lo saltea.
 *
 * Solo se agrega cuando la API apunta a un túnel: en producción no hay ningún
 * intermediario que interpretar, y un header de más no tiene por qué viajar.
 * Las imágenes locales (una foto recién elegida del carrete) no lo necesitan,
 * pero tampoco les molesta.
 */
export function imageSource(uri: string) {
  return TUNNELED_API
    ? { uri, headers: { "ngrok-skip-browser-warning": "1" } }
    : { uri };
}

export function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error(`Failed to load file: ${uri}`));
    xhr.responseType = "blob";
    xhr.open("GET", uri);
    xhr.send();
  });
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
