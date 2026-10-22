import type { Report } from "../../api/reports";
import type { UserProfile } from "../../api/users";
import { canReportReport } from "../complaints";

/** A quién se le ofrece denunciar (US-021, escenarios 7, 8 y 10). */

function user(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 2,
    name: "Otro vecino",
    email: "otro@test.com",
    avatar: null,
    role: "ciudadano",
    municipality: null,
    must_change_password: false,
    is_public: true,
    url: "/api/users/2/",
    ...overrides,
  };
}

function report(
  overrides: Partial<Pick<Report, "author" | "status" | "photo_removed_at">> = {},
) {
  return {
    author: { id: 1, name: "Vecina", avatar: null },
    status: "reportado" as Report["status"],
    photo_removed_at: null,
    ...overrides,
  };
}

describe("canReportReport", () => {
  it("se ofrece sobre un reporte ajeno publicado", () => {
    expect(canReportReport(report(), user())).toBe(true);
  });

  it.each([
    "pendiente_validacion",
    "reportado",
    "en_proceso",
    "resuelto_pendiente_confirmacion",
    "resuelto",
  ] as const)("se ofrece en estado %s", (status) => {
    expect(canReportReport(report({ status }), user())).toBe(true);
  });

  it("no se ofrece sobre el reporte propio", () => {
    expect(canReportReport(report(), user({ id: 1 }))).toBe(false);
  });

  it.each(["cancelado", "archivado"] as const)(
    "no se ofrece sobre un reporte %s",
    (status) => {
      expect(canReportReport(report({ status }), user())).toBe(false);
    },
  );

  it("no se ofrece sobre un reporte retirado por protección de datos", () => {
    expect(
      canReportReport(report({ photo_removed_at: "2026-09-10T10:00:00Z" }), user()),
    ).toBe(false);
  });

  it.each(["validador", "agente_municipal", "operario"] as const)(
    "no se le ofrece a una cuenta de trabajo (%s)",
    (role) => {
      expect(canReportReport(report(), user({ role }))).toBe(
        false,
      );
    },
  );

  it("no se ofrece sin sesión", () => {
    expect(canReportReport(report(), null)).toBe(false);
  });
});
