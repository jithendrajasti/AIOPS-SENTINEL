"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  platformId: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const user: User | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        role: session.user.role,
        platformId: session.user.platformId,
      }
    : null;

  const token = session?.accessToken ?? null;
  const loading = status === "loading";

  const login = async (email: string, password: string) => {
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) throw new Error("Invalid email or password");
    router.replace("/dashboard");
  };

  const logout = () => {
    signOut({ callbackUrl: "/login" });
  };

  const refreshUser = async () => {
    await update();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
