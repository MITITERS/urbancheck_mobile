import { Alert } from "react-native";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";

import { ValidationActions } from "../ValidationActions";
import { rejectReport, validateReport } from "../../api/validation";

/**
 * Acciones de validación en terreno (US-036).
 *
 * Las dos reglas que se prueban una y otra vez acá son las del criterio de
 * aceptación: sin ubicación no se valida —y se dice por qué, en vez de esconder
 * los botones—, y la posición que viaja al servidor es la del momento de actuar,
 * nunca una cacheada.
 */

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock("../../api/validation", () => ({
  ...jest.requireActual("../../api/validation"),
  validateReport: jest.fn(),
  rejectReport: jest.fn(),
}));

const Location = jest.requireMock("expo-location");
const mockValidate = validateReport as jest.MockedFunction<typeof validateReport>;
const mockReject = rejectReport as jest.MockedFunction<typeof rejectReport>;

const HERE = { latitude: -32.4106, longitude: -63.2436 };
/** Una lectura del GPS distinta de la inicial, para distinguirlas. */
const MOVED = { latitude: -32.4111, longitude: -63.2444 };

function grant(coords = HERE) {
  Location.getForegroundPermissionsAsync.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  Location.requestForegroundPermissionsAsync.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  Location.getCurrentPositionAsync.mockResolvedValue({ coords });
}

function deny({ canAskAgain = true } = {}) {
  Location.getForegroundPermissionsAsync.mockResolvedValue({
    granted: false,
    canAskAgain,
  });
  Location.requestForegroundPermissionsAsync.mockResolvedValue({
    granted: false,
    canAskAgain,
  });
}

/**
 * Monta el componente y espera a que el permiso quede resuelto.
 *
 * La espera no es opcional: mientras el permiso está en `checking` los botones
 * salen deshabilitados, y un toque sobre un botón deshabilitado no hace nada.
 */
async function mount({ granted = false, onCompleted = jest.fn() } = {}) {
  render(<ValidationActions reportId={42} onCompleted={onCompleted} />);
  if (granted) {
    await waitFor(() => expect(Location.getCurrentPositionAsync).toHaveBeenCalled());
  } else {
    await screen.findByText(/Necesitamos tu ubicación|ajustes del sistema/);
  }
  return { onCompleted, user: userEvent.setup() };
}

/** Abre el diálogo de una acción y confirma. */
async function confirmAction(
  user: ReturnType<typeof userEvent.setup>,
  action: "Validar" | "Rechazar",
) {
  await user.press(screen.getByText(action));
  const dialog = await screen.findByText(
    action === "Validar" ? "¿Validar este reporte?" : "¿Rechazar este reporte?",
  );
  expect(dialog).toBeTruthy();
  // El botón del diálogo es el segundo con ese texto: el primero es el de la
  // barra de acciones que lo abrió.
  const buttons = screen.getAllByText(action);
  await user.press(buttons[buttons.length - 1]);
}

beforeEach(() => {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

describe("ValidationActions, sin ubicación", () => {
  it("muestra las acciones deshabilitadas y explica el motivo", async () => {
    // Esconderlas dejaba al validador sin saber por qué no puede trabajar.
    deny();
    await mount();

    expect(
      await screen.findByText(/Necesitamos tu ubicación para confirmar/),
    ).toBeTruthy();
    expect(screen.getByText("Validar")).toBeTruthy();
  });

  it("con el permiso denegado ofrece volver a pedirlo", async () => {
    deny();
    const { user } = await mount();
    await screen.findByText("Permitir ubicación");

    await user.press(screen.getByText("Permitir ubicación"));

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
  });

  it("con el permiso bloqueado manda a los ajustes y no ofrece pedirlo de nuevo", async () => {
    // Bloqueado solo se arregla desde el sistema: un botón que no puede hacer
    // nada es peor que ninguno.
    deny({ canAskAgain: false });
    await mount();

    expect(await screen.findByText(/ajustes del sistema/)).toBeTruthy();
    expect(screen.queryByText("Permitir ubicación")).toBeNull();
  });

  it("no abre el diálogo mientras no haya ubicación", async () => {
    deny();
    const { user } = await mount();
    await screen.findByText(/Necesitamos tu ubicación/);

    await user.press(screen.getByText("Validar"));

    expect(screen.queryByText("¿Validar este reporte?")).toBeNull();
  });
})

describe("ValidationActions, validar", () => {
  it("con permiso concedido no muestra el aviso", async () => {
    grant();
    await mount({ granted: true });

    await waitFor(() =>
      expect(screen.queryByText(/Necesitamos tu ubicación/)).toBeNull(),
    );
  });

  it("pide confirmación antes de validar", async () => {
    grant();
    const { user } = await mount({ granted: true });

    await user.press(screen.getByText("Validar"));

    expect(await screen.findByText("¿Validar este reporte?")).toBeTruthy();
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it("cancelar cierra el diálogo sin llamar a la API", async () => {
    grant();
    const { user } = await mount({ granted: true });
    await user.press(screen.getByText("Validar"));
    await screen.findByText("¿Validar este reporte?");

    await user.press(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.queryByText("¿Validar este reporte?")).toBeNull());
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it("valida con una posición fresca, no con la de la carga", async () => {
    // Es el corazón de la historia: una lectura de hace minutos no prueba que el
    // validador esté parado frente al problema.
    grant();
    mockValidate.mockResolvedValue({} as never);
    const { user, onCompleted } = await mount({ granted: true });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: MOVED });

    await confirmAction(user, "Validar");

    await waitFor(() => expect(mockValidate).toHaveBeenCalledWith(42, MOVED));
    expect(onCompleted).toHaveBeenCalled();
  });

  it("avisa que el reporte quedó visible para la comunidad", async () => {
    grant();
    mockValidate.mockResolvedValue({} as never);
    const { user } = await mount({ granted: true });

    await confirmAction(user, "Validar");

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "Reporte validado",
        expect.stringContaining("visible"),
      ),
    );
  });

  it("si el GPS no entrega posición al actuar, no manda nada", async () => {
    grant();
    const { user, onCompleted } = await mount({ granted: true });
    Location.getCurrentPositionAsync.mockRejectedValue(new Error("timeout"));

    await confirmAction(user, "Validar");

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Sin ubicación", expect.any(String)));
    expect(mockValidate).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it("si el permiso se revocó entre la carga y la acción, tampoco manda", async () => {
    grant();
    const { user } = await mount({ granted: true });
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });

    await confirmAction(user, "Validar");

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Sin ubicación", expect.any(String)),
    );
    expect(mockValidate).not.toHaveBeenCalled();
  });
});

