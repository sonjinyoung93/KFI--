import { useMemo, useState } from 'react';
import { HQ, rolesOf, isLead, TOP_ROLES } from '../utils.js';
import { Avatar } from './common.jsx';
import { exportSitePpt } from '../exportPpt.js';

// PJT별 조직도 (공사 개요 양식): 상단 책임기술자·현장소장·선임안전 / 직무별 칸 / 투입 현황표
export function buildSite(data, order, site) {
  const ps = data.people.filter(p => p.pjt === site && p.status === '재직');
  const withRole = r => ps.filter(p => rolesOf(p).includes(r)).sort(order.byRank);
  const heads = ps.filter(p => p.job === '현장소장').sort(order.byRank);
  const top = [
    { title: '책임기술자', people: withRole('책임기술자').map(p => ({ p, label: '책임기술자' })) },
    { title: '현장 소장', people: heads.map(p => ({ p, label: '현장 소장' })) },
    { title: '선임 안전관리자', people: withRole('선임 안전관리자').map(p => ({ p, label: '선임 안전관리자' })) },
  ];
  const pr = p => (isLead(p) ? -2 : rolesOf(p).includes('선임 안전관리자') ? -1 : rolesOf(p).length ? 0 : 1);
  const cols = data.codes.jobs.filter(j => j !== '현장소장').map(j => {
    const list = ps.filter(p => p.job === j).sort((a, b) => pr(a) - pr(b) || order.byRank(a, b));
    const leads = list.filter(isLead);
    return {
      job: j, list: list.map(p => {
        const extra = rolesOf(p).filter(r => !TOP_ROLES.includes(r));
        return { p, label: isLead(p) ? `${j} 팀장` : (extra[0] || j), lead: isLead(p) };
      }),
      leadText: leads.length ? leads.map(p => `${p.name} ${p.rank}`).join(', ') : '',
    };
  }).filter(c => c.list.length);
  const summary = [{ k: '현장소장', v: heads.length }, ...cols.map(c => ({ k: c.job, v: c.list.length }))];
  return { site, ps, top, cols, summary, total: ps.length };
}

function OrgCard({ p, label, lead }) {
  return (
    <div className="ocard">
      <Avatar p={p} size={46} shape="rect" />
      <div className="ocard-t">
        <div className={'ocard-role' + (lead ? ' lead' : '')}>{label}</div>
        <div className="ocard-name">{p.name} <span>{p.rank}</span>{p.work === '일용' && <em className="badge daily">일용</em>}</div>
        <div className="ocard-phone">{p.phone || '연락처 미등록'}</div>
      </div>
    </div>
  );
}

export default function SiteChart({ data, order }) {
  const sites = data.pjts.map(x => x.name).filter(n => n !== HQ);
  const [site, setSite] = useState(() => sites.includes('P5 Ph1 중공업') ? 'P5 Ph1 중공업' : sites[0]);
  const [busy, setBusy] = useState(false);
  const S = useMemo(() => buildSite(data, order, site), [data, order, site]);
  const n = S.cols.length || 1;
  const sum = [...S.summary, { k: '합계', v: S.total, total: true }];
  while (sum.length % 5) sum.push({ k: '', v: '' });

  const ppt = async () => { setBusy(true); try { await exportSitePpt(S, data.baseDate); } finally { setBusy(false); } };

  return (
    <div className="stack">
      <div className="tabsbar no-print">
        {sites.map(s => (
          <button key={s} className={'tab' + (s === site ? ' on' : '')} onClick={() => setSite(s)}>
            {s}<small>{data.people.filter(p => p.pjt === s && p.status === '재직').length}명</small>
          </button>
        ))}
        <div className="grow" />
        <button className="btn" onClick={() => window.print()}>인쇄 · PDF</button>
        <button className="btn" onClick={ppt} disabled={busy}>{busy ? '만드는 중…' : 'PPT 내보내기'}</button>
      </div>

      <section className="panel sheet print-area">
        <div className="sheet-head">
          <h1>공사 개요 <small>(조직도)</small></h1>
          <div><span className="muted">기준일 {data.baseDate}</span><span className="sheet-site">{site}</span></div>
        </div>
        <div className="sheet-scroll">
          <div className="sheet-body">
            <div className="sheet-top">
              <div className="top-wrap">
                <div className="top-row">
                  {S.top.map((slot, i) => (
                    <div className="top-cell" key={slot.title}>
                      {i > 0 && <div className="top-line" />}
                      <div className="top-slot">
                        <div className="slot-title">{slot.title}</div>
                        {slot.people.length ? slot.people.map(x => <OrgCard key={x.p.id} {...x} />) : <div className="slot-empty"><b>미지정</b><span>관리 화면에서 역할 지정</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="top-stem" />
              </div>
              <aside className="sum">
                <div className="sum-title">관리자 투입 현황</div>
                <div className="sum-grid">
                  {sum.map((c, i) => (
                    <div key={i} className={'sum-cell' + (c.total ? ' total' : '')}><div>{c.k || ' '}</div><div>{c.v !== '' ? c.v + '명' : ' '}</div></div>
                  ))}
                </div>
              </aside>
            </div>
            <div className="cols" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
              <div className="bus" style={{ left: `calc(${100 / n / 2}% - ${(16 * (n - 1)) / n / 2}px)`, right: `calc(${100 / n / 2}% - ${(16 * (n - 1)) / n / 2}px)` }} />
              {S.cols.map(c => (
                <div className="col" key={c.job}>
                  <div className="col-stem" />
                  <div className="col-head">{c.job}<small>{c.list.length}</small></div>
                  <div className={'col-lead' + (c.leadText ? ' on' : '')}>팀장 · {c.leadText || '미지정'}</div>
                  {c.list.map(x => <OrgCard key={x.p.id} {...x} />)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <p className="muted small no-print">· 인원 시트 기준 자동 배치 (PJT 이동·등록 즉시 반영) · 상단 자리는 인원별 「역할」, 팀장은 「팀장」 값으로 지정</p>
    </div>
  );
}
