/* MyPdP Insight — front end (GitHub Pages). Plain JavaScript, no build step. */
(function () {
  'use strict';
  var CFG = window.MYPDP_CONFIG || {}, I18N = window.MYPDP_I18N;
  var LIVE = !!(CFG.API_URL && CFG.API_URL.trim());
  var app = document.getElementById('app');

  // ---------- storage (wrapped: some browsers block it) ----------
  function sget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function tget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function tset(k, v) { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} }

  var lang = sget('mypdp_lang') || CFG.DEFAULT_LANG || 'ms';
  var S = { token: tget('mypdp_token'), user: null, unread: 0, settings: { maxMb: 5, threshold: 80 } };
  try { S.user = JSON.parse(tget('mypdp_user') || 'null'); } catch (e) {}
  var demoDb = LIVE ? null : MyPdPDemoDB.create(window.MYPDP_SEED);

  // ---------- helpers ----------
  function t(k, vars) {
    var s = (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.replace('{' + v + '}', vars[v]); });
    return s;
  }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function msg(err) { return err ? (lang === 'ms' ? (err.ms || err.en) : (err.en || err.ms)) : ''; }
  var MONTHS = { ms: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
  var DAYS = { ms: ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
  function fdate(d, withDay) {
    if (!d) return '';
    var y = +d.slice(0, 4), m = +d.slice(5, 7), dd = +d.slice(8, 10);
    var s = dd + ' ' + MONTHS[lang][m - 1] + ' ' + y;
    if (withDay) s = DAYS[lang][new Date(y, m - 1, dd).getDay()] + ', ' + s;
    return s;
  }
  function fdt(d) { return d ? fdate(d.slice(0, 10)) + (d.length > 10 ? ' ' + d.slice(11, 16) : '') : ''; }
  function nowIso() { return MyPdPCore.iso(new Date()); }
  function initials(n) { return String(n || '?').replace(/^(Pn\.|En\.|Dr\.|Ts\.)\s*/i, '').split(/\s+/).slice(0, 2).map(function (x) { return x[0]; }).join('').toUpperCase(); }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var RISK = { green: ['riskGreen', 'sRiskGreen', 'b-green'], yellow: ['riskYellow', 'sRiskYellow', 'b-yellow'], orange: ['riskOrange', 'sRiskOrange', 'b-orange'], red: ['riskRed', 'sRiskRed', 'b-red'] };
  function riskBadge(level, studentView) { var r = RISK[level] || RISK.green; return '<span class="badge b-dot ' + r[2] + '">' + esc(t(studentView ? r[1] : r[0])) + '</span>'; }
  var ATT = { P: ['attP', 'b-green'], L: ['attL', 'b-yellow'], A: ['attA', 'b-red'], E: ['attE', 'b-blue'], '': ['attNone', ''] };
  function attBadge(s) { var a = ATT[s || ''] || ATT['']; return '<span class="badge ' + a[1] + '">' + esc(t(a[0])) + '</span>'; }
  var TASK = { 'Not submitted': ['tNotSubmitted', ''], Submitted: ['tSubmitted', 'b-blue'], Late: ['tLate', 'b-yellow'], Graded: ['tGraded', 'b-green'], Missing: ['tMissing', 'b-red'] };
  function taskBadge(s) { var a = TASK[s] || ['', '']; return '<span class="badge ' + a[1] + '">' + esc(t(a[0]) || s) + '</span>'; }
  var CLAIM = { Pending: ['cPending', 'b-yellow'], Approved: ['cApproved', 'b-green'], Rejected: ['cRejected', 'b-red'] };
  function claimBadge(s) { var a = CLAIM[s] || ['', '']; return '<span class="badge ' + a[1] + '">' + esc(t(a[0]) || s) + '</span>'; }
  var BOOK = { Pending: ['bPending', 'b-yellow'], Confirmed: ['bConfirmed', 'b-blue'], Rejected: ['bRejected', 'b-red'], Completed: ['bCompleted', 'b-green'], Cancelled: ['bCancelled', ''] };
  function bookBadge(s) { var a = BOOK[s] || ['', '']; return '<span class="badge ' + a[1] + '">' + esc(t(a[0]) || s) + '</span>'; }
  var REASON = { MC: 'rMC', Official: 'rOfficial', Family: 'rFamily', Other: 'rOther' };
  function typeLabel(x) { var m = { Assignment: 'typeAssignment', Quiz: 'typeQuiz', Tutorial: 'typeTutorial', Project: 'typeProject', Practical: 'typePractical' }; return m[x] ? t(m[x]) : x; }
  function meter(pct, thr) { var cls = pct < thr ? 'low' : (pct < thr + 5 ? 'mid' : ''); return '<div class="meter ' + cls + '"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>'; }
  function reasonText(rs) { return (rs || []).map(function (r) { return esc(lang === 'ms' ? r.ms : r.en); }).join(' · '); }
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM21 14v.01M14 21h.01M17 21h4v-4"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
    med: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11.5v6M9 14.5h6"/>',
    tasks: '<rect x="5" y="4" width="14" height="18" rx="2.5"/><path d="M9 2.5h6v3H9zM9 13l2 2 4-4"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-4-6.3"/>',
    report: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14 9l2 2"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    clip: '<path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
    bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
    pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>'
  };
  function ic(n) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }
  function ring(pct, thr, label) {
    var r = 38, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct)), off = c * (1 - p / 100);
    var cls = pct < thr ? 'low' : (pct < thr + 5 ? 'mid' : '');
    return '<div class="ring ' + cls + '" role="img" aria-label="' + esc(label || '') + ' ' + pct + '%"><svg viewBox="0 0 90 90"><circle class="trk" cx="45" cy="45" r="' + r + '"/>' +
      '<circle class="val" cx="45" cy="45" r="' + r + '" style="--c:' + c.toFixed(1) + ';stroke-dasharray:' + c.toFixed(1) + ';stroke-dashoffset:' + off.toFixed(1) + '"/></svg><b>' + cnt(pct, '%') + '</b></div>';
  }
  function cnt(v, suf) { return '<span data-count="' + v + '" data-suf="' + (suf || '') + '">' + v + (suf || '') + '</span>'; }
  function animateIn(root) {
    if (!root) return;
    root.querySelectorAll('.anim').forEach(function (a) { Array.prototype.forEach.call(a.children, function (c, i) { c.style.setProperty('--i', i); }); });
    root.querySelectorAll('.timeline li').forEach(function (li, i) { li.style.setProperty('--i', i); });
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('[data-count]').forEach(function (el) {
      var to = parseFloat(el.dataset.count), suf = el.dataset.suf || '', dec = String(el.dataset.count).indexOf('.') >= 0 ? 1 : 0, t0 = null;
      if (isNaN(to)) return;
      function step(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / 1000), e = 1 - Math.pow(1 - p, 3); el.textContent = (to * e).toFixed(dec) + suf; if (p < 1) requestAnimationFrame(step); else el.textContent = el.dataset.count + suf; }
      requestAnimationFrame(step);
    });
  }
  function swoosh() { return '<svg class="swoosh" viewBox="0 0 800 260" preserveAspectRatio="none" aria-hidden="true"><path d="M-30 235 C 170 110, 330 310, 530 170 S 770 30, 850 110"/></svg>'; }
  function arw() { return '<span class="arw">' + ic('arrow') + '</span>'; }
  function tile(cls, n, label, href, suf) {
    return '<a class="tile ' + cls + '" href="' + href + '"><span class="go">' + ic('arrow') + '</span><div class="big">' + cnt(n, suf) + '</div><div class="lbl">' + esc(label) + '</div></a>';
  }

  function toast(text, isErr) {
    var el = document.createElement('div'); el.className = 'toast' + (isErr ? ' err' : ''); el.setAttribute('role', 'status'); el.innerHTML = ic(isErr ? 'alert' : 'check') + '<span></span>'; el.lastChild.textContent = text;
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, isErr ? 5000 : 2800);
  }
  function modal(html) {
    closeModal();
    var bg = document.createElement('div'); bg.className = 'modal-bg'; bg.id = 'modal';
    bg.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
    bg.addEventListener('click', function (e) { if (e.target === bg) closeModal(); });
    document.body.appendChild(bg);
    var f = bg.querySelector('input,select,textarea,button'); if (f) f.focus();
    return bg;
  }
  function closeModal() { var m = document.getElementById('modal'); if (m) m.remove(); if (qrTimer) { clearInterval(qrTimer); qrTimer = null; } }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // ---------- API ----------
  function api(action, payload) {
    if (!LIVE) {
      return delay(120).then(function () {
        var user = null;
        if (action !== 'login') {
          user = demoDb.all('Users').filter(function (u) { return u.user_id === S.token; })[0] || null;
        }
        try {
          var d = MyPdPCore.handle(demoDb, user, action, payload || {});
          return action === 'login' ? { token: d.user_id, user: d } : d;
        } catch (e) { throw { code: e.code || 'error', en: e.message, ms: e.ms || e.message }; }
      }).catch(handleErr);
    }
    return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, payload: payload || {}, token: S.token }) })
      .then(function (r) { return r.json(); }, function () { throw { code: 'network', en: I18N.en.networkError, ms: I18N.ms.networkError }; })
      .then(function (j) { if (!j.ok) throw j.error; return j.data; }).catch(handleErr);
  }
  function handleErr(e) {
    if (e && e.code === 'auth') { logout(true); }
    throw e;
  }

  // ---------- auth ----------
  function setSession(token, user) { S.token = token; S.user = user; tset('mypdp_token', token); tset('mypdp_user', user ? JSON.stringify(user) : null); }
  function logout(silent) {
    if (LIVE && S.token && !silent) fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'logout', token: S.token }) }).catch(function () {});
    setSession(null, null); location.hash = '#/login'; render();
  }
  function isLect() { return S.user && (S.user.role === 'lecturer' || S.user.role === 'admin'); }

  // ---------- routing ----------
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    var q = {}, parts = h.split('?');
    (parts[1] || '').split('&').forEach(function (kv) { if (kv) { var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); } });
    var seg = parts[0].split('/').filter(String);
    return { name: seg[0] || '', args: seg.slice(1), q: q };
  }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  window.addEventListener('hashchange', render);

  var NAV_S = [['dashboard', ic('home'), 'nDashboard'], ['checkin', ic('qr'), 'nCheckin'], ['attendance', ic('calendar'), 'nAttendance'], ['claims', ic('med'), 'nClaims'], ['tasks', ic('tasks'), 'nTasks'], ['marks', ic('chart'), 'nMarks'], ['consult', ic('chat'), 'nConsult'], ['notifications', ic('bell'), 'nNotif']];
  var NAV_L = [['dashboard', ic('home'), 'nDashboard'], ['classes', ic('users'), 'nClasses'], ['attendance', ic('calendar'), 'nAttendanceL'], ['claims', ic('med'), 'nClaimsL'], ['tasks', ic('tasks'), 'nMarking'], ['consult', ic('chat'), 'nConsult'], ['reports', ic('report'), 'nReports'], ['notifications', ic('bell'), 'nNotif']];

  function langToggle() {
    return '<div class="lang" role="group" aria-label="' + esc(t('language')) + '">' +
      '<button data-act="lang" data-v="ms" aria-pressed="' + (lang === 'ms') + '">BM</button><button data-act="lang" data-v="en" aria-pressed="' + (lang === 'en') + '">EN</button></div>';
  }

  function shell(active, content) {
    var nav = isLect() ? NAV_L : NAV_S;
    var cur = nav.filter(function (n) { return n[0] === active; })[0] || nav[0];
    return '<div class="app"><aside class="side"><div class="side-in">' +
      '<a class="logo" href="#/dashboard"><span class="logo-mark">PdP</span><span>MyPdP Insight<small>' + esc(t(S.user.role === 'student' ? 'studentPortal' : 'lecturerPortal')) + '</small></span></a>' +
      '<nav class="nav" aria-label="Menu">' + nav.map(function (n) {
        var on = active === n[0];
        return '<a href="#/' + n[0] + '" class="' + (on ? 'active' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + n[1] + '<span>' + esc(t(n[2])) + '</span>' +
          (n[0] === 'notifications' && S.unread ? '<span class="count">' + S.unread + '</span>' : '') + '</a>';
      }).join('') + '</nav>' +
      '<div class="side-foot"><div class="side-card"><strong>' + esc(t('threshold')) + ': ' + (S.settings.threshold || 80) + '%</strong>' + esc(t('sideTip')) + '</div>' +
      '<button class="side-btn" data-act="logout">' + ic('logout') + esc(t('logout')) + '</button></div></div></aside>' +
      '<main class="main" id="main"><div class="topbar"><span class="crumb">MyPdP / ' + esc(t(cur[2])) + '</span>' + (LIVE ? '' : '<span class="demo-chip">' + esc(t('demoMode')) + '</span>') +
      '<div class="spacer"></div>' + langToggle() +
      '<button class="iconbtn" data-act="nav" data-v="#/notifications" aria-label="' + esc(t('nNotif')) + '">' + ic('bell') + (S.unread ? '<span class="dot">' + S.unread + '</span>' : '') + '</button>' +
      '<div class="usermenu"><button data-act="usermenu" aria-haspopup="true"><span class="avatar">' + esc(initials(S.user.name)) + '</span><span class="uname">' + esc(S.user.name) + '</span></button>' +
      '<div class="dropdown hidden" id="umenu"><div class="small muted" style="padding:6px 10px">' + esc(S.user.user_id) + ' · ' + esc(t(S.user.role)) + '</div>' +
      '<button data-act="changepin">' + ic('key') + esc(t('changePin')) + '</button>' + (LIVE ? '' : '<button data-act="demoreset">' + ic('reset') + esc(t('demoReset')) + '</button>') +
      '<button data-act="logout">' + ic('logout') + esc(t('logout')) + '</button></div></div></div>' +
      '<div class="anim" id="page">' + content + '</div></main></div>';
  }

  var renderSeq = 0;
  function render() {
    closeModal();
    document.documentElement.lang = lang;
    var r = route();
    if (r.name === 'checkin' && r.args[0] && !S.user) tset('mypdp_pending_checkin', r.args[0]);
    if (!S.user || !S.token) { if (r.name !== 'login') { history.replaceState(null, '', '#/login'); } app.innerHTML = loginView(); animateIn(app); return; }
    if (r.name === 'login' || !r.name) { history.replaceState(null, '', '#/dashboard'); r = route(); }
    var pending = tget('mypdp_pending_checkin');
    if (pending && !isLect()) { tset('mypdp_pending_checkin', null); history.replaceState(null, '', '#/checkin/' + pending); r = route(); }
    var pages = isLect() ? L_PAGES : S_PAGES;
    var page = pages[r.name] || pages.dashboard;
    var activeName = pages[r.name] ? ({ 'class': 'classes', student: 'classes', session: 'attendance', task: 'tasks' }[r.name] || r.name) : 'dashboard';
    app.innerHTML = shell(activeName, '<div class="spinner">' + esc(t('loading')) + '</div>');
    var seq = ++renderSeq;
    api('me').then(function (m) { S.unread = m.unread; S.settings = m.settings || S.settings; return page(r); })
      .then(function (html) { if (seq !== renderSeq) return; app.innerHTML = shell(activeName, html); animateIn(document.getElementById('main')); var f = pageAfter; pageAfter = null; if (f) f(); window.scrollTo(0, 0); })
      .catch(function (e) { if (seq !== renderSeq) return; var m = document.getElementById('main'); if (m) m.innerHTML = '<div class="alert alert-red">' + esc(msg(e) || String(e)) + '</div>'; });
  }
  var pageAfter = null; // optional callback after a page is painted

  // ---------- login ----------
  function loginView() {
    var ms = lang === 'ms';
    var demo = '';
    if (!LIVE) {
      var users = demoDb.all('Users').filter(function (u) { return ['L001', 'L002', 'S003', 'S005', 'S007', 'S001'].indexOf(u.user_id) >= 0; });
      demo = '<div class="card" style="margin-top:16px"><div class="eyebrow">' + esc(t('demoAccounts')) + ' · PIN 1234</div><p class="small muted" style="margin:6px 0 10px">' + esc(t('demoNote')) + '</p><div class="demo-users">' + users.map(function (u) {
        return '<button data-act="demologin" data-v="' + u.user_id + '"><span class="avatar">' + esc(initials(u.name)) + '</span><span><strong>' + esc(u.name) + '</strong><br><span class="muted small">' + esc(u.user_id) + ' · ' + esc(t(u.role)) + '</span></span></button>';
      }).join('') + '</div></div>';
    }
    var fc = function (cls, ry, i, inner) { return '<div class="fcard ' + cls + '" style="--ry:' + ry + 'deg;--i:' + i + '">' + inner + '</div>'; };
    var mini = function (arr) { return '<div class="mini">' + arr.map(function (h) { return '<i style="height:' + h + '%"></i>'; }).join('') + '</div>'; };
    var cards = [
      fc('', 38, 0, (ms ? 'Kehadiran minggu ini' : 'Attendance this week') + '<div class="v">91%</div>' + mini([60, 72, 55, 88, 80, 95, 91])),
      fc('dark', 26, 1, (ms ? 'Pelajar berisiko' : 'At-risk students') + '<div class="v">4</div><span style="color:#ff7382">● ' + (ms ? 'Perhatian Tinggi' : 'High Attention') + '</span>'),
      fc('lime', 14, 2, 'MC · CL001<div class="v">' + (ms ? 'Lulus' : 'Approved') + '</div>' + (ms ? 'Kehadiran dikemas kini' : 'Attendance updated')),
      fc('blue', 0, 3, (ms ? 'Kod daftar masuk' : 'Check-in code') + '<div class="v" style="letter-spacing:.12em">7K3QPA</div>' + (ms ? 'Sah 10 minit' : 'Valid 10 min')),
      fc('', -14, 4, (ms ? 'Tugasan dihantar' : 'Tasks submitted') + '<div class="v">83%</div><span class="ok">+12%</span>'),
      fc('dark', -26, 5, (ms ? 'Konsultasi' : 'Consultation') + '<div class="v">10:30</div>' + (ms ? 'Isn, 5 Okt · Disahkan' : 'Mon, 5 Oct · Confirmed')),
      fc('lime', -38, 6, (ms ? 'Laporan PdP' : 'PdP report') + '<div class="v">CSV</div>' + (ms ? '1 klik' : '1 click'))
    ].join('');
    var feats = ms ? ['Kehadiran QR', 'Tuntutan MC', 'Amaran Awal', 'Konsultasi', 'Garis Masa Pelajar', 'Laporan PdP', 'Tugasan & Markah'] : ['QR Attendance', 'MC Claims', 'Early Warning', 'Consultation', 'Student Timeline', 'PdP Reports', 'Tasks & Marks'];
    var mq = feats.concat(feats).map(function (f) { return '<span>' + ic('spark') + esc(f) + '</span>'; }).join('');
    return '<div class="landing anim">' +
      '<section class="sky"><div class="sky-nav"><span class="logo"><span class="logo-mark">PdP</span><span>MyPdP Insight</span></span>' +
      '<nav class="links" aria-label="Sections"><a href="#/login" data-act="scrollto" data-v="features">' + esc(t('landFeatures')) + '</a><a href="#/login" data-act="scrollto" data-v="loginbox">' + esc(t('login')) + '</a><a href="#/login" data-act="scrollto" data-v="about">' + esc(t('landHow')) + '</a></nav>' +
      '<div class="right-tools">' + langToggle() + '</div></div>' +
      '<div class="sky-hero"><h1>' + esc(t('landH1a')) + '<span>' + esc(t('landH1b')) + '</span></h1><p>' + esc(t('landP')) + '</p>' +
      '<div class="sky-cta">' + (LIVE ? '' : '<button class="btn btn-ghost" data-act="demologin" data-v="L001">' + esc(t('viewDemo')) + '</button>') +
      '<button class="btn btn-primary" data-act="scrollto" data-v="loginbox">' + esc(t('getStarted')) + arw() + '</button></div></div>' +
      '<div class="carousel" aria-hidden="true">' + cards + '</div><div class="rated">' + esc(t('landRated')) + '</div></section>' +
      '<div class="marquee" id="features" aria-hidden="true"><div class="track">' + mq + '</div></div>' +
      '<div class="about" id="about"><div class="eyebrow">' + esc(t('landAbout')) + '</div><h2>' + esc(t('about1')) + ' <span class="pill-ico" style="background:var(--sky-2);color:#fff">' + ic('pie') + '</span> ' + esc(t('about2')) +
      ' <span class="soft">' + esc(t('about3')) + ' <span class="pill-ico" style="background:var(--lime);color:var(--lime-ink)">' + ic('bulb') + '</span> ' + esc(t('about4')) + '</span></h2></div>' +
      '<div class="land-grid"><div><div class="card" id="loginbox"><div class="eyebrow">' + esc(t(CFG.INSTITUTION ? 'login' : 'login')) + '</div><h2 style="font-size:1.5rem;margin-top:6px">' + esc(t('welcomeBack')) + '</h2>' +
      '<form data-form="login" autocomplete="on"><label for="uid">' + esc(t('userId')) + '</label><input id="uid" name="user_id" type="text" autocapitalize="characters" required placeholder="S001">' +
      '<div class="small muted" style="margin-top:4px">' + esc(t('loginHint')) + '</div>' +
      '<label for="pin">' + esc(t('pin')) + '</label><input id="pin" name="pin" type="password" inputmode="numeric" required>' +
      '<div class="actions"><button class="btn btn-primary" type="submit" style="width:100%">' + esc(t('login')) + arw() + '</button></div></form></div>' + demo + '</div>' +
      '<div class="bento anim">' +
      '<div class="tile t-brand"><span class="go">' + ic('qr') + '</span><div class="big">' + cnt(10) + '<span style="font-size:1rem"> ' + (ms ? 'saat' : 'sec') + '</span></div><div class="lbl">' + esc(t('b1')) + '</div></div>' +
      '<div class="tile t-lime"><span class="go">' + ic('med') + '</span><div class="big">' + cnt(0) + '</div><div class="lbl">' + esc(t('b2')) + '</div></div>' +
      '<div class="tile t-white"><span class="go">' + ic('alert') + '</span><div class="big">' + cnt(4) + '</div><div class="lbl">' + esc(t('b3')) + '</div></div>' +
      '<div class="tile t-night"><span class="go">' + ic('download') + '</span><div class="big">' + cnt(1) + '<span style="font-size:1rem"> ' + (ms ? 'klik' : 'click') + '</span></div><div class="lbl">' + esc(t('b4')) + '</div></div>' +
      '</div></div><p class="small muted" style="text-align:center;margin-top:26px">' + esc(CFG.INSTITUTION || '') + ' · MyPdP Insight</p></div>';
  }

  function doLogin(id, pin) {
    return api('login', { user_id: id, pin: pin }).then(function (d) { setSession(d.token, d.user); go('#/dashboard'); })
      .catch(function (e) { toast(msg(e), true); });
  }

  // ================= STUDENT PAGES =================
  var S_PAGES = {};

  S_PAGES.dashboard = function () {
    return api('studentDashboard').then(function (d) {
      var order = { green: 0, yellow: 1, orange: 2, red: 3 };
      var worst = d.classes.reduce(function (w, c) { return order[c.risk.level] > order[w] ? c.risk.level : w; }, 'green');
      var avg = d.classes.length ? Math.round(d.classes.reduce(function (a, c) { return a + c.attendance.percent; }, 0) / d.classes.length * 10) / 10 : 0;
      var html = '<section class="hero-banner">' + swoosh() + '<div><div class="eyebrow">' + fdate(nowIso().slice(0, 10), true) + '</div><h1>' + esc(t('hello')) + ', ' + esc(S.user.name.split(' ')[0]) + '</h1>' +
        '<p>' + esc(worst === 'orange' || worst === 'red' ? t('heroStudentRisk') : t('heroStudentOk')) + '</p>' +
        '<div class="actions" style="margin:0"><a class="btn btn-primary" href="#/checkin">' + ic('qr') + esc(t('nCheckin')) + arw() + '</a>' +
        (worst === 'orange' || worst === 'red' ? '<a class="btn btn-dark" href="#/consult">' + ic('chat') + esc(t('bookSlot')) + '</a>' : '') + '</div></div>' +
        '<div class="hero-float"><div class="chip-card" style="--i:0"><div class="k">' + esc(t('attendance')) + '</div><div class="v">' + cnt(avg, '%') + '</div></div>' +
        '<div class="chip-card lime" style="--i:1"><div class="k">' + esc(t('yourClasses')) + '</div><div class="v">' + cnt(d.classes.length) + '</div></div>' +
        '<div class="chip-card dark" style="--i:2"><div class="k">' + esc(t('nNotif')) + '</div><div class="v">' + cnt(S.unread) + '</div></div></div></section>';
      html += '<div class="grid g4 anim" style="margin-bottom:18px">' + tile('t-lime', d.upcoming.length, t('dueSoon'), '#/tasks') + tile('t-night', d.missing.length, t('missingWork'), '#/tasks') +
        tile('t-brand', d.pendingClaims, t('claimsPendingShort'), '#/claims') + tile('t-white', d.bookings.length, t('upcomingConsult'), '#/consult') + '</div>';
      html += '<h2>' + ic('users') + esc(t('yourClasses')) + '</h2><div class="grid g3 anim">' + d.classes.map(function (c) {
        return '<div class="card classcard lift"><div class="top"><div><strong>' + esc(c.course_code) + '</strong> · ' + esc(c.class_name) + '<div class="small muted">' + esc(c.course_name) + '</div></div>' + riskBadge(c.risk.level, true) + '</div>' +
          '<div class="ringrow">' + ring(c.attendance.percent, d.threshold, t('attendance')) + '<div><div class="small muted">' + esc(t('threshold')) + ': ' + d.threshold + '%</div>' +
          (c.risk.reasons.length ? '<div class="small">' + reasonText(c.risk.reasons) + '</div>' : '<div class="small">' + esc(t('sRiskGreen')) + '</div>') +
          '<div class="small muted">' + esc(t('lecturerName')) + ': ' + esc(c.lecturer) + '</div></div></div></div>';
      }).join('') + '</div>';
      html += '<div class="grid split" style="margin-top:18px"><div class="card"><h2>' + ic('tasks') + esc(t('dueSoon')) + '</h2>' +
        (d.missing.length ? '<div class="alert alert-red small">' + ic('alert') + '<span><strong>' + esc(t('missingWork')) + ':</strong> ' + d.missing.map(function (x) { return esc(x.title) + ' (' + esc(x.course_code) + ')'; }).join(', ') + '</span></div>' : '') +
        (d.upcoming.length ? '<ul class="list">' + d.upcoming.slice(0, 5).map(function (x) {
          return '<li><div><strong>' + esc(x.title) + '</strong><div class="small muted">' + esc(x.course_code) + ' · ' + esc(t('due')) + ' ' + fdt(x.due_at) + '</div></div><a class="btn btn-ghost btn-sm" href="#/tasks">' + esc(t('submit')) + '</a></li>';
        }).join('') + '</ul>' : '<div class="empty">' + esc(t('noTasks')) + '</div>') + '</div>' +
        '<div class="card"><h2>' + ic('chart') + esc(t('recentMarks')) + '</h2>' + (d.recentMarks.length ? '<div class="stack" style="gap:12px">' + d.recentMarks.map(function (x) {
          var p = Math.round(x.marks / x.max_marks * 100);
          return '<div><div class="kv small"><span>' + esc(x.title) + '</span><strong>' + x.marks + '/' + x.max_marks + '</strong></div>' + meter(p, 50) + '</div>';
        }).join('') + '</div>' : '<div class="empty">' + esc(t('noMarks')) + '</div>') + '</div></div>';
      return html;
    });
  };

  S_PAGES.attendance = function () {
    return api('myAttendance').then(function (d) {
      var html = '<div class="pagehead"><h1>' + esc(t('nAttendance')) + '</h1><a class="btn btn-ghost" href="#/claims">' + ic('med') + ' ' + esc(t('claimThis')) + '</a></div>';
      html += '<div class="alert alert-blue small"><strong>' + esc(t('formula')) + ':</strong> ' + esc(t('formulaText')) + ' ' + (d.lateOk ? esc(t('formulaLate')) + ' ' : '') + (d.excusedOut ? esc(t('formulaExcused')) : '') + ' ' + esc(t('threshold')) + ': ' + d.threshold + '%.</div>';
      d.classes.forEach(function (c) {
        var a = c.attendance;
        html += '<div class="card"><div class="pagehead" style="margin-bottom:8px"><div><h2 style="margin:0">' + esc(c.course_code) + ' · ' + esc(c.class_name) + '</h2><div class="small muted">' + esc(c.course_name) + '</div></div>' +
          '<div style="min-width:200px"><div class="kv"><span>' + esc(t('attendance')) + '</span><strong>' + a.percent + '%</strong></div>' + meter(a.percent, d.threshold) + '</div></div>' +
          (a.percent < d.threshold && a.counted ? '<div class="alert alert-red small">' + esc(t('belowLimit')) + '</div>' : '') +
          '<div class="small muted" style="margin-bottom:8px">' + esc(t('attP')) + ': ' + (a.attended - (d.lateOk ? a.late : 0)) + ' · ' + esc(t('attL')) + ': ' + a.late + ' · ' + esc(t('attA')) + ': ' + a.absent + ' · ' + esc(t('attE')) + ': ' + a.excused + '</div>' +
          '<div class="tablewrap"><table><thead><tr><th>' + esc(t('date')) + '</th><th>' + esc(t('topic')) + '</th><th>' + esc(t('status')) + '</th><th></th></tr></thead><tbody>' +
          a.sessions.map(function (s) {
            return '<tr><td class="nowrap">' + fdate(s.date, true) + '<div class="small muted">' + esc(s.start) + '–' + esc(s.end) + '</div></td><td>' + esc(s.topic) + '</td><td>' + attBadge(s.status) + '</td><td class="right">' +
              (s.status === 'A' ? '<a class="btn btn-ghost btn-sm" href="#/claims?c=' + c.class_id + '&s=' + s.session_id + '">' + esc(t('claimThis')) + '</a>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div></div>';
      });
      return html;
    });
  };

  S_PAGES.claims = function (r) {
    return Promise.all([api('myAttendance'), api('myClaims')]).then(function (res) {
      var att = res[0], claims = res[1];
      var cid = r.q.c || (att.classes[0] && att.classes[0].class_id);
      var cls = att.classes.filter(function (c) { return c.class_id === cid; })[0] || att.classes[0];
      var pendingIds = {};
      claims.forEach(function (c) { if (c.status !== 'Rejected') c.sessions.forEach(function (s) { pendingIds[s.session_id] = 1; }); });
      var sess = cls ? cls.attendance.sessions.filter(function (s) { return s.status !== 'P' && s.status !== 'E' && !pendingIds[s.session_id]; }) : [];
      var html = '<div class="pagehead"><h1>' + esc(t('nClaims')) + '</h1></div><div class="grid g2 anim"><div class="card"><h2>' + esc(t('claimNew')) + '</h2><p class="small muted">' + esc(t('claimIntro')) + '</p>' +
        '<form data-form="claim"><label for="c-class">' + esc(t('chooseClass')) + '</label><select id="c-class" name="class_id" data-act="claimclass">' +
        att.classes.map(function (c) { return '<option value="' + c.class_id + '"' + (cls && c.class_id === cls.class_id ? ' selected' : '') + '>' + esc(c.course_code + ' · ' + c.class_name) + '</option>'; }).join('') + '</select>' +
        '<label>' + esc(t('chooseSessions')) + '</label>' + (sess.length ? sess.map(function (s) {
          return '<label class="check"><input type="checkbox" name="session" value="' + s.session_id + '"' + (r.q.s === s.session_id ? ' checked' : '') + '> ' + fdate(s.date, true) + ' — ' + esc(s.topic) + ' ' + attBadge(s.status) + '</label>';
        }).join('') : '<div class="small muted">' + esc(t('none')) + '</div>') +
        '<label for="c-reason">' + esc(t('reason')) + '</label><select id="c-reason" name="reason_type">' + Object.keys(REASON).map(function (k) { return '<option value="' + k + '">' + esc(t(REASON[k])) + '</option>'; }).join('') + '</select>' +
        '<label for="c-note">' + esc(t('note')) + ' <span class="muted">(' + esc(t('optional')) + ')</span></label><textarea id="c-note" name="note" maxlength="500"></textarea>' +
        '<label for="c-file">' + esc(t('upload')) + '</label><input id="c-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"><div class="small muted">' + esc(t('uploadHint', { mb: S.settings.maxMb || 5 })) + (LIVE ? '' : ' · ' + esc(t('noFileDemo'))) + '</div>' +
        '<div class="actions"><button class="btn btn-primary" type="submit"' + (sess.length ? '' : ' disabled') + '>' + esc(t('submit')) + '</button></div></form></div>' +
        '<div class="card"><h2>' + esc(t('myClaims')) + '</h2>' + (claims.length ? '<ul class="list">' + claims.map(function (c) {
          return '<li style="align-items:flex-start"><div><strong>' + esc(t(REASON[c.reason_type] || c.reason_type)) + '</strong> · ' + esc(c.course_code) + '<div class="small muted">' + c.sessions.map(function (s) { return fdate(s.date); }).join(', ') + ' · ' + esc(t('submittedAt')) + ' ' + fdt(c.submitted_at) + '</div>' +
            (c.comment ? '<div class="small">' + esc(t('lecturerComment')) + ': ' + esc(c.comment) + '</div>' : '') + '</div>' + claimBadge(c.status) + '</li>';
        }).join('') + '</ul>' : '<div class="empty">' + esc(t('noClaims')) + '</div>') + '</div></div>';
      return html;
    });
  };

  S_PAGES.tasks = function () {
    return api('myTasks').then(function (classes) {
      var html = '<div class="pagehead"><h1>' + esc(t('nTasks')) + '</h1></div>';
      classes.forEach(function (c) {
        html += '<div class="card"><h2>' + esc(c.course_code) + ' · ' + esc(c.class_name) + ' <span class="small muted">' + esc(c.course_name) + '</span></h2>' + (c.tasks.length ? '<div class="tablewrap"><table><thead><tr><th>' + esc(t('taskTitle')) + '</th><th>' + esc(t('due')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('marks')) + '</th><th></th></tr></thead><tbody>' +
          c.tasks.map(function (x) {
            var canSubmit = x.status !== 'Graded';
            return '<tr><td><strong>' + esc(x.title) + '</strong><div class="small muted">' + esc(typeLabel(x.type)) + (x.description ? ' · ' + esc(x.description) : '') + '</div>' + (x.feedback ? '<div class="small">' + ic('chat') + ' ' + esc(x.feedback) + '</div>' : '') + '</td>' +
              '<td class="nowrap">' + fdt(x.due_at) + '</td><td>' + taskBadge(x.status) + (x.submitted_at ? '<div class="small muted">' + fdt(x.submitted_at) + '</div>' : '') + '</td>' +
              '<td>' + (x.marks !== null ? '<strong>' + x.marks + '</strong>/' + x.max_marks : '<span class="muted">/' + x.max_marks + '</span>') + '</td>' +
              '<td class="right">' + (canSubmit ? '<button class="btn btn-' + (x.submitted_at ? 'ghost' : 'primary') + ' btn-sm" data-act="submitwork" data-v="' + x.task_id + '" data-title="' + esc(x.title) + '">' + esc(x.submitted_at ? t('resubmit') : t('submit')) + '</button>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="empty">' + esc(t('noTasks')) + '</div>') + '</div>';
      });
      return html;
    });
  };

  S_PAGES.marks = function () {
    return Promise.all([api('myTasks'), api('studentDashboard')]).then(function (res) {
      var risk = {}; res[1].classes.forEach(function (c) { risk[c.class_id] = c.risk; });
      var html = '<div class="pagehead"><h1>' + esc(t('nMarks')) + '</h1></div><div class="grid g2 anim">';
      res[0].forEach(function (c) {
        var graded = c.tasks.filter(function (x) { return x.marks !== null; });
        var rk = risk[c.class_id] || {};
        html += '<div class="card"><div class="classcard"><div class="top"><div><strong>' + esc(c.course_code) + '</strong> · ' + esc(c.class_name) + '<div class="small muted">' + esc(c.course_name) + '</div></div>' + riskBadge(rk.level, true) + '</div>' +
          '<div class="kv"><span>' + esc(t('average')) + '</span><strong>' + (rk.average === null || rk.average === undefined ? '—' : rk.average + '%') + '</strong></div>' +
          '<h3 style="margin-top:6px">' + esc(t('progress')) + '</h3>' + (graded.length ? graded.map(function (x) {
            var p = Math.round(x.marks / x.max_marks * 100);
            return '<div><div class="kv small"><span>' + esc(x.title) + '</span><span>' + x.marks + '/' + x.max_marks + ' (' + p + '%)</span></div>' + meter(p, 50) + '</div>';
          }).join('') : '<div class="empty">' + esc(t('noMarks')) + '</div>') +
          (rk.dropping ? '<div class="alert alert-yellow small">' + esc(t('consultPrompt')) + ' <a href="#/consult">' + esc(t('bookSlot')) + '</a></div>' : '') + '</div></div>';
      });
      return html + '</div>';
    });
  };

  S_PAGES.consult = function () {
    return Promise.all([api('openSlots'), api('myBookings')]).then(function (res) {
      var slots = res[0], mine = res[1];
      var html = '<div class="pagehead"><h1>' + esc(t('nConsult')) + '</h1></div><div class="grid g2 anim"><div class="card"><h2>' + esc(t('openSlots')) + '</h2>' +
        (slots.length ? '<ul class="list">' + slots.map(function (s) {
          return '<li><div><strong>' + fdate(s.date, true) + '</strong> · ' + esc(s.start) + '–' + esc(s.end) + '<div class="small muted">' + esc(s.lecturer) + ' · ' + esc(s.mode === 'Online' ? t('online') : t('inPerson')) + ' · ' + esc(s.location) + '</div></div>' +
            '<button class="btn btn-primary btn-sm" data-act="book" data-v="' + s.slot_id + '" data-label="' + esc(fdate(s.date) + ' ' + s.start + ' · ' + s.lecturer) + '">' + esc(t('bookSlot')) + '</button></li>';
        }).join('') + '</ul>' : '<div class="empty">' + esc(t('noSlots')) + '</div>') + '</div>' +
        '<div class="card"><h2>' + esc(t('myBookings')) + '</h2>' + (mine.length ? '<ul class="list">' + mine.map(function (b) {
          var canCancel = b.status === 'Pending' || b.status === 'Confirmed';
          return '<li style="align-items:flex-start"><div><strong>' + fdate(b.date) + '</strong> · ' + esc(b.start) + ' · ' + esc(b.lecturer) + '<div class="small muted">' + esc(b.purpose) + '</div>' + (b.notes ? '<div class="small">' + ic('tasks') + ' ' + esc(b.notes) + '</div>' : '') + '</div>' +
            '<div class="right">' + bookBadge(b.status) + (canCancel ? '<div style="margin-top:6px"><button class="btn btn-ghost btn-sm" data-act="cancelbooking" data-v="' + b.booking_id + '">' + esc(t('cancel')) + '</button></div>' : '') + '</div></li>';
        }).join('') + '</ul>' : '<div class="empty">' + esc(t('noBookings')) + '</div>') + '</div></div>';
      return html;
    });
  };

  S_PAGES.checkin = function (r) {
    var code = (r.args[0] || '').toUpperCase();
    var html = '<div class="pagehead"><h1>' + esc(t('checkinTitle')) + '</h1></div><div class="card" style="max-width:460px"><p>' + esc(t('checkinHint')) + '</p>' +
      '<form data-form="checkin"><label for="ci-code">' + esc(t('code')) + '</label><input id="ci-code" name="code" type="text" maxlength="6" autocapitalize="characters" value="' + esc(code) + '" style="font-size:1.6rem;letter-spacing:.3em;text-transform:uppercase;text-align:center" required>' +
      '<div class="actions"><button class="btn btn-primary" type="submit" style="width:100%">' + esc(t('submit')) + '</button></div></form><div id="ci-result"></div></div>';
    if (code) pageAfter = function () { var f = document.querySelector('[data-form="checkin"]'); if (f) FORMS.checkin(f); };
    return Promise.resolve(html);
  };

  function notificationsPage() {
    return api('notifications').then(function (list) {
      return '<div class="pagehead"><h1>' + esc(t('nNotif')) + '</h1>' + (S.unread ? '<button class="btn btn-ghost" data-act="markread">' + esc(t('markAllRead')) + '</button>' : '') + '</div><div class="card">' +
        (list.length ? '<ul class="list">' + list.map(function (n) {
          return '<li><div>' + (n.read === 'TRUE' ? '' : '<span class="badge b-red" style="margin-right:6px">•</span>') + esc(lang === 'ms' ? n.message_ms : n.message_en) + '<div class="small muted">' + fdt(n.created_at) + '</div></div>' +
            (n.link ? '<a class="btn btn-ghost btn-sm" href="#/' + esc(n.link) + '">' + esc(t('open')) + '</a>' : '') + '</li>';
        }).join('') + '</ul>' : '<div class="empty">' + esc(t('noNotif')) + '</div>') + '</div>';
    });
  }
  S_PAGES.notifications = notificationsPage;

  // ================= LECTURER PAGES =================
  var L_PAGES = {};
  L_PAGES.notifications = notificationsPage;

  function classPicker(classes, current, base) {
    return '<select aria-label="' + esc(t('class')) + '" data-act="pickclass" data-base="' + base + '" style="max-width:320px">' + classes.map(function (c) {
      return '<option value="' + c.class_id + '"' + (c.class_id === current ? ' selected' : '') + '>' + esc(c.course_code + ' · ' + c.class_name) + '</option>';
    }).join('') + '</select>';
  }

  L_PAGES.dashboard = function () {
    return api('lecturerDashboard').then(function (d) {
      var first = d.classes[0];
      return (first ? api('classSessions', { class_id: first.class_id }) : Promise.resolve([])).then(function (sess) { return [d, sess]; });
    }).then(function (res) {
      var d = res[0], sess = res[1], first = d.classes[0];
      var totalStudents = d.classes.reduce(function (a, c) { return a + c.students; }, 0);
      var avgAtt = d.classes.length ? Math.round(d.classes.reduce(function (a, c) { return a + c.attendance; }, 0) / d.classes.length * 10) / 10 : 0;
      var toGrade = d.classes.reduce(function (a, c) { return a + c.toGrade; }, 0);
      var html = '<section class="hero-banner">' + swoosh() + '<div><div class="eyebrow">' + fdate(nowIso().slice(0, 10), true) + '</div><h1>' + esc(t('hello')) + ', ' + esc(S.user.name) + '</h1>' +
        '<p>' + esc(d.atRisk.length ? t('heroLect', { n: d.atRisk.length }) : t('allOnTrack')) + '</p>' +
        '<div class="actions" style="margin:0"><a class="btn btn-primary" href="#/attendance">' + ic('calendar') + esc(t('nAttendanceL')) + arw() + '</a><a class="btn btn-dark" href="#/classes">' + ic('users') + esc(t('viewStudents')) + '</a></div></div>' +
        '<div class="hero-float"><div class="chip-card" style="--i:0"><div class="k">' + esc(t('avgAttendance')) + '</div><div class="v">' + cnt(avgAtt, '%') + '</div></div>' +
        '<div class="chip-card lime" style="--i:1"><div class="k">' + esc(t('classesCount')) + '</div><div class="v">' + cnt(d.classes.length) + '</div></div>' +
        '<div class="chip-card dark" style="--i:2"><div class="k">' + esc(t('students')) + '</div><div class="v">' + cnt(totalStudents) + '</div></div></div></section>';
      html += '<div class="grid g4 anim" style="margin-bottom:18px">' + tile('t-night', d.atRisk.length, t('needAttention'), '#/classes') + tile('t-lime', d.pendingClaims, t('pendingClaims'), '#/claims') +
        tile('t-brand', toGrade, t('toGrade'), '#/tasks') + tile('t-white', d.pendingBookings, t('pendingBookings'), '#/consult') + '</div>';
      // attendance by session (bar chart, chronological, latest highlighted)
      var pts = sess.filter(function (s) { return s.marked; }).slice(0, 8).reverse();
      var chart = pts.length ? '<div class="bars" role="img" aria-label="' + esc(t('attendanceTrend')) + '">' + pts.map(function (s, i) {
        var p = s.students ? Math.round(s.present / s.students * 100) : 0;
        return '<div class="bar' + (i === pts.length - 1 ? ' hl' : '') + '" style="--i:' + i + '"><span class="v">' + p + '%</span><div class="col"><i style="height:' + p + '%"></i></div><span class="d">' + esc(fdate(s.date).split(' ').slice(0, 2).join(' ')) + '</span></div>';
      }).join('') + '</div>' : '<div class="empty">' + esc(t('none')) + '</div>';
      html += '<div class="grid split"><div class="card"><div class="pagehead" style="margin-bottom:0"><div><h2 style="margin:0">' + ic('chart') + esc(t('attendanceTrend')) + '</h2><div class="small muted">' + (first ? esc(first.course_code + ' · ' + first.class_name) : '') + '</div></div>' +
        '<div class="legend"><span><i></i>' + esc(t('sessions')) + '</span><span><i class="l"></i>' + esc(t('latest')) + '</span></div></div>' + chart + '</div>' +
        '<div class="card"><h2>' + ic('alert') + esc(t('needAttention')) + '</h2>' + (d.atRisk.length ? '<ul class="list">' + d.atRisk.slice(0, 6).map(function (s) {
          return '<li><a class="person" href="#/student/' + s.class_id + '/' + s.student_id + '" style="text-decoration:none;color:inherit"><span class="avatar">' + esc(initials(s.name)) + '</span><div><strong>' + esc(s.name) + '</strong><div class="small muted">' + reasonText(s.reasons) + '</div></div></a>' + riskBadge(s.level) + '</li>';
        }).join('') + '</ul>' : '<div class="empty">' + esc(t('allOnTrack')) + '</div>') + '</div></div>';
      html += '<h2 style="margin-top:22px">' + ic('users') + esc(t('classesOverview')) + '</h2><div class="grid g2 anim">' + d.classes.map(function (c) {
        return '<div class="card classcard lift"><div class="top"><div><strong>' + esc(c.course_code) + ' · ' + esc(c.class_name) + '</strong><div class="small muted">' + esc(c.course_name) + ' · ' + c.students + ' ' + esc(t('students').toLowerCase()) + '</div></div>' +
          '<a class="btn btn-ghost btn-sm" href="#/class/' + c.class_id + '">' + esc(t('viewStudents')) + '</a></div>' +
          '<div class="ringrow">' + ring(c.attendance, d.threshold, t('attendance')) + '<div>' +
          '<div class="kv"><span>' + esc(t('submissionRate')) + '</span><strong>' + c.submissionRate + '%</strong></div>' + meter(c.submissionRate, 80) +
          '<div class="kv"><span>' + esc(t('avgMark')) + '</span><strong>' + (c.averageMark === null ? '—' : c.averageMark + '%') + '</strong></div>' + meter(c.averageMark === null ? 0 : c.averageMark, 50) + '</div></div>' +
          '<div class="riskbar">' + ['red', 'orange', 'yellow', 'green'].map(function (l) { return c.risk[l] ? '<span class="badge b-dot ' + RISK[l][2] + '">' + c.risk[l] + ' ' + esc(t(RISK[l][0])) + '</span>' : ''; }).join('') + '</div></div>';
      }).join('') + '</div>';
      html += '<div class="card" style="margin-top:18px"><h2>' + ic('calendar') + esc(t('upcomingDeadlines')) + '</h2>' + (d.deadlines.length ? '<ul class="list">' + d.deadlines.map(function (x) {
        return '<li><div><a href="#/task/' + x.task_id + '"><strong>' + esc(x.title) + '</strong></a><div class="small muted">' + esc(x.course_code) + ' · ' + esc(x.class_name) + '</div></div><span class="badge b-blue nowrap">' + fdt(x.due_at) + '</span></li>';
      }).join('') + '</ul>' : '<div class="empty">' + esc(t('noTasks')) + '</div>') + '</div>';
      return html;
    });
  };

  L_PAGES.classes = function () {
    return api('myClasses').then(function (classes) {
      if (classes.length === 1) { return L_PAGES['class']({ args: [classes[0].class_id] }); }
      return '<div class="pagehead"><h1>' + esc(t('nClasses')) + '</h1></div><div class="grid g3 anim">' + classes.map(function (c) {
        return '<a class="card" href="#/class/' + c.class_id + '" style="text-decoration:none;color:inherit"><strong>' + esc(c.course_code) + ' · ' + esc(c.class_name) + '</strong><div class="small muted">' + esc(c.course_name) + '</div><div class="small muted">' + esc(c.semester) + ' · ' + c.students + ' ' + esc(t('students').toLowerCase()) + '</div></a>';
      }).join('') + '</div>';
    });
  };

  L_PAGES['class'] = function (r) {
    return Promise.all([api('classStudents', { class_id: r.args[0] }), api('myClasses')]).then(function (res) {
      var d = res[0], c = d.cls;
      var order = { red: 0, orange: 1, yellow: 2, green: 3 };
      var list = d.students.slice().sort(function (a, b) { return order[a.level] - order[b.level] || (a.name < b.name ? -1 : 1); });
      return '<div class="pagehead"><div><h1>' + esc(c.course_code) + ' · ' + esc(c.class_name) + '</h1><div class="muted">' + esc(c.course_name) + ' · ' + esc(c.semester) + '</div></div>' + classPicker(res[1], c.class_id, '#/class/') + '</div>' +
        '<div class="card"><div class="tablewrap"><table><thead><tr><th>' + esc(t('name')) + '</th><th>' + esc(t('attendance')) + '</th><th class="hide-sm">' + esc(t('absences')) + '</th><th>' + esc(t('tMissing')) + '</th><th class="hide-sm">' + esc(t('average')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
        list.map(function (s) {
          return '<tr class="clickable" data-act="nav" data-v="#/student/' + c.class_id + '/' + s.student_id + '"><td><strong>' + esc(s.name) + '</strong><div class="small muted">' + esc(s.student_id) + '</div></td>' +
            '<td style="min-width:110px">' + s.attendance + '%' + meter(s.attendance, d.threshold) + '</td><td class="hide-sm">' + s.absent + '</td><td>' + (s.missing ? '<strong style="color:var(--red)">' + s.missing + '</strong>' : '0') + '</td>' +
            '<td class="hide-sm">' + (s.average === null ? '—' : s.average + '%') + '</td><td>' + riskBadge(s.level) + (s.reasons.length ? '<div class="small muted">' + reasonText(s.reasons) + '</div>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    });
  };

  var EV = { attendance: 'evAttendance', missing: 'evMissing', submission: 'evSubmission', claim: 'evClaim', consult: 'evConsult', intervention: 'evIntervention' };
  L_PAGES.student = function (r) {
    return api('studentTimeline', { class_id: r.args[0], student_id: r.args[1] }).then(function (d) {
      var s = d.summary, st = d.student;
      return '<div class="pagehead"><div><a href="#/class/' + d.cls.class_id + '" class="small">← ' + esc(d.cls.course_code) + ' · ' + esc(d.cls.class_name) + '</a><h1>' + esc(st.name) + '</h1><div class="muted">' + esc(st.user_id) + ' · ' + esc(st.programme) + ' · ' + esc(st.email) + '</div></div>' +
        '<button class="btn btn-primary" data-act="intervene" data-c="' + d.cls.class_id + '" data-s="' + st.user_id + '">' + ic('plus') + ' ' + esc(t('addIntervention')) + '</button></div>' +
        '<div class="grid g4 anim"><div class="tile t-brand"><div class="big">' + cnt(s.attendance.percent, '%') + '</div><div class="lbl">' + esc(t('attendance')) + '</div></div>' +
        '<div class="tile t-night"><div class="big">' + cnt(s.risk.missing) + '</div><div class="lbl">' + esc(t('tMissing')) + '</div></div>' +
        '<div class="tile t-lime"><div class="big">' + (s.risk.average === null ? '—' : cnt(s.risk.average, '%')) + '</div><div class="lbl">' + esc(t('average')) + '</div></div>' +
        '<div class="tile t-white"><div>' + riskBadge(s.risk.level) + '</div><div class="lbl">' + (reasonText(s.risk.reasons) || '—') + '</div></div></div>' +
        '<div class="grid g2 anim" style="margin-top:16px"><div class="card"><h2>' + ic('clock') + ' ' + esc(t('timeline')) + '</h2>' + (d.events.length ? '<ul class="timeline">' + d.events.map(function (e) {
          var b = e.kind === 'attendance' ? attBadge(e.status) : e.kind === 'submission' ? taskBadge(e.status) : e.kind === 'claim' ? claimBadge(e.status) : e.kind === 'consult' ? bookBadge(e.status) : '';
          return '<li class="k-' + e.kind + '"><div class="small muted">' + fdate(e.date) + ' · ' + esc(t(EV[e.kind])) + '</div><div>' + esc(e.text) + ' ' + b + '</div></li>';
        }).join('') + '</ul>' : '<div class="empty">' + esc(t('none')) + '</div>') + '</div>' +
        '<div class="card"><h2>' + ic('tasks') + ' ' + esc(t('nTasks')) + '</h2><ul class="list">' + s.tasks.map(function (x) {
          return '<li><div>' + esc(x.title) + '<div class="small muted">' + esc(t('due')) + ' ' + fdt(x.due_at) + '</div></div><div class="right">' + taskBadge(x.status) + (x.marks !== null ? '<div class="small"><strong>' + x.marks + '</strong>/' + x.max_marks + '</div>' : '') + '</div></li>';
        }).join('') + '</ul></div></div>';
    });
  };

  L_PAGES.attendance = function (r) {
    return api('myClasses').then(function (classes) {
      var cid = r.q.c || (classes[0] && classes[0].class_id);
      if (!cid) return '<div class="empty">' + esc(t('none')) + '</div>';
      return api('classSessions', { class_id: cid }).then(function (list) {
        return '<div class="pagehead"><h1>' + esc(t('nAttendanceL')) + '</h1><div class="row" style="flex:0 1 auto;align-items:center">' + classPicker(classes, cid, '#/attendance?c=') +
          '<button class="btn btn-primary" data-act="newsession" data-c="' + cid + '">' + ic('plus') + ' ' + esc(t('newSession')) + '</button></div></div>' +
          '<div class="card"><h2>' + esc(t('sessions')) + '</h2><div class="tablewrap"><table><thead><tr><th>' + esc(t('date')) + '</th><th>' + esc(t('topic')) + '</th><th>' + esc(t('attendance')) + '</th><th></th></tr></thead><tbody>' +
          list.map(function (s) {
            return '<tr><td class="nowrap">' + fdate(s.date, true) + '<div class="small muted">' + esc(s.start) + '–' + esc(s.end) + '</div></td><td>' + esc(s.topic) + (s.qr_active ? ' <span class="badge b-green">QR ' + esc(s.qr_active) + '</span>' : '') + '</td>' +
              '<td class="nowrap">' + s.present + '/' + s.students + ' ' + esc(t('present')) + (s.marked < s.students ? '<div class="small muted">' + s.marked + '/' + s.students + ' ' + esc(t('marked')) + '</div>' : '') + '</td>' +
              '<td class="right nowrap"><button class="btn btn-ghost btn-sm" data-act="showqr" data-v="' + s.session_id + '">' + ic('qr') + ' QR</button> <a class="btn btn-primary btn-sm" href="#/session/' + s.session_id + '">' + esc(t('edit')) + '</a></td></tr>';
          }).join('') + '</tbody></table></div></div>';
      });
    });
  };

  var rosterState = {};
  L_PAGES.session = function (r) {
    return api('sessionRoster', { session_id: r.args[0] }).then(function (d) {
      rosterState = { session_id: d.session.session_id, marks: {} };
      d.roster.forEach(function (x) { rosterState.marks[x.student_id] = x.status; });
      return '<div class="pagehead"><div><a class="small" href="#/attendance?c=' + d.cls.class_id + '">← ' + esc(t('sessions')) + '</a><h1>' + esc(d.cls.course_code) + ' · ' + esc(d.cls.class_name) + '</h1><div class="muted">' + fdate(d.session.date, true) + ' · ' + esc(d.session.start) + '–' + esc(d.session.end) + ' · ' + esc(d.session.topic) + '</div></div>' +
        '<div class="actions" style="margin:0"><button class="btn btn-ghost" data-act="showqr" data-v="' + d.session.session_id + '">' + ic('qr') + ' ' + esc(t('showQR')) + '</button><button class="btn btn-ghost" data-act="markall">' + ic('check') + ' ' + esc(t('markAll')) + '</button></div></div>' +
        '<div class="card"><div class="tablewrap"><table class="roster"><thead><tr><th>' + esc(t('name')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' + d.roster.map(function (x) {
          return '<tr><td><strong>' + esc(x.name) + '</strong><div class="small muted">' + esc(x.student_id) + (x.marked_by && x.marked_by.indexOf('QR') >= 0 ? ' · QR' : '') + (x.marked_by && x.marked_by.indexOf('claim') >= 0 ? ' · MC' : '') + '</div></td><td><div class="seg" role="group" aria-label="' + esc(x.name) + '">' +
            ['P', 'L', 'A', 'E'].map(function (k) { return '<button type="button" data-act="setatt" data-s="' + x.student_id + '" data-v="' + k + '" class="' + (x.status === k ? 'on-' + k : '') + '" aria-pressed="' + (x.status === k) + '" title="' + esc(t('att' + k)) + '">' + esc(t('att' + k + 's')) + '</button>'; }).join('') + '</div></td></tr>';
        }).join('') + '</tbody></table></div><div class="actions"><button class="btn btn-primary" data-act="saveatt">' + esc(t('saveAttendance')) + '</button></div></div>';
    });
  };

  L_PAGES.claims = function () {
    return api('listClaims').then(function (list) {
      return '<div class="pagehead"><h1>' + esc(t('nClaimsL')) + '</h1></div><div class="card">' + (list.length ? '<div class="tablewrap"><table><thead><tr><th>' + esc(t('name')) + '</th><th>' + esc(t('reason')) + '</th><th>' + esc(t('date')) + '</th><th>' + esc(t('document')) + '</th><th>' + esc(t('status')) + '</th><th></th></tr></thead><tbody>' +
        list.map(function (c) {
          return '<tr><td><strong>' + esc(c.student_name) + '</strong><div class="small muted">' + esc(c.student_id) + ' · ' + esc(c.course_code) + ' ' + esc(c.class_name) + '</div></td>' +
            '<td>' + esc(t(REASON[c.reason_type] || c.reason_type)) + (c.note ? '<div class="small muted">' + esc(c.note) + '</div>' : '') + '</td>' +
            '<td>' + c.sessions.map(function (s) { return fdate(s.date); }).join('<br>') + '<div class="small muted">' + esc(t('submittedAt')) + ' ' + fdt(c.submitted_at) + '</div></td>' +
            '<td>' + (c.file_url ? '<a href="' + esc(c.file_url) + '" target="_blank" rel="noopener">' + ic('clip') + ' ' + esc(c.file_name || t('open')) + '</a>' : (c.file_name ? '<span class="small muted">' + ic('clip') + ' ' + esc(c.file_name) + '</span>' : '—')) + '</td>' +
            '<td>' + claimBadge(c.status) + (c.comment ? '<div class="small muted">' + esc(c.comment) + '</div>' : '') + '</td>' +
            '<td class="right">' + (c.status === 'Pending' ? '<button class="btn btn-primary btn-sm" data-act="decide" data-v="' + c.claim_id + '" data-name="' + esc(c.student_name) + '">' + esc(t('view')) + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">' + esc(t('noClaims')) + '</div>') + '</div>';
    });
  };

  L_PAGES.tasks = function (r) {
    return api('myClasses').then(function (classes) {
      var cid = r.q.c || (classes[0] && classes[0].class_id);
      return api('classTasks', { class_id: cid }).then(function (list) {
        return '<div class="pagehead"><h1>' + esc(t('nMarking')) + '</h1><div class="row" style="flex:0 1 auto;align-items:center">' + classPicker(classes, cid, '#/tasks?c=') +
          '<button class="btn btn-primary" data-act="newtask" data-c="' + cid + '">' + ic('plus') + ' ' + esc(t('newTask')) + '</button></div></div><div class="card">' +
          (list.length ? '<div class="tablewrap"><table><thead><tr><th>' + esc(t('taskTitle')) + '</th><th>' + esc(t('due')) + '</th><th>' + esc(t('submissions')) + '</th><th>' + esc(t('graded')) + '</th><th></th></tr></thead><tbody>' +
            list.map(function (x) {
              var past = x.due_at < nowIso();
              return '<tr class="clickable" data-act="nav" data-v="#/task/' + x.task_id + '"><td><strong>' + esc(x.title) + '</strong><div class="small muted">' + esc(typeLabel(x.type)) + ' · /' + x.max_marks + '</div></td><td class="nowrap">' + fdt(x.due_at) + (past ? '<div class="small muted">' + esc(t('overdue')) + '</div>' : '') + '</td>' +
                '<td>' + x.submitted + '/' + x.students + meter(x.students ? x.submitted / x.students * 100 : 0, past ? 80 : 0) + '</td><td>' + x.graded + '/' + x.submitted + '</td><td class="right"><span class="btn btn-ghost btn-sm">' + esc(t('open')) + '</span></td></tr>';
            }).join('') + '</tbody></table></div>' : '<div class="empty">' + esc(t('noTasks')) + '</div>') + '</div>';
      });
    });
  };

  L_PAGES.task = function (r) {
    return api('taskSubmissions', { task_id: r.args[0] }).then(function (d) {
      var tk = d.task;
      return '<div class="pagehead"><div><a class="small" href="#/tasks?c=' + d.cls.class_id + '">← ' + esc(t('nMarking')) + '</a><h1>' + esc(tk.title) + '</h1><div class="muted">' + esc(d.cls.course_code) + ' · ' + esc(d.cls.class_name) + ' · ' + esc(t('due')) + ' ' + fdt(tk.due_at) + ' · /' + esc(tk.max_marks) + '</div>' + (tk.description ? '<div class="small">' + esc(tk.description) + '</div>' : '') + '</div></div>' +
        '<div class="card"><div class="tablewrap"><table><thead><tr><th>' + esc(t('name')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('openWork')) + '</th><th>' + esc(t('marks')) + '</th><th></th></tr></thead><tbody>' + d.rows.map(function (x) {
          var work = (x.link ? '<a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + ic('link') + ' Link</a> ' : '') + (x.file_url ? '<a href="' + esc(x.file_url) + '" target="_blank" rel="noopener">' + ic('clip') + ' ' + esc(x.file_name || 'File') + '</a>' : '') || '—';
          return '<tr><td><strong>' + esc(x.name) + '</strong><div class="small muted">' + esc(x.student_id) + '</div></td><td>' + taskBadge(x.status) + (x.submitted_at ? '<div class="small muted">' + fdt(x.submitted_at) + '</div>' : '') + '</td><td>' + work + '</td>' +
            '<td>' + (x.marks !== '' ? '<strong>' + esc(x.marks) + '</strong>/' + esc(tk.max_marks) + (x.feedback ? '<div class="small muted">' + esc(x.feedback) + '</div>' : '') : '—') + '</td>' +
            '<td class="right"><button class="btn btn-' + (x.marks === '' && x.submitted_at ? 'primary' : 'ghost') + ' btn-sm" data-act="grade" data-t="' + tk.task_id + '" data-s="' + x.student_id + '" data-name="' + esc(x.name) + '" data-m="' + esc(x.marks) + '" data-f="' + esc(x.feedback) + '" data-max="' + esc(tk.max_marks) + '">' + esc(t('give')) + '</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
    });
  };

  L_PAGES.consult = function () {
    return api('mySlots').then(function (d) {
      return '<div class="pagehead"><h1>' + esc(t('nConsult')) + '</h1><button class="btn btn-primary" data-act="addslots">' + ic('plus') + ' ' + esc(t('addSlots')) + '</button></div>' +
        '<div class="grid g2 anim"><div class="card"><h2>' + esc(t('requests')) + '</h2>' + (d.bookings.length ? '<ul class="list">' + d.bookings.map(function (b) {
          var btns = b.status === 'Pending' ? '<button class="btn btn-green btn-sm" data-act="booking" data-v="' + b.booking_id + '" data-d="Confirmed">' + esc(t('confirm')) + '</button> <button class="btn btn-red btn-sm" data-act="booking" data-v="' + b.booking_id + '" data-d="Rejected">' + esc(t('reject')) + '</button>'
            : b.status === 'Confirmed' ? '<button class="btn btn-primary btn-sm" data-act="booking" data-v="' + b.booking_id + '" data-d="Completed">' + esc(t('complete')) + '</button> <button class="btn btn-ghost btn-sm" data-act="booking" data-v="' + b.booking_id + '" data-d="Cancelled">' + esc(t('cancel')) + '</button>' : '';
          return '<li style="align-items:flex-start"><div><strong>' + esc(b.student_name) + '</strong> · ' + fdate(b.date) + ' ' + esc(b.start) + '<div class="small muted">' + esc(b.purpose) + '</div>' + (b.notes ? '<div class="small">' + ic('tasks') + ' ' + esc(b.notes) + '</div>' : '') + '</div><div class="right">' + bookBadge(b.status) + '<div style="margin-top:6px" class="nowrap">' + btns + '</div></div></li>';
        }).join('') + '</ul>' : '<div class="empty">' + esc(t('noBookings')) + '</div>') + '</div>' +
        '<div class="card"><h2>' + esc(t('mySlots')) + '</h2>' + (d.slots.length ? '<ul class="list">' + d.slots.map(function (s) {
          return '<li><div>' + fdate(s.date, true) + ' · ' + esc(s.start) + '–' + esc(s.end) + '<div class="small muted">' + esc(s.mode === 'Online' ? t('online') : t('inPerson')) + ' · ' + esc(s.location) + '</div></div><div>' +
            (s.status === 'Open' ? '<span class="badge b-green">' + esc(t('openS')) + '</span> <button class="btn btn-ghost btn-sm" data-act="closeslot" data-v="' + s.slot_id + '">' + esc(t('removeSlot')) + '</button>' : s.status === 'Booked' ? '<span class="badge b-blue">' + esc(t('booked')) + '</span>' : '<span class="badge">—</span>') + '</div></li>';
        }).join('') + '</ul>' : '<div class="empty">' + esc(t('noSlots')) + '</div>') + '</div></div>';
    });
  };

  L_PAGES.reports = function (r) {
    return api('myClasses').then(function (classes) {
      var cid = r.q.c || (classes[0] && classes[0].class_id);
      var rep = [['attendance', ic('calendar') + '', 'repAttendance'], ['submissions', ic('tasks') + '', 'repSubmissions'], ['pdp', ic('report') + '', 'repPdp']];
      return '<div class="pagehead"><h1>' + esc(t('nReports')) + '</h1>' + classPicker(classes, cid, '#/reports?c=') + '</div><p class="muted">' + esc(t('reportIntro')) + '</p><div class="grid g3 anim">' + rep.map(function (x) {
        var tc = ['t-brand', 't-lime', 't-night'][rep.indexOf(x)]; return '<div class="tile ' + tc + '"><span class="go">' + x[1] + '</span><h3 style="font-size:1.2rem;max-width:16ch;margin-top:30px">' + esc(t(x[2])) + '</h3><button class="btn ' + (tc === 't-lime' ? 'btn-dark' : 'btn-primary') + '" data-act="export" data-k="' + x[0] + '" data-c="' + cid + '">' + ic('download') + ' ' + esc(t('download')) + ' CSV</button></div>';
      }).join('') + '</div>';
    });
  };

  // ================= ACTIONS (clicks) =================
  var qrTimer = null;
  var ACTIONS = {
    lang: function (el) { lang = el.dataset.v; sset('mypdp_lang', lang); render(); },
    nav: function (el) { go(el.dataset.v); },
    scrollto: function (el) { var x = document.getElementById(el.dataset.v); if (x) { x.scrollIntoView({ behavior: 'smooth', block: 'start' }); var f = x.querySelector('input'); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 500); } },
    usermenu: function () { var m = document.getElementById('umenu'); if (m) m.classList.toggle('hidden'); },
    logout: function () { logout(); },
    demoreset: function () { demoDb.reset(); toast(t('saved')); render(); },
    demologin: function (el) { doLogin(el.dataset.v, '1234'); },
    changepin: function () {
      modal('<h2>' + esc(t('changePin')) + '</h2><form data-form="changepin"><label for="op">' + esc(t('oldPin')) + '</label><input id="op" name="old_pin" type="password" inputmode="numeric" required>' +
        '<label for="np">' + esc(t('newPin')) + '</label><input id="np" name="new_pin" type="password" inputmode="numeric" pattern="\\d{4,8}" required>' + formBtns() + '</form>');
    },
    markread: function () { api('markRead').then(render); },
    claimclass: null,
    submitwork: function (el) {
      modal('<h2>' + esc(t('submitWork')) + '</h2><p class="muted">' + esc(el.dataset.title) + '</p><form data-form="submitwork"><input type="hidden" name="task_id" value="' + esc(el.dataset.v) + '">' +
        '<label for="sw-link">' + esc(t('link')) + '</label><input id="sw-link" name="link" type="url" placeholder="https://">' +
        '<label for="sw-file">' + esc(t('orFile')) + '</label><input id="sw-file" name="file" type="file"><div class="small muted">' + esc(t('uploadHint', { mb: S.settings.maxMb || 5 }).split('·').pop()) + (LIVE ? '' : ' · ' + esc(t('noFileDemo'))) + '</div>' + formBtns(t('submit')) + '</form>');
    },
    book: function (el) {
      modal('<h2>' + esc(t('bookSlot')) + '</h2><p class="muted">' + esc(el.dataset.label) + '</p><form data-form="book"><input type="hidden" name="slot_id" value="' + esc(el.dataset.v) + '">' +
        '<label for="bk-p">' + esc(t('purpose')) + '</label><textarea id="bk-p" name="purpose" maxlength="300" required></textarea>' + formBtns(t('bookSlot')) + '</form>');
    },
    cancelbooking: function (el) { api('cancelBooking', { booking_id: el.dataset.v }).then(function () { toast(t('saved')); render(); }, errToast); },
    intervene: function (el) {
      var opts = ['intWhatsApp', 'intCall', 'intMeeting', 'intReferral', 'intRemedial'];
      modal('<h2>' + esc(t('addIntervention')) + '</h2><form data-form="intervene"><input type="hidden" name="class_id" value="' + el.dataset.c + '"><input type="hidden" name="student_id" value="' + el.dataset.s + '">' +
        '<label for="iv-a">' + esc(t('interventionAction')) + '</label><select id="iv-a" name="action">' + opts.map(function (o) { return '<option>' + esc(t(o)) + '</option>'; }).join('') + '</select>' +
        '<label for="iv-d">' + esc(t('date')) + '</label><input id="iv-d" name="date" type="date" value="' + nowIso().slice(0, 10) + '">' +
        '<label for="iv-n">' + esc(t('note')) + '</label><textarea id="iv-n" name="notes" maxlength="500"></textarea>' + formBtns() + '</form>');
    },
    newsession: function (el) {
      modal('<h2>' + esc(t('newSession')) + '</h2><form data-form="newsession"><input type="hidden" name="class_id" value="' + el.dataset.c + '">' +
        '<label for="ns-d">' + esc(t('date')) + '</label><input id="ns-d" name="date" type="date" value="' + nowIso().slice(0, 10) + '" required>' +
        '<div class="row"><div><label for="ns-s">' + esc(t('startTime')) + '</label><input id="ns-s" name="start" type="time" value="08:00" required></div><div><label for="ns-e">' + esc(t('endTime')) + '</label><input id="ns-e" name="end" type="time" value="10:00" required></div></div>' +
        '<label for="ns-t">' + esc(t('topic')) + '</label><input id="ns-t" name="topic" type="text" maxlength="150">' + formBtns() + '</form>');
    },
    showqr: function (el) {
      api('openQR', { session_id: el.dataset.v }).then(function (d) {
        var url = location.href.split('#')[0] + '#/checkin/' + d.code;
        modal('<div class="qrbox"><h2>' + esc(t('checkinTitle')) + '</h2><div id="qr"></div><div class="code">' + esc(d.code) + '</div><div class="muted small">' + esc(t('qrValid', { m: d.minutes })) + ' · <span id="qr-left"></span></div>' +
          '<div class="small muted" style="word-break:break-all">' + esc(url) + '</div><div class="actions"><button class="btn btn-ghost" data-act="closeqr">' + esc(t('close')) + '</button></div></div>');
        try { new QRCode(document.getElementById('qr'), { text: url, width: 240, height: 240 }); } catch (e) { /* QR library not loaded: the code is still shown */ }
        var left = document.getElementById('qr-left');
        qrTimer = setInterval(function () {
          var s = Math.max(0, Math.round((d.expires - Date.now()) / 1000));
          if (left) left.textContent = Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2);
          if (!s) { clearInterval(qrTimer); qrTimer = null; }
        }, 1000);
      }, errToast);
    },
    closemodal: function () { closeModal(); },
    closeqr: function () { closeModal(); if (route().name === 'attendance') render(); },
    setatt: function (el) {
      var s = el.dataset.s, v = el.dataset.v;
      rosterState.marks[s] = v;
      el.parentNode.querySelectorAll('button').forEach(function (b) { var on = b.dataset.v === v; b.className = on ? 'on-' + v : ''; b.setAttribute('aria-pressed', on); });
    },
    markall: function () {
      document.querySelectorAll('.seg').forEach(function (g) {
        var cur = g.querySelector('[aria-pressed="true"]');
        if (!cur) { var p = g.querySelector('[data-v="P"]'); ACTIONS.setatt(p); }
      });
    },
    saveatt: function (el) {
      el.disabled = true;
      var marks = Object.keys(rosterState.marks).filter(function (k) { return rosterState.marks[k]; }).map(function (k) { return { student_id: k, status: rosterState.marks[k] }; });
      api('markAttendance', { session_id: rosterState.session_id, marks: marks }).then(function (d) { toast(t('changed', { n: d.changed })); render(); }, function (e) { el.disabled = false; errToast(e); });
    },
    decide: function (el) {
      api('listClaims').then(function (list) {
        var c = list.filter(function (x) { return x.claim_id === el.dataset.v; })[0];
        modal('<h2>' + esc(c.student_name) + '</h2><p class="muted">' + esc(c.course_code) + ' ' + esc(c.class_name) + ' · ' + esc(t(REASON[c.reason_type])) + '</p>' +
          '<ul class="list">' + c.sessions.map(function (s) { return '<li>' + fdate(s.date, true) + '<span class="muted">' + esc(s.topic) + '</span></li>'; }).join('') + '</ul>' +
          (c.note ? '<p>' + esc(c.note) + '</p>' : '') + '<p>' + (c.file_url ? '<a class="btn btn-ghost" href="' + esc(c.file_url) + '" target="_blank" rel="noopener">' + ic('clip') + ' ' + esc(c.file_name || t('document')) + '</a>' : '<span class="muted">' + ic('clip') + ' ' + esc(c.file_name || '—') + (LIVE ? '' : ' (' + esc(t('noFileDemo')) + ')') + '</span>') + '</p>' +
          '<form data-form="decide"><input type="hidden" name="claim_id" value="' + c.claim_id + '"><label for="dc-c">' + esc(t('rejectReason')) + '</label><textarea id="dc-c" name="comment" maxlength="300"></textarea>' +
          '<div class="actions"><button class="btn btn-green" type="submit" name="decision" value="Approved">' + ic('check') + ' ' + esc(t('approve')) + '</button><button class="btn btn-red" type="submit" name="decision" value="Rejected">' + ic('x') + ' ' + esc(t('reject')) + '</button><button class="btn btn-ghost" type="button" data-act="closemodal">' + esc(t('cancel')) + '</button></div></form>');
      }, errToast);
    },
    newtask: function (el) {
      var types = ['Assignment', 'Quiz', 'Tutorial', 'Project', 'Practical'];
      var d = new Date(Date.now() + 7 * 864e5); d.setHours(23, 59, 0, 0);
      modal('<h2>' + esc(t('newTask')) + '</h2><form data-form="newtask"><input type="hidden" name="class_id" value="' + el.dataset.c + '">' +
        '<label for="nt-t">' + esc(t('taskTitle')) + '</label><input id="nt-t" name="title" type="text" maxlength="150" required>' +
        '<div class="row"><div><label for="nt-y">' + esc(t('taskType')) + '</label><select id="nt-y" name="type">' + types.map(function (x) { return '<option value="' + x + '">' + esc(typeLabel(x)) + '</option>'; }).join('') + '</select></div>' +
        '<div><label for="nt-m">' + esc(t('maxMarks')) + '</label><input id="nt-m" name="max_marks" type="number" min="1" max="1000" value="10" required></div></div>' +
        '<label for="nt-d">' + esc(t('due')) + '</label><input id="nt-d" name="due_at" type="datetime-local" value="' + MyPdPCore.iso(d) + '" required>' +
        '<label for="nt-i">' + esc(t('description')) + '</label><textarea id="nt-i" name="description" maxlength="1000"></textarea>' + formBtns() + '</form>');
    },
    grade: function (el) {
      modal('<h2>' + esc(t('give')) + '</h2><p class="muted">' + esc(el.dataset.name) + '</p><form data-form="grade"><input type="hidden" name="task_id" value="' + el.dataset.t + '"><input type="hidden" name="student_id" value="' + el.dataset.s + '">' +
        '<label for="gr-m">' + esc(t('marks')) + ' (0–' + esc(el.dataset.max) + ')</label><input id="gr-m" name="marks" type="number" min="0" max="' + esc(el.dataset.max) + '" step="0.5" value="' + esc(el.dataset.m) + '" required>' +
        '<label for="gr-f">' + esc(t('feedback')) + '</label><textarea id="gr-f" name="feedback" maxlength="500">' + esc(el.dataset.f) + '</textarea>' + formBtns() + '</form>');
    },
    addslots: function () {
      modal('<h2>' + esc(t('addSlots')) + '</h2><form data-form="addslots"><label for="as-d">' + esc(t('date')) + '</label><input id="as-d" name="date" type="date" value="' + nowIso().slice(0, 10) + '" required>' +
        '<div class="row"><div><label for="as-s">' + esc(t('from')) + '</label><input id="as-s" name="start" type="time" value="10:00" required></div><div><label for="as-e">' + esc(t('to')) + '</label><input id="as-e" name="end" type="time" value="12:00" required></div></div>' +
        '<label for="as-m">' + esc(t('slotLength')) + '</label><select id="as-m" name="minutes"><option>15</option><option selected>30</option><option>45</option><option>60</option></select>' +
        '<label for="as-t">' + esc(t('mode')) + '</label><select id="as-t" name="mode"><option value="In person">' + esc(t('inPerson')) + '</option><option value="Online">' + esc(t('online')) + '</option></select>' +
        '<label for="as-l">' + esc(t('location')) + '</label><input id="as-l" name="location" type="text" maxlength="150">' + formBtns() + '</form>');
    },
    closeslot: function (el) { api('closeSlot', { slot_id: el.dataset.v }).then(function () { toast(t('saved')); render(); }, errToast); },
    booking: function (el) {
      var dec = el.dataset.d;
      if (dec === 'Confirmed') { api('decideBooking', { booking_id: el.dataset.v, decision: dec }).then(function () { toast(t('saved')); render(); }, errToast); return; }
      var labels = { Rejected: t('reject'), Completed: t('complete'), Cancelled: t('cancel') };
      modal('<h2>' + esc(labels[dec]) + '</h2><form data-form="booking"><input type="hidden" name="booking_id" value="' + el.dataset.v + '"><input type="hidden" name="decision" value="' + dec + '">' +
        '<label for="bn">' + esc(dec === 'Completed' ? t('sessionNotes') : t('note')) + '</label><textarea id="bn" name="notes" maxlength="500"></textarea>' + formBtns() + '</form>');
    },
    pickclass: null,
    'export': function (el) {
      api('exportData', { kind: el.dataset.k, class_id: el.dataset.c }).then(function (d) {
        var csv = [d.header].concat(d.rows).map(function (r) { return r.map(function (v) { v = String(v === null || v === undefined ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
        var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = d.filename; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      }, errToast);
    }
  };
  function formBtns(label) { return '<div class="actions"><button class="btn btn-primary" type="submit">' + esc(label || t('save')) + '</button><button class="btn btn-ghost" type="button" data-act="closemodal">' + esc(t('cancel')) + '</button></div>'; }
  function errToast(e) { toast(msg(e) || String(e), true); }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'SELECT') {
      if (!e.target.closest('.usermenu')) { var m = document.getElementById('umenu'); if (m) m.classList.add('hidden'); }
      return;
    }
    var fn = ACTIONS[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset.act === 'pickclass') go(el.dataset.base + el.value);
    if (el.dataset.act === 'claimclass') go('#/claims?c=' + el.value);
  });

  // ================= FORMS =================
  function formData(f) { var o = {}; new FormData(f).forEach(function (v, k) { if (!(v instanceof File)) o[k] = v; }); return o; }
  function readFile(input) {
    return new Promise(function (res, rej) {
      var file = input && input.files && input.files[0];
      if (!file) return res(null);
      if (file.size > (S.settings.maxMb || 5) * 1024 * 1024) return rej({ en: 'File is larger than ' + (S.settings.maxMb || 5) + ' MB.', ms: 'Fail melebihi ' + (S.settings.maxMb || 5) + ' MB.' });
      var r = new FileReader();
      r.onload = function () { res({ name: file.name, type: file.type, data: String(r.result).split(',')[1] }); };
      r.onerror = function () { rej({ en: 'Could not read the file.', ms: 'Fail tidak dapat dibaca.' }); };
      r.readAsDataURL(file);
    });
  }
  function busy(f, on) { f.querySelectorAll('button[type=submit]').forEach(function (b) { b.disabled = on; }); }
  function done(text) { return function () { closeModal(); toast(text || t('saved')); render(); }; }

  var FORMS = {
    login: function (f) { var d = formData(f); busy(f, true); doLogin(d.user_id.trim(), d.pin).then(function () { busy(f, false); }); },
    changepin: function (f) { api('changePin', formData(f)).then(done(t('pinChanged')), errToast); },
    claim: function (f) {
      var d = formData(f);
      d.session_ids = Array.prototype.map.call(f.querySelectorAll('input[name=session]:checked'), function (x) { return x.value; });
      if (!d.session_ids.length) return toast(t('pickSession'), true);
      busy(f, true);
      readFile(f.querySelector('input[type=file]')).then(function (file) {
        if (file) d.file = file; else if (!LIVE && d.reason_type === 'MC') d.file = { name: 'demo_mc.pdf', type: 'application/pdf', data: 'JVBERi0=' };
        return api('submitClaim', d);
      }).then(function () { toast(t('sent')); go('#/claims'); }, function (e) { busy(f, false); errToast(e); });
    },
    submitwork: function (f) {
      var d = formData(f); busy(f, true);
      readFile(f.querySelector('input[type=file]')).then(function (file) { if (file) d.file = file; return api('submitTask', d); })
        .then(done(t('sent')), function (e) { busy(f, false); errToast(e); });
    },
    book: function (f) { busy(f, true); api('bookSlot', formData(f)).then(done(t('sent')), function (e) { busy(f, false); errToast(e); render(); }); },
    checkin: function (f) {
      var box = document.getElementById('ci-result');
      busy(f, true);
      api('checkIn', formData(f)).then(function (d) {
        box.innerHTML = '<div class="alert alert-blue" style="margin-top:14px;background:var(--green-bg);color:var(--green)"><strong>' + ic('check') + ' ' + esc(d.already ? t('checkinAlready') : t('checkinOk')) + '</strong>' + (d.session && d.session.topic ? '<div class="small">' + fdate(d.session.date) + ' · ' + esc(d.session.topic) + '</div>' : '') + '</div>';
        busy(f, false);
      }, function (e) { busy(f, false); box.innerHTML = '<div class="alert alert-red" style="margin-top:14px">' + esc(msg(e)) + '</div>'; });
    },
    intervene: function (f) { api('addIntervention', formData(f)).then(done(), errToast); },
    newsession: function (f) { api('createSession', formData(f)).then(function (d) { closeModal(); toast(t('saved')); go('#/session/' + d.session_id); }, errToast); },
    decide: function (f, submitter) {
      var d = formData(f); d.decision = submitter ? submitter.value : 'Approved';
      busy(f, true);
      api('decideClaim', d).then(done(t('decided')), function (e) { busy(f, false); errToast(e); });
    },
    newtask: function (f) { busy(f, true); api('createTask', formData(f)).then(done(), function (e) { busy(f, false); errToast(e); }); },
    grade: function (f) { api('grade', formData(f)).then(done(t('gradeSaved')), errToast); },
    addslots: function (f) { api('addSlots', formData(f)).then(function (d) { closeModal(); toast(t('slotsCreated', { n: d.created })); render(); }, errToast); },
    booking: function (f) { api('decideBooking', formData(f)).then(done(), errToast); }
  };
  document.addEventListener('submit', function (e) {
    var f = e.target, fn = FORMS[f.dataset.form];
    if (fn) { e.preventDefault(); fn(f, e.submitter); }
  });

  render();
})();
