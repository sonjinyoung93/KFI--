import { useState } from 'react';
import { DEMO } from '../api.js';

export default function Login({ onLogin }) {
  const [id, setId] = useState(() => { try { return localStorage.getItem('orgchart_uid') || ''; } catch { return ''; } });
  const [pw, setPw] = useState('');
  const [save, setSave] = useState(!!id);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      try { save ? localStorage.setItem('orgchart_uid', id) : localStorage.removeItem('orgchart_uid'); } catch { /* ignore */ }
      await onLogin(id.trim(), pw);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="login-bg">
      <form className="login-card" onSubmit={submit}>
        <div className="brand lg">
          <div className="brand-mark">건</div>
          <div><div className="brand-title">건국이엔아이 조직도</div><div className="brand-sub">공사사업부 인원 현황 시스템</div></div>
        </div>
        <label className="field"><span>아이디</span><input value={id} onChange={e => setId(e.target.value)} autoComplete="username" required /></label>
        <label className="field"><span>비밀번호</span><input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" required /></label>
        <label className="check"><input type="checkbox" checked={save} onChange={e => setSave(e.target.checked)} />아이디 저장</label>
        {err && <div className="form-err">{err}</div>}
        <button className="btn primary block" disabled={busy}>{busy ? '확인 중…' : '로그인'}</button>
        <p className="muted small center">계정 발급 · 비밀번호 초기화는 관리자(admin)에게 문의</p>
        {DEMO && <p className="demo-hint">데모 계정 — admin / admin1234 · viewer / viewer1234</p>}
      </form>
    </div>
  );
}
