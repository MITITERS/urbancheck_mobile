import { api, setSessionToken, setUnauthorizedHandler } from "../client";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

/**
 * `XMLHttpRequest` de mentira: es por donde viajan las subidas, así que sin
 * esto los tests del camino con archivo no tendrían transporte.
 */
interface XhrCall {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}
let lastXhr: XhrCall;
/** Qué contesta la próxima subida. Por defecto, un 201 con `{ id: 1 }`. */
let xhrResponse:
  | { status: number; statusText: string; responseText: string }
  | "network-error";

class FakeXhr {
  status = 0;
  statusText = "";
  responseText = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  open(method: string, url: string) {
    lastXhr = { method, url, headers: {}, body: undefined };
  }
  setRequestHeader(name: string, value: string) {
    lastXhr.headers[name] = value;
  }
  send(body: unknown) {
    lastXhr.body = body;
    if (xhrResponse === "network-error") {
      this.onerror?.();
      return;
    }
    this.status = xhrResponse.status;
    this.statusText = xhrResponse.statusText;
    this.responseText = xhrResponse.responseText;
    this.onload?.();
  }
}

global.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;

beforeEach(() => {
  mockFetch.mockClear();
  xhrResponse = {
    status: 201,
    statusText: "",
    responseText: JSON.stringify({ id: 1 }),
  };
});

/**
 * Una respuesta como la que devuelve `fetch`.
 *
 * El cuerpo se sirve por `text()` y no por `json()`: el cliente lo lee así para
 * poder compartir el mismo tratamiento de la respuesta con el camino de subida,
 * que va por `XMLHttpRequest` y solo tiene texto.
 */
function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

afterEach(() => {
  setSessionToken(null);
});

describe("api.get", () => {
  it("sends Accept header and returns parsed JSON", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ hello: "world" }));
    const result = await api.get<{ hello: string }>("/api/test/");
    expect(result).toEqual({ hello: "world" });
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/test/");
    expect(options.headers.Accept).toBe("application/json");
  });

  it("includes X-Session-Token header when token is set", async () => {
    setSessionToken("abc123");
    mockFetch.mockResolvedValue(jsonResponse({}));
    await api.get("/api/test/");
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["X-Session-Token"]).toBe("abc123");
  });

  it("omits X-Session-Token header when token is null", async () => {
    mockFetch.mockResolvedValue(jsonResponse({}));
    await api.get("/api/test/");
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["X-Session-Token"]).toBeUndefined();
  });
});

describe("api.post", () => {
  it("serializes JSON body and sets Content-Type", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 1 }, 201));
    await api.post("/api/reports/", { text: "hola" });
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ text: "hola" }));
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("un FormData no viaja por fetch: sube por XMLHttpRequest", async () => {
    // Con el `fetch` de Expo no se puede subir un archivo —no entiende las
    // partes con `uri` que produce la cámara—, así que la subida va por XHR,
    // que llega al módulo de red nativo. Ver `upload()` en el cliente.
    const form = new FormData();
    form.append("description", "bache");

    const result = await api.post("/api/reports/", form);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(lastXhr.method).toBe("POST");
    expect(lastXhr.url).toBe("http://localhost:8000/api/reports/");
    expect(lastXhr.body).toBe(form);
    // El `Content-Type` lo pone XHR con su `boundary`: fijarlo rompe el cuerpo.
    expect(lastXhr.headers["Content-Type"]).toBeUndefined();
    expect(lastXhr.headers.Accept).toBe("application/json");
    expect(result).toEqual({ id: 1 });
  });

  it("la subida manda el token de sesión igual que el resto", async () => {
    setSessionToken("abc123");
    const form = new FormData();

    await api.post("/api/reports/", form);

    expect(lastXhr.headers["X-Session-Token"]).toBe("abc123");
  });
});

describe("error handling", () => {
  it("calls unauthorized handler and throws SESSION_EXPIRED on 401", async () => {
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockFetch.mockResolvedValue(jsonResponse({}, 401));
    await expect(api.get("/api/test/")).rejects.toThrow("SESSION_EXPIRED");
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it("treats 410 as session expiry", async () => {
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    mockFetch.mockResolvedValue(jsonResponse({}, 410));
    await expect(api.get("/api/test/")).rejects.toThrow("SESSION_EXPIRED");
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it("throws the error body with status attached on 400", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ photo: ["La foto es obligatoria."] }, 400),
    );
    await expect(api.post("/api/reports/", {})).rejects.toEqual({
      photo: ["La foto es obligatoria."],
      status: 400,
    });
  });

  it("falls back to statusText when error body is not JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("<html>Bad Gateway</html>"),
    });
    await expect(api.get("/api/test/")).rejects.toEqual({
      detail: "Internal Server Error",
      status: 500,
    });
  });

  it("una subida rechazada da el mismo error que por fetch", async () => {
    // Los dos transportes comparten el tratamiento de la respuesta: un 400 se
    // ve igual haya foto o no, y las pantallas no tienen que distinguirlos.
    xhrResponse = {
      status: 400,
      statusText: "Bad Request",
      responseText: JSON.stringify({ photo: ["La foto es obligatoria."] }),
    };

    await expect(api.post("/api/reports/", new FormData())).rejects.toEqual({
      photo: ["La foto es obligatoria."],
      status: 400,
    });
  });

  it("una subida sin red se reporta como falla de red", async () => {
    xhrResponse = "network-error";

    await expect(api.post("/api/reports/", new FormData())).rejects.toThrow(
      "Network request failed",
    );
  });

  it("una subida con la sesión vencida cierra la sesión", async () => {
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    xhrResponse = { status: 401, statusText: "", responseText: "{}" };

    await expect(api.post("/api/reports/", new FormData())).rejects.toThrow(
      "SESSION_EXPIRED",
    );
    expect(onUnauthorized).toHaveBeenCalled();
  });
});

describe("api.delete", () => {
  it("returns undefined on 204 without parsing body", async () => {
    const text = jest.fn();
    mockFetch.mockResolvedValue({ ok: true, status: 204, statusText: "", text });
    const result = await api.delete("/api/reports/1/like/");
    expect(result).toBeUndefined();
    expect(text).not.toHaveBeenCalled();
  });
});
