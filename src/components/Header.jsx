import { useState } from 'react';
import { changePassword } from '../api.js';

const NAV = [
  { key: 'org', label: '조직도' },
  { key: 'site', label: 'PJT별 조직도' },
  { key: 'list', label: '명단 · 현황' },
  { key: 'admin', label: '관리', admin: true },
];

export default function Header({ user, tab, go, onLogout }) {
  const [pwOpen, setPwOpen] = useState(false);
  return (
    <header className="topbar no-print">
      <div className="topbar-inner">
        <div className="brand">
          <div className="brand-mark">건</div>
          <div><div className="brand-title">건국이엔아이 조직도</div><div className="brand-sub">공사사업부</div></div>
        </div>
        <nav className="nav">
          {NAV.filter(n => !n.admin || user.role === 'admin').map(n => (
            <a key={n.key} href={'#' + n.key} className={tab === n.key ? 'active' : ''} onClick={e => { e.preventDefault(); go(n.key); }}>
              {n.label}{n.admin && <span className="tag-admin">admin</span>}
            </a>
          ))}
        </nav>
        <div className="userbox">
          <span className="user-dot">{(user.name || user.id).charAt(0)}</span>
          <span className="hide-sm">{user.name} 님</span>
          <button className="linkbtn" onClick={() => setPwOpen(true)}>비밀번호</button>
          <button className="linkbtn" onClick={onLogout}>로그아웃</button>
        </div>
      </div>
      {pwOpen && <PwModal onClose={() => setPwOpen(false)} />}
    </header>
  );
}

function PwModal({ onClose }) {
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [c, setC] = useState('');
  const [msg, setMsg] = useState('');
  const submit = async e => {
    e.preventDefault();
    if (b !== c) return setMsg('새 비밀번호가 서로 다릅니다');
    try { await changePassword(a, b); setMsg('변경 완료'); setTimeout(onClose, 800); } catch (er) { setMsg(er.message); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h3>비밀번호 변경</h3>
        <label className="field"><span>현재 비밀번호</span><input type="password" value={a} onChange={e => setA(e.target.value)} required /></label>
        <label className="field"><span>새 비밀번호 (6자 이상)</span><input type="password" value={b} onChange={e => setB(e.target.value)} minLength={6} required /></label>
        <label className="field"><span>새 비밀번호 확인</span><input type="password" value={c} onChange={e => setC(e.target.value)} required /></label>
        {msg && <div className="form-err">{msg}</div>}
        <div className="row-end"><button type="button" className="btn" onClick={onClose}>닫기</button><button className="btn primary">변경</button></div>
      </form>
    </div>
  );
}
