// Data model for MealMind.
//
// One JSON document holds the whole app state: the nutritionist's prescription
// (the "plan") and the user's tracking logs. The file is portable — exported,
// e-mailed, and re-imported — and is also what gets synced to Google Drive.
//
// The schema is intentionally small and explicit so an LLM can generate a valid
// document from a plain-language prompt (see docs/PRESCRIPTION_SCHEMA.md).

import type { WorkoutEntry, WorkoutPlan } from '../workout/types';

export const SCHEMA_VERSION = '1.0' as const;

/** Units accepted for a food/supplement quantity. */
export const UNITS = [
  'g',
  'ml',
  'kcal',
  'unidade',
  'fatia',
  'colher_sopa',
  'colher_cha',
  'xicara',
  'copo',
  'concha',
  'porcao',
] as const;
export type Unit = (typeof UNITS)[number];

/** A single food within a meal. Macros are optional but recommended. */
export interface FoodItem {
  /** Human name, e.g. "Arroz integral cozido". */
  food: string;
  /** Numeric amount. Must be > 0. */
  quantity: number;
  /** Measurement unit for `quantity`. */
  unit: Unit;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  /** Free-text alternatives, e.g. "ou 2 fatias de pão integral". */
  alternatives?: string;
  notes?: string;
}

/** A whole substitute option for a meal (e.g. "Opção 2: tapioca"). */
export interface MealAlternative {
  /** Optional label, e.g. "Opção 2" or "Versão sem lactose". */
  name?: string;
  items: FoodItem[];
  notes?: string;
}

/** A scheduled meal with its foods. */
export interface Meal {
  /** Stable id used to correlate logs to the plan. lowercase-kebab. */
  id: string;
  /** Display name, e.g. "Café da manhã". */
  name: string;
  /** 24h time "HH:MM" the meal is scheduled for. */
  time: string;
  items: FoodItem[];
  /** Optional substitute versions of this meal the patient may choose instead. */
  alternatives?: MealAlternative[];
  notes?: string;
}

export interface Supplement {
  name: string;
  dose: string;
  /** Optional "HH:MM". */
  time?: string;
  notes?: string;
}

/** Daily macro/energy/hydration targets. All optional. */
export interface Goals {
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  water_ml?: number;
}

export interface Professional {
  name: string;
  /** Council registration, e.g. "CRN-3 12345". */
  registration?: string;
  contact?: string;
}

export interface Patient {
  name: string;
  notes?: string;
}

export interface Plan {
  goals?: Goals;
  meals: Meal[];
  supplements?: Supplement[];
  /** e.g. ["Sem lactose", "Evitar frituras"]. */
  restrictions?: string[];
  /** General guidance shown to the user. */
  recommendations?: string[];
  /** ISO date "YYYY-MM-DD" the plan is valid from. */
  startDate?: string;
  /** ISO date "YYYY-MM-DD" the plan is valid until. */
  endDate?: string;
}

/** One meal marked as eaten (or skipped) on a given day. */
export interface MealLog {
  /** "YYYY-MM-DD". */
  date: string;
  /** References Meal.id. */
  mealId: string;
  status: 'eaten' | 'skipped' | 'partial';
  loggedAt: string; // ISO timestamp
  /**
   * Which option was eaten: 0 (or absent) = the base meal, 1 = alternatives[0],
   * 2 = alternatives[1], etc. Macros/portions are computed against this option.
   */
  option?: number;
  /**
   * For status "partial": fraction actually eaten of each item of the chosen
   * option, aligned by index (1 = full planned amount, 0.5 = half, 0 = none,
   * >1 = ate more). Absent = legacy partial, treated as 0.5 across the board.
   */
  portions?: number[];
  notes?: string;
}

/** Free-form measurements the user tracks (weight, water, etc.). */
export interface Measurement {
  date: string; // "YYYY-MM-DD"
  weight_kg?: number;
  water_ml?: number;
  notes?: string;
}

/** A food eaten outside the plan (e.g. a candy, a coffee), logged at a moment. */
export interface ExtraEntry {
  /** Stable id for removal. */
  id: string;
  /** "YYYY-MM-DD". */
  date: string;
  /** ISO timestamp when it was logged ("now"). */
  loggedAt: string;
  /** What was eaten, free text. Ex.: "Café com leite". */
  food: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

export interface Logs {
  meals: MealLog[];
  measurements: Measurement[];
  /** Ad-hoc foods outside the plan. Optional for backward compatibility. */
  extras?: ExtraEntry[];
}

/** The complete app document. */
export interface NutritionDoc {
  schemaVersion: string;
  /** Optional document identity. */
  patient?: Patient;
  professional?: Professional;
  /** ISO timestamp the prescription was authored. */
  createdAt?: string;
  plan: Plan;
  /** Tracking data owned by the user (the nutritionist leaves this empty). */
  logs: Logs;
  /** Strength-training log — lives in the same document so a single upload
   * carries diet and/or workout, and one export/sync covers both. */
  workouts?: WorkoutEntry[];
  /** Training program (the ABC split) the user logs against. */
  workoutPlan?: WorkoutPlan;
}
