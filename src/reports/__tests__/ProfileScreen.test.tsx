import {
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import ProfileScreen from "../../../app/(app)/(tabs)/profile";
import { listMyReports } from "../../api/reports";
import { getMe, type UserProfile } from "../../api/users";
import { useAuth } from "../../auth/AuthContext";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (callback: () => void) =>
    (require("react") as typeof import("react")).useEffect(callback, [callback]),
}));

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../api/users", () => ({
  getMe: jest.fn(),
  // La regla de quién participa como vecino es la de verdad: es lo que decide
  // qué secciones existen en esta pantalla.
  participatesAsCitizen: jest.requireActual("../../api/users").participatesAsCitizen,
}));
jest.mock("../../api/reports", () => ({ listMyReports: jest.fn() }));
jest.mock("../../api/auth", () => ({ logout: jest.fn() }));
jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedGetMe = getMe as jest.MockedFunction<typeof getMe>;
const mockedListMyReports = listMyReports as jest.MockedFunction<typeof listMyReports>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const CITIZEN: UserProfile = {
  id: 1,
  name: "Lucas Leone",
  email: "lucas@test.com",
  avatar: null,
  role: "ciudadano",
  municipality: null,
  must_change_password: false,
  url: "/api/users/1/",
};

function report(id: number, status: UserReportStatus) {
  return {
    id,
    photo: "https://example.test/r.jpg",
    description: `Reporte ${id}`,
    category: "bache" as const,
    latitude: null,
    longitude: null,
    address: "",
    status,
    author: { id: 1, name: "Lucas Leone", avatar: null },
    like_count: 0,
    comment_count: 0,
    created_at: "2026-08-27T10:00:00Z",
  };
}
type UserReportStatus = "reportado" | "en_proceso" | "resuelto";

function renderProfile() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ProfileScreen />
    </SafeAreaProvider>,
  );
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
  mockedGetMe.mockResolvedValue(CITIZEN);
  mockedListMyReports.mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
});

describe("perfil", () => {
  it("resume la actividad con las cifras de la misma lista que muestra", async () => {
    mockedListMyReports.mockResolvedValue({
      count: 3,
      next: null,
      previous: null,
      results: [
        report(1, "reportado"),
        report(2, "en_proceso"),
        report(3, "resuelto"),
      ],
    });

    renderProfile();

    expect(await screen.findByText("Mis reportes")).toBeTruthy();
    // Las etiquetas del resumen, en plural, no se confunden con las de estado
    // de cada tarjeta ("Resuelto", "En proceso").
    expect(screen.getByText("Reportes")).toBeTruthy();
    expect(screen.getByText("Resueltos")).toBeTruthy();
    // Dos veces "En proceso": la etiqueta del resumen y la insignia del
    // reporte que está en ese estado.
    expect(screen.getAllByText("En proceso")).toHaveLength(2);
  });

  it("sin reportes, invita a crear el primero", async () => {
    renderProfile();

    expect(await screen.findByText("Todavía no reportaste nada")).toBeTruthy();
    expect(screen.getByText("Crear mi primer reporte")).toBeTruthy();
  });

  it("a una cuenta de trabajo no le muestra «Mis reportes» ni le pide la lista", async () => {
    const validator: UserProfile = {
      ...CITIZEN,
      role: "validador",
      municipality: { id: 4, name: "Villa María" },
    };
    mockedGetMe.mockResolvedValue(validator);
    mockedUseAuth.mockReturnValue({
      user: validator,
      token: "t",
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      setUser: jest.fn(),
      refreshUser: jest.fn(),
    });

    renderProfile();

    expect(await screen.findByText("Validador")).toBeTruthy();
    expect(screen.queryByText("Mis reportes")).toBeNull();
    await waitFor(() => expect(mockedListMyReports).not.toHaveBeenCalled());
  });

  it("«Mis reportes» se pliega y se despliega", async () => {
    mockedListMyReports.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [report(1, "reportado")],
    });
    const user = userEvent.setup();

    renderProfile();
    // Arranca desplegada: el reporte se ve sin tocar nada.
    expect(await screen.findByText("Reporte 1")).toBeTruthy();

    await user.press(screen.getByText("Mis reportes"));
    expect(screen.queryByText("Reporte 1")).toBeNull();
    // Plegada tampoco aparece el vacío: la lista está guardada, no vacía.
    expect(screen.queryByText("Todavía no reportaste nada")).toBeNull();

    await user.press(screen.getByText("Mis reportes"));
    expect(await screen.findByText("Reporte 1")).toBeTruthy();
  });

  it("las acciones son filas, no botones apretados en una línea", async () => {
    renderProfile();

    expect(await screen.findByText("Editar perfil")).toBeTruthy();
    expect(screen.getByText("Notificaciones")).toBeTruthy();
    expect(screen.getByText("Cerrar sesión")).toBeTruthy();
  });
});
