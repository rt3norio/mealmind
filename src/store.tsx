import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { ExtraEntry, MealLog, Measurement, NutritionDoc } from './data/types';
import { emptyDoc } from './data/sample';
import type { WorkoutEntry, WorkoutPlan } from './workout/types';
import { parseWorkouts, parseWorkoutPlan, type WkParseResult } from './workout/io';
import { parseAndValidate, type ValidationResult } from './data/validator';
import { todayKey, withExtra, withMealLog, withWater } from './data/nutrition';
import {
  loadDoc,
  saveDoc,
  loadSettings,
  saveSettings,
  type Settings,
} from './lib/storage';
import * as drive from './lib/drive';
import * as openrouter from './lib/openrouter';
import { BUILTIN_CLIENT_ID } from './lib/config';

/** Outcome of a single combined import (diet and/or workout). */
export interface CombinedImport {
  ok: boolean;
  /** Top-level parse error (bad JSON / unrecognized shape). */
  error?: string;
  /** Validation result of the diet section, if the file carried one. */
  nutrition?: ValidationResult;
  /** Validation result of the workout section, if the file carried one. */
  workouts?: WkParseResult;
}

interface StoreValue {
  doc: NutritionDoc;
  settings: Settings;
  ready: boolean;
  /** Last sync/drive status message for the UI. */
  status: string | null;
  busy: boolean;
  logMeal: (
    mealId: string,
    status: MealLog['status'],
    date?: string,
    portions?: number[],
    option?: number,
  ) => void;
  clearMealLog: (mealId: string, date?: string) => void;
  addMeasurement: (m: Measurement) => void;
  /** Add (or subtract) water in ml to the day's running total. Clamps at 0. */
  addWater: (ml: number, date?: string) => void;
  /** Log an ad-hoc food eaten outside the plan, timestamped now. */
  addExtra: (e: Omit<ExtraEntry, 'id' | 'date' | 'loggedAt'>) => void;
  removeExtra: (id: string) => void;
  importText: (text: string) => ValidationResult;
  replaceDoc: (doc: NutritionDoc) => void;
  /** Replace the workout log (lives inside the same doc → persists & syncs). */
  setWorkouts: (entries: WorkoutEntry[]) => void;
  /** Replace the training program (ABC split). */
  setWorkoutPlan: (plan: WorkoutPlan | undefined) => void;
  /** Single import: one JSON may carry the diet plan and/or the workout log. */
  importCombined: (text: string) => CombinedImport;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  driveConnect: () => Promise<void>;
  driveSyncUp: () => Promise<void>;
  driveSyncDown: () => Promise<void>;
  driveDisconnect: () => void;
  signedIn: boolean;
  /** The client id actually used: per-device override, else the baked-in app id. */
  effectiveClientId: string;
  /** Start the OpenRouter OAuth flow (redirects away). */
  orConnect: () => Promise<void>;
  /** Forget the OpenRouter key. */
  orDisconnect: () => void;
  /** Coach chat history, persisted in memory across tab navigation. */
  coachTurns: CoachTurn[];
  setCoachTurns: Dispatch<SetStateAction<CoachTurn[]>>;
}

/** One message in the coach chat (kept in memory so it survives tab switches). */
export interface CoachTurn {
  role: 'user' | 'assistant';
  content: string;
  actions?: string[];
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<NutritionDoc | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [coachTurns, setCoachTurns] = useState<CoachTurn[]>([]);

  useEffect(() => {
    (async () => {
      const [d, s] = await Promise.all([loadDoc(), loadSettings()]);
      setDoc(d);
      setSettings(s);

      // Finish the OpenRouter OAuth flow if we came back with a code.
      const code = openrouter.pendingCode();
      if (code && !s.openrouterKey) {
        try {
          const key = await openrouter.exchangeCode(code);
          setSettings(await saveSettings({ openrouterKey: key }));
          setStatus('Conectado ao OpenRouter.');
        } catch (e) {
          setStatus(errMsg(e));
        } finally {
          openrouter.clearCodeFromUrl();
        }
      } else if (code) {
        openrouter.clearCodeFromUrl();
      }

      // Restore the Drive session without making the user click again.
      const cid = s.driveClientId || BUILTIN_CLIENT_ID;
      drive.restoreToken(s.driveToken, s.driveTokenExp);
      if (drive.isSignedIn()) {
        setSignedIn(true);
      } else if (s.driveConnected && cid) {
        // Cached token expired — try a silent refresh (no popup).
        const ok = await drive.trySilentSignIn(cid);
        if (ok) {
          setSignedIn(true);
          const { token, expiresAt } = drive.tokenState();
          setSettings(await saveSettings({ driveToken: token ?? undefined, driveTokenExp: expiresAt }));
        }
      }
    })();
  }, []);

