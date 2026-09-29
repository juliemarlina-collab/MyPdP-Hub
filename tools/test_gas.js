// Runs Code.gs + Core.gs inside Node with mocked Google services, to check the Sheet adapter & API.
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const seed = require('./seed.json');
const assert = require('assert');

// --- mock spreadsheet built from seed (as the converted xlsx would be: all text) ---
const sheets = {};
for (const [t, cols] of Object.entries(seed.schema)) {
  sheets[t] = [cols.slice()].concat(seed.rows[t].map(r => cols.map(c => r[c])));
}
// simulate Google converting a date-looking cell into a Date object
function mkSheet(name) {
  const a = sheets[name];
  const range = (r, c, nr = 1, nc = 1) => ({
    setNumberFormat() { return this; },
    setValues(v) { for (let i = 0; i < nr; i++) { a[r - 1 + i] = a[r - 1 + i] || []; for (let j = 0; j < nc; j++) a[r - 1 + i][c - 1 + j] = v[i][j]; } return this; },
    setValue(v) { a[r - 1] = a[r - 1] || []; a[r - 1][c - 1] = v; return this; }
  });
  return { getDataRange: () => ({ getValues: () => a.map(r => r.slice()) }), getLastRow: () => a.length, getRange: range, appendRow: r => a.push(r) };
}
const cache = {}, props = {};
const ctx = {
  SpreadsheetApp: { openById: () => ss, getActiveSpreadsheet: () => ss, getUi: () => { throw new Error('no ui'); } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => props[k] = v }) },
  CacheService: { getScriptCache: () => ({ put: (k, v) => cache[k] = v, get: k => cache[k] || null, remove: k => delete cache[k] }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, s }) },
  Utilities: {
    computeDigest: (_a, text) => Array.from(crypto.createHash('sha256').update(text, 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
    DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 },
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, tz, f) => { const p = n => String(n).padStart(2, '0'); const ds = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; return f.includes('HH') ? `${ds}T${p(d.getHours())}:${p(d.getMinutes())}` : ds; },
    base64Decode: s => Buffer.from(s, 'base64'), newBlob: (b, m, n) => ({ b, m, n })
  },
  DriveApp: { createFolder: () => ({ getId: () => 'FOLDER1' }), getFolderById: () => ({ createFile: bl => ({ getUrl: () => 'https://drive.google.com/file/' + bl.n, getId: () => 'F' }) }) },
  Session: { getScriptTimeZone: () => 'Asia/Kuala_Lumpur' },
  Logger: { log: m => console.log('[Logger]', m) },
  console
};
const ss = { getId: () => 'SHEET1', getSheetByName: n => sheets[n] ? mkSheet(n) : null };
vm.createContext(ctx);
sheets.Sessions[1][2] = vm.runInContext('new Date(2026, 7, 17)', ctx); // Date made inside the script realm
vm.runInContext(fs.readFileSync(__dirname + '/../backend/Core.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../backend/Code.gs', 'utf8'), ctx);

const post = (action, payload, token) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).s);

console.log('doGet:', ctx.doGet().s);
ctx.setup();
assert.ok(sheets.Settings.some(r => r[0] === 'mc_folder_id' && r[1] === 'FOLDER1'));

let r = post('login', { user_id: 'L001', pin: '9999' });
assert.strictEqual(r.ok, false); console.log('bad login:', r.error.ms);
const L = post('login', { user_id: 'L001', pin: '1234' }).data.token;
const S = post('login', { user_id: 'S003', pin: '1234' }).data.token;
assert.strictEqual(post('lecturerDashboard', {}, 'badtoken').error.code, 'auth');
r = post('lecturerDashboard', {}, L); assert.ok(r.ok, JSON.stringify(r)); console.log('dashboard classes:', r.data.classes.length, 'at risk:', r.data.atRisk.length);
r = post('classSessions', { class_id: 'C1' }, L); console.log('first session date (was Date object):', r.data[r.data.length - 1].date);
assert.strictEqual(r.data[r.data.length - 1].date, '2026-08-17');
r = post('submitClaim', { class_id: 'C1', session_ids: ['SS002'], reason_type: 'MC', file: { name: 'mc.pdf', type: 'application/pdf', data: Buffer.from('hello').toString('base64') } }, S);
assert.ok(r.ok, JSON.stringify(r));
const claimRow = sheets.Claims[sheets.Claims.length - 1]; console.log('claim row in sheet:', claimRow.join(' | '));
r = post('decideClaim', { claim_id: r.data.claim_id, decision: 'Approved' }, L); assert.ok(r.ok, JSON.stringify(r));
const att = sheets.Attendance.find(x => x[0] === 'SS002' && x[1] === 'S003'); console.log('attendance row after approval:', att.join(' | '));
assert.strictEqual(att[2], 'E');
r = post('createTask', { class_id: 'C1', title: 'Test', due_at: '2030-01-01T23:59', max_marks: 10 }, L); assert.ok(r.ok);
console.log('notifications rows:', sheets.Notifications.length - 1, 'audit rows:', sheets.AuditLog.length - 1);
console.log('\nGAS ADAPTER TESTS PASSED');
