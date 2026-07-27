import { api } from "../client";
import {
  getSession,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  signup,
} from "../auth";

jest.mock("../client", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe("auth api", () => {
  it("signup posts credentials to allauth", () => {
    const data = { email: "a@b.com", password: "secret123", name: "Ana" };
    signup(data);
    expect(mockedApi.post).toHaveBeenCalledWith(
      "/_allauth/app/v1/auth/signup",
      data,
    );
  });

  it("login posts credentials to allauth", () => {
    const data = { email: "a@b.com", password: "secret123" };
    login(data);
    expect(mockedApi.post).toHaveBeenCalledWith(
      "/_allauth/app/v1/auth/login",
      data,
    );
  });

  it("logout deletes the session", () => {
    logout();
    expect(mockedApi.delete).toHaveBeenCalledWith("/_allauth/app/v1/auth/session");
  });

  it("getSession fetches the current session", () => {
    getSession();
    expect(mockedApi.get).toHaveBeenCalledWith("/_allauth/app/v1/auth/session");
  });

  it("requestPasswordReset posts the email", () => {
    requestPasswordReset("a@b.com");
    expect(mockedApi.post).toHaveBeenCalledWith(
      "/_allauth/app/v1/auth/password/request",
      { email: "a@b.com" },
    );
  });
});

describe("resetPassword", () => {
  const mockFetch = jest.fn();
  global.fetch = mockFetch as unknown as typeof fetch;

  function response(status: number, body: Record<string, unknown> = {}) {
    return { status, json: () => Promise.resolve(body) };
  }

  it("resolves on 200", async () => {
    mockFetch.mockResolvedValue(response(200, { status: 200 }));
    await expect(resetPassword("key", "newpass123")).resolves.toBeUndefined();
  });

  it("resolves on 401 (allauth success: must log in after reset)", async () => {
    mockFetch.mockResolvedValue(response(401, { status: 401 }));
    await expect(resetPassword("key", "newpass123")).resolves.toBeUndefined();
  });

  it("rejects when body reports status 400 (invalid key/password)", async () => {
    const body = { status: 400, errors: [{ message: "Invalid key" }] };
    mockFetch.mockResolvedValue(response(401, body));
    await expect(resetPassword("bad", "newpass123")).rejects.toEqual(body);
  });

  it("rejects on unexpected HTTP status", async () => {
    const body = { detail: "boom" };
    mockFetch.mockResolvedValue(response(500, body));
    await expect(resetPassword("key", "newpass123")).rejects.toEqual(body);
  });

  it("posts key and password as JSON", async () => {
    mockFetch.mockResolvedValue(response(200, { status: 200 }));
    await resetPassword("thekey", "newpass123");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:8000/_allauth/app/v1/auth/password/reset");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ key: "thekey", password: "newpass123" });
  });
});
