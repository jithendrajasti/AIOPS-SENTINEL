import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || "http://backend:4000";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          if (!res.ok) return null;
          const { user, token } = await res.json() as {
            user: { id: string; email: string; name: string; role: string; platformId: string };
            token: string;
          };
          return { ...user, accessToken: token };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // double-cast needed because JWT re-exports from @auth/core/jwt
        // and module augmentation via "next-auth/jwt" doesn't merge there
        const u = user as unknown as { id: string; role: string; platformId: string; accessToken: string };
        (token as Record<string, unknown>).id = u.id;
        (token as Record<string, unknown>).role = u.role;
        (token as Record<string, unknown>).platformId = u.platformId;
        (token as Record<string, unknown>).accessToken = u.accessToken;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as Record<string, unknown>;
      session.user.id = t.id as string;
      session.user.role = t.role as string;
      session.user.platformId = t.platformId as string;
      session.accessToken = t.accessToken as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  trustHost: true,
});
