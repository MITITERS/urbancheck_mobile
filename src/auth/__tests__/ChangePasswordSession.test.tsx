import { screen, userEvent, waitFor } from "@testing-library/react-native";

import ChangePasswordScreen from "../../../app/change-password";
import { changePassword } from "../../api/auth";
import { renderWithProviders } from "../../test/renderWithProviders";

/**
 * N-04 — cambiar la contraseña cierra las otras sesiones y allauth rota el
 * token de la actual. La pantalla adopta el token nuevo antes de releer el
 * perfil: con el viejo, el pedido siguiente cerraba la sesión.
 */

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../api/auth", () => ({ changePassword: jest.fn() }));

const mockReplaceToken = jest.fn();
const mockRefreshUser = jest.fn();

jest.mock("../AuthContext", () => ({
  useAuth: () => ({
    replaceToken: mockReplaceToken,
    refreshUser: mockRefreshUser,
    signOut: jest.fn(),
  }),
}));

it("adopta el token rotado antes de releer el perfil", async () => {
  const order: string[] = [];
  mockReplaceToken.mockImplementation(async () => order.push("token"));
  mockRefreshUser.mockImplementation(async () => order.push("perfil"));
  (changePassword as jest.Mock).mockResolvedValue({
    meta: { session_token: "rotado" },
  });
  const user = userEvent.setup();
  await renderWithProviders(<ChangePasswordScreen />);

  await user.type(screen.getByPlaceholderText("Contraseña actual"), "Vieja#2026x");
  await user.type(screen.getByPlaceholderText("Contraseña nueva"), "Nueva#2026x");
  await user.type(screen.getByPlaceholderText("Repetir contraseña nueva"), "Nueva#2026x");
  await user.press(screen.getByText("Guardar contraseña"));

  await waitFor(() => expect(mockRefreshUser).toHaveBeenCalled());
  expect(mockReplaceToken).toHaveBeenCalledWith("rotado");
  expect(order).toEqual(["token", "perfil"]);
});
