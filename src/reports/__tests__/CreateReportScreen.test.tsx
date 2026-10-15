import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import CreateReportTab from "../../../app/(app)/(tabs)/create-tab";
import {
  createReport,
  likeReport,
  type ExistingReport,
  type ReportAlreadyExists,
} from "../../api/reports";
import { renderWithProviders } from "../../test/renderWithProviders";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  // La foto trae la ubicación en el EXIF: así el formulario queda completo sin
  // tener que pasar por el GPS.
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [
      {
        uri: "file:///foto.jpg",
        fileName: "foto.jpg",
        mimeType: "image/jpeg",
        exif: {
          GPSLatitude: 32.4102,
          GPSLatitudeRef: "S",
          GPSLongitude: 63.24,
          GPSLongitudeRef: "W",
        },
      },
    ],
  })),
}));

// Sin conversión a JPEG, la pantalla usa la foto original: es su respaldo.
jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: {
    manipulate: () => {
      throw new Error("sin conversión en tests");
    },
  },
  SaveFormat: { JPEG: "jpeg" },
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

// Los iconos no son lo que se prueba acá, y `expo-font` —del que dependen— no
// está instalado en este árbol de node_modules.
jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

// La barra de pestañas real arrastra todo `expo-router`; acá solo importa el
// espacio que reserva.
jest.mock("../../components/floatingTabBar", () => ({
  useFloatingTabBarInset: () => 0,
}));

jest.mock("../../api/reports", () => ({
  ...jest.requireActual("../../api/reports"),
  createReport: jest.fn(),
  geocodeAddress: jest.fn(async () => []),
  likeReport: jest.fn(),
  unlikeReport: jest.fn(),
}));

const mockedCreateReport = createReport as jest.MockedFunction<typeof createReport>;
const mockedLikeReport = likeReport as jest.MockedFunction<typeof likeReport>;

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const EXISTING: ExistingReport = {
  id: 42,
  number: 7,
  photo: "https://example.test/media/reports/bache.jpg",
  photo_removed_at: null,
  photo_status: "procesada" as const,
  under_privacy_review: false,
  description: "Bache frente a la escuela.",
  category: "bache",
  latitude: "-32.410300",
  longitude: "-63.240000",
  address: "Bv. España 100",
  status: "pendiente_validacion",
  author: { id: 9, name: "Otra vecina", avatar: null },
  like_count: 3,
  comment_count: 0,
  created_at: "2026-09-20T10:00:00Z",
  has_official_response: false,
  appeal_count: 0,
  archived_at: null,
  area_assigned_at: null,
  is_liked: false,
  is_author: false,
  distance_meters: 12,
};

function alreadyExists(report: ExistingReport = EXISTING): ReportAlreadyExists {
  return {
    status: 409,
    code: "report_already_exists",
    detail: "Este problema ya fue reportado.",
    existing_report: report,
  };
}

const DESCRIPTION = "Hay un bache enorme en la esquina.";

async function fillAndSubmit() {
  const user = userEvent.setup();
  // El selector de foto pregunta de dónde sacarla: se elige la galería.
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    (buttons as AlertButton[] | undefined)
      ?.find((button) => button.text === "Galería")
      ?.onPress?.();
  });
  await user.press(screen.getByText("Tomar foto o subir imagen"));
  await screen.findByText("Cambiar");
  await user.type(
    screen.getByPlaceholderText("Describí brevemente cuál es el problema..."),
    DESCRIPTION,
  );
  await user.press(screen.getByText("Enviar Reporte"));
  return user;
}

function renderScreen() {
  return renderWithProviders(
    <SafeAreaProvider initialMetrics={METRICS}>
      <CreateReportTab />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
});

