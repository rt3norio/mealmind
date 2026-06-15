import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { MealLog, Measurement, NutritionDoc } from './data/types';
import { parseAndValidate, type ValidationResult } from './data/validator';
import { todayKey } from './data/nutrition';
import {
  loadDoc,
  saveDoc,
  loadSettings,
  saveSettings,
  type Settings,
} from './lib/storage';
import * as drive from './lib/drive';

interface StoreValue {
  doc: NutritionDoc;
  settings: Settings;
  ready: boolean;
  /** Last sync/drive status message for the UI. */
  status: string | null;
  busy: boolean;
  logMeal: (mealId: string, status: MealLog['status'], date?: string) => void;
  clearMealLog: (mealId: string, date?: string) => void;
  addMeasurement: (m: Measurement) => void;
  importText: (text: string) => ValidationResult;
  replaceDoc: (doc: NutritionDoc) => void;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  driveConnect: () => Promise<void>;
  driveSyncUp: () => Promise<void>;
  driveSyncDown: () => Promise<void>;
  driveDisconnect: () => void;
  signedIn: boolean;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [doc, setDoc] = useState<NutritionDoc | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    (async () => {
      const [d, s] = await Promise.all([loadDoc(), loadSettings()]);
      setDoc(d);
      setSettings(s);
    })();
  }, []);

  // Persist on every doc change once loaded.
  function commit(next: NutritionDoc) {
    setDoc(next);
    void saveDoc(next);
    if (settings.autoSync && settings.driveClientId && drive.isSignedIn()) {
      void doSyncUp(next).catch(() => {/* surfaced via status already */});
    }
  }

  function logMeal(mealId: string, st: MealLog['status'], date = todayKey()) {
    if (!doc) return;
    const meals = doc.logs.meals.filter((l) => !(l.date === date && l.mealId === mealId));
    meals.push({ date, mealId, status: st, loggedAt: new Date().toISOString() });
    commit({ ...doc, logs: { ...doc.logs, meals } });
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

  async function updateSettings(patch: Partial<Settings>) {
    const next = await saveSettings(patch);
    setSettings(next);
  }

  async function driveConnect() {
    if (!settings.driveClientId) {
      setStatus('Configure o Client ID do Google primeiro.');
      return;
    }
    setBusy(true);
    try {
      await drive.signIn(settings.driveClientId);
      setSignedIn(true);
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
    setStatus('Desconectado do Google Drive.');
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
    logMeal,
    clearMealLog,
    addMeasurement,
    importText,
    replaceDoc,
    updateSettings,
    driveConnect,
    driveSyncUp,
    driveSyncDown,
    driveDisconnect,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore deve ser usado dentro de <StoreProvider>.');
  return v;
}
