// 공통 정렬·필터·표시 유틸
export const HQ = '공통';
export const TOP_ROLES = ['책임기술자', '선임 안전관리자'];

export function rolesOf(p) {
  return String(p.role || '').split(',').map(s => s.trim()).filter(Boolean);
}
export const isLead = p => p.lead === 'Y';
export const isActive = p => p.status !== '퇴사';

export function makeOrder(codes) {
  const r = Object.fromEntries(codes.ranks.map((k, i) => [k, i]));
  const j = Object.fromEntries(codes.jobs.map((k, i) => [k, i]));
  return {
    rank: p => r[p.rank] ?? 99,
    job: p => j[p.job] ?? 99,
    byRank: (a, b) => (r[a.rank] ?? 99) - (r[b.rank] ?? 99) || a.name.localeCompare(b.name, 'ko'),
  };
}

export const EMPTY_FILTER = { pjt: '전체', jobs: [], ranks: [], work: '전체', status: '재직', q: '' };

export function matchFilter(p, f) {
  return (f.pjt === '전체' || p.pjt === f.pjt)
    && (!f.jobs.length || f.jobs.includes(p.job))
    && (!f.ranks.length || f.ranks.includes(p.rank))
    && (f.work === '전체' || p.work === f.work)
    && (!f.status || f.status === '전체' || p.status === f.status)
    && (!f.q || p.name.includes(f.q) || (p.phone || '').includes(f.q) || p.id.includes(f.q));
}

export const isFiltered = f => f.pjt !== '전체' || f.jobs.length || f.ranks.length || f.work !== '전체' || f.q || (f.status && f.status !== '재직');

export function maskPhone(s) { return s || '연락처 미등록'; }

export function today() {
  const d = new Date();
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

// 사진: 3:4 비율로 잘라 300x400 JPEG 로 축소 (업로드 용량 최소화)
export function resizeImage(file, w = 300, h = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const s = Math.max(w / img.width, h / img.height);
      const sw = w / s, sh = h / s;
      c.getContext('2d').drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function downloadCsv(filename, rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
