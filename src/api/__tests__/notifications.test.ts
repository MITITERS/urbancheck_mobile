import { api } from "../client";
import {
  deleteNotification,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../notifications";

jest.mock("../client", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe("notifications api", () => {
  it("listNotifications requests page 1 by default", () => {
    listNotifications();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/notifications/?page=1");
  });

  it("listNotifications can filter unread only", () => {
    listNotifications(2, true);
    expect(mockedApi.get).toHaveBeenCalledWith("/api/notifications/?page=2&unread=true");
  });

  it("getUnreadCount hits the badge endpoint", () => {
    getUnreadCount();
    expect(mockedApi.get).toHaveBeenCalledWith("/api/notifications/unread_count/");
  });

  it("markNotificationRead posts to the read action", () => {
    markNotificationRead(4);
    expect(mockedApi.post).toHaveBeenCalledWith("/api/notifications/4/read/");
  });

  it("markAllNotificationsRead posts to the bulk action", () => {
    markAllNotificationsRead();
    expect(mockedApi.post).toHaveBeenCalledWith("/api/notifications/read_all/");
  });

  it("deleteNotification deletes the detail endpoint", () => {
    deleteNotification(4);
    expect(mockedApi.delete).toHaveBeenCalledWith("/api/notifications/4/");
  });
});
