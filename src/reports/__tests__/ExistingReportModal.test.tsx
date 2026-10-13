import { render, screen, userEvent } from "@testing-library/react-native";

import type { ExistingReport } from "../../api/reports";
import { ExistingReportModal } from "../ExistingReportModal";

// Los iconos no son lo que se prueba acá, y `expo-font` —del que dependen— no
// está instalado en este árbol de node_modules.
jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

const EXISTING: ExistingReport = {
  id: 42,
  number: 7,
  photo: "https://example.test/media/reports/bache.jpg",
  photo_removed_at: null,
  photo_status: "procesada" as const,
  under_privacy_review: false,
  description: "Bache frente a la escuela.",
  category: "bache",
  latitude: "-32.410300",
  longitude: "-63.240000",
  address: "Bv. España 100",
  status: "pendiente_validacion",
  author: { id: 9, name: "Otra vecina", avatar: null },
  like_count: 3,
  comment_count: 0,
  created_at: "2026-09-20T10:00:00Z",
  has_official_response: false,
  appeal_count: 0,
  archived_at: null,
  area_assigned_at: null,
  is_liked: false,
  is_author: false,
  distance_meters: 12,
};

function renderModal(report: ExistingReport | null = EXISTING) {
  const handlers = { onJoin: jest.fn(), onOpen: jest.fn(), onBack: jest.fn() };
  render(<ExistingReportModal report={report} {...handlers} />);
  return handlers;
}

describe("ExistingReportModal (US-032)", () => {
  it("shows the existing report card", () => {
    renderModal();

    expect(screen.getByText("Este problema ya fue reportado")).toBeTruthy();
    expect(screen.getByText("Bache")).toBeTruthy();
    expect(screen.getByText("Pendiente de validación")).toBeTruthy();
    expect(screen.getByText(/A 12 m/)).toBeTruthy();
    expect(screen.getByText("3 vecinos lo apoyan")).toBeTruthy();
  });

  it("never calls it a duplicate", () => {
    for (const report of [
      EXISTING,
      { ...EXISTING, is_liked: true },
      { ...EXISTING, is_author: true },
    ]) {
      const { unmount } = render(
        <ExistingReportModal
          report={report}
          onJoin={jest.fn()}
          onOpen={jest.fn()}
          onBack={jest.fn()}
        />,
      );
      expect(screen.queryByText(/duplicad/i)).toBeNull();
      unmount();
    }
  });

  it("offers to join and joins", async () => {
    const { onJoin } = renderModal();

    await userEvent.press(screen.getByText("Sumar mi apoyo"));

    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it("goes back to the form without joining", async () => {
    const { onBack, onJoin } = renderModal();

    await userEvent.press(screen.getByText("Volver"));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onJoin).not.toHaveBeenCalled();
  });

  it("does not offer to join to someone already supporting it", async () => {
    const { onOpen } = renderModal({ ...EXISTING, is_liked: true });

    expect(screen.getByText("Ya estás apoyando este reclamo")).toBeTruthy();
    expect(screen.queryByText("Sumar mi apoyo")).toBeNull();

    await userEvent.press(screen.getByText("Ver reclamo"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("takes the author to their own report without offering to join", async () => {
    const { onOpen } = renderModal({ ...EXISTING, is_author: true });

    expect(screen.getByText("Ya reportaste este problema")).toBeTruthy();
    expect(screen.queryByText("Sumar mi apoyo")).toBeNull();

    await userEvent.press(screen.getByText("Ir a mi reclamo"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without a report", () => {
    renderModal(null);

    expect(screen.queryByTestId("existing-report")).toBeNull();
  });
});
