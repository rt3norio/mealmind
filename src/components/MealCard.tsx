import { useState } from 'react';
import type { FoodItem, Meal, MealLog } from '../data/types';
import { itemsTotals, mealConsumed, round } from '../data/nutrition';

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
  log?: MealLog | null;
  onSet?: (s: MealLog['status'], portions?: number[], option?: number) => void;
  onClear?: () => void;
}

function FoodLines({ items }: { items: FoodItem[] }) {
  return (
    <ul className="food-list">
      {items.map((it, i) => (
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
  );
}

export default function MealCard({ meal, log, onSet, onClear }: Props) {
  const alts = meal.alternatives ?? [];
  const options = [
    { label: 'Plano base', items: meal.items },
    ...alts.map((a, i) => ({ label: a.name ?? `Opção ${i + 2}`, items: a.items })),
  ];

  const loggedOption = log?.option ?? 0;
  const [sel, setSel] = useState(loggedOption);
  const [editing, setEditing] = useState(false);
  const [qtys, setQtys] = useState<string[]>([]);

  // Follow the logged option when it changes (e.g. on load or after a sync).
  // Adjusting state during render is React's recommended pattern over an effect.
  const [prevLogged, setPrevLogged] = useState(loggedOption);
  if (prevLogged !== loggedOption) {
    setPrevLogged(loggedOption);
    setSel(loggedOption);
  }

  const status = log?.status ?? null;
  const selItems = options[sel]?.items ?? meal.items;
  const selPlanned = itemsTotals(selItems);
  const selNotes = sel === 0 ? meal.notes : alts[sel - 1]?.notes;
  const cls = ['card', 'meal', status ?? ''].join(' ').trim();

  // "active" only when the button's status AND option match what's logged.
  const activeOn = (s: MealLog['status']) => status === s && loggedOption === sel;

  function openEditor() {
    const usePortions = log?.status === 'partial' && loggedOption === sel ? log.portions : undefined;
    setQtys(
      selItems.map((it, i) => {
        const eaten = usePortions?.[i] != null ? usePortions[i] * it.quantity : it.quantity;
        return String(+eaten.toFixed(2));
      }),
    );
    setEditing(true);
  }

  function fractions(): number[] {
    return selItems.map((it, i) => {
      const eaten = parseFloat((qtys[i] ?? '').replace(',', '.'));
      if (!Number.isFinite(eaten) || eaten < 0) return 0;
      return eaten / it.quantity;
    });
  }

  const previewKcal = round(
    selItems.reduce((s, it, i) => {
      const eaten = parseFloat((qtys[i] ?? '').replace(',', '.'));
      const f = Number.isFinite(eaten) && eaten >= 0 ? eaten / it.quantity : 0;
      return s + (it.calories ?? 0) * f;
    }, 0),
  );

  const headerKcal = log ? round(mealConsumed(meal, log).calories) : round(selPlanned.calories);

  return (
    <article className={cls}>
      <div className="meal-head">
        <span className="meal-time">{meal.time}</span>
        <span className="meal-name">{meal.name}</span>
        {itemsTotals(meal.items).calories > 0 && (
          <span className="meal-kcal">
            {headerKcal}
            {status === 'partial' && <span className="muted"> / {round(selPlanned.calories)}</span>} kcal
          </span>
        )}
      </div>

      {log && status && (
        <p className="eaten-badge">
          {status === 'skipped' ? '✕ pulou' : status === 'partial' ? '½ parcial' : '✓ comeu'}
          {loggedOption > 0 && <> · {options[loggedOption]?.label}</>}
        </p>
      )}

      {options.length > 1 && !editing && (
        <>
          <p className="opt-hint">{onSet ? 'Qual opção?' : 'Opções'}</p>
          <div className="opt-pills">
            {options.map((o, i) => (
              <button
                key={i}
                className={'sm' + (sel === i ? ' sel' : '')}
                onClick={() => setSel(i)}
              >
                {o.label}
                {options.length > 1 && itemsTotals(o.items).calories > 0 && (
                  <span className="pill-kcal"> · {round(itemsTotals(o.items).calories)}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {sel > 0 && (
        <p className="opt-current">
          🔁 Mostrando: <strong>{options[sel]?.label}</strong>
          {loggedOption !== sel && <span className="muted"> (selecione “Comi/Parcial” pra registrar esta opção)</span>}
        </p>
      )}

      <FoodLines items={selItems} />

      {selNotes && <p className="note">{selNotes}</p>}

      {editing && (
        <div className="partial-editor">
          <p className="sub" style={{ margin: '2px 0 10px' }}>
            Ajuste o quanto você comeu — <strong>{options[sel]?.label}</strong>:
          </p>
          {selItems.map((it, i) => (
            <label className="portion-row" key={i}>
              <span className="portion-name">{it.food}</span>
              <span className="portion-input">
                <input
                  type="number"
                  inputMode="decimal"
                  value={qtys[i] ?? ''}
                  min={0}
                  onChange={(e) => {
                    const next = [...qtys];
                    next[i] = e.target.value;
                    setQtys(next);
                  }}
                />
                <span className="muted">/ {it.quantity} {UNIT_LABEL[it.unit] ?? it.unit}</span>
              </span>
            </label>
          ))}
          <p className="sub" style={{ margin: '6px 0 10px' }}>
            ≈ <strong>{previewKcal} kcal</strong> de {round(selPlanned.calories)}
          </p>
          <div className="status-row">
            <button
              className="sm on-partial"
              onClick={() => {
                onSet?.('partial', fractions(), sel);
                setEditing(false);
              }}
            >
              Salvar parcial
            </button>
            <button className="sm ghost" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {onSet && !editing && (
        <div className="status-row">
          <button
            className={'sm ' + (activeOn('eaten') ? 'on-eaten' : '')}
            onClick={() => (activeOn('eaten') ? onClear?.() : onSet('eaten', undefined, sel))}
          >
            ✓ Comi
          </button>
          <button
            className={'sm ' + (activeOn('partial') ? 'on-partial' : '')}
            onClick={openEditor}
          >
            ½ Parcial
          </button>
          <button
            className={'sm ' + (activeOn('skipped') ? 'on-skipped' : '')}
            onClick={() => (activeOn('skipped') ? onClear?.() : onSet('skipped', undefined, sel))}
          >
            ✕ Pulei
          </button>
        </div>
      )}
    </article>
  );
}
