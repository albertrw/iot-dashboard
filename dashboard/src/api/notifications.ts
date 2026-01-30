import { api } from "./client";

export type Notification = {
  id: number;
  owner_user_id: string;
  device_uid: string | null;
  title: string;
  body: string;
  type: string;
  read_at: string | null;
  created_at: string;
};

export type NotificationsQuery = {
  limit?: number;
  beforeId?: number;
  filter?: "all" | "unread";
};

export async function listNotifications(
  query: NotificationsQuery = {}
): Promise<Notification[]> {
  const params = new URLSearchParams();
  const limit = query.limit ?? 50;
  if (limit) params.set("limit", String(limit));
  if (query.beforeId) params.set("before_id", String(query.beforeId));
  if (query.filter && query.filter !== "all") params.set("filter", query.filter);
  const qs = params.toString();
  return api<Notification[]>(`/api/notifications${qs ? `?${qs}` : ""}`);
}

export async function markNotificationRead(id: number): Promise<Notification> {
  return api<Notification>(`/api/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead(): Promise<{ ok: true }> {
  return api<{ ok: true }>(`/api/notifications/read-all`, { method: "POST" });
}
