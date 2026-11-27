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
  /** UPI address (VPA) used to receive payments; absent until the user adds one. */
  upiId?: string;
  createdAt: string;
};

export type ProfileUpdate = Partial<{
  name: string;
  avatarUrl: string;
  defaultCurrency: string;
  tz: string;
  /** Empty string removes the saved UPI ID. */
  upiId: string;
}>;

/** What other people are allowed to see about a user. */
export type PublicUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
};

export type FriendEntry = {
  /** friendship id: used to accept / decline / remove */
  id: string;
  status: "pending" | "accepted";
  friend: PublicUser;
  createdAt: string;
  acceptedAt?: string;
};

export type FriendList = {
  friends: FriendEntry[];
  /** requests waiting for my answer */
  incoming: FriendEntry[];
  /** requests I sent */
  outgoing: FriendEntry[];
};

export type InviteLink = { token: string; url: string; expiresAt: string };
export type InvitePreview = { inviter: PublicUser; expiresAt: string; own: boolean };

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
    headers: { ...HEADERS, ...(init.headers as Record<string, string> | undefined) },
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

export const friendsApi = {
  list: () => request<FriendList>("/api/friends"),
  sendRequest: (target: { email?: string; username?: string }) =>
    request<{ friendship: FriendEntry; autoAccepted: boolean }>("/api/friends/requests", {
      method: "POST",
      body: JSON.stringify(target),
    }),
  accept: (id: string) =>
    request<{ friendship: FriendEntry }>(`/api/friends/requests/${id}/accept`, { method: "POST" }),
  decline: (id: string) => request<void>(`/api/friends/requests/${id}/decline`, { method: "POST" }),
  /** unfriend, or cancel a request I sent */
  remove: (id: string, force = false) =>
    request<void>(`/api/friends/${id}${force ? "?force=true" : ""}`, { method: "DELETE" }),

  createInvite: () => request<InviteLink>("/api/invites", { method: "POST" }),
  previewInvite: (token: string) =>
    request<InvitePreview>(`/api/invites/${encodeURIComponent(token)}`),
  acceptInvite: (token: string) =>
    request<{ friendship: FriendEntry }>(`/api/invites/${encodeURIComponent(token)}/accept`, {
      method: "POST",
    }),
};

// ---------- expenses, balances, settlements ----------

export type SplitMethod = "equal" | "exact" | "percent" | "shares";

export type SplitInput = {
  userId: string;
  /** equal: ignored · exact: minor units · percent: basis points · shares: weight */
  value: number;
};

export type ExpenseInput = {
  description: string;
  merchant?: string;
  category?: string;
  /** set when the expense was filled in from a scanned receipt */
  receiptMeta?: { ocrConfidence: number };
  amount: number; // minor units
  currency: string;
  paidBy: string;
  method: SplitMethod;
  splits: SplitInput[];
  date?: string; // ISO
};

export type Expense = {
  id: string;
  description: string;
  merchant?: string;
  category: string;
  receiptMeta?: { ocrConfidence: number };
  amount: number;
  currency: string;
  method: SplitMethod;
  paidBy: string;
  createdBy: string;
  splits: { userId: string; amount: number; value: number }[];
  date: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpensePage = {
  expenses: Expense[];
  people: Record<string, PublicUser>;
  nextCursor?: string;
};

export type ExpenseDetail = { expense: Expense; people: Record<string, PublicUser> };

export type FriendBalance = {
  friend: PublicUser;
  currency: string;
  /** > 0: they owe me · < 0: I owe them (minor units) */
  amount: number;
  /** Their UPI ID. Only sent when I owe them and they have added one. */
  friendUpiId?: string;
};

export type BalanceTotals = { currency: string; owed: number; owe: number; net: number };
export type BalanceSummary = { balances: FriendBalance[]; totals: BalanceTotals[] };

export type SettlementInput = {
  withUserId: string;
  direction: "paid" | "received";
  amount: number;
  currency: string;
  note?: string;
  date?: string; // ISO; defaults to now on the server
  /** For a payment I made: wait for the other person to confirm before the balance moves. */
  needsConfirmation?: boolean;
};

export type Settlement = {
  id: string;
  from: string;
  to: string;
  amount: number;
  currency: string;
  note?: string;
  date: string;
  createdAt: string;
  /** Only confirmed payments count in balances. */
  status: "confirmed" | "pending" | "declined" | "cancelled";
  /** Who recorded it; for a pending payment this is the person who paid. */
  createdBy: string;
};

export type SettlementPage = { settlements: Settlement[]; people: Record<string, PublicUser> };

/** A fresh key per user intent: retries of the same submit reuse it, so they can't double-book. */
export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const idem = (key?: string) => (key ? { "Idempotency-Key": key } : undefined);

export const expensesApi = {
  list: (opts: { friend?: string; cursor?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.friend) q.set("friend", opts.friend);
    if (opts.cursor) q.set("cursor", opts.cursor);
    if (opts.limit) q.set("limit", String(opts.limit));
    const qs = q.toString();
    return request<ExpensePage>(`/api/expenses${qs ? `?${qs}` : ""}`);
  },
  create: (input: ExpenseInput, key?: string) =>
    request<ExpenseDetail>("/api/expenses", { method: "POST", body: JSON.stringify(input), headers: idem(key) }),
  update: (id: string, input: ExpenseInput) =>
    request<ExpenseDetail>(`/api/expenses/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/api/expenses/${id}`, { method: "DELETE" }),
};

export const balancesApi = {
  summary: () => request<BalanceSummary>("/api/balances"),
};

export const settlementsApi = {
  /** receiver: the money arrived, so the balance moves */
  confirm: (id: string) => request<Settlement>(`/api/settlements/${id}/confirm`, { method: "POST" }),
  /** receiver: the money never arrived */
  decline: (id: string) => request<Settlement>(`/api/settlements/${id}/decline`, { method: "POST" }),
  /** payer: withdraw a payment that is still pending */
  cancel: (id: string) => request<Settlement>(`/api/settlements/${id}/cancel`, { method: "POST" }),
  list: (friend?: string) =>
    request<SettlementPage>(`/api/settlements${friend ? `?friend=${encodeURIComponent(friend)}` : ""}`),
  create: (input: SettlementInput, key?: string) =>
    request<Settlement>("/api/settlements", { method: "POST", body: JSON.stringify(input), headers: idem(key) }),
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

// ---------- notifications ----------

export type AppNotification = {
  id: string;
  type: string;
  message: string;
  /** App path to open when the notification is tapped, e.g. /dashboard/settle */
  link?: string;
  read: boolean;
  createdAt: string;
};

export const notificationsApi = {
  list: () => request<{ notifications: AppNotification[]; unread: number }>("/api/notifications"),
  unread: () => request<{ unread: number }>("/api/notifications/unread"),
  markRead: (id: string) => request<void>(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => request<void>("/api/notifications", { method: "PATCH" }),
  /** The groups of notification I have switched off. */
  preferences: () => request<{ muted: string[] }>("/api/notifications/preferences"),
  setPreferences: (muted: string[]) =>
    request<{ muted: string[] }>("/api/notifications/preferences", { method: "PUT", body: JSON.stringify({ muted }) }),
};

export const pushApi = {
  key: () => request<{ enabled: boolean; publicKey: string }>("/api/push/key"),
  subscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    request<void>("/api/push/subscribe", { method: "POST", body: JSON.stringify(sub) }),
  unsubscribe: (endpoint: string) =>
    request<void>("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) }),
};
