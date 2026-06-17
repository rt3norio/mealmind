import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import Markdown from '../components/Markdown';
import { complete, DEFAULT_MODEL, type AnyMessage } from '../lib/openrouter';
import type { ExtraEntry, NutritionDoc } from '../data/types';
import {
  consumedTotals,
  extrasForDate,
  goalsAsTotals,
  mealConsumed,
  mealLog,
  round,
  todayKey,
  waterForDate,
  withExtra,
  withMealLog,
  withWater,
} from '../data/nutrition';

/** Compact snapshot of the plan + today's tracking for the model. */
function buildContext(doc: NutritionDoc): string {
  const date = todayKey();
  const goals = goalsAsTotals(doc.plan.goals);
  const consumed = consumedTotals(doc, date);
  const waterGoal = doc.plan.goals?.water_ml ?? 0;
  const water = waterForDate(doc, date);

  const lines: string[] = [];
  lines.push(`Data de hoje: ${date}.`);
  if (doc.patient?.name) lines.push(`Paciente: ${doc.patient.name}.`);
  lines.push(
    `Metas diárias: ${goals.calories} kcal, ${goals.protein_g} g proteína, ` +
      `${goals.carbs_g} g carbo, ${goals.fat_g} g gordura` +
      (waterGoal ? `, ${waterGoal} ml água.` : '.'),
  );

  lines.push('\nPlano (use o id em mark_meal):');
  for (const m of [...doc.plan.meals].sort((a, b) => a.time.localeCompare(b.time))) {
    const t = mealConsumed(m, { status: 'eaten' });
    const alts = (m.alternatives ?? []).map((a, i) => `${i + 1}=${a.name ?? `Opção ${i + 2}`}`);
    lines.push(
      `- id:${m.id} | ${m.time} ${m.name}: ${round(t.calories)} kcal, ${round(t.protein_g)} g prot` +
        (alts.length ? ` | opções: ${alts.join('; ')}` : ''),
    );
  }

  lines.push('\nHoje até agora:');
  lines.push(
    `Consumido: ${round(consumed.calories)} kcal, ${round(consumed.protein_g)} g prot, ` +
      `${round(consumed.carbs_g)} g carbo, ${round(consumed.fat_g)} g gordura. ` +
      `Água: ${water}${waterGoal ? `/${waterGoal}` : ''} ml.`,
  );
  for (const m of doc.plan.meals) {
    const log = mealLog(doc, date, m.id);
    if (!log) continue;
    const opt = log.option ? ` (${(m.alternatives ?? [])[log.option - 1]?.name ?? `opção ${log.option}`})` : '';
    const label = log.status === 'eaten' ? 'comeu' : log.status === 'partial' ? 'parcial' : 'pulou';
    lines.push(`- ${m.name}: ${label}${opt}.`);
  }
  const extras = extrasForDate(doc, date);
  if (extras.length) {
    lines.push('Avulsos: ' + extras.map((e) => `${e.food} (${round(e.calories ?? 0)} kcal)`).join(', ') + '.');
  }
  return lines.join('\n');
}

