import { fireEvent, screen } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import ReportDetailScreen from "../../../app/(app)/(tabs)/report/[id]";
import ModerationAppealScreen from "../../../app/(app)/moderation-appeal/[id]";
import { api } from "../../api/client";
import type { ModerationNotice, ReportDetail } from "../../api/reports";
import type { UserProfile } from "../../api/users";
import { useAuth } from "../../auth/AuthContext";
import { moderationMessages as t } from "../../messages/moderation";
import { renderWithProviders } from "../../test/renderWithProviders";

/**
 * US-049 — el descarte por moderación municipal, visto desde la app.
 *
 * El motivo es público (escenario 5): lo lee cualquiera que abra el reporte.
 * La apelación es del autor (escenario 6).
 */

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ id: "7" }),
  useFocusEffect: (callback: () => void) =>
    (jest.requireActual("react") as typeof import("react")).useEffect(callback, [callback]),
}));

jest.mock("react-native-maps", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const MapView = React.forwardRef(function MapView(props: Record<string, unknown>, ref: unknown) {
    React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
    return React.createElement(View, props);
  });
  return { __esModule: true, default: MapView, Marker: View };
});

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return { Ionicons: View };
});

jest.mock("../../validation/ValidationActions", () => ({
  ValidationActions: () => null,
}));

