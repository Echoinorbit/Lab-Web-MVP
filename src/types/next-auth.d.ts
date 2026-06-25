import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: "ADMIN" | "MEMBER";
      status: "ACTIVE" | "SUSPENDED" | "GRADUATED";
      mustChangePassword: boolean;
      tokenVersion: number;
      permissions: string[];
      tags: Array<{ name: string; projectId: string | null }>;
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    role: "ADMIN" | "MEMBER";
    status: "ACTIVE" | "SUSPENDED" | "GRADUATED";
    mustChangePassword: boolean;
    tokenVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string;
    role?: "ADMIN" | "MEMBER";
    status?: "ACTIVE" | "SUSPENDED" | "GRADUATED";
    mustChangePassword?: boolean;
    tokenVersion?: number;
  }
}
