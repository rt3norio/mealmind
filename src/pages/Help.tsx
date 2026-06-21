import { useState } from 'react';
import { LLM_PROMPT, FIELD_REFERENCE, SAMPLE_JSON } from '../data/schemaDoc';

export default function Help() {
  const [copied, setCopied] = useState<'prompt' | 'sample' | null>(null);

  async function copy(what: 'prompt' | 'sample') {
    const text = what === 'prompt' ? LLM_PROMPT : SAMPLE_JSON;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers blocking clipboard without HTTPS/gesture.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  function downloadMd() {
    const blob = new Blob([LLM_PROMPT], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'como-gerar-prescricao.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="card">
        <h2>Como criar o plano</h2>
        <p className="sub">
          O plano é um arquivo <strong>JSON</strong> que pode trazer a <strong>dieta</strong>,
          o <strong>treino</strong>, ou os dois. Escreva à mão ou gere com uma IA: copie o
          texto abaixo, cole no ChatGPT, Claude ou Gemini, descreva o que você quer e o
          arquivo sai pronto.
        </p>
        <div className="btn-row">
          <button className="primary" onClick={() => copy('prompt')}>
            {copied === 'prompt' ? '✓ Copiado!' : '📋 Copiar prompt para IA'}
          </button>
          <button className="ghost" onClick={downloadMd}>⬇️ Baixar instruções</button>
        </div>
      </div>

      <div className="card">
        <h2>Para o paciente</h2>
        <ul className="bul">
          <li>Receba o arquivo <code>.json</code> do seu nutricionista.</li>
          <li>Abra a aba <strong>Dados</strong> e escolha o arquivo (ou cole o conteúdo).</li>
          <li>O app valida e explica qualquer erro antes de importar.</li>
          <li>Marque suas refeições na aba <strong>Hoje</strong>.</li>
          <li>Faça backup em <strong>Configurações</strong> (Google Drive) ou exportando o JSON.</li>
        </ul>
      </div>

      <div className="card">
        <h2>Campos do formato</h2>
        <ul className="food-list">
          {FIELD_REFERENCE.map((f) => (
            <li key={f.name}>
              <span className="food-qty">
                {f.required ? <span className="pill">obrig.</span> : <span className="muted">opc.</span>}
              </span>
              <span className="food-name">
                <code>{f.name}</code> — {f.desc}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Exemplo de arquivo</h2>
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <button className="sm" onClick={() => copy('sample')}>
            {copied === 'sample' ? '✓ Copiado!' : '📋 Copiar exemplo'}
          </button>
        </div>
        <pre className="code">{SAMPLE_JSON}</pre>
      </div>
    </>
  );
}
