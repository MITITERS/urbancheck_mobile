import { render, screen, userEvent, waitFor } from "@testing-library/react-native";

import AcceptTermsScreen from "../../../app/accept-terms";
import { acceptTerms, getCurrentTerms, type UserProfile } from "../../api/users";

/** RN-10 (C-23) — la aceptación de los términos vigentes en el ingreso. */

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../api/users", () => ({
  getCurrentTerms: jest.fn(),
  acceptTerms: jest.fn(),
}));

const mockSetUser = jest.fn();
const mockSignOut = jest.fn();
jest.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ setUser: mockSetUser, signOut: mockSignOut }),
}));

const mockedGet = getCurrentTerms as jest.MockedFunction<typeof getCurrentTerms>;
const mockedAccept = acceptTerms as jest.MockedFunction<typeof acceptTerms>;

const TERMS = {
  version: "2026-10",
  published_at: "2026-10-22T00:00:00Z",
  terms: "# Términos\n\nTexto de los términos de prueba.",
  privacy: "# Privacidad\n\nTexto de la política de prueba.",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockResolvedValue(TERMS);
});

it("muestra el texto y la versión vigentes", async () => {
  await render(<AcceptTermsScreen />);

  expect(await screen.findByText("Texto de los términos de prueba.")).toBeTruthy();
  expect(screen.getByText("Versión 2026-10")).toBeTruthy();
  // Los dos documentos, y el Markdown interpretado: el título sin su `#`.
  expect(screen.getByText("Texto de la política de prueba.")).toBeTruthy();
  expect(screen.getByText("Privacidad")).toBeTruthy();
  expect(screen.queryByText(/^# /)).toBeNull();
});

it("aceptar manda la versión que leyó y actualiza la sesión", async () => {
  const updated = { id: 1, must_accept_terms: false } as UserProfile;
  mockedAccept.mockResolvedValue(updated);
  await render(<AcceptTermsScreen />);
  await screen.findByText("Texto de los términos de prueba.");

  await userEvent.press(screen.getByText("Acepto"));

  await waitFor(() => expect(mockSetUser).toHaveBeenCalledWith(updated));
  expect(mockedAccept).toHaveBeenCalledWith("2026-10");
});

it("si el servidor la rechaza, avisa y recarga la versión vigente", async () => {
  mockedAccept.mockRejectedValue({ status: 400 });
  await render(<AcceptTermsScreen />);
  await screen.findByText("Texto de los términos de prueba.");

  await userEvent.press(screen.getByText("Acepto"));

  expect(await screen.findByText(/No pudimos registrar tu aceptación/)).toBeTruthy();
  expect(mockSetUser).not.toHaveBeenCalled();
  expect(mockedGet).toHaveBeenCalledTimes(2);
});

it("se puede salir cerrando sesión", async () => {
  await render(<AcceptTermsScreen />);
  await screen.findByText("Texto de los términos de prueba.");

  await userEvent.press(screen.getByText("Cerrar sesión"));

  expect(mockSignOut).toHaveBeenCalled();
});
