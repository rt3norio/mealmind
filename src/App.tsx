import { useEffect, useState, type ReactNode } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { StoreProvider, useStore } from './store';
import Today from './pages/Today';
import Plan from './pages/Plan';
import History from './pages/History';
import Coach from './pages/Coach';
import Data from './pages/Data';
import Help from './pages/Help';
import Settings from './pages/Settings';
import Workout from './pages/Workout';
import {
  IconToday,
  IconPlan,
  IconDumbbell,
  IconTrend,
  IconMore,
  IconData,
  IconChat,
  IconHelp,
  IconSettings,
} from './components/icons';

function Shell() {
  const { doc, status, signedIn, effectiveClientId, settings } = useStore();
  const hasFood = doc.plan.meals.length > 0;
  const hasWorkouts = (doc.workouts?.length ?? 0) > 0 || (doc.workoutPlan?.days?.length ?? 0) > 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the overflow menu whenever the route changes.
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="app">
      <Landing hasFood={hasFood} hasWorkouts={hasWorkouts} />
      <header className="topbar">
        <span className="logo" aria-hidden>M</span>
        <h1>MealMind</h1>
        <span className="spacer" />
        {effectiveClientId && (
          <span className={'drive-dot' + (signedIn ? ' on' : '')} title={signedIn ? 'Drive conectado' : 'Drive desconectado'} />
        )}
        <button className="menu-btn" aria-label="Mais opções" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
          <IconMore />
        </button>
      </header>

      {menuOpen && (
        <>
          <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="menu-pop">
            <MenuItem to="/dados" icon={<IconData />} label="Importar / exportar" />
            {settings.openrouterKey && <MenuItem to="/coach" icon={<IconChat />} label="Coach" />}
            <MenuItem to="/ajuda" icon={<IconHelp />} label="Ajuda" />
            <MenuItem to="/config" icon={<IconSettings />} label="Ajustes" />
          </nav>
        </>
      )}

      <main className="content">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/plano" element={<Plan />} />
          <Route path="/treino" element={<Workout />} />
          <Route path="/historico" element={<History />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/dados" element={<Data />} />
          <Route path="/ajuda" element={<Help />} />
          <Route path="/config" element={<Settings />} />
        </Routes>
      </main>

      {status && <div className="status-toast">{status}</div>}

      {(hasFood || hasWorkouts) && (
        <div className="tabbar">
          <nav>
            {hasFood && <Tab to="/" icon={<IconToday />} label="Hoje" />}
            {hasFood && <Tab to="/plano" icon={<IconPlan />} label="Plano" />}
            {hasWorkouts && <Tab to="/treino" icon={<IconDumbbell />} label="Treino" />}
            {hasFood && <Tab to="/historico" icon={<IconTrend />} label="Progresso" />}
          </nav>
        </div>
      )}
    </div>
  );
}

/** When the active tab has no data behind it, send the user to one that does. */
function Landing({ hasFood, hasWorkouts }: { hasFood: boolean; hasWorkouts: boolean }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const foodPaths = ['/', '/plano', '/historico', '/coach'];
    if (!hasFood && foodPaths.includes(pathname)) {
      nav(hasWorkouts ? '/treino' : '/dados', { replace: true });
    } else if (!hasWorkouts && pathname === '/treino') {
      nav(hasFood ? '/' : '/dados', { replace: true });
    }
  }, [hasFood, hasWorkouts, pathname, nav]);
  return null;
}

function Tab({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
      <span className="ic">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

function MenuItem({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => 'menu-item' + (isActive ? ' active' : '')}>
      <span className="mi-ic">{icon}</span>
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
