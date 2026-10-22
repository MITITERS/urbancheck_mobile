import { render, screen, userEvent, waitFor } from "@testing-library/react-native";

import RegisterScreen from "../../../app/(auth)/register";
import { signup } from "../../api/auth";
import { getCurrentTerms } from "../../api/users";

/** RN-10 (C-23) — con términos publicados, aceptarlos es parte del registro. */

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../api/auth", () => ({ signup: jest.fn(), logout: jest.fn() }));
jest.mock("../../api/users", () => ({ getCurrentTerms: jest.fn() }));

const mockSignIn = jest.fn();
jest.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ signIn: mockSignIn }),
}));

const mockedSignup = signup as jest.MockedFunction<typeof signup>;
const mockedTerms = getCurrentTerms as jest.MockedFunction<typeof getCurrentTerms>;

const TERMS = {
  version: "2026-10",
  text: "Texto de los términos de prueba.",
  published_at: "2026-10-22T00:00:00Z",
};

async function fillForm() {
  await userEvent.type(screen.getByPlaceholderText("Nombre completo"), "Ana Ruiz");
  await userEvent.type(screen.getByPlaceholderText("Email"), "ana@example.com");
  await userEvent.type(
    screen.getByPlaceholderText("Contraseña (mín. 8 caracteres)"),
    "una-clave-larga",
  );
  await userEvent.type(screen.getByPlaceholderText("Confirmar contraseña"), "una-clave-larga");
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedSignup.mockResolvedValue({ meta: { session_token: "tok" } });
});

describe("con términos publicados", () => {
  beforeEach(() => mockedTerms.mockResolvedValue(TERMS));

  it("no deja registrarse sin aceptarlos", async () => {
    render(<RegisterScreen />);
    await screen.findByText("Leí y acepto los términos y condiciones");
    await fillForm();

    await userEvent.press(screen.getByText("Registrarse"));

    expect(
      await screen.findByText(
        "Para crear la cuenta tenés que aceptar los términos y condiciones.",
      ),
    ).toBeTruthy();
    expect(mockedSignup).not.toHaveBeenCalled();
  });

  it("al aceptarlos manda la aceptación y la versión", async () => {
    render(<RegisterScreen />);
    await fillForm();
    await userEvent.press(await screen.findByLabelText("Leí y acepto los términos y condiciones"));

    await userEvent.press(screen.getByText("Registrarse"));

    await waitFor(() =>
      expect(mockedSignup).toHaveBeenCalledWith({
        name: "Ana Ruiz",
        email: "ana@example.com",
        password: "una-clave-larga",
        accept_terms: true,
        terms_version: "2026-10",
      }),
    );
  });

  it("el texto se lee desde el formulario", async () => {
    render(<RegisterScreen />);

    await userEvent.press(await screen.findByText("Ver términos y condiciones"));

    expect(await screen.findByText(TERMS.text)).toBeTruthy();
  });
});

describe("sin términos publicados", () => {
  beforeEach(() => mockedTerms.mockResolvedValue(null));

  it("no muestra la casilla y registra como antes", async () => {
    render(<RegisterScreen />);
    await fillForm();

    await userEvent.press(screen.getByText("Registrarse"));

    await waitFor(() =>
      expect(mockedSignup).toHaveBeenCalledWith({
        name: "Ana Ruiz",
        email: "ana@example.com",
        password: "una-clave-larga",
      }),
    );
    expect(screen.queryByText("Leí y acepto los términos y condiciones")).toBeNull();
  });
});
