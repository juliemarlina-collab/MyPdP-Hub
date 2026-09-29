/**
 * MyPdP Insight — Google Apps Script backend (Option B)
 * ------------------------------------------------------------
 * Database : the Google Sheet this script is attached to (one tab per table)
 * Files    : a PRIVATE Google Drive folder (MC & submission uploads)
 * API      : deployed as a Web App; the GitHub Pages site POSTs JSON here
 *
 * Project files:  Code.gs (this file) + Core.gs (shared logic) + appsscript.json
 * First time: run  setup()  once from the editor, then Deploy > New deployment > Web app.
 */

var API_VERSION = '1.0';

// ---------------- Web app entry points ----------------
function doGet() {
  return json_({ ok: true, app: 'MyPdP Insight API', version: API_VERSION, time: MyPdPCore.iso(new Date()) });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = String(body.action || '');
    var readOnly = { studentInsight: true };                // may wait for the AI model: don't block other users
    if (!readOnly[action]) lock.waitLock(20000); // one write at a time keeps the Sheet consistent
    var db = sheetDB_();
    if (action === 'login') {
      var u = MyPdPCore.handle(db, null, 'login', body.payload || {});
      return json_({ ok: true, data: { token: newToken_(u.user_id), user: u } });
    }
    if (action === 'logout') { CacheService.getScriptCache().remove('tok_' + body.token); return json_({ ok: true, data: {} }); }
    var user = userFromToken_(db, body.token);
    var data = MyPdPCore.handle(db, user, action, body.payload || {});
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, error: { code: err.code || 'server', en: err.message || String(err), ms: err.ms || err.message || String(err) } });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------------- Login sessions (tokens) ----------------
function newToken_(userId) {
  var token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  var hours = Number(getSetting_('session_hours')) || 6;
  CacheService.getScriptCache().put('tok_' + token, userId, Math.min(hours, 6) * 3600); // cache max is 6 hours
  return token;
}
function userFromToken_(db, token) {
  if (!token) return null;
  var id = CacheService.getScriptCache().get('tok_' + token);
  if (!id) return null;
  var u = db.all('Users').filter(function (x) { return x.user_id === id; })[0];
  if (!u || String(u.active).toUpperCase() !== 'TRUE') return null;
  return u;
}

// ---------------- Sheet database adapter ----------------
function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function cellText_(v) {
  if (v instanceof Date) {
    var tz = Session.getScriptTimeZone();
    var hasTime = v.getHours() || v.getMinutes() || v.getSeconds();
    return Utilities.formatDate(v, tz, hasTime ? "yyyy-MM-dd'T'HH:mm" : 'yyyy-MM-dd');
  }
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  return v === null || v === undefined ? '' : String(v);
}

function sheetDB_() {
  var ss = ss_();
  var memo = {}; // table -> { sheet, header, rows:[{obj,row}] }

  function load(t) {
    if (memo[t]) return memo[t];
    var sh = ss.getSheetByName(t);
    if (!sh) throw new Error('Missing tab in the Sheet: ' + t);
    var values = sh.getDataRange().getValues();
    var header = values[0].map(String);
    var rows = [];
    for (var i = 1; i < values.length; i++) {
      if (values[i].join('') === '') continue;
      var o = {};
      header.forEach(function (h, j) { o[h] = cellText_(values[i][j]); });
      rows.push({ obj: o, row: i + 1 });
    }
    memo[t] = { sheet: sh, header: header, rows: rows };
    return memo[t];
  }
  function write(m, rowNum, obj) {
    var vals = m.header.map(function (h) { return obj[h] === undefined || obj[h] === null ? '' : String(obj[h]); });
    m.sheet.getRange(rowNum, 1, 1, vals.length).setNumberFormat('@').setValues([vals]); // '@' = plain text, stops Sheets re-formatting dates
  }

  return {
    all: function (t) { return load(t).rows.map(function (r) { var c = {}; for (var k in r.obj) c[k] = r.obj[k]; return c; }); },
    insert: function (t, obj) {
      var m = load(t);
      var o = {};
      m.header.forEach(function (h) { o[h] = obj[h] === undefined || obj[h] === null ? '' : String(obj[h]); });
      var rowNum = m.sheet.getLastRow() + 1;
      write(m, rowNum, o);
      m.rows.push({ obj: o, row: rowNum });
    },
    update: function (t, match, patch) {
      var m = load(t), n = 0;
      m.rows.forEach(function (r) {
        var copy = {}; for (var k in r.obj) copy[k] = r.obj[k];
        if (!match(copy)) return;
        for (var p in patch) r.obj[p] = patch[p] === undefined || patch[p] === null ? '' : String(patch[p]);
        write(m, r.row, r.obj);
        n++;
      });
      return n;
    },
    saveFile: function (name, mime, base64) {
      var folderId = getSetting_('mc_folder_id');
      if (!folderId) throw new Error('Upload folder not set. Run setup() first.');
      var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, name);
      var file = DriveApp.getFolderById(folderId).createFile(blob); // private: only people the folder is shared with can open it
      return { url: file.getUrl(), id: file.getId() };
    },
    now: function () { return new Date(); },
    kvGet: function (k) { return CacheService.getScriptCache().get('kv_' + k); },            // login attempt counter
    kvSet: function (k, v, ttl) { CacheService.getScriptCache().put('kv_' + k, String(v), Math.max(1, ttl || 900)); },
    ai: PropertiesService.getScriptProperties().getProperty('AI_API_KEY') ? aiInsight_ : null,   // optional AI summary
    hash: function (text) {
      var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
      return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
    },
    randomCode: function (len) {
      var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
      for (var i = 0; i < len; i++) s += c.charAt(Math.floor(Math.random() * c.length));
      return s;
    }
  };
}

