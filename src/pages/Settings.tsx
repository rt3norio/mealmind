import { useState } from 'react';
import { useStore } from '../store';

export default function Settings() {
  const {
    settings,
    updateSettings,
    signedIn,
    busy,
    driveConnect,
    driveDisconnect,
    driveSyncUp,
    driveSyncDown,
  } = useStore();
  const [clientId, setClientId] = useState(settings.driveClientId ?? '');

  const lastSync = settings.lastSyncedAt
    ? new Date(settings.lastSyncedAt).toLocaleString('pt-BR')
    : 'nunca';

  return (
    <>
      <div className="card">
        <h2>Google Drive</h2>
        <p className="sub">
          Seus dados ficam no <strong>seu</strong> Drive, numa pasta privada do app. O
          app não tem servidor — nada passa por terceiros.
        </p>

        <label className="field">
          <span className="lbl">Client ID do Google (OAuth)</span>
          <span className="desc">
            Crie um gratuitamente no Google Cloud (veja o passo a passo abaixo) e cole
            aqui. Fica salvo só neste aparelho.
          </span>
          <input
            type="text"
            value={clientId}
            placeholder="000000000000-xxxx.apps.googleusercontent.com"
            onChange={(e) => setClientId(e.target.value.trim())}
            onBlur={() => updateSettings({ driveClientId: clientId || undefined })}
            spellCheck={false}
          />
        </label>

        <label className="toggle" style={{ marginBottom: 14 }}>
          <input
            type="checkbox"
            checked={!!settings.autoSync}
            onChange={(e) => updateSettings({ autoSync: e.target.checked })}
          />
          <span>Sincronizar automaticamente após cada alteração</span>
        </label>

        {!signedIn ? (
          <button className="primary" onClick={driveConnect} disabled={busy || !clientId}>
            🔗 Conectar ao Google Drive
          </button>
        ) : (
          <>
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
      </div>

      <div className="card">
        <h2>Como obter o Client ID (uma vez)</h2>
        <ul className="bul">
          <li>Acesse <a className="inline" href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">console.cloud.google.com</a> e crie um projeto.</li>
          <li>Ative a <strong>Google Drive API</strong>.</li>
          <li>Em "Tela de consentimento OAuth", configure como <strong>Externo</strong> e adicione seu e-mail como usuário de teste.</li>
          <li>Em "Credenciais", crie um <strong>ID do cliente OAuth</strong> do tipo <strong>Aplicativo da Web</strong>.</li>
          <li>Em "Origens JavaScript autorizadas", adicione a URL deste app:
            <br /><code>{window.location.origin}</code></li>
          <li>Copie o Client ID gerado e cole no campo acima.</li>
        </ul>
        <p className="sub">
          O app pede apenas o escopo <code>drive.appdata</code> — acesso restrito à pasta
          privada do próprio app, sem ver o resto do seu Drive.
        </p>
      </div>

      <div className="card">
        <h2>Sobre</h2>
        <p className="sub">
          app-nutrition — aberto, gratuito e sem backend. Funciona offline (PWA): adicione
          à tela inicial pelo menu do navegador.
        </p>
      </div>
    </>
  );
}
