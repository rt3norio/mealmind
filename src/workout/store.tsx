import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { WorkoutEntry } from './types';
import { loadWorkouts, saveWorkouts } from '../lib/storage';

interface WorkoutStore {
  entries: WorkoutEntry[];
  ready: boolean;
  addEntry: (e: Omit<WorkoutEntry, 'id'>) => void;
  updateEntry: (id: string, patch: Omit<WorkoutEntry, 'id'>) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
}

const Ctx = createContext<WorkoutStore | null>(null);

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      setEntries(await loadWorkouts());
      setReady(true);
    })();
  }, []);

  function commit(next: WorkoutEntry[]) {
    setEntries(next);
    void saveWorkouts(next);
  }

  const value: WorkoutStore = {
    entries,
    ready,
    addEntry: (e) => commit([{ ...e, id: crypto.randomUUID() }, ...entries]),
    updateEntry: (id, patch) => commit(entries.map((x) => (x.id === id ? { ...patch, id } : x))),
    removeEntry: (id) => commit(entries.filter((x) => x.id !== id)),
    clearAll: () => commit([]),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkouts(): WorkoutStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorkouts must be used within WorkoutProvider');
  return v;
}
