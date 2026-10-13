import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";

/**
 * Un cliente por test, sin reintentos ni caché entre casos.
 *
 * Cada uno es nuevo a propósito: compartirlo haría que un test viera los datos
 * que dejó el anterior, y el orden de ejecución pasaría a importar. Los
 * reintentos se apagan porque un test que espera un error no tiene por qué
 * esperar tres intentos antes de verlo.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactElement, client?: QueryClient) {
  const queryClient = client ?? createTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper }) };
}
