import { api, setSessionToken, setUnauthorizedHandler } from "../client";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: () => Promise.resolve(body),
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

  it("does not set Content-Type for FormData bodies", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 1 }, 201));
    const form = new FormData();
    form.append("description", "bache");
    await api.post("/api/reports/", form);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.body).toBe(form);
    expect(options.headers["Content-Type"]).toBeUndefined();
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
      json: () => Promise.reject(new Error("not json")),
    });
    await expect(api.get("/api/test/")).rejects.toEqual({
      detail: "Internal Server Error",
      status: 500,
    });
  });
});

describe("api.delete", () => {
  it("returns undefined on 204 without parsing body", async () => {
    const json = jest.fn();
    mockFetch.mockResolvedValue({ ok: true, status: 204, json });
    const result = await api.delete("/api/reports/1/like/");
    expect(result).toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });
});
