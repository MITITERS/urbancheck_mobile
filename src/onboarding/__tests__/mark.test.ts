import * as SecureStore from "expo-secure-store";

import { completeOnboarding, type UserProfile } from "../../api/users";
import { markOnboardingSeen, reconcileOnboarding } from "../mark";

/**
 * US-051, escenario 10 — si la marca no se pudo guardar, el vecino entra igual
 * y la app la reintenta en el siguiente ingreso, sin volver a mostrarle el
 * tutorial.
 */

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("../../api/users", () => ({ completeOnboarding: jest.fn() }));

const store = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedComplete = completeOnboarding as jest.MockedFunction<typeof completeOnboarding>;

const PENDING_KEY = "urbancheck_onboarding_pending_1";

const NEW_CITIZEN: UserProfile = {
  id: 1,
  name: "Vecina",
  email: "vecina@test.com",
  avatar: null,
  role: "ciudadano",
  municipality: null,
  must_change_password: false,
  onboarding_completed_at: null,
  is_public: true,
  url: "/api/users/1/",
};

const CONFIRMED = { ...NEW_CITIZEN, onboarding_completed_at: "2026-10-20T12:00:00Z" };

beforeEach(() => {
  store.getItemAsync.mockResolvedValue(null);
  store.setItemAsync.mockResolvedValue();
  store.deleteItemAsync.mockResolvedValue();
});

describe("markOnboardingSeen", () => {
  it("CP-051-M08 (US-051 E3, E4) · devuelve el perfil que confirma el servidor", async () => {
    mockedComplete.mockResolvedValue(CONFIRMED);

    await expect(markOnboardingSeen(NEW_CITIZEN)).resolves.toEqual(CONFIRMED);
    expect(store.setItemAsync).not.toHaveBeenCalled();
  });

  it("CP-051-M09 (US-051 E10) · con error de red no bloquea y anota el reintento", async () => {
    mockedComplete.mockRejectedValue(new TypeError("Network request failed"));

    const result = await markOnboardingSeen(NEW_CITIZEN);

    expect(result.onboarding_completed_at).not.toBeNull();
    expect(store.setItemAsync).toHaveBeenCalledWith(PENDING_KEY, "1");
  });
});

describe("reconcileOnboarding", () => {
  it("sin nada pendiente no llama al servidor", async () => {
    await expect(reconcileOnboarding(NEW_CITIZEN)).resolves.toBe(NEW_CITIZEN);
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("CP-051-M12 (US-051 E10) · en el siguiente ingreso reintenta y limpia la anotación", async () => {
    store.getItemAsync.mockResolvedValue("1");
    mockedComplete.mockResolvedValue(CONFIRMED);

    await expect(reconcileOnboarding(NEW_CITIZEN)).resolves.toEqual(CONFIRMED);
    expect(store.deleteItemAsync).toHaveBeenCalledWith(PENDING_KEY);
  });

  it("CP-051-M13 (US-051 E10) · si el reintento vuelve a fallar, igual no muestra el tutorial", async () => {
    store.getItemAsync.mockResolvedValue("1");
    mockedComplete.mockRejectedValue(new TypeError("Network request failed"));

    const result = await reconcileOnboarding(NEW_CITIZEN);

    expect(result?.onboarding_completed_at).not.toBeNull();
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("si el servidor ya lo tiene marcado, solo limpia la anotación", async () => {
    store.getItemAsync.mockResolvedValue("1");

    await expect(reconcileOnboarding(CONFIRMED)).resolves.toBe(CONFIRMED);
    expect(mockedComplete).not.toHaveBeenCalled();
    expect(store.deleteItemAsync).toHaveBeenCalledWith(PENDING_KEY);
  });

  it("sin perfil no hace nada", async () => {
    await expect(reconcileOnboarding(null)).resolves.toBeNull();
  });
});
