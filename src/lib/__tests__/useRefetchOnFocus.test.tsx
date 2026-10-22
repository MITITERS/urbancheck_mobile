import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { useRefetchOnFocus } from "../useRefetchOnFocus";

/**
 * El equivalente de `refetchOnWindowFocus` para una app de pestañas.
 *
 * Lo que importa probar es que **respeta el `staleTime`**: volver a una
 * pantalla no puede significar pedir todo de nuevo, porque eso es exactamente
 * lo que hacía la app antes y lo que la volvía lenta.
 */

let focusCallback: (() => (() => void) | void) | null = null;

jest.mock("expo-router", () => ({
  useFocusEffect: (callback: () => (() => void) | void) => {
    focusCallback = callback;
  },
}));

/** Simula volver a la pantalla; devuelve cómo salir de ella. */
function focusScreen(): () => void {
  const cleanup = focusCallback?.();
  return typeof cleanup === "function" ? cleanup : () => {};
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const FEED_KEY = ["reportes", "list", {}] as const;

/**
 * Monta la consulta y el hook juntos.
 *
 * Van en el mismo `renderHook` porque `refetchQueries({ type: "active" })` solo
 * alcanza consultas que algún componente esté mirando: sin el `useQuery`
 * montado, el test pasaría sin probar nada.
 */
function mountFeedWith(
  watched: readonly unknown[],
  staleTime: number,
  queryFn: jest.Mock,
  pollMs?: number,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime } },
  });
  const view = renderHook(
    () => {
      useQuery({ queryKey: FEED_KEY, queryFn });
      useRefetchOnFocus(watched, { pollMs });
    },
    { wrapper: wrapperFor(client) },
  );
  return { client, view };
}

beforeEach(() => {
  focusCallback = null;
});

describe("useRefetchOnFocus", () => {
  it("no pide nada si el dato todavía está fresco", async () => {
    const queryFn = jest.fn().mockResolvedValue({ results: [] });
    mountFeedWith(["reportes", "list"], 30_000, queryFn);
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    focusScreen();

    // Volver a una pestaña que se miró recién no cuesta una request. Es la
    // diferencia con lo que hacía la app antes, que recargaba siempre.
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
  });

  it("refresca lo que ya venció", async () => {
    const queryFn = jest.fn().mockResolvedValue({ results: [] });
    // `staleTime: 0` deja el dato vencido apenas se resuelve.
    mountFeedWith(["reportes", "list"], 0, queryFn);
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    focusScreen();

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });

  it("no toca consultas de otro dominio", async () => {
    const queryFn = jest.fn().mockResolvedValue({ results: [] });
    mountFeedWith(["notificaciones", "list"], 0, queryFn);
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    focusScreen();

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
  });

  describe("con pollMs (US-043)", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("mientras la pantalla está a la vista, vuelve a pedir aunque esté fresco", async () => {
      // Lo que otro vecino hizo —denunciar un reporte— no cambia nada en esta
      // caché: el dato "fresco" puede estar mostrando algo que ya se ocultó.
      jest.useFakeTimers();
      const queryFn = jest.fn().mockResolvedValue({ results: [] });
      mountFeedWith(["reportes", "list"], 30_000, queryFn, 30_000);
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

      focusScreen();
      jest.advanceTimersByTime(30_000);

      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    });

    it("deja de pedir al salir de la pantalla", async () => {
      jest.useFakeTimers();
      const queryFn = jest.fn().mockResolvedValue({ results: [] });
      mountFeedWith(["reportes", "list"], 30_000, queryFn, 30_000);
      await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

      const leave = focusScreen();
      leave();
      jest.advanceTimersByTime(90_000);

      expect(queryFn).toHaveBeenCalledTimes(1);
    });
  });
});
