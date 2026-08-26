"use client";

import { useSearchParams } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_missing: "Invalid authentication state. Please try again.",
  oauth_invalid_state: "Security check failed. Please try again.",
  oauth_email_unverified: "Your Google account email is not verified. Please verify it and try again.",
  oauth_exchange_failed: "Failed to authenticate with Google. Please try again.",
  oauth_role_conflict: "This Google account is already registered as a different role.",
  oauth_user_error: "Failed to create or link your account. Please try again.",
};

export function OAuthErrorAlert() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const existingRole = searchParams.get("existing_role");

  if (!errorParam) return null;

  let message = ERROR_MESSAGES[errorParam] || "An unexpected authentication error occurred.";

  if (errorParam === "oauth_role_conflict" && existingRole) {
    message = `This Google account is already registered as a ${existingRole}. Please sign in to the ${existingRole} portal.`;
  }

  return (
    <div className="mb-6 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
      {message}
    </div>
  );
}
