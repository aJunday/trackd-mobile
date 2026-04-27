/**
 * authFetch — centralized fetch wrapper with 401 handling.
 *
 * - Auto-attaches `Authorization: Bearer ${token}` if a token is set
 * - On 401 response, fires a global onUnauthorized callback (clears storage + redirects to login)
 * - Used by all auth-required API calls across the app
 *
 * Usage:
 *   import { authFetch, setAuthHandlers } from '@/src/utils/authFetch';
 *
 *   // At app boot (in _layout.tsx):
 *   setAuthHandlers({
 *     getToken: () => sessionToken,
 *     onUnauthorized: () => { ... clear + redirect ... },
 *   });
 *
 *   // Anywhere:
 *   const r = await authFetch('/api/nutrition/dashboard');
 */

type Handlers = {
  getToken: () => string | null;
  onUnauthorized: () => void;
};

let handlers: Handlers = {
  getToken: () => null,
  onUnauthorized: () => {},
};

let lastUnauthorizedAt = 0;

export const setAuthHandlers = (h: Handlers) => {
  handlers = h;
};

export const authFetch = async (
  input: string,
  init: RequestInit = {}
): Promise<Response> => {
  const token = handlers.getToken();
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) || {}),
  };
  // Don't set content-type for GET/DELETE without a body
  if (init.body && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'omit',
  });

  if (response.status === 401) {
    // Throttle to one logout per 1500ms in case multiple requests fail concurrently
    const now = Date.now();
    if (now - lastUnauthorizedAt > 1500) {
      lastUnauthorizedAt = now;
      handlers.onUnauthorized();
    }
  }
  return response;
};

// Convenience: parse JSON or throw with status info
export const authFetchJson = async <T = any>(
  input: string,
  init: RequestInit = {}
): Promise<T> => {
  const r = await authFetch(input, init);
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`HTTP ${r.status}: ${txt.slice(0, 200) || 'no body'}`);
  }
  return r.json();
};
