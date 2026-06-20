// Local persistence via IndexedDB (through `idb`).
//
// The whole app document lives under a single key. Settings (Drive client id,
// sync metadata) live under another. IndexedDB is used over localStorage so the
// document can grow (many logs) without hitting the ~5MB string cap.

import { openDB, type IDBPDatabase } from 'idb';
import type { NutritionDoc } from '../data/types';
import type { WorkoutEntry } from '../workout/types';
import { emptyDoc } from '../data/sample';

const DB_NAME = 'app-nutrition';
const DB_VERSION = 1;
const STORE = 'kv';
const DOC_KEY = 'doc';
const SETTINGS_KEY = 'settings';
const WORKOUTS_KEY = 'workouts';

export interface Settings {
  /** Google OAuth Web client id supplied by the user (their Cloud project). */
  driveClientId?: string;
  /** Drive file id once the doc has been synced at least once. */
  driveFileId?: string;
  /** ISO timestamp of the last successful Drive sync. */
  lastSyncedAt?: string;
  /** Whether to auto-sync to Drive after each local change. */
  autoSync?: boolean;
  /** Whether the user has connected Drive at least once (drives silent re-auth on boot). */
  driveConnected?: boolean;
  /** Cached OAuth access token, reused across reloads until it expires. */
  driveToken?: string;
  /** Epoch ms when the cached token expires. */
  driveTokenExp?: number;
  /** OpenRouter API key obtained via the user's own OAuth (billed to them). */
  openrouterKey?: string;
  /** OpenRouter model id for the coach (defaults to a cheap one). */
  openrouterModel?: string;
}

let dbp: Promise<IDBPDatabase> | null = null;
function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      },
    });
  }
  return dbp;
}

export async function loadDoc(): Promise<NutritionDoc> {
  const d = await db();
  const doc = (await d.get(STORE, DOC_KEY)) as NutritionDoc | undefined;
  return doc ?? emptyDoc();
}

export async function saveDoc(doc: NutritionDoc): Promise<void> {
  const d = await db();
  await d.put(STORE, doc, DOC_KEY);
}

export async function loadSettings(): Promise<Settings> {
  const d = await db();
  return ((await d.get(STORE, SETTINGS_KEY)) as Settings | undefined) ?? {};
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const d = await db();
  const next = { ...(await loadSettings()), ...patch };
  await d.put(STORE, next, SETTINGS_KEY);
  return next;
}

/** Workout entries live under their own key — a list, newest first. */
export async function loadWorkouts(): Promise<WorkoutEntry[]> {
  const d = await db();
  return ((await d.get(STORE, WORKOUTS_KEY)) as WorkoutEntry[] | undefined) ?? [];
}

export async function saveWorkouts(entries: WorkoutEntry[]): Promise<void> {
  const d = await db();
  await d.put(STORE, entries, WORKOUTS_KEY);
}

/** Serialize the document for export/Drive, pretty-printed and stable. */
export function serializeDoc(doc: NutritionDoc): string {
  return JSON.stringify(doc, null, 2);
}

/** Trigger a browser download of the document as a .json file. */
export function downloadDoc(doc: NutritionDoc, filename = 'nutricao.json'): void {
  const blob = new Blob([serializeDoc(doc)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
