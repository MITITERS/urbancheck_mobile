import { api } from "../client";
import { participatesAsCitizen, canValidate, type UserProfile } from "../users";
import {
  formatDistance,
  isTooFarError,
  listPendingValidation,
  rejectReport,
  validateReport,
} from "../validation";
import { canValidateReport } from "../../validation/canValidateReport";

jest.mock("../client", () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const VALIDATOR: UserProfile = {
  id: 1,
  name: "Validador",
  email: "v@test.com",
  avatar: null,
  role: "validador",
  municipality: { id: 3, name: "Villa María" },
  must_change_password: false,
  url: "/api/users/1/",
};

describe("validation api", () => {
  it("sends the coordinates so the backend can order by proximity", () => {
    listPendingValidation({ latitude: -32.41, longitude: -63.24 });

    expect(mockedApi.get).toHaveBeenCalledWith(
      "/api/validation/reports/?page=1&latitude=-32.41&longitude=-63.24",
    );
  });

  it("omits the coordinates when there is no location permission", () => {
    listPendingValidation(null);

    expect(mockedApi.get).toHaveBeenCalledWith("/api/validation/reports/?page=1");
  });

  it("posts the current position when validating", () => {
    validateReport(7, { latitude: -32.41, longitude: -63.24 });

    expect(mockedApi.post).toHaveBeenCalledWith("/api/validation/reports/7/validate/", {
      latitude: -32.41,
      longitude: -63.24,
    });
  });

  it("posts the reason when rejecting", () => {
    rejectReport(7, { latitude: -32.41, longitude: -63.24 }, "No existe");

    expect(mockedApi.post).toHaveBeenCalledWith("/api/validation/reports/7/reject/", {
      latitude: -32.41,
      longitude: -63.24,
      reason: "No existe",
    });
  });
});

describe("formatDistance", () => {
  it.each([
    [0, "0 m"],
    [320.4, "320 m"],
    [999, "999 m"],
    [1000, "1.0 km"],
    [1449, "1.4 km"],
  ])("formats %p as %p", (meters, expected) => {
    expect(formatDistance(meters)).toBe(expected);
  });

  it("returns null when there is no distance to show", () => {
    expect(formatDistance(null)).toBeNull();
  });
});

describe("isTooFarError", () => {
  it("recognises the distance rejection so the screen can show the real gap", () => {
    expect(
      isTooFarError({ code: "too_far", detail: "", distance_meters: 320, radius_meters: 50 }),
    ).toBe(true);
  });

  it("ignores any other error shape", () => {
    expect(isTooFarError({ detail: "boom" })).toBe(false);
    expect(isTooFarError(null)).toBe(false);
  });
});

describe("canValidate", () => {
  it("accepts a validator that already changed the temporary password", () => {
    expect(canValidate(VALIDATOR)).toBe(true);
  });

  it("rejects a validator that still has the temporary password", () => {
    expect(canValidate({ ...VALIDATOR, must_change_password: true })).toBe(false);
  });

  it.each(["ciudadano", "agente_municipal", "admin_plataforma"] as const)(
    "rejects the %s role",
    (role) => {
      expect(canValidate({ ...VALIDATOR, role })).toBe(false);
    },
  );

  it("rejects a missing user", () => {
    expect(canValidate(null)).toBe(false);
  });
});

describe("canValidateReport", () => {
  it("shows the actions only on a report awaiting validation", () => {
    expect(
      canValidateReport({ user: VALIDATOR, status: "pendiente_validacion" }),
    ).toBe(true);
  });

  it.each(["reportado", "en_proceso", "resuelto", "cancelado", "archivado"] as const)(
    "hides them on a report already in %s",
    (status) => {
      expect(canValidateReport({ user: VALIDATOR, status })).toBe(false);
    },
  );

  it("hides them on a report of another municipality", () => {
    expect(
      canValidateReport({
        user: VALIDATOR,
        status: "pendiente_validacion",
        reportMunicipalityId: 99,
      }),
    ).toBe(false);
  });

  it("hides them for a user that cannot validate", () => {
    expect(
      canValidateReport({
        user: { ...VALIDATOR, role: "ciudadano" },
        status: "pendiente_validacion",
      }),
    ).toBe(false);
  });
});

describe("participatesAsCitizen", () => {
  it.each(["validador", "agente_municipal", "admin_plataforma"] as const)(
    "rejects the %s: es una cuenta de trabajo, no la de un vecino",
    (role) => {
      expect(participatesAsCitizen({ ...VALIDATOR, role })).toBe(false);
    },
  );

  it("keeps rejecting a work account that still has the temporary password", () => {
    // La regla es del rol: no depende del estado de la cuenta, al revés que
    // `canValidate`.
    expect(participatesAsCitizen({ ...VALIDATOR, must_change_password: true })).toBe(
      false,
    );
  });

  it("accepts only the ciudadano role", () => {
    expect(participatesAsCitizen({ ...VALIDATOR, role: "ciudadano" })).toBe(true);
  });

  it("rejects a missing user", () => {
    expect(participatesAsCitizen(null)).toBe(false);
  });
});