jest.mock("../../api/client", () => ({
  ...jest.requireActual("../../api/client"),
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("../../auth/AuthContext", () => ({ useAuth: jest.fn() }));

const mockedGet = api.get as jest.MockedFunction<typeof api.get>;
const mockedPost = api.post as jest.MockedFunction<typeof api.post>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const AUTHOR = { id: 1, name: "Vecina", avatar: null };
const REASON = "La foto es de otra ciudad: el bache no existe en esa dirección.";

function signedInAs(id: number) {
  const user: UserProfile = {
    id,
    name: "Persona",
    email: "persona@test.com",
    avatar: null,
    role: "ciudadano",
    municipality: null,
    must_change_password: false,
    onboarding_completed_at: "2026-01-01T00:00:00Z",
    is_public: true,
    url: `/api/users/${id}/`,
  };
  mockedUseAuth.mockReturnValue({
    user,
    token: "t",
    isLoading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    setUser: jest.fn(),
    refreshUser: jest.fn(),
  });
}

function detail(overrides: Partial<ReportDetail> = {}): ReportDetail {
  return {
    id: 7,
    number: 32,
    photo: "https://example.test/reporte.jpg",
    photo_removed_at: null,
    photo_status: "procesada" as const,
    under_privacy_review: false,
    description: "Bache enorme",
    category: "bache",
    latitude: null,
    longitude: null,
    address: "Buenos Aires 100",
    status: "cancelado",
    author: AUTHOR,
    like_count: 0,
    comment_count: 0,
    created_at: "2026-09-01T10:00:00Z",
    has_official_response: false,
    archived_at: null,
    area_assigned_at: null,
    appeal_count: 0,
    is_liked: false,
    comments: [],
    official_responses: [],
    resolution_evidences: [],
    resolution_appeals: [],
    objection_deadline: null,
    can_appeal: false,
    moderation: {
      reason: REASON,
      decided_at: "2026-10-05T12:00:00Z",
      can_appeal: true,
      appeal: null,
    },
    status_history: [],
    can_edit: false,
    ...overrides,
  } as ReportDetail;
}

const NOTICE: ModerationNotice = {
  id: 7,
  number: 32,
  category: "bache",
  status: "cancelado",
  created_at: "2026-09-01T10:00:00Z",
  moderation: { reason: REASON, decided_at: "2026-10-05T12:00:00Z", can_appeal: false, appeal: null },
  is_moderation_notice: true,
};

function renderDetail() {
  return renderWithProviders(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ReportDetailScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
});

describe("reporte descartado por moderación", () => {
  it("CP-049-M01 (US-049 E5) · un tercero ve solo el aviso con el motivo", async () => {
    signedInAs(99);
    mockedGet.mockResolvedValue(NOTICE as never);

    renderDetail();

    expect(await screen.findByText(REASON)).toBeTruthy();
    expect(screen.getByText(/Reporte descartado/)).toBeTruthy();
    // Ni la descripción ni el autor: el servidor no los manda y la pantalla
    // no intenta dibujarlos.
    expect(screen.queryByText("Bache enorme")).toBeNull();
    expect(screen.queryByText(t.appealButton)).toBeNull();
  });

  it("CP-049-M02 (US-049 E5, E6) · el autor ve el motivo y puede apelar", async () => {
    signedInAs(AUTHOR.id);
    mockedGet.mockResolvedValue(detail() as never);

    renderDetail();

    expect(await screen.findByText(t.bannerTitle)).toBeTruthy();
    expect(screen.getByText(REASON)).toBeTruthy();
    fireEvent.press(screen.getByText(t.appealButton));
    expect(mockPush).toHaveBeenCalledWith("/(app)/moderation-appeal/7");
  });

  it("CP-049-M03 (US-049 E6) · con la apelación pendiente no se ofrece otra", async () => {
    signedInAs(AUTHOR.id);
    mockedGet.mockResolvedValue(
      detail({
        moderation: {
          reason: REASON,
          decided_at: "2026-10-05T12:00:00Z",
          can_appeal: false,
          appeal: {
            status: "pendiente",
            reason: "El bache existe",
            created_at: "2026-10-06T12:00:00Z",
            resolved_at: null,
            resolution_reason: "",
          },
        },
      }) as never,
    );

    renderDetail();

    expect(await screen.findByText(t.appealPending)).toBeTruthy();
    expect(screen.queryByText(t.appealButton)).toBeNull();
  });

  it("CP-049-M04 (US-049 E7) · si la rechazaron, lo dice con la respuesta", async () => {
    signedInAs(AUTHOR.id);
    mockedGet.mockResolvedValue(
      detail({
        moderation: {
          reason: REASON,
          decided_at: "2026-10-05T12:00:00Z",
          can_appeal: false,
          appeal: {
            status: "rechazada",
            reason: "El bache existe",
            created_at: "2026-10-06T12:00:00Z",
            resolved_at: "2026-10-07T12:00:00Z",
            resolution_reason: "La foto no corresponde",
          },
        },
      }) as never,
    );

    renderDetail();

    expect(await screen.findByText(t.appealRejected)).toBeTruthy();
    expect(screen.getByText(/La foto no corresponde/)).toBeTruthy();
  });
});

describe("pantalla de apelación", () => {
  function renderAppeal() {
    return renderWithProviders(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ModerationAppealScreen />
      </SafeAreaProvider>,
    );
  }

  it("CP-049-M05 (US-049 E6) · avisa que es una sola y exige el motivo", async () => {
    renderAppeal();

    expect(screen.getByText(t.formWarning)).toBeTruthy();
    fireEvent.press(screen.getByText(t.formSubmit));

    expect(await screen.findByText(t.missingReasonBody)).toBeTruthy();
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("CP-049-M06 (US-049 E6) · manda el motivo al endpoint de moderación y vuelve", async () => {
    mockedPost.mockResolvedValue(detail() as never);
    renderAppeal();

    fireEvent.changeText(screen.getByLabelText(t.reasonLabel), "El bache existe de verdad");
    fireEvent.press(screen.getByText(t.formSubmit));

    await screen.findByText(t.formSubmit);
    expect(mockedPost).toHaveBeenCalledWith("/api/reports/7/moderation-appeal/", {
      reason: "El bache existe de verdad",
    });
    expect(mockBack).toHaveBeenCalled();
  });
});

describe("botón Compartir (US-030 E1)", () => {
  it("CP-030-M10 · aparece solo si el reporte tiene enlace público", async () => {
    signedInAs(99);
    mockedGet.mockResolvedValue(
      detail({
        status: "reportado",
        moderation: null,
        share_url: "https://urbancheck.com.ar/r/tok",
      }) as never,
    );

    renderDetail();

    expect(await screen.findByText("Compartir")).toBeTruthy();
  });

  it("CP-030-M11 · un reporte que nadie más ve no ofrece compartir", async () => {
    signedInAs(AUTHOR.id);
    mockedGet.mockResolvedValue(detail({ share_url: null }) as never);

    renderDetail();

    expect(await screen.findByText(t.bannerTitle)).toBeTruthy();
    expect(screen.queryByText("Compartir")).toBeNull();
  });
});
