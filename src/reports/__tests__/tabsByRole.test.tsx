import { render, screen } from "@testing-library/react-native";

import TabsLayout from "../../../app/(app)/(tabs)/_layout";
import type { UserProfile, UserRole } from "../../api/users";
import { useAuth } from "../../auth/AuthContext";

/**
 * US-045, escenario 8 — el alcance de la app se decide por rol en el arranque
 * de la sesión, no pantalla por pantalla.
 *
 * `Tabs.Protected` no esconde la pestaña: la saca de la navegación, así que una
 * ruta que no está declarada tampoco se alcanza escribiéndola a mano. El test
 * mira exactamente eso —qué rutas quedan declaradas para cada rol— reemplazando
 * las primitivas del navegador por algo que las liste.
 */
jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");

  function Tabs({ children }: { children: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  // El guard es el comportamiento: con `false`, los hijos no se declaran.
  Tabs.Protected = function Protected({
    guard,
    children,
  }: {
    guard: boolean;
    children: React.ReactNode;
  }) {
    return guard ? React.createElement(React.Fragment, null, children) : null;
  };
  Tabs.Screen = function Screen({ name }: { name: string }) {
    return React.createElement(Text, null, `ruta:${name}`);
  };

  return { Tabs, useRouter: () => ({ back: jest.fn(), push: jest.fn() }) };
});

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));

jest.mock("../../notifications/UnreadContext", () => ({
  useUnread: () => ({ unread: 0, refresh: jest.fn(), setUnread: jest.fn() }),
  formatUnreadBadge: () => undefined,
}));

jest.mock("../../components/floatingTabBar", () => ({
  FloatingTabBar: () => null,
  TAB_BAR_HEIGHT: 64,
}));

const mockedAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function userWith(role: UserRole): UserProfile {
  return {
    id: 1,
    name: "Persona",
    email: "persona@example.test",
    avatar: null,
    role,
    municipality: null,
    must_change_password: false,
    is_public: true,
    url: "http://example.test/api/users/1/",
  };
}

function signedInAs(role: UserRole) {
  mockedAuth.mockReturnValue({ user: userWith(role) } as ReturnType<typeof useAuth>);
  render(<TabsLayout />);
}

/** Las rutas que quedaron declaradas para el rol de la sesión. */
function declaredRoutes(): string[] {
  return screen
    .queryAllByText(/^ruta:/)
    .map((node) => String(node.props.children).replace("ruta:", ""));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("la navegación se resuelve por rol", () => {
  it("el operario entra a su bandeja y a nada más que su perfil", () => {
    signedInAs("operario");

    expect(declaredRoutes()).toEqual(["work", "profile"]);
  });

  it("el operario no alcanza el feed, el mapa ni los avisos escribiendo la ruta", () => {
    signedInAs("operario");

    const routes = declaredRoutes();
    for (const forbidden of ["index", "map", "notices", "create-tab", "report/[id]"]) {
      expect(routes).not.toContain(forbidden);
    }
  });

  it("el vecino conserva el feed, el mapa, el alta y los avisos, y no ve la bandeja", () => {
    signedInAs("ciudadano");

    const routes = declaredRoutes();
    expect(routes).toEqual(
      expect.arrayContaining(["index", "map", "create-tab", "notices", "report/[id]"]),
    );
    expect(routes).not.toContain("work");
  });

  it("el validador ve su bandeja de validación pero no la de trabajo ni el alta", () => {
    signedInAs("validador");

    const routes = declaredRoutes();
    expect(routes).toContain("validate");
    expect(routes).not.toContain("work");
    // Es una cuenta de trabajo: no reporta como vecina.
    expect(routes).not.toContain("create-tab");
  });

  it("todos los roles conservan el perfil: es de donde se sale de la sesión", () => {
    for (const role of ["ciudadano", "operario", "validador"] as const) {
      signedInAs(role);
      expect(declaredRoutes()).toContain("profile");
      screen.unmount();
    }
  });
});
