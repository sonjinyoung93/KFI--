import { useMemo, useState } from 'react';
import { EMPTY_FILTER, HQ, matchFilter, isLead } from '../utils.js';
import { Filters, PersonCard, DetailPanel } from './common.jsx';

export default function OrgChart({ data, order, isAdmin, go }) {
  const [f, setF] = useState(EMPTY_FILTER);
  const [sel, setSel] = useState(null);
  const vis = useMemo(() => data.people.filter(p => matchFilter(p, f)), [data, f]);
  const selP = data.people.find(p => p.id === sel);

  const sites = data.pjts.map(x => x.name).filter(n => n !== HQ);
  const siteNames = f.pjt === '전체' ? sites : f.pjt === HQ ? [] : [f.pjt];
  const hq = vis.filter(p => p.pjt === HQ).sort((a, b) => order.job(a) - order.job(b));
  const single = siteNames.length === 1;
  const sortG = (a, b) => (isLead(b) - isLead(a)) || order.byRank(a, b);

  const card = p => <PersonCard key={p.id} p={p} selected={sel === p.id} onClick={() => setSel(sel === p.id ? null : p.id)} />;

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>공사사업부 조직도</h1><p className="muted">기준일 {data.baseDate} · 카드를 누르면 상세 정보</p></div>
        <div className="legend"><span><i className="dot head" />현장소장</span><span><span className="badge lead">팀장</span></span><span><span className="badge daily">일용</span>일용직</span></div>
      </div>
      <Filters data={data} f={f} setF={setF} shown={vis.length} isAdmin={isAdmin} />
      <div className={'with-detail' + (selP ? ' open' : '')}>
        <div className="stack grow minw0">
          {(f.pjt === '전체' || f.pjt === HQ) && hq.length > 0 && (
            <section className="hq">
              <div className="hq-box">
                <div className="hq-title"><span>본사 (공통)</span><span className="muted">{hq.length}명</span></div>
                <div className="hq-grid">{hq.map(p => <div key={p.id}><div className="hq-job">{p.job}</div>{card(p)}</div>)}</div>
              </div>
              <div className="hq-stem" /><div className="hq-bar" />
            </section>
          )}
          <div className={'sites' + (single ? ' single' : '')}>
            {siteNames.map(n => {
              const ps = vis.filter(p => p.pjt === n);
              const groups = data.codes.jobs.map(j => ({ j, list: ps.filter(p => p.job === j).sort(sortG) })).filter(g => g.list.length);
              return (
                <section className="site" key={n} aria-label={n}>
                  <div className="site-head">
                    <span className="site-name">{n}</span>
                    <span className="site-cnt"><b>{ps.length}명</b><small>상용 {ps.filter(p => p.work === '상용').length} · 일용 {ps.filter(p => p.work === '일용').length}</small></span>
                  </div>
                  <div className="site-body">
                    {!ps.length && <div className="empty">조건에 맞는 인원 없음</div>}
                    {groups.map(g => (
                      <div key={g.j} className="grp">
                        <div className="grp-head"><b>{g.j}</b><span>{g.list.length}</span><i /></div>
                        <div className={'grp-grid' + (single ? ' wide' : '') + (selP ? ' narrow' : '')}>{g.list.map(card)}</div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
        {selP && <DetailPanel p={selP} data={data} isAdmin={isAdmin} go={go} onClose={() => setSel(null)} />}
      </div>
    </div>
  );
}
