import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import WorkInboxScreen from "../../../app/(app)/(tabs)/work";
import { listAssignedWork, type PaginatedWork } from "../../api/operator";

const mockedPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockedPush }),
  // La pantalla carga al enfocarse; en el test alcanza con un efecto normal.
  // El require va adentro: la fábrica del mock se hoistea sobre los imports.
  useFocusEffect: (callback: () => void) =>
    (require("react") as typeof import("react")).useEffect(callback, [callback]),
}));

// Los iconos no son lo que se prueba acá, y `expo-font` —del que dependen— no
// está instalado en este árbol de node_modules.
jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../api/operator", () => ({ listAssignedWork: jest.fn() }));

const mockedList = listAssignedWork as jest.MockedFunction<typeof listAssignedWork>;

const WORK = {
  id: 7,
  photo: "https://example.test/report.jpg",
  description: "Bache enorme en la esquina",
  category: "bache" as const,
  latitude: "-32.41",
  longitude: "-63.24",
  address: "Buenos Aires 100",
  status: "en_proceso" as const,
  author: { id: 2, name: "Vecina", avatar: null },
  like_count: 0,
  comment_count: 0,
  created_at: "2026-08-01T10:00:00Z",
  has_official_response: false,
  archived_at: null,
  area_assigned_at: "2026-08-27T10:00:00Z",
  appeal_count: 0,
};

function response(overrides: Partial<PaginatedWork> = {}): PaginatedWork {
  return { count: 0, next: null, previous: null, results: [], ...overrides };
}

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** La bandeja reserva el espacio de la barra flotante: necesita las insets. */
function renderInbox() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <WorkInboxScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("bandeja del operario", () => {
  it("muestra los trabajos con lo que hace falta para llegar al lugar", async () => {
    mockedList.mockResolvedValue(response({ count: 1, results: [WORK] }));

    renderInbox();

    expect(await screen.findByText("Bache")).toBeTruthy();
    expect(screen.getByText(WORK.address)).toBeTruthy();
    expect(screen.getByText(WORK.description)).toBeTruthy();
  });

  it("fecha cada trabajo por su asignación, no por su alta", async () => {
    // Escenario 2: lo que importa es hace cuánto está esperando el área.
    mockedList.mockResolvedValue(response({ count: 1, results: [WORK] }));

    renderInbox();

    expect(
      await screen.findByText(/Asignado el 27\/8\/2026/),
    ).toBeTruthy();
  });

  it("con la bandeja vacía lo dice en lugar de dejar la pantalla en blanco", async () => {
    // Escenario 9: una lista vacía no distingue "no hay trabajo" de un error.
    mockedList.mockResolvedValue(response());

    renderInbox();

    expect(await screen.findByText("No hay trabajos pendientes")).toBeTruthy();
  });

  it("una cuenta o un área desactivadas muestran el motivo que da el servidor", async () => {
    // Escenario 11 de US-045: el operario tiene que entender por qué no entra.
    // El cliente lanza el cuerpo de la respuesta tal cual.
    mockedList.mockRejectedValue({
      status: 403,
      detail: "Tu área operativa dejó de operar.",
    });

    renderInbox();

    await waitFor(() =>
      expect(screen.getByText("Tu área operativa dejó de operar.")).toBeTruthy(),
    );
  });

  it("abre el detalle por la ruta del operario, no por la del feed", async () => {
    // La del feed le responde 403: su superficie es otra (escenario 8).
    mockedList.mockResolvedValue(response({ count: 1, results: [WORK] }));
    renderInbox();

    fireEvent.press(await screen.findByLabelText("Trabajo Bache"));

    expect(mockedPush).toHaveBeenCalledWith("/(app)/work-report/7");
  });
});
