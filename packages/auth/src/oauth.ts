/**
 * @repo/auth — Google OAuth 2.0 helper
 *
 * Flow:
 *  1. App redirects user to the URL from `getGoogleAuthUrl()`.
 *  2. Google redirects back to your callback with ?code=xxx&state=yyy.
 *  3. Call `exchangeGoogleCode(code)` to get the user's profile.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set for OAuth."
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/auth/oauth/callback/google`,
  };
}

export interface GoogleUserInfo {
  sub: string;        // Google's user ID
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

/**
 * Generate the Google OAuth consent screen URL.
 * `state` is a random nonce you store in a cookie to prevent CSRF.
 */
export function getGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    state,
    prompt: "select_account",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange the OAuth authorization code for user info.
 * Returns the Google user profile, or throws on error.
 */
export async function exchangeGoogleCode(
  code: string
): Promise<GoogleUserInfo> {
  const { clientId, clientSecret, redirectUri } = getConfig();

  // Step 1: Exchange code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Step 2: Fetch user profile
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) {
    throw new Error("Failed to fetch Google user profile.");
  }

  return userRes.json() as Promise<GoogleUserInfo>;
}
