// Node test of the main flows using the in-memory demo DB.
global.localStorage = { getItem: () => null, setItem: () => {} };
const Core = require('../backend/Core.js');
const DemoDB = require('../frontend/demo-db.js');
const seed = require('./seed.json');
const assert = require('assert');
const crypto = require('crypto');

assert.strictEqual(DemoDB.sha256('S001:1234'), crypto.createHash('sha256').update('S001:1234').digest('hex'), 'sha256 mismatch');

const db = DemoDB.create(seed, { fresh: true, persist: false, now: '2026-09-29T10:00:00' });
const call = (user, action, p) => Core.handle(db, user, action, p);
const expectFail = (fn, code) => { try { fn(); } catch (e) { assert.strictEqual(e.code, code, e.message); return; } throw new Error('expected failure ' + code); };

// login
expectFail(() => call(null, 'login', { user_id: 'S001', pin: '0000' }), 'login');
const s5 = call(null, 'login', { user_id: 's005', pin: '1234' });
const s3 = call(null, 'login', { user_id: 'S003', pin: '1234' });
const s7 = call(null, 'login', { user_id: 'S007', pin: '1234' });
const l1 = call(null, 'login', { user_id: 'L001', pin: '1234' });
const l2 = call(null, 'login', { user_id: 'L002', pin: '1234' });
expectFail(() => call(null, 'me'), 'auth');

// student dashboard
const d3 = call(s3, 'studentDashboard');
console.log('S003 classes:', d3.classes.map(c => `${c.class_name} ${c.course_code} ${c.attendance.percent}% ${c.risk.level}`));
assert.strictEqual(d3.classes.find(c => c.class_id === 'C1').risk.level, 'red');

// lecturer dashboard
const ld = call(l1, 'lecturerDashboard');
console.log('L001 classes:', ld.classes.map(c => `${c.class_name}: att ${c.attendance}% sub ${c.submissionRate}% avg ${c.averageMark} risk ${JSON.stringify(c.risk)} toGrade ${c.toGrade}`));
console.log('At risk:', ld.atRisk.map(r => `${r.name} ${r.level} ${r.reasons.map(x => x.en).join('/')}`));
assert.ok(ld.pendingClaims === 1 && ld.pendingBookings === 1);

// access control: L002 can't see C1
expectFail(() => call(l2, 'classStudents', { class_id: 'C1' }), 'forbidden');
expectFail(() => call(s3, 'lecturerDashboard'), 'forbidden');

// claim approve -> attendance becomes E
const before = call(s5, 'myAttendance').classes.find(c => c.class_id === 'C1').attendance.percent;
call(l1, 'decideClaim', { claim_id: 'CL001', decision: 'Approved', comment: 'OK' });
const after = call(s5, 'myAttendance').classes.find(c => c.class_id === 'C1').attendance.percent;
console.log('S005 attendance before/after claim approval:', before, after);
assert.ok(after > before);
expectFail(() => call(l1, 'decideClaim', { claim_id: 'CL001', decision: 'Approved' }), 'state');

// new claim with file
const sess = db.all('Sessions').find(s => s.class_id === 'C1' && s.date === '2026-08-24');
expectFail(() => call(s3, 'submitClaim', { class_id: 'C1', session_ids: [sess.session_id], reason_type: 'MC' }), 'file');
expectFail(() => call(s3, 'submitClaim', { class_id: 'C1', session_ids: [sess.session_id], reason_type: 'MC', file: { name: 'x.exe', type: 'application/x-msdownload', data: 'AAAA' } }), 'file');
const cl = call(s3, 'submitClaim', { class_id: 'C1', session_ids: [sess.session_id], reason_type: 'MC', note: 'demam', file: { name: 'mc.pdf', type: 'application/pdf', data: 'AAAA' } });
expectFail(() => call(l1, 'decideClaim', { claim_id: cl.claim_id, decision: 'Rejected' }), 'missing');
call(l1, 'decideClaim', { claim_id: cl.claim_id, decision: 'Rejected', comment: 'MC date does not match' });

