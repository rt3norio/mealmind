import { SAMPLE_DOC } from './sample';
import { UNITS } from './types';

const SAMPLE_JSON = JSON.stringify(SAMPLE_DOC, null, 2);

/**
 * A self-contained, LLM-ready prompt. A nutritionist can paste this whole text
 * into ChatGPT/Claude/Gemini, describe the patient's plan in plain language, and
 * get back a file that imports cleanly into MealMind.
 */
export const LLM_PROMPT = `Você é um assistente que gera o arquivo JSON do app "MealMind".
O mesmo arquivo pode conter a DIETA (plano alimentar) e/ou o TREINO (musculação).
Gere SOMENTE o JSON final, sem comentários e sem texto antes ou depois.

REGRAS DO FORMATO
- O documento é um único objeto JSON.
- Campo obrigatório: "schemaVersion" deve ser exatamente "1.0".
- O arquivo deve ter pelo menos UM destes: a dieta ("plan") ou o treino
  ("workoutPlan" e/ou "workouts"). Pode ter só dieta, só treino, ou os dois.

DIETA ("plan") — inclua se o usuário pediu plano alimentar:
- "plan" é um objeto contendo "meals" (lista de refeições).
- Cada refeição em "meals" tem:
  - "id": identificador único, só minúsculas/números/hífen. Ex.: "cafe-da-manha".
  - "name": nome exibido. Ex.: "Café da manhã".
  - "time": horário no formato 24h "HH:MM". Ex.: "07:30".
  - "items": lista de alimentos. Cada alimento tem:
    - "food": nome do alimento (texto).
    - "quantity": número maior que zero.
    - "unit": uma destas unidades EXATAS: ${UNITS.join(', ')}.
    - opcionais e recomendados: "calories", "protein_g", "carbs_g", "fat_g" (números).
    - opcionais: "alternatives" (texto), "notes" (texto).
  - opcional: "notes" (texto) na refeição.
  - opcional "alternatives": lista de versões substitutas da refeição. Cada uma tem
    "name" (texto, opcional, ex.: "Opção 2") e "items" (mesma estrutura dos items acima).
- Opcional "plan.goals": metas diárias com números: "calories", "protein_g", "carbs_g", "fat_g", "water_ml".
- Opcional "plan.supplements": lista de { "name", "dose", "time"?, "notes"? }.
- Opcional "plan.restrictions": lista de textos. Ex.: ["Sem lactose"].
- Opcional "plan.recommendations": lista de textos com orientações gerais.
- Opcional "plan.startDate" e "plan.endDate": datas "AAAA-MM-DD".
- Opcional "patient": { "name", "notes"? }.
- Opcional "professional": { "name", "registration"?, "contact"? }.
- NÃO inclua a seção "logs"; o app cria e gerencia o histórico do paciente.

TREINO (opcional) — inclua se o usuário pediu treino de musculação. Duas seções
no nível raiz do documento (irmãs de "plan"):
- "workoutPlan": o programa/rotina (ex.: split A/B/C). Objeto com "days" (lista).
  Cada dia tem:
  - "label": marcador curto. Ex.: "A".
  - "name": foco do dia. Ex.: "Empurrar".
  - "exercises": lista de nomes de exercícios (textos). Ex.: ["Supino", "Tríceps polia"].
- "workouts": histórico de sessões já feitas (opcional; só se o usuário informou
  cargas). Lista de objetos, cada um:
  - "date": "AAAA-MM-DD".
  - "exercise": nome do exercício (texto).
  - "sets": lista de séries. Cada série tem "weight" (número, ou null se for só
    peso do corpo), "unit" (uma destas EXATAS: placa, kg, kg/lado) e "reps"
    (número, ou null).
  - opcional: "note" (texto).
- Use "workoutPlan" para a rotina e "workouts" para o histórico — são independentes.

CUIDADOS
- Números nunca entre aspas (use 120, não "120").
- Use vírgulas corretamente e NÃO deixe vírgula sobrando antes de } ou ].
- Use aspas duplas em todas as chaves e textos.
- Some os macros por alimento quando souber; isso permite o app mostrar o progresso do dia.

EXEMPLO COMPLETO E VÁLIDO (copie a estrutura, troque o conteúdo):
${SAMPLE_JSON}

Agora gere o JSON para o seguinte plano:
<descreva aqui o plano do paciente: refeições, horários, quantidades, metas, restrições>`;

/** Short field reference rendered as cards in the Help page. */
export const FIELD_REFERENCE: { name: string; required: boolean; desc: string }[] = [
  { name: 'schemaVersion', required: true, desc: 'Sempre "1.0".' },
  { name: 'plan.meals[]', required: true, desc: 'Lista de refeições com id, name, time, items.' },
  { name: 'meals[].time', required: true, desc: 'Horário 24h "HH:MM", ex.: "12:30".' },
  { name: 'items[].food / quantity / unit', required: true, desc: `Alimento, número > 0 e unidade (${UNITS.slice(0, 6).join(', ')}…).` },
  { name: 'items[].calories / protein_g …', required: false, desc: 'Macros opcionais, mas habilitam o progresso diário.' },
  { name: 'meals[].alternatives', required: false, desc: 'Versões substitutas da refeição: { name?, items[] }.' },
  { name: 'plan.goals', required: false, desc: 'Metas diárias de calorias, macros e água.' },
  { name: 'plan.supplements', required: false, desc: 'name, dose, time?, notes?.' },
  { name: 'plan.restrictions / recommendations', required: false, desc: 'Listas de texto.' },
  { name: 'patient / professional', required: false, desc: 'Identificação opcional do plano.' },
  { name: 'workoutPlan.days[]', required: false, desc: 'Programa de treino (split A/B/C): cada dia com label, name e exercises[] (nomes).' },
  { name: 'workouts[]', required: false, desc: 'Sessões registradas: date, exercise e sets[] (weight, unit placa|kg|kg/lado, reps).' },
];

export { SAMPLE_JSON };