describe("CreateReportTab when the problem is already reported (US-032)", () => {
  it("CP-032-57 (US-032 E1) · shows the existing report instead of an error", async () => {
    mockedCreateReport.mockRejectedValueOnce(alreadyExists());
    renderScreen();

    await fillAndSubmit();

    expect(await screen.findByText("Este problema ya fue reportado")).toBeTruthy();
    expect(screen.getByText("Sumar mi apoyo")).toBeTruthy();
  });

  it("CP-032-58 (US-032 E2) · joins with a like and opens the existing report", async () => {
    mockedCreateReport.mockRejectedValueOnce(alreadyExists());
    mockedLikeReport.mockResolvedValueOnce({ liked: true, like_count: 4 });
    renderScreen();

    const user = await fillAndSubmit();
    await user.press(await screen.findByText("Sumar mi apoyo"));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/(app)/(tabs)/report/42"));
    expect(mockedLikeReport).toHaveBeenCalledWith(42);
  });

  it("CP-032-59 (US-032 E3) · goes back keeping what was loaded, without liking", async () => {
    mockedCreateReport.mockRejectedValueOnce(alreadyExists());
    renderScreen();

    const user = await fillAndSubmit();
    await user.press(await screen.findByText("Volver"));

    await waitFor(() =>
      expect(screen.queryByText("Este problema ya fue reportado")).toBeNull(),
    );
    expect(screen.getByDisplayValue(DESCRIPTION)).toBeTruthy();
    expect(screen.getByText("Cambiar")).toBeTruthy();
    expect(mockedLikeReport).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("CP-032-60 (US-032 E5) · takes the author to their report without liking", async () => {
    mockedCreateReport.mockRejectedValueOnce(
      alreadyExists({ ...EXISTING, is_author: true }),
    );
    renderScreen();

    const user = await fillAndSubmit();
    await user.press(await screen.findByText("Ir a mi reclamo"));

    expect(mockPush).toHaveBeenCalledWith("/(app)/(tabs)/report/42");
    expect(mockedLikeReport).not.toHaveBeenCalled();
  });
});

describe("CreateReportTab when the photo still has to be blurred (US-042)", () => {
  /** Lo que el usuario lee tras enviar, sin el diálogo del selector de foto. */
  async function submitAndReadTheConfirmation() {
    const alerts: { title: string; message?: string }[] = [];
    mockedCreateReport.mockResolvedValueOnce({ id: 99 } as never);
    renderScreen();

    const user = userEvent.setup();
    jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
      const gallery = (buttons as AlertButton[] | undefined)?.find(
        (button) => button.text === "Galería",
      );
      if (gallery) {
        gallery.onPress?.();
        return;
      }
      alerts.push({ title, message });
    });
    await user.press(screen.getByText("Tomar foto o subir imagen"));
    await screen.findByText("Cambiar");
    await user.type(
      screen.getByPlaceholderText("Describí brevemente cuál es el problema..."),
      DESCRIPTION,
    );
    await user.press(screen.getByText("Enviar Reporte"));

    await waitFor(() => expect(alerts).toHaveLength(1));
    return alerts[0];
  }

  it("CP-042-51 (US-042 E3) · says the image is being processed instead of claiming it is published", async () => {
    const confirmation = await submitAndReadTheConfirmation();

    // El reporte se envió, eso es cierto y se dice.
    expect(confirmation.title).toContain("enviado");
    // Lo que no se dice es que ya esté publicado: no lo está hasta que la
    // imagen termina de difuminarse, y prometerlo manda al vecino a buscar en
    // el feed un reporte que todavía no está ahí.
    expect(confirmation.message).toMatch(/difuminando/i);
    expect(confirmation.message).not.toMatch(/creado correctamente/i);
  });

  it("CP-042-52 (US-042 E7) · does not offer to join a report that is still being processed", async () => {
    // Bloquea el alta igual —el problema ya está reportado—, pero todavía no
    // se puede abrir ni apoyar: para este vecino no existe.
    mockedCreateReport.mockRejectedValueOnce(
      alreadyExists({ ...EXISTING, photo: null, photo_status: "pendiente" }),
    );
    renderScreen();

    await fillAndSubmit();

    expect(await screen.findByText("Este problema ya fue reportado")).toBeTruthy();
    expect(screen.queryByText("Sumar mi apoyo")).toBeNull();
    expect(screen.getByText(/se está procesando su foto/i)).toBeTruthy();
  });
});