// session + QR check-in
const ns = call(l1, 'createSession', { class_id: 'C1', date: '2026-09-29', start: '08:00', end: '10:00', topic: 'Mock discussion' });
const qr = call(l1, 'openQR', { session_id: ns.session_id });
expectFail(() => call(s3, 'checkIn', { code: 'ZZZZZZ' }), 'code');
const ci = call(s3, 'checkIn', { code: qr.code.toLowerCase() });
assert.ok(ci.ok);
const s9 = call(null, 'login', { user_id: 'S009', pin: '1234' });
expectFail(() => call(s9, 'checkIn', { code: qr.code }), 'forbidden');
call(l1, 'markAttendance', { session_id: ns.session_id, marks: [{ student_id: 'S001', status: 'L' }, { student_id: 'S003', status: 'P' }, { student_id: 'S999', status: 'P' }] });
const roster = call(l1, 'sessionRoster', { session_id: ns.session_id });
console.log('Roster marked:', roster.roster.filter(r => r.status).map(r => r.student_id + ':' + r.status));

// tasks
const t = call(l1, 'createTask', { class_id: 'C1', title: 'Reflection log', due_at: '2026-10-01T23:59', max_marks: 10, description: 'Write 150 words' });
expectFail(() => call(s7, 'submitTask', { task_id: t.task_id, link: 'ftp://bad' }), 'link');
call(s7, 'submitTask', { task_id: t.task_id, link: 'https://docs.google.com/x' });
call(l1, 'grade', { task_id: t.task_id, student_id: 'S007', marks: 8, feedback: 'Good' });
expectFail(() => call(l1, 'grade', { task_id: t.task_id, student_id: 'S007', marks: 11 }), 'marks');
expectFail(() => call(s7, 'submitTask', { task_id: t.task_id, link: 'https://x.y' }), 'graded');
const mt = call(s7, 'myTasks');
console.log('S007 tasks:', mt[0].tasks.map(x => `${x.title}: ${x.status}${x.marks !== null ? ' ' + x.marks : ''}`));

// consultation
const slots = call(s3, 'openSlots');
console.log('Open slots for S003:', slots.map(s => s.slot_id + ' ' + s.lecturer));
const bk = call(s3, 'bookSlot', { slot_id: 'SL02', purpose: 'Attendance issue' });
expectFail(() => call(s7, 'bookSlot', { slot_id: 'SL02', purpose: 'x' }), 'taken');
call(l1, 'decideBooking', { booking_id: bk.booking_id, decision: 'Confirmed' });
call(l1, 'decideBooking', { booking_id: bk.booking_id, decision: 'Completed', notes: 'Agreed on attendance plan' });
call(l1, 'decideBooking', { booking_id: 'B001', decision: 'Rejected', notes: 'Please choose Wednesday' });
assert.strictEqual(db.all('Slots').find(s => s.slot_id === 'SL01').status, 'Open');
const add = call(l1, 'addSlots', { date: '2026-10-05', start: '09:30', end: '11:30', minutes: 30, mode: 'In person', location: 'Bilik' });
console.log('Slots created avoiding clashes:', add.created);

const tl = call(l1, 'studentTimeline', { class_id: 'C1', student_id: 'S003' });
console.log('S003 timeline:', tl.events.slice(0, 6).map(e => `${e.date} ${e.kind} ${e.status || ''} ${e.text}`));
assert.ok(tl.events.some(e => e.kind === 'intervention' && e.text.startsWith('Consultation')));

for (const k of ['attendance', 'submissions', 'pdp']) {
  const x = call(l1, 'exportData', { kind: k, class_id: 'C1' });
  assert.ok(x.rows.length === 8 && x.header.length === x.rows[0].length, k);
}
console.log('PdP report row:', call(l1, 'exportData', { kind: 'pdp', class_id: 'C1' }).rows[2]);
console.log('S003 notifications:', call(s3, 'notifications').map(n => n.message_en));
call(s3, 'markRead'); assert.strictEqual(call(s3, 'me').unread, 0);
call(s3, 'changePin', { old_pin: '1234', new_pin: '5678' });
call(null, 'login', { user_id: 'S003', pin: '5678' });
console.log('Audit entries:', db.all('AuditLog').length);
console.log('\nALL TESTS PASSED');
