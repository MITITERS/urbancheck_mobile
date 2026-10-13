import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Cada cuánto se vuelve a mirar el feed y el mapa mientras están a la vista.
 *
 * Igual que el `staleTime`: pedir más seguido no traería nada nuevo, porque la
 * caché consideraría fresco lo que acaba de llegar.
 */
export const PUBLIC_LIST_POLL_MS = 30_000;

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
export function useRefetchOnFocus(
  queryKey: readonly unknown[],
  {
    pollMs,
    onlyStale = true,
  }: {
    /**
     * Además, mientras la pantalla está a la vista, vuelve a mirar cada tanto.
     *
     * Existe por lo que otro vecino hace mientras uno mira el feed: una
     * denuncia por dato personal oculta el reporte en el servidor al instante
     * (US-043), pero sin esto seguía en la pantalla de los demás hasta que
     * salieran de la pestaña y volvieran. Se corta al salir de la pantalla: una
     * pestaña que nadie mira no pide nada.
     */
    pollMs?: number;
    /**
     * Si al volver solo se refresca lo vencido. El detalle de un reporte pasa
     * `false`: es un pedido chico, y mostrar un estado viejo ahí confunde
     * —el autor seguía viendo "tu reporte está oculto" después de que se
     * desestimara la denuncia (US-043)—.
     */
    onlyStale?: boolean;
  } = {},
) {
  const queryClient = useQueryClient();
  const serialized = JSON.stringify(queryKey);

  useFocusEffect(
    useCallback(() => {
      const refresh = (onlyStale: boolean) =>
        void queryClient.refetchQueries({
          queryKey: JSON.parse(serialized) as readonly unknown[],
          // Solo lo que está en pantalla: no tiene sentido refrescar una
          // consulta que ningún componente montado está mirando.
          type: "active",
          // Al volver, solo lo vencido. El tick periódico pide siempre: con el
          // intervalo igual al `staleTime`, filtrar por vencido salteaba uno de
          // cada dos, porque el dato llegaba unos milisegundos después de
          // arrancar la cuenta.
          ...(onlyStale ? { stale: true } : {}),
        });
      refresh(onlyStale);
      if (!pollMs) return undefined;
      const timer = setInterval(() => refresh(false), pollMs);
      return () => clearInterval(timer);
    }, [queryClient, serialized, pollMs, onlyStale]),
  );
}
