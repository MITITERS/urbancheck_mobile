import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import ReportDetailScreen from "../../../app/(app)/(tabs)/report/[id]";
import { api } from "../../api/client";
import type { ReportDetail } from "../../api/reports";
import type { UserProfile } from "../../api/users";
import { useAuth } from "../../auth/AuthContext";
import { renderWithProviders } from "../../test/renderWithProviders";
import { PERSONAL_DATA_REASON } from "../usePrivacyReview";

/**
 * Denunciar una imagen con un dato personal visible, desde el detalle (US-043).
 *
 * Desde US-021 la foto del reporte la denuncia un tercero con el botón
 * *Denunciar*, que trae este motivo entre los suyos (`ComplaintModal.test`).
 * Acá queda lo que sigue siendo de US-043: el autor que pide la revisión de su
 * propia foto y la foto de un cierre del operario, que cualquier vecino puede
 * denunciar. Lo que importa: que el motivo se elija antes de mandar nada, y
 * que quien no es el autor salga del reporte, porque acaba de dejar de verse.
 */

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => ({ id: "7" }),
  useFocusEffect: (callback: () => void) =>
    (jest.requireActual("react") as typeof import("react")).useEffect(callback, [callback]),
}));

jest.mock("react-native-maps", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const MapView = React.forwardRef(function MapView(props: Record<string, unknown>, ref: unknown) {
    React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
    return React.createElement(View, props);
  });
  return { __esModule: true, default: MapView, Marker: View };
});

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../validation/ValidationActions", () => ({
  ValidationActions: () => null,
}));

jest.mock("../../api/client", () => ({
  ...jest.requireActual("../../api/client"),
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedGet = api.get as jest.MockedFunction<typeof api.get>;
const mockedPost = api.post as jest.MockedFunction<typeof api.post>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const AUTHOR = { id: 1, name: "Vecina", avatar: null };

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 2,
    name: "Otro vecino",
    email: "otro@test.com",
    avatar: null,
    role: "ciudadano",
    municipality: null,
    must_change_password: false,
    is_public: true,
    url: "/api/users/2/",
    ...overrides,
  };
}

function detail(overrides: Partial<ReportDetail> = {}): ReportDetail {
  return {
    id: 7,
    number: 32,
    photo: "https://example.test/reporte.jpg",
    photo_removed_at: null,
    photo_status: "procesada" as const,
    under_privacy_review: false,
    description: "Vereda rota",
    category: "vereda",
    latitude: null,
    longitude: null,
    address: "Buenos Aires 100",
    status: "resuelto_pendiente_confirmacion",
    author: AUTHOR,
    like_count: 0,
    comment_count: 0,
    created_at: "2026-09-01T10:00:00Z",
    has_official_response: false,
    archived_at: null,
    area_assigned_at: null,
    appeal_count: 0,
    is_liked: false,
    comments: [],
    official_responses: [],
    resolution_evidences: [
      {
        id: 4,
        photo: "https://example.test/cierre.jpg",
        photo_removed_at: null,
        photo_status: "procesada" as const,
        description: "Se repuso la baldosa.",
        created_at: "2026-09-09T13:46:00Z",
        operational_area: "Obras Públicas",
      },
    ],
    resolution_appeals: [],
    objection_deadline: null,
    can_appeal: false,
    status_history: [],
    can_edit: false,
    ...overrides,
  } as ReportDetail;
}

function signIn(user: UserProfile) {
  mockedUseAuth.mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>);
}

function renderDetail(report: ReportDetail = detail()) {
  mockedGet.mockResolvedValue(report);
  return renderWithProviders(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ReportDetailScreen />
    </SafeAreaProvider>,
  );
}

/** Los botones del último `Alert.alert`. */
function lastAlertButtons(alert: jest.SpyInstance): AlertButton[] {
  const call = alert.mock.calls[alert.mock.calls.length - 1];
  return (call?.[2] ?? []) as AlertButton[];
}

let alert: jest.SpyInstance;

beforeEach(() => {
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  mockBack.mockClear();
  signIn(profile());
});

