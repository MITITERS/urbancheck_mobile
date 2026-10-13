import { api } from "../client";
import {
  appealResolution,
  isTooFarError,
  registerResolution,
} from "../resolution";

jest.mock("../client", () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const PHOTO = { uri: "file:///work.jpg", name: "work.jpg", type: "image/jpeg" };
const HERE = { latitude: -32.4103, longitude: -63.24 };

function bodyOf(call: unknown[]): FormData {
  return call[1] as FormData;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("cierre del operario (US-046)", () => {
  it("va por la superficie del operario, no por la del panel", () => {
    registerResolution(42, { photo: PHOTO, description: "Listo.", coords: HERE });

    expect(mockedApi.post).toHaveBeenCalledWith(
      "/api/operator/reports/42/resolve/",
      expect.any(FormData),
    );
  });

  it("manda foto, descripción y coordenadas juntas", () => {
    // Las tres son obligatorias: sin foto no hay evidencia, sin descripción no
    // se sabe qué se hizo, y sin coordenadas no se puede verificar el lugar.
    registerResolution(42, {
      photo: PHOTO,
      description: "Se rellenó el bache.",
      coords: HERE,
    });

    const body = bodyOf(mockedApi.post.mock.calls[0]);
    expect(body.get("description")).toBe("Se rellenó el bache.");
    expect(body.get("latitude")).toBe(String(HERE.latitude));
    expect(body.get("longitude")).toBe(String(HERE.longitude));
    expect(body.get("photo")).toBeTruthy();
  });
});

describe("objeción del vecino (US-048)", () => {
  it("va por la superficie ciudadana, sobre el propio reporte", () => {
    appealResolution(42, { photo: PHOTO, reason: "El bache sigue igual." });

    expect(mockedApi.post).toHaveBeenCalledWith(
      "/api/reports/42/appeal/",
      expect.any(FormData),
    );
  });

  it("manda el motivo y la foto del estado actual", () => {
    appealResolution(42, { photo: PHOTO, reason: "El bache sigue igual." });

    const body = bodyOf(mockedApi.post.mock.calls[0]);
    expect(body.get("reason")).toBe("El bache sigue igual.");
    expect(body.get("photo")).toBeTruthy();
  });
});

describe("estás demasiado lejos", () => {
  it("se reconoce por el código y trae la distancia real", () => {
    // La pantalla dice "estás a 320 m" en vez de un mensaje genérico, igual que
    // en la validación en terreno de US-036.
    const error = {
      code: "too_far",
      detail: "Estás a 320 m y el límite es de 50 m.",
      distance_meters: 320,
      radius_meters: 50,
    };

    expect(isTooFarError(error)).toBe(true);
    expect(isTooFarError({ detail: "otra cosa" })).toBe(false);
    expect(isTooFarError(null)).toBe(false);
  });
});
