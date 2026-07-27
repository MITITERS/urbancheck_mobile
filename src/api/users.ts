import { api } from "./client";

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  role: "ciudadano" | "municipal";
  is_public: boolean;
  url: string;
}

/**
 * Perfil público de otro usuario (US-027).
 *
 * Si `is_public` es `false`, el backend devuelve `date_joined` y `report_count`
 * en `null`: solo hay nombre y avatar para mostrar.
 */
export interface PublicProfile {
  id: number;
  name: string;
  avatar: string | null;
  is_public: boolean;
  date_joined: string | null;
  report_count: number | null;
}

export function getMe() {
  return api.get<UserProfile>("/api/users/me/");
}

export function patchMe(data: FormData | { name?: string; is_public?: boolean }) {
  return api.patch<UserProfile>("/api/users/me/", data);
}

export function getPublicProfile(id: number) {
  return api.get<PublicProfile>(`/api/users/${id}/`);
}
