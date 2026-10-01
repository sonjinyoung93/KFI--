import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from './api.js';
import { makeOrder } from './utils.js';
import Login from './components/Login.jsx';
import Header from './components/Header.jsx';
import OrgChart from './components/OrgChart.jsx';
import SiteChart from './components/SiteChart.jsx';
import ListView from './components/ListView.jsx';
import Admin from './components/Admin.jsx';

const TABS = ['org', 'site', 'list', 'admin'];
const tabFromHash = () => { const t = location.hash.replace('#', ''); return TABS.includes(t) ? t : 'org'; };

export default function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(tabFromHash);
  const [booting, setBooting] = useState(!!api.getToken());
  const [error, setError] = useState('');
  const [editId, setEditId] = useState(null); // 관리 화면으로 넘길 대상

  const load = useCallback(async () => {
    try {
      const d = await api.bootstrap();
      setData(d); setUser(d.user); setError('');
    } catch (e) {
      if (e.auth) { setUser(null); setData(null); } else setError(e.message);
    } finally { setBooting(false); }
  }, []);

  useEffect(() => { if (api.getToken()) load(); }, [load]);
  useEffect(() => {
    const on = () => setTab(tabFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const go = (t, id = null) => { setEditId(id); location.hash = t; setTab(t); window.scrollTo(0, 0); };
  const order = useMemo(() => data && makeOrder(data.codes), [data]);

  if (booting) return <div className="center-screen">불러오는 중…</div>;
  if (!user) return <Login onLogin={async (id, pw) => { await api.login(id, pw); await load(); }} />;
  if (!data) return <div className="center-screen">{error || '불러오는 중…'}</div>;

  const isAdmin = user.role === 'admin';
  const view = tab === 'admin' && !isAdmin ? 'org' : tab;
  const props = { data, order, isAdmin, go, reload: load };

  return (
    <div className="app">
      <Header user={user} tab={view} go={go} onLogout={() => { api.clearToken(); setUser(null); setData(null); }} />
      {error && <div className="banner error">{error}</div>}
      {api.DEMO && <div className="banner demo">데모 모드 — 서버 미연결 (변경 내용은 새로고침 시 초기화)</div>}
      <main className="main">
        {view === 'org' && <OrgChart {...props} />}
        {view === 'site' && <SiteChart {...props} />}
        {view === 'list' && <ListView {...props} />}
        {view === 'admin' && <Admin {...props} editId={editId} />}
      </main>
    </div>
  );
}
