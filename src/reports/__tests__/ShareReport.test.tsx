import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import { Linking, Share } from "react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import SharedReportScreen from "../../../app/r/[token]";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { shareMessages as t } from "../../messages/share";
import { ShareSheet } from "../ShareSheet";

/** US-030 — compartir un reporte, y abrir un enlace compartido en la app. */

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ token: "tok-123" }),
}));

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../api/client", () => ({
  ...jest.requireActual("../../api/client"),
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedGet = api.get as jest.MockedFunction<typeof api.get>;
const mockedAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const URL = "https://urbancheck.com.ar/r/tok-123";
const MESSAGE = "Mirá este reclamo en UrbanCheck: bache en Corrientes 529.";

function renderSheet() {
  const onClose = jest.fn();
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ShareSheet visible onClose={onClose} url={URL} message={MESSAGE} />
    </SafeAreaProvider>,
  );
  return { onClose };
}

function signedIn(session: string | null) {
  mockedAuth.mockReturnValue({
    token: session,
    user: null,
    isLoading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    setUser: jest.fn(),
    refreshUser: jest.fn(),
  });
}

beforeEach(() => {
  mockReplace.mockClear();
});

describe("ShareSheet (US-030 E1)", () => {
  it("CP-030-M01 · ofrece WhatsApp, Instagram y copiar el enlace", () => {
    renderSheet();

    for (const label of [t.whatsapp, t.instagram, t.copy, t.more]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it("CP-030-M02 · WhatsApp lleva el mensaje con el enlace", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const { onClose } = renderSheet();

    fireEvent.press(screen.getByLabelText(t.whatsapp));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(open).toHaveBeenCalledWith(
      `whatsapp://send?text=${encodeURIComponent(`${MESSAGE} ${URL}`)}`,
    );
  });

  it("CP-030-M03 · sin WhatsApp instalado cae en WhatsApp Web", async () => {
    const open = jest
      .spyOn(Linking, "openURL")
      .mockRejectedValueOnce(new Error("no app"))
      .mockResolvedValue(true);
    renderSheet();

    fireEvent.press(screen.getByLabelText(t.whatsapp));

    await waitFor(() =>
      expect(open).toHaveBeenLastCalledWith(
        `https://wa.me/?text=${encodeURIComponent(`${MESSAGE} ${URL}`)}`,
      ),
    );
  });

  it("CP-030-M04 · Instagram abre la hoja del sistema con el enlace", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    renderSheet();

    fireEvent.press(screen.getByLabelText(t.instagram));

    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({ message: `${MESSAGE} ${URL}`, url: URL }),
    );
  });

  it("CP-030-M05 · copiar deja el enlace en el portapapeles y lo confirma", async () => {
    renderSheet();

    fireEvent.press(screen.getByLabelText(t.copy));

    expect(await screen.findByText(t.copied)).toBeTruthy();
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(URL);
  });
});

describe("abrir un enlace compartido en la app (US-030)", () => {
  function renderScreen() {
    return render(<SharedReportScreen />);
  }

  it("CP-030-M06 (US-030 E2) · con sesión va directo al detalle", async () => {
    signedIn("t");
    mockedGet.mockResolvedValue({ id: 42, share_url: URL } as never);

    renderScreen();

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/(app)/(tabs)/report/42"),
    );
    expect(mockedGet).toHaveBeenCalledWith("/api/public/reports/tok-123/");
  });

  it("CP-030-M07 (US-030 E3) · si ya no está disponible, lo dice", async () => {
    signedIn("t");
    mockedGet.mockRejectedValue({ status: 404, code: "report_unavailable", moderation: null });

    renderScreen();

    expect(await screen.findByText(t.unavailableTitle)).toBeTruthy();
    expect(screen.getByText(t.unavailableBody)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("CP-030-M08 (US-049) · si lo descartó el municipio, muestra el motivo", async () => {
    signedIn("t");
    mockedGet.mockRejectedValue({
      status: 404,
      code: "report_unavailable",
      moderation: { reason: "La foto es de otra ciudad" },
    });

    renderScreen();

    expect(await screen.findByText("La foto es de otra ciudad")).toBeTruthy();
  });

  it("CP-030-M09 · sin sesión pide iniciarla", async () => {
    signedIn(null);
    mockedGet.mockResolvedValue({ id: 42, share_url: URL } as never);

    renderScreen();

    expect(await screen.findByText(t.signInToOpen)).toBeTruthy();
  });
});
