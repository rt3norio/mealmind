// Pure helpers for nutrition math and date handling. No side effects.

import type { Goals, Meal, MealLog, NutritionDoc } from './types';

export interface MacroTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const ZERO: MacroTotals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

/** Sum the macros declared on a single meal's items. */
export function mealTotals(meal: Meal): MacroTotals {
  return meal.items.reduce<MacroTotals>(
    (acc, it) => ({
      calories: acc.calories + (it.calories ?? 0),
      protein_g: acc.protein_g + (it.protein_g ?? 0),
      carbs_g: acc.carbs_g + (it.carbs_g ?? 0),
      fat_g: acc.fat_g + (it.fat_g ?? 0),
    }),
    { ...ZERO },
  );
}

/** Sum macros across a list of meals. */
export function sumMeals(meals: Meal[]): MacroTotals {
  return meals.reduce<MacroTotals>((acc, m) => {
    const t = mealTotals(m);
    return {
      calories: acc.calories + t.calories,
      protein_g: acc.protein_g + t.protein_g,
      carbs_g: acc.carbs_g + t.carbs_g,
      fat_g: acc.fat_g + t.fat_g,
    };
  }, { ...ZERO });
}

/** Local date as "YYYY-MM-DD" (avoids UTC off-by-one from toISOString). */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function logsForDate(doc: NutritionDoc, date: string): MealLog[] {
  return doc.logs.meals.filter((l) => l.date === date);
}

export function mealStatus(
  doc: NutritionDoc,
  date: string,
  mealId: string,
): MealLog['status'] | null {
  // Last write wins if there are duplicates.
  const found = doc.logs.meals.filter((l) => l.date === date && l.mealId === mealId);
  return found.length ? found[found.length - 1].status : null;
}

/** Macros consumed on `date`, counting eaten (full) and partial (half) meals. */
export function consumedTotals(doc: NutritionDoc, date: string): MacroTotals {
  const byId = new Map(doc.plan.meals.map((m) => [m.id, m]));
  return logsForDate(doc, date).reduce<MacroTotals>((acc, log) => {
    const meal = byId.get(log.mealId);
    if (!meal || log.status === 'skipped') return acc;
    const t = mealTotals(meal);
    const factor = log.status === 'partial' ? 0.5 : 1;
    return {
      calories: acc.calories + t.calories * factor,
      protein_g: acc.protein_g + t.protein_g * factor,
      carbs_g: acc.carbs_g + t.carbs_g * factor,
      fat_g: acc.fat_g + t.fat_g * factor,
    };
  }, { ...ZERO });
}

export function goalsAsTotals(goals?: Goals): MacroTotals {
  return {
    calories: goals?.calories ?? 0,
    protein_g: goals?.protein_g ?? 0,
    carbs_g: goals?.carbs_g ?? 0,
    fat_g: goals?.fat_g ?? 0,
  };
}

export function round(n: number): number {
  return Math.round(n);
}
