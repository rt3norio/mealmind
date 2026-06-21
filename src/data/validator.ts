// Hand-rolled validator with friendly, teaching error messages.
//
// We deliberately avoid a generic JSON-Schema library: the goal is that the
// error output reads like a human (or an LLM) explaining *why* a file is wrong
// and *how* to fix it — not "should match pattern ^...$".

import { SCHEMA_VERSION, UNITS, type NutritionDoc, type Unit } from './types';

export interface ValidationIssue {
  /** Dotted/bracketed path to the offending value, e.g. "plan.meals[0].time". */
  path: string;
  /** What is wrong, in plain language. */
  message: string;
  /** How to fix it. */
  hint?: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  /** True when there are zero errors AND zero warnings. */
  perfect: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

class Collector {
  errors: ValidationIssue[] = [];
  warnings: ValidationIssue[] = [];
  err(path: string, message: string, hint?: string) {
    this.errors.push({ path, message, hint, severity: 'error' });
  }
  warn(path: string, message: string, hint?: string) {
    this.warnings.push({ path, message, hint, severity: 'warning' });
  }
}

function checkNumber(
  c: Collector,
  path: string,
  value: unknown,
  opts: { required?: boolean; positive?: boolean } = {},
): void {
  if (value === undefined || value === null) {
    if (opts.required) c.err(path, 'Valor numérico obrigatório está faltando.', 'Adicione um número aqui.');
    return;
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    c.err(path, `Esperado um número, recebido ${describe(value)}.`, 'Remova as aspas — números não usam aspas em JSON (ex.: 120, não "120").');
    return;
  }
  if (opts.positive && value <= 0) {
    c.err(path, `O número deve ser maior que zero (recebido ${value}).`);
  }
}

function checkString(
  c: Collector,
  path: string,
  value: unknown,
  opts: { required?: boolean; nonEmpty?: boolean } = {},
): boolean {
  if (value === undefined || value === null) {
    if (opts.required) c.err(path, 'Campo de texto obrigatório está faltando.', 'Adicione o campo com um valor entre aspas.');
    return false;
  }
  if (typeof value !== 'string') {
    c.err(path, `Esperado texto, recebido ${describe(value)}.`, 'Coloque o valor entre aspas duplas.');
    return false;
  }
  if (opts.nonEmpty && value.trim() === '') {
    c.err(path, 'O texto não pode ser vazio.');
    return false;
  }
  return true;
}

function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'uma lista';
  return typeof v === 'object' ? 'um objeto' : `${typeof v} (${JSON.stringify(v)})`;
}

function validateFoodItem(c: Collector, path: string, item: unknown): void {
  if (!isObject(item)) {
    c.err(path, `Cada item de refeição deve ser um objeto, recebido ${describe(item)}.`, 'Use { "food": "...", "quantity": 100, "unit": "g" }.');
    return;
  }
  checkString(c, `${path}.food`, item.food, { required: true, nonEmpty: true });
  checkNumber(c, `${path}.quantity`, item.quantity, { required: true, positive: true });
  if (item.unit === undefined) {
    c.err(`${path}.unit`, 'Unidade obrigatória está faltando.', `Use uma de: ${UNITS.join(', ')}.`);
  } else if (!UNITS.includes(item.unit as Unit)) {
    c.err(`${path}.unit`, `Unidade "${String(item.unit)}" não é reconhecida.`, `Use uma de: ${UNITS.join(', ')}.`);
  }
  for (const k of ['calories', 'protein_g', 'carbs_g', 'fat_g'] as const) {
    if (item[k] !== undefined) checkNumber(c, `${path}.${k}`, item[k], { positive: false });
  }
  if (item.calories === undefined) {
    c.warn(`${path}.calories`, 'Sem calorias informadas — o app não conseguirá somar energia desta refeição.', 'Opcional, mas recomendado.');
  }
}

