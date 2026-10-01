import { useEffect, useState } from 'react';
import { getPhoto } from '../api.js';
import { isLead } from '../utils.js';

// 사진(없으면 이름 첫 글자)
export function Avatar({ p, size = 40, shape = 'circle', head = false }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    setSrc(null);
    if (p.photoId) getPhoto(p.photoId).then(u => { if (alive) setSrc(u); });
    return () => { alive = false; };
  }, [p.photoId]);
  const style = shape === 'circle'
    ? { width: size, height: size, borderRadius: size / 2 }
    : { width: size, height: Math.round(size * 4 / 3), borderRadius: 8 };
  return (
    <span className={'avatar' + (head ? ' head' : '')} style={{ ...style, fontSize: Math.round(size * 0.38) }}>
      {src ? <img src={src} alt="" /> : p.name.charAt(0)}
    </span>
  );
}

export function PersonCard({ p, selected, onClick }) {
  return (
    <button type="button" className={'pcard' + (selected ? ' sel' : '')} onClick={onClick} aria-label={`${p.name} ${p.rank} 상세`}>
      <Avatar p={p} head={p.job === '현장소장'} />
      <span className="pcard-text">
        <span className="pname">{p.name}</span>
        <span className="prank">{p.rank}</span>
      </span>
      {isLead(p) && <span className="badge lead">팀장</span>}
      {p.work === '일용' && <span className="badge daily">일용</span>}
      {p.status === '휴직' && <span className="badge off">휴직</span>}
    </button>
  );
}

function ChipRow({ label, items, isOn, onPick, hint }) {
  return (
    <div className="chiprow">
      <div className="chiprow-label">{label}</div>
      <div className="chips">
        {items.map(it => (
          <button type="button" key={it.v} className={'chip' + (isOn(it.v) ? ' on' : '')} onClick={() => onPick(it.v)}>
            {it.v}<span className="chip-n">{it.n}</span>
          </button>
        ))}
      </div>
      {hint && <div className="chiprow-hint">{hint}</div>}
    </div>
  );
}

export function Filters({ data, f, setF, shown, showPjt = true, isAdmin }) {
  const P = data.people;
  const cnt = fn => P.filter(fn).length;
  const tog = (k, v) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v] });
  const statuses = isAdmin ? ['재직', '휴직', '퇴사', '전체'] : ['재직', '휴직', '전체'];
  const [open, setOpen] = useState(() => { try { return !window.matchMedia('(max-width: 640px)').matches; } catch { return true; } });
  return (
    <section className="panel filters" aria-label="필터">
      <div className="filters-top">
        <label className="sr" htmlFor="q">검색</label>
        <input id="q" type="search" className="input search" placeholder="이름 · 사번 · 연락처 검색" value={f.q} onChange={e => setF({ ...f, q: e.target.value.trim() })} />
        <div className="grow" />
        <span className="count">표시 <strong>{shown}</strong>명 / 전체 {cnt(p => p.status !== '퇴사')}명</span>
        <button type="button" className="btn" onClick={() => setF({ pjt: '전체', jobs: [], ranks: [], work: '전체', status: '재직', q: '' })}>필터 초기화</button>
        <button type="button" className="btn only-sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '필터 접기' : '필터 펼치기'}</button>
      </div>
      {open && <>
      {showPjt && <ChipRow label="PJT" items={['전체', ...data.pjts.map(x => x.name)].map(v => ({ v, n: v === '전체' ? cnt(p => p.status === '재직') : cnt(p => p.pjt === v && p.status === '재직') }))} isOn={v => f.pjt === v} onPick={v => setF({ ...f, pjt: v })} />}
      <ChipRow label="직무" hint="복수 선택" items={data.codes.jobs.map(v => ({ v, n: cnt(p => p.job === v && p.status === '재직') }))} isOn={v => f.jobs.includes(v)} onPick={v => tog('jobs', v)} />
      <ChipRow label="직급" hint="복수 선택" items={data.codes.ranks.map(v => ({ v, n: cnt(p => p.rank === v && p.status === '재직') }))} isOn={v => f.ranks.includes(v)} onPick={v => tog('ranks', v)} />
      <div className="chiprow-pair">
        <ChipRow label="근무" items={['전체', ...data.codes.works].map(v => ({ v, n: v === '전체' ? cnt(p => p.status === '재직') : cnt(p => p.work === v && p.status === '재직') }))} isOn={v => f.work === v} onPick={v => setF({ ...f, work: v })} />
        <ChipRow label="상태" items={statuses.map(v => ({ v, n: v === '전체' ? P.length : cnt(p => p.status === v) }))} isOn={v => f.status === v} onPick={v => setF({ ...f, status: v })} />
      </div>
      </>}
    </section>
  );
}

export function DetailPanel({ p, data, isAdmin, go, onClose }) {
  const hist = data.history.filter(h => h.id === p.id);
  const rows = [['사번', p.id], ['직급', p.rank], ['직무', p.job], ['소속 PJT', p.pjt], ['역할', p.role || '—'], ['팀장', p.lead === 'Y' ? '지정' : '—'],
    ['근무형태', p.work], ['재직상태', p.status], ['투입일', p.startDate || '—'], ['연락처', p.phone || '—'], ['비고', p.note || '—']];
  return (
    <aside className="detail" aria-label="인원 상세">
      <div className="detail-head">
        <button className="iconbtn" onClick={onClose} aria-label="닫기">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12" /></svg>
        </button>
        <Avatar p={p} size={110} shape="rect" />
        <div className="detail-name">{p.name} <span>{p.rank}</span></div>
        <div className="detail-sub">{p.pjt} · {p.job}</div>
      </div>
      <div className="detail-body">
        {rows.map(([k, v]) => <div className="kv" key={k}><span>{k}</span><span>{v}</span></div>)}
        <div className="detail-sec">변경 이력</div>
        {hist.length ? hist.slice(0, 8).map(h => (
          <div className="hist" key={h.hid}><span className="muted small">{h.at} · {h.item}</span><span><b>{h.from || '—'}</b> → <b>{h.to || '—'}</b></span>{h.reason && <span className="muted small">{h.reason}</span>}</div>
        )) : <div className="muted small">이력 없음</div>}
        {isAdmin && (
          <div className="row-gap">
            <button className="btn primary grow" onClick={() => go('admin', p.id)}>수정 · PJT 이동</button>
          </div>
        )}
      </div>
    </aside>
  );
}
