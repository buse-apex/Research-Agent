"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInContent() {
  const params = useSearchParams();
  const error = params.get("error");

  const errorMessages: Record<string, string> = {
    AccessDenied:
      "This email is not on the Apex access list. Contact the marketing team to be added.",
    Configuration: "Sign-in is misconfigured. Contact the admin.",
    Default: "Sign-in failed. Try again.",
  };

  return (
    <div className="signin-frame">
      <div className="signin-card">
        <div className="signin-logo">APEX LEADERSHIP CO.</div>
        <h1>School Research Agent</h1>
        <p className="signin-deck">
          Sign in with your Google account to research schools and build outreach emails.
        </p>

        {error && (
          <div className="signin-error">
            {errorMessages[error] || errorMessages.Default}
          </div>
        )}

        <button
          className="btn btn-primary signin-btn"
          onClick={() => signIn("google", { callbackUrl: "/" })}
        >
          Continue with Google
        </button>

        <p className="signin-help">
          Access is limited to the Apex franchise network.
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="signin-frame"><div className="signin-card"><p className="signin-deck">Loading…</p></div></div>}>
      <SignInContent />
    </Suspense>
  );
}
