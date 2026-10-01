/**
 * 건국이엔아이 조직도 시스템 — Google Apps Script API
 * 시트: 인원 / PJT / 코드 / 이동이력 / 계정 / 설정
 *
 * 배포: 확장 프로그램 > Apps Script 에 붙여넣기 → 메뉴 [조직도 > 초기 설정] 1회 실행
 *       → 배포 > 새 배포 > 웹 앱 (실행: 나, 액세스: 모든 사용자) → URL 을 Vercel 환경변수 VITE_API_URL 로
 */

// ───────────────────────── 시트 / 컬럼 정의
const SH = { PEOPLE: '인원', PJT: 'PJT', CODE: '코드', HIST: '이동이력', ACCT: '계정', CONF: '설정' };

// 시트 헤더(한글) ↔ API 키(영문)
const PEOPLE_COLS = {
  '사번': 'id', '이름': 'name', '직급': 'rank', '직무': 'job', '소속PJT': 'pjt', '근무형태': 'work',
  '재직상태': 'status', '투입일': 'startDate', '연락처': 'phone', '사진ID': 'photoId', '비고': 'note',
  '수정일': 'updatedAt', '수정자': 'updatedBy', '역할': 'role', '팀장': 'lead'
};
// 변경 시 이력에 남길 항목
const TRACKED = { pjt: '소속PJT', job: '직무', rank: '직급', status: '재직상태', role: '역할', lead: '팀장', work: '근무형태' };

// ───────────────────────── 메뉴
function onOpen() {
  SpreadsheetApp.getUi().createMenu('조직도')
    .addItem('초기 설정 (최초 1회)', 'setup')
    .addItem('비밀번호 설정', 'menuSetPassword')
    .addToUi();
}

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SECRET')) props.setProperty('SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!props.getProperty('SALT')) props.setProperty('SALT', Utilities.getUuid());
  let folderId = conf_('PHOTO_FOLDER_ID');
  if (!folderId) {
    const ss = SpreadsheetApp.getActive();
    const parent = DriveApp.getFileById(ss.getId()).getParents();
    const base = parent.hasNext() ? parent.next() : DriveApp.getRootFolder();
    folderId = base.createFolder('조직도_사진').getId();
    setConf_('PHOTO_FOLDER_ID', folderId);
  }
  SpreadsheetApp.getUi().alert('초기 설정 완료\n사진 폴더 ID: ' + folderId + '\n다음: [조직도 > 비밀번호 설정]으로 admin 비밀번호 지정');
}

function menuSetPassword() {
  const ui = SpreadsheetApp.getUi();
  const r1 = ui.prompt('비밀번호 설정', '아이디', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const r2 = ui.prompt('비밀번호 설정', '새 비밀번호 (6자 이상)', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  const id = r1.getResponseText().trim(), pw = r2.getResponseText();
  if (pw.length < 6) return ui.alert('6자 이상 입력');
  ui.alert(setPassword_(id, pw) ? '설정 완료: ' + id : '계정 탭에 없는 아이디: ' + id);
}

// ───────────────────────── HTTP 진입점
function doGet() {
  return json_({ ok: true, service: 'orgchart', time: new Date().toISOString() });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents || '{}'); } catch (err) { return json_({ ok: false, error: '잘못된 요청' }); }
  try {
    const action = req.action;
    if (action === 'login') return json_(login_(req.id, req.pw));
    const user = verify_(req.token);
    if (!user) return json_({ ok: false, error: 'AUTH', message: '로그인이 만료되었습니다' });
    const admin = () => { if (user.role !== 'admin') throw new Error('admin 권한 필요'); };
    switch (action) {
      case 'bootstrap': return json_(bootstrap_(user));
      case 'photo': return json_(photo_(req.photoId));
      case 'changePassword': return json_(changePassword_(user, req.oldPw, req.newPw));
      case 'savePerson': admin(); return json_(withLock_(() => savePerson_(user, req.person, req.reason)));
      case 'movePerson': admin(); return json_(withLock_(() => movePerson_(user, req)));
      case 'setStatus': admin(); return json_(withLock_(() => setStatus_(user, req)));
      case 'uploadPhoto': admin(); return json_(withLock_(() => uploadPhoto_(user, req)));
      case 'history': admin(); return json_({ ok: true, history: readHistory_(500) });
      default: return json_({ ok: false, error: '알 수 없는 요청: ' + action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

// ───────────────────────── 인증
function login_(id, pw) {
  const acct = readTable_(SH.ACCT).find(a => String(a['아이디']).trim() === String(id || '').trim());
  if (!acct || String(acct['사용여부']).trim() !== 'Y') return { ok: false, error: '아이디 또는 비밀번호 확인' };
  if (!acct['비밀번호해시'] || hash_(pw) !== acct['비밀번호해시']) return { ok: false, error: '아이디 또는 비밀번호 확인' };
  const hours = Number(conf_('SESSION_HOURS') || 12);
  const user = { id: acct['아이디'], name: acct['이름'] || acct['아이디'], role: acct['권한'] === 'admin' ? 'admin' : 'viewer' };
  return { ok: true, token: sign_(Object.assign({ exp: Date.now() + hours * 3600e3 }, user)), user };
}

function changePassword_(user, oldPw, newPw) {
  const acct = readTable_(SH.ACCT).find(a => a['아이디'] === user.id);
  if (!acct || hash_(oldPw) !== acct['비밀번호해시']) return { ok: false, error: '현재 비밀번호 불일치' };
  if (!newPw || newPw.length < 6) return { ok: false, error: '6자 이상 입력' };
  setPassword_(user.id, newPw);
  return { ok: true };
}

function setPassword_(id, pw) {
  const sh = sheet_(SH.ACCT), v = sh.getDataRange().getValues(), h = v[0];
  const ci = h.indexOf('아이디'), cp = h.indexOf('비밀번호해시');
  for (let r = 1; r < v.length; r++) if (String(v[r][ci]).trim() === id) { sh.getRange(r + 1, cp + 1).setValue(hash_(pw)); return true; }
  return false;
}

function hash_(pw) {
  const salt = PropertiesService.getScriptProperties().getProperty('SALT') || '';
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + String(pw || ''), Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

function sign_(payload) {
  const body = Utilities.base64EncodeWebSafe(JSON.stringify(payload), Utilities.Charset.UTF_8);
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, secret_()));
  return body + '.' + sig;
}

function verify_(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  const good = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, secret_()));
  if (sig !== good) return null;
  const p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(body)).getDataAsString('UTF-8'));
  return p.exp > Date.now() ? p : null;
}

