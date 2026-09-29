/**
 * MyPdP Insight — shared business logic (Core)
 * ------------------------------------------------------------
 * The SAME file runs in two places:
 *   1. Google Apps Script (copy into the project as "Core.gs")
 *   2. The browser demo mode (frontend/core.js)
 * It never touches Sheets, Drive or the page directly. It talks to a
 * small "db" adapter:
 *   db.all(table) -> array of row objects (strings)
 *   db.insert(table, obj)
 *   db.update(table, matchFn, patchObj) -> number of rows changed
 *   db.saveFile(name, mimeType, base64) -> { url, id }
 *   db.now() -> Date
 *   db.hash(text) -> hex SHA-256
 *   db.randomCode(len) -> random A-Z0-9 string
 */
var MyPdPCore = (function () {
  'use strict';

  // ---------- small helpers ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { // local "YYYY-MM-DDTHH:MM"
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function today(db) { return iso(db.now()).slice(0, 10); }
  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  function truthy(v) { return String(v).toUpperCase() === 'TRUE' || v === true; }
  function fail(code, en, ms) { var e = new Error(en); e.code = code; e.ms = ms || en; throw e; }
  function need(p, keys) {
    keys.forEach(function (k) {
      if (p[k] === undefined || p[k] === null || String(p[k]).trim() === '') fail('missing', 'Please fill in: ' + k, 'Sila isi: ' + k);
    });
  }
  function clean(s, max) { return String(s === undefined || s === null ? '' : s).replace(/[<>]/g, '').trim().slice(0, max || 500); }
  function byKey(list, key) { var m = {}; list.forEach(function (r) { m[r[key]] = r; }); return m; }
  function newId(db, table, key, prefix) {
    var max = 0;
    db.all(table).forEach(function (r) { var n = parseInt(String(r[key]).replace(prefix, ''), 10); if (n > max) max = n; });
    var s = String(max + 1); while (s.length < 3) s = '0' + s;
    return prefix + s;
  }
  function settings(db) {
    var s = {};
    db.all('Settings').forEach(function (r) { s[r.key] = r.value; });
    return {
      threshold: num(s.attendance_threshold || 80),
      margin: num(s.monitor_margin || 5),
      lateOk: s.late_counts_as_present === undefined ? true : truthy(s.late_counts_as_present),
      excusedOut: s.excused_excluded === undefined ? true : truthy(s.excused_excluded),
      missingOrange: num(s.missing_orange || 2),
      maxMb: num(s.max_file_mb || 5),
      qrMinutes: num(s.qr_minutes || 10)
    };
  }
  function audit(db, user, action, target, oldV, newV) {
    db.insert('AuditLog', { time: iso(db.now()), user_id: user.user_id, action: action, target: target, old_value: oldV || '', new_value: newV || '' });
  }
  function notify(db, userId, en, ms, link) {
    db.insert('Notifications', { notif_id: newId(db, 'Notifications', 'notif_id', 'N'), user_id: userId, message_en: en, message_ms: ms,
      link: link || '', created_at: iso(db.now()), read: 'FALSE' });
  }
  function userName(db, id) { var u = byKey(db.all('Users'), 'user_id')[id]; return u ? u.name : id; }

  // ---------- access control ----------
  function role(user, roles) { if (roles.indexOf(user.role) < 0) fail('forbidden', 'You do not have access to this.', 'Anda tiada akses untuk fungsi ini.'); }
  function lecturerClasses(db, user) {
    return db.all('Classes').filter(function (c) { return user.role === 'admin' || c.lecturer_id === user.user_id; });
  }
  function studentClasses(db, studentId) {
    var ids = db.all('Enrolments').filter(function (e) { return e.student_id === studentId; }).map(function (e) { return e.class_id; });
    return db.all('Classes').filter(function (c) { return ids.indexOf(c.class_id) >= 0; });
  }
  function ownClass(db, user, classId) {
    var c = lecturerClasses(db, user).filter(function (x) { return x.class_id === classId; })[0];
    if (!c) fail('forbidden', 'This class is not assigned to you.', 'Kelas ini bukan di bawah anda.');
    return c;
  }
  function enrolled(db, classId) {
    return db.all('Enrolments').filter(function (e) { return e.class_id === classId; }).map(function (e) { return e.student_id; });
  }
  function publicUser(u) { return { user_id: u.user_id, role: u.role, name: u.name, email: u.email, programme: u.programme }; }

  // ---------- calculations ----------
  /** Attendance % = attended / counted sessions × 100.
   *  attended = P (+ L if late_counts_as_present); counted = past sessions (− E if excused_excluded). */
  function attendanceFor(db, studentId, classId, cfg, cache) {
    var now = today(db);
    var sessions = (cache.sessions || db.all('Sessions')).filter(function (s) { return s.class_id === classId && s.date <= now; });
    var att = cache.attendance || db.all('Attendance');
    var map = {};
    att.forEach(function (a) { if (a.student_id === studentId) map[a.session_id] = a.status; });
    var counted = 0, attended = 0, absent = 0, late = 0, excused = 0, list = [];
    sessions.forEach(function (s) {
      var st = map[s.session_id] || '';
      list.push({ session_id: s.session_id, date: s.date, start: s.start, end: s.end, topic: s.topic, status: st });
      if (!st) return; // not marked yet
      if (st === 'E') { excused++; if (cfg.excusedOut) return; counted++; return; }
      counted++;
      if (st === 'P') attended++;
      else if (st === 'L') { late++; if (cfg.lateOk) attended++; }
      else if (st === 'A') absent++;
    });
    var pct = counted ? Math.round(attended / counted * 1000) / 10 : 100;
    return { percent: pct, counted: counted, attended: attended, absent: absent, late: late, excused: excused, sessions: list.sort(function (a, b) { return a.date < b.date ? 1 : -1; }) };
  }

  function taskStatus(task, sub, nowIso) {
    if (sub) {
      if (sub.marks !== '') return 'Graded';
      return sub.submitted_at > task.due_at ? 'Late' : 'Submitted';
    }
    return nowIso > task.due_at ? 'Missing' : 'Not submitted';
  }

  function tasksFor(db, studentId, classId, cache) {
    var nowIso = iso(db.now());
    var subs = cache.submissions || db.all('Submissions');
    var mine = {};
    subs.forEach(function (s) { if (s.student_id === studentId) mine[s.task_id] = s; });
    return (cache.tasks || db.all('Tasks')).filter(function (t) { return t.class_id === classId; }).map(function (t) {
      var s = mine[t.task_id];
      return { task_id: t.task_id, class_id: t.class_id, title: t.title, type: t.type, description: t.description, due_at: t.due_at,
        max_marks: num(t.max_marks), status: taskStatus(t, s, nowIso), submitted_at: s ? s.submitted_at : '',
        link: s ? s.link : '', file_url: s ? s.file_url : '', marks: s && s.marks !== '' ? num(s.marks) : null, feedback: s ? s.feedback : '' };
    }).sort(function (a, b) { return a.due_at < b.due_at ? -1 : 1; });
  }

  /** Risk: red = attendance below threshold AND missing work;
   *  orange = below threshold OR missing >= missing_orange OR marks dropped twice in a row;
   *  yellow = 1 missing OR attendance within margin above threshold; else green. */
  function riskFor(att, tasks, cfg) {
    var missing = tasks.filter(function (t) { return t.status === 'Missing'; }).length;
    var graded = tasks.filter(function (t) { return t.marks !== null && t.max_marks; }).map(function (t) { return t.marks / t.max_marks * 100; });
    var dropping = graded.length >= 3 && graded[graded.length - 1] < graded[graded.length - 2] && graded[graded.length - 2] < graded[graded.length - 3];
    var avg = graded.length ? Math.round(graded.reduce(function (a, b) { return a + b; }, 0) / graded.length) : null;
    var low = att.counted > 0 && att.percent < cfg.threshold;
    var level = 'green', reasons = [];
    if (low) reasons.push({ en: 'Attendance ' + att.percent + '% (below ' + cfg.threshold + '%)', ms: 'Kehadiran ' + att.percent + '% (bawah ' + cfg.threshold + '%)' });
    if (missing) reasons.push({ en: missing + ' missing task(s)', ms: missing + ' tugasan belum dihantar' });
    if (dropping) reasons.push({ en: 'Marks dropping', ms: 'Markah menurun' });
    if (low && missing) level = 'red';
    else if (low || missing >= cfg.missingOrange || dropping) level = 'orange';
    else if (missing === 1 || (att.counted > 0 && att.percent < cfg.threshold + cfg.margin)) {
      level = 'yellow';
      if (!missing) reasons.push({ en: 'Attendance close to limit (' + att.percent + '%)', ms: 'Kehadiran hampir had (' + att.percent + '%)' });
    }
    return { level: level, reasons: reasons, missing: missing, average: avg, dropping: dropping };
  }

  function cacheAll(db) {
    return { sessions: db.all('Sessions'), attendance: db.all('Attendance'), tasks: db.all('Tasks'), submissions: db.all('Submissions') };
  }

  function studentSummary(db, studentId, cls, cfg, cache) {
    var att = attendanceFor(db, studentId, cls.class_id, cfg, cache);
    var tasks = tasksFor(db, studentId, cls.class_id, cache);
    var risk = riskFor(att, tasks, cfg);
    return { class_id: cls.class_id, course_code: cls.course_code, course_name: cls.course_name, class_name: cls.class_name,
      lecturer: userName(db, cls.lecturer_id), lecturer_id: cls.lecturer_id, attendance: att, tasks: tasks, risk: risk };
  }

  // ================= HANDLERS =================
  var H = {};

  // ---- auth & common ----
  H.login = function (db, _u, p) {
    need(p, ['user_id', 'pin']);
    var id = clean(p.user_id, 30).toUpperCase();
    var u = db.all('Users').filter(function (x) { return String(x.user_id).toUpperCase() === id; })[0];
    if (!u || !truthy(u.active) || db.hash(u.user_id + ':' + String(p.pin)) !== u.pin_hash)
      fail('login', 'Wrong ID or PIN.', 'ID atau PIN salah.');
    return publicUser(u);
  };

  H.me = function (db, user) {
    var n = db.all('Notifications').filter(function (x) { return x.user_id === user.user_id && !truthy(x.read); }).length;
    return { user: publicUser(user), unread: n, settings: settings(db) };
  };

  H.notifications = function (db, user) {
    return db.all('Notifications').filter(function (x) { return x.user_id === user.user_id; })
      .sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }).slice(0, 50);
  };
  H.markRead = function (db, user) {
    db.update('Notifications', function (x) { return x.user_id === user.user_id && !truthy(x.read); }, { read: 'TRUE' });
    return { ok: true };
  };

  H.changePin = function (db, user, p) {
    need(p, ['old_pin', 'new_pin']);
    if (!/^\d{4,8}$/.test(String(p.new_pin))) fail('pin', 'PIN must be 4–8 digits.', 'PIN mesti 4–8 digit.');
    var u = byKey(db.all('Users'), 'user_id')[user.user_id];
    if (db.hash(u.user_id + ':' + String(p.old_pin)) !== u.pin_hash) fail('pin', 'Current PIN is wrong.', 'PIN semasa salah.');
    db.update('Users', function (x) { return x.user_id === user.user_id; }, { pin_hash: db.hash(u.user_id + ':' + String(p.new_pin)) });
    audit(db, user, 'change_pin', user.user_id);
    return { ok: true };
  };

  // ---- student ----
  H.studentDashboard = function (db, user) {
    role(user, ['student']);
    var cfg = settings(db), cache = cacheAll(db);
    var classes = studentClasses(db, user.user_id).map(function (c) { return studentSummary(db, user.user_id, c, cfg, cache); });
    var nowIso = iso(db.now());
    var upcoming = [], missing = [], recentMarks = [];
    classes.forEach(function (c) {
      c.tasks.forEach(function (t) {
        var x = { title: t.title, course_code: c.course_code, class_name: c.class_name, due_at: t.due_at, task_id: t.task_id, status: t.status, marks: t.marks, max_marks: t.max_marks };
        if (t.status === 'Not submitted') upcoming.push(x);
        if (t.status === 'Missing') missing.push(x);
        if (t.marks !== null) recentMarks.push(x);
      });
    });
    var bookings = H.myBookings(db, user).filter(function (b) { return (b.status === 'Pending' || b.status === 'Confirmed') && b.date >= nowIso.slice(0, 10); });
    var claims = H.myClaims(db, user).filter(function (c) { return c.status === 'Pending'; });
    return { classes: classes.map(function (c) { return { class_id: c.class_id, course_code: c.course_code, course_name: c.course_name, class_name: c.class_name, lecturer: c.lecturer, attendance: { percent: c.attendance.percent, absent: c.attendance.absent }, risk: c.risk }; }),
      upcoming: upcoming.sort(function (a, b) { return a.due_at < b.due_at ? -1 : 1; }), missing: missing,
      recentMarks: recentMarks.slice(-5).reverse(), bookings: bookings, pendingClaims: claims.length, threshold: cfg.threshold };
  };

  H.myAttendance = function (db, user) {
    role(user, ['student']);
    var cfg = settings(db), cache = cacheAll(db);
    return { threshold: cfg.threshold, lateOk: cfg.lateOk, excusedOut: cfg.excusedOut,
      classes: studentClasses(db, user.user_id).map(function (c) {
        var a = attendanceFor(db, user.user_id, c.class_id, cfg, cache);
        return { class_id: c.class_id, course_code: c.course_code, course_name: c.course_name, class_name: c.class_name, attendance: a };
      }) };
  };

  H.checkIn = function (db, user, p) {
    role(user, ['student']);
    need(p, ['code']);
    var code = clean(p.code, 12).toUpperCase();
    var s = db.all('Sessions').filter(function (x) { return x.qr_code && x.qr_code.toUpperCase() === code; })[0];
    if (!s) fail('code', 'Check-in code not found.', 'Kod daftar masuk tidak dijumpai.');
    if (Number(s.qr_expires) < db.now().getTime()) fail('expired', 'This check-in code has expired. Ask your lecturer.', 'Kod ini telah tamat tempoh. Rujuk pensyarah.');
    if (enrolled(db, s.class_id).indexOf(user.user_id) < 0) fail('forbidden', 'You are not in this class.', 'Anda bukan pelajar kelas ini.');
    var existing = db.all('Attendance').filter(function (a) { return a.session_id === s.session_id && a.student_id === user.user_id; })[0];
    if (existing && (existing.status === 'P' || existing.status === 'L')) return { ok: true, already: true, session: s };
    var row = { session_id: s.session_id, student_id: user.user_id, status: 'P', marked_by: user.user_id + ' (QR)', marked_at: iso(db.now()) };
    if (existing) db.update('Attendance', function (a) { return a.session_id === s.session_id && a.student_id === user.user_id; }, row);
    else db.insert('Attendance', row);
    audit(db, user, 'qr_checkin', s.session_id, existing ? existing.status : '', 'P');
    return { ok: true, session: { date: s.date, topic: s.topic, class_id: s.class_id } };
  };

  H.submitClaim = function (db, user, p) {
    role(user, ['student']);
    need(p, ['class_id', 'session_ids', 'reason_type']);
    var cfg = settings(db);
    var cls = studentClasses(db, user.user_id).filter(function (c) { return c.class_id === p.class_id; })[0];
    if (!cls) fail('forbidden', 'You are not in this class.', 'Anda bukan pelajar kelas ini.');
    var ids = [].concat(p.session_ids).map(String);
    var valid = db.all('Sessions').filter(function (s) { return s.class_id === p.class_id; }).map(function (s) { return s.session_id; });
    ids.forEach(function (id) { if (valid.indexOf(id) < 0) fail('session', 'Invalid session selected.', 'Sesi tidak sah.'); });
    if (['MC', 'Official', 'Family', 'Other'].indexOf(p.reason_type) < 0) fail('reason', 'Choose a reason.', 'Pilih sebab.');
    var file = { url: '', id: '' }, fname = '';
    if (p.file && p.file.data) {
      var okTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (okTypes.indexOf(p.file.type) < 0) fail('file', 'Only PDF, JPG or PNG files.', 'Hanya fail PDF, JPG atau PNG.');
      if (p.file.data.length * 0.75 > cfg.maxMb * 1024 * 1024) fail('file', 'File is larger than ' + cfg.maxMb + ' MB.', 'Fail melebihi ' + cfg.maxMb + ' MB.');
      fname = clean(p.file.name, 80);
      file = db.saveFile(user.user_id + '_claim_' + fname, p.file.type, p.file.data);
    } else if (p.reason_type === 'MC') fail('file', 'Please upload your MC.', 'Sila muat naik MC anda.');
    var id = newId(db, 'Claims', 'claim_id', 'CL');
    db.insert('Claims', { claim_id: id, student_id: user.user_id, class_id: p.class_id, session_ids: ids.join(','), reason_type: p.reason_type,
      note: clean(p.note, 500), file_name: fname, file_url: file.url, status: 'Pending', comment: '', submitted_at: iso(db.now()), decided_by: '', decided_at: '' });
    notify(db, cls.lecturer_id, 'New MC / absence claim from ' + user.name + ' (' + cls.class_name + ').',
      'Tuntutan MC / ketidakhadiran baharu daripada ' + user.name + ' (' + cls.class_name + ').', 'claims');
    notify(db, user.user_id, 'Your absence claim was submitted and is waiting for review.', 'Tuntutan ketidakhadiran anda telah dihantar dan menunggu semakan.', 'claims');
    return { ok: true, claim_id: id };
  };

  function claimView(db, c, sessMap, clsMap) {
    var ids = String(c.session_ids).split(',').filter(String);
    var cls = clsMap[c.class_id] || {};
    return { claim_id: c.claim_id, student_id: c.student_id, student_name: userName(db, c.student_id), class_id: c.class_id,
      course_code: cls.course_code, class_name: cls.class_name,
      sessions: ids.map(function (i) { var s = sessMap[i] || {}; return { session_id: i, date: s.date, topic: s.topic }; }),
      reason_type: c.reason_type, note: c.note, file_name: c.file_name, file_url: c.file_url, status: c.status, comment: c.comment,
      submitted_at: c.submitted_at, decided_at: c.decided_at };
  }
  H.myClaims = function (db, user) {
    role(user, ['student']);
    var sm = byKey(db.all('Sessions'), 'session_id'), cm = byKey(db.all('Classes'), 'class_id');
    return db.all('Claims').filter(function (c) { return c.student_id === user.user_id; })
      .map(function (c) { return claimView(db, c, sm, cm); }).sort(function (a, b) { return a.submitted_at < b.submitted_at ? 1 : -1; });
  };

  H.myTasks = function (db, user) {
    role(user, ['student']);
    var cache = cacheAll(db);
    return studentClasses(db, user.user_id).map(function (c) {
      return { class_id: c.class_id, course_code: c.course_code, course_name: c.course_name, class_name: c.class_name, tasks: tasksFor(db, user.user_id, c.class_id, cache) };
    });
  };

  H.submitTask = function (db, user, p) {
    role(user, ['student']);
    need(p, ['task_id']);
    var cfg = settings(db);
    var t = byKey(db.all('Tasks'), 'task_id')[p.task_id];
    if (!t || enrolled(db, t.class_id).indexOf(user.user_id) < 0) fail('forbidden', 'Task not found.', 'Tugasan tidak dijumpai.');
    var link = clean(p.link, 400);
    if (link && !/^https?:\/\//i.test(link)) fail('link', 'Link must start with http:// or https://', 'Pautan mesti bermula dengan http:// atau https://');
    var file = { url: '', id: '' }, fname = '';
    if (p.file && p.file.data) {
      if (p.file.data.length * 0.75 > cfg.maxMb * 1024 * 1024) fail('file', 'File is larger than ' + cfg.maxMb + ' MB.', 'Fail melebihi ' + cfg.maxMb + ' MB.');
      fname = clean(p.file.name, 80);
      file = db.saveFile(user.user_id + '_' + t.task_id + '_' + fname, p.file.type || 'application/octet-stream', p.file.data);
    }
    if (!link && !file.url) fail('missing', 'Add a link or a file.', 'Sertakan pautan atau fail.');
    var existing = db.all('Submissions').filter(function (s) { return s.task_id === t.task_id && s.student_id === user.user_id; })[0];
    if (existing && existing.marks !== '') fail('graded', 'This task has already been graded.', 'Tugasan ini telah dinilai.');
    var now = iso(db.now());
    var row = { task_id: t.task_id, student_id: user.user_id, link: link, file_name: fname, file_url: file.url, submitted_at: now,
      status: now > t.due_at ? 'Late' : 'Submitted', marks: '', feedback: '', graded_at: '' };
    if (existing) {
      audit(db, user, 'resubmit', t.task_id, existing.submitted_at + ' ' + (existing.link || existing.file_url), now);
      db.update('Submissions', function (s) { return s.task_id === t.task_id && s.student_id === user.user_id; }, row);
    } else db.insert('Submissions', row);
    return { ok: true, status: row.status };
  };

  H.openSlots = function (db, user) {
    role(user, ['student']);
    var lecs = studentClasses(db, user.user_id).map(function (c) { return c.lecturer_id; });
    var d = today(db);
    return db.all('Slots').filter(function (s) { return s.status === 'Open' && s.date >= d && lecs.indexOf(s.lecturer_id) >= 0; })
      .map(function (s) { var x = JSON.parse(JSON.stringify(s)); x.lecturer = userName(db, s.lecturer_id); return x; })
      .sort(function (a, b) { return (a.date + a.start) < (b.date + b.start) ? -1 : 1; });
  };

  H.bookSlot = function (db, user, p) {
    role(user, ['student']);
    need(p, ['slot_id', 'purpose']);
    var s = byKey(db.all('Slots'), 'slot_id')[p.slot_id];
    if (!s || s.status !== 'Open') fail('taken', 'Sorry, this slot was just taken. Choose another.', 'Maaf, slot ini telah ditempah. Pilih slot lain.');
    var clash = H.myBookings(db, user).filter(function (b) { return (b.status === 'Pending' || b.status === 'Confirmed') && b.date === s.date && b.start === s.start; });
    if (clash.length) fail('clash', 'You already have a booking at this time.', 'Anda sudah ada temujanji pada masa ini.');
    db.update('Slots', function (x) { return x.slot_id === s.slot_id; }, { status: 'Booked' });
    var id = newId(db, 'Bookings', 'booking_id', 'B');
    var now = iso(db.now());
    db.insert('Bookings', { booking_id: id, slot_id: s.slot_id, student_id: user.user_id, lecturer_id: s.lecturer_id, purpose: clean(p.purpose, 300),
      status: 'Pending', notes: '', created_at: now, updated_at: now });
    notify(db, s.lecturer_id, 'New consultation request from ' + user.name + ' on ' + s.date + ' ' + s.start + '.',
      'Permohonan konsultasi baharu daripada ' + user.name + ' pada ' + s.date + ' ' + s.start + '.', 'consult');
    return { ok: true, booking_id: id };
  };

  function bookingView(db, b, slotMap) {
    var s = slotMap[b.slot_id] || {};
    return { booking_id: b.booking_id, slot_id: b.slot_id, student_id: b.student_id, student_name: userName(db, b.student_id),
      lecturer_id: b.lecturer_id, lecturer: userName(db, b.lecturer_id), date: s.date, start: s.start, end: s.end, mode: s.mode, location: s.location,
      purpose: b.purpose, status: b.status, notes: b.notes, created_at: b.created_at };
  }
  H.myBookings = function (db, user) {
    var sm = byKey(db.all('Slots'), 'slot_id');
    return db.all('Bookings').filter(function (b) { return b.student_id === user.user_id; })
      .map(function (b) { return bookingView(db, b, sm); }).sort(function (a, b) { return (a.date + a.start) < (b.date + b.start) ? 1 : -1; });
  };
  H.cancelBooking = function (db, user, p) {
    role(user, ['student']);
    var b = db.all('Bookings').filter(function (x) { return x.booking_id === p.booking_id && x.student_id === user.user_id; })[0];
    if (!b || (b.status !== 'Pending' && b.status !== 'Confirmed')) fail('state', 'This booking cannot be cancelled.', 'Temujanji ini tidak boleh dibatalkan.');
    db.update('Bookings', function (x) { return x.booking_id === b.booking_id; }, { status: 'Cancelled', updated_at: iso(db.now()) });
    db.update('Slots', function (x) { return x.slot_id === b.slot_id; }, { status: 'Open' });
    notify(db, b.lecturer_id, user.name + ' cancelled a consultation booking.', user.name + ' telah membatalkan temujanji konsultasi.', 'consult');
    return { ok: true };
  };

  // ---- lecturer ----
  H.lecturerDashboard = function (db, user) {
    role(user, ['lecturer', 'admin']);
    var cfg = settings(db), cache = cacheAll(db);
    var classes = lecturerClasses(db, user);
    var classIds = classes.map(function (c) { return c.class_id; });
    var atRisk = [];
    var out = classes.map(function (c) {
      var students = enrolled(db, c.class_id);
      var sums = students.map(function (s) { return studentSummary(db, s, c, cfg, cache); });
      var attAvg = sums.length ? Math.round(sums.reduce(function (a, s) { return a + s.attendance.percent; }, 0) / sums.length * 10) / 10 : 0;
      var nowIso = iso(db.now());
      var dueTasks = cache.tasks.filter(function (t) { return t.class_id === c.class_id && t.due_at <= nowIso; });
      var expected = dueTasks.length * students.length;
      var done = 0;
      sums.forEach(function (s) { s.tasks.forEach(function (t) { if (t.due_at <= nowIso && t.status !== 'Missing') done++; }); });
      var avgs = sums.map(function (s) { return s.risk.average; }).filter(function (v) { return v !== null; });
      var counts = { green: 0, yellow: 0, orange: 0, red: 0 };
      sums.forEach(function (s, i) {
        counts[s.risk.level]++;
        if (s.risk.level !== 'green') atRisk.push({ student_id: students[i], name: userName(db, students[i]), class_id: c.class_id, course_code: c.course_code, class_name: c.class_name, level: s.risk.level, reasons: s.risk.reasons, attendance: s.attendance.percent });
      });
      var classTaskIds = cache.tasks.filter(function (t) { return t.class_id === c.class_id; }).map(function (t) { return t.task_id; });
      var toGrade = cache.submissions.filter(function (s) { return s.marks === '' && classTaskIds.indexOf(s.task_id) >= 0; }).length;
      return { class_id: c.class_id, course_code: c.course_code, course_name: c.course_name, class_name: c.class_name, students: students.length,
        attendance: attAvg, submissionRate: expected ? Math.round(done / expected * 100) : 100,
        averageMark: avgs.length ? Math.round(avgs.reduce(function (a, b) { return a + b; }, 0) / avgs.length) : null, risk: counts, toGrade: toGrade };
    });
    var order = { red: 0, orange: 1, yellow: 2 };
    var pendingClaims = db.all('Claims').filter(function (c) { return c.status === 'Pending' && classIds.indexOf(c.class_id) >= 0; }).length;
    var pendingBookings = db.all('Bookings').filter(function (b) { return b.status === 'Pending' && b.lecturer_id === user.user_id; }).length;
    var nowIso2 = iso(db.now());
    var deadlines = cache.tasks.filter(function (t) { return classIds.indexOf(t.class_id) >= 0 && t.due_at >= nowIso2; })
      .sort(function (a, b) { return a.due_at < b.due_at ? -1 : 1; }).slice(0, 5)
      .map(function (t) { var c = classes.filter(function (x) { return x.class_id === t.class_id; })[0]; return { task_id: t.task_id, title: t.title, due_at: t.due_at, class_name: c.class_name, course_code: c.course_code }; });
    return { classes: out, atRisk: atRisk.sort(function (a, b) { return order[a.level] - order[b.level]; }), pendingClaims: pendingClaims, pendingBookings: pendingBookings, deadlines: deadlines, threshold: cfg.threshold };
  };

  H.myClasses = function (db, user) {
    role(user, ['lecturer', 'admin']);
    return lecturerClasses(db, user).map(function (c) { var x = JSON.parse(JSON.stringify(c)); x.students = enrolled(db, c.class_id).length; return x; });
  };

  H.classStudents = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    var c = ownClass(db, user, p.class_id);
    var cfg = settings(db), cache = cacheAll(db), users = byKey(db.all('Users'), 'user_id');
    return { cls: c, threshold: cfg.threshold, students: enrolled(db, c.class_id).map(function (s) {
      var sum = studentSummary(db, s, c, cfg, cache);
      return { student_id: s, name: users[s] ? users[s].name : s, attendance: sum.attendance.percent, absent: sum.attendance.absent,
        missing: sum.risk.missing, average: sum.risk.average, level: sum.risk.level, reasons: sum.risk.reasons };
    }).sort(function (a, b) { return a.name < b.name ? -1 : 1; }) };
  };

  H.studentTimeline = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    var c = ownClass(db, user, p.class_id);
    if (enrolled(db, c.class_id).indexOf(p.student_id) < 0) fail('forbidden', 'Student not in this class.', 'Pelajar bukan dalam kelas ini.');
    var cfg = settings(db), cache = cacheAll(db);
    var sum = studentSummary(db, p.student_id, c, cfg, cache);
    var ev = [];
    sum.attendance.sessions.forEach(function (s) {
      if (s.status === 'A' || s.status === 'L' || s.status === 'E') ev.push({ date: s.date, kind: 'attendance', status: s.status, text: s.topic });
    });
    sum.tasks.forEach(function (t) {
      if (t.status === 'Missing') ev.push({ date: t.due_at.slice(0, 10), kind: 'missing', text: t.title });
      else if (t.submitted_at) ev.push({ date: t.submitted_at.slice(0, 10), kind: 'submission', status: t.status, text: t.title + (t.marks !== null ? ' — ' + t.marks + '/' + t.max_marks : '') });
    });
    db.all('Claims').filter(function (x) { return x.student_id === p.student_id && x.class_id === c.class_id; })
      .forEach(function (x) { ev.push({ date: x.submitted_at.slice(0, 10), kind: 'claim', status: x.status, text: x.reason_type + (x.note ? ': ' + x.note : '') }); });
    var sm = byKey(db.all('Slots'), 'slot_id');
    db.all('Bookings').filter(function (b) { return b.student_id === p.student_id && b.lecturer_id === c.lecturer_id; })
      .forEach(function (b) { var s = sm[b.slot_id] || {}; ev.push({ date: s.date || b.created_at.slice(0, 10), kind: 'consult', status: b.status, text: b.purpose + (b.notes ? ' — ' + b.notes : '') }); });
    db.all('Interventions').filter(function (x) { return x.student_id === p.student_id && x.class_id === c.class_id; })
      .forEach(function (x) { ev.push({ date: x.date, kind: 'intervention', text: x.action + (x.notes ? ' — ' + x.notes : ''), by: userName(db, x.lecturer_id) }); });
    ev.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return { student: publicUser(byKey(db.all('Users'), 'user_id')[p.student_id]), cls: c, summary: { attendance: sum.attendance, risk: sum.risk, tasks: sum.tasks }, events: ev };
  };

  H.addIntervention = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    need(p, ['class_id', 'student_id', 'action']);
    ownClass(db, user, p.class_id);
    var id = newId(db, 'Interventions', 'intervention_id', 'I');
    db.insert('Interventions', { intervention_id: id, student_id: p.student_id, class_id: p.class_id, lecturer_id: user.user_id,
      date: p.date || today(db), action: clean(p.action, 100), notes: clean(p.notes, 500) });
    return { ok: true };
  };

  H.classSessions = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    var c = ownClass(db, user, p.class_id);
    var att = db.all('Attendance'), n = enrolled(db, c.class_id).length;
    return db.all('Sessions').filter(function (s) { return s.class_id === c.class_id; }).map(function (s) {
      var marks = att.filter(function (a) { return a.session_id === s.session_id; });
      return { session_id: s.session_id, date: s.date, start: s.start, end: s.end, topic: s.topic, marked: marks.length, students: n,
        present: marks.filter(function (a) { return a.status === 'P' || a.status === 'L'; }).length,
        qr_active: s.qr_code && Number(s.qr_expires) > db.now().getTime() ? s.qr_code : '' };
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  };

  H.createSession = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    need(p, ['class_id', 'date', 'start', 'end']);
    ownClass(db, user, p.class_id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !/^\d{2}:\d{2}$/.test(p.start) || !/^\d{2}:\d{2}$/.test(p.end)) fail('format', 'Check the date and time.', 'Semak tarikh dan masa.');
    var id = newId(db, 'Sessions', 'session_id', 'SS');
    db.insert('Sessions', { session_id: id, class_id: p.class_id, date: p.date, start: p.start, end: p.end, topic: clean(p.topic, 150), qr_code: '', qr_expires: '' });
    audit(db, user, 'create_session', id, '', p.date + ' ' + p.start);
    return { ok: true, session_id: id };
  };

  H.openQR = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    var s = byKey(db.all('Sessions'), 'session_id')[p.session_id];
    if (!s) fail('missing', 'Session not found.', 'Sesi tidak dijumpai.');
    ownClass(db, user, s.class_id);
    var mins = num(p.minutes) || settings(db).qrMinutes;
    var code = db.randomCode(6);
    var exp = db.now().getTime() + mins * 60000;
    db.update('Sessions', function (x) { return x.session_id === s.session_id; }, { qr_code: code, qr_expires: String(exp) });
    return { code: code, expires: exp, minutes: mins };
  };

  H.sessionRoster = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    var s = byKey(db.all('Sessions'), 'session_id')[p.session_id];
    if (!s) fail('missing', 'Session not found.', 'Sesi tidak dijumpai.');
    var c = ownClass(db, user, s.class_id);
    var att = byKey(db.all('Attendance').filter(function (a) { return a.session_id === s.session_id; }), 'student_id');
    var users = byKey(db.all('Users'), 'user_id');
    return { session: s, cls: c, qr_active: s.qr_code && Number(s.qr_expires) > db.now().getTime() ? { code: s.qr_code, expires: Number(s.qr_expires) } : null,
      roster: enrolled(db, c.class_id).map(function (id) { return { student_id: id, name: users[id] ? users[id].name : id, status: att[id] ? att[id].status : '', marked_by: att[id] ? att[id].marked_by : '' }; })
        .sort(function (a, b) { return a.name < b.name ? -1 : 1; }) };
  };

  H.markAttendance = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    var s = byKey(db.all('Sessions'), 'session_id')[p.session_id];
    if (!s) fail('missing', 'Session not found.', 'Sesi tidak dijumpai.');
    ownClass(db, user, s.class_id);
    var roster = enrolled(db, s.class_id);
    var current = byKey(db.all('Attendance').filter(function (a) { return a.session_id === s.session_id; }), 'student_id');
    var changed = 0;
    (p.marks || []).forEach(function (m) {
      if (roster.indexOf(m.student_id) < 0 || ['P', 'L', 'A', 'E'].indexOf(m.status) < 0) return;
      var old = current[m.student_id];
      if (old && old.status === m.status) return;
      var row = { session_id: s.session_id, student_id: m.student_id, status: m.status, marked_by: user.user_id, marked_at: iso(db.now()) };
      if (old) db.update('Attendance', function (a) { return a.session_id === s.session_id && a.student_id === m.student_id; }, row);
      else db.insert('Attendance', row);
      audit(db, user, 'attendance', s.session_id + '/' + m.student_id, old ? old.status : '', m.status);
      changed++;
    });
    return { ok: true, changed: changed };
  };

  H.listClaims = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    var ids = lecturerClasses(db, user).map(function (c) { return c.class_id; });
    var sm = byKey(db.all('Sessions'), 'session_id'), cm = byKey(db.all('Classes'), 'class_id');
    return db.all('Claims').filter(function (c) { return ids.indexOf(c.class_id) >= 0 && (!p || !p.status || c.status === p.status); })
      .map(function (c) { return claimView(db, c, sm, cm); })
      .sort(function (a, b) { if (a.status === 'Pending' && b.status !== 'Pending') return -1; if (b.status === 'Pending' && a.status !== 'Pending') return 1; return a.submitted_at < b.submitted_at ? 1 : -1; });
  };

  H.decideClaim = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    need(p, ['claim_id', 'decision']);
    var c = byKey(db.all('Claims'), 'claim_id')[p.claim_id];
    if (!c) fail('missing', 'Claim not found.', 'Tuntutan tidak dijumpai.');
    ownClass(db, user, c.class_id);
    if (c.status !== 'Pending') fail('state', 'This claim was already decided.', 'Tuntutan ini telah diputuskan.');
    if (['Approved', 'Rejected'].indexOf(p.decision) < 0) fail('state', 'Invalid decision.', 'Keputusan tidak sah.');
    if (p.decision === 'Rejected' && !clean(p.comment)) fail('missing', 'Please give a reason for rejecting.', 'Sila nyatakan sebab penolakan.');
    db.update('Claims', function (x) { return x.claim_id === c.claim_id; }, { status: p.decision, comment: clean(p.comment, 300), decided_by: user.user_id, decided_at: iso(db.now()) });
    audit(db, user, 'claim_' + p.decision.toLowerCase(), c.claim_id, 'Pending', p.decision);
    if (p.decision === 'Approved') {
      // Integration: approved claim => sessions become "E" (absent with reason), with audit trail
      String(c.session_ids).split(',').filter(String).forEach(function (sid) {
        var old = db.all('Attendance').filter(function (a) { return a.session_id === sid && a.student_id === c.student_id; })[0];
        var row = { session_id: sid, student_id: c.student_id, status: 'E', marked_by: user.user_id + ' (claim ' + c.claim_id + ')', marked_at: iso(db.now()) };
        if (old) db.update('Attendance', function (a) { return a.session_id === sid && a.student_id === c.student_id; }, row);
        else db.insert('Attendance', row);
        audit(db, user, 'attendance', sid + '/' + c.student_id, old ? old.status : '', 'E (claim ' + c.claim_id + ')');
      });
      notify(db, c.student_id, 'Your absence claim was approved. Attendance updated to "Absent with reason".',
        'Tuntutan ketidakhadiran anda diluluskan. Kehadiran dikemas kini kepada "Tidak Hadir Bersebab".', 'claims');
    } else {
      notify(db, c.student_id, 'Your absence claim was not approved: ' + clean(p.comment, 200), 'Tuntutan ketidakhadiran anda tidak diluluskan: ' + clean(p.comment, 200), 'claims');
    }
    return { ok: true };
  };

  H.classTasks = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    var c = ownClass(db, user, p.class_id);
    var subs = db.all('Submissions'), n = enrolled(db, c.class_id).length;
    return db.all('Tasks').filter(function (t) { return t.class_id === c.class_id; }).map(function (t) {
      var s = subs.filter(function (x) { return x.task_id === t.task_id; });
      return { task_id: t.task_id, title: t.title, type: t.type, due_at: t.due_at, max_marks: num(t.max_marks), description: t.description,
        submitted: s.length, graded: s.filter(function (x) { return x.marks !== ''; }).length, students: n };
    }).sort(function (a, b) { return a.due_at < b.due_at ? 1 : -1; });
  };

  H.createTask = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    need(p, ['class_id', 'title', 'due_at', 'max_marks']);
    var c = ownClass(db, user, p.class_id);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(p.due_at)) fail('format', 'Check the due date.', 'Semak tarikh akhir.');
    var id = newId(db, 'Tasks', 'task_id', 'T');
    db.insert('Tasks', { task_id: id, class_id: c.class_id, title: clean(p.title, 150), type: clean(p.type || 'Assignment', 30), description: clean(p.description, 1000),
      due_at: p.due_at, max_marks: String(num(p.max_marks)), created_at: iso(db.now()) });
    enrolled(db, c.class_id).forEach(function (s) {
      notify(db, s, 'New task in ' + c.course_code + ': ' + clean(p.title, 80) + ' (due ' + p.due_at.replace('T', ' ') + ').',
        'Tugasan baharu ' + c.course_code + ': ' + clean(p.title, 80) + ' (tarikh akhir ' + p.due_at.replace('T', ' ') + ').', 'tasks');
    });
    return { ok: true, task_id: id };
  };

  H.taskSubmissions = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    var t = byKey(db.all('Tasks'), 'task_id')[p.task_id];
    if (!t) fail('missing', 'Task not found.', 'Tugasan tidak dijumpai.');
    var c = ownClass(db, user, t.class_id);
    var subs = byKey(db.all('Submissions').filter(function (s) { return s.task_id === t.task_id; }), 'student_id');
    var users = byKey(db.all('Users'), 'user_id'), nowIso = iso(db.now());
    return { task: t, cls: c, rows: enrolled(db, c.class_id).map(function (id) {
      var s = subs[id];
      return { student_id: id, name: users[id] ? users[id].name : id, status: taskStatus(t, s, nowIso), submitted_at: s ? s.submitted_at : '',
        link: s ? s.link : '', file_url: s ? s.file_url : '', file_name: s ? s.file_name : '', marks: s ? s.marks : '', feedback: s ? s.feedback : '' };
    }).sort(function (a, b) { return a.name < b.name ? -1 : 1; }) };
  };

  H.grade = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    need(p, ['task_id', 'student_id', 'marks']);
    var t = byKey(db.all('Tasks'), 'task_id')[p.task_id];
    if (!t) fail('missing', 'Task not found.', 'Tugasan tidak dijumpai.');
    ownClass(db, user, t.class_id);
    var m = Number(p.marks);
    if (isNaN(m) || m < 0 || m > num(t.max_marks)) fail('marks', 'Marks must be 0–' + t.max_marks + '.', 'Markah mesti 0–' + t.max_marks + '.');
    var s = db.all('Submissions').filter(function (x) { return x.task_id === t.task_id && x.student_id === p.student_id; })[0];
    var patch = { marks: String(m), feedback: clean(p.feedback, 500), graded_at: iso(db.now()), status: 'Graded' };
    if (s) { audit(db, user, 'grade', t.task_id + '/' + p.student_id, s.marks, String(m)); db.update('Submissions', function (x) { return x.task_id === t.task_id && x.student_id === p.student_id; }, patch); }
    else {
      // e.g. quiz done on paper / in class: lecturer records marks without an online submission
      if (enrolled(db, t.class_id).indexOf(p.student_id) < 0) fail('forbidden', 'Student not in this class.', 'Pelajar bukan dalam kelas ini.');
      db.insert('Submissions', { task_id: t.task_id, student_id: p.student_id, link: '', file_name: '', file_url: '', submitted_at: iso(db.now()), status: 'Graded', marks: String(m), feedback: patch.feedback, graded_at: patch.graded_at });
      audit(db, user, 'grade', t.task_id + '/' + p.student_id, '', String(m));
    }
    notify(db, p.student_id, 'Marks released for ' + t.title + ': ' + m + '/' + t.max_marks + '.', 'Markah dikeluarkan untuk ' + t.title + ': ' + m + '/' + t.max_marks + '.', 'marks');
    return { ok: true };
  };

  H.mySlots = function (db, user) {
    role(user, ['lecturer', 'admin']);
    var sm = byKey(db.all('Slots'), 'slot_id');
    var d = today(db);
    return {
      slots: db.all('Slots').filter(function (s) { return s.lecturer_id === user.user_id && s.date >= d; }).sort(function (a, b) { return (a.date + a.start) < (b.date + b.start) ? -1 : 1; }),
      bookings: db.all('Bookings').filter(function (b) { return b.lecturer_id === user.user_id; }).map(function (b) { return bookingView(db, b, sm); })
        .sort(function (a, b) { var o = { Pending: 0, Confirmed: 1 }; var x = (o[a.status] === undefined ? 2 : o[a.status]) - (o[b.status] === undefined ? 2 : o[b.status]); return x || ((a.date + a.start) < (b.date + b.start) ? -1 : 1); })
    };
  };

  function toMin(t) { var x = t.split(':'); return num(x[0]) * 60 + num(x[1]); }
  function fromMin(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  H.addSlots = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    need(p, ['date', 'start', 'end', 'minutes', 'mode']);
    var a = toMin(p.start), b = toMin(p.end), step = num(p.minutes);
    if (step < 10 || b <= a) fail('format', 'Check the times and slot length.', 'Semak masa dan tempoh slot.');
    var existing = db.all('Slots').filter(function (s) { return s.lecturer_id === user.user_id && s.date === p.date && s.status !== 'Closed'; });
    var made = 0;
    for (var t = a; t + step <= b; t += step) {
      var st = fromMin(t), en = fromMin(t + step);
      var overlap = existing.some(function (s) { return toMin(s.start) < t + step && toMin(s.end) > t; }); // conflict detection
      if (overlap) continue;
      db.insert('Slots', { slot_id: newId(db, 'Slots', 'slot_id', 'SL'), lecturer_id: user.user_id, date: p.date, start: st, end: en,
        mode: p.mode === 'Online' ? 'Online' : 'In person', location: clean(p.location, 150), status: 'Open' });
      made++;
    }
    return { ok: true, created: made };
  };

  H.closeSlot = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    var n = db.update('Slots', function (s) { return s.slot_id === p.slot_id && s.lecturer_id === user.user_id && s.status === 'Open'; }, { status: 'Closed' });
    if (!n) fail('state', 'Only open slots can be removed.', 'Hanya slot kosong boleh dibuang.');
    return { ok: true };
  };

  H.decideBooking = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    need(p, ['booking_id', 'decision']);
    var b = db.all('Bookings').filter(function (x) { return x.booking_id === p.booking_id && x.lecturer_id === user.user_id; })[0];
    if (!b) fail('missing', 'Booking not found.', 'Temujanji tidak dijumpai.');
    var allowed = { Pending: ['Confirmed', 'Rejected'], Confirmed: ['Completed', 'Cancelled'] };
    if (!allowed[b.status] || allowed[b.status].indexOf(p.decision) < 0) fail('state', 'This action is not allowed now.', 'Tindakan ini tidak dibenarkan sekarang.');
    db.update('Bookings', function (x) { return x.booking_id === b.booking_id; }, { status: p.decision, notes: clean(p.notes, 500), updated_at: iso(db.now()) });
    if (p.decision === 'Rejected' || p.decision === 'Cancelled') db.update('Slots', function (x) { return x.slot_id === b.slot_id; }, { status: 'Open' });
    var s = byKey(db.all('Slots'), 'slot_id')[b.slot_id] || {};
    var msg = {
      Confirmed: ['Your consultation with ' + user.name + ' on ' + s.date + ' ' + s.start + ' is confirmed. ' + (s.location || ''), 'Temujanji anda dengan ' + user.name + ' pada ' + s.date + ' ' + s.start + ' telah disahkan. ' + (s.location || '')],
      Rejected: ['Your consultation request was not accepted. ' + clean(p.notes, 150), 'Permohonan konsultasi anda tidak diterima. ' + clean(p.notes, 150)],
      Cancelled: ['Your consultation on ' + s.date + ' was cancelled by the lecturer.', 'Temujanji anda pada ' + s.date + ' telah dibatalkan oleh pensyarah.'],
      Completed: ['Consultation completed. Notes from your lecturer: ' + clean(p.notes, 150), 'Konsultasi selesai. Catatan pensyarah: ' + clean(p.notes, 150)]
    }[p.decision];
    notify(db, b.student_id, msg[0], msg[1], 'consult');
    if (p.decision === 'Completed') {
      // Integration: completed consultation => intervention log (evidence of follow-up)
      var cls = studentClasses(db, b.student_id).filter(function (c) { return c.lecturer_id === user.user_id; })[0];
      db.insert('Interventions', { intervention_id: newId(db, 'Interventions', 'intervention_id', 'I'), student_id: b.student_id, class_id: cls ? cls.class_id : '',
        lecturer_id: user.user_id, date: s.date || today(db), action: 'Consultation', notes: clean(b.purpose, 200) + (p.notes ? ' | ' + clean(p.notes, 300) : '') });
    }
    return { ok: true };
  };

  H.exportData = function (db, user, p) {
    role(user, ['lecturer', 'admin']);
    need(p, ['kind', 'class_id']);
    var c = ownClass(db, user, p.class_id);
    var cfg = settings(db), cache = cacheAll(db), users = byKey(db.all('Users'), 'user_id');
    var students = enrolled(db, c.class_id);
    var name = function (id) { return users[id] ? users[id].name : id; };
    if (p.kind === 'attendance') {
      var sess = cache.sessions.filter(function (s) { return s.class_id === c.class_id; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      var header = ['Student ID', 'Name'].concat(sess.map(function (s) { return s.date; })).concat(['Attendance %']);
      var rows = students.map(function (id) {
        var a = attendanceFor(db, id, c.class_id, cfg, cache), m = byKey(a.sessions, 'session_id');
        return [id, name(id)].concat(sess.map(function (s) { return m[s.session_id] ? m[s.session_id].status : ''; })).concat([a.percent]);
      });
      return { filename: c.course_code + '_' + c.class_name + '_attendance.csv', header: header, rows: rows };
    }
    if (p.kind === 'submissions') {
      var tasks = cache.tasks.filter(function (t) { return t.class_id === c.class_id; }).sort(function (a, b) { return a.due_at < b.due_at ? -1 : 1; });
      var h2 = ['Student ID', 'Name'];
      tasks.forEach(function (t) { h2.push(t.title + ' status', t.title + ' marks /' + t.max_marks); });
      var r2 = students.map(function (id) {
        var ts = byKey(tasksFor(db, id, c.class_id, cache), 'task_id'), row = [id, name(id)];
        tasks.forEach(function (t) { var x = ts[t.task_id]; row.push(x.status, x.marks === null ? '' : x.marks); });
        return row;
      });
      return { filename: c.course_code + '_' + c.class_name + '_submissions.csv', header: h2, rows: r2 };
    }
    if (p.kind === 'pdp') {
      var h3 = ['Student ID', 'Name', 'Attendance %', 'Absent', 'Missing tasks', 'Average mark %', 'Risk status', 'Reasons', 'Interventions'];
      var ints = db.all('Interventions');
      var r3 = students.map(function (id) {
        var s = studentSummary(db, id, c, cfg, cache);
        var n = ints.filter(function (x) { return x.student_id === id && x.class_id === c.class_id; }).length;
        return [id, name(id), s.attendance.percent, s.attendance.absent, s.risk.missing, s.risk.average === null ? '' : s.risk.average,
          { green: 'On Track', yellow: 'Monitor', orange: 'Intervention Needed', red: 'High Attention' }[s.risk.level],
          s.risk.reasons.map(function (r) { return r.en; }).join('; '), n];
      });
      return { filename: c.course_code + '_' + c.class_name + '_PdP_report.csv', header: h3, rows: r3 };
    }
    fail('format', 'Unknown export.', 'Eksport tidak dikenali.');
  };

  // ---------- dispatcher ----------
  var PUBLIC = { login: true };
  function handle(db, user, action, payload) {
    if (!H[action]) fail('action', 'Unknown action: ' + action, 'Tindakan tidak dikenali: ' + action);
    if (!PUBLIC[action] && !user) fail('auth', 'Please log in again.', 'Sila log masuk semula.');
    return H[action](db, user, payload || {});
  }

  return { handle: handle, iso: iso, handlers: H };
})();

if (typeof module !== 'undefined') module.exports = MyPdPCore;
