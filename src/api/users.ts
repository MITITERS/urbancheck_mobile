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

/**
 * Perfil público de otra persona (US-027).
 *
 * Si tiene el perfil en privado, `date_joined` y `report_count` viajan nulos:
 * el servidor lo dice así para que el cliente no tenga que inferirlo de la
 * ausencia de los campos.
 */
export interface PublicProfile {
  id: number;
  name: string;
  avatar: string | null;
  is_public: boolean;
  date_joined: string | null;
  report_count: number | null;
}

export function getPublicProfile(id: number) {
  return api.get<PublicProfile>(`/api/users/${id}/`);
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

/**
 * Cuentas de trabajo: operan el circuito en vez de usarlo como vecinos. Es el
 * complemento exacto de `ciudadano`, espejo de `User.WORK_ROLES` en el backend.
 */
const WORK_ROLES: readonly UserRole[] = [
  "validador",
  "agente_municipal",
  "admin_plataforma",
];

/**
 * Única regla de "este usuario participa como vecino" del lado del cliente:
 * reportar, comentar y dar me gusta.
 *
 * Solo el vecino participa. Las cuentas de trabajo operan el circuito —el
 * validador verifica en terreno, el agente gestiona desde el panel, el
 * administrador opera la plataforma—, así que un aporte propio las pondría de
 * los dos lados del mismo caso. Quien además quiera usar UrbanCheck como vecino
 * se crea una cuenta personal.
 *
 * **Leer no está alcanzado**: el personal municipal sigue viendo el feed, el
 * mapa, el detalle y los comentarios de los vecinos. Lo que se esconde son los
 * controles de aporte, no el contenido.
 *
 * A diferencia de `canValidate()`, acá alcanza con el rol —el estado de la
 * cuenta no lo habilita de vuelta—, así que el cliente decide lo mismo que el
 * backend y no hay una pantalla que muestre la opción para después recibir un
 * 403.
 */
export function participatesAsCitizen(user: UserProfile | null): boolean {
  return user !== null && !WORK_ROLES.includes(user.role);
}
