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
  text: "Texto de los términos de prueba.",
  published_at: "2026-10-22T00:00:00Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockResolvedValue(TERMS);
});

it("muestra el texto y la versión vigentes", async () => {
  render(<AcceptTermsScreen />);

  expect(await screen.findByText(TERMS.text)).toBeTruthy();
  expect(screen.getByText("Versión 2026-10")).toBeTruthy();
});

it("aceptar manda la versión que leyó y actualiza la sesión", async () => {
  const updated = { id: 1, must_accept_terms: false } as UserProfile;
  mockedAccept.mockResolvedValue(updated);
  render(<AcceptTermsScreen />);
  await screen.findByText(TERMS.text);

  await userEvent.press(screen.getByText("Acepto"));

  await waitFor(() => expect(mockSetUser).toHaveBeenCalledWith(updated));
  expect(mockedAccept).toHaveBeenCalledWith("2026-10");
});

it("si el servidor la rechaza, avisa y recarga la versión vigente", async () => {
  mockedAccept.mockRejectedValue({ status: 400 });
  render(<AcceptTermsScreen />);
  await screen.findByText(TERMS.text);

  await userEvent.press(screen.getByText("Acepto"));

  expect(await screen.findByText(/No pudimos registrar tu aceptación/)).toBeTruthy();
  expect(mockSetUser).not.toHaveBeenCalled();
  expect(mockedGet).toHaveBeenCalledTimes(2);
});

it("se puede salir cerrando sesión", async () => {
  render(<AcceptTermsScreen />);
  await screen.findByText(TERMS.text);

  await userEvent.press(screen.getByText("Cerrar sesión"));

  expect(mockSignOut).toHaveBeenCalled();
});
