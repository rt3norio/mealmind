import { SAMPLE_DOC } from './sample';
import { UNITS } from './types';

const SAMPLE_JSON = JSON.stringify(SAMPLE_DOC, null, 2);

/**
 * A self-contained, LLM-ready prompt. A nutritionist can paste this whole text
 * into ChatGPT/Claude/Gemini, describe the patient's plan in plain language, and
 * get back a file that imports cleanly into app-nutrition.
 */
export const LLM_PROMPT = `Você é um assistente que gera o arquivo JSON de prescrição do app "app-nutrition".
Gere SOMENTE o JSON final, sem comentários e sem texto antes ou depois.

REGRAS DO FORMATO
- O documento é um único objeto JSON.
- Campo obrigatório: "schemaVersion" deve ser exatamente "1.0".
- Campo obrigatório: "plan", um objeto contendo "meals" (lista de refeições).
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
- Opcional "plan.goals": metas diárias com números: "calories", "protein_g", "carbs_g", "fat_g", "water_ml".
- Opcional "plan.supplements": lista de { "name", "dose", "time"?, "notes"? }.
- Opcional "plan.restrictions": lista de textos. Ex.: ["Sem lactose"].
- Opcional "plan.recommendations": lista de textos com orientações gerais.
- Opcional "plan.startDate" e "plan.endDate": datas "AAAA-MM-DD".
- Opcional "patient": { "name", "notes"? }.
- Opcional "professional": { "name", "registration"?, "contact"? }.
- NÃO inclua a seção "logs"; o app cria e gerencia o histórico do paciente.

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
  { name: 'plan.goals', required: false, desc: 'Metas diárias de calorias, macros e água.' },
  { name: 'plan.supplements', required: false, desc: 'name, dose, time?, notes?.' },
  { name: 'plan.restrictions / recommendations', required: false, desc: 'Listas de texto.' },
  { name: 'patient / professional', required: false, desc: 'Identificação opcional do plano.' },
];

export { SAMPLE_JSON };
