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
  listMapReports,
  listReportsByAuthor,
  listMyReports,
  listReports,
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

  it("listReports sends the location so the feed is scoped to the municipality", () => {
    listReports(1, { latitude: -32.4103, longitude: -63.24 });

    expect(mockedApi.get).toHaveBeenCalledWith(
      "/api/reports/?page=1&latitude=-32.4103&longitude=-63.24",
    );
  });

  it("listMyReports adds mine=true filter", () => {
    listMyReports(2);
    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/?mine=true&page=2");
  });

  it("listMapReports scopes the markers to the citizen location", () => {
    listMapReports({ latitude: -32.4103, longitude: -63.24 });

    expect(mockedApi.get).toHaveBeenCalledWith(
      "/api/reports/map/?latitude=-32.4103&longitude=-63.24",
    );
  });

  it("listMapReports without location asks for every marker", () => {
    listMapReports();

    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/map/");
  });

  it("listReportsByAuthor asks for that author's reports, unscoped", () => {
    // Sin coordenadas: es la obra de alguien, no el feed del barrio.
    listReportsByAuthor(5);

    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/?author=5&page=1");
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

  it("updateReport patches the report with its FormData", () => {
    const form = new FormData();
    updateReport(42, form);

    expect(mockedApi.patch).toHaveBeenCalledWith("/api/reports/42/", form);
  });

  it("deleteReport deletes the report itself, not its like", () => {
    deleteReport(42);

    expect(mockedApi.delete).toHaveBeenCalledWith("/api/reports/42/");
  });

  it("deleteComment targets the comment resource, not the report", () => {
    deleteComment(9);

    expect(mockedApi.delete).toHaveBeenCalledWith("/api/comments/9/");
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
