// Google Drive sync — 100% client-side, no backend.
//
// Auth uses Google Identity Services (GIS) token flow loaded from Google's CDN.
// Storage uses the Drive "appDataFolder": a hidden, per-app folder the user
// cannot browse and that requires only the narrow `drive.appdata` scope, so the
// app can never read the rest of the user's Drive.
//
// The user must supply their OWN OAuth Web client id (from their Google Cloud
// project) in Settings. Nothing here is pre-provisioned — that keeps the app
// free, open, and account-agnostic.

import type { NutritionDoc } from '../data/types';
import { serializeDoc } from './storage';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'nutricao.json';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void;
            error_callback?: (err: { type?: string }) => void;
          }) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let gisReady: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Não foi possível carregar o Google Identity Services. Verifique a conexão.'));
    document.head.appendChild(s);
  });
  return gisReady;
}

let accessToken: string | null = null;
let tokenExpiresAt = 0;

export function isSignedIn(): boolean {
  return !!accessToken && Date.now() < tokenExpiresAt;
}

/** Restore a previously cached token (from storage) so reloads don't re-prompt. */
export function restoreToken(token: string | undefined, expiresAt: number | undefined): void {
  if (token && expiresAt && Date.now() < expiresAt) {
    accessToken = token;
    tokenExpiresAt = expiresAt;
  }
}

/** Current token + expiry, for the caller to persist across reloads. */
export function tokenState(): { token: string | null; expiresAt: number } {
  return { token: accessToken, expiresAt: tokenExpiresAt };
}

// Request a token via GIS. `prompt: 'none'` is silent (no UI) — fails via
// error_callback if Google needs interaction. Resolves true on success.
function requestToken(clientId: string, prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    void loadGis().then(() => {
      const oauth2 = window.google!.accounts.oauth2;
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp) => {
          if (resp.error || !resp.access_token) {
            resolve(false);
            return;
          }
          accessToken = resp.access_token;
          // Honor the server-provided lifetime; refresh ~5 min early.
          const ttl = (resp.expires_in ?? 3600) * 1000 - 5 * 60 * 1000;
          tokenExpiresAt = Date.now() + Math.max(ttl, 60 * 1000);
          resolve(true);
        },
        error_callback: () => resolve(false),
      });
      client.requestAccessToken({ prompt });
    }).catch(() => resolve(false));
  });
}

/**
 * Interactively obtain an access token. Opens Google's popup. Must be called
 * from a user gesture (e.g. a button click) or the popup may be blocked.
 */
export async function signIn(clientId: string): Promise<void> {
  if (!clientId) throw new Error('Configure o Client ID do Google em Configurações antes de conectar.');
  const ok = await requestToken(clientId, '');
  if (!ok) throw new Error('Falha ao autenticar no Google. Tente novamente.');
}

/** Try to refresh the token without any popup. Returns false if interaction is needed. */
export async function trySilentSignIn(clientId: string): Promise<boolean> {
  if (!clientId) return false;
  return requestToken(clientId, 'none');
}

export function signOut(): void {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken);
  }
  accessToken = null;
  tokenExpiresAt = 0;
}

function authHeaders(): HeadersInit {
  if (!isSignedIn()) throw new Error('Sessão do Google expirada. Conecte novamente.');
  return { Authorization: `Bearer ${accessToken}` };
}

/** Find the existing app file id in appDataFolder, or null. */
async function findFileId(): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Erro ao consultar o Drive (${res.status}).`);
  const data = (await res.json()) as { files?: { id: string }[] };
  return data.files?.[0]?.id ?? null;
}

export interface SyncResult {
  fileId: string;
  syncedAt: string;
}

/** Upload the document to Drive (create or overwrite). Returns the file id. */
export async function uploadDoc(doc: NutritionDoc, knownFileId?: string): Promise<SyncResult> {
  const body = serializeDoc(doc);
  let fileId = knownFileId ?? (await findFileId());

  if (fileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      { method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body },
    );
    if (!res.ok) throw new Error(`Falha ao salvar no Drive (${res.status}).`);
  } else {
    // Multipart: metadata (place in appDataFolder) + media in one request.
    const boundary = 'app-nutrition-' + Math.abs(hash(body)).toString(36);
    const metadata = { name: FILE_NAME, parents: ['appDataFolder'] };
    const multipart =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      `${body}\r\n--${boundary}--`;
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipart,
      },
    );
    if (!res.ok) throw new Error(`Falha ao criar arquivo no Drive (${res.status}).`);
    fileId = ((await res.json()) as { id: string }).id;
  }

  return { fileId, syncedAt: new Date().toISOString() };
}

/** Download the document from Drive, or null if no file exists yet. */
export async function downloadDoc(): Promise<{ text: string; fileId: string } | null> {
  const fileId = await findFileId();
  if (!fileId) return null;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`Falha ao baixar do Drive (${res.status}).`);
  return { text: await res.text(), fileId };
}

// Deterministic boundary suffix; avoids Math.random while staying collision-safe enough.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
