import { errorDetail, isSessionExpired } from "../errors";

describe("isSessionExpired", () => {
  it("recognises the error that client.ts throws on 401", () => {
    expect(isSessionExpired(new Error("SESSION_EXPIRED"))).toBe(true);
  });

  it("does not confuse it with another Error", () => {
    expect(isSessionExpired(new Error("Network request failed"))).toBe(false);
  });

  it("does not match a plain object carrying the same text", () => {
    expect(isSessionExpired({ message: "SESSION_EXPIRED" })).toBe(false);
  });

  it("tolerates null and undefined", () => {
    expect(isSessionExpired(null)).toBe(false);
    expect(isSessionExpired(undefined)).toBe(false);
  });
});

describe("errorDetail", () => {
  it("returns the detail that DRF sends", () => {
    const blocked = {
      detail: "Este reporte ya está siendo gestionado por el municipio.",
    };
    expect(errorDetail(blocked, "fallback")).toBe(
      "Este reporte ya está siendo gestionado por el municipio.",
    );
  });

  it("falls back when there is no detail", () => {
    expect(errorDetail({ description: ["obligatorio"] }, "No se pudo guardar")).toBe(
      "No se pudo guardar",
    );
  });

  it("falls back when detail is not a string", () => {
    expect(errorDetail({ detail: { code: 403 } }, "fallback")).toBe("fallback");
  });

  it("falls back for an Error instance", () => {
    expect(errorDetail(new Error("boom"), "fallback")).toBe("fallback");
  });

  it("falls back for null", () => {
    expect(errorDetail(null, "fallback")).toBe("fallback");
  });
});
