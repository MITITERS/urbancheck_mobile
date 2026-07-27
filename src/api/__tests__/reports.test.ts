import { api } from "../client";
import {
  addComment,
  createReport,
  deleteComment,
  deleteReport,
  geocodeAddress,
  getComments,
  getReport,
  likeReport,
  listMapMarkers,
  listMyReports,
  listReports,
  listUserReports,
  unlikeReport,
  updateReport,
} from "../reports";

jest.mock("../client", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe("reports api", () => {
  it("listReports requests page 1 by default", () => {
    listReports();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/?page=1");
  });

  it("listReports requests the given page", () => {
    listReports(3);
    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/?page=3");
  });

  it("listMyReports adds mine=true filter", () => {
    listMyReports(2);
    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/?page=2&mine=true");
  });

  it("listReports joins several categories and statuses with commas", () => {
    listReports(1, {
      categories: ["bache", "basura"],
      statuses: ["reportado"],
    });
    expect(mockedApi.get).toHaveBeenCalledWith(
      "/api/reports/?page=1&category=bache%2Cbasura&status=reportado",
    );
  });

  it("listReports URL-encodes and trims the search term", () => {
    listReports(1, { search: "  Av. Rivadavia  " });
    expect(mockedApi.get).toHaveBeenCalledWith(
      "/api/reports/?page=1&search=Av.%20Rivadavia",
    );
  });

  it("listReports omits empty filters", () => {
    listReports(1, { search: "   ", categories: [], statuses: [] });
    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/?page=1");
  });

  it("listUserReports filters by author", () => {
    listUserReports(9, 2);
    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/?page=2&author=9");
  });

  it("listMapMarkers hits the map endpoint without pagination", () => {
    listMapMarkers({ categories: ["bache"] });
    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/map/?category=bache");
  });

  it("listMapMarkers without filters has no query string", () => {
    listMapMarkers();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/map/");
  });

  it("updateReport patches the detail endpoint", () => {
    updateReport(5, { description: "Corregido" });
    expect(mockedApi.patch).toHaveBeenCalledWith("/api/reports/5/", {
      description: "Corregido",
    });
  });

  it("deleteReport deletes the detail endpoint", () => {
    deleteReport(5);
    expect(mockedApi.delete).toHaveBeenCalledWith("/api/reports/5/");
  });

  it("deleteComment targets the standalone comment resource", () => {
    deleteComment(12);
    expect(mockedApi.delete).toHaveBeenCalledWith("/api/comments/12/");
  });

  it("getReport requests the detail endpoint", () => {
    getReport(42);
    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/42/");
  });

  it("createReport posts the FormData as-is", () => {
    const form = new FormData();
    createReport(form);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/reports/", form);
  });

  it("likeReport posts to the like endpoint", () => {
    likeReport(7);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/reports/7/like/");
  });

  it("unlikeReport deletes the like", () => {
    unlikeReport(7);
    expect(mockedApi.delete).toHaveBeenCalledWith("/api/reports/7/like/");
  });

  it("getComments requests the comments endpoint", () => {
    getComments(7);
    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/7/comments/");
  });

  it("addComment posts the text as JSON", () => {
    addComment(7, "Buen reporte");
    expect(mockedApi.post).toHaveBeenCalledWith("/api/reports/7/comments/", {
      text: "Buen reporte",
    });
  });

  it("geocodeAddress URL-encodes the query", () => {
    geocodeAddress("Av. Corrientes 1234 & más");
    expect(mockedApi.get).toHaveBeenCalledWith(
      "/api/reports/geocode/?q=Av.%20Corrientes%201234%20%26%20m%C3%A1s",
    );
  });
});