function getSetting_(key) {
  var sh = ss_().getSheetByName('Settings');
  if (!sh) return '';
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === key) return String(v[i][1]);
  return '';
}
function setSetting_(key, value) {
  var sh = ss_().getSheetByName('Settings');
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === key) { sh.getRange(i + 1, 2).setNumberFormat('@').setValue(value); return; }
  sh.appendRow([key, value, '']);
}

// ---------------- Admin tools (run from the editor or the Sheet menu) ----------------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('MyPdP Insight')
    .addItem('1. First-time setup', 'setup')
    .addItem('2. Validate imported class lists', 'validateImport')
    .addItem('3. Issue individual first-login PINs', 'issueInitialPins')
    .addItem('Convert typed PINs to secure hashes', 'hashNewPins')
    .addItem('Check setup', 'checkSetup')
    .addToUi();
}

var SCHEMA_ = {
  Users: ['user_id', 'role', 'name', 'email', 'programme', 'pin_hash', 'active', 'must_change_pin'],
  Classes: ['class_id', 'course_code', 'course_name', 'class_name', 'semester', 'lecturer_id'],
  Enrolments: ['class_id', 'student_id'],
  Sessions: ['session_id', 'class_id', 'date', 'start', 'end', 'topic', 'qr_code', 'qr_expires'],
  Attendance: ['session_id', 'student_id', 'status', 'marked_by', 'marked_at'],
  Claims: ['claim_id', 'student_id', 'class_id', 'session_ids', 'reason_type', 'note', 'file_name', 'file_url', 'status', 'comment', 'submitted_at', 'decided_by', 'decided_at'],
  Tasks: ['task_id', 'class_id', 'seq', 'title', 'type', 'description', 'due_at', 'max_marks', 'created_at'],
  Submissions: ['task_id', 'student_id', 'link', 'file_name', 'file_url', 'submitted_at', 'status', 'marks', 'feedback', 'graded_at'],
  Slots: ['slot_id', 'lecturer_id', 'date', 'start', 'end', 'mode', 'location', 'status'],
  Bookings: ['booking_id', 'slot_id', 'student_id', 'lecturer_id', 'class_id', 'purpose', 'status', 'notes', 'created_at', 'updated_at'],
  Interventions: ['intervention_id', 'student_id', 'class_id', 'lecturer_id', 'date', 'action', 'notes'],
  Notifications: ['notif_id', 'user_id', 'message_en', 'message_ms', 'link', 'created_at', 'read'],
  AuditLog: ['time', 'user_id', 'action', 'target', 'old_value', 'new_value'],
  Settings: ['key', 'value', 'description']
};
var DEFAULT_SETTINGS_ = [
  ['attendance_threshold', '80', 'Minimum attendance % (institution policy)'],
  ['monitor_margin', '5', 'Yellow warning when attendance is within this many % above the threshold'],
  ['late_counts_as_present', 'TRUE', 'TRUE = Late (L) counts as attended'],
  ['excused_excluded', 'TRUE', 'TRUE = Absent with reason (E) is removed from the total sessions'],
  ['missing_orange', '2', 'Number of missing tasks that triggers Intervention Needed'],
  ['max_file_mb', '5', 'Maximum upload size in MB'],
  ['qr_minutes', '10', 'How long a class QR code stays valid'],
  ['session_hours', '6', 'Login session length in hours (max 6)'],
  ['mc_folder_id', '', 'Google Drive folder ID for MC and submission files (filled by setup)']
];

