import type { Trend, WorkoutEntry, WorkoutSet, WorkoutUnit } from './types';

export const UNITS: WorkoutUnit[] = ['placa', 'kg', 'kg/lado'];
export const UNIT_LABEL: Record<WorkoutUnit, string> = {
  placa: 'placas',
  kg: 'kg',
  'kg/lado': 'kg/lado',
};

/** Accent/case-insensitive key so "Cadeira abdutora" groups across notes. */
export const norm = (s: string): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** 8 → "8", 7.5 → "7,5" (pt-BR, no trailing ".0"). */
export const fmtW = (w: number | null): string =>
  w == null ? '' : String(w).replace(/\.0+$/, '').replace('.', ',');

export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};
export const dateObj = (iso: string): Date => new Date(iso + 'T12:00:00');
export const fmtDate = (iso: string): string =>
  dateObj(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
/** Short axis label: "02/03". */
export const fmtShort = (iso: string): string =>
  dateObj(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

/** "8 placas × 12", "75 kg", "12 reps" — whatever the set actually holds. */
export function setText(s: WorkoutSet): string {
  const load = s.weight != null && s.unit ? `${fmtW(s.weight)} ${UNIT_LABEL[s.unit]}` : '';
  if (load && s.reps != null) return `${load} × ${s.reps}`;
  if (load) return load;
  if (s.reps != null) return `${s.reps} reps`;
  return '—';
}

/** Compact load label for a single set: "75 kg" / "9 placas". */
export function loadText(s: WorkoutSet | null): string {
  if (!s || s.weight == null || !s.unit) return s?.reps != null ? `${s.reps} reps` : '—';
  return `${fmtW(s.weight)} ${UNIT_LABEL[s.unit]}`;
}

/** Heaviest set in a session (by weight); falls back to the first set. */
export function bestSet(sets: WorkoutSet[]): WorkoutSet | null {
  const withW = sets.filter((s) => s.weight != null);
  if (withW.length) return withW.reduce((a, b) => (b.weight! > a.weight! ? b : a));
  return sets[0] ?? null;
}

/** Unique exercise display names, most recent first (for autocomplete). */
export function knownExercises(entries: WorkoutEntry[]): string[] {
  const byKey = new Map<string, { name: string; date: string }>();
  for (const e of entries) {
    const k = norm(e.exercise);
    const cur = byKey.get(k);
    if (!cur || e.date > cur.date) byKey.set(k, { name: e.exercise, date: e.date });
  }
  return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date)).map((v) => v.name);
}

/** Unit used last time this exercise was logged — drives the form's default. */
export function lastUnitFor(entries: WorkoutEntry[], exercise: string): WorkoutUnit | null {
  const n = norm(exercise);
  let best: WorkoutEntry | null = null;
  for (const e of entries) {
    if (norm(e.exercise) === n && (!best || e.date > best.date)) best = e;
  }
  return best?.sets.find((s) => s.unit)?.unit ?? null;
}

/** All entries of one exercise (by normalized name), sorted by date ascending. */
export function sessionsOf(entries: WorkoutEntry[], key: string): WorkoutEntry[] {
  return entries.filter((e) => norm(e.exercise) === key).sort((a, b) => a.date.localeCompare(b.date));
}

export function unitsOf(sessions: WorkoutEntry[]): WorkoutUnit[] {
  const set = new Set<WorkoutUnit>();
  for (const e of sessions) for (const s of e.sets) if (s.unit) set.add(s.unit);
  return UNITS.filter((u) => set.has(u));
}

/** Heaviest load of a given unit within one session. */
function sessionMax(e: WorkoutEntry, unit: WorkoutUnit): number | null {
  const w = e.sets.filter((s) => s.unit === unit && s.weight != null).map((s) => s.weight!);
  return w.length ? Math.max(...w) : null;
}

export interface SeriesPoint {
  date: string;
  value: number;
}

/** Load-over-time for one unit (own scale — never mixes placa with kg). */
export function loadSeries(sessions: WorkoutEntry[], unit: WorkoutUnit): SeriesPoint[] {
  return sessions
    .map((e) => ({ date: e.date, value: sessionMax(e, unit) }))
    .filter((p): p is SeriesPoint => p.value != null);
}

/** Reps-over-time (best set per session), unitless. */
export function repsSeries(sessions: WorkoutEntry[]): SeriesPoint[] {
  return sessions
    .map((e) => {
      const r = e.sets.filter((s) => s.reps != null).map((s) => s.reps!);
      return { date: e.date, value: r.length ? Math.max(...r) : null };
    })
    .filter((p): p is SeriesPoint => p.value != null);
}

export function trendOf(series: SeriesPoint[]): Trend {
  if (series.length < 2) return 'new';
  const last = series[series.length - 1].value;
  const prev = series[series.length - 2].value;
  if (last > prev) return 'up';
  if (last < prev) return 'down';
  return 'flat';
}

export interface ExerciseSummary {
  key: string;
  name: string;
  sessions: number;
  lastDate: string;
  lastText: string;
  trend: Trend;
  units: WorkoutUnit[];
}

/** One row per exercise for the Evolução overview, most recent first. */
export function summaries(entries: WorkoutEntry[]): ExerciseSummary[] {
  const keys = [...new Set(entries.map((e) => norm(e.exercise)))];
  const out: ExerciseSummary[] = keys.map((key) => {
    const sessions = sessionsOf(entries, key);
    const last = sessions[sessions.length - 1];
    const rep = bestSet(last.sets);
    const units = unitsOf(sessions);
    const primary = rep?.unit ?? units[0] ?? null;
    const trend = primary ? trendOf(loadSeries(sessions, primary)) : 'new';
    return {
      key,
      name: last.exercise,
      sessions: sessions.length,
      lastDate: last.date,
      lastText: loadText(rep),
      trend,
      units,
    };
  });
  return out.sort((a, b) => b.lastDate.localeCompare(a.lastDate));
}

export function variation(series: SeriesPoint[]): { delta: number; pct: number } | null {
  if (series.length < 2) return null;
  const first = series[0].value;
  const last = series[series.length - 1].value;
  const delta = Math.round((last - first) * 100) / 100;
  const pct = first ? Math.round(((last - first) / first) * 100) : 0;
  return { delta, pct };
}
