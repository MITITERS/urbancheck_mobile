import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Linking, Platform } from "react-native";

import WorkReportScreen from "../../../app/(app)/work-report/[id]";
import { api } from "../../api/client";
import type { ReportDetail } from "../../api/reports";
import { PROCESSING_POLL_MS } from "../../lib/useRefetchOnFocus";
import { renderWithProviders } from "../../test/renderWithProviders";

const mockedPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockedPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ id: "7" }),
  // La pantalla refresca al enfocarse; en el test alcanza con un efecto normal.
  // El `requireActual` va adentro: la fábrica del mock se hoistea sobre los imports.
  useFocusEffect: (callback: () => void) =>
    (jest.requireActual("react") as typeof import("react")).useEffect(callback, [callback]),
}));

jest.mock("react-native-maps", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const MapView = (props: Record<string, unknown>) =>
    React.createElement(View, { testID: "map", ...props });
  const Marker = (props: Record<string, unknown>) =>
    React.createElement(View, { testID: "marcador", ...props });
  return { __esModule: true, default: MapView, Marker };
});

// Los iconos no son lo que se prueba acá, y `expo-font` —del que dependen— no
// está instalado en este árbol de node_modules.
jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

// Se mockea el **transporte** y no el módulo de la API: así corren de verdad el
// hook de caché y el fetcher, que es donde vive el comportamiento.
jest.mock("../../api/client", () => ({
  ...jest.requireActual("../../api/client"),
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedGet = api.get as jest.MockedFunction<typeof api.get>;

const WORK: ReportDetail = {
  id: 7,
  photo: "https://example.test/report.jpg",
  photo_removed_at: null,
  photo_status: "procesada" as const,
  under_privacy_review: false,
  description: "Bache enorme en la esquina",
  category: "bache",
  latitude: "-32.41",
  longitude: "-63.24",
  address: "Buenos Aires 100",
  status: "en_proceso",
  author: { id: 2, name: "Vecina", avatar: null },
  like_count: 0,
  comment_count: 0,
  created_at: "2026-08-01T10:00:00Z",
  has_official_response: true,
  appeal_count: 0,
  archived_at: null,
  area_assigned_at: "2026-08-27T10:00:00Z",
  is_liked: false,
  comments: [],
  official_responses: [
    {
      id: 3,
      text: "La cuadrilla pasa esta semana.",
      created_at: "2026-08-28T12:00:00Z",
      municipality: "Villa María",
    },
  ],
  resolution_evidences: [],
  resolution_appeals: [],
  objection_deadline: null,
  can_appeal: false,
  moderation: null,
  share_url: null,
  status_history: [],
  can_edit: false,
};

function renderDetail() {
  return renderWithProviders(<WorkReportScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("detalle del trabajo del operario", () => {
  it("trae la foto, la descripción, la categoría y la ubicación", async () => {
    // Escenario 3: lo que hace falta para entender el problema antes de salir.
    mockedGet.mockResolvedValue(WORK);

    renderDetail();

    expect(await screen.findByText("Bache")).toBeTruthy();
    expect(screen.getByText(WORK.description)).toBeTruthy();
    expect(screen.getByText(WORK.address)).toBeTruthy();
    expect(screen.getByTestId("map")).toBeTruthy();
  });

  it("lo pide por la ruta del operario, que es la que el servidor acota", async () => {
    mockedGet.mockResolvedValue(WORK);

    renderDetail();

    await waitFor(() =>
      expect(mockedGet).toHaveBeenCalledWith("/api/operator/reports/7/"),
    );
  });

  it("fecha el trabajo por su asignación al área, no por el alta del reporte", async () => {
    mockedGet.mockResolvedValue(WORK);

    renderDetail();

    expect(await screen.findByText(/Asignado a tu área el/)).toBeTruthy();
    // 27/08, la asignación; no el 01/08 en que el vecino lo reportó.
    expect(screen.getByText(/27\/8\/2026/)).toBeTruthy();
  });

  it("ofrece el acceso al cierre mientras el trabajo está vigente", async () => {
    mockedGet.mockResolvedValue(WORK);

    renderDetail();

    fireEvent.press(await screen.findByText("Registrar la resolución"));

    expect(mockedPush).toHaveBeenCalledWith("/(app)/close-report/7");
  });

  it("un trabajo ya cerrado muestra su parte en lugar del botón", async () => {
    mockedGet.mockResolvedValue({
      ...WORK,
      status: "resuelto",
      resolution_evidences: [
        {
          id: 11,
          photo: "https://example.test/cierre.jpg",
          photo_removed_at: null,
          photo_status: "procesada" as const,
          description: "Bache tapado con asfalto en frío",
          created_at: "2026-09-01T09:00:00Z",
          operational_area: "Obras Públicas",
        },
      ],
    });

    renderDetail();

    expect(await screen.findByText("Resolución registrada")).toBeTruthy();
    expect(screen.getByText("Bache tapado con asfalto en frío")).toBeTruthy();
    expect(screen.queryByText("Registrar la resolución")).toBeNull();
  });

  it("vuelve a mirar mientras la foto del cierre se difumina, hasta verla publicada", async () => {
    // US-042: al volver del formulario la evidencia todavía está en
    // `pendiente`. Antes la pantalla se quedaba así hasta salir y volver.
    jest.useFakeTimers();
    try {
      const closed = {
        id: 11,
        photo: null,
        photo_removed_at: null,
        photo_status: "pendiente" as const,
        description: "Bache tapado con asfalto en frío",
        created_at: "2026-09-01T09:00:00Z",
        operational_area: "Obras Públicas",
      };
      mockedGet
        .mockResolvedValueOnce({ ...WORK, status: "resuelto", resolution_evidences: [closed] })
        .mockResolvedValue({
          ...WORK,
          status: "resuelto",
          resolution_evidences: [
            { ...closed, photo: "https://example.test/cierre.jpg", photo_status: "procesada" },
          ],
        });

      renderDetail();

      expect(await screen.findByLabelText(/Procesando la imagen/)).toBeTruthy();

      jest.advanceTimersByTime(PROCESSING_POLL_MS);

      await waitFor(() => expect(screen.queryByLabelText(/Procesando la imagen/)).toBeNull());
      const calls = mockedGet.mock.calls.length;
      // Publicada la foto, el sondeo se corta.
      jest.advanceTimersByTime(PROCESSING_POLL_MS * 3);
      expect(mockedGet.mock.calls.length).toBe(calls);
    } finally {
      jest.useRealTimers();
    }
  });

  it("muestra el compromiso que el municipio asumió con el vecino", async () => {
    mockedGet.mockResolvedValue(WORK);

    renderDetail();

    expect(await screen.findByText("Respuestas oficiales")).toBeTruthy();
    expect(screen.getByText("La cuadrilla pasa esta semana.")).toBeTruthy();
    expect(screen.getByText(/Villa María/)).toBeTruthy();
  });

  it("un reporte que no es de mi área no se abre y lo dice", async () => {
    // Escenario 7: el recorte lo hace el servidor con un 404, no un filtro acá.
    // El cliente lanza el cuerpo de la respuesta tal cual.
    mockedGet.mockRejectedValue({ status: 404, detail: "No encontrado." });

    renderDetail();

    expect(await screen.findByText("No encontrado.")).toBeTruthy();
    expect(screen.queryByText("Registrar la resolución")).toBeNull();
  });
});

describe("navegación al lugar del trabajo", () => {
  const openURL = jest.spyOn(Linking, "openURL");
  const canOpenURL = jest.spyOn(Linking, "canOpenURL");
  const platform = Platform.OS;

  afterEach(() => {
    // La plataforma es global: sin restaurarla, el caso de Android decidiría
    // por los que corren después.
    Platform.OS = platform;
  });

  afterAll(() => {
    openURL.mockRestore();
    canOpenURL.mockRestore();
  });

  it.each([
    ["ios", "maps:0,0?q=-32.41,-63.24"],
    ["android", "geo:0,0?q=-32.41,-63.24"],
  ] as const)(
    "abre las coordenadas en la app de mapas de %s",
    async (os, expected) => {
      // Escenario 4: cada plataforma tiene su esquema propio.
      Platform.OS = os;
      mockedGet.mockResolvedValue(WORK);
      canOpenURL.mockResolvedValue(true);
      openURL.mockResolvedValue(undefined);

      renderDetail();

      fireEvent.press(await screen.findByText("Cómo llegar"));

      await waitFor(() => expect(openURL).toHaveBeenCalledWith(expected));
    },
  );

  it("sin app de mapas instalada cae a Google Maps en el navegador", async () => {
    mockedGet.mockResolvedValue(WORK);
    canOpenURL.mockResolvedValue(false);
    openURL.mockResolvedValue(undefined);

    renderDetail();

    fireEvent.press(await screen.findByText("Cómo llegar"));

    await waitFor(() =>
      expect(openURL).toHaveBeenCalledWith(
        "https://www.google.com/maps/search/?api=1&query=-32.41,-63.24",
      ),
    );
  });

  it("sin coordenadas no ofrece la navegación en lugar de abrir la nada", async () => {
    mockedGet.mockResolvedValue({ ...WORK, latitude: null, longitude: null });

    renderDetail();

    expect(await screen.findByText(WORK.description)).toBeTruthy();
    expect(screen.queryByText("Cómo llegar")).toBeNull();
    expect(screen.queryByTestId("map")).toBeNull();
  });
});
