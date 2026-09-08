/**
 * Language Metrics Mobile — Typed API Client
 *
 * Consumes schemas from `@repo/api-contracts` and manages:
 * 1. Automatic Bearer Authorization header injection from in-memory token.
 * 2. Automatic 401 interception & refresh token rotation.
 * 3. Contract validation using Zod schemas.
 */

import {
  MobileLoginRequest,
  MobileLoginRequestSchema,
  MobileTokenResponse,
  MobileTokenResponseSchema,
  RefreshTokenRequestSchema,
  TeacherSearchQuery,
  TeacherSearchResponse,
  TeacherSearchResponseSchema,
  CoinBalanceResponse,
  CoinBalanceResponseSchema,
  CreateBookingRequest,
  CreateBookingRequestSchema,
  BookingDetail,
  BookingDetailSchema,
  LiveKitTokenResponse,
  LiveKitTokenResponseSchema,
} from "@repo/api-contracts";
import { TokenStorage } from "./storage";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://language-metrics-student-web.vercel.app/api/v1";

export class MobileApiError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown) {
    super(message);
    this.name = "MobileApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  retryOnAuth = true
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers = new Headers(options.headers || {});

  // Add in-memory Bearer token if available
  const accessToken = TokenStorage.getAccessToken();
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle token expiration & automatic refresh
  if (response.status === 401 && retryOnAuth) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      return request<T>(endpoint, options, false);
    }
  }

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    throw new MobileApiError(response.status, `API request failed: ${response.statusText}`, errorData);
  }

  return (await response.json()) as T;
}

async function attemptTokenRefresh(): Promise<boolean> {
  const refreshToken = await TokenStorage.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const payload = RefreshTokenRequestSchema.parse({ refreshToken });
    const response = await fetch(`${API_BASE_URL}/auth/mobile/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      await TokenStorage.clearAllTokens();
      return false;
    }

    const data = MobileTokenResponseSchema.parse(await response.json());
    TokenStorage.setAccessToken(data.accessToken);
    await TokenStorage.setRefreshToken(data.refreshToken);
    return true;
  } catch {
    await TokenStorage.clearAllTokens();
    return false;
  }
}

export const MobileApiClient = {
  /**
   * Authenticate mobile student via email & password, returning Bearer token pair.
   */
  async login(credentials: MobileLoginRequest): Promise<MobileTokenResponse> {
    const payload = MobileLoginRequestSchema.parse(credentials);
    const data = await request<MobileTokenResponse>("/auth/mobile/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const parsed = MobileTokenResponseSchema.parse(data);

    TokenStorage.setAccessToken(parsed.accessToken);
    await TokenStorage.setRefreshToken(parsed.refreshToken);
    return parsed;
  },

  /**
   * Search teachers directory with filters.
   */
  async searchTeachers(query: Partial<TeacherSearchQuery> = {}): Promise<TeacherSearchResponse> {
    const params = new URLSearchParams();
    if (query.language) params.set("language", query.language);
    if (query.search) params.set("search", query.search);
    if (query.minPrice) params.set("minPrice", String(query.minPrice));
    if (query.maxPrice) params.set("maxPrice", String(query.maxPrice));
    if (query.page) params.set("page", String(query.page));
    if (query.limit) params.set("limit", String(query.limit));

    const data = await request<TeacherSearchResponse>(`/teachers?${params.toString()}`);
    return TeacherSearchResponseSchema.parse(data);
  },

  /**
   * Get student's current coin balance.
   */
  async getCoinBalance(): Promise<CoinBalanceResponse> {
    const data = await request<CoinBalanceResponse>("/wallet/balance");
    return CoinBalanceResponseSchema.parse(data);
  },

  /**
   * Book a live 1-on-1 session with a teacher.
   */
  async createBooking(booking: CreateBookingRequest): Promise<BookingDetail> {
    const payload = CreateBookingRequestSchema.parse(booking);
    const data = await request<BookingDetail>("/bookings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return BookingDetailSchema.parse(data);
  },

  /**
   * Obtain scoped LiveKit WebRTC access token for classroom entry.
   */
  async getLiveKitToken(sessionId: string, bookingId: string): Promise<LiveKitTokenResponse> {
    const data = await request<LiveKitTokenResponse>(`/classes/${sessionId}/token`, {
      method: "POST",
      body: JSON.stringify({ sessionId, bookingId }),
    });
    return LiveKitTokenResponseSchema.parse(data);
  },

  /**
   * Revoke session and wipe tokens from OS enclave.
   */
  async logout(): Promise<void> {
    const refreshToken = await TokenStorage.getRefreshToken();
    try {
      await request("/auth/mobile/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    } finally {
      await TokenStorage.clearAllTokens();
    }
  },
};
