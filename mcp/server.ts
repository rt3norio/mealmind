#!/usr/bin/env -S npx -y tsx
// MCP server for app-nutrition.
//
// Exposes the SAME schema text and validator the web app uses (imported directly
// from ../src — no logic is duplicated here), so an AI assistant can generate a
// diet-plan JSON, validate it, and hand it to the user for a 2-tap import.
//
// Run: npx -y tsx mcp/server.ts   (stdio transport)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { LLM_PROMPT, SAMPLE_JSON } from '../src/data/schemaDoc';
import { parseAndValidate, type ValidationIssue } from '../src/data/validator';

const server = new McpServer({ name: 'app-nutrition', version: '1.0.0' });

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });

server.tool(
  'get_schema',
  'Retorna a especificação completa (LLM-ready) do JSON de prescrição do ' +
    'app-nutrition: regras do formato, unidades válidas e um exemplo completo. ' +
    'Chame isto antes de gerar um plano.',
  async () => text(LLM_PROMPT),
);

server.tool(
  'create_plan_template',
  'Retorna um plano alimentar de exemplo, já válido, para usar como ponto de ' +
    'partida e então editar com os dados reais do paciente.',
  async () => text(SAMPLE_JSON),
);

function formatIssues(label: string, issues: ValidationIssue[]): string {
  if (issues.length === 0) return '';
  const lines = issues.map(
    (i) => `  - [${i.path}] ${i.message}${i.hint ? ` — ${i.hint}` : ''}`,
  );
  return `${label}:\n${lines.join('\n')}\n`;
}

server.tool(
  'validate_plan',
  'Valida um JSON de prescrição contra o schema do app-nutrition (mesmo ' +
    'validador da aba Dados). Use repetidamente até "valid": true antes de ' +
    'entregar o JSON ao usuário.',
  { json: z.string().describe('O conteúdo JSON do plano a validar.') },
  async ({ json }) => {
    const { result } = parseAndValidate(json);
    const header = result.valid
      ? result.perfect
        ? '✅ VÁLIDO e completo. Pronto para o usuário importar.'
        : '✅ VÁLIDO (com avisos).'
      : '❌ INVÁLIDO. Corrija os erros abaixo e valide de novo.';
    const body =
      formatIssues('Erros', result.errors) + formatIssues('Avisos', result.warnings);
    const summary = JSON.stringify(
      { valid: result.valid, perfect: result.perfect, errors: result.errors, warnings: result.warnings },
      null,
      2,
    );
    return text(`${header}\n\n${body}\n${summary}`);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
