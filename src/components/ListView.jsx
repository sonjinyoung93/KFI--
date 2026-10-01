import { useMemo, useState } from 'react';
import { EMPTY_FILTER, matchFilter, downloadCsv } from '../utils.js';
import { Filters, Avatar } from './common.jsx';

export default function ListView({ data, order, isAdmin, go }) {
  const [f, setF] = useState(EMPTY_FILTER);
  const [sort, setSort] = useState('pjt');
  const pjtIdx = Object.fromEntries(data.pjts.map((p, i) => [p.name, i]));
  const vis = useMemo(() => {
    const v = data.people.filter(p => matchFilter(p, f));
    const by = {
      pjt: (a, b) => (pjtIdx[a.pjt] ?? 99) - (pjtIdx[b.pjt] ?? 99) || order.job(a) - order.job(b) || order.byRank(a, b),
      rank: (a, b) => order.byRank(a, b),
      job: (a, b) => order.job(a) - order.job(b) || order.byRank(a, b),
      name: (a, b) => a.name.localeCompare(b.name, 'ko'),
      id: (a, b) => a.id.localeCompare(b.id),
    }[sort];
    return v.sort(by);
  }, [data, f, sort, order]); // eslint-disable-line react-hooks/exhaustive-deps

  const tiles = [{ label: '전체', fn: () => true }, ...data.pjts.map(x => ({ label: x.name, fn: p => p.pjt === x.name }))].map(t => {
    const ps = vis.filter(t.fn);
    return { ...t, n: ps.length, reg: ps.filter(p => p.work === '상용').length, daily: ps.filter(p => p.work === '일용').length };
  });

  const csv = () => downloadCsv(`인원명단_${data.baseDate}.csv`, [
    ['사번', '이름', '직급', '직무', '소속PJT', '근무형태', '재직상태', '역할', '팀장', '투입일', '연락처', '비고'],
    ...vis.map(p => [p.id, p.name, p.rank, p.job, p.pjt, p.work, p.status, p.role, p.lead, p.startDate, p.phone, p.note]),
  ]);

  const H = ({ k, children }) => <button className={'th' + (sort === k ? ' on' : '')} onClick={() => setSort(k)}>{children}{sort === k ? ' ▾' : ''}</button>;

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>인원 명단 · 현황</h1><p className="muted">필터 조건이 현황표와 명단에 함께 적용</p></div>
        <div className="row-gap">
          <button className="btn" onClick={csv}>엑셀(CSV) 다운로드</button>
          {isAdmin && <button className="btn primary" onClick={() => go('admin', 'new')}>+ 인원 추가</button>}
        </div>
      </div>
      <Filters data={data} f={f} setF={setF} shown={vis.length} isAdmin={isAdmin} />
      <div className="tiles">
        {tiles.map(t => (
          <div className="tile" key={t.label}><span className="muted">{t.label}</span><b>{t.n}<small> 명</small></b><span className="muted small">상용 {t.reg} · 일용 {t.daily}</span></div>
        ))}
      </div>
      <section className="panel matrix-wrap">
        <div className="sec-title">직무 × 현장 인원</div>
        <div className="scroll-x">
          <table className="matrix">
            <thead><tr><th>직무</th>{data.pjts.map(p => <th key={p.name}>{p.name}</th>)}<th>합계</th></tr></thead>
            <tbody>
              {data.codes.jobs.map(j => {
                const row = vis.filter(p => p.job === j);
                return (
                  <tr key={j}><th>{j}</th>{data.pjts.map(x => { const c = row.filter(p => p.pjt === x.name).length; return <td key={x.name} className={c ? '' : 'zero'}>{c || '-'}</td>; })}<td className="tot">{row.length || '-'}</td></tr>
                );
              })}
              <tr className="tot-row"><th>합계</th>{data.pjts.map(x => <td key={x.name}>{vis.filter(p => p.pjt === x.name).length}</td>)}<td>{vis.length}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel table-wrap">
        <div className="scroll-x">
          <div className="ptable">
            <div className="ptr phead">
              <H k="id">사번</H><span>사진</span><H k="name">이름</H><H k="rank">직급</H><H k="job">직무</H><H k="pjt">소속 PJT</H><span>근무</span><span>상태</span><span>연락처</span>{isAdmin && <span>관리</span>}
            </div>
            {vis.map(p => (
              <div className="ptr" key={p.id}>
                <span className="muted small">{p.id}</span>
                <span><Avatar p={p} size={32} /></span>
                <span className="b">{p.name}{p.lead === 'Y' && <em className="badge lead">팀장</em>}</span>
                <span>{p.rank}</span><span>{p.job}</span><span>{p.pjt}</span><span>{p.work}</span>
                <span><em className={'st st-' + p.status}>{p.status}</em></span>
                <span className="small">{p.phone || '—'}</span>
                {isAdmin && <span><button className="linkbtn dark" onClick={() => go('admin', p.id)}>수정 · 이동</button></span>}
              </div>
            ))}
            {!vis.length && <div className="empty">조건에 맞는 인원 없음</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
