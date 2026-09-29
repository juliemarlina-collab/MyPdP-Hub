/**
 * MyPdP Insight — Demo database (runs fully in the browser, no Google account needed).
 * Uses the same MyPdPCore logic as the real Apps Script backend, but keeps the
 * data in memory (and in this browser's localStorage so a demo survives a refresh).
 */
var MyPdPDemoDB = (function () {
  'use strict';
  var KEY = 'mypdp_demo_v2';

  // Compact synchronous SHA-256 (hex) — same result as Apps Script's computeDigest.
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var mp = Math.pow, maxWord = mp(2, 32), result = '', words = [], i, j;
    var s = unescape(encodeURIComponent(ascii)), bitLen = s.length * 8;
    var hash = [], k = [], primeCounter = 0, isComposite = {};
    for (var c = 2; primeCounter < 64; c++) {
      if (!isComposite[c]) {
        for (i = 0; i < 313; i += c) isComposite[i] = c;
        hash[primeCounter] = (mp(c, .5) * maxWord) | 0;
        k[primeCounter++] = (mp(c, 1 / 3) * maxWord) | 0;
      }
    }
    hash = hash.slice(0, 8);
    s += '\x80';
    while (s.length % 64 - 56) s += '\x00';
    for (i = 0; i < s.length; i++) { j = s.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
    words[words.length] = ((bitLen / maxWord) | 0);
    words[words.length] = (bitLen);
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var temp1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += ((b < 16) ? 0 : '') + b.toString(16); }
    return result;
  }

  function create(seed, opts) {
    opts = opts || {};
    var data = null;
    if (!opts.fresh) { try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { data = null; } }
    if (!data) data = JSON.parse(JSON.stringify(seed.rows));
    Object.keys(seed.schema).forEach(function (t) { if (!data[t]) data[t] = []; });
    function save() { if (opts.persist === false) return; try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage blocked: keep in memory */ } }
    var fixedNow = opts.now || null, kv = {};
    return {
      all: function (t) { return (data[t] || []).map(function (r) { return Object.assign({}, r); }); },
      insert: function (t, obj) {
        var row = {};
        seed.schema[t].forEach(function (k) { row[k] = obj[k] === undefined || obj[k] === null ? '' : String(obj[k]); });
        data[t].push(row); save();
      },
      update: function (t, match, patch) {
        var n = 0;
        data[t].forEach(function (r) { if (match(Object.assign({}, r))) { Object.keys(patch).forEach(function (k) { r[k] = patch[k] === undefined || patch[k] === null ? '' : String(patch[k]); }); n++; } });
        if (n) save();
        return n;
      },
      saveFile: function (name) { return { url: '', id: 'demo-' + name }; }, // demo: file is not really stored
      now: function () { return fixedNow ? new Date(fixedNow) : new Date(); },
      kvGet: function (k) { var x = kv[k]; return x && x.exp > Date.now() ? x.v : null; },
      kvSet: function (k, v, ttl) { kv[k] = { v: v, exp: Date.now() + (ttl || 900) * 1000 }; },
      hash: sha256,
      randomCode: function (len) { var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < len; i++) s += c[Math.floor(Math.random() * c.length)]; return s; },
      reset: function () { data = JSON.parse(JSON.stringify(seed.rows)); save(); }
    };
  }
  return { create: create, sha256: sha256, KEY: KEY };
})();
if (typeof module !== 'undefined') module.exports = MyPdPDemoDB;
