import { useMemo, useState } from 'react';
import { HQ, isLead } from '../utils.js';

// 비상연락망 — 휴대폰 기본 화면. 번호를 누르면 전화 앱으로 바로 연결(tel:)
const digits = s => String(s || '').replace(/[^0-9+]/g, '');
const ZONE_ORDER = ['SUP', 'FAB', '공통'];

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}
function MsgIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function Row({ p }) {
  const tel = digits(p.phone);
  return (
    <div className="em-row">
      <span className="em-dot">{p.name.charAt(0)}</span>
      {tel ? (
        <a className="em-info" href={`tel:${tel}`}>
          <span className="em-name">{p.name} <small>{p.rank}</small>{isLead(p) && <em className="badge lead">팀장</em>}{p.work === '일용' && <em className="badge daily">일용</em>}</span>
          <span className="em-phone">{p.phone}</span>
        </a>
      ) : (
        <span className="em-info">
          <span className="em-name">{p.name} <small>{p.rank}</small>{p.work === '일용' && <em className="badge daily">일용</em>}</span>
          <span className="em-phone none">연락처 미등록</span>
        </span>
      )}
      {tel ? <a className="em-btn sms" href={`sms:${tel}`} aria-label={`${p.name} 문자`}><MsgIcon /></a> : <span className="em-btn off" aria-hidden="true"><MsgIcon /></span>}
      {tel ? <a className="em-btn call" href={`tel:${tel}`} aria-label={`${p.name} 전화`}><PhoneIcon /></a> : <span className="em-btn off" aria-hidden="true"><PhoneIcon /></span>}
    </div>
  );
}

export default function Emergency({ data, order, user, onLogout, onDesktop }) {
  const sites = [...data.pjts.map(x => x.name).filter(n => n !== HQ), HQ];
  const [site, setSite] = useState(sites[0]);
  const [zone, setZone] = useState('전체');
  const [q, setQ] = useState('');

  const all = useMemo(() => data.people.filter(p => p.status !== '퇴사'), [data]);
  const inSite = all.filter(p => p.pjt === site);
  const zones = ZONE_ORDER.filter(z => inSite.some(p => p.zone === z));
  const hasZone = zones.length > 0;

  // 검색어가 있으면 전체 현장에서 찾기
  const searching = q.length > 0;
  let ps = searching ? all.filter(p => p.name.includes(q) || digits(p.phone).includes(digits(q) || '#')) : inSite;
  if (!searching && hasZone && zone !== '전체') ps = ps.filter(p => !p.zone || p.zone === zone || p.zone === '공통');

  const isHead = p => (site === HQ ? ['총괄', 'PM'].includes(p.job) : p.job === '현장소장');
  const heads = searching ? [] : ps.filter(isHead).sort(order.byRank);
  const rest = searching ? ps : ps.filter(p => !isHead(p));
  const sortG = (a, b) => (isLead(b) - isLead(a)) || order.byRank(a, b);

  const groups = [];
  if (searching) {
    groups.push({ key: 's', title: `검색 결과 「${q}」`, list: [...rest].sort(sortG), sub: true });
  } else {
    const zl = hasZone ? (zone === '전체' ? zones : [zone, '공통'].filter((z, i, a) => zones.includes(z) && a.indexOf(z) === i)) : [null];
    zl.forEach(z => {
      data.codes.jobs.forEach(j => {
        const list = rest.filter(p => p.job === j && (z === null || p.zone === z || (!p.zone && z === zones[0]))).sort(sortG);
        if (list.length) groups.push({ key: `${z}-${j}`, title: z ? `${z} · ${j}` : j, zone: z, list });
      });
    });
  }

  const label = n => (n === HQ ? '본사' : n.replace('P5 Ph1 ', ''));
  const count = n => all.filter(p => p.pjt === n).length;

  return (
    <div className="em">
      <div className="em-stick">
      <header className="em-top">
        <div className="em-bar">
          <div className="em-title"><span className="em-logo"><PhoneIcon /></span>비상연락망</div>
          <div className="em-user">
            {onDesktop && <button className="em-link" onClick={onDesktop}>PC 화면</button>}
            <button className="em-link" onClick={onLogout}>로그아웃</button>
          </div>
        </div>
        <label className="sr" htmlFor="em-q">이름 · 번호 검색</label>
        <input id="em-q" type="search" className="em-search" placeholder="이름 · 번호 검색 (전체 현장)" value={q} onChange={e => setQ(e.target.value.trim())} />
      </header>

      {!searching && (
        <nav className="em-tabs" aria-label="현장 선택">
          {sites.map(s => (
            <button key={s} className={'em-tab' + (s === site ? ' on' : '')} onClick={() => { setSite(s); setZone('전체'); }}>
              {label(s)}<small>{count(s)}</small>
            </button>
          ))}
        </nav>
      )}
      {!searching && hasZone && (
        <div className="em-zones">
          <span>구역</span>
          {['전체', ...zones.filter(z => z !== '공통')].map(z => (
            <button key={z} className={'em-zone' + (z === zone ? ' on' : '')} onClick={() => setZone(z)}>{z}</button>
          ))}
        </div>
      )}
      </div>

      <div className="em-body">
        {heads.length > 0 && (
          <section className="em-first" aria-label="1차 연락">
            <div className="em-first-title">1차 연락 — {site === HQ ? '본사 책임자' : '현장 책임자'}</div>
            {heads.map(p => {
              const tel = digits(p.phone);
              return (
                <div className="em-head" key={p.id}>
                  <div className="em-head-t">
                    <span className="em-head-role">{site === HQ ? p.job : '현장소장'}{p.zone ? ` · ${p.zone}` : ''}</span>
                    <span className="em-head-name">{p.name} <small>{p.rank}</small></span>
                    {tel ? <a className="em-head-phone" href={`tel:${tel}`}>{p.phone}</a> : <span className="em-phone none">연락처 미등록</span>}
                  </div>
                  {tel ? <a className="em-head-call" href={`tel:${tel}`} aria-label={`${p.name} 전화`}><PhoneIcon /></a> : <span className="em-head-call off" aria-hidden="true"><PhoneIcon /></span>}
                </div>
              );
            })}
          </section>
        )}

        {groups.map(g => (
          <section className="em-group" key={g.key} aria-label={g.title}>
            <div className={'em-ghead' + (g.zone ? ' z-' + g.zone : '')}><span>{g.title}</span><small>{g.list.length}명</small></div>
            {g.list.map(p => (
              <div key={p.id}>
                {g.sub && <div className="em-where">{p.pjt}{p.zone ? ` · ${p.zone}` : ''} · {p.job}</div>}
                <Row p={p} />
              </div>
            ))}
          </section>
        ))}
        {!groups.length && !heads.length && <div className="empty">해당 인원 없음</div>}

        <p className="em-foot">
          · 이름이나 번호를 누르면 전화 앱으로 연결됩니다<br />
          · 연락 순서: 현장소장 → {hasZone ? '구역 → ' : ''}직무별 팀장 → 팀원<br />
          · 기준: {data.baseDate} · {user.name} 님 로그인
        </p>
      </div>
    </div>
  );
}
