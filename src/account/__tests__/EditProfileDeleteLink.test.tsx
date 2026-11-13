import { screen, userEvent } from "@testing-library/react-native";

import EditProfileScreen from "../../../app/(app)/edit-profile";
import { api } from "../../api/client";
import type { UserProfile } from "../../api/users";
import { renderWithProviders } from "../../test/renderWithProviders";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../api/client", () => ({
  ...jest.requireActual("../../api/client"),
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

jest.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({ setUser: jest.fn() }),
}));

const mockedGet = api.get as jest.MockedFunction<typeof api.get>;

const CITIZEN: UserProfile = {
  id: 1,
  name: "Lucas Leone",
  email: "lucas@test.com",
  avatar: null,
  role: "ciudadano",
  municipality: null,
  must_change_password: false,
  onboarding_completed_at: "2026-01-01T00:00:00Z",
  is_public: true,
  url: "/api/users/1/",
};

function signedInAs(profile: UserProfile) {
  mockedGet.mockResolvedValue(profile as never);
}

describe("«Eliminar mi cuenta» en Editar perfil (N-09)", () => {
  it("el vecino la tiene al pie y lleva a la baja", async () => {
    signedInAs(CITIZEN);
    renderWithProviders(<EditProfileScreen />);

    await userEvent.press(await screen.findByText("Eliminar mi cuenta"));

    expect(mockPush).toHaveBeenCalledWith("/(app)/delete-account");
  });

  it("una cuenta de trabajo no: sigue con la baja lógica", async () => {
    signedInAs({ ...CITIZEN, role: "operario" });
    renderWithProviders(<EditProfileScreen />);

    expect(await screen.findByText("Guardar cambios")).toBeTruthy();
    expect(screen.queryByText("Eliminar mi cuenta")).toBeNull();
  });
});
