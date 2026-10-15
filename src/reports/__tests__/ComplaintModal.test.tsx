import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import { api } from "../../api/client";
import type { ComplaintReason } from "../../api/reports";
import { reportKeys } from "../../lib/queryKeys";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ComplaintModal, REASON_REQUIRED_MESSAGE } from "../ComplaintModal";

/**
 * El formulario del botón *Denunciar* (US-021).
 *
 * Lo que importa: que los tres motivos salgan del servidor, que no se mande
 * nada sin motivo, que el comentario sea opcional y que la confirmación diga a
 * quién le llegó.
 */

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../api/client", () => ({
  ...jest.requireActual("../../api/client"),
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedGet = api.get as jest.MockedFunction<typeof api.get>;
const mockedPost = api.post as jest.MockedFunction<typeof api.post>;

const REASONS: ComplaintReason[] = [
  {
    value: "contenido_inapropiado",
    label: "Contenido inapropiado u ofensivo",
    recipient: "agente_municipal",
  },
  {
    value: "reporte_falso",
    label: "Reporte falso o inexistente",
    recipient: "agente_municipal",
  },
  {
    value: "dato_personal",
    label: "Dato personal visible",
    recipient: "admin_plataforma",
  },
];

const MUNICIPAL_RECEIPT = {
  id: 1,
  report: 7,
  reason: "reporte_falso",
  recipient: "agente_municipal",
  comment: "",
  received_at: "2026-10-13T10:00:00Z",
  detail: "Recibimos tu denuncia. La va a revisar el municipio del reporte.",
};

const PLATFORM_RECEIPT = {
  ...MUNICIPAL_RECEIPT,
  reason: "dato_personal",
  recipient: "admin_plataforma",
  detail:
    "Recibimos tu denuncia. Ocultamos el reporte mientras revisamos la imagen, " +
    "y la revisión se hace dentro de las 24 horas.",
};

const onClose = jest.fn();
const onSubmitted = jest.fn();
let alert: jest.SpyInstance;

function renderModal(reportId: number | null = 7) {
  return renderWithProviders(
    <ComplaintModal reportId={reportId} onClose={onClose} onSubmitted={onSubmitted} />,
  );
}

function lastAlert(): [string, string, AlertButton[]] {
  const call = alert.mock.calls[alert.mock.calls.length - 1];
  return [call?.[0], call?.[1], (call?.[2] ?? []) as AlertButton[]];
}

async function send() {
  await act(async () => {
    fireEvent.press(screen.getByText("Enviar denuncia"));
  });
}

beforeEach(() => {
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  mockedGet.mockResolvedValue(REASONS);
});

