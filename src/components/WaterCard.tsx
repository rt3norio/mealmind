import { useStore } from '../store';
import { round, todayKey, waterForDate } from '../data/nutrition';

const GLASS_ML = 250;

/** Daily water tracker: running total vs the plan's goal, with quick add/undo. */
export default function WaterCard() {
  const { doc, addWater } = useStore();
  const date = todayKey();
  const water = waterForDate(doc, date);
  const goal = doc.plan.goals?.water_ml ?? 0;

  const pct = goal > 0 ? Math.min(100, (water / goal) * 100) : 0;
  const over = goal > 0 && water > goal;
  const glasses = Math.round((water / GLASS_ML) * 10) / 10;

  return (
    <div className="card">
      <div className="water-head">
        <h2>💧 Água</h2>
        <div className="water-amount">
          {round(water)}
          <span className="goal">{goal > 0 ? ` / ${round(goal)} ml` : ' ml'}</span>
        </div>
      </div>

      {goal > 0 && (
        <div className={'bar water' + (over ? ' over' : '')}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}

      <p className="sub" style={{ margin: '8px 0 12px' }}>
        {glasses} {glasses === 1 ? 'copo' : 'copos'} de 250 ml
        {goal > 0 && !over && ` · faltam ${round(goal - water)} ml`}
        {over && ' · meta batida 🎉'}
      </p>

      <div className="btn-row">
        <button className="primary" onClick={() => addWater(250)}>+ Copo 250 ml</button>
        <button className="primary" onClick={() => addWater(500)}>+ Garrafa 500 ml</button>
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="sm" onClick={() => addWater(100)}>+100 ml</button>
        <button className="sm" onClick={() => addWater(-250)} disabled={water <= 0}>−250 ml</button>
        <button className="ghost sm" onClick={() => addWater(-water)} disabled={water <= 0}>Zerar</button>
      </div>
    </div>
  );
}
