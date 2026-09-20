/**
 * Language Metrics Mobile — Typed API client for `apps/student-web` `/api/v1/*`.
 *
 * - Every request/response is validated against `@repo/api-contracts`.
 * - Bearer access token is injected from memory.
 * - A 401 triggers ONE refresh-token rotation shared by all in-flight requests.
 *   (The server rotates the refresh session atomically, so two parallel refreshes
 *   would make the second one look like token reuse and revoke the session.)
 * - If the refresh itself is rejected, tokens are wiped and `onSessionExpired`
 *   listeners fire so the UI returns to the login screen.
 */

import {
  BookingDetailSchema,
  BookingListResponseSchema,
  CoinBalanceResponseSchema,
  CreateBookingRequestSchema,
  LiveKitTokenResponseSchema,
  LiveMeterSchema,
  MobileLoginRequestSchema,
  MobileTokenResponseSchema,
  RefreshTokenRequestSchema,
  StudentMeResponseSchema,
  TeacherSearchResponseSchema,
  type BookingDetail,
  type BookingListResponse,
  type CoinBalanceResponse,
  type CreateBookingRequest,
  type LiveKitTokenResponse,
  type LiveMeter,
  type MobileLoginRequest,
  type MobileTokenResponse,
  type StudentMeResponse,
  type TeacherSearchQuery,
  type TeacherSearchResponse,
} from "@repo/api-contracts";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../config/env";
import { TokenStorage } from "./storage";

export type ClassesFilter = "upcoming" | "past" | "cancelled";

export type ApiErrorKind = "http" | "network" | "timeout" | "invalid-response";

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetworkError(): boolean {
    return this.kind === "network" || this.kind === "timeout";
  }
}

const NETWORK_MESSAGE =
  "Can't reach Language Metrics right now. Check your internet connection and try again.";

/** Pulls `{ message }` out of the JSON error bodies returned by student-web. */
function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function fallbackMessageForStatus(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have access to this.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 429) return "Too many attempts. Please wait a minute and try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again shortly.";
  return "The request could not be completed.";
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError("timeout", 0, NETWORK_MESSAGE, error);
    }
    throw new ApiError("network", 0, NETWORK_MESSAGE, error);
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ── Session-expiry listeners ─────────────────────────────────────────────
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

function notifySessionExpired() {
  for (const listener of sessionExpiredListeners) listener();
}

// ── Refresh-token rotation (single flight) ───────────────────────────────
type RefreshOutcome = "refreshed" | "rejected" | "unavailable";
let refreshInFlight: Promise<RefreshOutcome> | null = null;

async function rotateTokens(): Promise<RefreshOutcome> {
  const refreshToken = await TokenStorage.getRefreshToken();
  if (!refreshToken) return "rejected";

  const parsedRequest = RefreshTokenRequestSchema.safeParse({ refreshToken });
  if (!parsedRequest.success) {
    await TokenStorage.clearAllTokens();
    return "rejected";
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}/auth/mobile/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(parsedRequest.data),
    });
  } catch {
    // Offline / server unreachable: keep the refresh token so we can retry later.
    return "unavailable";
  }

  if (response.status === 401 || response.status === 403) {
    await TokenStorage.clearAllTokens();
    return "rejected";
  }
  if (!response.ok) {
    return "unavailable";
  }

  const parsed = MobileTokenResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) {
    return "unavailable";
  }

  TokenStorage.setAccessToken(parsed.data.accessToken);
  await TokenStorage.setRefreshToken(parsed.data.refreshToken);
  return "refreshed";
}

function refreshTokens(): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = rotateTokens().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ── Core request ─────────────────────────────────────────────────────────
interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  /** Attach the Bearer token and retry once after a refresh on 401. */
  auth?: boolean;
}

async function request(endpoint: string, options: RequestOptions = {}, isRetry = false): Promise<unknown> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const accessToken = TokenStorage.getAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && auth && !isRetry) {
    const outcome = await refreshTokens();
    if (outcome === "refreshed") {
      return request(endpoint, options, true);
    }
    if (outcome === "rejected") {
      notifySessionExpired();
    } else {
      throw new ApiError("network", 0, NETWORK_MESSAGE);
    }
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw new ApiError(
      "http",
      response.status,
      messageFromBody(payload, fallbackMessageForStatus(response.status)),
      payload
    );
  }

  return payload;
}

function parseResponse<T>(schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: unknown } }, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiError(
      "invalid-response",
      0,
      "We received an unexpected response from the server. Please update the app or try again.",
      result.error
    );
  }
  return result.data;
}

