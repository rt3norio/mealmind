// Import / export for workout data — mirrors the diet's "upload a JSON and
// track" flow, with friendly validation messages. Accepts a bare array of
// entries or an object wrapping them under "workouts"/"entries".

import type { RoutineDay, WorkoutEntry, WorkoutPlan, WorkoutSet, WorkoutUnit } from './types';
import { UNITS } from './helpers';

export interface WkIssue {
  path: string;
  message: string;
  hint?: string;
  severity: 'error' | 'warning';
}

export interface WkParseResult {
  valid: boolean;
  perfect: boolean;
  entries: WorkoutEntry[];
  errors: WkIssue[];
  warnings: WkIssue[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function coerceSet(
  raw: unknown,
  path: string,
  errors: WkIssue[],
  warnings: WkIssue[],
): WorkoutSet | null {
  if (!isObject(raw)) {
    errors.push({ path, message: 'Série inválida (esperado um objeto).', severity: 'error' });
    return null;
  }
  let weight: number | null = null;
  if (raw.weight != null) {
    const w = Number(raw.weight);
    if (!Number.isFinite(w)) {
      errors.push({ path: path + '.weight', message: `Carga não numérica: ${JSON.stringify(raw.weight)}.`, severity: 'error' });
    } else {
      weight = w;
    }
  }
  let unit: WorkoutUnit | null = null;
  if (weight != null) {
    if (typeof raw.unit === 'string' && (UNITS as string[]).includes(raw.unit)) {
      unit = raw.unit as WorkoutUnit;
    } else {
      unit = 'kg';
      warnings.push({
        path: path + '.unit',
        message: `Unidade ausente ou desconhecida — assumindo "kg".`,
        hint: `Use uma de: ${UNITS.join(', ')}.`,
        severity: 'warning',
      });
    }
  }
  let reps: number | null = null;
  if (raw.reps != null) {
    const r = Number(raw.reps);
    if (Number.isFinite(r)) reps = Math.round(r);
  }
  if (weight == null && reps == null) {
    warnings.push({ path, message: 'Série sem carga nem repetição — ignorada.', severity: 'warning' });
    return null;
  }
  return { weight, unit, reps };
}

export function parseWorkouts(text: string): WkParseResult {
  const errors: WkIssue[] = [];
  const warnings: WkIssue[] = [];

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return {
      valid: false,
      perfect: false,
      entries: [],
      errors: [{ path: '(arquivo)', message: 'JSON inválido — não consegui ler o texto.', hint: (e as Error).message, severity: 'error' }],
      warnings: [],
    };
  }

  let arr: unknown[] | null = null;
  if (Array.isArray(data)) arr = data;
  else if (isObject(data) && Array.isArray(data.workouts)) arr = data.workouts;
  else if (isObject(data) && Array.isArray(data.entries)) arr = data.entries;

  if (!arr) {
    return {
      valid: false,
      perfect: false,
      entries: [],
      errors: [{ path: '(raiz)', message: 'Esperava uma lista de treinos.', hint: 'Um array JSON, ou um objeto com "workouts": [ … ].', severity: 'error' }],
      warnings: [],
    };
  }

  const entries: WorkoutEntry[] = [];
  arr.forEach((raw, i) => {
    const p = `treino[${i}]`;
    if (!isObject(raw)) {
      errors.push({ path: p, message: 'Treino inválido (esperado um objeto).', severity: 'error' });
      return;
    }
    const date = String(raw.date ?? '');
    if (!DATE_RE.test(date)) {
      errors.push({ path: p + '.date', message: `Data inválida: ${JSON.stringify(raw.date)}.`, hint: 'Use o formato AAAA-MM-DD.', severity: 'error' });
      return;
    }
    const exercise = String(raw.exercise ?? '').trim();
    if (!exercise) {
      errors.push({ path: p + '.exercise', message: 'Exercício vazio.', severity: 'error' });
      return;
    }
    const rawSets = Array.isArray(raw.sets) ? raw.sets : [];
    const sets = rawSets
      .map((s, j) => coerceSet(s, `${p}.sets[${j}]`, errors, warnings))
      .filter((s): s is WorkoutSet => s != null);
    if (sets.length === 0) {
      warnings.push({ path: p, message: `"${exercise}" (${date}) ficou sem séries válidas.`, severity: 'warning' });
    }
    entries.push({
      id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
      date,
      exercise,
      sets,
      note: String(raw.note ?? ''),
      ...(typeof raw.raw === 'string' && raw.raw ? { raw: raw.raw } : {}),
    });
  });

  return {
    valid: errors.length === 0,
    perfect: errors.length === 0 && warnings.length === 0,
    entries,
    errors,
    warnings,
  };
}

/** Coerce a loose `workoutPlan` object into a WorkoutPlan, or null if it isn't one. */
export function parseWorkoutPlan(raw: unknown): WorkoutPlan | null {
  if (!isObject(raw) || !Array.isArray(raw.days)) return null;
  const rawDays = raw.days as unknown[];
  const days: RoutineDay[] = [];
  rawDays.forEach((d, i) => {
    if (!isObject(d)) return;
    const exercises = Array.isArray(d.exercises)
      ? d.exercises.filter((e): e is string => typeof e === 'string' && e.trim().length > 0).map((e) => e.trim())
      : [];
    days.push({
      id: typeof d.id === 'string' && d.id ? d.id : crypto.randomUUID(),
      label: String(d.label ?? String.fromCharCode(65 + i)),
      name: String(d.name ?? ''),
      exercises,
    });
  });
  return { days };
}

export function serializeWorkouts(entries: WorkoutEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

export function downloadWorkouts(entries: WorkoutEntry[], filename = 'treinos.json'): void {
  const blob = new Blob([serializeWorkouts(entries)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** A tiny sample so users can see the expected shape. */
export const SAMPLE_WORKOUTS: WorkoutEntry[] = [
  { id: 'ex-1', date: '2026-03-03', exercise: 'Cadeira abdutora', sets: [{ weight: 50, unit: 'kg', reps: 12 }], note: 'morrendo' },
  { id: 'ex-2', date: '2026-03-11', exercise: 'Cadeira abdutora', sets: [{ weight: 55, unit: 'kg', reps: 12 }], note: '' },
  {
    id: 'ex-3',
    date: '2026-03-30',
    exercise: 'Supino reto',
    sets: [
      { weight: 7, unit: 'placa', reps: 10 },
      { weight: 8, unit: 'placa', reps: 8 },
    ],
    note: '',
  },
];