describe("Denunciar imagen (US-043)", () => {
  it("el autor puede pedir la revisión de su propia foto", async () => {
    signIn(profile({ id: AUTHOR.id }));
    renderDetail();

    expect(await screen.findByText("Denunciar imagen")).toBeTruthy();
  });

  it("a quien no es el autor se le ofrece Denunciar, no un segundo botón", async () => {
    renderDetail();

    expect(await screen.findByText("Denunciar")).toBeTruthy();
    expect(screen.queryByText("Denunciar imagen")).toBeNull();
  });

  it("pide el motivo antes de mandar nada", async () => {
    signIn(profile({ id: AUTHOR.id }));
    renderDetail();

    fireEvent.press(await screen.findByText("Denunciar imagen"));

    const labels = lastAlertButtons(alert).map((button) => button.text);
    expect(labels).toContain(PERSONAL_DATA_REASON);
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("con el motivo elegido, denuncia y confirma la revisión en el plazo", async () => {
    mockedPost.mockResolvedValue({
      id: 1,
      detail: "Recibimos tu solicitud. La revisión se hace dentro de las 24 horas.",
    });
    signIn(profile({ id: AUTHOR.id }));
    renderDetail();

    fireEvent.press(await screen.findByText("Denunciar imagen"));
    const reason = lastAlertButtons(alert).find((b) => b.text === PERSONAL_DATA_REASON);
    await act(async () => {
      reason?.onPress?.();
    });

    expect(mockedPost).toHaveBeenCalledWith("/api/reports/7/privacy-request/", {});
    const [title, message] = alert.mock.calls[alert.mock.calls.length - 1];
    expect(title).toBe("Solicitud recibida");
    expect(message).toMatch(/24 horas/);
  });

  it("quien no es el autor sale del reporte al cerrar la confirmación", async () => {
    mockedPost.mockResolvedValue({ id: 1, detail: "Recibimos tu solicitud." });
    renderDetail();

    fireEvent.press(await screen.findByLabelText("Denunciar la foto del cierre"));
    await act(async () => {
      lastAlertButtons(alert)
        .find((b) => b.text === PERSONAL_DATA_REASON)
        ?.onPress?.();
    });
    act(() => {
      lastAlertButtons(alert)[0]?.onPress?.();
    });

    expect(mockBack).toHaveBeenCalled();
  });

  it("una segunda denuncia sobre la misma imagen dice que ya está en curso", async () => {
    mockedPost.mockRejectedValue({
      status: 409,
      code: "privacy_request_pending",
      detail: "Ya presentaste una solicitud sobre esta imagen y está en revisión.",
    });
    renderDetail();

    fireEvent.press(await screen.findByLabelText("Denunciar la foto del cierre"));
    await act(async () => {
      lastAlertButtons(alert)
        .find((b) => b.text === PERSONAL_DATA_REASON)
        ?.onPress?.();
    });

    const [title, message] = alert.mock.calls[alert.mock.calls.length - 1];
    expect(title).toBe("Ya denunciaste esta imagen");
    expect(message).toMatch(/en revisión/);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("la foto de un cierre se denuncia indicando cuál", async () => {
    mockedPost.mockResolvedValue({ id: 1, detail: "Recibimos tu solicitud." });
    renderDetail();

    fireEvent.press(await screen.findByLabelText("Denunciar la foto del cierre"));
    await act(async () => {
      lastAlertButtons(alert)
        .find((b) => b.text === PERSONAL_DATA_REASON)
        ?.onPress?.();
    });

    expect(mockedPost).toHaveBeenCalledWith("/api/reports/7/privacy-request/", {
      evidence: 4,
    });
  });

  it("una cuenta de trabajo no tiene el botón", async () => {
    signIn(profile({ role: "validador" }));
    renderDetail();

    await screen.findByText("Vereda rota");
    expect(screen.queryByText("Denunciar imagen")).toBeNull();
  });

  it("el autor ve su reporte marcado como en revisión, sin volver a denunciar", async () => {
    signIn(profile({ id: AUTHOR.id }));
    renderDetail(detail({ under_privacy_review: true }));

    expect(await screen.findByText(/Tu reporte está oculto/)).toBeTruthy();
    expect(screen.queryByText("Denunciar imagen")).toBeNull();
  });

  it("una foto retirada se muestra como retirada y no se puede denunciar", async () => {
    renderDetail(
      detail({
        photo: null,
        photo_removed_at: "2026-09-10T10:00:00Z",
        photo_status: "procesada" as const,
        resolution_evidences: [
          {
            id: 4,
            photo: null,
            photo_removed_at: "2026-09-10T10:00:00Z",
            photo_status: "procesada" as const,
            description: "Se repuso la baldosa.",
            created_at: "2026-09-09T13:46:00Z",
            operational_area: "Obras Públicas",
          },
        ],
      }),
    );

    expect(
      await screen.findAllByLabelText("Imagen retirada por protección de datos"),
    ).toHaveLength(2);
    // Sin foto el reporte queda retirado: se le explica al autor, que es el
    // único que llega acá.
    expect(screen.getByText(/Retiramos este reporte/)).toBeTruthy();
    // El parte de trabajo sigue: solo se fue la imagen (escenario 11).
    expect(screen.getByText("Se repuso la baldosa.")).toBeTruthy();
    expect(screen.queryByText("Denunciar imagen")).toBeNull();
    expect(screen.queryByLabelText("Denunciar la foto del cierre")).toBeNull();
  });

  it("si el reporte se ocultó mientras estaba abierto, deja de mostrarlo", async () => {
    // El 404 llega con el dato viejo todavía en la caché: React Query lo
    // conserva, y la pantalla lo seguía mostrando.
    mockedGet.mockRejectedValue({ status: 404, detail: "No encontrado." });
    renderWithProviders(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ReportDetailScreen />
      </SafeAreaProvider>,
    );

    expect(await screen.findByText("Este reporte ya no está disponible.")).toBeTruthy();
    expect(screen.queryByText("Vereda rota")).toBeNull();
  });

  it("cuando se desestima la denuncia, el cartel del autor se va solo", async () => {
    // La decisión la toma el admin desde el panel: nada le avisa a esta
    // pantalla, que seguía diciendo "tu reporte está oculto" ya resuelto.
    jest.useFakeTimers();
    try {
      signIn(profile({ id: AUTHOR.id }));
      renderDetail(detail({ under_privacy_review: true }));
      expect(await screen.findByText(/Tu reporte está oculto/)).toBeTruthy();

      mockedGet.mockResolvedValue(detail({ under_privacy_review: false }));
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });

      await waitFor(() => expect(screen.queryByText(/Tu reporte está oculto/)).toBeNull());
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Denunciar desde el detalle (US-021)", () => {
  const REASONS = [
    {
      value: "reporte_falso",
      label: "Reporte falso o inexistente",
      recipient: "agente_municipal",
    },
    { value: "dato_personal", label: "Dato personal visible", recipient: "admin_plataforma" },
  ];

  /** El detalle y el catálogo salen por el mismo `api.get`. */
  function renderDetailWithReasons(report: ReportDetail = detail()) {
    mockedGet.mockImplementation((url: string) =>
      Promise.resolve(url.includes("complaint-reasons") ? REASONS : report),
    );
    return renderWithProviders(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ReportDetailScreen />
      </SafeAreaProvider>,
    );
  }

  async function reportAs(label: string, receipt: Record<string, unknown>) {
    mockedPost.mockResolvedValue(receipt);
    fireEvent.press(await screen.findByText("Denunciar"));
    fireEvent.press(await screen.findByText(label));
    await act(async () => {
      fireEvent.press(screen.getByText("Enviar denuncia"));
    });
  }

  it("el autor no tiene la acción sobre su propio reporte", async () => {
    signIn(profile({ id: AUTHOR.id }));
    renderDetail();

    await screen.findByText("Vereda rota");
    expect(screen.queryByText("Denunciar")).toBeNull();
  });

  it.each(["cancelado", "archivado"] as const)(
    "sobre un reporte %s no se ofrece",
    async (status) => {
      renderDetail(detail({ status }));

      await screen.findByText("Vereda rota");
      expect(screen.queryByText("Denunciar")).toBeNull();
    },
  );

  it("una cuenta de trabajo no tiene la acción", async () => {
    signIn(profile({ role: "agente_municipal" }));
    renderDetail();

    await screen.findByText("Vereda rota");
    expect(screen.queryByText("Denunciar")).toBeNull();
  });

  it("una denuncia de contenido deja al vecino en el reporte", async () => {
    renderDetailWithReasons();

    await reportAs("Reporte falso o inexistente", {
      id: 1,
      recipient: "agente_municipal",
      detail: "Recibimos tu denuncia. La va a revisar el municipio del reporte.",
    });
    act(() => {
      lastAlertButtons(alert)[0]?.onPress?.();
    });

    expect(mockedPost).toHaveBeenCalledWith("/api/reports/7/complaints/", {
      reason: "reporte_falso",
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("una de dato personal lo saca: el reporte acaba de ocultarse", async () => {
    renderDetailWithReasons();

    await reportAs("Dato personal visible", {
      id: 1,
      recipient: "admin_plataforma",
      detail: "Recibimos tu denuncia. La revisión se hace dentro de las 24 horas.",
    });
    act(() => {
      lastAlertButtons(alert)[0]?.onPress?.();
    });

    expect(mockBack).toHaveBeenCalled();
  });
});
