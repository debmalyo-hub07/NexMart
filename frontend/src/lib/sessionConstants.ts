/**
 * The backend sets its role cookies (nexmart_*_session) with maxAge 7 days
 * (roleAuth.controller.ts). The NextAuth session JWT must not outlive them,
 * or middleware admits users whose every API call 401s (the "dead zone").
 * Single source of truth for both sides of that contract.
 */
export const BACKEND_SESSION_MAX_AGE_SECONDS = 604800; // 7 days
