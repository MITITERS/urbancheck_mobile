import { describeApiError } from "../errors";

describe("describeApiError", () => {
  it("saca el mensaje del campo, no el objeto entero", () => {
    // Es la respuesta real del backend cuando el reporte cae fuera de toda
    // cobertura: antes se mostraba con llaves, comillas y el 400 incluido.
    const described = describeApiError({
      location:
        "El lugar que marcaste no está dentro del área de cobertura de ninguna municipalidad adherida a UrbanCheck.",
      status: 400,
    });

    expect(described.field).toBe("location");
    expect(described.title).toBe("Revisá la ubicación");
    expect(described.message).toBe(
      "El lugar que marcaste no está dentro del área de cobertura de ninguna municipalidad adherida a UrbanCheck.",
    );
    // Un error de validación se puede corregir: no se pinta como una falla.
    expect(described.tone).toBe("warning");
  });

  it("nunca deja escapar el código de estado al mensaje", () => {
    const described = describeApiError({ description: ["Requerido."], status: 400 });

    expect(described.message).toBe("Requerido.");
    expect(described.field).toBe("description");
  });

  it("desenvuelve la lista con la que DRF manda los errores de campo", () => {
    const described = describeApiError({ photo: ["El archivo es muy grande."] });

    expect(described.message).toBe("El archivo es muy grande.");
    expect(described.title).toBe("Revisá la foto");
  });

  it("detail habla de la operación entera, así que no marca ningún campo", () => {
    const described = describeApiError({ detail: "No encontrado.", status: 404 });

    expect(described.field).toBeUndefined();
    expect(described.message).toBe("No encontrado.");
    expect(described.tone).toBe("error");
  });

  it("usa el título que le pasa la pantalla cuando el error no es de un campo", () => {
    const described = describeApiError(
      { non_field_errors: ["Algo no cierra."] },
      "No pudimos enviar el reporte",
    );

    expect(described.title).toBe("No pudimos enviar el reporte");
  });

  it("un fallo de red se explica como tal y no con el texto de fetch", () => {
    const described = describeApiError(new Error("Network request failed"));

    expect(described.title).toBe("Sin conexión");
    expect(described.message).not.toContain("Network request failed");
  });

  it("la sesión vencida tiene su propio mensaje", () => {
    const described = describeApiError(new Error("SESSION_EXPIRED"));

    expect(described.title).toBe("Tu sesión expiró");
  });

  it("ante un error irreconocible dice algo legible igual", () => {
    const described = describeApiError({ status: 500 }, "No pudimos guardar");

    expect(described.title).toBe("No pudimos guardar");
    expect(described.message).toMatch(/probá de nuevo/i);
  });
});
