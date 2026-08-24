import { act, renderHook, waitFor } from "@testing-library/react-native";

import { getUnreadCount } from "../../api/notifications";
import { adjustUnread, refreshUnread, setUnread, useUnreadCount } from "../unreadStore";

jest.mock("../../api/notifications", () => ({
  getUnreadCount: jest.fn(),
}));

const mockedGetUnreadCount = getUnreadCount as jest.MockedFunction<typeof getUnreadCount>;

/**
 * US-009: el badge de la pestaña Avisos y la bandeja comparten este contador. El
 * bug que motivó el store: al leer un aviso el badge seguía mostrando el número
 * viejo hasta la siguiente vuelta del sondeo.
 */

beforeEach(() => {
  setUnread(0);
});

describe("unreadStore", () => {
  it("starts at zero", () => {
    const { result } = renderHook(() => useUnreadCount());
    expect(result.current).toBe(0);
  });

  it("re-renders the badge when the value changes", () => {
    const { result } = renderHook(() => useUnreadCount());
    act(() => setUnread(3));
    expect(result.current).toBe(3);
  });

  it("adjustUnread lowers the badge without waiting for the server", () => {
    const { result } = renderHook(() => useUnreadCount());
    act(() => setUnread(3));
    act(() => adjustUnread(-1));
    expect(result.current).toBe(2);
  });

  it("never goes below zero", () => {
    const { result } = renderHook(() => useUnreadCount());
    act(() => setUnread(1));
    act(() => adjustUnread(-5));
    expect(result.current).toBe(0);
  });

  it("marking everything as read empties the badge", () => {
    const { result } = renderHook(() => useUnreadCount());
    act(() => setUnread(7));
    act(() => setUnread(0));
    expect(result.current).toBe(0);
  });

  it("keeps the badge and the inbox in sync", () => {
    const badge = renderHook(() => useUnreadCount());
    const inbox = renderHook(() => useUnreadCount());
    act(() => setUnread(4));
    expect(badge.result.current).toBe(4);
    expect(inbox.result.current).toBe(4);
  });

  it("stops notifying an unmounted screen", () => {
    const { result, unmount } = renderHook(() => useUnreadCount());
    act(() => setUnread(2));
    unmount();
    act(() => setUnread(9));
    expect(result.current).toBe(2);
  });

  it("refreshUnread takes the authoritative value from the backend", async () => {
    mockedGetUnreadCount.mockResolvedValueOnce({ unread: 5 });
    const { result } = renderHook(() => useUnreadCount());
    await act(async () => {
      await refreshUnread();
    });
    await waitFor(() => expect(result.current).toBe(5));
  });

  it("refreshUnread keeps the last known value when the request fails", async () => {
    const { result } = renderHook(() => useUnreadCount());
    act(() => setUnread(3));
    mockedGetUnreadCount.mockRejectedValueOnce(new Error("SESSION_EXPIRED"));
    await act(async () => {
      await refreshUnread();
    });
    expect(result.current).toBe(3);
  });
});
