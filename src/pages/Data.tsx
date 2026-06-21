import { useRef, useState } from 'react';
import { useStore, type CombinedImport } from '../store';
import { downloadDoc } from '../lib/storage';
import { SAMPLE_DOC } from '../data/sample';
import { Link } from 'react-router-dom';

interface Issue {
  path: string;
  message: string;
  hint?: string;
  severity: 'error' | 'warning';
}

export default function Data() {
  const { doc, importCombined } = useStore();
  const [text, setText] = useState('');
  const [res, setRes] = useState<CombinedImport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ''));
      setRes(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function doImport() {
    const r = importCombined(text);
    setRes(r);
    if (r.ok) setText('');
  }

  const hasData = doc.plan.meals.length > 0 || (doc.workouts?.length ?? 0) > 0;
  const example = JSON.stringify(SAMPLE_DOC, null, 2);

  return (
    <>
      <div className="card">
        <h2>Importar</h2>
        <p className="sub">
          Um arquivo só. Ele pode trazer o <strong>plano alimentar</strong>, o{' '}
          <strong>treino</strong>, ou os dois — as abas aparecem conforme o que você importar.
          Cole o JSON ou escolha o arquivo.
        </p>
        <div className="btn-row" style={{ marginBottom: 12 }}>
          <button onClick={() => fileRef.current?.click()}>📂 Escolher arquivo</button>
          <button
            className="ghost"
            onClick={() => {
              setText(example);
              setRes(null);
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
          placeholder='{ "schemaVersion": "1.0", "plan": { "meals": [ … ] }, "workouts": [ … ] }'
          spellCheck={false}
        />
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={doImport} disabled={!text.trim()}>
            Importar
          </button>
        </div>

        {res && <ImportResult res={res} />}

        <p className="sub" style={{ marginTop: 14 }}>
          Não sabe gerar o arquivo? Veja o formato em{' '}
          <Link to="/ajuda" className="inline">Ajuda</Link>.
        </p>
      </div>

      <div className="card">
        <h2>Exportar / fazer backup</h2>
        <p className="sub">
          Baixe um arquivo com o plano, o treino e todo o seu histórico. Guarde-o ou
          envie para outro aparelho.
        </p>
        <div className="btn-row">
          <button
            onClick={() => downloadDoc(doc, `mealmind-${new Date().toISOString().slice(0, 10)}.json`)}
            disabled={!hasData}
          >
            ⬇️ Baixar JSON
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

function ImportResult({ res }: { res: CombinedImport }) {
  if (res.error) {
    return <div className="banner bad" style={{ marginTop: 12 }}>✕ {res.error}</div>;
  }
  return (
    <div style={{ marginTop: 12 }}>
      {res.ok ? (
        <div className="banner ok">✓ Importado com sucesso.</div>
      ) : (
        <div className="banner bad">✕ Erros impedem a importação — nada foi alterado.</div>
      )}
      <IssueBlock title="Plano alimentar" errors={res.nutrition?.errors} warnings={res.nutrition?.warnings} />
      <IssueBlock title="Treino" errors={res.workouts?.errors} warnings={res.workouts?.warnings} />
    </div>
  );
}

function IssueBlock({
  title,
  errors = [],
  warnings = [],
}: {
  title: string;
  errors?: Issue[];
  warnings?: Issue[];
}) {
  if (errors.length === 0 && warnings.length === 0) return null;
  const row = (iss: Issue, i: number) => (
    <div className={'issue ' + iss.severity} key={iss.severity + i}>
      <div className="path">{iss.path}</div>
      <div className="msg">{iss.message}</div>
      {iss.hint && <div className="hint">💡 {iss.hint}</div>}
    </div>
  );
  return (
    <>
      <div className="section-title" style={{ margin: '14px 4px 6px' }}>{title}</div>
      {errors.map(row)}
      {warnings.map(row)}
    </>
  );
}
