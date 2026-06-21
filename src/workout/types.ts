// Workout tracking domain — kept separate from the nutrition document so the
// two concerns never tangle. Persisted under its own IndexedDB key.

/** The three load notations that coexist in the gym notes. */
export type WorkoutUnit = 'placa' | 'kg' | 'kg/lado';

export interface WorkoutSet {
  /** Numeric load. null when a set only records reps (e.g. bodyweight). */
  weight: number | null;
  /** null pairs with a null weight (reps-only set). */
  unit: WorkoutUnit | null;
  reps: number | null;
}

export interface WorkoutEntry {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  exercise: string;
  sets: WorkoutSet[];
  note: string;
  /** Original free text (e.g. imported from WhatsApp), preserved for reference. */
  raw?: string;
}

export type Trend = 'up' | 'down' | 'flat' | 'new';
export type Metric = 'load' | 'reps';

/** A day of a training split (e.g. "A — Empurrar") and its exercises. */
export interface RoutineDay {
  id: string;
  /** Short marker shown on the day, e.g. "A". */
  label: string;
  /** Day focus, e.g. "Empurrar". */
  name: string;
  exercises: string[];
}

/** The training program (the ABC split), distinct from the logged sessions. */
export interface WorkoutPlan {
  days: RoutineDay[];
}
