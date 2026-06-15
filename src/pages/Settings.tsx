import { useState } from 'react';
import { useStore } from '../store';
import { BUILTIN_CLIENT_ID } from '../lib/config';

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
  } = useStore();
  const [clientId, setClientId] = useState(settings.driveClientId ?? '');
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
        </div>
      )}
    </>
  );
}