// ── Public API ───────────────────────────────────────────────────────────
export const MobileApiClient = {
  onSessionExpired(listener: SessionExpiredListener): () => void {
    sessionExpiredListeners.add(listener);
    return () => {
      sessionExpiredListeners.delete(listener);
    };
  },

  /** POST /auth/mobile/login — student email + password → Bearer token pair. */
  async login(credentials: MobileLoginRequest): Promise<MobileTokenResponse> {
    const payload = MobileLoginRequestSchema.parse(credentials);
    const data = parseResponse(
      MobileTokenResponseSchema,
      await request("/auth/mobile/login", { method: "POST", body: payload, auth: false })
    );
    TokenStorage.setAccessToken(data.accessToken);
    await TokenStorage.setRefreshToken(data.refreshToken);
    return data;
  },

  /**
   * Restores a session from the refresh token in the secure enclave.
   * - "restored": fresh tokens are in memory
   * - "signed-out": there is no valid session
   * - "offline": a session may exist but the server can't be reached
   */
  async restoreSession(): Promise<"restored" | "signed-out" | "offline"> {
    const refreshToken = await TokenStorage.getRefreshToken();
    if (!refreshToken) return "signed-out";
    const outcome = await refreshTokens();
    if (outcome === "refreshed") return "restored";
    if (outcome === "rejected") return "signed-out";
    return "offline";
  },

  /** POST /auth/mobile/logout — revokes the refresh session, always wipes local tokens. */
  async logout(): Promise<void> {
    const refreshToken = await TokenStorage.getRefreshToken();
    try {
      await request("/auth/mobile/logout", {
        method: "POST",
        body: refreshToken ? { refreshToken } : {},
        auth: false,
      });
    } catch {
      // Server-side revocation is best-effort; the device session ends regardless.
    } finally {
      await TokenStorage.clearAllTokens();
    }
  },

  /** GET /me — profile + live coin balance. */
  async getMe(): Promise<StudentMeResponse> {
    return parseResponse(StudentMeResponseSchema, await request("/me"));
  },

  /** GET /teachers — approved teachers with filters and pagination. */
  async searchTeachers(query: Partial<TeacherSearchQuery> = {}): Promise<TeacherSearchResponse> {
    const params = new URLSearchParams();
    if (query.language) params.set("language", query.language);
    if (query.search) params.set("search", query.search);
    if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
    if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
    if (query.page) params.set("page", String(query.page));
    if (query.limit) params.set("limit", String(query.limit));
    const qs = params.toString();
    return parseResponse(TeacherSearchResponseSchema, await request(`/teachers${qs ? `?${qs}` : ""}`));
  },

  /** GET /wallet/balance */
  async getCoinBalance(): Promise<CoinBalanceResponse> {
    return parseResponse(CoinBalanceResponseSchema, await request("/wallet/balance"));
  },

  /** POST /bookings — books a 1-on-1 lesson and deducts coins atomically. */
  async createBooking(booking: CreateBookingRequest): Promise<BookingDetail> {
    const payload = CreateBookingRequestSchema.parse(booking);
    return parseResponse(BookingDetailSchema, await request("/bookings", { method: "POST", body: payload }));
  },

  /** GET /classes?filter= */
  async getClasses(filter: ClassesFilter): Promise<BookingListResponse> {
    return parseResponse(BookingListResponseSchema, await request(`/classes?filter=${filter}`));
  },

  /**
   * POST /classes/:sessionId/token — room-scoped LiveKit access token.
   *
   * The server resolves the caller's role from the booking, enforces the join
   * window and applies the budget gate, so the profile that comes back may be
   * lower than the one requested. Pass it straight to <LiveKitRoom>.
   */
  async getLiveKitToken(
    classSessionId: string,
    profile?: "audio-only" | "low" | "standard" | "high"
  ): Promise<LiveKitTokenResponse> {
    return parseResponse(
      LiveKitTokenResponseSchema,
  LiveMeterSchema,
      await request(`/classes/${encodeURIComponent(classSessionId)}/token`, {
        method: "POST",
        body: profile ? { profile } : {},
      })
    );
  },

  /**
   * GET /classes/:sessionId/meter — what the class has cost so far.
   *
   * Computed server-side from the same presence intervals that settle the
   * class, so the number shown on screen is the number that gets charged.
   */
  async getLiveMeter(classSessionId: string): Promise<LiveMeter> {
    return parseResponse(
      LiveMeterSchema,
      await request(`/classes/${encodeURIComponent(classSessionId)}/meter`)
    );
  },
};
