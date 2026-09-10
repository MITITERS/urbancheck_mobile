import { screen } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import ReportDetailScreen from "../../../app/(app)/(tabs)/report/[id]";
import { api } from "../../api/client";
import type { ReportDetail } from "../../api/reports";
import type { UserProfile } from "../../api/users";
import { useAuth } from "../../auth/AuthContext";
import { renderWithProviders } from "../../test/renderWithProviders";

/**
 * El hilo de resolución del detalle, tal como lo ve el vecino (US-046, US-048).
 *
 * Lo que importa acá es que se puedan **comparar las dos fotos**: la del cierre
 * que hizo el municipio y la del estado real que aporta quien objeta. La de la
 * objeción no se mostraba, así que el hilo contaba la mitad de la historia.
 */

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: "7" }),
  useFocusEffect: (callback: () => void) =>
    (require("react") as typeof import("react")).useEffect(callback, [callback]),
}));

jest.mock("react-native-maps", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const MapView = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
    return React.createElement(View, props);
  });
  return { __esModule: true, default: MapView, Marker: View };
});

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

// Las acciones de validación traen ubicación y permisos, que no son de esta
// prueba: se reemplazan por nada.
jest.mock("../../validation/ValidationActions", () => ({
  ValidationActions: () => null,
}));

jest.mock("../../api/client", () => ({
  ...jest.requireActual("../../api/client"),
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedGet = api.get as jest.MockedFunction<typeof api.get>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

/** La pantalla reserva el espacio de la barra flotante: necesita las insets. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderDetail() {
  return renderWithProviders(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ReportDetailScreen />
    </SafeAreaProvider>,
  );
}

const AUTHOR = { id: 1, name: "Vecina", avatar: null };

const CITIZEN: UserProfile = {
  id: 1,
  name: "Vecina",
  email: "vecina@test.com",
  avatar: null,
  role: "ciudadano",
  municipality: null,
  must_change_password: false,
  is_public: true,
  url: "/api/users/1/",
};

const CLOSURE_PHOTO = "https://example.test/cierre.jpg";
const APPEAL_PHOTO = "https://example.test/objecion.jpg";

function detail(overrides: Partial<ReportDetail> = {}): ReportDetail {
  return {
    id: 7,
    number: 32,
    photo: "https://example.test/reporte.jpg",
    description: "Vereda rota",
    category: "vereda",
    latitude: null,
    longitude: null,
    address: "Buenos Aires 100",
    status: "en_proceso",
    author: AUTHOR,
    like_count: 0,
    comment_count: 0,
    created_at: "2026-09-01T10:00:00Z",
    has_official_response: false,
    archived_at: null,
    area_assigned_at: null,
    appeal_count: 1,
    is_liked: false,
    comments: [],
    official_responses: [],
    resolution_evidences: [
      {
        id: 1,
        photo: CLOSURE_PHOTO,
        description: "Se repuso la baldosa.",
        created_at: "2026-09-09T13:46:00Z",
        operational_area: "Obras Públicas",
      },
    ],
    resolution_appeals: [
      {
        id: 1,
        photo: APPEAL_PHOTO,
        reason: "Sigue igual.",
        created_at: "2026-09-09T13:47:00Z",
      },
    ],
    objection_deadline: null,
    can_appeal: false,
    status_history: [],
    can_edit: false,
    ...overrides,
  } as ReportDetail;
}

/** Las URLs de las imágenes que la pantalla dibujó, en orden. */
function renderedPhotos(): string[] {
  return screen
    .UNSAFE_getAllByType(
      (jest.requireActual("react-native") as typeof import("react-native")).Image,
    )
    .map((node) => {
      const source = node.props.source as { uri?: string } | undefined;
      return source?.uri ?? "";
    })
    .filter(Boolean);
}

beforeEach(() => {
  mockedUseAuth.mockReturnValue({
    user: CITIZEN,
    token: "t",
    isLoading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    setUser: jest.fn(),
    refreshUser: jest.fn(),
  });
  mockedGet.mockResolvedValue(detail() as never);
});

describe("ubicación del reporte", () => {
  it("muestra la calle, no las coordenadas", async () => {
    // **Con coordenadas cargadas**, que es el caso real y el que fallaba: la
    // versión vieja las prefería y pintaba «-32.410300, -63.240000», que no le
    // dice nada a nadie. Sin coordenadas el bug no se ve.
    mockedGet.mockResolvedValue(
      detail({ latitude: "-32.410300", longitude: "-63.240000" }) as never,
    );

    renderDetail();

    expect(await screen.findByText(/Buenos Aires 100/)).toBeTruthy();
    expect(screen.queryByText(/-32\.410300/)).toBeNull();
  });

  it("acorta la cola administrativa del geocodificador", async () => {
    mockedGet.mockResolvedValue(
      detail({
        address:
          "442, La Rioja, General Güemes, Villa María, Pedanía Villa María, " +
          "Departamento General San Martín, Córdoba, X5900, Argentina",
      }) as never,
    );

    renderDetail();

    // Tres tramos alcanzan para ubicarlo; el resto empuja el alto sin informar.
    expect(await screen.findByText(/442, La Rioja, General Güemes/)).toBeTruthy();
    expect(screen.queryByText(/Argentina/)).toBeNull();
  });

  it("sin dirección cae a las coordenadas, que es mejor que nada", async () => {
    mockedGet.mockResolvedValue(
      detail({ address: "", latitude: "-32.410300", longitude: "-63.240000" }) as never,
    );

    renderDetail();

    expect(await screen.findByText(/-32\.410300/)).toBeTruthy();
  });
});

describe("hilo de resolución del detalle", () => {
  it("va en orden: cierre, objeción, cierre final", async () => {
    // El caso de una apelación: el operario cierra, el vecino objeta, el
    // operario vuelve a cerrar. Antes se pintaban las dos listas seguidas
    // —los dos cierres y después la objeción— y el hilo quedaba al revés de
    // como pasó: parecía que el vecino objetó el trabajo final.
    mockedGet.mockResolvedValue(
      detail({
        resolution_evidences: [
          {
            id: 1,
            photo: CLOSURE_PHOTO,
            description: "Primer cierre.",
            created_at: "2026-09-09T13:00:00Z",
            operational_area: "Obras Públicas",
          },
          {
            id: 2,
            photo: "https://example.test/cierre-2.jpg",
            description: "Cierre final.",
            created_at: "2026-09-09T15:00:00Z",
            operational_area: "Obras Públicas",
          },
        ],
        resolution_appeals: [
          {
            id: 1,
            photo: APPEAL_PHOTO,
            reason: "Sigue igual.",
            created_at: "2026-09-09T14:00:00Z",
          },
        ],
      }) as never,
    );

    renderDetail();
    await screen.findByText("Primer cierre.");

    // La objeción queda **entre** los dos cierres, no al final.
    const textos = ["Primer cierre.", "Sigue igual.", "Cierre final."].map(
      (t) => screen.getByText(t),
    );
    const orden = renderedPhotos();
    expect(orden).toEqual([
      "https://example.test/reporte.jpg",
      CLOSURE_PHOTO,
      APPEAL_PHOTO,
      "https://example.test/cierre-2.jpg",
    ]);
    expect(textos).toHaveLength(3);
  });


  it("muestra la foto del cierre y la de la objeción, para poder compararlas", async () => {
    renderDetail();

    expect(await screen.findByText("Se repuso la baldosa.")).toBeTruthy();
    expect(screen.getByText("Sigue igual.")).toBeTruthy();

    const photos = renderedPhotos();
    expect(photos).toContain(CLOSURE_PHOTO);
    // La que faltaba: sin ella el hilo mostraba lo que dice el municipio y no
    // lo que aporta quien objeta.
    expect(photos).toContain(APPEAL_PHOTO);
  });

  it("una objeción sin foto no deja un hueco", async () => {
    mockedGet.mockResolvedValue(
      detail({
        resolution_appeals: [
          {
            id: 1,
            photo: "",
            reason: "Sigue igual.",
            created_at: "2026-09-09T13:47:00Z",
          },
        ],
      }) as never,
    );

    renderDetail();

    expect(await screen.findByText("Sigue igual.")).toBeTruthy();
    expect(renderedPhotos()).not.toContain(APPEAL_PHOTO);
  });
});
