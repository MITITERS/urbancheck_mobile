import { api } from "../client";
import { getMe, getPublicProfile, patchMe } from "../users";

jest.mock("../client", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe("users api", () => {
  it("getMe requests the own-profile endpoint", () => {
    getMe();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/users/me/");
  });

  it("getPublicProfile requests the detail of another user (US-027)", () => {
    getPublicProfile(7);
    expect(mockedApi.get).toHaveBeenCalledWith("/api/users/7/");
  });

  it("patchMe sends the privacy switch as JSON", () => {
    patchMe({ is_public: false });
    expect(mockedApi.patch).toHaveBeenCalledWith("/api/users/me/", { is_public: false });
  });

  it("patchMe sends the name", () => {
    patchMe({ name: "Ana Pérez" });
    expect(mockedApi.patch).toHaveBeenCalledWith("/api/users/me/", { name: "Ana Pérez" });
  });

  it("patchMe forwards FormData as-is so the avatar keeps its multipart body", () => {
    const form = new FormData();
    form.append("name", "Ana");
    patchMe(form);
    expect(mockedApi.patch).toHaveBeenCalledWith("/api/users/me/", form);
  });

  it("getPublicProfile of a private user resolves with nulls, not an error", async () => {
    mockedApi.get.mockResolvedValueOnce({
      id: 9,
      name: "Vecino",
      avatar: null,
      is_public: false,
      date_joined: null,
      report_count: null,
    });
    const profile = await getPublicProfile(9);
    expect(profile.is_public).toBe(false);
    expect(profile.date_joined).toBeNull();
    expect(profile.report_count).toBeNull();
  });
});
