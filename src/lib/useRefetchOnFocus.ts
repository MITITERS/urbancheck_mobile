import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Refresca al volver a la pantalla, pero **solo si el dato quedó viejo**.
 *
 * Es el equivalente de `refetchOnWindowFocus` para una app de pestañas: en
 * expo-router las pestañas quedan montadas, así que volver a una no dispara
 * ningún montaje y sin esto el dato se quedaría quieto hasta el `staleTime` de
 * la próxima lectura.
 *
 * La diferencia con lo que hacía la app antes está en `stale: true`: no fuerza
 * el pedido, le pide a la caché que refresque lo que ya venció. Volver a una
 * pestaña que se miró hace cinco segundos no pide nada y se ve al instante;
 * volver a una de hace un minuto muestra lo anterior y refresca por detrás, sin
 * tapar la pantalla con un spinner.
 *
 * La clave se compara serializada: un array literal cambia de identidad en cada
 * render y el efecto se dispararía siempre.
 */
export function useRefetchOnFocus(queryKey: readonly unknown[]) {
  const queryClient = useQueryClient();
  const serialized = JSON.stringify(queryKey);

  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({
        queryKey: JSON.parse(serialized) as readonly unknown[],
        // Solo lo que está en pantalla: no tiene sentido refrescar una consulta
        // que ningún componente montado está mirando.
        type: "active",
        stale: true,
      });
    }, [queryClient, serialized]),
  );
}
