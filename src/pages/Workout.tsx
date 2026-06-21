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

type View = 'programa' | 'registrar' | 'historico' | 'evolucao';

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
  startExercise,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: WorkoutEntry;
  startExercise?: string;
  onSubmit: (e: Omit<WorkoutEntry, 'id'>) => void;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const { entries, plan } = useWorkouts();
  // Autocomplete from both the program (so prescribed names appear before being
  // logged) and past sessions.
  const known = useMemo(() => {
    const fromPlan = (plan?.days ?? []).flatMap((d) => d.exercises);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of [...fromPlan, ...knownExercises(entries)]) {
      const k = norm(name);
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(name);
      }
    }
    return out;
  }, [entries, plan]);

  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [exercise, setExercise] = useState(initial?.exercise ?? startExercise ?? '');
  const [rows, setRows] = useState<Row[]>(() => {
    if (initial?.sets?.length) return rowsFromSets(initial.sets);
    if (startExercise) return [blankRow(lastUnitFor(entries, startExercise) ?? 'kg')];
    return [blankRow()];
  });
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

function RegisterView({ startExercise, resetKey = 0 }: { startExercise?: string; resetKey?: number }) {
  const { addEntry } = useWorkouts();
  const [savedName, setSavedName] = useState<string | null>(null);
  // Remount the form after each save (clear) and when an external prefill arrives.
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="card">
      <h2>Registrar treino</h2>
      <p className="sub">Carga, unidade e repetições. O exercício autocompleta e sugere a unidade da última vez.</p>
      <EntryForm
        key={`${resetKey}-${formKey}`}
        startExercise={startExercise}
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
      <h2>Evolução</h2>
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

/* ------------------------------- Programa ------------------------------- */

function AddExercise({ onAdd }: { onAdd: (name: string) => void }) {
  const [v, setV] = useState('');
  const commit = () => {
    if (v.trim()) {
      onAdd(v.trim());
      setV('');
    }
  };
  return (
    <div className="wk-set-row" style={{ marginTop: 10 }}>
      <input
        type="text"
        value={v}
        placeholder="+ exercício"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        style={{ flex: 1 }}
      />
      <button className="sm" disabled={!v.trim()} onClick={commit}>
        Add
      </button>
    </div>
  );
}

function ProgramaView({ onLog }: { onLog: (name: string) => void }) {
  const { plan, addDay, removeDay, addExercise, removeExercise } = useWorkouts();
  const [edit, setEdit] = useState(false);
  const days = plan?.days ?? [];

  if (days.length === 0) {
    return (
      <div className="empty">
        <div className="big">🗂️</div>
        <p>Sem programa ainda.</p>
        <p className="muted">Importe seu treino pelo menu ••• → Importar, ou monte aqui mesmo.</p>
        <button className="primary" style={{ marginTop: 16 }} onClick={addDay}>
          Criar dia A
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="wk-prog-head">
        <p className="sub" style={{ margin: 0 }}>
          {edit ? 'Edite os dias e exercícios.' : 'Toque num exercício para registrar.'}
        </p>
        <button className="ghost sm" onClick={() => setEdit((v) => !v)}>
          {edit ? 'Concluir' : 'Editar'}
        </button>
      </div>

      {days.map((d) => (
        <div className="card wk-day" key={d.id}>
          <div className="wk-day-head">
            <span className="wk-day-badge">{d.label}</span>
            <span className="wk-day-name">{d.name || 'Treino'}</span>
            {edit && (
              <button
                className="ghost sm"
                onClick={() => confirm(`Apagar o dia ${d.label}?`) && removeDay(d.id)}
              >
                Apagar
              </button>
            )}
          </div>

          <div className="wk-prog-list">
            {d.exercises.map((ex, i) => (
              <div className="wk-prog-row" key={i}>
                <button className="wk-prog-ex" onClick={() => onLog(ex)}>
                  <span>{ex}</span>
                  <span className="wk-prog-go" aria-hidden>registrar →</span>
                </button>
                {edit && (
                  <button className="ghost sm" aria-label="Remover exercício" onClick={() => removeExercise(d.id, i)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {d.exercises.length === 0 && !edit && <p className="muted" style={{ fontSize: '0.85rem' }}>Sem exercícios.</p>}
          </div>

          {edit && <AddExercise onAdd={(name) => addExercise(d.id, name)} />}
        </div>
      ))}

      {edit && (
        <button className="ghost sm wk-clear" onClick={addDay}>
          + adicionar dia
        </button>
      )}
    </>
  );
}

/* --------------------------------- shell -------------------------------- */

export default function Workout() {
  const { ready, entries, plan, clearAll } = useWorkouts();
  const [view, setView] = useState<View>(plan && entries.length === 0 ? 'programa' : 'registrar');
  const [prefill, setPrefill] = useState<string | undefined>();
  const [prefillKey, setPrefillKey] = useState(0);

  if (!ready) return <div className="boot">Carregando…</div>;

  function logExercise(name: string) {
    setPrefill(name);
    setPrefillKey((k) => k + 1);
    setView('registrar');
  }

  function openRegistrar() {
    setPrefill(undefined);
    setPrefillKey((k) => k + 1);
    setView('registrar');
  }

  return (
    <>
      <div className="wk-seg">
        <button className={view === 'programa' ? 'sel' : ''} onClick={() => setView('programa')}>
          Programa
        </button>
        <button className={view === 'registrar' ? 'sel' : ''} onClick={openRegistrar}>
          Registrar
        </button>
        <button className={view === 'historico' ? 'sel' : ''} onClick={() => setView('historico')}>
          Histórico
        </button>
        <button className={view === 'evolucao' ? 'sel' : ''} onClick={() => setView('evolucao')}>
          Evolução
        </button>
      </div>

      {view === 'programa' && <ProgramaView onLog={logExercise} />}
      {view === 'registrar' && <RegisterView startExercise={prefill} resetKey={prefillKey} />}
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
