import { api } from "../client";
import {
  getAssignedReport,
  listAssignedWork,
  listResolvedWork,
} from "../operator";
import { isOperator, participatesAsCitizen, type UserProfile } from "../users";

jest.mock("../client", () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const OPERATOR: UserProfile = {
  id: 1,
  name: "Ramón Operario",
  email: "ramon@cuadrilla.gob.ar",
  avatar: null,
  role: "operario",
  municipality: { id: 3, name: "Villa María" },
  is_public: true,
  operational_area: { id: 9, name: "Obras Públicas", is_active: true },
  must_change_password: false,
  url: "/api/users/1/",
};

describe("operator api", () => {
  it("no manda ni el área ni la municipalidad: las resuelve el servidor", () => {
    // US-045: si viajaran como parámetro, la app estaría en condiciones de
    // pedir el trabajo de otra área.
    listAssignedWork();

    expect(mockedApi.get).toHaveBeenCalledWith("/api/operator/reports/?page=1");
  });

  it("el detalle va por la misma superficie acotada, no por la del feed", () => {
    // Un reporte de otra área responde 404 ahí, con el criterio de US-034.
    getAssignedReport(42);

    expect(mockedApi.get).toHaveBeenCalledWith("/api/operator/reports/42/");
  });

  it("el historial tampoco dice quién pregunta: sale de la sesión", () => {
    // US-046: «los trabajos que cerré» se resuelve en el servidor a partir de
    // la evidencia. Un identificador acá dejaría pedir el historial de otro.
    listResolvedWork();

    expect(mockedApi.get).toHaveBeenCalledWith(
      "/api/operator/reports/history/?page=1",
    );
  });
});

describe("rol operario", () => {
  it("es una cuenta de trabajo: no participa como vecino", () => {
    // Escenario 8 de US-045: ni crear, ni comentar, ni dar me gusta.
    expect(participatesAsCitizen(OPERATOR)).toBe(false);
  });

  it("se reconoce por el rol, que es lo que decide la navegación", () => {
    expect(isOperator(OPERATOR)).toBe(true);
    expect(isOperator({ ...OPERATOR, role: "validador" })).toBe(false);
    expect(isOperator(null)).toBe(false);
  });
});
