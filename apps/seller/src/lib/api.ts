// Seller app talks to the same server routes as the web dashboard.
// Base URL: your deployed storefront (or local dev server).
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function apiCall<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(global.accessToken ? { Authorization: `Bearer ${global.accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json?.error?.code ?? 'unknown', json?.error?.message ?? `Request failed (${res.status})`);
  }
  return json as T;
}

declare global {
  // Set by the auth store after sign-in; routes that need it validate the JWT server-side.
  var accessToken: string | undefined;
}
