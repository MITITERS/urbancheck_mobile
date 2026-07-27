import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import React from "react";

import { getSession } from "../../api/auth";
import { setSessionToken } from "../../api/client";
import { AuthProvider, useAuth } from "../AuthContext";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("../../api/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("../../api/client", () => ({
  setSessionToken: jest.fn(),
  setUnauthorizedHandler: jest.fn(),
}));

const mockedStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockedSetSessionToken = setSessionToken as jest.MockedFunction<
  typeof setSessionToken
>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

beforeEach(() => {
  mockedStore.setItemAsync.mockResolvedValue(undefined);
  mockedStore.deleteItemAsync.mockResolvedValue(undefined);
});

describe("AuthContext hydration", () => {
  it("ends without token when SecureStore is empty", async () => {
    mockedStore.getItemAsync.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.token).toBeNull();
    expect(mockedGetSession).not.toHaveBeenCalled();
  });

  it("restores session from stored token", async () => {
    mockedStore.getItemAsync.mockResolvedValue("stored-token");
    mockedGetSession.mockResolvedValue({
      meta: { session_token: "fresh-token" },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.token).toBe("fresh-token");
    expect(mockedSetSessionToken).toHaveBeenCalledWith("fresh-token");
  });

  it("clears stored token when the session is invalid", async () => {
    mockedStore.getItemAsync.mockResolvedValue("stale-token");
    mockedGetSession.mockRejectedValue(new Error("SESSION_EXPIRED"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.token).toBeNull();
    expect(mockedStore.deleteItemAsync).toHaveBeenCalledWith(
      "urbancheck_session_token",
    );
    expect(mockedSetSessionToken).toHaveBeenLastCalledWith(null);
  });
});

describe("signIn", () => {
  beforeEach(() => {
    mockedStore.getItemAsync.mockResolvedValue(null);
  });

  it("stores the token when rememberMe is true", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(() => result.current.signIn("tok", true));
    expect(result.current.token).toBe("tok");
    expect(mockedSetSessionToken).toHaveBeenCalledWith("tok");
    expect(mockedStore.setItemAsync).toHaveBeenCalledWith(
      "urbancheck_session_token",
      "tok",
    );
  });

  it("does not persist the token when rememberMe is false", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(() => result.current.signIn("tok", false));
    expect(result.current.token).toBe("tok");
    expect(mockedStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("clears token, user and stored session", async () => {
    mockedStore.getItemAsync.mockResolvedValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(() => result.current.signIn("tok", true));
    await act(() => result.current.signOut());
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(mockedSetSessionToken).toHaveBeenLastCalledWith(null);
    expect(mockedStore.deleteItemAsync).toHaveBeenCalledWith(
      "urbancheck_session_token",
    );
  });
});

describe("useAuth outside provider", () => {
  it("throws a helpful error", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within AuthProvider",
    );
  });
});
