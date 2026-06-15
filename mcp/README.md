# MealMind — servidor MCP

Servidor [MCP](https://modelcontextprotocol.io) que deixa uma IA **gerar e
validar** o JSON de prescrição do [MealMind](https://rt3norio.github.io/mealmind/)
sozinha. Reusa exatamente o mesmo schema e validador do app (importados de
`../src`), então nada de lógica é duplicado.

## Ferramentas

| Ferramenta | O que faz |
|---|---|
| `get_schema` | Devolve a spec completa (LLM-ready) do formato: regras, unidades e exemplo. |
| `create_plan_template` | Devolve um plano de exemplo já válido, para editar. |
| `validate_plan` | Recebe `{ json }` e devolve **válido?** + erros/avisos em português. |

Fluxo típico: `get_schema` → gerar o JSON → `validate_plan` até ficar válido →
entregar o JSON ao usuário (que importa na aba **Dados** do app).

## Rodar

Não precisa instalar nada permanentemente — `tsx` é baixado pelo `npx`:

```bash
npx -y tsx mcp/server.ts
```

Ou, com as dependências instaladas em `mcp/`:

```bash
cd mcp && npm install && npm start
```

Checagem rápida (valida o exemplo sem subir o servidor):

```bash
cd mcp && npm install && npm run smoke
```

## Configurar num cliente MCP

Ex. Claude Desktop (`claude_desktop_config.json`) ou qualquer cliente por stdio:

```json
{
  "mcpServers": {
    "mealmind": {
      "command": "npx",
      "args": ["-y", "tsx", "/CAMINHO/ABSOLUTO/mealmind/mcp/server.ts"]
    }
  }
}
```

Troque `/CAMINHO/ABSOLUTO/...` pelo caminho real do repositório clonado.
