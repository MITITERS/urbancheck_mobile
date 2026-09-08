import { Text } from "react-native";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";

import { useValidatorLocation } from "../useValidatorLocation";

/**
 * Ubicación del validador (US-036 y US-037).
 *
 * El hook es `useCurrentLocation` con el texto de esta pantalla. Lo que se
 * prueba acá es esa capa: que cada estado del permiso llegue con el motivo que
 * corresponde, porque «denegado» y «bloqueado» se arreglan en lugares distintos
 * y decirlo mal manda al validador a buscar donde no hay nada.
 */

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const Location = jest.requireMock("expo-location");

const HERE = { latitude: -32.4106, longitude: -63.2436 };
const MOVED = { latitude: -32.4111, longitude: -63.2444 };

/** El último valor devuelto por el hook, para afirmarlo desde el test. */
let current: ReturnType<typeof useValidatorLocation>;

function Probe() {
  current = useValidatorLocation();
  return (
    <>
      <Text testID="permission">{current.permission}</Text>
      <Text testID="reason">{current.reason ?? "—"}</Text>
      <Text testID="coords">
        {current.coords ? `${current.coords.latitude},${current.coords.longitude}` : "—"}
      </Text>
    </>
  );
}

function permission({ granted = false, canAskAgain = true } = {}) {
  Location.getForegroundPermissionsAsync.mockResolvedValue({ granted, canAskAgain });
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ granted, canAskAgain });
  Location.getCurrentPositionAsync.mockResolvedValue({ coords: HERE });
}

async function mount() {
  render(<Probe />);
  await waitFor(() =>
    expect(screen.getByTestId("permission")).not.toHaveTextContent("checking"),
  );
  return userEvent.setup();
}

describe("useValidatorLocation", () => {
  it("con el permiso concedido entrega la posición y no da motivo", async () => {
    permission({ granted: true });

    await mount();

    expect(screen.getByTestId("permission")).toHaveTextContent("granted");
    expect(screen.getByTestId("coords")).toHaveTextContent("-32.4106,-63.2436");
    expect(screen.getByTestId("reason")).toHaveTextContent("—");
  });

  it("denegado explica para qué se necesita la ubicación", async () => {
    permission({ granted: false, canAskAgain: true });

    await mount();

    expect(screen.getByTestId("permission")).toHaveTextContent("denied");
    expect(screen.getByTestId("reason")).toHaveTextContent(
      "Necesitamos tu ubicación para confirmar que estás en el lugar del problema.",
    );
  });

  it("bloqueado manda a los ajustes del sistema, que es donde se arregla", async () => {
    permission({ granted: false, canAskAgain: false });

    await mount();

    expect(screen.getByTestId("permission")).toHaveTextContent("blocked");
    expect(screen.getByTestId("reason")).toHaveTextContent(/ajustes del sistema/);
  });

  it("si el permiso ya estaba concedido no lo vuelve a pedir", async () => {
    // Un diálogo de permiso en cada entrada a la pantalla es ruido puro.
    permission({ granted: true });

    await mount();

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("sin permiso previo lo pide una vez al entrar", async () => {
    permission({ granted: false });

    await mount();

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("request vuelve a pedirlo y publica la posición si esta vez se concede", async () => {
    permission({ granted: false });
    await mount();
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    });

    await current.request();

    await waitFor(() =>
      expect(screen.getByTestId("permission")).toHaveTextContent("granted"),
    );
    expect(screen.getByTestId("coords")).toHaveTextContent("-32.4106,-63.2436");
  });

  it("si el GPS falla, el permiso queda concedido pero sin coordenadas", async () => {
    // Permiso y lectura son dos cosas distintas: el permiso puede estar y el
    // GPS no entregar nada (bajo techo, sin señal).
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    });
    Location.getCurrentPositionAsync.mockRejectedValue(new Error("timeout"));

    await mount();

    expect(screen.getByTestId("permission")).toHaveTextContent("granted");
    expect(screen.getByTestId("coords")).toHaveTextContent("—");
  });

  it("getFreshPosition toma una lectura nueva y de alta precisión", async () => {
    // La de la carga es de hace minutos; la de validar tiene que ser de ahora.
    permission({ granted: true });
    await mount();
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: MOVED });

    const fresh = await current.getFreshPosition();

    expect(fresh).toEqual(MOVED);
    expect(Location.getCurrentPositionAsync).toHaveBeenLastCalledWith({
      accuracy: Location.Accuracy.High,
    });
  });

  it("getFreshPosition actualiza la posición publicada", async () => {
    permission({ granted: true });
    await mount();
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: MOVED });

    await current.getFreshPosition();

    await waitFor(() =>
      expect(screen.getByTestId("coords")).toHaveTextContent("-32.4111,-63.2444"),
    );
  });

  it("getFreshPosition no devuelve nada si el permiso se revocó", async () => {
    permission({ granted: true });
    await mount();
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });

    await expect(current.getFreshPosition()).resolves.toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId("permission")).toHaveTextContent("denied"),
    );
  });

  it("getFreshPosition no devuelve nada si el GPS falla", async () => {
    permission({ granted: true });
    await mount();
    Location.getCurrentPositionAsync.mockRejectedValue(new Error("timeout"));

    await expect(current.getFreshPosition()).resolves.toBeNull();
  });
});
