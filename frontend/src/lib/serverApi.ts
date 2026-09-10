/**
 * Server-side fetch wrapper for backend API calls from Next.js server code
 * (NextAuth authorize/signIn callbacks, route handlers, server actions).
 *
 * The backend rejects mutating requests whose Origin/Referer does not match
 * CORS_ORIGIN (app.ts CSRF gate). Node fetch does not send Origin, so every
 * server-side POST must stamp it explicitly — derived from the incoming
 * request host, which by definition matches the deployment the user is on.
 *
 * Env (AUTH_URL / NEXTAUTH_URL / APP_URL / NEXT_PUBLIC_APP_URL) is only a
 * fallback; deriving from the live request avoids the env-drift class where
 * a configured URL diverges from the backend's CORS_ORIGIN.
 */
import { headers } from 'next/headers';

export interface ServerApiOptions extends RequestInit {
  /** The incoming framework request — used to derive the Origin header. */
  request?: Request;
}

function envFrontendOrigin(): string | null {
  const configured =
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) return null;
  try {
    return new URL(configured).origin;
  } catch {
    return null;
  }
}

function originFromRequest(request?: Request): string | null {
  if (!request) return null;
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

/** Host the current browser request actually hit (NextAuth route handlers). */
async function originFromNextHeaders(): Promise<string | null> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    const proto = h.get('x-forwarded-proto') || (host?.startsWith('localhost') || host?.startsWith('127.') ? 'http' : 'https');
    if (!host) return null;
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}

export function frontendOrigin(request?: Request): string {
  return originFromRequest(request) ?? envFrontendOrigin() ?? 'http://localhost:3000';
}

/** Generate a correlation ID for server-originated API calls. */
function requestId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `nexmart-ssr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function serverApiFetch(
  url: string,
  { request, headers: extraHeaders, ...init }: ServerApiOptions = {},
): Promise<Response> {
  // No explicit request (e.g. NextAuth's signIn callback, which receives
  // none): fall back to the live request headers, then env.
  const origin = originFromRequest(request) ?? (await originFromNextHeaders()) ?? envFrontendOrigin() ?? 'http://localhost:3000';
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'X-Request-Id': requestId(),
      ...(extraHeaders as Record<string, string> | undefined),
    },
  });
}
