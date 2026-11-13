// Thin fetch wrapper for the Go API.
// - Sends the X-Requested-With header the backend requires on mutating calls.
// - On a 401 from a non-auth endpoint, refreshes the session once and retries.

export type User = {
  id: string;
  email: string;
  username: string;
  name: string;
  avatarUrl?: string;
  defaultCurrency: string;
  tz: string;
  createdAt: string;
};

export type ProfileUpdate = Partial<{
  name: string;
  avatarUrl: string;
  defaultCurrency: string;
  tz: string;
}>;

export class ApiError extends Error {
  status: number;
  retryAfter?: number;
  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const HEADERS = {
  "Content-Type": "application/json",
  "X-Requested-With": "pocksyra-web",
};

function send(path: string, init: RequestInit = {}) {
  return fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: HEADERS,
  });
}

// Single-flight: concurrent 401s share one refresh call. Important because
// refresh tokens rotate, and reusing one revokes the whole session.
let refreshing: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = send("/auth/refresh", { method: "POST" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function toError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch {
    /* non-JSON body */
  }
  const ra = Number(res.headers.get("Retry-After"));
  return new ApiError(res.status, message, Number.isFinite(ra) && ra > 0 ? ra : undefined);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await send(path, init);
  if (res.status === 401 && !path.startsWith("/auth/")) {
    if (await refreshSession()) res = await send(path, init);
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  me: () => request<{ user: User }>("/me"),
  updateMe: (patch: ProfileUpdate) =>
    request<{ user: User }>("/me", { method: "PATCH", body: JSON.stringify(patch) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
};

/** Human-friendly message for any thrown error, including rate limits. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return err.retryAfter
        ? `Too many attempts. Try again in ${err.retryAfter}s.`
        : "Too many attempts. Try again later.";
    }
    return err.message;
  }
  return "Can't reach the server. Check your connection and try again.";
}
