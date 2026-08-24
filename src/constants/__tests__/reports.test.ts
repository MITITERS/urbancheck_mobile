import type { ReportCategory, ReportStatus } from "../../api/reports";
import {
  CATEGORY_COLOR,
  CATEGORY_ICON,
  CATEGORY_LABEL,
  CATEGORY_VALUES,
  FILTERABLE_STATUS_VALUES,
  STATUS_COLORS,
  STATUS_LABEL,
  categoryColor,
  categoryLabel,
  formatDate,
  statusColors,
  statusLabel,
} from "../reports";

/**
 * Estas tablas son la única fuente de verdad de etiquetas y colores, y las
 * consumen feed, mapa, detalle, alta y perfil. Un hueco acá se ve en pantalla
 * como un valor crudo ("semaforo") o un marcador sin color.
 */

const BACKEND_CATEGORIES: ReportCategory[] = [
  "bache",
  "alumbrado",
  "basura",
  "semaforo",
  "vereda",
  "otro",
];

const BACKEND_STATUSES: ReportStatus[] = [
  "pendiente_validacion",
  "reportado",
  "en_proceso",
  "resuelto",
  "cancelado",
  "archivado",
];

describe("category tables", () => {
  it("cover every category the backend can send", () => {
    for (const category of BACKEND_CATEGORIES) {
      expect(CATEGORY_LABEL[category]).toBeTruthy();
      expect(CATEGORY_ICON[category]).toBeTruthy();
      expect(CATEGORY_COLOR[category]).toBeTruthy();
    }
  });

  it("give each category its own marker colour (US-010)", () => {
    const colours = BACKEND_CATEGORIES.map((c) => CATEGORY_COLOR[c]);
    expect(new Set(colours).size).toBe(colours.length);
  });

  it("use hex colours that react-native-maps accepts as pinColor", () => {
    for (const colour of Object.values(CATEGORY_COLOR)) {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("offer every category as a filter chip", () => {
    expect(new Set(CATEGORY_VALUES)).toEqual(new Set(BACKEND_CATEGORIES));
  });
});

describe("status tables", () => {
  it("cover every status the backend can send", () => {
    for (const status of BACKEND_STATUSES) {
      expect(STATUS_LABEL[status]).toBeTruthy();
      expect(STATUS_COLORS[status]).toBeTruthy();
    }
  });

  it("do not offer cancelado or archivado as filters", () => {
    expect(FILTERABLE_STATUS_VALUES).not.toContain("cancelado");
    expect(FILTERABLE_STATUS_VALUES).not.toContain("archivado");
  });

  it("only offer statuses that exist", () => {
    for (const status of FILTERABLE_STATUS_VALUES) {
      expect(BACKEND_STATUSES).toContain(status);
    }
  });
});

describe("label helpers", () => {
  it("translate the raw value into readable text", () => {
    expect(categoryLabel("semaforo")).toBe("Semáforo");
    expect(statusLabel("pendiente_validacion")).toBe("Pendiente de validación");
  });

  it("echo an unknown value instead of showing an empty chip", () => {
    expect(categoryLabel("meteorito")).toBe("meteorito");
    expect(statusLabel("desconocido")).toBe("desconocido");
  });

  it("fall back to a neutral colour for an unknown status", () => {
    expect(statusColors("desconocido")).toEqual({ bg: "#f5f5f5", text: "#666" });
  });

  it("fall back to the otro colour for an unknown category", () => {
    expect(categoryColor("meteorito")).toBe(CATEGORY_COLOR.otro);
  });
});

describe("formatDate", () => {
  it("renders dd/mm/yyyy", () => {
    expect(formatDate("2026-07-27T10:30:00Z")).toMatch(/^\d{2}\/\d{2}\/2026$/);
  });

  it("pads single-digit days and months", () => {
    expect(formatDate("2026-01-05T12:00:00Z")).toMatch(/^0\d\/0\d\/2026$/);
  });

  it("does not crash on a malformed date", () => {
    expect(() => formatDate("no es una fecha")).not.toThrow();
  });
});
