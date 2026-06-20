import { useMemo, useState } from 'react';
import { useWorkouts } from '../workout/store';
import type { Metric, Trend, WorkoutEntry, WorkoutSet, WorkoutUnit } from '../workout/types';
import Chart from '../workout/Chart';
import {
  UNITS,
  UNIT_LABEL,
  fmtDate,
  fmtW,
  knownExercises,
  lastUnitFor,
  loadSeries,
  norm,
  repsSeries,
  sessionsOf,
  setText,
  summaries,
  todayISO,
  unitsOf,
  variation,
} from '../workout/helpers';

type View = 'registrar' | 'historico' | 'evolucao';

const numW = (s: string): number | null => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const numR = (s: string): number | null => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

interface Row {
  weight: string;
  unit: WorkoutUnit;
  reps: string;
}

const blankRow = (unit: WorkoutUnit = 'kg'): Row => ({ weight: '', unit, reps: '' });

function rowsFromSets(sets: WorkoutSet[]): Row[] {
  if (!sets.length) return [blankRow()];
  return sets.map((s) => ({
    weight: s.weight != null ? fmtW(s.weight) : '',
    unit: s.unit ?? 'kg',
    reps: s.reps != null ? String(s.reps) : '',
  }));
}

/* ----------------------------- shared form ------------------------------ */

function EntryForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: WorkoutEntry;
  onSubmit: (e: Omit<WorkoutEntry, 'id'>) => void;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const { entries } = useWorkouts();
  const known = useMemo(() => knownExercises(entries), [entries]);

  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [exercise, setExercise] = useState(initial?.exercise ?? '');
  const [rows, setRows] = useState<Row[]>(rowsFromSets(initial?.sets ?? []));
  const [note, setNote] = useState(initial?.note ?? '');
  const raw = initial?.raw;

  // When the user names a known exercise, default the (still empty) rows to the
  // unit used last time — the small nicety the spec asks for.
  function onExerciseChange(value: string) {
    setExercise(value);
    const u = lastUnitFor(entries, value);
    if (u) {
      setRows((rs) => rs.map((r) => (r.weight === '' && r.reps === '' ? { ...r, unit: u } : r)));
    }
  }

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  const sets: WorkoutSet[] = rows
    .map((r) => {
      const w = numW(r.weight);
      const reps = numR(r.reps);
      return { weight: w, unit: w != null ? r.unit : null, reps };
    })
    .filter((s) => s.weight != null || s.reps != null);

  const canSave = exercise.trim().length > 0 && sets.length > 0;

  function submit() {
    if (!canSave) return;
    onSubmit({ date, exercise: exercise.trim(), sets, note: note.trim(), ...(raw ? { raw } : {}) });
  }

  return (
    <div className="wk-form">
      <datalist id="wk-known">
        {known.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="btn-row" style={{ marginBottom: 10 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: 1 }} />
      </div>

      <label className="field" style={{ marginBottom: 10 }}>
        <input
          type="text"
          list="wk-known"
          value={exercise}
          placeholder="Exercício (ex.: Cadeira abdutora)"
          onChange={(e) => onExerciseChange(e.target.value)}
        />
      </label>

      <div className="wk-sets">
        {rows.map((r, i) => (
          <div className="wk-set-row" key={i}>
            <input
              type="number"
              inputMode="decimal"
              value={r.weight}
              placeholder="carga"
              onChange={(e) => setRow(i, { weight: e.target.value })}
            />
            <select value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value as WorkoutUnit })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="numeric"
              value={r.reps}
              placeholder="reps"
              onChange={(e) => setRow(i, { reps: e.target.value })}
            />
            <button
              className="ghost sm"
              aria-label="Remover série"
              onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        className="ghost sm"
        style={{ marginTop: 2 }}
        onClick={() => setRows((rs) => [...rs, blankRow(rs[rs.length - 1]?.unit)])}
      >
        + série
      </button>

      <label className="field" style={{ margin: '10px 0' }}>
        <input
          type="text"
          value={note}
          placeholder="Observação (opcional) — ex.: morrendo, até a falha"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="btn-row">
        {onCancel && (
          <button className="ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button className="primary" onClick={submit} disabled={!canSave} style={{ flex: 2 }}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Registrar ------------------------------ */

function RegisterView() {
  const { addEntry } = useWorkouts();
  const [savedName, setSavedName] = useState<string | null>(null);
  // Remount the form after each save to reset its fields.
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="card">
      <h2>📝 Registrar treino</h2>
      <p className="sub">Carga, unidade e repetições. O exercício autocompleta e sugere a unidade da última vez.</p>
      <EntryForm
        key={formKey}
        submitLabel="Salvar treino"
        onSubmit={(e) => {
          addEntry(e);
          setSavedName(e.exercise);
          setFormKey((k) => k + 1);
        }}
      />
      {savedName && <p className="wk-saved">✓ {savedName} registrado.</p>}
    </div>
  );
}

/* ------------------------------- Histórico ------------------------------ */

function SetChips({ sets }: { sets: WorkoutSet[] }) {
  return (
    <div className="wk-chips">
      {sets.map((s, i) => (
        <span className="wk-chip" key={i}>
          {setText(s)}
        </span>
      ))}
    </div>
  );
}

function HistoryView() {
  const { entries, updateEntry, removeEntry } = useWorkouts();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const nq = norm(q);
    const list = nq
      ? entries.filter(
          (e) =>
            norm(e.exercise).includes(nq) ||
            norm(e.note).includes(nq) ||
            norm(e.raw ?? '').includes(nq) ||
            e.sets.some((s) => norm(setText(s)).includes(nq)),
        )
      : entries;
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, q]);

  if (entries.length === 0) {
    return (
      <div className="empty">
        <div className="big">🏋️</div>
        <p>Nenhum treino registrado.</p>
        <p className="muted">Use a aba Registrar para começar a acumular histórico.</p>
      </div>
    );
  }

  // Group the filtered list by date (already sorted desc).
  const groups: { date: string; items: WorkoutEntry[] }[] = [];
  for (const e of filtered) {
    const g = groups[groups.length - 1];
    if (g && g.date === e.date) g.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }

  return (
    <>
      <label className="field wk-search">
        <input
          type="text"
          value={q}
          placeholder="Buscar por exercício, carga ou nota…"
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      {groups.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>Nada encontrado.</p>}

      {groups.map((g) => (
        <div className="card" key={g.date}>
          <div className="section-title" style={{ margin: '0 0 8px' }}>
            {fmtDate(g.date)}
          </div>
          {g.items.map((e) =>
            editing === e.id ? (
              <EntryForm
                key={e.id}
                initial={e}
                submitLabel="Salvar alterações"
                onCancel={() => setEditing(null)}
                onSubmit={(patch) => {
                  updateEntry(e.id, patch);
                  setEditing(null);
                }}
              />
            ) : (
              <div className="wk-entry" key={e.id}>
                <div className="wk-entry-head">
                  <strong className="wk-ex">{e.exercise}</strong>
                  <span className="wk-actions">
                    <button className="ghost sm" aria-label="Editar" onClick={() => setEditing(e.id)}>
                      ✏️
                    </button>
                    <button
                      className="ghost sm"
                      aria-label="Apagar"
                      onClick={() => {
                        if (confirm(`Apagar "${e.exercise}" de ${fmtDate(e.date)}?`)) removeEntry(e.id);
                      }}
                    >
                      🗑️
                    </button>
                  </span>
                </div>
                <SetChips sets={e.sets} />
                {e.note && <p className="note" style={{ marginTop: 6 }}>{e.note}</p>}
                {e.raw && <p className="wk-raw">{e.raw}</p>}
              </div>
            ),
          )}
        </div>
      ))}
    </>
  );
}

/* ------------------------------- Evolução ------------------------------- */

function TrendIcon({ t }: { t: Trend }) {
  if (t === 'up') return <span className="wk-trend up" title="Subiu">▲</span>;
  if (t === 'down') return <span className="wk-trend down" title="Caiu">▼</span>;
  if (t === 'flat') return <span className="wk-trend flat" title="Manteve">▬</span>;
  return <span className="wk-trend new" title="Primeira referência">novo</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function ExerciseDetail({ entryKey, onBack }: { entryKey: string; onBack: () => void }) {
  const { entries } = useWorkouts();
  const sessions = useMemo(() => sessionsOf(entries, entryKey), [entries, entryKey]);
  const units = useMemo(() => unitsOf(sessions), [sessions]);
  const [metric, setMetric] = useState<Metric>('load');
  const [unit, setUnit] = useState<WorkoutUnit>(units[0] ?? 'kg');

  if (sessions.length === 0) {
    return (
      <button className="ghost sm" onClick={onBack}>
        ← Voltar
      </button>
    );
  }
  const name = sessions[sessions.length - 1].exercise;
  const activeUnit = units.includes(unit) ? unit : units[0] ?? 'kg';
  const series = metric === 'load' ? loadSeries(sessions, activeUnit) : repsSeries(sessions);
  const unitLabel = metric === 'load' ? UNIT_LABEL[activeUnit] : 'reps';
  const v = variation(series);
  const cur = series.length ? series[series.length - 1].value : null;
  const record = series.length ? Math.max(...series.map((p) => p.value)) : null;

  return (
    <>
      <button className="ghost sm" onClick={onBack} style={{ marginBottom: 6 }}>
        ← Exercícios
      </button>

      <div className="card">
        <h2>{name}</h2>
        <p className="sub">{sessions.length} sessões registradas</p>

        <div className="opt-pills" style={{ marginBottom: 8 }}>
          <button className={'sm' + (metric === 'load' ? ' sel' : '')} onClick={() => setMetric('load')}>
            Carga
          </button>
          <button className={'sm' + (metric === 'reps' ? ' sel' : '')} onClick={() => setMetric('reps')}>
            Repetições
          </button>
        </div>

        {metric === 'load' && units.length > 1 && (
          <div className="opt-pills" style={{ marginBottom: 8 }}>
            {units.map((u) => (
              <button
                key={u}
                className={'sm' + (activeUnit === u ? ' sel' : '')}
                onClick={() => setUnit(u)}
              >
                {UNIT_LABEL[u]}
              </button>
            ))}
          </div>
        )}

        {metric === 'load' && units.length === 0 ? (
          <p className="muted">Sem carga registrada — veja Repetições.</p>
        ) : series.length === 0 ? (
          <p className="muted">Sem dados para esta métrica.</p>
        ) : (
          <>
            <Chart points={series} unit={unitLabel} color={metric === 'load' ? 'var(--brand)' : '#3a8ee6'} />
            <div className="totals" style={{ marginTop: 10 }}>
              {cur != null && <Metric label="Atual" value={`${fmtW(cur)} ${unitLabel}`} />}
              {record != null && <Metric label="Recorde" value={`${fmtW(record)} ${unitLabel}`} />}
              {v && (
                <Metric
                  label="Desde o início"
                  value={`${v.delta > 0 ? '+' : ''}${fmtW(v.delta)} ${unitLabel} (${v.pct > 0 ? '+' : ''}${v.pct}%)`}
                />
              )}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="section-title" style={{ margin: '0 0 8px' }}>
          Sessões
        </div>
        {[...sessions].reverse().map((e) => (
          <div className="wk-entry" key={e.id}>
            <div className="wk-entry-head">
              <strong className="wk-ex">{fmtDate(e.date)}</strong>
            </div>
            <SetChips sets={e.sets} />
            {e.note && <p className="note" style={{ marginTop: 6 }}>{e.note}</p>}
          </div>
        ))}
      </div>
    </>
  );
}

function EvolutionView() {
  const { entries } = useWorkouts();
  const rows = useMemo(() => summaries(entries), [entries]);
  const [selected, setSelected] = useState<string | null>(null);

  if (selected) return <ExerciseDetail entryKey={selected} onBack={() => setSelected(null)} />;

  if (entries.length === 0) {
    return (
      <div className="empty">
        <div className="big">📈</div>
        <p>Sem evolução ainda.</p>
        <p className="muted">Registre o mesmo exercício mais de uma vez para ver a tendência.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>📈 Evolução</h2>
      <p className="sub">Toque num exercício para ver o gráfico ao longo do tempo.</p>
      <div className="wk-ex-list">
        {rows.map((r) => (
          <button className="wk-ex-row" key={r.key} onClick={() => setSelected(r.key)}>
            <span className="wk-ex-name">
              {r.name}
              <span className="wk-ex-sub">
                {r.sessions} {r.sessions === 1 ? 'sessão' : 'sessões'} · {fmtDate(r.lastDate)}
              </span>
            </span>
            <span className="wk-ex-right">
              <span className="wk-ex-load">{r.lastText}</span>
              <TrendIcon t={r.trend} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- shell -------------------------------- */

export default function Workout() {
  const { ready, entries, clearAll } = useWorkouts();
  const [view, setView] = useState<View>('registrar');

  if (!ready) return <div className="boot">Carregando…</div>;

  return (
    <>
      <div className="wk-seg">
        <button className={view === 'registrar' ? 'sel' : ''} onClick={() => setView('registrar')}>
          Registrar
        </button>
        <button className={view === 'historico' ? 'sel' : ''} onClick={() => setView('historico')}>
          Histórico
        </button>
        <button className={view === 'evolucao' ? 'sel' : ''} onClick={() => setView('evolucao')}>
          Evolução
        </button>
      </div>

      {view === 'registrar' && <RegisterView />}
      {view === 'historico' && <HistoryView />}
      {view === 'evolucao' && <EvolutionView />}

      {entries.length > 0 && (
        <button
          className="ghost sm wk-clear"
          onClick={() => {
            if (confirm(`Apagar todos os ${entries.length} treinos? Não dá pra desfazer.`)) clearAll();
          }}
        >
          Apagar todos os treinos
        </button>
      )}
    </>
  );
}
