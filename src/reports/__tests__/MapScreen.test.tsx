import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import MapTab from "../../../app/(app)/(tabs)/map";
import { listMapReports } from "../../api/reports";
import type { UserProfile } from "../../api/users";
import { useAuth } from "../../auth/AuthContext";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

jest.mock("react-native-maps", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  // El mapa expone `animateToRegion` por ref: es la única forma de ver a dónde
  // se movió la vista sin un mapa real.
  const animateToRegion = jest.fn();
  const MapView = React.forwardRef(
    (props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ animateToRegion }));
      return React.createElement(View, props);
    },
  );
  return {
    __esModule: true,
    default: MapView,
    Marker: View,
    Callout: View,
    animateToRegion,
  };
});

// Los iconos no son lo que se prueba acá, y `expo-font` —del que dependen— no
// está instalado en este árbol de node_modules.
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

jest.mock("../../api/reports", () => ({ listMapReports: jest.fn() }));
jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));

const Location = jest.requireMock("expo-location");
const { animateToRegion } = jest.requireMock("react-native-maps");
const mockedListMapReports = listMapReports as jest.MockedFunction<
  typeof listMapReports
>;
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

/** Un dispositivo con home indicator: la barra flotante sube la leyenda. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderMap() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <MapTab />
    </SafeAreaProvider>,
  );
}

const MARKER = {
  id: 7,
  photo: "https://example.test/report.jpg",
  category: "bache" as const,
  status: "reportado" as const,
  latitude: "-32.41",
  longitude: "-63.24",
  address: "Buenos Aires 100",
  like_count: 3,
};

function signedInAs(user: UserProfile) {
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

beforeEach(() => {
  signedInAs(CITIZEN);
  Location.getForegroundPermissionsAsync.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  Location.getCurrentPositionAsync.mockResolvedValue({ coords: HERE });
  mockedListMapReports.mockResolvedValue({ results: [] });
});

describe("mapa acotado al municipio", () => {
  it("pide los marcadores con la ubicación del vecino", async () => {
    renderMap();

    await waitFor(() => expect(mockedListMapReports).toHaveBeenCalledWith(HERE));
  });

  it("fuera de cobertura no muestra marcadores y lo explica", async () => {
    mockedListMapReports.mockResolvedValue({
      results: [],
      coverage: { in_coverage: false, municipality: null },
    });

    renderMap();

    expect(await screen.findByText(/fuera del área de cobertura/i)).toBeTruthy();
  });

  it("dentro de cobertura y sin marcadores, nombra la ciudad", async () => {
    mockedListMapReports.mockResolvedValue({
      results: [],
      coverage: {
        in_coverage: true,
        municipality: { id: 4, city: "Villa María", province: "Córdoba" },
      },
    });

    renderMap();

    expect(
      await screen.findByText("Todavía no hay reportes geolocalizados en Villa María."),
    ).toBeTruthy();
  });

  it("sin permiso de ubicación no pide los marcadores y explica por qué", async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });

    renderMap();

    expect(await screen.findByText(/necesitamos tu ubicación/i)).toBeTruthy();
    expect(mockedListMapReports).not.toHaveBeenCalled();
  });

  it("a la cuenta de trabajo no la acota, pero le centra el mapa", async () => {
    signedInAs({
      ...CITIZEN,
      role: "validador",
      municipality: { id: 4, name: "Villa María" },
    });
    mockedListMapReports.mockResolvedValue({ results: [MARKER] });

    renderMap();

    // Sin coordenadas en la consulta: su jurisdicción ya la resuelve el
    // servidor. La ubicación se sigue usando para centrar la vista.
    await waitFor(() => expect(mockedListMapReports).toHaveBeenCalledWith(null));
    expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
  });
});

describe("botón de mi ubicación", () => {
  it("pide una posición fresca y lleva el mapa hasta ahí", async () => {
    const AHORA = { latitude: -32.5, longitude: -63.3 };
    Location.getCurrentPositionAsync.mockResolvedValueOnce({ coords: HERE });
    Location.getCurrentPositionAsync.mockResolvedValueOnce({ coords: AHORA });

    renderMap();
    await waitFor(() => expect(mockedListMapReports).toHaveBeenCalled());

    await userEvent.press(screen.getByText("Mi ubicación"));

    // Lleva el mapa a la lectura del momento, no a la del arranque: el botón
    // dice "mi ubicación", y la de hace diez minutos ya no lo es.
    await waitFor(() =>
      expect(animateToRegion).toHaveBeenCalledWith(
        expect.objectContaining(AHORA),
        expect.any(Number),
      ),
    );
  });

  it("sin permiso, el botón sirve para concederlo", async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });

    renderMap();
    await screen.findByText("Mi ubicación");
    Location.requestForegroundPermissionsAsync.mockClear();

    await userEvent.press(screen.getByText("Mi ubicación"));

    await waitFor(() =>
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled(),
    );
  });
});
