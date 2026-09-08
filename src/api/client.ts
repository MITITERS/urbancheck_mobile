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

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (_sessionToken) {
    headers["X-Session-Token"] = _sessionToken;
  }

  // Only set Content-Type for JSON bodies; multipart/FormData sets its own boundary
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 410) {
    _onUnauthorized?.();
    throw new Error("SESSION_EXPIRED");
  }

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }
    if (errorData && typeof errorData === "object") {
      errorData.status = response.status;
    }
    throw errorData;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
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
