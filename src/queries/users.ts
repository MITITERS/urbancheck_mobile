/** Consultas del perfil. Ver `queries/reports.ts` sobre por qué van aparte. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getMe, getPublicProfile, patchMe } from "../api/users";
import { userKeys } from "../lib/queryKeys";

/** Clave del perfil propio. Es un id fijo porque hay uno solo por sesión. */
export const ME = "me";

/**
 * El perfil propio, cacheado.
 *
 * Lo comparten el perfil, la edición y cualquier pantalla que necesite saber
 * quién es: antes cada una llamaba a `getMe()` por su cuenta y volvía a pagar
 * el viaje al servidor.
 */
export function useMe() {
  return useQuery({
    queryKey: userKeys.detail(ME),
    queryFn: getMe,
  });
}

/**
 * Guardar el perfil, y que el cambio se vea **en el acto**.
 *
 * La pantalla de edición guardaba con `patchMe()` y no avisaba a nadie: el
 * nombre y el avatar viejos seguían en pantalla hasta reiniciar la app. La
 * respuesta del PATCH ya trae el perfil actualizado, así que se escribe directo
 * en la caché en lugar de pedirlo de nuevo.
 */
export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchMe,
    onSuccess: (updated) => {
      queryClient.setQueryData(userKeys.detail(ME), updated);
      // El nombre y el avatar del autor aparecen en cada reporte y comentario.
      void queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}

/** Perfil público de otra persona (US-027). */
export function usePublicProfile(id: number) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => getPublicProfile(id),
    enabled: Number.isFinite(id),
  });
}