function validateMeal(c: Collector, path: string, meal: unknown, seenIds: Set<string>): void {
  if (!isObject(meal)) {
    c.err(path, `Cada refeição deve ser um objeto, recebido ${describe(meal)}.`);
    return;
  }
  if (checkString(c, `${path}.id`, meal.id, { required: true, nonEmpty: true })) {
    const id = meal.id as string;
    if (!/^[a-z0-9-]+$/.test(id)) {
      c.warn(`${path}.id`, `id "${id}" deveria usar apenas letras minúsculas, números e hífens.`, 'Ex.: "cafe-da-manha".');
    }
    if (seenIds.has(id)) {
      c.err(`${path}.id`, `id "${id}" está duplicado.`, 'Cada refeição precisa de um id único.');
    }
    seenIds.add(id);
  }
  checkString(c, `${path}.name`, meal.name, { required: true, nonEmpty: true });
  if (checkString(c, `${path}.time`, meal.time, { required: true })) {
    if (!TIME_RE.test(meal.time as string)) {
      c.err(`${path}.time`, `Horário "${meal.time as string}" inválido.`, 'Use o formato 24h "HH:MM", ex.: "07:30" ou "19:00".');
    }
  }
  if (!Array.isArray(meal.items)) {
    c.err(`${path}.items`, 'A refeição precisa de uma lista "items".', 'Use "items": [ ... ] com ao menos um alimento.');
  } else if (meal.items.length === 0) {
    c.warn(`${path}.items`, 'Refeição sem nenhum alimento.');
  } else {
    meal.items.forEach((it, i) => validateFoodItem(c, `${path}.items[${i}]`, it));
  }
  if (meal.alternatives !== undefined) {
    if (!Array.isArray(meal.alternatives)) {
      c.err(`${path}.alternatives`, 'Se presente, "alternatives" deve ser uma lista.', 'Cada alternativa é { "name"?, "items": [ ... ] }.');
    } else {
      meal.alternatives.forEach((alt, i) => {
        const ap = `${path}.alternatives[${i}]`;
        if (!isObject(alt)) {
          c.err(ap, 'Cada alternativa deve ser um objeto.', 'Use { "name": "Opção 2", "items": [ ... ] }.');
          return;
        }
        if (alt.name !== undefined) checkString(c, `${ap}.name`, alt.name);
        if (!Array.isArray(alt.items) || alt.items.length === 0) {
          c.err(`${ap}.items`, 'A alternativa precisa de uma lista "items" não vazia.');
        } else {
          alt.items.forEach((it, j) => validateFoodItem(c, `${ap}.items[${j}]`, it));
        }
      });
    }
  }
}

const WORKOUT_UNITS = ['placa', 'kg', 'kg/lado'];

function validateWorkoutEntry(c: Collector, path: string, w: unknown): void {
  if (!isObject(w)) {
    c.err(path, 'Cada sessão de treino deve ser um objeto.');
    return;
  }
  if (checkString(c, `${path}.date`, w.date, { required: true }) && !DATE_RE.test(w.date as string)) {
    c.err(`${path}.date`, `Data "${w.date as string}" inválida.`, 'Use o formato "AAAA-MM-DD".');
  }
  checkString(c, `${path}.exercise`, w.exercise, { required: true, nonEmpty: true });
  if (w.sets === undefined) {
    c.warn(path, 'Sessão sem "sets" (séries).');
  } else if (!Array.isArray(w.sets)) {
    c.err(`${path}.sets`, '"sets" deve ser uma lista de séries.');
  } else {
    w.sets.forEach((s, i) => {
      const sp = `${path}.sets[${i}]`;
      if (!isObject(s)) {
        c.err(sp, 'Cada série deve ser um objeto.');
        return;
      }
      const hasWeight = s.weight !== undefined && s.weight !== null;
      if (hasWeight) checkNumber(c, `${sp}.weight`, s.weight, { positive: true });
      if (hasWeight && s.unit !== undefined && s.unit !== null &&
          (typeof s.unit !== 'string' || !WORKOUT_UNITS.includes(s.unit))) {
        c.err(`${sp}.unit`, `Unidade de treino inválida: ${describe(s.unit)}.`, `Use uma de: ${WORKOUT_UNITS.join(', ')}.`);
      }
      if (s.reps !== undefined && s.reps !== null) checkNumber(c, `${sp}.reps`, s.reps, { positive: true });
    });
  }
}

