import type { Meal, MealLog } from '../data/types';
import { mealTotals, round } from '../data/nutrition';

const UNIT_LABEL: Record<string, string> = {
  g: 'g',
  ml: 'ml',
  kcal: 'kcal',
  unidade: 'un',
  fatia: 'fatia(s)',
  colher_sopa: 'col. sopa',
  colher_cha: 'col. chá',
  xicara: 'xícara(s)',
  copo: 'copo(s)',
  concha: 'concha(s)',
  porcao: 'porção',
};

interface Props {
  meal: Meal;
  status?: MealLog['status'] | null;
  onSet?: (s: MealLog['status']) => void;
  onClear?: () => void;
}

export default function MealCard({ meal, status, onSet, onClear }: Props) {
  const t = mealTotals(meal);
  const cls = ['card', 'meal', status ?? ''].join(' ').trim();
  return (
    <article className={cls}>
      <div className="meal-head">
        <span className="meal-time">{meal.time}</span>
        <span className="meal-name">{meal.name}</span>
        {t.calories > 0 && <span className="meal-kcal">{round(t.calories)} kcal</span>}
      </div>

      <ul className="food-list">
        {meal.items.map((it, i) => (
          <li key={i}>
            <span className="food-qty">
              {it.quantity} {UNIT_LABEL[it.unit] ?? it.unit}
            </span>
            <span className="food-name">
              {it.food}
              {it.alternatives && <span className="muted"> · ou {it.alternatives}</span>}
            </span>
          </li>
        ))}
      </ul>

      {meal.notes && <p className="note">{meal.notes}</p>}

      {onSet && (
        <div className="status-row">
          <button
            className={'sm ' + (status === 'eaten' ? 'on-eaten' : '')}
            onClick={() => (status === 'eaten' ? onClear?.() : onSet('eaten'))}
          >
            ✓ Comi
          </button>
          <button
            className={'sm ' + (status === 'partial' ? 'on-partial' : '')}
            onClick={() => (status === 'partial' ? onClear?.() : onSet('partial'))}
          >
            ½ Parcial
          </button>
          <button
            className={'sm ' + (status === 'skipped' ? 'on-skipped' : '')}
            onClick={() => (status === 'skipped' ? onClear?.() : onSet('skipped'))}
          >
            ✕ Pulei
          </button>
        </div>
      )}
    </article>
  );
}
