import { api } from "../client";
import {
  addComment,
  createReport,
  geocodeAddress,
  getComments,
  getReport,
  likeReport,
  listMyReports,
  listReports,
  unlikeReport,
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
    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/?mine=true&page=2");
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
