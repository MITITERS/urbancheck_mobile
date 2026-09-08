import {
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import ProfileScreen from "../../../app/(app)/(tabs)/profile";
import { listResolvedWork } from "../../api/operator";
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
  // Las reglas de rol son las de verdad: son las que deciden qué secciones
  // existen en esta pantalla y de qué endpoint sale la lista.
  participatesAsCitizen: jest.requireActual("../../api/users").participatesAsCitizen,
  isOperator: jest.requireActual("../../api/users").isOperator,
}));
jest.mock("../../api/reports", () => ({ listMyReports: jest.fn() }));
jest.mock("../../api/operator", () => ({ listResolvedWork: jest.fn() }));
jest.mock("../../api/auth", () => ({ logout: jest.fn() }));
jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedGetMe = getMe as jest.MockedFunction<typeof getMe>;
const mockedListMyReports = listMyReports as jest.MockedFunction<typeof listMyReports>;
const mockedListResolvedWork = listResolvedWork as jest.MockedFunction<
  typeof listResolvedWork
>;
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
  is_public: true,
  url: "/api/users/1/",
};

const OPERATOR: UserProfile = {
  id: 7,
  name: "Ramiro Paz",
  email: "ramiro@villamaria.gob.ar",
  avatar: null,
  role: "operario",
  municipality: { id: 4, name: "Villa María" },
  must_change_password: false,
  is_public: true,
  operational_area: { id: 2, name: "Alumbrado", is_active: true },
  url: "/api/users/7/",
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
    has_official_response: false,
    archived_at: null,
    area_assigned_at: null,
    appeal_count: 0,
  };
}
type UserReportStatus =
  | "reportado"
  | "en_proceso"
  | "resuelto"
  | "resuelto_pendiente_confirmacion";

/** Un trabajo cerrado, tal como lo devuelve el historial del operario. */
function work(id: number, status: UserReportStatus, resolvedAt: string) {
  return { ...report(id, status), resolved_at: resolvedAt };
}

/** Entra a la pantalla como operario, con el historial que se le indique. */
function asOperator(results: ReturnType<typeof work>[]) {
  mockedGetMe.mockResolvedValue(OPERATOR);
  mockedUseAuth.mockReturnValue({
    user: OPERATOR,
    token: "t",
    isLoading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    setUser: jest.fn(),
    refreshUser: jest.fn(),
  });
  mockedListResolvedWork.mockResolvedValue({
    count: results.length,
    next: null,
    previous: null,
    results,
  });
}

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
  mockedListResolvedWork.mockResolvedValue({
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

/**
 * US-046 — el operario ve en su perfil los trabajos que cerró, como el vecino
 * ve los que reportó. Misma sección plegable y mismo resumen de tres cifras;
 * lo que cambia es de dónde sale la lista y qué mide cada número.
 */
describe("perfil del operario", () => {
  it("lista los trabajos que cerró en vez de reportes propios", async () => {
    asOperator([work(1, "resuelto", "2026-09-05T12:00:00Z")]);

    renderProfile();

    expect(await screen.findByText("Trabajos resueltos")).toBeTruthy();
    expect(screen.getByText("Reporte 1")).toBeTruthy();
    // El operario no reporta: pedirle la lista del vecino sería pedir algo que
    // siempre viene vacío.
    await waitFor(() => expect(mockedListMyReports).not.toHaveBeenCalled());
    expect(screen.queryByText("Mis reportes")).toBeNull();
  });

  it("el resumen cuenta cierres, no reportes", async () => {
    asOperator([
      work(1, "resuelto", "2026-09-05T12:00:00Z"),
      work(2, "resuelto_pendiente_confirmacion", "2026-09-06T12:00:00Z"),
      // Objetado por el vecino (US-048): volvió a gestión, así que suma en el
      // total pero no en las otras dos cifras.
      work(3, "en_proceso", "2026-09-07T12:00:00Z"),
    ]);

    renderProfile();

    expect(await screen.findByText("Cerrados")).toBeTruthy();
    expect(screen.getByText("A confirmar")).toBeTruthy();
    expect(screen.getByText("Confirmados")).toBeTruthy();
    // Las etiquetas del vecino no aparecen: mide otra cosa.
    expect(screen.queryByText("Reportes")).toBeNull();
  });

  it("cada fila muestra la fecha de su cierre, no la del reporte", async () => {
    asOperator([work(1, "resuelto", "2026-09-05T12:00:00Z")]);

    renderProfile();

    expect(await screen.findByText("Cerrado 05/09/2026")).toBeTruthy();
    // 27/08 es el `created_at` del reporte: al operario no le dice nada.
    expect(screen.queryByText("27/08/2026")).toBeNull();
  });

  it("sin cierres, lo manda a su bandeja y no a crear un reporte", async () => {
    asOperator([]);

    renderProfile();

    expect(
      await screen.findByText("Todavía no cerraste ningún trabajo"),
    ).toBeTruthy();
    expect(screen.getByText("Ver mis trabajos")).toBeTruthy();
    expect(screen.queryByText("Crear mi primer reporte")).toBeNull();
  });

  it("«Trabajos resueltos» se pliega y se despliega", async () => {
    asOperator([work(1, "resuelto", "2026-09-05T12:00:00Z")]);
    const user = userEvent.setup();

    renderProfile();
    expect(await screen.findByText("Reporte 1")).toBeTruthy();

    await user.press(screen.getByText("Trabajos resueltos"));
    expect(screen.queryByText("Reporte 1")).toBeNull();
    // Plegada tampoco aparece el vacío: la lista está guardada, no vacía.
    expect(screen.queryByText("Todavía no cerraste ningún trabajo")).toBeNull();

    await user.press(screen.getByText("Trabajos resueltos"));
    expect(await screen.findByText("Reporte 1")).toBeTruthy();
  });
});
