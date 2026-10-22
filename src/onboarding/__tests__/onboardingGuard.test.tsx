import { render, screen } from "@testing-library/react-native";

import RootLayout from "../../../app/_layout";
import type { UserProfile, UserRole } from "../../api/users";
import { useAuth } from "../../auth/AuthContext";

/**
 * US-051 — quién ve el tutorial lo decide el arranque de sesión, en el mismo
 * punto que la contraseña temporal y la navegación por rol (US-045), no el feed.
 *
 * Igual que en `tabsByRole.test.tsx`, el test mira qué rutas quedan declaradas:
 * `Stack.Protected` saca de la navegación lo que no corresponde, así que una
 * ruta que no está declarada tampoco se alcanza escribiéndola a mano.
 */
jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");

  function Stack({ children }: { children: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }
  Stack.Protected = function Protected({
    guard,
    children,
  }: {
    guard: boolean;
    children: React.ReactNode;
  }) {
    return guard ? React.createElement(React.Fragment, null, children) : null;
  };
  Stack.Screen = function Screen({ name }: { name: string }) {
    return React.createElement(Text, null, `ruta:${name}`);
  };
  return { Stack };
});

jest.mock("../../auth/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: jest.fn(),
}));

jest.mock("../../lib/QueryProvider", () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockedAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function signedInAs(role: UserRole, onboarding: string | null, extra: Partial<UserProfile> = {}) {
  mockedAuth.mockReturnValue({
    token: "t",
    isLoading: false,
    user: {
      id: 1,
      name: "Persona",
      email: "persona@example.test",
      avatar: null,
      role,
      municipality: null,
      must_change_password: false,
      onboarding_completed_at: onboarding,
      is_public: true,
      url: "http://example.test/api/users/1/",
      ...extra,
    },
    signIn: jest.fn(),
    signOut: jest.fn(),
    setUser: jest.fn(),
    refreshUser: jest.fn(),
  });
}

describe("guard del tutorial de bienvenida", () => {
  it("CP-051-M14 (US-051 E1) · un vecino nuevo ve el tutorial antes que el feed", () => {
    signedInAs("ciudadano", null);

    render(<RootLayout />);

    expect(screen.getByText("ruta:onboarding")).toBeTruthy();
    expect(screen.queryByText("ruta:(app)")).toBeNull();
  });

  it("CP-051-M15 (US-051 E5, E9) · con la marca puesta entra directo a la app", () => {
    signedInAs("ciudadano", "2026-01-01T00:00:00Z");

    render(<RootLayout />);

    expect(screen.getByText("ruta:(app)")).toBeTruthy();
    expect(screen.queryByText("ruta:onboarding")).toBeNull();
  });

  it.each<UserRole>(["validador", "operario", "agente_municipal", "admin_plataforma"])(
    "CP-051-M16 (US-051 E8) · una cuenta %s nunca ve el tutorial",
    (role) => {
      signedInAs(role, null);

      render(<RootLayout />);

      expect(screen.queryByText("ruta:onboarding")).toBeNull();
      expect(screen.getByText("ruta:(app)")).toBeTruthy();
    },
  );

  it("la contraseña temporal va primero que el tutorial", () => {
    signedInAs("ciudadano", null, { must_change_password: true });

    render(<RootLayout />);

    expect(screen.getByText("ruta:change-password")).toBeTruthy();
    expect(screen.queryByText("ruta:onboarding")).toBeNull();
  });
});
