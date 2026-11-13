import { api } from "../client";
import {
  getNotificationPreferences,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationPreference,
} from "../notifications";

jest.mock("../client", () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe("notifications api", () => {
  it("lists the inbox", () => {
    listNotifications(2);
    expect(mockedApi.get).toHaveBeenCalledWith("/api/notifications/?page=2");
  });

  it("marks one as read", () => {
    markNotificationRead(5);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/notifications/5/read/");
  });

  it("marks the whole inbox as read", () => {
    markAllNotificationsRead();
    expect(mockedApi.post).toHaveBeenCalledWith("/api/notifications/read_all/");
  });

  it("reads the unread badge counter", () => {
    getUnreadCount();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/notifications/unread_count/");
  });
});

describe("notification preferences api", () => {
  it("reads the catalog from the backend instead of hardcoding it", () => {
    getNotificationPreferences();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/notification-preferences/");
  });

  it("saves one kind at a time", () => {
    setNotificationPreference("cambio_estado", false);
    expect(mockedApi.patch).toHaveBeenCalledWith("/api/notification-preferences/", {
      kind: "cambio_estado",
      enabled: false,
    });
  });
});