describe("ValidationActions, rechazar", () => {
  it("exige un motivo antes de rechazar", async () => {
    // El motivo viaja al vecino en el aviso: sin él, el rechazo es mudo.
    grant();
    const { user } = await mount({ granted: true });

    await confirmAction(user, "Rechazar");

    expect(Alert.alert).toHaveBeenCalledWith("Falta el motivo", expect.any(String));
    expect(mockReject).not.toHaveBeenCalled();
  });

  it("no acepta un motivo de solo espacios", async () => {
    grant();
    const { user } = await mount({ granted: true });
    await user.press(screen.getByText("Rechazar"));
    await screen.findByText("¿Rechazar este reporte?");

    await user.type(screen.getByPlaceholderText("Motivo del rechazo"), "   ");
    const buttons = screen.getAllByText("Rechazar");
    await user.press(buttons[buttons.length - 1]);

    expect(Alert.alert).toHaveBeenCalledWith("Falta el motivo", expect.any(String));
    expect(mockReject).not.toHaveBeenCalled();
  });

  it("rechaza con el motivo recortado y la posición del momento", async () => {
    grant();
    mockReject.mockResolvedValue({} as never);
    const { user, onCompleted } = await mount({ granted: true });
    await user.press(screen.getByText("Rechazar"));
    await screen.findByText("¿Rechazar este reporte?");
    await user.type(
      screen.getByPlaceholderText("Motivo del rechazo"),
      "  No hay ningún bache acá.  ",
    );
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: MOVED });

    const buttons = screen.getAllByText("Rechazar");
    await user.press(buttons[buttons.length - 1]);

    await waitFor(() =>
      expect(mockReject).toHaveBeenCalledWith(42, MOVED, "No hay ningún bache acá."),
    );
    expect(onCompleted).toHaveBeenCalled();
  });
});

describe("ValidationActions, errores del servidor", () => {
  it("«estás demasiado lejos» se muestra con la distancia real que manda el backend", async () => {
    // El backend calcula la distancia; repetir «estás lejos» sin el número no le
    // dice al validador cuánto tiene que caminar.
    grant();
    mockValidate.mockRejectedValue({
      code: "too_far",
      detail: "Estás a 820 m del reporte; el máximo es 100 m.",
      distance_meters: 820,
      radius_meters: 100,
    });
    const { user, onCompleted } = await mount({ granted: true });

    await confirmAction(user, "Validar");

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "Estás demasiado lejos",
        "Estás a 820 m del reporte; el máximo es 100 m.",
      ),
    );
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it("otro error del servidor se muestra con su detalle", async () => {
    grant();
    mockValidate.mockRejectedValue({ detail: "El reporte ya fue validado." });
    const { user } = await mount({ granted: true });

    await confirmAction(user, "Validar");

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "No pudimos completar la acción",
        "El reporte ya fue validado.",
      ),
    );
  });

  it("un error sin detalle no deja al validador sin mensaje", async () => {
    grant();
    mockValidate.mockRejectedValue(new Error("Network request failed"));
    const { user } = await mount({ granted: true });

    await confirmAction(user, "Validar");

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "No pudimos completar la acción",
        "Intentá de nuevo.",
      ),
    );
  });
});
