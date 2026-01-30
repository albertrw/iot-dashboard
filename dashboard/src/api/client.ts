const API_BASE = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
const USER_ID = import.meta.env.VITE_USER_ID as string;

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": USER_ID,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }

  // allow empty response bodies
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return undefined as T;

  return (await res.json()) as T;
}
