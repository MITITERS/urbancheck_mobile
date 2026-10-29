import { screen, userEvent, waitFor } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import DeleteAccountScreen from "../../../app/(app)/delete-account";
import { deleteAccount } from "../../api/users";
import { accountMessages as t } from "../../messages/account";
import { renderWithProviders } from "../../test/renderWithProviders";

/**
 * N-09 — el vecino borra su cuenta desde el perfil, con su contraseña y una
 * confirmación más, porque no hay vuelta atrás.
 */

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../api/users", () => ({ deleteAccount: jest.fn() }));

const mockSignOut = jest.fn();
jest.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

const mockedDelete = deleteAccount as jest.MockedFunction<typeof deleteAccount>;
let alert: jest.SpyInstance;

beforeEach(() => {
  mockSignOut.mockReset();
  mockedDelete.mockReset();
  // La confirmación se acepta tocando el botón destructivo.
  alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    (buttons as AlertButton[] | undefined)
      ?.find((button) => button.style === "destructive")
      ?.onPress?.();
  });
});

async function submit(password: string) {
  const user = userEvent.setup();
  renderWithProviders(<DeleteAccountScreen />);
  if (password) await user.type(screen.getByPlaceholderText(t.passwordPlaceholder), password);
  await user.press(screen.getByText(t.submit));
}

it("explica qué se borra y qué se conserva", () => {
  renderWithProviders(<DeleteAccountScreen />);

  for (const line of t.consequences) expect(screen.getByText(line)).toBeTruthy();
});

it("con la contraseña y la confirmación, borra la cuenta y cierra la sesión", async () => {
  mockedDelete.mockResolvedValue(undefined);

  await submit("Clave#2026x");

  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  expect(mockedDelete).toHaveBeenCalledWith("Clave#2026x");
  expect(alert.mock.calls[0][0]).toBe(t.confirmTitle);
});

it("sin contraseña no pide nada al servidor", async () => {
  await submit("");

  expect(await screen.findByText(t.missingPassword)).toBeTruthy();
  expect(mockedDelete).not.toHaveBeenCalled();
});

it("con la contraseña incorrecta lo dice y no cierra la sesión", async () => {
  mockedDelete.mockRejectedValue({ status: 400, password: ["La contraseña no es correcta."] });

  await submit("incorrecta");

  expect(await screen.findByText(t.wrongPassword)).toBeTruthy();
  expect(mockSignOut).not.toHaveBeenCalled();
});
