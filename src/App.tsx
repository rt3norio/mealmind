import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore } from './store';
import Today from './pages/Today';
import Plan from './pages/Plan';
import Data from './pages/Data';
import Help from './pages/Help';
import Settings from './pages/Settings';

function Shell() {
  const { status, signedIn, effectiveClientId } = useStore();
  return (
    <div className="app">
      <header className="topbar">
        <span className="logo" aria-hidden>🥗</span>
        <h1>MealMind</h1>
        <span className="spacer" />
        <span className="sync-dot">
          {effectiveClientId ? (signedIn ? '● Drive' : '○ Drive') : ''}
        </span>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/plano" element={<Plan />} />
          <Route path="/dados" element={<Data />} />
          <Route path="/ajuda" element={<Help />} />
          <Route path="/config" element={<Settings />} />
        </Routes>
      </main>

      {status && <div className="status-toast">{status}</div>}

      <div className="tabbar">
        <nav>
          <Tab to="/" icon="📅" label="Hoje" />
          <Tab to="/plano" icon="📋" label="Plano" />
          <Tab to="/dados" icon="🔄" label="Dados" />
          <Tab to="/ajuda" icon="❓" label="Ajuda" />
          <Tab to="/config" icon="⚙️" label="Config" />
        </nav>
      </div>
    </div>
  );
}

function Tab({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
      <span className="ic" aria-hidden>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </HashRouter>
  );
}
