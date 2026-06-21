import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { LLM_PROMPT, SAMPLE_JSON } from '../data/schemaDoc';

/** First run, nothing imported yet: welcome + the two steps to get a plan. */
export default function Onboarding() {
  const { importCombined } = useStore();
  const nav = useNavigate();
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(LLM_PROMPT);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = LLM_PROMPT;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  function loadExample() {
    importCombined(SAMPLE_JSON);
    nav('/', { replace: true });
  }

  return (
    <div className="onb">
      <div className="onb-hero">
        <div className="onb-mark" aria-hidden>M</div>
        <h1>Bem-vindo ao MealMind</h1>
        <p>Sua dieta e seu treino num app só. Sem conta, sem servidor — tudo fica no seu aparelho.</p>
      </div>

      <div className="card">
        <h2>Comece em 2 passos</h2>
        <div className="onb-steps">
          <div className="onb-step">
            <span className="onb-num">1</span>
            <div className="onb-step-body">
              <strong>Gere seu plano com IA</strong>
              <p className="sub onb-step-sub">
                Copie o prompt, cole no ChatGPT, Claude ou Gemini e descreva sua dieta
                e/ou treino. Ele devolve o arquivo pronto.
              </p>
              <button className="primary" onClick={copyPrompt}>
                {copied ? '✓ Prompt copiado' : 'Copiar prompt para IA'}
              </button>
            </div>
          </div>

          <div className="onb-step">
            <span className="onb-num">2</span>
            <div className="onb-step-body">
              <strong>Importe o arquivo</strong>
              <p className="sub onb-step-sub">
                Cole o JSON ou escolha o arquivo. As abas aparecem conforme o que você
                trouxer — dieta, treino, ou os dois.
              </p>
              <button className="ghost" onClick={() => nav('/dados')}>Ir para Importar</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card onb-try">
        <div>
          <strong>Só quer ver como é?</strong>
          <p className="sub onb-step-sub" style={{ margin: '2px 0 0' }}>
            Carregue um exemplo com dieta e treino e explore o app.
          </p>
        </div>
        <button className="ghost" onClick={loadExample}>Ver exemplo</button>
      </div>
    </div>
  );
}
