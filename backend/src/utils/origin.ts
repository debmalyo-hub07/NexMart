/**
 * Compare request provenance by parsed origin. String prefix checks are unsafe
 * because `https://shop.example.evil` starts with `https://shop.example`.
 */
export function isAllowedOrigin(value: string | undefined, allowedOrigin: string): boolean {
  if (!value) return false;

  try {
    return new URL(value).origin === new URL(allowedOrigin).origin;
  } catch {
    return false;
  }
}

export function isTrustedRequestOrigin(
  origin: string | undefined,
  referer: string | undefined,
  allowedOrigin: string,
): boolean {
  return isAllowedOrigin(origin, allowedOrigin) || isAllowedOrigin(referer, allowedOrigin);
}
