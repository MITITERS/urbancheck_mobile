import { api } from "../client";
import { canValidate, getMe, getPublicProfile, participatesAsCitizen, patchMe } from "../users";
import type { UserProfile } from "../users";

jest.mock("../client", () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const CITIZEN: UserProfile = {
  id: 1,
  name: "Vecina",
  email: "vecina@test.com",
  avatar: null,
  role: "ciudadano",
  municipality: null,
  must_change_password: false,
  url: "/api/users/1/",
};

describe("users api", () => {
  it("getMe asks for the authenticated user", () => {
    getMe();

    expect(mockedApi.get).toHaveBeenCalledWith("/api/users/me/");
  });

  it("getPublicProfile asks for that user's detail", () => {
    getPublicProfile(7);

    expect(mockedApi.get).toHaveBeenCalledWith("/api/users/7/");
  });

  it("patchMe manda el FormData al propio perfil", () => {
    // Va como FormData y no como JSON porque el avatar viaja en el mismo
    // request que el nombre.
    const form = new FormData();
    form.append("name", "Vecina");

    patchMe(form);

    expect(mockedApi.patch).toHaveBeenCalledWith("/api/users/me/", form);
  });

  it("participatesAsCitizen deja afuera a las cuentas de trabajo", () => {
    expect(participatesAsCitizen(CITIZEN)).toBe(true);
    expect(participatesAsCitizen({ ...CITIZEN, role: "validador" })).toBe(false);
    expect(participatesAsCitizen({ ...CITIZEN, role: "agente_municipal" })).toBe(false);
    expect(participatesAsCitizen(null)).toBe(false);
  });

  it("canValidate pide rol y contraseña ya cambiada", () => {
    const validator: UserProfile = { ...CITIZEN, role: "validador" };
    expect(canValidate(validator)).toBe(true);
    // La contraseña temporal bloquea la validación hasta que se cambie: es la
    // misma regla que aplica el backend (US-035).
    expect(canValidate({ ...validator, must_change_password: true })).toBe(false);
    expect(canValidate(CITIZEN)).toBe(false);
    expect(canValidate(null)).toBe(false);
  });

  it("el administrador de plataforma tampoco participa como vecino", () => {
    expect(participatesAsCitizen({ ...CITIZEN, role: "admin_plataforma" })).toBe(false);
  });
});