const SYSTEM = `Você é o coach nutricional do app MealMind. Responda em português, curto e prático.
Use SOMENTE os dados do plano e do dia do usuário fornecidos. Não invente números; se faltar dado, diga.

Você é AGÊNTICO: quando o usuário pedir para registrar/marcar algo (ou disser que comeu/bebeu algo), USE as ferramentas em vez de só descrever:
- mark_meal(meal_id, status, option?) — marca uma refeição do plano. status: eaten|partial|skipped. option: 0=base, 1=primeira alternativa, 2=segunda, etc.
- add_water(ml) — registra água bebida.
- add_extra(food, calories?, protein_g?, carbs_g?, fat_g?) — registra um alimento fora do plano.
Estime as calorias/macros de avulsos quando o usuário não informar. Depois de agir, confirme em uma frase curta. Proteína é prioridade. Não dê conselho médico além do plano.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'mark_meal',
      description: 'Marca uma refeição do plano como comida, parcial ou pulada (dia de hoje).',
      parameters: {
        type: 'object',
        properties: {
          meal_id: { type: 'string', description: 'id da refeição no plano' },
          status: { type: 'string', enum: ['eaten', 'partial', 'skipped'] },
          option: { type: 'integer', description: '0=base, 1=primeira alternativa, 2=segunda…' },
        },
        required: ['meal_id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_water',
      description: 'Registra água bebida em ml (hoje). Use valores positivos.',
      parameters: {
        type: 'object',
        properties: { ml: { type: 'integer' } },
        required: ['ml'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_extra',
      description: 'Registra um alimento avulso fora do plano (hoje), com calorias/macros estimados.',
      parameters: {
        type: 'object',
        properties: {
          food: { type: 'string' },
          calories: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
        },
        required: ['food'],
      },
    },
  },
];

const SUGGESTIONS = [
  'Bati a proteína hoje?',
  'Comi o café da manhã',
  'Bebi 500 ml de água',
  'Comi uma bala de 30 kcal',
];

const numOpt = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export default function Coach() {
  const { doc, settings, replaceDoc, coachTurns: turns, setCoachTurns: setTurns } = useStore();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const key = settings.openrouterKey;
  const model = settings.openrouterModel || DEFAULT_MODEL;

  if (!key) {
    return (
      <div className="empty">
        <div className="big">💬</div>
        <p>Coach desconectado.</p>
        <p className="muted">
          Conecte sua conta OpenRouter em <Link to="/config" className="inline">Config</Link> para
          conversar com o coach usando seus próprios créditos.
        </p>
      </div>
    );
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy || !key) return;
    setError(null);
    const next = [...turns, { role: 'user' as const, content: q }];
    setTurns(next);
    setInput('');
    setBusy(true);

    const convo: AnyMessage[] = [
      { role: 'system', content: `${SYSTEM}\n\n--- DADOS DO USUÁRIO ---\n${buildContext(doc)}` },
      ...next.slice(-8).map((t) => ({ role: t.role, content: t.content })),
    ];

    let working = doc;
    const actions: string[] = [];
    let finalText = '';

    try {
      for (let i = 0; i < 5; i++) {
        const msg = await complete(key, model, convo, TOOLS);
        convo.push(msg as AnyMessage);
        const calls = msg.tool_calls ?? [];
        if (calls.length === 0) {
          finalText = msg.content ?? '';
          break;
        }
        for (const tc of calls) {
          let a: Record<string, unknown> = {};
          try {
            a = JSON.parse(tc.function.arguments || '{}');
          } catch {
            /* ignore bad json */
          }
          let label = '⚠️ ação inválida';
          let result = 'erro';
          const name = tc.function.name;
          if (name === 'mark_meal') {
            const m = working.plan.meals.find((x) => x.id === a.meal_id);
            const status = a.status as 'eaten' | 'partial' | 'skipped';
            if (!m) {
              result = `meal_id "${String(a.meal_id)}" não existe`;
              label = '⚠️ refeição não encontrada';
            } else {
              const option = typeof a.option === 'number' && a.option > 0 ? a.option : undefined;
              working = withMealLog(working, m.id, status, todayKey(), new Date().toISOString(), undefined, option);
              const optn = option ? ` (${(m.alternatives ?? [])[option - 1]?.name ?? `opção ${option}`})` : '';
              const st = status === 'eaten' ? 'comeu' : status === 'partial' ? 'parcial' : 'pulou';
              label = `✓ ${m.name}: ${st}${optn}`;
              result = `ok: ${m.name} = ${status}`;
            }
          } else if (name === 'add_water') {
            const ml = Math.round(Number(a.ml) || 0);
            if (!ml) {
              result = 'ml inválido';
              label = '⚠️ água inválida';
            } else {
              working = withWater(working, ml, todayKey());
              label = `💧 ${ml > 0 ? '+' : ''}${ml} ml de água`;
              result = `ok: ${ml} ml`;
            }
          } else if (name === 'add_extra') {
            const food = String(a.food ?? '').trim();
            if (!food) {
              result = 'food vazio';
              label = '⚠️ avulso sem nome';
            } else {
              const entry: ExtraEntry = {
                food,
                calories: numOpt(a.calories),
                protein_g: numOpt(a.protein_g),
                carbs_g: numOpt(a.carbs_g),
                fat_g: numOpt(a.fat_g),
                id: crypto.randomUUID(),
                date: todayKey(),
                loggedAt: new Date().toISOString(),
              };
              working = withExtra(working, entry);
              label = `➕ ${food}${entry.calories != null ? ` (${entry.calories} kcal)` : ''}`;
              result = `ok: ${food}`;
            }
          }
          actions.push(label);
          convo.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }
      }

      if (working !== doc) replaceDoc(working);
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', content: finalText, actions: actions.length ? actions : undefined },
      ]);
      requestAnimationFrame(() => listRef.current?.scrollTo(0, listRef.current.scrollHeight));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="coach">
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="meal-head">
          <h2 style={{ flex: 1 }}>💬 Coach</h2>
          {turns.length > 0 && (
            <button className="ghost sm" onClick={() => setTurns([])} disabled={busy}>
              Limpar
            </button>
          )}
        </div>
        <p className="sub" style={{ marginBottom: 0 }}>
          Lê seu plano e seu dia, e pode <strong>marcar refeições, água e avulsos</strong> por você.
          Modelo: <code>{model}</code>. Cobrado no seu crédito OpenRouter (as mensagens passam por lá).
        </p>
      </div>

      <div className="chat-list" ref={listRef}>
        {turns.length === 0 && (
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="sm" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={'bubble ' + t.role}>
            {t.role === 'assistant' ? <Markdown text={t.content} /> : t.content}
            {t.actions && (
              <div className="actions-done">
                {t.actions.map((a, j) => (
                  <span key={j} className="action-chip">{a}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="bubble assistant muted">…</div>}
        {error && <div className="issue error">{error}</div>}
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={input}
          placeholder="Fale com o coach…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          disabled={busy}
        />
        <button className="primary" onClick={() => send(input)} disabled={busy || !input.trim()}>
          Enviar
        </button>
      </div>
    </div>
  );
}
