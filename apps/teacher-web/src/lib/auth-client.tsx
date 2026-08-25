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

        const data = (await res.json()) as { user?: AuthUser; message?: string };

        if (!res.ok) {
          return { success: false, message: data.message ?? "Login failed." };
        }

        if (data.user) {
          setUser(data.user);
          // Redirect based on role
          if (data.user.role === "STUDENT") router.push("/coming-soon");
          else if (data.user.role === "TEACHER") router.push("/coming-soon");
          else if (data.user.role === "ADMIN") router.push("/admin/dashboard");
        }

        return { success: true };
      } catch {
        return { success: false, message: "Network error. Please try again." };
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
