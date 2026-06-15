import type { MacroTotals } from '../data/nutrition';
import { round } from '../data/nutrition';

interface Row {
  key: keyof MacroTotals;
  label: string;
  unit: string;
}
const ROWS: Row[] = [
  { key: 'calories', label: 'Calorias', unit: 'kcal' },
  { key: 'protein_g', label: 'Proteína', unit: 'g' },
  { key: 'carbs_g', label: 'Carboidrato', unit: 'g' },
  { key: 'fat_g', label: 'Gordura', unit: 'g' },
];

export default function Totals({
  consumed,
  goals,
}: {
  consumed: MacroTotals;
  goals: MacroTotals;
}) {
  return (
    <div className="totals">
      {ROWS.map((r) => {
        const c = consumed[r.key];
        const g = goals[r.key];
        const pct = g > 0 ? Math.min(100, (c / g) * 100) : 0;
        const over = g > 0 && c > g;
        return (
          <div className="metric" key={r.key}>
            <div className="label">{r.label}</div>
            <div className="value">
              {round(c)}
              {g > 0 && <span className="goal"> / {round(g)} {r.unit}</span>}
              {g <= 0 && <span className="goal"> {r.unit}</span>}
            </div>
            {g > 0 && (
              <div className={'bar' + (over ? ' over' : '')}>
                <span style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
