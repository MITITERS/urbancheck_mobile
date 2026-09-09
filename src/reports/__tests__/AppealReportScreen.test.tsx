import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";

import AppealReportScreen from "../../../app/(app)/appeal-report/[id]";
import { appealResolution } from "../../api/resolution";

/**
 * US-048 — el vecino objeta el cierre de su reporte.
 *
 * Lo que se prueba acá es de dónde puede salir la foto. A diferencia del cierre
 * del operario (US-046), que exige cámara porque certifica su propio trabajo en
 * el lugar, quien objeta puede tener la foto sacada de antes.
 */

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ id: "42" }),
}));

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

// La conversión a JPEG no es lo que se prueba acá, y sin mockearla el módulo
// nativo no existe en el entorno de test.
jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: jest.fn(() => { throw new Error("sin nativo") }) },
  SaveFormat: { JPEG: "jpeg" },
}));

jest.mock("../../api/resolution", () => ({ appealResolution: jest.fn() }));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const mockedAppeal = appealResolution as jest.MockedFunction<typeof appealResolution>;

const GRANTED = { status: "granted" } as never;
const DENIED = { status: "denied" } as never;

function asset(uri: string) {
  return { canceled: false, assets: [{ uri, fileName: "foto.jpg", mimeType: "image/jpeg" }] } as never;
}

beforeEach(() => {
  picker.requestCameraPermissionsAsync.mockResolvedValue(GRANTED);
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(GRANTED);
  picker.launchCameraAsync.mockResolvedValue(asset("file:///camara.jpg"));
  picker.launchImageLibraryAsync.mockResolvedValue(asset("file:///galeria.jpg"));
  mockedAppeal.mockResolvedValue(undefined as never);
});

describe("objetar un cierre", () => {
  it("ofrece los dos orígenes de foto, no solo la cámara", () => {
    render(<AppealReportScreen />);

    expect(screen.getByText("Sacar foto")).toBeTruthy();
    expect(screen.getByText("Elegir de galería")).toBeTruthy();
  });

  it("elegir de galería pide el permiso de galería y no el de cámara", async () => {
    const user = userEvent.setup();
    render(<AppealReportScreen />);

    await user.press(screen.getByText("Elegir de galería"));

    expect(picker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
    expect(picker.launchImageLibraryAsync).toHaveBeenCalled();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it("sacar foto sigue abriendo la cámara", async () => {
    const user = userEvent.setup();
    render(<AppealReportScreen />);

    await user.press(screen.getByText("Sacar foto"));

    expect(picker.launchCameraAsync).toHaveBeenCalled();
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("sin permiso de galería lo explica en lugar de fallar en silencio", async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(DENIED);
    const user = userEvent.setup();
    render(<AppealReportScreen />);

    await user.press(screen.getByText("Elegir de galería"));

    expect(await screen.findByText(/acceso a la galería/)).toBeTruthy();
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("con la foto elegida deja reemplazarla por cualquiera de los dos caminos", async () => {
    const user = userEvent.setup();
    render(<AppealReportScreen />);

    await user.press(screen.getByText("Elegir de galería"));

    // Quien se equivocó de foto no tiene por qué volver al origen que usó.
    expect(await screen.findByText("Sacar otra")).toBeTruthy();
    expect(screen.getByText("Elegir otra")).toBeTruthy();
  });

  it("envía la objeción con la foto de la galería y el motivo", async () => {
    const user = userEvent.setup();
    render(<AppealReportScreen />);

    await user.press(screen.getByText("Elegir de galería"));
    await screen.findByText("Elegir otra");
    await user.type(
      screen.getByLabelText("Motivo de la objeción"),
      "El bache sigue igual.",
    );
    await user.press(screen.getByText("Objetar el cierre"));

    await waitFor(() =>
      expect(mockedAppeal).toHaveBeenCalledWith(42, {
        photo: expect.objectContaining({ uri: "file:///galeria.jpg" }),
        reason: "El bache sigue igual.",
      }),
    );
  });

  it("sin foto no envía nada y lo dice", async () => {
    const user = userEvent.setup();
    render(<AppealReportScreen />);

    await user.press(screen.getByText("Objetar el cierre"));

    expect(await screen.findByText("Falta la foto")).toBeTruthy();
    expect(mockedAppeal).not.toHaveBeenCalled();
  });
});
