"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import posthog from "posthog-js";

let posthogStarted = false;

function AnalyticsIdentifier() {
  const { data: session, status } = useSession();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
    if (!key) return; // analytics stays off until the key is set in Vercel

    if (!posthogStarted) {
      posthog.init(key, {
        api_host: host,
        person_profiles: "identified_only",
        capture_pageview: true,
      });
      posthogStarted = true;
    }

    // Attribute activity to the signed-in franchisee (by request: not anonymous).
    if (status === "authenticated" && session?.user?.email) {
      posthog.identify(session.user.email, {
        email: session.user.email,
        name: session.user.name || undefined,
      });
    }
  }, [status, session]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AnalyticsIdentifier />
      {children}
    </SessionProvider>
  );
}

// Small helper so components can capture events without importing posthog directly.
export function track(event: string, props?: Record<string, any>) {
  try {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY && typeof window !== "undefined") {
      posthog.capture(event, props || {});
    }
  } catch {
    /* analytics must never break the app */
  }
}
