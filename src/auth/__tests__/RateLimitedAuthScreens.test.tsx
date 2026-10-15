import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import LoginScreen from "../../../app/(auth)/login";
import RegisterScreen from "../../../app/(auth)/register";
import ForgotPasswordScreen from "../../../app/(auth)/forgot-password";
import ResetPasswordScreen from "../../../app/reset-password";
import ChangePasswordScreen from "../../../app/change-password";
import {
  changePassword,
  login,
  requestPasswordReset,
  resetPassword,
  signup,
} from "../../api/auth";
import { renderWithProviders } from "../../test/renderWithProviders";

/**
 * Límites de intentos de allauth en las pantallas de cuenta (Sprint 5, 5.1).
 *
 * Cuando el servidor frena por límite responde 429. El bloqueo de login trae
 * un error sin campo, y la pantalla lo leía como "email o contraseña
 * incorrectos": la persona seguía probando contraseñas —y extendiendo el
 * bloqueo— por algo que no estaba mal. Acá cada pantalla tiene que decir que
 * hay que esperar, y nada más.
 */

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ key: "clave-de-prueba" }),
}));

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../api/auth", () => ({
  login: jest.fn(),
  logout: jest.fn(),
  signup: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  changePassword: jest.fn(),
}));

jest.mock("../AuthContext", () => ({
  useAuth: () => ({
    signIn: jest.fn(),
    signOut: jest.fn(),
    refreshUser: jest.fn(),
  }),
}));

/** Cómo llega el bloqueo de login de allauth después de `resolveResponse`. */
const LOGIN_LOCKED = {
  status: 429,
  errors: [
    {
      code: "too_many_login_attempts",
      message: "Too many failed login attempts. Try again later.",
    },
  ],
};

/** Un 429 de allauth sin cuerpo JSON (registro, recuperación). */
const ALLAUTH_LIMITED = { status: 429, detail: "Too Many Requests" };

const WAIT_MESSAGE = /Esperá unos minutos/;

let alert: jest.SpyInstance;

beforeEach(() => {
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

function lastAlert(): { title: string; message: string } {
  const call = alert.mock.calls[alert.mock.calls.length - 1];
  return { title: call?.[0], message: call?.[1] };
}

describe("límites de intentos en las pantallas de cuenta", () => {
  it("CP-SEC05-51 · login: el bloqueo dice que hay que esperar, no que la contraseña está mal", async () => {
    (login as jest.Mock).mockRejectedValue(LOGIN_LOCKED);
    const user = userEvent.setup();
    renderWithProviders(<LoginScreen />);

    await user.type(screen.getByPlaceholderText("Email"), "vecina@example.com");
    await user.type(screen.getByPlaceholderText("Contraseña"), "otra-vez");
    await user.press(screen.getByText("Ingresar"));

    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(lastAlert().title).toBe("Demasiados intentos");
    expect(lastAlert().message).toMatch(WAIT_MESSAGE);
    expect(lastAlert().message).not.toMatch(/incorrect/i);
  });

  it("CP-SEC05-52 · registro: el tope por IP se explica igual", async () => {
    (signup as jest.Mock).mockRejectedValue(ALLAUTH_LIMITED);
    const user = userEvent.setup();
    renderWithProviders(<RegisterScreen />);

    await user.type(screen.getByPlaceholderText("Nombre completo"), "Ana Pérez");
    await user.type(screen.getByPlaceholderText("Email"), "ana@example.com");
    await user.type(
      screen.getByPlaceholderText("Contraseña (mín. 8 caracteres)"),
      "Clave#2026x",
    );
    await user.type(screen.getByPlaceholderText("Confirmar contraseña"), "Clave#2026x");
    await user.press(screen.getByText("Registrarse"));

    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(lastAlert().title).toBe("Demasiados intentos");
  });

  it("CP-SEC05-53 · recuperación: el tope por cuenta no se confunde con un email inválido", async () => {
    (requestPasswordReset as jest.Mock).mockRejectedValue(ALLAUTH_LIMITED);
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordScreen />);

    await user.type(screen.getByPlaceholderText("Email"), "vecina@example.com");
    await user.press(screen.getByText("Enviar enlace"));

    expect(await screen.findByText(WAIT_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(/Verificá la dirección/)).toBeNull();
  });

  it("CP-SEC05-54 · restablecer la contraseña: el tope se explica", async () => {
    (resetPassword as jest.Mock).mockRejectedValue(ALLAUTH_LIMITED);
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordScreen />);

    await user.type(
      screen.getByPlaceholderText("Nueva contraseña (mín. 8 caracteres)"),
      "Clave#2026x",
    );
    await user.type(screen.getByPlaceholderText("Confirmar contraseña"), "Clave#2026x");
    await user.press(screen.getByText("Cambiar contraseña"));

    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(lastAlert().title).toBe("Demasiados intentos");
  });

  it("CP-SEC05-55 · cambiar la contraseña: el tope se explica en la pantalla", async () => {
    (changePassword as jest.Mock).mockRejectedValue(ALLAUTH_LIMITED);
    const user = userEvent.setup();
    renderWithProviders(<ChangePasswordScreen />);

    await user.type(screen.getByPlaceholderText("Contraseña actual"), "Vieja#2026x");
    await user.type(screen.getByPlaceholderText("Contraseña nueva"), "Nueva#2026x");
    await user.type(
      screen.getByPlaceholderText("Repetir contraseña nueva"),
      "Nueva#2026x",
    );
    await user.press(screen.getByText("Guardar contraseña"));

    expect(await screen.findByText(WAIT_MESSAGE)).toBeTruthy();
  });
});
