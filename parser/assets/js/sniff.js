function (P) {
  P = P || {};
  var out = { urls: [], iframes: [], title: document.title || '', videos: 0 };
  var seen = {};
  var MEDIA = /\.(mp4|m3u8|webm|mkv|mov|m4v)(\?|#|$)/i;
  function add(u) {
    if (!u) return;
    u = String(u).replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&');
    try { u = new URL(u, document.baseURI).href; } catch (e) { return; }
    if (!/^https?:/i.test(u) || !MEDIA.test(u) || seen[u]) return;
    seen[u] = 1; out.urls.push(u);
  }
  try {
    /* 1. сетевые запросы страницы */
    var res = performance.getEntriesByType('resource');
    for (var i = 0; i < res.length; i++) add(res[i].name);

    /* 2. теги video / source */
    var vs = document.querySelectorAll('video, source, audio');
    out.videos = document.querySelectorAll('video').length;
    for (i = 0; i < vs.length; i++) { add(vs[i].currentSrc); add(vs[i].getAttribute('src')); add(vs[i].getAttribute('data-src')); }

    /* 3. мета-теги */
    var mt = document.querySelectorAll('meta[property^="og:video"], meta[name="twitter:player:stream"], meta[itemprop=contentUrl]');
    for (i = 0; i < mt.length; i++) add(mt[i].getAttribute('content'));

    /* 4. известные плееры */
    try {
      if (window.jwplayer) {
        var pl = window.jwplayer().getPlaylist() || [];
        pl.forEach(function (it) { add(it.file); (it.sources || []).forEach(function (s) { add(s.file); }); });
      }
    } catch (e) { }
    try {
      var vj = document.querySelectorAll('.video-js');
      for (i = 0; i < vj.length; i++) { if (vj[i].player && vj[i].player.currentSrc) add(vj[i].player.currentSrc()); }
    } catch (e) { }

    /* 5. ссылки в тексте страницы (JSON, inline-скрипты) */
    var html = document.documentElement.innerHTML;
    if (html.length > 3000000) html = html.slice(0, 3000000);
    var re = /https?:(?:\\?\/){2}(?:[^\s"'<>\\)]|\\\/)+?\.(?:mp4|m3u8|webm)(?:\?(?:[^\s"'<>\\)]|\\\/)*)?/gi;
    var m, guard = 0;
    while ((m = re.exec(html)) && guard++ < 80) add(m[0].replace(/\\\//g, '/'));

    /* 6. iframe с плеерами */
    var fr = document.querySelectorAll('iframe[src], iframe[data-src]');
    for (i = 0; i < fr.length; i++) {
      var s = fr[i].getAttribute('src') || fr[i].getAttribute('data-src');
      try { s = new URL(s, document.baseURI).href; } catch (e) { continue; }
      if (/^https?:/i.test(s) && out.iframes.indexOf(s) < 0) out.iframes.push(s);
    }

    /* 7. запустить воспроизведение (без звука) и нажать «play» */
    var vids = document.querySelectorAll('video');
    for (i = 0; i < vids.length; i++) {
      try { vids[i].muted = true; vids[i].volume = 0; var pr = vids[i].play(); if (pr && pr.catch) pr.catch(function () { }); } catch (e) { }
    }
    if (P.click) {
      var sel = ['.vjs-big-play-button', '.jw-icon-display', '.plyr__control--overlaid', '.fp-play', '.play-button', '.btn-play', '[class*=big-play]', '[class*=play-btn]', '[class*=playbtn]', '[aria-label*=Play]', '[aria-label*=play]', '[class*=poster]', '[class*=player] button'];
      for (i = 0; i < sel.length; i++) {
        var b = document.querySelector(sel[i]);
        if (b) { try { b.click(); } catch (e) { } break; }
      }
    }
  } catch (err) { out.err = String(err && err.message || err); }
  return out;
}
