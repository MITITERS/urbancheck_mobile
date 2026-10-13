import { api } from "../client";
import {
  addComment,
  complaintConflict,
  createReport,
  deleteComment,
  deleteReport,
  fileComplaint,
  geocodeAddress,
  getComments,
  getReport,
  isReportAlreadyExists,
  likeReport,
  listComplaintReasons,
  listMapReports,
  listReportsByAuthor,
  listMyReports,
  listReports,
  privacyRequestConflict,
  requestPrivacyReview,
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

describe("respuestas oficiales en el detalle (US-024)", () => {
  it("viajan aparte de los comentarios, como bloque propio", async () => {
    // Escenario 10: un compromiso institucional no es un comentario de vecino,
    // y la app los presenta separados porque el contrato ya los separa.
    mockedApi.get.mockResolvedValue({
      id: 7,
      comments: [],
      official_responses: [
        {
          id: 1,
          text: "Lo reparamos en 15 días.",
          created_at: "2026-09-01T10:00:00Z",
          municipality: "Villa María",
        },
      ],
    });

    const detail = await getReport(7);

    expect(detail.official_responses).toHaveLength(1);
    // Firma la municipalidad: la identidad del agente no llega al ciudadano.
    expect(detail.official_responses[0].municipality).toBe("Villa María");
    expect(detail.official_responses[0]).not.toHaveProperty("author");
  });

  describe("isReportAlreadyExists (US-032)", () => {
    const existing = { id: 3, category: "bache", is_liked: false, is_author: false };

    it("recognizes the 409 of a report that already exists", () => {
      expect(
        isReportAlreadyExists({
          status: 409,
          code: "report_already_exists",
          detail: "Este problema ya fue reportado.",
          existing_report: existing,
        }),
      ).toBe(true);
    });

    it("ignores another conflict", () => {
      // Por ejemplo, el de una transición de estado: no trae ningún reclamo.
      expect(
        isReportAlreadyExists({ status: 409, detail: "Estado inválido." }),
      ).toBe(false);
    });

    it("ignores the code without the existing report", () => {
      expect(
        isReportAlreadyExists({ status: 409, code: "report_already_exists" }),
      ).toBe(false);
    });

    it("ignores a validation error and non-objects", () => {
      expect(isReportAlreadyExists({ status: 400, category: ["Inválida."] })).toBe(false);
      expect(isReportAlreadyExists(new Error("Network request failed"))).toBe(false);
      expect(isReportAlreadyExists(null)).toBe(false);
    });
  });
});

describe("denuncia por dato personal visible (US-043)", () => {
  it("denuncia la foto del reporte sin mandar evidencia", () => {
    requestPrivacyReview(7);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/reports/7/privacy-request/", {});
  });

  it("denuncia la foto de un cierre indicando cuál", () => {
    requestPrivacyReview(7, 3);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/reports/7/privacy-request/", {
      evidence: 3,
    });
  });

  it("reconoce los dos conflictos por su código", () => {
    expect(
      privacyRequestConflict({ status: 409, code: "privacy_request_pending" }),
    ).toBe("privacy_request_pending");
    expect(
      privacyRequestConflict({ status: 409, code: "image_already_removed" }),
    ).toBe("image_already_removed");
  });

  it("no confunde otro 409 ni otro error con estos", () => {
    expect(
      privacyRequestConflict({ status: 409, code: "report_already_exists" }),
    ).toBeNull();
    expect(privacyRequestConflict({ status: 403, detail: "No." })).toBeNull();
    expect(privacyRequestConflict(new Error("Network request failed"))).toBeNull();
  });
});

describe("denunciar un reporte (US-021)", () => {
  it("pide el catálogo de motivos al servidor", () => {
    listComplaintReasons();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/reports/complaint-reasons/");
  });

  it("manda el motivo, y el comentario solo si tiene algo", () => {
    fileComplaint(7, "reporte_falso");
    expect(mockedApi.post).toHaveBeenCalledWith("/api/reports/7/complaints/", {
      reason: "reporte_falso",
    });

    fileComplaint(7, "reporte_falso", "   ");
    expect(mockedApi.post).toHaveBeenLastCalledWith("/api/reports/7/complaints/", {
      reason: "reporte_falso",
    });
  });

  it("manda el comentario sin los espacios de los bordes", () => {
    fileComplaint(7, "contenido_inapropiado", "  Es un insulto.  ");
    expect(mockedApi.post).toHaveBeenCalledWith("/api/reports/7/complaints/", {
      reason: "contenido_inapropiado",
      comment: "Es un insulto.",
    });
  });

  it("reconoce los conflictos por su código", () => {
    for (const code of [
      "complaint_already_filed",
      "report_not_public",
      "image_already_removed",
    ]) {
      expect(complaintConflict({ status: 409, code })).toBe(code);
    }
  });

  it("no confunde otro 409 ni otro error con estos", () => {
    expect(complaintConflict({ status: 409, code: "report_already_exists" })).toBeNull();
    expect(complaintConflict({ status: 403, detail: "No." })).toBeNull();
    expect(complaintConflict(new Error("Network request failed"))).toBeNull();
  });
});
