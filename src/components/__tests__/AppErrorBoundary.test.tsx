import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentType } from "react";

import * as RootLayout from "../../../app/_layout";

/**
 * N-20 — sin un `ErrorBoundary` exportado por el layout raíz, un error de
 * renderizado cerraba la app en producción. Expo Router lo toma por nombre.
 */

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

type BoundaryProps = { error: Error; retry: () => Promise<void> };

it("el layout raíz exporta un ErrorBoundary con mensaje y reintento", () => {
  const ErrorBoundary = (RootLayout as { ErrorBoundary?: ComponentType<BoundaryProps> })
    .ErrorBoundary;
  expect(ErrorBoundary).toBeDefined();
  if (!ErrorBoundary) return;
  jest.spyOn(console, "error").mockImplementation(() => {});
  const retry = jest.fn(async () => {});

  render(<ErrorBoundary error={new Error("falla")} retry={retry} />);

  expect(screen.getByText("Algo salió mal")).toBeTruthy();
  fireEvent.press(screen.getByText("Reintentar"));
  expect(retry).toHaveBeenCalled();
});
