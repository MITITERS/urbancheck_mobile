import { STATUS_LABEL, reportStatusLabel } from "../labels";

describe("reportStatusLabel", () => {
  it("aclara que el reporte volvió a gestión por una objeción", () => {
    // No es un estado nuevo —la máquina de estados sigue teniendo siete— sino
    // el motivo por el que está donde está. Sin esto, en el feed se ve igual
    // que un reporte que nunca se cerró.
    const label = reportStatusLabel({ status: "en_proceso", appeal_count: 1 });

    expect(label).toBe("En proceso (objetado)");
  });

  it("un reporte en gestión que nunca se objetó no lleva aclaración", () => {
    expect(reportStatusLabel({ status: "en_proceso", appeal_count: 0 })).toBe(
      "En proceso",
    );
  });

  it("la aclaración es solo de En proceso, no de cualquier estado objetado", () => {
    // El segundo cierre lleva el reporte a Resuelto y ahí la objeción ya es
    // historia: decir "Resuelto (objetado)" confundiría el desenlace.
    expect(reportStatusLabel({ status: "resuelto", appeal_count: 1 })).toBe(
      "Resuelto",
    );
    expect(
      reportStatusLabel({
        status: "resuelto_pendiente_confirmacion",
        appeal_count: 1,
      }),
    ).toBe("Resuelto, a confirmar");
  });

  it("sin el dato se comporta como el mapa de siempre", () => {
    // Un cliente que todavía no manda `appeal_count` no rompe ni inventa.
    expect(reportStatusLabel({ status: "en_proceso" })).toBe("En proceso");
  });

  it("cubre los siete estados que declara el backend", () => {
    // El mapa suelto se usa para la leyenda del mapa, los pasos de la línea de
    // tiempo y los filtros: un estado nuevo sin entrada dejaría un hueco ahí.
    expect(Object.keys(STATUS_LABEL)).toHaveLength(7);
    for (const [status, label] of Object.entries(STATUS_LABEL)) {
      expect(label).toBeTruthy();
      expect(label).not.toBe(status);
    }
  });
});
