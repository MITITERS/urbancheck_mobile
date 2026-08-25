import { api } from "./client";

export type UserRole =
  | "ciudadano"
  | "validador"
  | "agente_municipal"
  | "admin_plataforma";

export interface Municipality {
  id: number;
  name: string;
  locality?: string;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  role: UserRole;
  /** Nula para ciudadanos: solo el personal municipal tiene jurisdicción. */
  municipality: Municipality | null;
  /** Mientras sea true, el usuario debe cambiar la contraseña temporal. */
  must_change_password: boolean;
  url: string;
}

export function getMe() {
  return api.get<UserProfile>("/api/users/me/");
}

export function patchMe(data: FormData) {
  return api.patch<UserProfile>("/api/users/me/", data);
}

/**
 * Única regla de "este usuario puede validar" del lado del cliente (US-035).
 *
 * El backend la vuelve a verificar en cada request —es la fuente de verdad—;
 * esto solo decide qué se muestra. La baja lógica del validador no viaja en el
 * perfil, así que un validador desactivado ve la opción y recibe un 403 al
 * usarla: por eso las pantallas manejan ese error en lugar de confiar en esto.
 */
export function canValidate(user: UserProfile | null): boolean {
  return user !== null && user.role === "validador" && !user.must_change_password;
}
