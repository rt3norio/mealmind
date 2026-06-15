// Quick offline check: confirms the MCP server can import the app's own schema
// and validator (from ../src) and that the bundled sample validates clean.
// Run: npm run smoke   (inside mcp/)

import { LLM_PROMPT, SAMPLE_JSON } from '../src/data/schemaDoc';
import { parseAndValidate } from '../src/data/validator';

const promptOk = LLM_PROMPT.includes('schemaVersion');
const { result } = parseAndValidate(SAMPLE_JSON);

console.log('LLM_PROMPT carregado:', promptOk);
console.log('Exemplo válido:', result.valid, '| perfeito:', result.perfect);
console.log('erros:', result.errors.length, '| avisos:', result.warnings.length);

if (!promptOk || !result.valid) {
  console.error('SMOKE FALHOU');
  process.exit(1);
}
console.log('SMOKE OK');
