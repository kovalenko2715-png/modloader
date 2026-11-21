function (P) {
  P = P || {};
  var R = { ok: true, url: location.href, title: document.title || '', ready: document.readyState, items: [], cats: [], search: null, next: null, more: false, h: 0 };
  try {
    var HOST = location.hostname.replace(/^www\./, '');

    function abs(u) { if (!u) return null; try { return new URL(u, document.baseURI).href; } catch (e) { return null; } }
    function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
    function cut(s, n) { s = clean(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
    function sameSite(u) { try { return new URL(u).hostname.replace(/^www\./, '') === HOST; } catch (e) { return false; } }
    function visible(el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }

    /* ---------- поиск: найти поле ---------- */
    var NAMES = ['s', 'q', 'query', 'search', 'search_query', 'k', 'keyword', 'keywords', 'text', 'find', 'story', 'term', 'wd', 'kw', 'searchword', 'search_text', 'key', 'qs'];
    function findSearchInput() {
      var all = document.querySelectorAll('input');
      var best = null, score = 0;
      for (var n = 0; n < all.length; n++) {
        var i = all[n];
        var t = (i.type || 'text').toLowerCase();
        if (t !== 'text' && t !== 'search' && t !== '') continue;
        var s = 0, nm = (i.name || '').toLowerCase();
        var meta = ((i.placeholder || '') + ' ' + (i.getAttribute('aria-label') || '') + ' ' + (i.className || '') + ' ' + (i.id || '') + ' ' + nm).toLowerCase();
        if (t === 'search') s += 3;
        if (NAMES.indexOf(nm) >= 0) s += 2;
        if (/search|поиск|найти|искать|rechercher|buscar|suche/.test(meta)) s += 2;
        var f = i.form;
        if (f) {
          var fm = (String(f.getAttribute('action') || '') + ' ' + (f.className || '') + ' ' + (f.id || '') + ' ' + (f.getAttribute('role') || '')).toLowerCase();
          if (/search|поиск|find|\?s=/.test(fm)) s += 2;
          if (f.querySelector('input[type=password]')) s -= 6;
        }
        if (s > score) { score = s; best = i; }
      }
      return score >= 3 ? best : null;
    }

    function setValue(inp, v) {
      try {
        var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        d.set.call(inp, v);
      } catch (e) { inp.value = v; }
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /* ---------- режим: отправка поиска ---------- */
    if (P.mode === 'submit') {
      var si = findSearchInput();
      if (!si) return { ok: false, err: 'noform' };
      try { si.focus(); } catch (e) { }
      setValue(si, P.q);
      var f0 = si.form;
      if (f0) {
        var btn = f0.querySelector('button[type=submit], input[type=submit], button:not([type])');
        if (btn) { btn.click(); }
        else if (f0.requestSubmit) { f0.requestSubmit(); }
        else { f0.submit(); }
      } else {
        ['keydown', 'keypress', 'keyup'].forEach(function (nm) {
          si.dispatchEvent(new KeyboardEvent(nm, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        });
      }
      return { ok: true };
    }

    /* ---------- «показать ещё» ---------- */
    var MORE_RE = /^(load more|show more|view more|more|more videos|показать ещ[её]|загрузить ещ[её]|ещ[её]|больше)\b/i;
    function findLoadMore() {
      var els = document.querySelectorAll('button, a, div[role=button], span[role=button]');
      for (var i = 0; i < els.length; i++) {
        var t = clean(els[i].textContent);
        if (t.length > 0 && t.length < 30 && MORE_RE.test(t) && visible(els[i])) return els[i];
      }
      return null;
    }
    if (P.mode === 'more') {
      var lm = findLoadMore();
      if (lm) { try { lm.click(); } catch (e) { } }
      window.scrollTo(0, document.documentElement.scrollHeight);
      return { ok: true, clicked: !!lm, h: document.documentElement.scrollHeight };
    }

    R.h = document.documentElement.scrollHeight;
    R.more = !!findLoadMore();

    /* ---------- поиск: описание формы ---------- */
    var inp = findSearchInput();
    if (inp) {
      var fo = inp.form;
      if (fo && inp.name) {
        var extra = {};
        for (var e2 = 0; e2 < fo.elements.length; e2++) {
          var el = fo.elements[e2];
          if (!el.name || el === inp || el.disabled) continue;
          var tt = (el.type || '').toLowerCase();
          if (tt === 'hidden') extra[el.name] = el.value;
          else if ((tt === 'radio' || tt === 'checkbox') && el.checked) extra[el.name] = el.value;
          else if (el.tagName === 'SELECT') extra[el.name] = el.value;
        }
        R.search = { kind: 'form', action: abs(fo.getAttribute('action') || '') || location.href, method: (fo.method || 'get').toLowerCase(), param: inp.name, extra: extra };
      } else {
        R.search = { kind: 'input' };
      }
    }

    /* ---------- общие фильтры ---------- */
    var BADZONE = /(^|[\s_-])(menu|navbar|nav|breadcrumbs?|logo|banner|advert|adv|ads?|sponsors?|popup|cookie|footer|social|share|login|modal)([\s_-]|$)/i;
    function inBadZone(el) {
      var d = 0;
      while (el && el !== document.body && d < 9) {
        var tag = el.tagName;
        if (tag === 'NAV' || tag === 'FOOTER') return true;
        var cls = (typeof el.className === 'string' ? el.className : '') + ' ' + (el.id || '');
        if (BADZONE.test(cls)) return true;
        el = el.parentElement; d++;
      }
      return false;
    }
    var CAT_RE = /(^|\/)(categor(y|ies)|cats?|tags?|genres?|channels?|models?|pornstars?|stars?|actors?|actresses|studios?|collections?|playlists?|sections?|rubric[a-z]*|razdel|zhanr|janr|niches?|sites?)(\/|$)/i;
    var BADIMG = /(logo|icon|avatar|sprite|blank|pixel|spacer|1x1|loader|spinner|placeholder|emoji|flag[-_.]|badge|favicon)/i;

    function goodUrl(v) {
      if (!v) return false;
      v = String(v).trim();
      if (v.length < 5 || /^data:/i.test(v) || /^javascript:/i.test(v)) return false;
      if (/\.svg(\?|#|$)/i.test(v)) return false;
      return !BADIMG.test(v);
    }

    function imgSrc(img) {
      var names = ['data-original', 'data-src', 'data-lazy-src', 'data-lazy', 'data-echo', 'data-thumb', 'data-image', 'data-url', 'data-img'];
      var k, v;
      for (k = 0; k < names.length; k++) { v = img.getAttribute(names[k]); if (goodUrl(v)) return v; }
      var ss = img.getAttribute('data-srcset') || img.getAttribute('srcset');
      if (ss) {
        var parts = ss.split(','); v = parts[parts.length - 1].trim().split(/\s+/)[0];
        if (goodUrl(v)) return v;
      }
      if (goodUrl(img.currentSrc)) return img.currentSrc;
      v = img.getAttribute('src');
      return goodUrl(v) ? v : null;
    }

    function bgOf(el) {
      var names = ['data-bg', 'data-background', 'data-background-image', 'data-thumb', 'data-poster'];
      for (var k = 0; k < names.length; k++) { var s = el.getAttribute(names[k]); if (goodUrl(s)) return s; }
      var st = el.getAttribute('style') || '';
      var m = st.match(/url\((['"]?)(.*?)\1\)/);
      if (m && goodUrl(m[2])) return m[2];
      var cs = '';
      try { cs = getComputedStyle(el).backgroundImage || ''; } catch (e) { }
      m = cs.match(/url\(["']?(.*?)["']?\)/);
      return (m && goodUrl(m[1])) ? m[1] : null;
    }

    /* лучшая картинка внутри root: {url, area} */
    function thumbOf(root) {
      var best = null, area = 0;
      var imgs = root.querySelectorAll('img');
      var i, r, u, a;
      for (i = 0; i < imgs.length && i < 8; i++) {
        r = imgs[i].getBoundingClientRect();
        if (r.width < 70 || r.height < 40) continue;
        u = imgSrc(imgs[i]); if (!u) continue;
        a = r.width * r.height; if (a > area) { area = a; best = u; }
      }
      if (best) return best;
      var vids = root.querySelectorAll('video[poster]');
      for (i = 0; i < vids.length; i++) {
        r = vids[i].getBoundingClientRect();
        if (r.width < 70) continue;
        u = vids[i].getAttribute('poster'); if (goodUrl(u)) return u;
      }
      var bgs = [root].concat([].slice.call(root.querySelectorAll('div,span,a,figure,i,picture,li'), 0, 14));
      for (i = 0; i < bgs.length; i++) {
        r = bgs[i].getBoundingClientRect();
        if (r.width < 70 || r.height < 40) continue;
        u = bgOf(bgs[i]); if (!u) continue;
        a = r.width * r.height; if (a > area) { area = a; best = u; }
      }
      return best;
    }

    function previewOf(root) {
      var attrs = ['data-preview', 'data-preview-url', 'data-gif', 'data-webp', 'data-animated', 'data-video', 'data-mp4', 'data-trailer', 'data-previewvideo', 'data-hover'];
      var els = [root].concat([].slice.call(root.querySelectorAll('*'), 0, 25));
      for (var i = 0; i < els.length; i++) {
        for (var k = 0; k < attrs.length; k++) {
          var v = els[i].getAttribute(attrs[k]);
          if (v && /\.(mp4|webm|gif|webp|m4v|apng)(\?|#|$)/i.test(v)) return abs(v);
        }
      }
      var vs = root.querySelectorAll('video[src], video source[src]');
      for (var j = 0; j < vs.length; j++) { var s = vs[j].getAttribute('src'); if (s && /\.(mp4|webm|m4v)(\?|#|$)/i.test(s)) return abs(s); }
      return null;
    }

    function container(a) {
      var el = a, up = 0;
      while (up < 4 && el.parentElement) {
        var p = el.parentElement;
        if (/^(BODY|MAIN|UL|OL|SECTION|ARTICLE|HTML|NAV|HEADER)$/.test(p.tagName) && p.tagName !== 'ARTICLE') break;
        if (p.children.length > 14) break;
        var as = p.querySelectorAll('a[href]'), seen = {}, cnt = 0;
        for (var i = 0; i < as.length && cnt < 7; i++) {
          var h = as[i].getAttribute('href');
          if (!h || h.charAt(0) === '#' || /^javascript:/i.test(h)) continue;
          if (!seen[h]) { seen[h] = 1; cnt++; }
        }
        if (cnt > 4 || p.querySelectorAll('img').length > 4) break;
        el = p; up++;
      }
      return el;
    }

    var GENERIC_ALT = /^(image|img|photo|picture|thumb|thumbnail|poster|video|preview|фото|картинка)\d*$/i;
    function titleOf(a, box, img) {
      var t = a.getAttribute('title');
      if (t && clean(t).length > 2) return cut(t, 140);
      var c = box.querySelector('[class*=title], [class*=name], h1, h2, h3, h4, h5, h6, [itemprop=name]');
      if (c && clean(c.textContent).length > 2) return cut(c.textContent, 140);
      var im = img || box.querySelector('img');
      if (im) { var alt = clean(im.getAttribute('alt')); if (alt.length > 2 && !GENERIC_ALT.test(alt)) return cut(alt, 140); }
      var at = clean(a.textContent);
      if (at.length > 2) return cut(at, 140);
      var bt = clean(box.textContent);
      if (bt.length > 2) return cut(bt, 100);
      return '';
    }

    function slugTitle(u) {
      try {
        var p = new URL(u).pathname.replace(/\/+$/, '').split('/').pop() || '';
        p = decodeURIComponent(p).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_+]+/g, ' ').replace(/^\d+\s+/, '');
        return cut(p, 100);
      } catch (e) { return ''; }
    }

    function durOf(box) {
      var els = box.querySelectorAll('[class*=duration], [class*=time], [class*=length], time');
      for (var i = 0; i < els.length; i++) {
        var m = clean(els[i].textContent).match(/^(\d{1,2}:\d{2}(?::\d{2})?)$/);
        if (m) return m[1];
      }
      var m2 = clean(box.textContent).match(/(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)(?:\s|$)/);
      return m2 ? m2[1] : '';
    }
    function dateOf(box) {
      var t = box.querySelector('time[datetime]');
      if (t) return String(t.getAttribute('datetime')).slice(0, 10);
      var d = box.querySelector('[class*=date], [class*=added], [class*=ago]');
      if (d) { var s = clean(d.textContent); if (s.length < 24) return s; }
      return '';
    }
    function metaOf(box) {
      var v = box.querySelector('[class*=view], [class*=hits], [class*=count]');
      if (v) { var s = clean(v.textContent); if (s.length > 0 && s.length < 22) return s; }
      return '';
    }

    /* ---------- карточки ---------- */
    var NOLINK = /^(javascript:|mailto:|tel:|#)/i;
    var anchors = document.querySelectorAll('a[href]');
    var byLink = {}, items = [];
    var cur = location.href.split('#')[0];
    /* правило, которому пользователь «обучил» сайт: селектор карточки */
    if (P.rule && P.rule.card) {
      var rc;
      try { rc = document.querySelectorAll(P.rule.card); } catch (e) { rc = []; }
      for (var z = 0; z < rc.length && items.length < 400; z++) {
        var cb = rc[z];
        var ra = cb.matches('a[href]') ? cb : cb.querySelector('a[href]');
        if (!ra) continue;
        var rh = abs(ra.getAttribute('href'));
        if (!rh || !/^https?:/i.test(rh) || byLink[rh]) continue;
        var rt = thumbOf(cb), rp = '';
        try { rp = new URL(rh).pathname; } catch (e) { }
        var rk = (CAT_RE.test(rp) && sameSite(rh)) ? 'cat' : 'video';
        var ri = {
          link: rh, thumb: rt ? (abs(rt) || '') : '', kind: rk,
          title: titleOf(ra, cb, null) || slugTitle(rh) || '\u0412\u0438\u0434\u0435\u043e',
          preview: previewOf(cb) || '', dur: rk === 'video' ? durOf(cb) : '', date: dateOf(cb), meta: metaOf(cb)
        };
        byLink[rh] = ri; items.push(ri);
      }
    }
    var limit = items.length ? 0 : Math.min(anchors.length, 4000);

    for (var n = 0; n < limit && items.length < 400; n++) {
      var a = anchors[n];
      var raw = a.getAttribute('href');
      if (!raw || NOLINK.test(raw)) continue;
      var href = abs(raw);
      if (!href || !/^https?:/i.test(href)) continue;
      if (href.split('#')[0] === cur) continue;
      if (inBadZone(a)) continue;
      var box = a;
      var th = thumbOf(a);
      var at = clean(a.textContent);
      if (!th && at.length >= 4) {
        box = container(a);
        if (box !== a) th = thumbOf(box);
      } else if (th) {
        var bx = container(a); if (bx !== a) box = bx;
      }
      if (!th) continue;
      var turl = abs(th);
      if (!turl) continue;

      var ex = byLink[href];
      var pathOnly = '';
      try { pathOnly = new URL(href).pathname; } catch (e) { }
      var kind = (CAT_RE.test(pathOnly) && sameSite(href)) ? 'cat' : 'video';
      if (ex) {
        if (!ex.title) ex.title = titleOf(a, box, null);
        if (!ex.preview) ex.preview = previewOf(box);
        continue;
      }
      var it = {
        link: href, thumb: turl, kind: kind,
        title: titleOf(a, box, null) || slugTitle(href) || 'Видео',
        preview: previewOf(box) || '',
        dur: kind === 'video' ? durOf(box) : '',
        date: dateOf(box),
        meta: metaOf(box)
      };
      byLink[href] = it;
      items.push(it);
    }
    R.items = items;

    /* ---------- категории (меню) ---------- */
    var SKIP_CAT = /^(главная|home|login|log in|sign|вход|регистр|контакт|contact|dmca|privacy|terms|about|faq|help|rss|sitemap|18\+|2257|реклам|advert|upload|загрузи|помощ|о нас|правил|политик|соглаш|авториз|cookie|language|язык|rus|eng|en$|ru$)/i;
    var cats = [], cseen = {}, tseen = {};
    var navs = document.querySelectorAll('nav a[href], header a[href], [role=navigation] a[href], [class*=menu] a[href], [class*=nav] a[href], [class*=categor] a[href], [class*=genre] a[href], [class*=tags] a[href], aside a[href], [class*=sidebar] a[href]');
    for (var m = 0; m < navs.length && cats.length < 90; m++) {
      var na = navs[m];
      var nraw = na.getAttribute('href');
      if (!nraw || NOLINK.test(nraw)) continue;
      var nh = abs(nraw);
      if (!nh || !sameSite(nh) || (byLink[nh] && byLink[nh].kind === 'video') || cseen[nh]) continue;
      if (nh.split('#')[0] === cur || nh.replace(/\/+$/, '') === (location.origin)) continue;
      var nt = clean(na.textContent);
      if (nt.length < 2 || nt.length > 28 || SKIP_CAT.test(nt)) continue;
      var key = nt.toLowerCase();
      if (tseen[key]) continue;
      var np = ''; try { np = new URL(nh).pathname; } catch (e) { }
      if (np === '/' || np === '') continue;
      if (/\.(css|js|jpe?g|png|gif|webp|svg|xml|pdf)(\?|$)/i.test(np)) continue;
      cseen[nh] = 1; tseen[key] = 1;
      cats.push({ name: nt, url: nh, cat: CAT_RE.test(np) ? 1 : 0 });
    }
    /* сначала явные категории, потом остальные пункты меню */
    cats.sort(function (x, y) { return y.cat - x.cat; });
    R.cats = cats.slice(0, 60).map(function (c) { return { name: c.name, url: c.url }; });

    /* ---------- следующая страница ---------- */
    function findNext() {
      var l = document.querySelector('link[rel~=next]');
      if (l && l.getAttribute('href')) return abs(l.getAttribute('href'));
      var an = document.querySelector('a[rel~=next]');
      if (an && an.getAttribute('href')) return abs(an.getAttribute('href'));
      var all = document.querySelectorAll('a[href]');
      var NEXT_T = /^(next|older|далее|впер[её]д|след|следующ|навпер[её]д|»|›|>|→|►|▶)/i;
      var NEXT_C = /(^|[\s_-])(next|nextpage|next-page|pagination-next|page-next)([\s_-]|$)/i;
      var k;
      for (k = 0; k < all.length; k++) {
        var x = all[k], h = x.getAttribute('href');
        if (!h || NOLINK.test(h)) continue;
        var tx = clean(x.textContent) + '';
        var lab = (x.getAttribute('aria-label') || '') + ' ' + (x.getAttribute('title') || '');
        var cl = (typeof x.className === 'string' ? x.className : '') + ' ' + ((x.parentElement && typeof x.parentElement.className === 'string') ? x.parentElement.className : '');
        if ((tx.length < 16 && NEXT_T.test(tx)) || NEXT_T.test(clean(lab)) || NEXT_C.test(cl)) {
          var u = abs(h);
          if (u && u.split('#')[0] !== cur) return u;
        }
      }
      var pags = document.querySelectorAll('.pagination, .pager, .pages, .navigation, .paginator, nav[aria-label*=agin], [class*=pagina]');
      for (var p = 0; p < pags.length; p++) {
        var cur2 = pags[p].querySelector('.current, .active, .selected, [aria-current], b, strong, span.page');
        var num = cur2 ? parseInt(clean(cur2.textContent), 10) : NaN;
        if (isNaN(num)) continue;
        var links = pags[p].querySelectorAll('a[href]');
        for (var q = 0; q < links.length; q++) {
          if (parseInt(clean(links[q].textContent), 10) === num + 1) return abs(links[q].getAttribute('href'));
        }
      }
      return null;
    }
    R.next = findNext();
  } catch (err) {
    R.ok = false; R.err = String(err && err.message || err);
  }
  return R;
}
