import { SCHEMA_VERSION, type NutritionDoc } from './types';

/** A fresh, empty document used before any prescription is imported. */
export function emptyDoc(): NutritionDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    plan: { meals: [] },
    logs: { meals: [], measurements: [] },
  };
}

/** Example prescription, shown in the help page and used as an offline demo. */
export const SAMPLE_DOC: NutritionDoc = {
  schemaVersion: SCHEMA_VERSION,
  patient: { name: 'Paciente Exemplo' },
  professional: { name: 'Dra. Nutricionista', registration: 'CRN-3 00000' },
  createdAt: '2026-01-01T12:00:00.000Z',
  plan: {
    goals: { calories: 2000, protein_g: 130, carbs_g: 220, fat_g: 60, water_ml: 2500 },
    startDate: '2026-01-01',
    restrictions: ['Sem lactose'],
    recommendations: [
      'Beba água ao longo do dia.',
      'Mastigue devagar e evite telas durante as refeições.',
    ],
    supplements: [
      { name: 'Vitamina D', dose: '2000 UI', time: '08:00', notes: 'Após o café.' },
    ],
    meals: [
      {
        id: 'cafe-da-manha',
        name: 'Café da manhã',
        time: '07:30',
        items: [
          { food: 'Ovos mexidos', quantity: 2, unit: 'unidade', calories: 140, protein_g: 12, fat_g: 10 },
          { food: 'Pão integral', quantity: 2, unit: 'fatia', calories: 160, carbs_g: 30, protein_g: 6 },
          { food: 'Mamão', quantity: 150, unit: 'g', calories: 60, carbs_g: 15 },
        ],
        notes: 'Pode trocar o mamão por banana.',
        alternatives: [
          {
            name: 'Opção 2 — tapioca',
            items: [
              { food: 'Tapioca', quantity: 1, unit: 'unidade', calories: 150, carbs_g: 32 },
              { food: 'Queijo branco', quantity: 30, unit: 'g', calories: 70, protein_g: 6, fat_g: 5 },
              { food: 'Mamão', quantity: 150, unit: 'g', calories: 60, carbs_g: 15 },
            ],
          },
        ],
      },
      {
        id: 'almoco',
        name: 'Almoço',
        time: '12:30',
        items: [
          { food: 'Arroz integral cozido', quantity: 120, unit: 'g', calories: 155, carbs_g: 33, protein_g: 3 },
          { food: 'Feijão', quantity: 80, unit: 'g', calories: 75, carbs_g: 13, protein_g: 5 },
          { food: 'Peito de frango grelhado', quantity: 150, unit: 'g', calories: 248, protein_g: 46, fat_g: 5 },
          { food: 'Salada verde', quantity: 1, unit: 'porcao', calories: 40 },
        ],
      },
      {
        id: 'lanche-tarde',
        name: 'Lanche da tarde',
        time: '16:00',
        items: [
          { food: 'Iogurte natural', quantity: 1, unit: 'unidade', calories: 100, protein_g: 8, carbs_g: 12 },
          { food: 'Castanhas', quantity: 20, unit: 'g', calories: 130, fat_g: 12, protein_g: 4 },
        ],
      },
      {
        id: 'jantar',
        name: 'Jantar',
        time: '19:30',
        items: [
          { food: 'Omelete de legumes', quantity: 1, unit: 'porcao', calories: 250, protein_g: 18, fat_g: 16 },
          { food: 'Batata doce cozida', quantity: 120, unit: 'g', calories: 103, carbs_g: 24 },
        ],
      },
    ],
  },
  // Optional training side — the same file carries diet and/or workout.
  workoutPlan: {
    days: [
      { id: 'A', label: 'A', name: 'Empurrar', exercises: ['Supino', 'Desenvolvimento máquina', 'Tríceps polia'] },
      { id: 'B', label: 'B', name: 'Puxar', exercises: ['Puxada alta', 'Remada baixa', 'Rosca direta'] },
      { id: 'C', label: 'C', name: 'Pernas', exercises: ['Leg press', 'Cadeira extensora', 'Cadeira flexora'] },
    ],
  },
  workouts: [
    { id: 'w-ex-1', date: '2026-01-03', exercise: 'Supino', sets: [{ weight: 40, unit: 'kg', reps: 10 }], note: '' },
    { id: 'w-ex-2', date: '2026-01-06', exercise: 'Supino', sets: [{ weight: 42.5, unit: 'kg', reps: 10 }], note: 'subiu 2,5kg' },
  ],
  logs: { meals: [], measurements: [] },
};
