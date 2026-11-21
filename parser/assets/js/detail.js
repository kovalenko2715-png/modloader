function (P) {
  P = P || {};
  var R = { ok: true, url: location.href, title: '', poster: '', desc: '', info: [], episodes: [], kind: 'single', ready: document.readyState };
  try {
    function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
    function abs(u) { if (!u) return null; try { return new URL(u, document.baseURI).href; } catch (e) { return null; } }
    function vis(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
    function inBad(el) {
      var d = 0;
      while (el && el !== document.body && d < 8) {
        if (el.tagName === 'NAV' || el.tagName === 'FOOTER' || el.tagName === 'HEADER') return true;
        el = el.parentElement; d++;
      }
      return false;
    }

    /* ---------- серии ---------- */
    var END = '(?=$|[^a-zа-яёі0-9])';
    var RA = new RegExp('^\\s*(\\d{1,4})\\s*(?:-?(?:я|й|ая))?\\s*(?:серия|серии|эпизод|эп\\.?|episode|ep\\.?)' + END, 'i');
    var RB = new RegExp('^\\s*(?:серия|эпизод|эп\\.?|episode|ep\\.?)\\s*[№#]?\\s*(\\d{1,4})(?=$|[^0-9])', 'i');
    var RC = /^\s*(\d{1,4})\s*$/;
    var RS = new RegExp('^\\s*(ova|ona|oad|special|спешл|спэшл|фильм|movie)\\s*\\d{0,2}' + END, 'i');
    var HINT = /(epis|seri|сер|playlist|ep-|ep_|eplist|season|player|tabs|izod|izod)/i;

    function hint(el) {
      var d = 0;
      while (el && d < 4) {
        var s = (typeof el.className === 'string' ? el.className : '') + ' ' + (el.id || '');
        if (HINT.test(s)) return true;
        el = el.parentElement; d++;
      }
      return false;
    }

    function findGroup() {
      var all = document.querySelectorAll('a,button,li,div,span,option,label,p,b,td');
      var cands = [], specials = [];
      var cap = Math.min(all.length, 7000);
      for (var i = 0; i < cap; i++) {
        var el = all[i];
        if (el.children.length > 2) continue;
        var t = clean(el.textContent);
        if (!t || t.length > 42) continue;
        var m = RA.test(t) || RB.test(t) || (RC.test(t) && hint(el));
        if (m) { if (el.tagName !== 'OPTION' && inBad(el)) continue; cands.push(el); }
        else if (RS.test(t) && hint(el)) specials.push(el);
      }
      if (cands.length < 2) return [];
      var votes = [], depthOf = function (n) { var d = 0; while (n.parentElement) { n = n.parentElement; d++; } return d; };
      cands.forEach(function (el) {
        var p = el.parentElement, up = 0;
        while (p && up < 4) {
          var f = null;
          for (var k = 0; k < votes.length; k++) if (votes[k].el === p) { f = votes[k]; break; }
          if (!f) { f = { el: p, n: 0 }; votes.push(f); }
          f.n++;
          p = p.parentElement; up++;
        }
      });
      var best = null, bd = -1;
      votes.forEach(function (v) {
        var d = depthOf(v.el);
        if (!best || v.n > best.n || (v.n === best.n && d > bd)) { best = v; bd = d; }
      });
      if (!best || best.n < 2) return [];
      var seen = {}, out = [];
      var pool = cands.concat(specials);
      pool.sort(function (a, b) { return (a.compareDocumentPosition(b) & 4) ? -1 : 1; });
      pool.forEach(function (el) {
        if (!best.el.contains(el)) return;
        var key = clean(el.textContent).toLowerCase();
        if (seen[key]) return;
        seen[key] = 1; out.push(el);
      });
      return out.slice(0, 1500);
    }

    function epData(el, idx) {
      var name = clean(el.textContent);
      var url = null;
      var a = el.tagName === 'A' ? el : ((el.closest && el.closest('a[href]')) || el.querySelector('a[href]'));
      if (a) { var h = a.getAttribute('href'); if (h && !/^(#|javascript:)/i.test(h)) url = abs(h); }
      if (!url) {
        var names = ['data-file', 'data-url', 'data-src', 'data-href', 'data-link', 'data-video', 'data-player', 'data-iframe'];
        for (var k = 0; k < names.length; k++) {
          var v = el.getAttribute(names[k]);
          if (v && (/^(https?:)?\/\//i.test(v) || v.charAt(0) === '/')) { url = abs(v); break; }
        }
      }
      if (!url && el.tagName === 'OPTION' && el.value && (/^(https?:)?\/\//i.test(el.value) || el.value.charAt(0) === '/')) url = abs(el.value);
      return { name: name, url: url, idx: idx, kind: el.tagName === 'OPTION' ? 'option' : 'click', media: !!(url && /\.(mp4|m3u8|webm|m4v|mkv)(\?|#|$)/i.test(url)) };
    }

    var group = findGroup();

    /* режим «нажать на серию» */
    if (P.mode === 'click') {
      var target = group[P.idx];
      if (!target) return { ok: false, err: 'noep', n: group.length };
      try { performance.clearResourceTimings(); } catch (e) { }
      if (target.tagName === 'OPTION') {
        var sel = target.parentElement;
        sel.value = target.value;
        sel.selectedIndex = target.index;
        sel.dispatchEvent(new Event('input', { bubbles: true }));
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        try { target.scrollIntoView({ block: 'center' }); } catch (e) { }
        ['mousedown', 'mouseup', 'click'].forEach(function (nm) {
          target.dispatchEvent(new MouseEvent(nm, { bubbles: true, cancelable: true, view: window }));
        });
      }
      return { ok: true };
    }

    var eps = group.map(function (el, i) { return epData(el, i); });
    var distinct = {}, nd = 0;
    eps.forEach(function (e) { if (e.url && !distinct[e.url]) { distinct[e.url] = 1; nd++; } });
    var useLinks = nd >= 2 && nd >= eps.length * 0.6;
    eps.forEach(function (e) {
      if (useLinks && e.url) e.kind = 'link';
      else { e.kind = e.kind === 'option' ? 'option' : 'click'; if (!useLinks) { e.url = null; e.media = false; } }
    });
    R.episodes = eps;
    R.kind = eps.length >= 2 ? 'series' : 'single';

    /* ---------- название, постер, описание ---------- */
    var h1 = document.querySelector('h1');
    var title = h1 ? clean(h1.textContent) : '';
    if (!title) { var og = document.querySelector('meta[property="og:title"]'); title = og ? clean(og.getAttribute('content')) : ''; }
    if (!title) title = clean((document.title || '').split(/\s[|–—\-»]\s/)[0]);
    R.title = title.length > 160 ? title.slice(0, 159) + '…' : title;

    var poster = '';
    var pimgs = document.querySelectorAll('[class*=poster] img, [class*=cover] img, [class*=image] img, img[itemprop=image], .fposter img, .shortstoryContent img');
    var bestA = 0;
    for (var i = 0; i < pimgs.length; i++) {
      var r = pimgs[i].getBoundingClientRect();
      if (r.width < 70 || r.height < 70 || inBad(pimgs[i])) continue;
      var src = pimgs[i].getAttribute('data-src') || pimgs[i].getAttribute('data-original') || pimgs[i].currentSrc || pimgs[i].getAttribute('src');
      if (!src || /^data:|\.svg|logo|icon|avatar/i.test(src)) continue;
      if (r.width * r.height > bestA) { bestA = r.width * r.height; poster = src; }
    }
    if (!poster) { var ogi = document.querySelector('meta[property="og:image"]'); if (ogi) poster = ogi.getAttribute('content') || ''; }
    if (!poster) {
      var imgs = document.querySelectorAll('img'); bestA = 0;
      for (var j = 0; j < imgs.length && j < 80; j++) {
        var rr = imgs[j].getBoundingClientRect();
        var s2 = imgs[j].getAttribute('data-src') || imgs[j].currentSrc || imgs[j].getAttribute('src');
        if (rr.width < 90 || rr.height < 90 || !s2 || /^data:|\.svg|logo|icon|avatar/i.test(s2) || inBad(imgs[j])) continue;
        if (rr.width * rr.height > bestA) { bestA = rr.width * rr.height; poster = s2; }
      }
    }
    R.poster = abs(poster) || '';

    var desc = '', dl = 0;
    var dsel = document.querySelectorAll('[itemprop=description], [class*=descr], [class*=story], [class*=plot], [class*=synopsis], [class*=about], [id*=descr], [class*=text-full], [class*=fulltext]');
    for (var d = 0; d < dsel.length; d++) {
      var tx = clean(dsel[d].textContent);
      if (tx.length < 60 || tx.length > 3500 || inBad(dsel[d])) continue;
      var linkLen = 0;
      var ls = dsel[d].querySelectorAll('a');
      for (var q = 0; q < ls.length; q++) linkLen += clean(ls[q].textContent).length;
      if (linkLen > tx.length * 0.4) continue;
      if (tx.length > dl) { dl = tx.length; desc = tx; }
    }
    if (!desc) { var md = document.querySelector('meta[name=description], meta[property="og:description"]'); desc = md ? clean(md.getAttribute('content')) : ''; }
    R.desc = desc.replace(/^(описание|description)\s*[:\-]\s*/i, '').slice(0, 3000);

    /* ---------- свойства: «Год: 2023», «Жанр: ...» ---------- */
    var pairs = [], seenK = {};
    function addKV(k, v) {
      k = clean(k).replace(/[:：]\s*$/, ''); v = clean(v);
      if (!k || !v || k.length > 26 || v.length > 160 || seenK[k.toLowerCase()]) return;
      seenK[k.toLowerCase()] = 1; pairs.push({ k: k, v: v });
    }
    var dts = document.querySelectorAll('dt');
    for (var a1 = 0; a1 < dts.length && pairs.length < 10; a1++) { var dd = dts[a1].nextElementSibling; if (dd && dd.tagName === 'DD') addKV(dts[a1].textContent, dd.textContent); }
    var trs = document.querySelectorAll('tr');
    for (var a2 = 0; a2 < trs.length && pairs.length < 10; a2++) {
      var cells = trs[a2].children;
      if (cells.length === 2 && clean(cells[0].textContent).length <= 26 && !inBad(trs[a2])) addKV(cells[0].textContent, cells[1].textContent);
    }
    var KV = /^([A-Za-zА-яЁё ]{2,24}):\s*(.{1,150})$/;
    var lines = document.querySelectorAll('p, li, div, span');
    for (var a3 = 0; a3 < lines.length && pairs.length < 10 && a3 < 1500; a3++) {
      var ln = lines[a3];
      if (ln.children.length > 4 || inBad(ln) || ln.querySelector('p, li, div, ul, ol, table, br + b, br + strong')) continue;
      var lt = clean(ln.textContent);
      if (lt.length > 190) continue;
      var km = lt.match(KV);
      if (km && ln.querySelector('b, strong, span, a, em')) addKV(km[1], km[2]);
    }
    R.info = pairs;
  } catch (err) { R.ok = false; R.err = String(err && err.message || err); }
  return R;
}
function (P) {
  if (window.__teach) return { ok: true, again: true };
  window.__teach = { sel: null, msg: '' };
  var bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;padding:12px 14px;border-radius:14px;background:#7c5cff;color:#fff;font:600 14px/1.3 system-ui,sans-serif;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.4);pointer-events:none';
  bar.textContent = 'Нажмите на любую карточку видео';
  document.body.appendChild(bar);

  function stable(c) { return c && !/\d/.test(c) && !/^(active|current|selected|first|last|odd|even|hover|focus|open|show|hide|clearfix|lazy|loaded|lazyloaded)$/i.test(c); }
  function selFor(el) {
    var s = el.tagName.toLowerCase();
    var cls = [].slice.call(el.classList || []).filter(stable).slice(0, 3);
    if (cls.length) s += '.' + cls.map(function (c) { return CSS.escape(c); }).join('.');
    return s;
  }
  function pick(t) {
    var el = t, depth = 0;
    while (el && el !== document.body && el !== document.documentElement && depth < 8) {
      var hasClass = el.classList && el.classList.length;
      if (hasClass || /^(LI|ARTICLE)$/.test(el.tagName)) {
        var s = selFor(el);
        var all;
        try { all = document.querySelectorAll(s); } catch (e) { all = []; }
        var hasLink = el.matches('a[href]') || el.querySelector('a[href]');
        var hasImg = el.querySelector('img, video, [style*="background"], [data-bg], [data-src]') || /background/.test((el.getAttribute('style') || ''));
        if (all.length >= 3 && all.length <= 400 && hasLink && hasImg) return s;
      }
      el = el.parentElement; depth++;
    }
    return '';
  }
  document.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    var s = pick(e.target);
    if (s) {
      window.__teach.sel = s;
      bar.style.background = '#35d49a';
      bar.textContent = 'Готово: ' + document.querySelectorAll(s).length + ' карточек';
    } else {
      bar.style.background = '#ff6b7a';
      bar.textContent = 'Не понял эту карточку. Нажмите на картинку другого видео';
    }
  }, true);
  return { ok: true };
}
