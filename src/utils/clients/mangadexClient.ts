import { loginPersonal, logout } from 'mangadex-full-api';

/**
 * The library refreshes its access token on every request once it expires (15 min),
 * but if MangaDex rejects the refresh token (session timed out or was revoked) it
 * throws an AuthError forever after and never logs in again. The bot then fails
 * every comic request until it is restarted.
 */
export function loginMangadex() {
  return loginPersonal({
    username: process.env.mangadexUser,
    password: process.env.mangadexPassword,
    clientId: process.env.mangadexClientId,
    clientSecret: process.env.mangadexSecret,
  });
}

const isAuthError = (error: unknown) => error instanceof Error && error.name === 'AuthError';

/**
 * Runs a MangaDex operation, and on a stale session logs in again and retries once.
 * If the fresh login also fails, we drop auth entirely: everything the bot reads is public.
 */
export async function withMangadexSession<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isAuthError(error)) throw error;

    try {
      await loginMangadex();
    } catch (loginError) {
      console.warn('MangaDex re-login failed, continuing without auth:', loginError);
      logout();
    }
    return operation();
  }
}