function secret_() {
  const s = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!s) throw new Error('초기 설정(setup)이 필요합니다');
  return s;
}

// ───────────────────────── 조회
function bootstrap_(user) {
  const people = readPeople_().filter(p => user.role === 'admin' || p.status !== '퇴사');
  const pjts = readTable_(SH.PJT).filter(r => String(r['사용여부'] || 'Y') === 'Y')
    .sort((a, b) => Number(a['표시순서'] || 99) - Number(b['표시순서'] || 99))
    .map(r => ({ code: r['PJT코드'], name: String(r['PJT명']).trim(), client: r['발주처'] || '' }));
  const code = sheet_(SH.CODE).getDataRange().getValues();
  const col = (name) => { const i = code[0].indexOf(name); return i < 0 ? [] : code.slice(1).map(r => String(r[i]).trim()).filter(Boolean); };
  return {
    ok: true, user,
    people, pjts,
    codes: { ranks: col('직급'), jobs: col('직무'), works: col('근무형태'), statuses: col('재직상태'), roles: col('역할') },
    baseDate: conf_('BASE_DATE') || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'),
    history: readHistory_(300)
  };
}

function photo_(photoId) {
  if (!photoId) return { ok: false, error: '사진 없음' };
  const cache = CacheService.getScriptCache(), key = 'ph_' + photoId;
  const hit = cache.get(key);
  if (hit) return { ok: true, dataUrl: hit };
  const blob = DriveApp.getFileById(photoId).getBlob();
  const dataUrl = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  if (dataUrl.length < 95000) cache.put(key, dataUrl, 21600);
  return { ok: true, dataUrl };
}

// ───────────────────────── 쓰기
function savePerson_(user, p, reason) {
  if (!p || !p.name || !p.rank || !p.job || !p.pjt || !p.work) throw new Error('필수 항목 누락 (이름·직급·직무·PJT·근무형태)');
  const sh = sheet_(SH.PEOPLE), v = sh.getDataRange().getValues(), h = v[0];
  const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  if (!p.id) {
    // 신규
    const max = v.slice(1).reduce((m, r) => Math.max(m, Number(String(r[h.indexOf('사번')]).replace(/\D/g, '')) || 0), 0);
    p.id = 'E' + String(max + 1).padStart(3, '0');
    p.status = p.status || '재직';
    p.lead = p.lead || 'N';
    p.updatedAt = now; p.updatedBy = user.id;
    sh.appendRow(h.map(k => PEOPLE_COLS[k] ? (p[PEOPLE_COLS[k]] ?? '') : ''));
    addHistory_(user, p, '신규 등록', '', p.pjt + ' / ' + p.job, reason || '');
    return { ok: true, person: p };
  }
  const r = findRow_(v, h, p.id);
  if (r < 0) throw new Error('사번 없음: ' + p.id);
  const before = rowToPerson_(h, v[r]);
  Object.keys(TRACKED).forEach(k => {
    if (p[k] !== undefined && String(p[k] ?? '') !== String(before[k] ?? '')) addHistory_(user, before, TRACKED[k], before[k], p[k], reason || '');
  });
  p.updatedAt = now; p.updatedBy = user.id;
  const row = h.map((k, i) => (PEOPLE_COLS[k] && p[PEOPLE_COLS[k]] !== undefined && PEOPLE_COLS[k] !== 'id') ? p[PEOPLE_COLS[k]] : v[r][i]);
  sh.getRange(r + 1, 1, 1, h.length).setValues([row]);
  return { ok: true, person: rowToPerson_(h, row) };
}

