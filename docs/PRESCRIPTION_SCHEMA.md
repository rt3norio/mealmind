# Formato da prescrição (JSON) — MealMind

Este documento descreve, em linguagem simples, o arquivo JSON que o app importa.
Ele foi escrito para que **um nutricionista** consiga gerá-lo — à mão ou pedindo a
uma IA (ChatGPT, Claude, Gemini). O app valida o arquivo na importação e explica
qualquer problema.

> Atalho: na aba **Ajuda** do app há um botão **"Copiar prompt para IA"** com o
> texto pronto. Cole na IA, descreva o plano do paciente e o arquivo sai pronto.

## Estrutura

O documento é **um único objeto JSON**. Ele pode trazer a **dieta** (`plan`), o
**treino** (`workoutPlan` e/ou `workouts`), ou os dois — basta ter pelo menos um.

| Campo | Obrigatório | Descrição |
|-------|:-----------:|-----------|
| `schemaVersion` | ✅ | Sempre a string `"1.0"`. |
| `plan` | ✱ | Objeto com a dieta (contém `meals`). Obrigatório **se** o arquivo tem dieta. |
| `plan.meals` | ✱ | Lista de refeições (ver abaixo). |
| `plan.goals` | — | Metas diárias: `calories`, `protein_g`, `carbs_g`, `fat_g`, `water_ml` (números). |
| `plan.supplements` | — | Lista de `{ name, dose, time?, notes? }`. |
| `plan.restrictions` | — | Lista de textos, ex.: `["Sem lactose"]`. |
| `plan.recommendations` | — | Lista de textos com orientações gerais. |
| `plan.startDate` / `plan.endDate` | — | Datas `"AAAA-MM-DD"`. |
| `workoutPlan` | — | Programa de treino (split A/B/C). Ver **Treino** abaixo. |
| `workouts` | — | Histórico de sessões de treino. Ver **Treino** abaixo. |
| `patient` | — | `{ name, notes? }`. |
| `professional` | — | `{ name, registration?, contact? }`. |
| `createdAt` | — | Data/hora ISO da emissão. |

> ✱ = obrigatório só quando o arquivo inclui a dieta. Um arquivo de **só treino**
> não precisa de `plan`.

> **Não** inclua a seção `logs`. O app cria e gerencia o histórico do paciente.

### Refeição (`plan.meals[]`)

| Campo | Obrigatório | Descrição |
|-------|:-----------:|-----------|
| `id` | ✅ | Identificador único: minúsculas, números e hífen. Ex.: `"cafe-da-manha"`. |
| `name` | ✅ | Nome exibido. Ex.: `"Café da manhã"`. |
| `time` | ✅ | Horário 24h `"HH:MM"`. Ex.: `"07:30"`. |
| `items` | ✅ | Lista de alimentos. |
| `notes` | — | Observação da refeição. |

### Alimento (`items[]`)

| Campo | Obrigatório | Descrição |
|-------|:-----------:|-----------|
| `food` | ✅ | Nome do alimento. |
| `quantity` | ✅ | Número **maior que zero**. |
| `unit` | ✅ | Uma de: `g`, `ml`, `kcal`, `unidade`, `fatia`, `colher_sopa`, `colher_cha`, `xicara`, `copo`, `concha`, `porcao`. |
| `calories`, `protein_g`, `carbs_g`, `fat_g` | — | Macros (números). Recomendado — habilitam o progresso diário. |
| `alternatives` | — | Texto com substituições. Ex.: `"ou 2 fatias de pão"`. |
| `notes` | — | Observação do alimento. |

## Treino (opcional)

Duas seções no nível raiz, irmãs de `plan`. Inclua só se o arquivo tem treino.

### Programa (`workoutPlan`)

A rotina — por exemplo um split A/B/C. Objeto com uma lista `days`.

| Campo | Obrigatório | Descrição |
|-------|:-----------:|-----------|
| `workoutPlan.days[]` | ✅ | Lista de dias. |
| `days[].label` | — | Marcador curto. Ex.: `"A"`. |
| `days[].name` | — | Foco do dia. Ex.: `"Empurrar"`. |
| `days[].exercises` | ✅ | Lista de nomes de exercícios (textos). |

### Histórico de sessões (`workouts`)

As sessões já feitas, com cargas. Lista de objetos.

| Campo | Obrigatório | Descrição |
|-------|:-----------:|-----------|
| `date` | ✅ | Data `"AAAA-MM-DD"`. |
| `exercise` | ✅ | Nome do exercício. |
| `sets` | ✅ | Lista de séries. |
| `sets[].weight` | — | Carga (número), ou `null` se for peso do corpo. |
| `sets[].unit` | — | Uma de: `placa`, `kg`, `kg/lado`. |
| `sets[].reps` | — | Repetições (número) ou `null`. |
| `note` | — | Observação da sessão. |

```json
{
  "schemaVersion": "1.0",
  "workoutPlan": {
    "days": [
      { "label": "A", "name": "Empurrar", "exercises": ["Supino", "Tríceps polia"] },
      { "label": "B", "name": "Puxar", "exercises": ["Puxada alta", "Remada baixa"] }
    ]
  },
  "workouts": [
    { "date": "2026-01-03", "exercise": "Supino", "sets": [ { "weight": 40, "unit": "kg", "reps": 10 } ] }
  ]
}
```

## Regras que evitam erro

- Números **nunca** entre aspas: use `120`, não `"120"`.
- Use **aspas duplas** em todas as chaves e textos.
- **Não** deixe vírgula sobrando antes de `}` ou `]`.
- `unit` precisa ser exatamente uma das opções da tabela.
- Cada `id` de refeição deve ser único.

## Exemplo mínimo

```json
{
  "schemaVersion": "1.0",
  "plan": {
    "meals": [
      {
        "id": "cafe-da-manha",
        "name": "Café da manhã",
        "time": "07:30",
        "items": [
          { "food": "Ovos mexidos", "quantity": 2, "unit": "unidade", "calories": 140, "protein_g": 12 }
        ]
      }
    ]
  }
}
```

Um exemplo completo (com metas, suplementos e várias refeições) está disponível na
aba **Ajuda** do app, no botão **"Copiar exemplo"**.
