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

let focusCallback: (() => void) | null = null;

jest.mock("expo-router", () => ({
  useFocusEffect: (callback: () => void) => {
    focusCallback = callback;
  },
}));

/** Simula volver a la pantalla. */
function focusScreen() {
  focusCallback?.();
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const FEED_KEY = ["reportes", "list", {}] as const;

/**
 * Monta la consulta y el hook juntos.
 *
 * Van en el mismo `renderHook` porque `refetchQueries({ type: "active" })` solo
 * alcanza consultas que algún componente esté mirando: sin el `useQuery`
 * montado, el test pasaría sin probar nada.
 */
function mountFeedWith(watched: readonly unknown[], staleTime: number, queryFn: jest.Mock) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime } },
  });
  const view = renderHook(
    () => {
      useQuery({ queryKey: FEED_KEY, queryFn });
      useRefetchOnFocus(watched);
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
});
