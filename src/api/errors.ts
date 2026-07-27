/**
 * La sesión venció o el token ya no es válido.
 *
 * `client.ts` corta la petición con este error y dispara el `signOut` global, que
 * a su vez lleva al login. Las pantallas lo detectan solo para no tapar ese
 * redirect con un mensaje de error genérico.
 */
export function isSessionExpired(error: unknown): boolean {
  return error instanceof Error && error.message === "SESSION_EXPIRED";
}

/** Extrae el `detail` que manda DRF, con un texto de respaldo. */
export function errorDetail(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "detail" in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}