  // Auto-dismiss the status toast a few seconds after it appears.
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(t);
  }, [status]);

  // Use the per-device override if set, otherwise the app's baked-in client id.
  const effectiveClientId = settings.driveClientId || BUILTIN_CLIENT_ID;

  // Persist on every doc change once loaded.
  function commit(next: NutritionDoc) {
    setDoc(next);
    void saveDoc(next);
    if (settings.autoSync && effectiveClientId && drive.isSignedIn()) {
      void doSyncUp(next).catch(() => {/* surfaced via status already */});
    }
  }

  function logMeal(
    mealId: string,
    st: MealLog['status'],
    date = todayKey(),
    portions?: number[],
    option?: number,
  ) {
    if (!doc) return;
    commit(withMealLog(doc, mealId, st, date, new Date().toISOString(), portions, option));
  }

  function clearMealLog(mealId: string, date = todayKey()) {
    if (!doc) return;
    const meals = doc.logs.meals.filter((l) => !(l.date === date && l.mealId === mealId));
    commit({ ...doc, logs: { ...doc.logs, meals } });
  }

  function addMeasurement(m: Measurement) {
    if (!doc) return;
    const measurements = doc.logs.measurements.filter((x) => x.date !== m.date);
    measurements.push(m);
    measurements.sort((a, b) => a.date.localeCompare(b.date));
    commit({ ...doc, logs: { ...doc.logs, measurements } });
  }

  function addWater(ml: number, date = todayKey()) {
    if (!doc) return;
    commit(withWater(doc, ml, date));
  }

  function addExtra(e: Omit<ExtraEntry, 'id' | 'date' | 'loggedAt'>) {
    if (!doc) return;
    const now = new Date();
    const entry: ExtraEntry = {
      ...e,
      id: crypto.randomUUID(),
      date: todayKey(now),
      loggedAt: now.toISOString(),
    };
    commit(withExtra(doc, entry));
  }

  function removeExtra(id: string) {
    if (!doc) return;
    const extras = (doc.logs.extras ?? []).filter((e) => e.id !== id);
    commit({ ...doc, logs: { ...doc.logs, extras } });
  }

  function importText(text: string): ValidationResult {
    const { result, doc: parsed } = parseAndValidate(text);
    if (result.valid && parsed && doc) {
      // Keep the user's existing logs unless the imported file carries its own.
      const keepLogs =
        parsed.logs.meals.length === 0 && parsed.logs.measurements.length === 0
          ? doc.logs
          : parsed.logs;
      commit({ ...parsed, logs: keepLogs });
      setStatus('Prescrição importada com sucesso.');
    }
    return result;
  }

  function replaceDoc(next: NutritionDoc) {
    commit(next);
  }

  function setWorkouts(entries: WorkoutEntry[]) {
    commit({ ...(doc ?? emptyDoc()), workouts: entries });
  }

  function setWorkoutPlan(plan: WorkoutPlan | undefined) {
    commit({ ...(doc ?? emptyDoc()), workoutPlan: plan });
  }

  // One JSON may carry the diet (`plan`) and/or the workout log (`workouts`,
  // or a bare array of entries). Each present section is validated; nothing is
  // applied unless every present section is valid (atomic import).
  function importCombined(text: string): CombinedImport {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: `JSON inválido: ${errMsg(e)}` };
    }

    const obj = isObj(raw) ? raw : null;
    const wkArr = Array.isArray(raw)
      ? raw
      : obj && Array.isArray(obj.workouts)
        ? obj.workouts
        : null;
    const hasNutrition = !!obj && (isObj(obj.plan) || Array.isArray(obj.meals));
    const routine = obj && isObj(obj.workoutPlan) ? parseWorkoutPlan(obj.workoutPlan) : null;

    if (!hasNutrition && !wkArr && !routine) {
      return {
        ok: false,
        error: 'Não reconheci dados de plano (refeições), treino ou programa neste arquivo.',
      };
    }

    const base = doc ?? emptyDoc();
    let nutrition: ValidationResult | undefined;
    let nextDoc: NutritionDoc = base;

    if (hasNutrition && obj) {
      const rest: Record<string, unknown> = { ...obj };
      delete rest.workouts;
      delete rest.workoutPlan;
      const { result, doc: parsed } = parseAndValidate(JSON.stringify(rest));
      nutrition = result;
      if (!result.valid || !parsed) return { ok: false, nutrition };
      const keepLogs =
        parsed.logs.meals.length === 0 && parsed.logs.measurements.length === 0
          ? base.logs
          : parsed.logs;
      // Preserve existing workout data unless the file brings its own.
      nextDoc = { ...parsed, logs: keepLogs, workouts: base.workouts, workoutPlan: base.workoutPlan };
    }

    let workouts: WkParseResult | undefined;
    if (wkArr) {
      workouts = parseWorkouts(JSON.stringify(wkArr));
      if (!workouts.valid) return { ok: false, nutrition, workouts };
      nextDoc = {
        ...nextDoc,
        workouts: [...workouts.entries].sort((a, b) => b.date.localeCompare(a.date)),
      };
    }

    if (routine) nextDoc = { ...nextDoc, workoutPlan: routine };

    commit(nextDoc);
    const parts = [
      hasNutrition ? `plano (${nextDoc.plan.meals.length} refeições)` : '',
      wkArr ? `${workouts?.entries.length ?? 0} treinos` : '',
      routine ? `programa (${routine.days.length} dias)` : '',
    ].filter(Boolean);
    setStatus(`Importado: ${parts.join(' + ')}.`);
    return { ok: true, nutrition, workouts };
  }

  async function updateSettings(patch: Partial<Settings>) {
    const next = await saveSettings(patch);
    setSettings(next);
  }

  async function driveConnect() {
    if (!effectiveClientId) {
      setStatus('Sincronização com Drive ainda não configurada nesta instalação.');
      return;
    }
    setBusy(true);
    try {
      await drive.signIn(effectiveClientId);
      setSignedIn(true);
      const { token, expiresAt } = drive.tokenState();
      await updateSettings({ driveConnected: true, driveToken: token ?? undefined, driveTokenExp: expiresAt });
      setStatus('Conectado ao Google Drive.');
    } catch (e) {
      setStatus(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function doSyncUp(d: NutritionDoc) {
    const res = await drive.uploadDoc(d, settings.driveFileId);
    await updateSettings({ driveFileId: res.fileId, lastSyncedAt: res.syncedAt });
    setStatus(`Enviado ao Drive às ${new Date(res.syncedAt).toLocaleTimeString()}.`);
  }

  async function driveSyncUp() {
    if (!doc) return;
    if (!ensureSignedIn()) return;
    setBusy(true);
    try {
      await doSyncUp(doc);
    } catch (e) {
      setStatus(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function driveSyncDown() {
    if (!ensureSignedIn()) return;
    setBusy(true);
    try {
      const got = await drive.downloadDoc();
      if (!got) {
        setStatus('Nenhum arquivo encontrado no Drive ainda.');
        return;
      }
      const { result, doc: parsed } = parseAndValidate(got.text);
      if (!result.valid || !parsed) {
        setStatus('O arquivo no Drive é inválido. Verifique no validador.');
        return;
      }
      commit(parsed);
      await updateSettings({ driveFileId: got.fileId, lastSyncedAt: new Date().toISOString() });
      setStatus('Dados baixados do Drive.');
    } catch (e) {
      setStatus(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  function ensureSignedIn(): boolean {
    if (!drive.isSignedIn()) {
      setStatus('Conecte-se ao Google Drive primeiro.');
      setSignedIn(false);
      return false;
    }
    return true;
  }

  function driveDisconnect() {
    drive.signOut();
    setSignedIn(false);
    void updateSettings({ driveConnected: false, driveToken: undefined, driveTokenExp: undefined });
    setStatus('Desconectado do Google Drive.');
  }

  async function orConnect() {
    try {
      await openrouter.startAuth();
    } catch (e) {
      setStatus(errMsg(e));
    }
  }

  function orDisconnect() {
    void updateSettings({ openrouterKey: undefined });
    setStatus('Desconectado do OpenRouter.');
  }

  if (!doc) {
    return (
      <div className="boot">
        <p>Carregando…</p>
      </div>
    );
  }

  const value: StoreValue = {
    doc,
    settings,
    ready: true,
    status,
    busy,
    signedIn,
    effectiveClientId,
    logMeal,
    clearMealLog,
    addMeasurement,
    addWater,
    addExtra,
    removeExtra,
    importText,
    replaceDoc,
    setWorkouts,
    setWorkoutPlan,
    importCombined,
    updateSettings,
    driveConnect,
    driveSyncUp,
    driveSyncDown,
    driveDisconnect,
    orConnect,
    orDisconnect,
    coachTurns,
    setCoachTurns,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore deve ser usado dentro de <StoreProvider>.');
  return v;
}
