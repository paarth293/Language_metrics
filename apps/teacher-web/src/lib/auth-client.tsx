"use client";

/**
 * auth-client.tsx — Cookie-based Auth Context
 *
 * The client NEVER holds the JWT token. All tokens live in httpOnly cookies.
 * The user object is kept in React state (in-memory only).
 *
 * On mount: calls /api/auth/me to hydrate from the server-side cookie.
 * On login: calls /api/auth/login, gets user from JSON response, stores in state.
 * On logout: calls /api/auth/logout (server revokes session + clears cookies).
 * On refresh needed: the middleware and /api/auth/me handle it transparently.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/types";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string, role?: Role) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Hydrate user state from the server cookie on mount
  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as { user: AuthUser | null };
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await refreshUser();
      setIsLoading(false);
    };
    init();
  }, [refreshUser]);

  const login = useCallback(
    async (
      email: string,
      password: string,
      role?: Role
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, role }),
          credentials: "include",
        });

        let data: { user?: AuthUser; message?: string } = {};
        try {
          data = (await res.json()) as { user?: AuthUser; message?: string };
        } catch {
          // Response body wasn't valid JSON
        }

        if (!res.ok) {
          // If the server returned a JSON message, use it
          if (data.message) {
            return { success: false, message: data.message };
          }
          // Provide specific messages for common HTTP status codes
          if (res.status === 503 || res.status === 502) {
            return { success: false, message: "The server is temporarily unavailable. Please try again in a moment." };
          }
          if (res.status === 429) {
            return { success: false, message: "Too many login attempts. Please wait and try again." };
          }
          if (res.status === 500) {
            return { success: false, message: "Something went wrong on our end. Please try again." };
          }
          return { success: false, message: `Login failed (error ${res.status}). Please try again.` };
        }

        if (data.user) {
          setUser(data.user);
          // Redirect based on role
          if (data.user.role === "STUDENT") window.location.href = "http://localhost:3002/login";
          else if (data.user.role === "TEACHER") router.push("/teacher/dashboard");
          else if (data.user.role === "ADMIN") window.location.href = "http://localhost:3001/dashboard";
        }

        return { success: true };
      } catch (err) {
        console.error("Login fetch error:", err);
        return { success: false, message: "Network error. Please check your connection and try again." };
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Best-effort — even if the request fails, clear client state
    }
    setUser(null);
    router.push("/");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
