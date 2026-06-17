// OpenRouter integration — 100% client-side, no backend.
//
// Auth uses OpenRouter's OAuth PKCE flow: the user connects their OWN OpenRouter
// account and the resulting key is scoped to *their* balance, so chat usage is
// billed to them — not to the app owner. PKCE means no client secret is needed,
// which is what makes this safe to run entirely in the browser.
//
// Privacy note: unlike the Drive integration (which only touches a private app
// folder), chat prompts are sent to OpenRouter's servers to reach the model.

const AUTH_URL = 'https://openrouter.ai/auth';
const KEYS_URL = 'https://openrouter.ai/api/v1/auth/keys';
const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const VERIFIER_KEY = 'mealmind.openrouter.verifier';

/** Cheap, capable default. The user can override it in Settings. */
export const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5';

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomVerifier(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return b64url(a);
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

/** Where OpenRouter sends the user back (the app's own URL). */
export function callbackUrl(): string {
  return `${location.origin}${import.meta.env.BASE_URL}`;
}

/** Begin the OAuth flow — redirects the browser to OpenRouter. */
export async function startAuth(): Promise<void> {
  const verifier = randomVerifier();
  localStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = await challengeFor(verifier);
  const u = new URL(AUTH_URL);
  u.searchParams.set('callback_url', callbackUrl());
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  location.href = u.toString();
}

/** The `?code=` OpenRouter appends to the callback, if present. */
export function pendingCode(): string | null {
  return new URLSearchParams(location.search).get('code');
}

/** Strip the `?code=` from the address bar after handling it. */
export function clearCodeFromUrl(): void {
  const url = new URL(location.href);
  url.search = '';
  history.replaceState({}, '', url.toString());
}

/** Exchange the auth code for a user-scoped OpenRouter API key. */
export async function exchangeCode(code: string): Promise<string> {
  const verifier = localStorage.getItem(VERIFIER_KEY) ?? undefined;
  const res = await fetch(KEYS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
  });
  localStorage.removeItem(VERIFIER_KEY);
  if (!res.ok) throw new Error(`Falha ao conectar ao OpenRouter (${res.status}).`);
  const data = (await res.json()) as { key?: string };
  if (!data.key) throw new Error('O OpenRouter não retornou uma chave.');
  return data.key;
}

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Send a chat completion. Billed to the user's OpenRouter balance. */
export async function chat(key: string, model: string, messages: ChatMsg[]): Promise<string> {
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': callbackUrl(),
      'X-Title': 'MealMind',
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Erro no chat (${res.status}). ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}
