import { useEffect, useMemo, useState } from 'react';
import * as api from '../api.js';
import { resizeImage, today, rolesOf } from '../utils.js';
import { Avatar } from './common.jsx';

const BLANK = { id: '', name: '', rank: '', job: '', pjt: '', work: '상용', status: '재직', startDate: '', phone: '', note: '', role: '', lead: 'N', photoId: '' };

// 이름·사번 검색 선택
function PersonPicker({ people, value, onChange, id, label }) {
  const [text, setText] = useState('');
  const cur = people.find(p => p.id === value);
  useEffect(() => { setText(cur ? `${cur.name} ${cur.rank} (${cur.id})` : ''); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="field">
      <span>{label}</span>
      <input list={id + '-list'} value={text} placeholder="이름 또는 사번 입력 후 선택"
        onChange={e => {
          setText(e.target.value);
          const m = e.target.value.match(/\((E\d+)\)\s*$/);
          if (m) onChange(m[1]);
        }} />
      <datalist id={id + '-list'}>
        {people.map(p => <option key={p.id} value={`${p.name} ${p.rank} (${p.id})`}>{p.pjt} · {p.job}</option>)}
      </datalist>
    </label>
  );
}

function Sel({ label, value, onChange, options, required, blank }) {
  return (
    <label className="field"><span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} required={required}>
        {blank !== undefined && <option value="">{blank}</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Msg({ m }) { return m ? <div className={'form-msg ' + (m.ok ? 'ok' : 'err')}>{m.text}</div> : null; }

export default function Admin({ data, reload, editId }) {
  const { codes } = data;
  const pjtNames = data.pjts.map(p => p.name);
  const people = useMemo(() => [...data.people].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [data]);

  // ── 등록·수정
  const [form, setForm] = useState(BLANK);
  const [photo, setPhoto] = useState(null);
  const [m1, setM1] = useState(null);
  const [busy, setBusy] = useState(false);
  const loadEdit = id => {
    const p = data.people.find(x => x.id === id);
    setForm(p ? { ...BLANK, ...p } : BLANK); setPhoto(null); setM1(null);
  };
  useEffect(() => { if (editId && editId !== 'new') { loadEdit(editId); setMove(mv => ({ ...mv, id: editId })); } else setForm(BLANK); }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async e => {
    e.preventDefault(); setBusy(true); setM1(null);
    try {
      const { photoId, updatedAt, updatedBy, ...p } = form; // eslint-disable-line no-unused-vars
      const r = await api.savePerson(p.id ? p : { ...p, id: '' }, form.id ? '정보 수정' : '신규 등록');
      if (photo) await api.uploadPhoto(r.person.id, photo);
      await reload();
      setM1({ ok: true, text: `${r.person.name} (${r.person.id}) 저장 완료` });
      if (!form.id) { setForm(BLANK); setPhoto(null); } else setForm(f => ({ ...f, ...r.person }));
    } catch (er) { setM1({ ok: false, text: er.message }); } finally { setBusy(false); }
  };
  const pickPhoto = async e => { const file = e.target.files[0]; if (file) setPhoto(await resizeImage(file)); e.target.value = ''; };

  // ── PJT 이동
  const [move, setMove] = useState({ id: '', toPjt: '', date: today(), job: '', reason: '' });
  const [m2, setM2] = useState(null);
  const mvP = data.people.find(p => p.id === move.id);
  const doMove = async e => {
    e.preventDefault(); setM2(null);
    if (!mvP) return setM2({ ok: false, text: '대상자를 선택하세요' });
    if (!move.toPjt || move.toPjt === mvP.pjt) return setM2({ ok: false, text: '현재와 다른 PJT를 선택하세요' });
    setBusy(true);
    try {
      await api.movePerson({ id: move.id, toPjt: move.toPjt, date: move.date, job: move.job || undefined, reason: move.reason || 'PJT 이동' });
      await reload();
      setM2({ ok: true, text: `${mvP.name}: ${mvP.pjt} → ${move.toPjt} 이동 완료 (이력 기록)` });
      setMove({ id: '', toPjt: '', date: today(), job: '', reason: '' });
    } catch (er) { setM2({ ok: false, text: er.message }); } finally { setBusy(false); }
  };

  // ── 상태 변경
  const [st, setSt] = useState({ id: '', status: '퇴사', reason: '' });
  const [m3, setM3] = useState(null);
  const stP = data.people.find(p => p.id === st.id);
  const doStatus = async e => {
    e.preventDefault(); setM3(null);
    if (!stP) return setM3({ ok: false, text: '대상자를 선택하세요' });
    setBusy(true);
    try { await api.setStatus(st); await reload(); setM3({ ok: true, text: `${stP.name}: ${stP.status} → ${st.status}` }); setSt({ id: '', status: '퇴사', reason: '' }); }
    catch (er) { setM3({ ok: false, text: er.message }); } finally { setBusy(false); }
  };

  const [hq, setHq] = useState('');
  const hist = data.history.filter(h => !hq || [h.name, h.id, h.item, h.from, h.to].some(v => String(v).includes(hq)));
  const roleOpts = codes.roles.length ? codes.roles : ['책임기술자', '선임 안전관리자', '현장 안전'];

  return (
    <div className="stack">
      <div className="page-head"><div><h1>인원 관리 <span className="tag-admin dark">admin 전용</span></h1><p className="muted">등록 · 수정 · PJT 이동 · 퇴사 처리 — 저장 즉시 조직도와 현황에 반영, 변경 내용은 이력에 자동 기록</p></div></div>
      <div className="admin-grid">
        <form className="panel pad stack" onSubmit={save}>
          <div className="sec-row"><h2>{form.id ? '인원 수정' : '인원 등록'}</h2>
            <div className="row-gap">{form.id && <span className="muted small">사번 {form.id}</span>}<button type="button" className="btn sm" onClick={() => loadEdit(null)}>신규 입력</button></div>
          </div>
          <PersonPicker people={people} value={form.id} onChange={loadEdit} id="edit" label="수정할 인원 불러오기" />
          <div className="form-split">
            <div className="photo-box">
              <label className="photo-drop">
                {photo ? <img src={photo} alt="새 사진" /> : form.id && form.photoId ? <Avatar p={form} size={130} shape="rect" /> : <span>사진 선택<br /><small>3:4 자동 맞춤</small></span>}
                <input type="file" accept="image/*" onChange={pickPhoto} hidden />
              </label>
              <span className="muted small">선택사항 · 저장 시 업로드</span>
            </div>
            <div className="form-grid">
              <label className="field"><span>이름 *</span><input value={form.name} onChange={e => set('name', e.target.value)} required /></label>
              <Sel label="직급 *" value={form.rank} onChange={v => set('rank', v)} options={codes.ranks} required blank="선택" />
              <Sel label="직무 *" value={form.job} onChange={v => set('job', v)} options={codes.jobs} required blank="선택" />
              <Sel label="소속 PJT *" value={form.pjt} onChange={v => set('pjt', v)} options={pjtNames} required blank="선택" />
              <Sel label="근무형태 *" value={form.work} onChange={v => set('work', v)} options={codes.works} required />
              <Sel label="재직상태" value={form.status} onChange={v => set('status', v)} options={codes.statuses} />
              <label className="field"><span>투입일</span><input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></label>
              <label className="field"><span>연락처</span><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="010-0000-0000" /></label>
              <Sel label="역할 (PJT별 조직도 상단)" value={rolesOf(form)[0] || ''} onChange={v => set('role', v)} options={roleOpts} blank="없음" />
              <label className="field"><span>부서 팀장</span><span className="check inline"><input type="checkbox" checked={form.lead === 'Y'} onChange={e => set('lead', e.target.checked ? 'Y' : 'N')} />해당 PJT · 직무 팀장으로 지정</span></label>
              <label className="field span2"><span>비고</span><input value={form.note} onChange={e => set('note', e.target.value)} /></label>
            </div>
          </div>
          <Msg m={m1} />
          <div className="row-end"><button className="btn primary" disabled={busy}>{busy ? '저장 중…' : '저장'}</button></div>
        </form>

        <div className="stack">
          <form className="panel pad stack accent" onSubmit={doMove}>
            <h2>PJT 이동</h2>
            <PersonPicker people={people.filter(p => p.status !== '퇴사')} value={move.id} onChange={id => setMove(m => ({ ...m, id }))} id="move" label="대상자" />
            <div className="move-row">
              <div className="field"><span>현재 PJT</span><div className="readonly">{mvP ? mvP.pjt : '—'}</div></div>
              <div className="arrow">→</div>
              <Sel label="이동 PJT" value={move.toPjt} onChange={v => setMove(m => ({ ...m, toPjt: v }))} options={pjtNames} blank="선택" />
            </div>
            <div className="form-grid">
              <label className="field"><span>이동일</span><input type="date" value={move.date} onChange={e => setMove(m => ({ ...m, date: e.target.value }))} /></label>
              <Sel label="직무 변경" value={move.job} onChange={v => setMove(m => ({ ...m, job: v }))} options={codes.jobs} blank="유지" />
            </div>
            <label className="field"><span>사유</span><input value={move.reason} onChange={e => setMove(m => ({ ...m, reason: e.target.value }))} placeholder="예: 공정 투입 인원 조정" /></label>
            <Msg m={m2} />
            <button className="btn amber block" disabled={busy}>이동 처리 (이력 자동 기록)</button>
          </form>

          <form className="panel pad stack" onSubmit={doStatus}>
            <h2>퇴사 · 휴직 처리</h2>
            <p className="muted small">삭제하지 않고 상태만 변경 → 조직도에서 제외, 이력 보존 (복직 시 「재직」으로)</p>
            <PersonPicker people={people} value={st.id} onChange={id => setSt(s => ({ ...s, id }))} id="st" label="대상자" />
            <div className="form-grid">
              <Sel label="변경 상태" value={st.status} onChange={v => setSt(s => ({ ...s, status: v }))} options={codes.statuses} />
              <label className="field"><span>사유</span><input value={st.reason} onChange={e => setSt(s => ({ ...s, reason: e.target.value }))} /></label>
            </div>
            {stP && <div className="muted small">현재 상태: {stP.status}</div>}
            <Msg m={m3} />
            <div className="row-end"><button className="btn" disabled={busy}>상태 변경</button></div>
          </form>
        </div>
      </div>

      <section className="panel">
        <div className="sec-row pad-x"><h2>변경 이력</h2><input className="input" placeholder="이름·사번·항목 검색" value={hq} onChange={e => setHq(e.target.value)} /></div>
        <div className="scroll-x">
          <table className="htable">
            <thead><tr><th>일시</th><th>사번</th><th>이름</th><th>항목</th><th>이전</th><th>이후</th><th>사유</th><th>처리자</th></tr></thead>
            <tbody>
              {hist.slice(0, 100).map(h => <tr key={h.hid}><td>{h.at}</td><td>{h.id}</td><td className="b">{h.name}</td><td>{h.item}</td><td>{h.from}</td><td>{h.to}</td><td>{h.reason}</td><td>{h.by}</td></tr>)}
              {!hist.length && <tr><td colSpan={8} className="empty">이력 없음</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
