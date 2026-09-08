import { render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import NoticesTab from "../../../app/(app)/(tabs)/notices";
import {
  listNotifications,
  type Notification,
  type PaginatedNotifications,
} from "../../api/notifications";
import { useUnread } from "../UnreadContext";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (callback: () => void) =>
    (require("react") as typeof import("react")).useEffect(callback, [callback]),
}));

// Los iconos no son lo que se prueba acá, y `expo-font` —del que dependen— no
// está instalado en este árbol de node_modules.
jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../api/notifications", () => ({
  listNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));

jest.mock("../UnreadContext", () => ({
  useUnread: jest.fn(),
  formatUnreadBadge: () => undefined,
}));

const mockedList = listNotifications as jest.MockedFunction<typeof listNotifications>;
const mockedUnread = useUnread as jest.MockedFunction<typeof useUnread>;

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function notification(kind: string, message: string): Notification {
  return {
    id: Math.floor(Math.random() * 10000),
    kind: kind as Notification["kind"],
    actor: null,
    report_id: 7,
    message,
    previous_status: "",
    new_status: "",
    reason: "",
    is_read: false,
    created_at: "2026-09-08T10:00:00Z",
  };
}

function page(results: Notification[]): PaginatedNotifications {
  return { count: results.length, next: null, previous: null, results };
}

function renderNotices() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <NoticesTab />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUnread.mockReturnValue({
    unread: 0,
    refreshUnread: jest.fn(),
    applyUnreadDelta: jest.fn(),
    clearUnread: jest.fn(),
  } as never);
});

describe("bandeja de avisos", () => {
  it("dibuja los tipos que emite el backend", async () => {
    // Los cuatro últimos los sumaron US-024, US-031, US-047 y US-048. Antes de
    // tenerlos declarados acá, cualquiera de ellos rompía la pantalla entera.
    mockedList.mockResolvedValue(
      page([
        notification("cambio_estado", "Tu reporte avanzó."),
        notification("nuevo_comentario", "Alguien comentó."),
        notification("nuevo_like", "Alguien apoyó tu reporte."),
        notification("respuesta_oficial", "El municipio respondió."),
        notification("proximo_archivado", "Tu reporte se archivará pronto."),
        notification("proxima_confirmacion", "El plazo está por vencer."),
        notification("apelacion_cierre", "Un vecino objetó el cierre."),
      ]),
    );

    renderNotices();

    expect(await screen.findByText("El municipio respondió.")).toBeTruthy();
    expect(screen.getByText("Un vecino objetó el cierre.")).toBeTruthy();
    expect(screen.getByText("El plazo está por vencer.")).toBeTruthy();
  });

  it("un tipo que la app todavía no conoce no rompe la bandeja", async () => {
    // El catálogo lo define el backend y la app se actualiza aparte. Sin el
    // respaldo, `KIND_STYLE[kind]` daba `undefined` y leerle `background`
    // reventaba el render de **toda** la lista, no de esa fila.
    mockedList.mockResolvedValue(
      page([
        notification("un_tipo_del_futuro", "Aviso de un tipo que todavía no existe."),
        notification("cambio_estado", "Tu reporte avanzó."),
      ]),
    );

    renderNotices();

    await waitFor(() =>
      expect(
        screen.getByText("Aviso de un tipo que todavía no existe."),
      ).toBeTruthy(),
    );
    // El resto de la bandeja sigue en pie.
    expect(screen.getByText("Tu reporte avanzó.")).toBeTruthy();
  });
});
