import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface GoogleIdentity {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

/**
 * Verify a Google ID token server-side (audit 2026-09-07 §3.1).
 *
 * The old flow trusted `{googleId, email, name, picture}` posted straight
 * from the client — anyone who knew a victim's email could forge a login.
 * This function is the ONLY path by which a Google identity enters the
 * system: the token is checked against Google's tokeninfo endpoint, the
 * audience must be OUR OAuth client, and the email must be verified at
 * Google. Fails CLOSED on any error.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Google sign-in failed: missing ID token.');
  }

  let response: Response;
  try {
    response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
  } catch (err) {
    logger.error('Google token verification unreachable:', err instanceof Error ? err.message : err);
    throw new Error('Google sign-in failed: could not reach Google.', { cause: err });
  }

  if (!response.ok) {
    // Google returns 400 for invalid/expired tokens
    throw new Error('Google sign-in failed: invalid or expired token.');
  }

  let payload: {
    aud?: string;
    sub?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
  };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new Error('Google sign-in failed: malformed token response.');
  }

  if (!payload.aud || payload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new Error('Google sign-in failed: token was not issued for this application.');
  }
  if (!payload.sub || !payload.email) {
    throw new Error('Google sign-in failed: token is missing identity claims.');
  }
  // Google returns email_verified as a string "true"/"false"
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  if (!emailVerified) {
    throw new Error('Google sign-in failed: email is not verified at Google.');
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified,
    name: payload.name,
    picture: payload.picture,
  };
}
