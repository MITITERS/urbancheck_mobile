import { describeApiError, isRateLimited } from "../errors";

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

  it("el servidor caído no se reporta como credenciales incorrectas", () => {
    // Es el caso que hacía revisar la contraseña durante media hora: sin
    // conexión, el login decía «email o contraseña incorrectos».
    const described = describeApiError(
      new Error("Network request failed"),
      "No pudimos iniciar sesión",
    );

    expect(described.title).toBe("Sin conexión");
    expect(described.message).toMatch(/servidor/i);
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

describe("límites de intentos y de tasa (429)", () => {
  it("CP-SEC05-56 · usa el mensaje en castellano del servidor, con el tiempo de espera", () => {
    const result = describeApiError({
      status: 429,
      code: "throttled",
      detail: "Hiciste demasiadas solicitudes seguidas. Probá de nuevo en 5 minutos.",
      retry_after: 300,
    });

    expect(result.title).toBe("Demasiados intentos");
    expect(result.tone).toBe("warning");
    expect(result.message).toMatch(/5 minutos/);
  });

  it("CP-SEC05-57 · al bloqueo de allauth, en inglés, le pone un texto propio", () => {
    const result = describeApiError({
      status: 429,
      errors: [{ code: "too_many_login_attempts", message: "Too many failed login attempts." }],
    });

    expect(result.title).toBe("Demasiados intentos");
    expect(result.message).toMatch(/Esperá unos minutos/);
    expect(result.message).not.toMatch(/Too many/);
  });

  it("CP-SEC05-58 · no se confunde con un error de campo", () => {
    const result = describeApiError({ status: 429, email: ["no importa"] });

    expect(result.field).toBeUndefined();
    expect(result.title).toBe("Demasiados intentos");
  });

  it("CP-SEC05-59 · isRateLimited reconoce solo el 429", () => {
    expect(isRateLimited({ status: 429 })).toBe(true);
    expect(isRateLimited({ status: 400 })).toBe(false);
    expect(isRateLimited(new Error("x"))).toBe(false);
    expect(isRateLimited(null)).toBe(false);
  });
});

describe("errores que no son de red", () => {
  it("una falla de red de verdad se reporta como tal", () => {
    // Es el mensaje que lanza `fetch` de React Native cuando no llega.
    const described = describeApiError(new Error("Network request failed"));

    expect(described.title).toBe("Sin conexión");
  });

  it("la sesión vencida tiene su propio mensaje", () => {
    const described = describeApiError(new Error("SESSION_EXPIRED"));

    expect(described.title).toBe("Tu sesión expiró");
  });

  it("un error del dispositivo dice lo que pasó, no 'sin conexión'", () => {
    // Antes cualquier Error se reportaba como problema de red, y eso mandaba a
    // buscar la causa donde no estaba: el usuario cambiaba de red y volvía a
    // fallar. Una foto ilegible o un permiso caído no son un problema de red.
    const described = describeApiError(
      new Error("No pudimos leer la foto seleccionada."),
      "No pudimos registrar el cierre",
    );

    expect(described.title).toBe("No pudimos registrar el cierre");
    expect(described.message).toBe("No pudimos leer la foto seleccionada.");
  });
});
