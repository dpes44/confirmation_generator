/**
 * Constants shared between the Edge middleware and the Node runtime.
 *
 * Kept free of any `node:` import so the middleware bundle stays Edge-safe.
 */
export const COOKIE_NAME = 'cg_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
