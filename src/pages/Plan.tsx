import { useStore } from '../store';
import MealCard from '../components/MealCard';
import Totals from '../components/Totals';
import { goalsAsTotals, sumMeals } from '../data/nutrition';
import { Link } from 'react-router-dom';

export default function Plan() {
  const { doc } = useStore();
  const { plan, patient, professional } = doc;
  const meals = [...plan.meals].sort((a, b) => a.time.localeCompare(b.time));

  if (meals.length === 0) {
    return (
      <div className="empty">
        <div className="big">📋</div>
        <p>Sem plano carregado.</p>
        <p className="muted">
          Vá em <Link to="/dados" className="inline">Dados</Link> para importar.
        </p>
      </div>
    );
  }

  const planned = sumMeals(meals);
  const goals = goalsAsTotals(plan.goals);

  return (
    <>
      <div className="card">
        <h2>Plano alimentar</h2>
        {(patient || professional) && (
          <p className="sub">
            {patient?.name && <>Paciente: {patient.name}. </>}
            {professional?.name && (
              <>Por {professional.name}{professional.registration ? ` (${professional.registration})` : ''}.</>
            )}
          </p>
        )}
        {(plan.startDate || plan.endDate) && (
          <p className="sub">
            Vigência: {plan.startDate ?? '—'} {plan.endDate ? `até ${plan.endDate}` : ''}
          </p>
        )}
        <div className="section-title" style={{ marginTop: 8 }}>Total planejado no dia</div>
        <Totals consumed={planned} goals={goals} />
      </div>

      {plan.restrictions?.length ? (
        <div className="card">
          <h2>Restrições</h2>
          <div>{plan.restrictions.map((r, i) => <span className="pill" key={i}>{r}</span>)}</div>
        </div>
      ) : null}

      <div className="section-title">Refeições</div>
      {meals.map((m) => <MealCard key={m.id} meal={m} />)}

      {plan.supplements?.length ? (
        <>
          <div className="section-title">Suplementos</div>
          <div className="card">
            <ul className="food-list">
              {plan.supplements.map((s, i) => (
                <li key={i}>
                  <span className="food-qty">{s.time ?? '—'}</span>
                  <span className="food-name">
                    <strong>{s.name}</strong> · {s.dose}
                    {s.notes && <span className="muted"> · {s.notes}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {plan.recommendations?.length ? (
        <>
          <div className="section-title">Recomendações</div>
          <div className="card">
            <ul className="bul">
              {plan.recommendations.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </>
      ) : null}
    </>
  );
}
