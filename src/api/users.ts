import { api } from "./client";

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  role: "ciudadano" | "municipal";
  url: string;
}

export function getMe() {
  return api.get<UserProfile>("/api/users/me/");
}

export function patchMe(data: FormData) {
  return api.patch<UserProfile>("/api/users/me/", data);
}
