import { api } from "./client";

export type AuthUser = {
  id: string;
  email: string;
  avatar_key?: string | null;
};

export async function register(params: { email: string; password: string }) {
  return api<{ token: string; user: AuthUser; expires_at: string }>(
    "/api/auth/register",
    {
    method: "POST",
    body: JSON.stringify(params),
    }
  );
}

export async function login(params: { email: string; password: string }) {
  return api<{ token: string; user: AuthUser; expires_at: string }>(
    "/api/auth/login",
    {
    method: "POST",
    body: JSON.stringify(params),
    }
  );
}

export async function me() {
  return api<{ user: AuthUser }>("/api/auth/me");
}

export async function logout() {
  return api<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export async function changePassword(params: {
  current_password: string;
  new_password: string;
}) {
  return api<{ token: string; user: AuthUser; expires_at: string }>(
    "/api/auth/change-password",
    {
      method: "POST",
      body: JSON.stringify(params),
    }
  );
}

export async function updateProfile(params: { avatar_key: string | null }) {
  return api<{ user: AuthUser }>("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}
