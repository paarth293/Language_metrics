import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MobileLoginRequestSchema, type StudentMeResponse } from "@repo/api-contracts";
import { ApiError, MobileApiClient } from "../lib/api-client";
import { TokenStorage } from "../lib/storage";

/**
 * Student authentication lifecycle
 *
 *   launch ──► "restoring" ──(refresh token rotates)──► "signed-in"
 *                  │                                        │
 *                  ├─(no / revoked token)──► "signed-out" ◄─┤ sign out, or refresh rejected
 *                  └─(server unreachable)──► "offline" ─(retry)─┘
 *
 * "signed-in" always means: valid access token in memory AND the /me profile loaded.
 */
export type AuthStatus = "restoring" | "offline" | "signed-out" | "signed-in";

interface SignInResult {
  ok: boolean;
  message?: string;
}

interface AuthContextValue {
  status: AuthStatus;
  student: StudentMeResponse | null;
  coinBalance: number;
  /** Shown on the login screen after an automatic sign-out. */
  notice: string | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  retryRestore: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  setCoinBalance: (balance: number) => void;
  clearNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [student, setStudent] = useState<StudentMeResponse | null>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const statusRef = useRef<AuthStatus>("restoring");

  const applyStatus = useCallback((next: AuthStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const resetToSignedOut = useCallback(
    (message: string | null) => {
      setStudent(null);
      setCoinBalance(0);
      setNotice(message);
      applyStatus("signed-out");
    },
    [applyStatus]
  );

  const loadProfile = useCallback(async () => {
    const me = await MobileApiClient.getMe();
    setStudent(me);
    setCoinBalance(me.coinBalance);
    return me;
  }, []);

  const restore = useCallback(async () => {
    applyStatus("restoring");
    const outcome = await MobileApiClient.restoreSession();
    if (outcome === "signed-out") {
      resetToSignedOut(null);
      return;
    }
    if (outcome === "offline") {
      applyStatus("offline");
      return;
    }
    try {
      await loadProfile();
      setNotice(null);
      applyStatus("signed-in");
    } catch (error) {
      if (error instanceof ApiError && error.isNetworkError) {
        applyStatus("offline");
      } else {
        await MobileApiClient.logout();
        resetToSignedOut("We couldn't load your account. Please sign in again.");
      }
    }
  }, [applyStatus, loadProfile, resetToSignedOut]);

  useEffect(() => {
    void restore();
  }, [restore]);

  // Refresh token rejected mid-session (revoked, expired, password reset elsewhere).
  useEffect(() => {
    return MobileApiClient.onSessionExpired(() => {
      if (statusRef.current === "signed-in") {
        resetToSignedOut("Your session has expired. Please sign in again.");
      }
    });
  }, [resetToSignedOut]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      const credentials = { email: email.trim().toLowerCase(), password };
      const validation = MobileLoginRequestSchema.safeParse(credentials);
      if (!validation.success) {
        return {
          ok: false,
          message: "Enter a valid email address and a password of at least 8 characters.",
        };
      }

      try {
        await MobileApiClient.login(validation.data);
        await loadProfile();
        setNotice(null);
        applyStatus("signed-in");
        return { ok: true };
      } catch (error) {
        // Never leave half a session behind (tokens issued but /me failed).
        if (TokenStorage.getAccessToken()) {
          await MobileApiClient.logout();
        }
        if (error instanceof ApiError) {
          if (error.kind === "http" && error.status === 400) {
            return {
              ok: false,
              message: "Enter a valid email address and a password of at least 8 characters.",
            };
          }
          return { ok: false, message: error.message };
        }
        return { ok: false, message: "Sign in failed. Please try again." };
      }
    },
    [applyStatus, loadProfile]
  );

  const signOut = useCallback(async () => {
    await MobileApiClient.logout();
    resetToSignedOut(null);
  }, [resetToSignedOut]);

  const refreshProfile = useCallback(async () => {
    try {
      await loadProfile();
    } catch {
      // Keep the last known profile; screens surface their own errors.
    }
  }, [loadProfile]);

  const refreshBalance = useCallback(async () => {
    try {
      const { balance } = await MobileApiClient.getCoinBalance();
      setCoinBalance(balance);
    } catch {
      // Keep the last known balance.
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      student,
      coinBalance,
      notice,
      signIn,
      signOut,
      retryRestore: restore,
      refreshProfile,
      refreshBalance,
      setCoinBalance,
      clearNotice: () => setNotice(null),
    }),
    [status, student, coinBalance, notice, signIn, signOut, restore, refreshProfile, refreshBalance]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