/** Creates any missing tabs with the correct header row (safe to run again: never deletes data). */
function createTabs_(ss) {
  Object.keys(SCHEMA_).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, SCHEMA_[name].length).setValues([SCHEMA_[name]]).setFontWeight('bold').setBackground('#1f3b63').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1000, SCHEMA_[name].length).setNumberFormat('@');
      if (name === 'Settings') sh.getRange(2, 1, DEFAULT_SETTINGS_.length, 3).setValues(DEFAULT_SETTINGS_);
      if (name === 'Users') sh.getRange(2, 1, 1, 8).setValues([['A001', 'admin', 'Admin', '', '', '1234', 'TRUE', 'TRUE']]); // first admin: PIN 1234, must be changed at first login
    }
  });
  // upgrade older sheets: add any new columns (e.g. must_change_pin, seq, class_id) at the end of row 1
  Object.keys(SCHEMA_).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    var head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
    SCHEMA_[name].forEach(function (col) {
      if (head.indexOf(col) < 0) { sh.getRange(1, head.length + 1).setValue(col).setFontWeight('bold'); head.push(col); }
    });
  });
  var blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('Helaian1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
}

/** Run once: creates the tabs, remembers this Sheet, creates the private upload folder, hashes PINs. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || ss_();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  createTabs_(ss);
  if (!getSetting_('mc_folder_id')) {
    var folder = DriveApp.createFolder('MyPdP Insight - Uploads (PRIVATE - do not share with students)');
    setSetting_('mc_folder_id', folder.getId());
  }
  hashNewPins();
  checkSetup();
}

/** Admin types a plain PIN (4–8 digits) in the pin_hash column; this turns it into a hash. */
function hashNewPins() {
  var sh = ss_().getSheetByName('Users');
  var v = sh.getDataRange().getValues();
  var h = v[0].map(String), idCol = h.indexOf('user_id'), pinCol = h.indexOf('pin_hash'), mcCol = h.indexOf('must_change_pin');
  var db = sheetDB_(), n = 0;
  for (var i = 1; i < v.length; i++) {
    var pin = String(v[i][pinCol]);
    if (/^\d{4,8}$/.test(pin)) {
      sh.getRange(i + 1, pinCol + 1).setNumberFormat('@').setValue(db.hash(String(v[i][idCol]) + ':' + pin));
      if (mcCol >= 0) sh.getRange(i + 1, mcCol + 1).setValue('TRUE'); // user must choose their own PIN at first login
      n++;
    }
  }
  try { SpreadsheetApp.getUi().alert(n + ' PIN(s) converted.'); } catch (e) { Logger.log(n + ' PIN(s) converted.'); }
}

