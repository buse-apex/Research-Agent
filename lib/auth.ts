import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

// Google Sign-In with an email allowlist (same pattern as the Apex Proof Finder).
// Franchisees sign in with their own Google accounts. Access is granted when
// the email is in ALLOWED_EMAILS (comma-separated) OR ends with ALLOWED_DOMAIN.
// At least one of the two must be set.

function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  const list = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const domain = (process.env.ALLOWED_DOMAIN || "").trim().toLowerCase();
  if (list.includes(e)) return true;
  if (domain && e.endsWith("@" + domain)) return true;
  return false;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // If neither allowlist variable is set, deny everyone (fail closed).
      if (!process.env.ALLOWED_EMAILS && !process.env.ALLOWED_DOMAIN) return false;
      return isAllowed(user.email);
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days, matching the Proof Finder
  },
};

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase());
  return admins.includes(email.toLowerCase());
}

// Kept for call sites that pass the whole session.
export function isAdminSession(session: any): boolean {
  return isAdmin(session?.user?.email);
}
