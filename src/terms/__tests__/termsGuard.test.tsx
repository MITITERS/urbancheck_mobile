import { render, screen } from "@testing-library/react-native";

import RootLayout from "../../../app/_layout";
import type { UserProfile, UserRole } from "../../api/users";
import { useAuth } from "../../auth/AuthContext";

/**
 * RN-10 (C-23) — el vecino que no aceptó los términos vigentes solo ve esa
 * pantalla. Igual que el guard del tutorial, el test mira qué rutas quedan
 * declaradas: una ruta que no está tampoco se alcanza escribiéndola a mano.
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

function signedInAs(role: UserRole, extra: Partial<UserProfile> = {}) {
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
      onboarding_completed_at: "2026-01-01T00:00:00Z",
      is_public: true,
      url: "http://example.test/api/users/1/",
      ...extra,
    },
    signIn: jest.fn(),
    signOut: jest.fn(),
    setUser: jest.fn(),
    refreshUser: jest.fn(),
    replaceToken: jest.fn(),
  });
}

describe("guard de términos y condiciones", () => {
  it("RN-10 · el vecino que no aceptó los vigentes solo ve la aceptación", () => {
    signedInAs("ciudadano", { must_accept_terms: true });

    render(<RootLayout />);

    expect(screen.getByText("ruta:accept-terms")).toBeTruthy();
    expect(screen.queryByText("ruta:(app)")).toBeNull();
    expect(screen.queryByText("ruta:onboarding")).toBeNull();
  });

  it("RN-10 · después de aceptar entra a la app", () => {
    signedInAs("ciudadano", { must_accept_terms: false });

    render(<RootLayout />);

    expect(screen.getByText("ruta:(app)")).toBeTruthy();
    expect(screen.queryByText("ruta:accept-terms")).toBeNull();
  });

  it("RN-10 · los términos van antes que el tutorial", () => {
    signedInAs("ciudadano", { must_accept_terms: true, onboarding_completed_at: null });

    render(<RootLayout />);

    expect(screen.getByText("ruta:accept-terms")).toBeTruthy();
    expect(screen.queryByText("ruta:onboarding")).toBeNull();
  });

  it("RN-10 · la contraseña temporal va primero", () => {
    signedInAs("ciudadano", { must_accept_terms: true, must_change_password: true });

    render(<RootLayout />);

    expect(screen.getByText("ruta:change-password")).toBeTruthy();
    expect(screen.queryByText("ruta:accept-terms")).toBeNull();
  });

  it("RN-10 · una cuenta de trabajo nunca pasa por la aceptación", () => {
    signedInAs("validador", { must_accept_terms: true });

    render(<RootLayout />);

    expect(screen.queryByText("ruta:accept-terms")).toBeNull();
    expect(screen.getByText("ruta:(app)")).toBeTruthy();
  });

  it("sin el campo (backend anterior) no se exige nada", () => {
    signedInAs("ciudadano");

    render(<RootLayout />);

    expect(screen.getByText("ruta:(app)")).toBeTruthy();
  });
});
