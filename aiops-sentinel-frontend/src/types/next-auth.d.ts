import type { DefaultSession } from "@auth/core/types";

declare module "@auth/core/types" {
  interface Session {
    accessToken: string;
    user: {
      id: string;
      role: string;
      platformId: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    platformId: string;
    accessToken: string;
  }
}
