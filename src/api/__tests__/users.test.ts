import { api } from "../client";
import { canValidate, getPublicProfile, participatesAsCitizen } from "../users";
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
  it("getPublicProfile asks for that user's detail", () => {
    getPublicProfile(7);

    expect(mockedApi.get).toHaveBeenCalledWith("/api/users/7/");
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
    expect(canValidate({ ...validator, must_change_password: true })).toBe(false);
    expect(canValidate(CITIZEN)).toBe(false);
  });
});
