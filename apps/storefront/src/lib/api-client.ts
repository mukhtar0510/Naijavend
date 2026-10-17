// Client-side fetch helper shared by the AI-backed client widgets (weekly
// insight, chat suggestions, translation, recommendations). One error shape,
// matching the server's { error: { code, message } } contract (lib/api.ts).
export async function callApi<T>(url: string, body?: unknown): Promise<T> {
  const init: RequestInit =
    body === undefined
      ? { cache: 'no-store' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        };
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok) throw new Error(data?.error?.message ?? 'Request failed. Try again shortly.');
  return data as T;
}