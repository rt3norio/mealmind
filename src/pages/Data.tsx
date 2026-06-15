import { useRef, useState } from 'react';
import { useStore } from '../store';
import { parseAndValidate, type ValidationResult } from '../data/validator';
import { downloadDoc } from '../lib/storage';
import { SAMPLE_DOC } from '../data/sample';
import { Link } from 'react-router-dom';

export default function Data() {
  const { doc, importText, replaceDoc } = useStore();
  const [text, setText] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      setText(content);
      setResult(parseAndValidate(content).result);
    };
    reader.readAsText(file);
  }

  function validateOnly() {
    setResult(parseAndValidate(text).result);
  }

  function doImport() {
    const r = importText(text);
    setResult(r);
    if (r.valid) setText('');
  }

  const hasPlan = doc.plan.meals.length > 0;

  return (
    <>
      <div className="card">
        <h2>Importar prescrição</h2>
        <p className="sub">
          Cole o conteúdo do arquivo JSON enviado pelo nutricionista, ou selecione o
          arquivo. O validador explica qualquer problema antes de importar.
        </p>
        <div className="btn-row" style={{ marginBottom: 12 }}>
          <button onClick={() => fileRef.current?.click()}>📂 Escolher arquivo</button>
          <button
            className="ghost"
            onClick={() => {
              const sample = JSON.stringify(SAMPLE_DOC, null, 2);
              setText(sample);
              setResult(parseAndValidate(sample).result);
            }}
          >
            Ver exemplo
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={onPickFile}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{ "schemaVersion": "1.0", "plan": { "meals": [ ... ] } }'
          spellCheck={false}
        />
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button onClick={validateOnly} disabled={!text.trim()}>Validar</button>
          <button
            className="primary"
            onClick={doImport}
            disabled={!text.trim() || (result ? !result.valid : false)}
          >
            Importar
          </button>
        </div>

        {result && <ValidationView result={result} />}

        <p className="sub" style={{ marginTop: 14 }}>
          Não sabe gerar o arquivo? Veja o formato em{' '}
          <Link to="/ajuda" className="inline">Ajuda</Link>.
        </p>
      </div>

      <div className="card">
        <h2>Exportar / fazer backup</h2>
        <p className="sub">
          Baixe um arquivo com o plano e todo o seu histórico. Guarde-o ou envie para
          outro aparelho.
        </p>
        <div className="btn-row">
          <button onClick={() => downloadDoc(doc, `nutricao-${new Date().toISOString().slice(0, 10)}.json`)} disabled={!hasPlan}>
            ⬇️ Baixar JSON
          </button>
          <button
            className="ghost"
            onClick={() => {
              if (confirm('Carregar o plano de exemplo? Isso substitui o plano atual (seu histórico é mantido).')) {
                replaceDoc({ ...SAMPLE_DOC, logs: doc.logs });
              }
            }}
          >
            Carregar exemplo
          </button>
        </div>
        <p className="sub" style={{ marginTop: 14 }}>
          Sincronização com o Google Drive fica em{' '}
          <Link to="/config" className="inline">Configurações</Link>.
        </p>
      </div>
    </>
  );
}

function ValidationView({ result }: { result: ValidationResult }) {
  if (result.perfect) {
    return <div className="banner ok" style={{ marginTop: 12 }}>✓ Arquivo válido e completo. Pode importar.</div>;
  }
  return (
    <div style={{ marginTop: 12 }}>
      {result.valid ? (
        <div className="banner ok">✓ Válido para importar — com {result.warnings.length} aviso(s) abaixo.</div>
      ) : (
        <div className="banner bad">✕ {result.errors.length} erro(s) impedem a importação. Corrija e valide de novo.</div>
      )}
      {result.errors.map((iss, i) => (
        <div className="issue error" key={'e' + i}>
          <div className="path">{iss.path}</div>
          <div className="msg">{iss.message}</div>
          {iss.hint && <div className="hint">💡 {iss.hint}</div>}
        </div>
      ))}
      {result.warnings.map((iss, i) => (
        <div className="issue warning" key={'w' + i}>
          <div className="path">{iss.path}</div>
          <div className="msg">{iss.message}</div>
          {iss.hint && <div className="hint">💡 {iss.hint}</div>}
        </div>
      ))}
    </div>
  );
}