describe("Denunciar un reporte (US-021)", () => {
  it("CP-021-51 (US-021 E2) · ofrece los tres motivos que manda el servidor", async () => {
    renderModal();

    for (const reason of REASONS) {
      expect(await screen.findByText(reason.label)).toBeTruthy();
    }
    expect(mockedGet).toHaveBeenCalledWith("/api/reports/complaint-reasons/");
  });

  it("cerrado, no pide los motivos ni dibuja nada", () => {
    renderModal(null);

    expect(mockedGet).not.toHaveBeenCalled();
    expect(screen.queryByText("Enviar denuncia")).toBeNull();
  });

  it("CP-021-52 (US-021 E4) · sin motivo no manda nada y dice que es obligatorio", async () => {
    renderModal();
    await screen.findByText("Reporte falso o inexistente");

    await send();

    expect(screen.getByText(REASON_REQUIRED_MESSAGE)).toBeTruthy();
    expect(mockedPost).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("CP-021-53 (US-021 E4) · al elegir un motivo se va el aviso de que faltaba", async () => {
    renderModal();
    await screen.findByText("Reporte falso o inexistente");
    await send();

    fireEvent.press(screen.getByText("Reporte falso o inexistente"));

    expect(screen.queryByText(REASON_REQUIRED_MESSAGE)).toBeNull();
  });

  it("CP-021-54 (US-021 E1) · con el motivo solo, denuncia sin comentario", async () => {
    mockedPost.mockResolvedValue(MUNICIPAL_RECEIPT);
    renderModal();

    fireEvent.press(await screen.findByText("Reporte falso o inexistente"));
    await send();

    expect(mockedPost).toHaveBeenCalledWith("/api/reports/7/complaints/", {
      reason: "reporte_falso",
    });
  });

  it("CP-021-55 (US-021 E1) · manda el comentario cuando se escribe uno", async () => {
    mockedPost.mockResolvedValue(MUNICIPAL_RECEIPT);
    renderModal();

    fireEvent.press(await screen.findByText("Contenido inapropiado u ofensivo"));
    fireEvent.changeText(
      screen.getByLabelText("Comentario (opcional)"),
      "Insulta a un vecino.",
    );
    await send();

    expect(mockedPost).toHaveBeenCalledWith("/api/reports/7/complaints/", {
      reason: "contenido_inapropiado",
      comment: "Insulta a un vecino.",
    });
  });

  it("CP-021-56 (US-021 E3) · una denuncia de contenido confirma la revisión del municipio", async () => {
    mockedPost.mockResolvedValue(MUNICIPAL_RECEIPT);
    renderModal();

    fireEvent.press(await screen.findByText("Reporte falso o inexistente"));
    await send();

    const [title, message] = lastAlert();
    expect(title).toBe("Denuncia recibida");
    expect(message).toMatch(/municipio/);
    expect(message).not.toMatch(/24 horas/);
    expect(onClose).toHaveBeenCalled();
  });

  it("CP-021-57 (US-021 E3) · CP-043-51 (US-043 E1) · una de dato personal confirma el plazo de 24 horas", async () => {
    mockedPost.mockResolvedValue(PLATFORM_RECEIPT);
    renderModal();

    fireEvent.press(await screen.findByText("Dato personal visible"));
    await send();

    expect(lastAlert()[1]).toMatch(/24 horas/);
  });

  it("avisa a la pantalla recién cuando se cierra la confirmación", async () => {
    mockedPost.mockResolvedValue(PLATFORM_RECEIPT);
    renderModal();

    fireEvent.press(await screen.findByText("Dato personal visible"));
    await send();
    expect(onSubmitted).not.toHaveBeenCalled();

    act(() => {
      lastAlert()[2][0]?.onPress?.();
    });

    expect(onSubmitted).toHaveBeenCalledWith(PLATFORM_RECEIPT);
  });

  it("solo la de dato personal refresca los reportes: es la única que oculta", async () => {
    mockedPost.mockResolvedValue(MUNICIPAL_RECEIPT);
    const { queryClient } = renderModal();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    fireEvent.press(await screen.findByText("Reporte falso o inexistente"));
    await send();
    expect(invalidate).not.toHaveBeenCalled();

    mockedPost.mockResolvedValue(PLATFORM_RECEIPT);
    fireEvent.press(screen.getByText("Dato personal visible"));
    await send();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: reportKeys.all });
  });

  it("CP-021-58 (US-021 E6) · si ya lo denunció por ese motivo, lo dice sin registrar otra", async () => {
    mockedPost.mockRejectedValue({
      status: 409,
      code: "complaint_already_filed",
      detail: "Ya denunciaste este reporte por ese motivo.",
    });
    renderModal();

    fireEvent.press(await screen.findByText("Reporte falso o inexistente"));
    await send();

    const [title, message] = lastAlert();
    expect(title).toBe("Ya denunciaste este reporte");
    expect(message).toMatch(/ese motivo/);
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it("un error cualquiera deja el formulario abierto para reintentar", async () => {
    mockedPost.mockRejectedValue(new Error("Network request failed"));
    renderModal();

    fireEvent.press(await screen.findByText("Reporte falso o inexistente"));
    await send();

    expect(alert).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Enviar denuncia")).toBeTruthy();
  });

  it("si los motivos no cargan, ofrece reintentar", async () => {
    mockedGet.mockRejectedValueOnce({ status: 500 });
    renderModal();

    fireEvent.press(await screen.findByText("Reintentar"));

    await waitFor(() =>
      expect(screen.getByText("Reporte falso o inexistente")).toBeTruthy(),
    );
  });
});