function checkSetup() {
  var need = ['Users', 'Classes', 'Enrolments', 'Sessions', 'Attendance', 'Claims', 'Tasks', 'Submissions', 'Slots', 'Bookings', 'Interventions', 'Notifications', 'AuditLog', 'Settings'];
  var ss = ss_();
  var missing = need.filter(function (t) { return !ss.getSheetByName(t); });
  var msg = missing.length ? 'Missing tabs: ' + missing.join(', ') : 'All 14 tabs found.';
  msg += '\nUpload folder: ' + (getSetting_('mc_folder_id') ? 'OK' : 'NOT SET - run setup');
  msg += '\nScript time zone: ' + Session.getScriptTimeZone() + ' (should be Asia/Kuala_Lumpur)';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/**
 * Gives every user who has NO PIN yet a random 6-digit first-login PIN.
 * The PINs are listed once in a new tab "PIN_Handout" so the admin can give each person theirs privately.
 * Delete that tab after handing out the PINs. Everyone must change their PIN at first login.
 */
function issueInitialPins() {
  var ss = ss_(), sh = ss.getSheetByName('Users');
  var v = sh.getDataRange().getValues(), h = v[0].map(String);
  var idCol = h.indexOf('user_id'), nameCol = h.indexOf('name'), pinCol = h.indexOf('pin_hash'), mcCol = h.indexOf('must_change_pin'), roleCol = h.indexOf('role');
  var db = sheetDB_(), out = [['user_id', 'name', 'role', 'first-login PIN (give privately, then delete this tab)']];
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][pinCol]).trim() !== '' || String(v[i][idCol]).trim() === '') continue;
    var pin = String(Math.floor(100000 + Math.random() * 900000));
    sh.getRange(i + 1, pinCol + 1).setNumberFormat('@').setValue(db.hash(String(v[i][idCol]) + ':' + pin));
    if (mcCol >= 0) sh.getRange(i + 1, mcCol + 1).setValue('TRUE');
    out.push([v[i][idCol], v[i][nameCol], v[i][roleCol], pin]);
  }
  var old = ss.getSheetByName('PIN_Handout'); if (old) ss.deleteSheet(old);
  if (out.length > 1) { var hs = ss.insertSheet('PIN_Handout'); hs.getRange(1, 1, out.length, 4).setNumberFormat('@').setValues(out); hs.getRange(1, 1, 1, 4).setFontWeight('bold'); }
  try { SpreadsheetApp.getUi().alert((out.length - 1) + ' first-login PIN(s) issued. See the PIN_Handout tab, then delete it.'); } catch (e) { Logger.log(out.length - 1); }
}

/**
 * Checks Users, Classes and Enrolments after pasting in class lists from Excel.
 * Writes every problem to a "Validation" tab. Nothing is changed or deleted.
 */
function validateImport() {
  var ss = ss_(), db = sheetDB_(), issues = [];
  var add = function (tab, row, problem, fix) { issues.push([tab, row, problem, fix]); };
  var users = db.all('Users'), classes = db.all('Classes'), enr = db.all('Enrolments');
  var ids = {}, emails = {};
  users.forEach(function (u, i) {
    var r = i + 2, id = String(u.user_id).trim();
    if (!id) add('Users', r, 'Missing user_id', 'Use the matric no. for students and the staff ID for lecturers');
    else if (ids[id]) add('Users', r, 'Duplicate user_id ' + id + ' (also row ' + ids[id] + ')', 'Keep ONE row per person; a student in two courses gets two Enrolments rows instead');
    else ids[id] = r;
    if (id && id !== id.toUpperCase()) add('Users', r, 'user_id has lowercase letters: ' + id, 'Use capitals, e.g. ' + id.toUpperCase());
    if (!String(u.name).trim()) add('Users', r, 'Missing name', 'Fill in the full name');
    if (['student', 'lecturer', 'admin'].indexOf(String(u.role).trim()) < 0) add('Users', r, 'Role must be student, lecturer or admin (found "' + u.role + '")', 'Fix the role');
    if (u.email) { var e = String(u.email).toLowerCase(); if (emails[e]) add('Users', r, 'Duplicate email ' + e, 'Check for a duplicated person'); emails[e] = r; }
    if (['TRUE', 'FALSE'].indexOf(String(u.active).toUpperCase()) < 0) add('Users', r, 'active must be TRUE or FALSE', 'Type TRUE for current users');
  });
  var cids = {}, sems = {};
  classes.forEach(function (c, i) {
    var r = i + 2;
    if (!c.class_id) add('Classes', r, 'Missing class_id', 'e.g. C01');
    else if (cids[c.class_id]) add('Classes', r, 'Duplicate class_id ' + c.class_id, 'Each class needs its own ID'); else cids[c.class_id] = c;
    if (!/^[A-Z]{3}\d{5}$/.test(String(c.course_code).trim())) add('Classes', r, 'Course code looks unusual: "' + c.course_code + '"', 'Expected 3 letters + 5 digits, e.g. DUE50132');
    if (!c.course_name) add('Classes', r, 'Missing course_name', 'Fill in the course name');
    if (!c.class_name) add('Classes', r, 'Missing class_name (group)', 'e.g. DKM3A');
    var lec = users.filter(function (u) { return u.user_id === c.lecturer_id; })[0];
    if (!lec) add('Classes', r, 'lecturer_id ' + c.lecturer_id + ' is not in Users', 'Add the lecturer to Users first');
    else if (lec.role !== 'lecturer' && lec.role !== 'admin') add('Classes', r, 'lecturer_id ' + c.lecturer_id + ' is not a lecturer', 'Check the ID');
    sems[String(c.semester).trim()] = (sems[String(c.semester).trim()] || 0) + 1;
  });
  if (Object.keys(sems).length > 1) add('Classes', '-', 'Several semester labels found: ' + Object.keys(sems).join(' | '), 'Use one spelling for the same semester, e.g. "Sesi I 2026/2027"');
  var pairs = {};
  enr.forEach(function (e, i) {
    var r = i + 2, k = e.class_id + '|' + e.student_id;
    if (!cids[e.class_id]) add('Enrolments', r, 'class_id ' + e.class_id + ' is not in Classes', 'Fix the class ID');
    var st = users.filter(function (u) { return u.user_id === e.student_id; })[0];
    if (!st) add('Enrolments', r, 'student_id ' + e.student_id + ' is not in Users', 'Add the student to Users first');
    else if (st.role !== 'student') add('Enrolments', r, e.student_id + ' is not a student', 'Check the ID');
    if (pairs[k]) add('Enrolments', r, 'Duplicate enrolment ' + e.student_id + ' in ' + e.class_id, 'Delete the extra row'); pairs[k] = 1;
  });
  users.filter(function (u) { return u.role === 'student'; }).forEach(function (u) {
    if (!enr.some(function (e) { return e.student_id === u.user_id; })) add('Users', ids[u.user_id] || '-', 'Student ' + u.user_id + ' is not enrolled in any class', 'Add an Enrolments row or set active to FALSE');
  });
  var out = [['Tab', 'Row', 'Problem', 'How to fix']].concat(issues.length ? issues : [['-', '-', 'No problems found', 'Next: menu > Issue individual first-login PINs']]);
  var old = ss.getSheetByName('Validation'); if (old) ss.deleteSheet(old);
  var vs = ss.insertSheet('Validation'); vs.getRange(1, 1, out.length, 4).setValues(out); vs.getRange(1, 1, 1, 4).setFontWeight('bold'); vs.setFrozenRows(1);
  try { SpreadsheetApp.getUi().alert(issues.length ? issues.length + ' problem(s) found. See the Validation tab.' : 'No problems found.'); } catch (e) { Logger.log(issues.length); }
}


