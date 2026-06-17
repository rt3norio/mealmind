import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { chat, DEFAULT_MODEL, type ChatMsg } from '../lib/openrouter';
import type { NutritionDoc } from '../data/types';
import {
  consumedTotals,
  extrasForDate,
  goalsAsTotals,
  mealConsumed,
  mealLog,
  round,
  todayKey,
  waterForDate,
} from '../data/nutrition';

/** Build a compact snapshot of the plan + today's tracking for the model. */
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

  lines.push('\nPlano (refeições e horários):');
  for (const m of [...doc.plan.meals].sort((a, b) => a.time.localeCompare(b.time))) {
    const t = mealConsumed(m, { status: 'eaten' });
    const alts = (m.alternatives ?? []).map((a, i) => a.name ?? `Opção ${i + 2}`);
    lines.push(
      `- ${m.time} ${m.name}: ${round(t.calories)} kcal, ${round(t.protein_g)} g prot` +
        (alts.length ? ` | alternativas: ${alts.join('; ')}` : ''),
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

const SYSTEM = `Você é o coach nutricional do app MealMind. Responda em português, curto e prático (no máximo uns 4 parágrafos curtos ou uma lista).
Use SOMENTE os dados do plano e do dia do usuário fornecidos abaixo. Não invente números; se faltar um dado, diga que falta.
Pode sugerir trocas usando as alternativas do plano e ajudar a bater as metas (proteína é prioridade). Não dê conselho médico além do plano.`;

const SUGGESTIONS = [
  'Bati a proteína hoje?',
  'O que como agora?',
  'Sugira uma troca mais leve',
  'Quanto de água ainda falta?',
];

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export default function Coach() {
  const { doc, settings } = useStore();
  const [turns, setTurns] = useState<Turn[]>([]);
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
    try {
      const context = buildContext(doc);
      const messages: ChatMsg[] = [
        { role: 'system', content: `${SYSTEM}\n\n--- DADOS DO USUÁRIO ---\n${context}` },
        ...next.slice(-8).map((t) => ({ role: t.role, content: t.content })),
      ];
      const answer = await chat(key, model, messages);
      setTurns((prev) => [...prev, { role: 'assistant', content: answer }]);
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
        <h2>💬 Coach</h2>
        <p className="sub" style={{ marginBottom: 0 }}>
          Lê seu plano e seu dia. Modelo: <code>{model}</code>. Cobrado no seu crédito OpenRouter.
          As mensagens passam pelo OpenRouter.
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
            {t.content}
          </div>
        ))}
        {busy && <div className="bubble assistant muted">…</div>}
        {error && <div className="issue error">{error}</div>}
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={input}
          placeholder="Pergunte ao coach…"
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
