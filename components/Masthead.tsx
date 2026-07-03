"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Masthead({ adminEmails }: { adminEmails?: string[] }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const email = session?.user?.email?.toLowerCase() || "";
  const isAdminUser = adminEmails ? adminEmails.includes(email) : false;

  return (
    <header className="masthead">
      <div className="masthead-left">
        <Link href="/" className="brand">
          Apex <span className="accent">Research Agent</span>
        </Link>
        <div className="vol">Franchisee Tools</div>
      </div>
      <div className="nav-links">
        <Link href="/" className={`nav-link ${pathname === "/" ? "active" : ""}`}>
          Research
        </Link>
        <Link
          href="/history"
          className={`nav-link ${pathname === "/history" ? "active" : ""}`}
        >
          History
        </Link>
        {isAdminUser && (
          <Link
            href="/admin"
            className={`nav-link ${pathname === "/admin" ? "active" : ""}`}
          >
            Admin
          </Link>
        )}
        {session?.user && (
          <>
            <span className="user-chip">{session.user.name || session.user.email}</span>
            <button className="signout-btn" onClick={() => signOut({ callbackUrl: "/signin" })}>
              Sign out
            </button>
          </>
        )}
      </div>
    </header>
  );
}
