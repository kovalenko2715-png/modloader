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