function validateRoutineDay(c: Collector, path: string, d: unknown): void {
  if (!isObject(d)) {
    c.err(path, 'Cada dia do programa deve ser um objeto.');
    return;
  }
  if (d.label !== undefined) checkString(c, `${path}.label`, d.label);
  if (d.name !== undefined) checkString(c, `${path}.name`, d.name);
  if (d.exercises === undefined) {
    c.warn(path, 'Dia do programa sem "exercises".');
  } else if (!Array.isArray(d.exercises)) {
    c.err(`${path}.exercises`, '"exercises" deve ser uma lista de nomes (textos).');
  } else {
    d.exercises.forEach((e, i) => checkString(c, `${path}.exercises[${i}]`, e, { required: true, nonEmpty: true }));
  }
}

/**
 * Validate an unknown value as a NutritionDoc.
 * Logs may be absent (a fresh prescription has none) — that is not an error.
 * The diet "plan" is optional when the file carries only training.
 */
export function validate(raw: unknown): ValidationResult {
  const c = new Collector();

  if (!isObject(raw)) {
    c.err('(raiz)', `O arquivo deve conter um objeto JSON, recebido ${describe(raw)}.`, 'O conteúdo precisa começar com { e terminar com }.');
    return finalize(c);
  }

  if (raw.schemaVersion === undefined) {
    c.err('schemaVersion', 'Campo "schemaVersion" obrigatório está faltando.', `Adicione "schemaVersion": "${SCHEMA_VERSION}".`);
  } else if (raw.schemaVersion !== SCHEMA_VERSION) {
    c.warn('schemaVersion', `Versão "${String(raw.schemaVersion)}" diferente da suportada (${SCHEMA_VERSION}).`, 'O app tentará abrir mesmo assim.');
  }

  const hasWorkout = raw.workouts !== undefined || raw.workoutPlan !== undefined;

  if (raw.plan === undefined && hasWorkout) {
    // Workout-only file: the diet "plan" is optional.
  } else if (!isObject(raw.plan)) {
    c.err('plan', 'Campo "plan" está faltando ou não é um objeto.', 'Adicione "plan": { "meals": [ ... ] }, ou inclua treino ("workoutPlan"/"workouts").');
  } else {
    const plan = raw.plan;
    if (!Array.isArray(plan.meals)) {
      c.err('plan.meals', 'O plano precisa de uma lista "meals".', 'Adicione "meals": [ ... ].');
    } else if (plan.meals.length === 0) {
      c.warn('plan.meals', 'O plano não tem nenhuma refeição.');
    } else {
      const ids = new Set<string>();
      plan.meals.forEach((m, i) => validateMeal(c, `plan.meals[${i}]`, m, ids));
    }
    if (plan.goals !== undefined) {
      if (!isObject(plan.goals)) {
        c.err('plan.goals', 'Se presente, "goals" deve ser um objeto.');
      } else {
        for (const k of ['calories', 'protein_g', 'carbs_g', 'fat_g', 'water_ml'] as const) {
          if (plan.goals[k] !== undefined) checkNumber(c, `plan.goals.${k}`, plan.goals[k], { positive: true });
        }
      }
    }
    for (const k of ['startDate', 'endDate'] as const) {
      if (plan[k] !== undefined && checkString(c, `plan.${k}`, plan[k]) && !DATE_RE.test(plan[k] as string)) {
        c.err(`plan.${k}`, `Data "${plan[k] as string}" inválida.`, 'Use o formato "AAAA-MM-DD".');
      }
    }
    if (plan.supplements !== undefined) {
      if (!Array.isArray(plan.supplements)) {
        c.err('plan.supplements', 'Se presente, "supplements" deve ser uma lista.');
      } else {
        plan.supplements.forEach((s, i) => {
          if (!isObject(s)) {
            c.err(`plan.supplements[${i}]`, 'Cada suplemento deve ser um objeto.');
            return;
          }
          checkString(c, `plan.supplements[${i}].name`, s.name, { required: true, nonEmpty: true });
          checkString(c, `plan.supplements[${i}].dose`, s.dose, { required: true, nonEmpty: true });
        });
      }
    }
  }

  if (raw.createdAt !== undefined) checkString(c, 'createdAt', raw.createdAt);

  // Logs are optional in the file; validate only if present.
  if (raw.logs !== undefined) {
    if (!isObject(raw.logs)) {
      c.err('logs', 'Se presente, "logs" deve ser um objeto com "meals" e "measurements".');
    } else {
      if (raw.logs.meals !== undefined && !Array.isArray(raw.logs.meals)) {
        c.err('logs.meals', '"logs.meals" deve ser uma lista.');
      }
      if (raw.logs.measurements !== undefined && !Array.isArray(raw.logs.measurements)) {
        c.err('logs.measurements', '"logs.measurements" deve ser uma lista.');
      }
      if (raw.logs.extras !== undefined && !Array.isArray(raw.logs.extras)) {
        c.err('logs.extras', '"logs.extras" deve ser uma lista.');
      }
    }
  }

  // Training program (optional).
  if (raw.workoutPlan !== undefined) {
    if (!isObject(raw.workoutPlan)) {
      c.err('workoutPlan', 'Se presente, "workoutPlan" deve ser um objeto com "days".');
    } else if (!Array.isArray(raw.workoutPlan.days)) {
      c.err('workoutPlan.days', '"workoutPlan" precisa de uma lista "days".', 'Adicione "days": [ { "label": "A", "name": "...", "exercises": [ ... ] } ].');
    } else {
      raw.workoutPlan.days.forEach((d, i) => validateRoutineDay(c, `workoutPlan.days[${i}]`, d));
    }
  }

  // Logged training sessions (optional).
  if (raw.workouts !== undefined) {
    if (!Array.isArray(raw.workouts)) {
      c.err('workouts', 'Se presente, "workouts" deve ser uma lista de sessões.');
    } else {
      raw.workouts.forEach((w, i) => validateWorkoutEntry(c, `workouts[${i}]`, w));
    }
  }

  return finalize(c);
}

