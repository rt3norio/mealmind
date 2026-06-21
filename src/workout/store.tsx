// Workouts live inside the single app document (NutritionDoc.workouts), so one
// upload, export and Drive sync cover diet and training alike. This hook is a
// thin adapter over the main store — no separate persistence.

import { useStore } from '../store';
import type { RoutineDay, WorkoutEntry, WorkoutPlan } from './types';

const byDateDesc = (a: WorkoutEntry, b: WorkoutEntry) => b.date.localeCompare(a.date);

export interface WorkoutStore {
  entries: WorkoutEntry[];
  plan: WorkoutPlan | null;
  ready: boolean;
  addEntry: (e: Omit<WorkoutEntry, 'id'>) => void;
  updateEntry: (id: string, patch: Omit<WorkoutEntry, 'id'>) => void;
  removeEntry: (id: string) => void;
  /** Replace the whole list (import). */
  replaceAll: (entries: WorkoutEntry[]) => void;
  /** Append imported entries, skipping ids that already exist. Returns how many were added. */
  mergeAll: (entries: WorkoutEntry[]) => number;
  clearAll: () => void;
  /** Program (ABC split) mutations. */
  setDays: (days: RoutineDay[]) => void;
  addDay: () => void;
  removeDay: (id: string) => void;
  addExercise: (dayId: string, name: string) => void;
  removeExercise: (dayId: string, index: number) => void;
}

export function useWorkouts(): WorkoutStore {
  const { doc, ready, setWorkouts, setWorkoutPlan } = useStore();
  const entries = doc.workouts ?? [];
  const plan = doc.workoutPlan ?? null;
  const days = plan?.days ?? [];

  const commitDays = (next: RoutineDay[]) => setWorkoutPlan(next.length ? { days: next } : undefined);
  const mapDay = (id: string, fn: (d: RoutineDay) => RoutineDay) =>
    commitDays(days.map((d) => (d.id === id ? fn(d) : d)));

  return {
    entries,
    plan,
    ready,
    addEntry: (e) => setWorkouts([{ ...e, id: crypto.randomUUID() }, ...entries]),
    updateEntry: (id, patch) => setWorkouts(entries.map((x) => (x.id === id ? { ...patch, id } : x))),
    removeEntry: (id) => setWorkouts(entries.filter((x) => x.id !== id)),
    replaceAll: (next) => setWorkouts([...next].sort(byDateDesc)),
    mergeAll: (incoming) => {
      const seen = new Set(entries.map((e) => e.id));
      const fresh = incoming.filter((e) => !seen.has(e.id));
      if (fresh.length) setWorkouts([...entries, ...fresh].sort(byDateDesc));
      return fresh.length;
    },
    clearAll: () => setWorkouts([]),
    setDays: commitDays,
    addDay: () =>
      commitDays([
        ...days,
        { id: crypto.randomUUID(), label: String.fromCharCode(65 + days.length), name: '', exercises: [] },
      ]),
    removeDay: (id) => commitDays(days.filter((d) => d.id !== id)),
    addExercise: (dayId, name) =>
      mapDay(dayId, (d) => ({ ...d, exercises: [...d.exercises, name.trim()] })),
    removeExercise: (dayId, index) =>
      mapDay(dayId, (d) => ({ ...d, exercises: d.exercises.filter((_, i) => i !== index) })),
  };
}
