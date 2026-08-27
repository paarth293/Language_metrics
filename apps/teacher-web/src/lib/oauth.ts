/**
 * lib/oauth.ts — Google OAuth 2.0 helper
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function getConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const privateKey = process.env.JWT_PRIVATE_KEY;
  const publicKey = process.env.JWT_PUBLIC_KEY;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.");
  }
  if (!privateKey || !publicKey) {
    throw new Error("JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set for token signing.");
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/auth/oauth/callback/google`,
  };
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

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

export async function exchangeGoogleCode(code: string): Promise<GoogleUserInfo> {
  const { clientId, clientSecret, redirectUri } = getConfig();

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

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) throw new Error("Failed to fetch Google user profile.");
  const profile = (await userRes.json()) as GoogleUserInfo;

  // Industry requirement: reject accounts where Google hasn't verified the email
  if (!profile.email_verified) {
    throw new Error("GOOGLE_EMAIL_NOT_VERIFIED");
  }

  return profile;
}
