const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : window.location.origin);

function getAuthToken() {
  try {
    return localStorage.getItem("auth_token");
  } catch {
    return null;
  }
}

function clearAuthToken() {
  try {
    localStorage.removeItem("auth_token");
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new Event("auth_token_changed"));
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  status: number;
  statusText: string;
  data: unknown;
  raw: string;

  constructor(params: { message: string; status: number; statusText: string; data: unknown; raw: string }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.statusText = params.statusText;
    this.data = params.data;
    this.raw = params.raw;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearAuthToken();
    }
    const raw = await res.text().catch(() => "");
    const contentType = res.headers.get("content-type") || "";
    const maybeJson =
      contentType.includes("application/json") || raw.trim().startsWith("{") || raw.trim().startsWith("[");
    const data = maybeJson ? safeJsonParse(raw) : null;

    const message =
      (data && typeof (data as any).error === "string" && (data as any).error) ||
      (data && typeof (data as any).message === "string" && (data as any).message) ||
      raw ||
      `Request failed (${res.status})`;

    throw new ApiError({
      message,
      status: res.status,
      statusText: res.statusText,
      data,
      raw,
    });
  }

  // allow empty response bodies
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return undefined as T;

  return (await res.json()) as T;
}
