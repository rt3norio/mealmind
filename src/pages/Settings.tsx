import { useState } from 'react';
import { useStore } from '../store';
import { BUILTIN_CLIENT_ID } from '../lib/config';
import { DEFAULT_MODEL } from '../lib/openrouter';

/** Curated coach models (value '' = the app default). */
const COACH_MODELS: { id: string; label: string }[] = [
  { id: 'qwen/qwen3-235b-a22b-2507', label: 'Qwen3 235B — mais barato' },
  { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash — barato, 1M ctx' },
  { id: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite — tools confiáveis' },
  { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5' },
  { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5 — premium' },
];

export default function Settings() {
  const {
    settings,
    updateSettings,
    signedIn,
    busy,
    effectiveClientId,
    driveConnect,
    driveDisconnect,
    driveSyncUp,
    driveSyncDown,
    orConnect,
    orDisconnect,
  } = useStore();
  const [clientId, setClientId] = useState(settings.driveClientId ?? '');
  const [model, setModel] = useState(settings.openrouterModel ?? '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const lastSync = settings.lastSyncedAt
    ? new Date(settings.lastSyncedAt).toLocaleString('pt-BR')
    : 'nunca';

  const configured = !!effectiveClientId;

  return (
    <>
      <div className="card">
        <h2>Google Drive</h2>
        <p className="sub">
          Faça login com sua conta Google e seus dados ficam no <strong>seu</strong>{' '}
          Drive, numa pasta privada do app. Sem servidor, sem cadastro — nada passa por
          terceiros.
        </p>

        {!configured ? (
          <div className="banner bad">
            Sincronização com Drive ainda não está habilitada nesta instalação.
          </div>
        ) : !signedIn ? (
          <button className="primary" onClick={driveConnect} disabled={busy}>
            🔗 Entrar com o Google
          </button>
        ) : (
          <>
            <label className="toggle" style={{ margin: '4px 0 14px' }}>
              <input
                type="checkbox"
                checked={!!settings.autoSync}
                onChange={(e) => updateSettings({ autoSync: e.target.checked })}
              />
              <span>Sincronizar automaticamente após cada alteração</span>
            </label>
            <div className="btn-row">
              <button onClick={driveSyncUp} disabled={busy}>⬆️ Enviar agora</button>
              <button onClick={driveSyncDown} disabled={busy}>⬇️ Baixar do Drive</button>
            </div>
            <button className="ghost sm" style={{ marginTop: 10 }} onClick={driveDisconnect}>
              Desconectar
            </button>
          </>
        )}
        <p className="sub" style={{ marginTop: 12 }}>Última sincronização: {lastSync}</p>
        <p className="sub">
          O app pede apenas o escopo <code>drive.appdata</code> — acesso restrito à pasta
          privada do próprio app, sem ver o resto do seu Drive.
        </p>
      </div>

      <div className="card">
        <h2>Coach com IA (OpenRouter)</h2>
        <p className="sub">
          Conecte sua conta <strong>OpenRouter</strong> e converse com um coach que lê seu plano
          e seu dia. O uso é cobrado no <strong>seu</strong> crédito OpenRouter — não no app.
        </p>
        {!settings.openrouterKey ? (
          <button className="primary" onClick={orConnect} disabled={busy}>
            🔗 Conectar OpenRouter
          </button>
        ) : (
          <>
            <div className="banner ok">Conectado ao OpenRouter. A aba 💬 Coach está liberada.</div>
            <label className="field" style={{ margin: '6px 0 12px' }}>
              <span className="lbl">Modelo do coach</span>
              <select
                value={settings.openrouterModel ?? ''}
                onChange={(e) => updateSettings({ openrouterModel: e.target.value || undefined })}
              >
                <option value="">DeepSeek V3.2 — padrão (barato + forte)</option>
                {COACH_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
                {settings.openrouterModel &&
                  !COACH_MODELS.some((m) => m.id === settings.openrouterModel) && (
                    <option value={settings.openrouterModel}>
                      Personalizado: {settings.openrouterModel}
                    </option>
                  )}
              </select>
            </label>
            <button className="ghost sm" onClick={orDisconnect}>Desconectar</button>
          </>
        )}
        <p className="sub" style={{ marginTop: 12 }}>
          ⚠️ Diferente do Drive, as mensagens do coach <strong>passam pelo OpenRouter</strong>
          {' '}(saem do navegador). Modelo padrão: <code>{DEFAULT_MODEL}</code> (barato). Precisa de
          conta OpenRouter com crédito; há modelos gratuitos também.
        </p>
      </div>

      <div className="card">
        <h2>Sobre</h2>
        <p className="sub">
          MealMind — aberto, gratuito e sem backend. Funciona offline (PWA): adicione
          à tela inicial pelo menu do navegador.
        </p>
        <button className="ghost sm" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? 'Ocultar avançado' : 'Avançado'}
        </button>
      </div>

      {showAdvanced && (
        <div className="card">
          <h2>Avançado — Client ID próprio</h2>
          <p className="sub">
            Opcional. Para usar seu próprio projeto Google Cloud em vez do client id
            padrão do app{BUILTIN_CLIENT_ID ? '' : ' (que ainda não foi configurado)'}.
            Deixe em branco para usar o padrão.
          </p>
          <label className="field">
            <span className="lbl">Client ID do Google (OAuth Web)</span>
            <input
              type="text"
              value={clientId}
              placeholder="000000000000-xxxx.apps.googleusercontent.com"
              onChange={(e) => setClientId(e.target.value.trim())}
              onBlur={() => updateSettings({ driveClientId: clientId || undefined })}
              spellCheck={false}
            />
          </label>
          <p className="sub">
            Origem JavaScript a autorizar no Google Cloud: <code>{window.location.origin}</code>
          </p>

          <h2 style={{ marginTop: 18 }}>Avançado — Modelo do coach</h2>
          <p className="sub">
            Modelo do OpenRouter para o coach. Em branco usa <code>{DEFAULT_MODEL}</code>. Ex.:
            um modelo gratuito termina em <code>:free</code>.
          </p>
          <label className="field">
            <span className="lbl">Modelo (OpenRouter)</span>
            <input
              type="text"
              value={model}
              placeholder={DEFAULT_MODEL}
              onChange={(e) => setModel(e.target.value.trim())}
              onBlur={() => updateSettings({ openrouterModel: model || undefined })}
              spellCheck={false}
            />
          </label>
        </div>
      )}
    </>
  );
}
