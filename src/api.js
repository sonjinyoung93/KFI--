// API 클라이언트 — VITE_API_URL(Apps Script 웹앱 URL) 설정 시 실서버, 미설정 시 데모 모드
import seed from './mockData.js';

const API_URL = import.meta.env.VITE_API_URL || '';
export const DEMO = !API_URL;

const TOKEN_KEY = 'orgchart_token';
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

export function getToken() { return store.get(TOKEN_KEY); }
export function clearToken() { store.del(TOKEN_KEY); }

async function call(action, body = {}) {
  if (DEMO) return demo(action, body);
  const res = await fetch(API_URL, {
    method: 'POST',
    // text/plain → CORS 사전요청 없이 Apps Script 호출
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: getToken(), ...body }),
  });
  const data = await res.json();
  if (data.error === 'AUTH') { clearToken(); throw Object.assign(new Error(data.message || '로그인 필요'), { auth: true }); }
  if (!data.ok) throw new Error(data.error || '요청 실패');
  return data;
}

export async function login(id, pw) {
  const r = await call('login', { id, pw });
  store.set(TOKEN_KEY, r.token);
  return r.user;
}
export const bootstrap = () => call('bootstrap');
export const savePerson = (person, reason) => call('savePerson', { person, reason });
export const movePerson = (p) => call('movePerson', p);
export const setStatus = (p) => call('setStatus', p);
export const uploadPhoto = (id, base64) => call('uploadPhoto', { id, base64, mime: 'image/jpeg' });
export const changePassword = (oldPw, newPw) => call('changePassword', { oldPw, newPw });

// 사진: 요청 1회만, 메모리 캐시
const photoCache = new Map();
export function getPhoto(photoId) {
  if (!photoId) return Promise.resolve(null);
  if (!photoCache.has(photoId)) {
    photoCache.set(photoId, call('photo', { photoId }).then(r => r.dataUrl).catch(() => null));
  }
  return photoCache.get(photoId);
}

// ───────────────── 데모 모드 (브라우저 메모리)
const DEMO_ACCOUNTS = { admin: { pw: 'admin1234', name: '관리자', role: 'admin' }, viewer: { pw: 'viewer1234', name: '열람자', role: 'viewer' } };
const db = JSON.parse(JSON.stringify(seed));
const demoPhotos = {};
let demoUser = null;
const now = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; };
const TRACKED = { pjt: '소속PJT', job: '직무', rank: '직급', status: '재직상태', role: '역할', lead: '팀장', work: '근무형태' };

function demoHist(p, item, from, to, reason) {
  db.history.unshift({ hid: 'H' + String(db.history.length + 1).padStart(4, '0'), at: now(), id: p.id, name: p.name, item, from: from ?? '', to: to ?? '', reason: reason || '', by: demoUser?.id || 'admin' });
}

function demoSave(person, reason) {
  if (!person.id) {
    const max = db.people.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, '')) || 0), 0);
    const p = { status: '재직', lead: 'N', role: '', phone: '', photoId: '', note: '', startDate: '', ...person, id: 'E' + String(max + 1).padStart(3, '0'), updatedAt: now(), updatedBy: demoUser?.id };
    db.people.push(p);
    demoHist(p, '신규 등록', '', `${p.pjt} / ${p.job}`, reason);
    return { ok: true, person: p };
  }
  const i = db.people.findIndex(p => p.id === person.id);
  if (i < 0) throw new Error('사번 없음');
  const before = db.people[i];
  Object.keys(TRACKED).forEach(k => {
    if (person[k] !== undefined && String(person[k] ?? '') !== String(before[k] ?? '')) demoHist(before, TRACKED[k], before[k], person[k], reason);
  });
  db.people[i] = { ...before, ...person, updatedAt: now(), updatedBy: demoUser?.id };
  return { ok: true, person: db.people[i] };
}

async function demo(action, b) {
  await new Promise(r => setTimeout(r, 120));
  if (action === 'login') {
    const a = DEMO_ACCOUNTS[b.id];
    if (!a || a.pw !== b.pw) throw new Error('아이디 또는 비밀번호 확인');
    demoUser = { id: b.id, name: a.name, role: a.role };
    return { ok: true, token: 'demo.' + b.id, user: demoUser };
  }
  if (!demoUser) {
    const t = getToken();
    if (t && t.startsWith('demo.') && DEMO_ACCOUNTS[t.slice(5)]) { const id = t.slice(5); demoUser = { id, name: DEMO_ACCOUNTS[id].name, role: DEMO_ACCOUNTS[id].role }; }
    else throw Object.assign(new Error('로그인 필요'), { auth: true });
  }
  const admin = () => { if (demoUser.role !== 'admin') throw new Error('admin 권한 필요'); };
  switch (action) {
    case 'bootstrap':
      return { ok: true, user: demoUser, people: db.people.filter(p => demoUser.role === 'admin' || p.status !== '퇴사').map(p => ({ ...p })), pjts: db.pjts, codes: db.codes, baseDate: db.baseDate, history: db.history.slice(0, 300) };
    case 'photo': return { ok: true, dataUrl: demoPhotos[b.photoId] || null };
    case 'savePerson': admin(); return demoSave(b.person, b.reason);
    case 'movePerson': { admin(); const p = { id: b.id, pjt: b.toPjt }; if (b.job) p.job = b.job; if (b.date) p.startDate = b.date; return demoSave(p, b.reason || 'PJT 이동'); }
    case 'setStatus': admin(); return demoSave({ id: b.id, status: b.status }, b.reason);
    case 'uploadPhoto': { admin(); const pid = 'demo_' + b.id + '_' + Date.now(); demoPhotos[pid] = b.base64; photoCache.delete(pid); demoSave({ id: b.id, photoId: pid }, '사진 등록'); return { ok: true, photoId: pid }; }
    case 'changePassword': return { ok: true };
    default: throw new Error('알 수 없는 요청');
  }
}
