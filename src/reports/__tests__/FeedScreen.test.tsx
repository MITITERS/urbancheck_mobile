import { render, screen, waitFor } from "@testing-library/react-native";

import FeedScreen from "../../../app/(app)/(tabs)/index";
import { listReports, type PaginatedReports } from "../../api/reports";
import type { UserProfile } from "../../api/users";
import { useAuth } from "../../auth/AuthContext";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  // La pantalla carga al enfocarse; en el test alcanza con un efecto normal.
  // El require va adentro: la fábrica del mock se hoistea sobre los imports.
  useFocusEffect: (callback: () => void) =>
    (require("react") as typeof import("react")).useEffect(callback, [callback]),
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3, High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock("../../api/reports", () => ({ listReports: jest.fn() }));
jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));

const Location = jest.requireMock("expo-location");
const mockedListReports = listReports as jest.MockedFunction<typeof listReports>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const CITIZEN: UserProfile = {
  id: 1,
  name: "Vecina",
  email: "vecina@test.com",
  avatar: null,
  role: "ciudadano",
  municipality: null,
  must_change_password: false,
  url: "/api/users/1/",
};

const HERE = { latitude: -32.4103, longitude: -63.24 };

const REPORT = {
  id: 7,
  photo: "https://example.test/report.jpg",
  description: "Un bache enorme en la esquina",
  category: "bache" as const,
  latitude: "-32.41",
  longitude: "-63.24",
  address: "Buenos Aires 100",
  status: "reportado" as const,
  author: { id: 2, name: "Otro", avatar: null },
  like_count: 3,
  comment_count: 1,
  created_at: "2026-08-27T10:00:00Z",
};

function feedResponse(overrides: Partial<PaginatedReports> = {}): PaginatedReports {
  return { count: 0, next: null, previous: null, results: [], ...overrides };
}

function signedInAs(user: UserProfile | null) {
  mockedUseAuth.mockReturnValue({
    user,
    token: "t",
    isLoading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    setUser: jest.fn(),
    refreshUser: jest.fn(),
  });
}

function locationGranted(coords = HERE) {
  Location.getForegroundPermissionsAsync.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  Location.getCurrentPositionAsync.mockResolvedValue({ coords });
}

function locationDenied() {
  Location.getForegroundPermissionsAsync.mockResolvedValue({
    granted: false,
    canAskAgain: true,
  });
  Location.requestForegroundPermissionsAsync.mockResolvedValue({
    granted: false,
    canAskAgain: true,
  });
}

beforeEach(() => {
  signedInAs(CITIZEN);
  locationGranted();
  mockedListReports.mockResolvedValue(feedResponse());
});

describe("feed acotado al municipio", () => {
  it("pide el feed con la ubicación del vecino", async () => {
    render(<FeedScreen />);

    await waitFor(() => expect(mockedListReports).toHaveBeenCalledWith(1, HERE));
  });

  it("muestra los reportes y el municipio que los cubre", async () => {
    mockedListReports.mockResolvedValue(
      feedResponse({
        count: 1,
        results: [REPORT],
        coverage: {
          in_coverage: true,
          municipality: { id: 4, city: "Villa María", province: "Córdoba" },
        },
      }),
    );

    render(<FeedScreen />);

    expect(await screen.findByText("Reportes de Villa María")).toBeTruthy();
    expect(screen.getByText(REPORT.description)).toBeTruthy();
  });

  it("fuera de cobertura no muestra ningún reporte y lo explica", async () => {
    mockedListReports.mockResolvedValue(
      feedResponse({ coverage: { in_coverage: false, municipality: null } }),
    );

    render(<FeedScreen />);

    expect(await screen.findByText(/fuera del área de cobertura/i)).toBeTruthy();
    expect(screen.queryByText(REPORT.description)).toBeNull();
    // El mensaje de "todavía no hay reportes" diría algo muy distinto.
    expect(screen.queryByText(/no hay reportes aún/i)).toBeNull();
  });

  it("dentro de cobertura y sin reportes, nombra la ciudad", async () => {
    mockedListReports.mockResolvedValue(
      feedResponse({
        coverage: {
          in_coverage: true,
          municipality: { id: 4, city: "Villa María", province: "Córdoba" },
        },
      }),
    );

    render(<FeedScreen />);

    expect(await screen.findByText("Todavía no hay reportes en Villa María.")).toBeTruthy();
  });

  it("sin permiso de ubicación no pide el feed y explica por qué", async () => {
    locationDenied();

    render(<FeedScreen />);

    expect(await screen.findByText(/necesitamos tu ubicación/i)).toBeTruthy();
    expect(mockedListReports).not.toHaveBeenCalled();
  });

  it("no pide una segunda página antes de tener la primera", async () => {
    // `FlatList` dispara `onEndReached` en el primer render: pedir la página 2
    // ahí devolvía 404 y el error terminaba en la consola.
    mockedListReports.mockResolvedValue(
      feedResponse({ count: 1, results: [REPORT] }),
    );

    render(<FeedScreen />);

    await waitFor(() => expect(mockedListReports).toHaveBeenCalledWith(1, HERE));
    expect(mockedListReports).toHaveBeenCalledTimes(1);
  });

  it("un error de carga se muestra en pantalla, no en la consola", async () => {
    mockedListReports.mockRejectedValue({ status: 404, detail: "Página inválida." });

    render(<FeedScreen />);

    expect(await screen.findByText(/no pudimos cargar el feed/i)).toBeTruthy();
  });

  it("con el perfil sin cargar igual acota por ubicación", async () => {
    // Si `getMe()` falló, el rol es desconocido: mostrar todos los municipios
    // sería lo contrario de lo que pide la pantalla.
    signedInAs(null);

    render(<FeedScreen />);

    await waitFor(() => expect(mockedListReports).toHaveBeenCalledWith(1, HERE));
  });

  it("una cuenta de trabajo ve el feed sin acotar y no pide ubicación", async () => {
    signedInAs({ ...CITIZEN, role: "validador", municipality: { id: 4, name: "Villa María" } });

    render(<FeedScreen />);

    await waitFor(() => expect(mockedListReports).toHaveBeenCalledWith(1, null));
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});
