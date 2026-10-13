import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { queryClient } from "./queryClient";

/**
 * La caché de la app, y el puente entre React Query y React Native.
 *
 * En la web la librería sabe cuándo la persona volvió a mirar: escucha el foco
 * de la ventana. Acá no hay ventana, así que ese aviso hay que darlo a mano, y
 * son **dos** eventos distintos:
 *
 * 1. **Volver a la app desde segundo plano.** Lo resuelve este componente
 *    conectando `AppState` al `focusManager`: sin esto, alguien que deja el
 *    teléfono diez minutos y vuelve se queda mirando datos viejos hasta tocar
 *    algo.
 * 2. **Volver a una pantalla dentro de la app.** Eso es por pantalla y lo
 *    resuelve `useRefetchOnFocus()`, porque las pestañas quedan montadas y no
 *    hay montaje que dispare nada.
 *
 * Los dos respetan el `staleTime`: avisan que se volvió a mirar, no fuerzan un
 * pedido. Un dato fresco se sigue mostrando sin ir a la red.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (status: AppStateStatus) => {
        focusManager.setFocused(status === "active");
      },
    );
    return () => subscription.remove();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
