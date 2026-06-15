import { useStore } from '../store';
import MealCard from '../components/MealCard';
import Totals from '../components/Totals';
import {
  consumedTotals,
  goalsAsTotals,
  mealStatus,
  todayKey,
} from '../data/nutrition';
import { Link } from 'react-router-dom';

export default function Today() {
  const { doc, logMeal, clearMealLog } = useStore();
  const date = todayKey();
  const meals = [...doc.plan.meals].sort((a, b) => a.time.localeCompare(b.time));

  const consumed = consumedTotals(doc, date);
  const goals = goalsAsTotals(doc.plan.goals);

  const prettyDate = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (meals.length === 0) {
    return (
      <div className="empty">
        <div className="big">🥗</div>
        <p>Nenhum plano carregado ainda.</p>
        <p className="muted">
          Importe a prescrição do seu nutricionista na aba <Link to="/dados" className="inline">Dados</Link>.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <h2 style={{ textTransform: 'capitalize' }}>{prettyDate}</h2>
        <p className="sub">Marque cada refeição conforme o dia avança.</p>
        <Totals consumed={consumed} goals={goals} />
      </div>

      {meals.map((m) => (
        <MealCard
          key={m.id}
          meal={m}
          status={mealStatus(doc, date, m.id)}
          onSet={(s) => logMeal(m.id, s, date)}
          onClear={() => clearMealLog(m.id, date)}
        />
      ))}
    </>
  );
}
