import { api } from "./client";

export interface SignupData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  meta: { session_token: string };
  data?: { user?: { id: number; email: string; display: string } };
}

export function signup(data: SignupData) {
  return api.post<AuthResponse>("/_allauth/app/v1/auth/signup", data);
}

export function login(data: LoginData) {
  return api.post<AuthResponse>("/_allauth/app/v1/auth/login", data);
}

export function logout() {
  // 401 response from DELETE is expected (success) — client.ts won't throw for it
  // because we treat 401 as session expired. We need raw fetch here.
  return fetch(`${process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000"}/_allauth/app/v1/auth/session`, {
    method: "DELETE",
  });
}

export function getSession() {
  return api.get<AuthResponse>("/_allauth/app/v1/auth/session");
}

export function requestPasswordReset(email: string) {
  return api.post("/_allauth/app/v1/auth/password/request", { email });
}

export async function resetPassword(key: string, password: string): Promise<void> {
  const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
  const response = await fetch(`${BASE_URL}/_allauth/app/v1/auth/password/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ key, password }),
  });
  const data = await response.json() as Record<string, unknown>;
  // allauth returns 401 on success (user must log in after reset)
  if (response.status === 200 || response.status === 401) {
    if ((data.status as number) === 400) throw data;
    return;
  }
  throw data;
}