function finalize(c: Collector): ValidationResult {
  return {
    valid: c.errors.length === 0,
    perfect: c.errors.length === 0 && c.warnings.length === 0,
    errors: c.errors,
    warnings: c.warnings,
  };
}

/**
 * Parse a JSON string and validate. Returns either the parsed doc (normalized
 * with an empty logs section if missing) or a structured error result.
 */
export function parseAndValidate(
  text: string,
): { result: ValidationResult; doc?: NutritionDoc } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      result: {
        valid: false,
        perfect: false,
        errors: [
          {
            path: '(arquivo)',
            message: `O texto não é um JSON válido: ${msg}`,
            hint: 'Verifique vírgulas sobrando, aspas não fechadas ou chaves desbalanceadas. Cole o conteúdo em um validador de JSON se necessário.',
            severity: 'error',
          },
        ],
        warnings: [],
      },
    };
  }
  const result = validate(raw);
  if (!result.valid) return { result };
  const doc = normalize(raw as NutritionDoc);
  return { result, doc };
}

/** Ensure a validated doc has a logs section so the app can write to it. */
export function normalize(doc: NutritionDoc): NutritionDoc {
  return {
    ...doc,
    plan: doc.plan ?? { meals: [] },
    logs: {
      meals: doc.logs?.meals ?? [],
      measurements: doc.logs?.measurements ?? [],
      extras: doc.logs?.extras ?? [],
    },
  };
}
