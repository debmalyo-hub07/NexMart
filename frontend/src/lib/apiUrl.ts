/** Accept either the API origin or its versioned base, without double prefixes. */
export function backendApiBase(configured = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'): string {
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Configure a valid HTTP backend URL');
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith('/api/v1') ? path : `${path}/api/v1`;
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function safeReturnPath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\u0000-\u001f]/.test(decoded)) return fallback;
    const url = new URL(value, 'https://nexmart.invalid');
    if (url.origin !== 'https://nexmart.invalid' || /\/(login|register|verify-otp)(\/|$)/.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