function movePerson_(user, req) {
  const patch = { id: req.id, pjt: req.toPjt };
  if (req.job) patch.job = req.job;
  if (req.date) patch.startDate = req.date;
  return savePerson_(user, patch_(req.id, patch), req.reason || 'PJT 이동');
}

function setStatus_(user, req) {
  return savePerson_(user, patch_(req.id, { status: req.status }), req.reason || '');
}

function uploadPhoto_(user, req) {
  const folderId = conf_('PHOTO_FOLDER_ID');
  if (!folderId) throw new Error('초기 설정(setup)이 필요합니다');
  const bytes = Utilities.base64Decode(String(req.base64).replace(/^data:[^,]+,/, ''));
  const blob = Utilities.newBlob(bytes, req.mime || 'image/jpeg', req.id + '.jpg');
  const folder = DriveApp.getFolderById(folderId);
  const old = folder.getFilesByName(req.id + '.jpg');
  while (old.hasNext()) old.next().setTrashed(true);
  const file = folder.createFile(blob);
  savePerson_(user, patch_(req.id, { photoId: file.getId() }), '사진 등록');
  CacheService.getScriptCache().remove('ph_' + file.getId());
  return { ok: true, photoId: file.getId() };
}

// ───────────────────────── 유틸
function patch_(id, fields) {
  const sh = sheet_(SH.PEOPLE), v = sh.getDataRange().getValues(), h = v[0];
  const r = findRow_(v, h, id);
  if (r < 0) throw new Error('사번 없음: ' + id);
  return Object.assign(rowToPerson_(h, v[r]), fields);
}

function readPeople_() {
  const v = sheet_(SH.PEOPLE).getDataRange().getValues(), h = v[0];
  return v.slice(1).filter(r => r[h.indexOf('사번')]).map(r => rowToPerson_(h, r));
}

function rowToPerson_(h, r) {
  const o = {};
  h.forEach((k, i) => {
    const key = PEOPLE_COLS[k]; if (!key) return;
    let val = r[i];
    if (val instanceof Date) val = Utilities.formatDate(val, 'Asia/Seoul', key === 'updatedAt' ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
    o[key] = typeof val === 'string' ? val.trim() : (val === null || val === undefined ? '' : String(val));
  });
  o.lead = o.lead === 'Y' ? 'Y' : 'N';
  return o;
}

function findRow_(v, h, id) {
  const c = h.indexOf('사번');
  for (let r = 1; r < v.length; r++) if (String(v[r][c]).trim() === String(id).trim()) return r;
  return -1;
}

function addHistory_(user, p, item, from, to, reason) {
  const sh = sheet_(SH.HIST);
  const n = sh.getLastRow();
  sh.appendRow(['H' + String(n).padStart(4, '0'), Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'),
    p.id, p.name, item, from ?? '', to ?? '', reason || '', user.id]);
}

function readHistory_(limit) {
  return readTable_(SH.HIST).slice(-limit).reverse().map(r => ({
    hid: r['이력ID'], at: fmt_(r['일시']), id: r['사번'], name: r['이름'], item: r['변경항목'],
    from: fmt_(r['이전값']), to: fmt_(r['이후값']), reason: r['사유'], by: r['처리자']
  }));
}

function fmt_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd HH:mm') : String(v ?? ''); }

function readTable_(name) {
  const v = sheet_(name).getDataRange().getValues(), h = v[0].map(x => String(x).trim());
  return v.slice(1).filter(r => r.some(x => x !== '')).map(r => { const o = {}; h.forEach((k, i) => { if (k) o[k] = r[i]; }); return o; });
}

function sheet_(name) {
  const s = SpreadsheetApp.getActive().getSheetByName(name);
  if (!s) throw new Error('시트 없음: ' + name);
  return s;
}

function conf_(key) {
  const row = readTable_(SH.CONF).find(r => r['키'] === key);
  return row ? String(row['값'] || '').trim() : '';
}

function setConf_(key, val) {
  const sh = sheet_(SH.CONF), v = sh.getDataRange().getValues();
  for (let r = 1; r < v.length; r++) if (v[r][0] === key) { sh.getRange(r + 1, 2).setValue(val); return; }
  sh.appendRow([key, val, '']);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