// ---------------- Optional AI summary (studentInsight) ----------------
// Turn on: Project Settings > Script properties > add AI_API_KEY (an Anthropic API key).
// Optional: AI_MODEL (default below). Leave AI_API_KEY empty and the app uses its rule-based summary instead.
// Privacy: only the numbers in `facts` are sent (attendance, task titles, marks, risk level). No name, ID or e-mail.
var AI_DEFAULT_MODEL = 'claude-haiku-4-5';
function aiInsight_(facts) {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('AI_API_KEY');
  if (!key) return null;
  var model = props.getProperty('AI_MODEL') || AI_DEFAULT_MODEL;
  var factsJson = JSON.stringify(facts);
  var cacheKey = 'ai_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, model + factsJson)).slice(0, 40);
  var cache = CacheService.getScriptCache(), hit = cache.get(cacheKey);
  if (hit) return JSON.parse(hit);
  var system = 'You help a lecturer at a Malaysian polytechnic follow up students at risk. ' +
    'Use ONLY the facts given. Do not invent reasons, family details or diagnoses. Be kind, practical and brief. ' +
    'Reply with JSON only: {"summary_ms":"...","summary_en":"...","actions":[{"ms":"...","en":"..."}]} ' +
    '— summary: 2 sentences in Bahasa Melayu and the same in English; actions: 2 or 3 concrete next steps the lecturer can take this week.';
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: model, max_tokens: 600, system: system, messages: [{ role: 'user', content: 'Student facts (JSON): ' + factsJson }] })
  });
  if (res.getResponseCode() !== 200) { console.warn('AI call failed: ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300)); return null; }
  var text = (JSON.parse(res.getContentText()).content || []).map(function (c) { return c.text || ''; }).join('');
  var m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  var j = JSON.parse(m[0]);
  if (!j.summary_ms || !j.summary_en || !j.actions || !j.actions.length) return null;
  var out = { summary: { ms: String(j.summary_ms), en: String(j.summary_en) }, model: model,
    actions: j.actions.slice(0, 3).map(function (a) { return { ms: String(a.ms || a.en || ''), en: String(a.en || a.ms || '') }; }) };
  cache.put(cacheKey, JSON.stringify(out), 6 * 3600);   // same facts = same answer for 6 hours (saves API cost)
  return out;
}
