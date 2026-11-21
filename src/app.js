/* Общая Грядка — Telegram Mini App (vanilla JS) */
(() => {
  "use strict";

  /* ---------- Telegram ---------- */
  const tg = window.Telegram && window.Telegram.WebApp;
  let tgUser = null;
  if (tg && !window.__noTG) {
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor("#142819");
      tgUser = tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null;
    } catch (e) { tgUser = null; }
  }

  const savedId = localStorage.getItem("farm_uid");
  const PLAYER = {
    id: tgUser ? String(tgUser.id) : (savedId || ("guest_" + Math.random().toString(36).slice(2, 10))),
    name: tgUser
      ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ")
      : "Гость"
  };
  localStorage.setItem("farm_uid", PLAYER.id);

  /* ---------- Культуры ---------- */
  const CROPS = {
    carrot: { name: "Кукуруза: молодая", seed: 5, sell: 14, growMs: 3 * 60000, unlockLevel: 0, img: "assets/crops/plant1.png", w: 83, h: 48, dx: 22, dy: 8 },
    radish: { name: "Кукуруза: двойная", seed: 12, sell: 32, growMs: 6 * 60000, unlockLevel: 1, img: "assets/crops/plant2.png", w: 121, h: 99, dx: 0, dy: -40 },
    potato: { name: "Золотая кукуруза", seed: 35, sell: 95, growMs: 12 * 60000, unlockLevel: 2, img: "assets/crops/plant3.png", w: 110, h: 92, dx: 4, dy: -36 }
  };

  const PIECES = {
    fence_e: { img: "assets/tiles/fence_e.png", dx: 0, dy: -29, w: 67, h: 68 },
    fence_s: { img: "assets/tiles/fence_s.png", dx: 61, dy: -29, w: 67, h: 68 },
    fence_n: { img: "assets/tiles/fence_n.png", dx: 0, dy: 2, w: 67, h: 68 },
    fence_w: { img: "assets/tiles/fence_w.png", dx: 61, dy: 2, w: 67, h: 68 },
    sack:    { img: "assets/decor/sack.png",    dx: 49, dy: 11, w: 22, h: 28 },
    crate:   { img: "assets/decor/crate.png",   dx: 35, dy: 8, w: 58, h: 37 },
    hay:     { img: "assets/decor/hay.png",     dx: 11, dy: -12, w: 98, h: 70 },
    ladder:  { img: "assets/decor/ladder.png",  dx: 49, dy: -57, w: 51, h: 96 },
    barn:    { img: "assets/decor/barn.png",    dx: -64, dy: -92, w: 204, h: 238 }
  };

  const LEVELS = [
    { size: 5, cost: 0 },
    { size: 7, cost: 100 },
    { size: 9, cost: 300 }
  ];

  /* ---------- Состояние ---------- */
  const defaultState = () => ({ level: 0, coins: 30, tiles: {} });
  let state = restoreLocal() || defaultState();
  let selectedCrop = "carrot";
  let db = null;
  let playerName = PLAYER.name;

  function restoreLocal() {
    try { return JSON.parse(localStorage.getItem("farm_state")); }
    catch (e) { return null; }
  }
  function saveLocal() {
    localStorage.setItem("farm_state", JSON.stringify(state));
  }

  /* ---------- Supabase (опционально) ---------- */
  async function initDb() {
    const cfg = window.FARM_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
    try {
      const mod = await import("https://esm.run/@supabase/supabase-js@2");
      db = mod.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const { data, error } = await db.from("players").select("*").eq("id", PLAYER.id).maybeSingle();
      if (!error && data) {
        if (data.coins > state.coins || (data.state && data.state.level >= state.level)) {
          state = Object.assign(defaultState(), data.state || {});
        }
        if (data.name) playerName = data.name;
      }
    } catch (e) { db = null; }
  }

  let syncTimer = null;
  function sync() {
    saveLocal();
    if (!db) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      db.from("players").upsert({
        id: PLAYER.id, name: playerName, coins: state.coins,
        state: state, updated_at: new Date().toISOString()
      }).then(() => {});
    }, 800);
  }

  /* ---------- DOM ---------- */
  const VER = "?v=9";
  const asset = (p) => p + VER;
  const board = document.getElementById("board");
  const coinsEl = document.getElementById("coins");
  const sceneEl = document.getElementById("scene");
  const nameEl = document.getElementById("player-name");
  const hintEl = document.getElementById("hint");
  const cropsEl = document.getElementById("crops");
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modal-body");
  const modalTitle = document.getElementById("modal-title");

  nameEl.textContent = "👨‍🌾 " + playerName;
  hintEl.textContent = "Ферма v9";
  const size = () => LEVELS[state.level].size;

  function unlocked(i, j) {
    const r = (size() - 1) / 2;
    return Math.abs(i - r) <= r && Math.abs(j - r) <= r;
  }
  function cropUnlocked(key) {
    return (CROPS[key].unlockLevel || 0) <= state.level;
  }

  /* ---------- Рендер ---------- */
  const TW = 128, ELEMH = 70, PADY = 56;
  function tileXY(i, j, n) {
    return [ (i - j) * (TW / 2) + (n - 1) * (TW / 2), (i + j) * ((ELEMH - 6) / 2) + PADY ];
  }
  function render() {
    board.innerHTML = "";
    const n = size();
    const vw = sceneEl.clientWidth || window.innerWidth || 360;
    const cw = n * TW;
    const ch = ELEMH + (n - 1) * ((ELEMH - 6) / 2);
    const s = Math.min(1, (vw - 8) / (cw * 1.08));
    board.style.transform = "translate(" + (-(cw / 2) * s) + "px, " + (-(PADY + ch / 2) * s - 20) + "px) scale(" + s + ")";
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const xy = tileXY(i, j, n);
        const x = xy[0], y = xy[1];
        const el = document.createElement("div");
        el.className = "tile";
        el.dataset.i = i; el.dataset.j = j;
        el.style.left = x + "px";
        el.style.top = y + "px";
        if (!unlocked(i, j)) {
          el.classList.add("locked");
          el.style.backgroundImage = "url(" + asset("assets/tiles/grass2.png") + ")";
        } else {
          const t = state.tiles[i + "." + j];
          const base = ((i + j) % 2 === 0) ? "assets/tiles/grass.png" : "assets/tiles/grass2.png";
          const bgImg = t ? (t.crop ? "assets/tiles/soil.png" : (t.soil ? "assets/tiles/soil2.png" : base)) : base;
          el.style.backgroundImage = "url(" + asset(bgImg) + ")";
          if (t && t.crop) attachCrop(el, t, i, j);
          if (t && !t.crop && t.soil) attachBadge(el, "+", 50, 24, "seed");
          const fp = [];
          if (i === 0) fp.push(PIECES.fence_e);
          if (j === 0) fp.push(PIECES.fence_s);
          if (i === n - 1) fp.push(PIECES.fence_w);
          if (j === n - 1) fp.push(PIECES.fence_n);
          fp.forEach((p) => {
            const f = document.createElement("div");
            f.className = "piece";
            f.style.backgroundImage = "url(" + asset(p.img) + ")";
            f.style.width = p.w + "px";
            f.style.height = p.h + "px";
            f.style.left = (x + p.dx) + "px";
            f.style.top = (y + p.dy) + "px";
            f.style.zIndex = 10 + (i + j) * 10 + 5;
            board.appendChild(f);
          });
        }
        el.addEventListener("click", onTile);
        board.appendChild(el);
      }
    }
    const decor = [
      { p: PIECES.barn, vi: -2, vj: 1, z: 1 },
      { p: PIECES.hay, vi: -1, vj: 1 },
      { p: PIECES.ladder, vi: -1, vj: n - 1 },
      { p: PIECES.crate, vi: 1, vj: -1 },
      { p: PIECES.sack, vi: -1, vj: 0 },
      { p: PIECES.hay, vi: n - 1, vj: n },
      { p: PIECES.crate, vi: n, vj: n - 1 }
    ];
    decor.forEach((dc) => {
      const xy = tileXY(dc.vi, dc.vj, n);
      const dv = document.createElement("div");
      dv.className = "decor";
      dv.style.backgroundImage = "url(" + asset(dc.p.img) + ")";
      dv.style.left = (xy[0] + dc.p.dx) + "px";
      dv.style.top = (xy[1] + dc.p.dy) + "px";
      dv.style.width = dc.p.w + "px";
      dv.style.height = dc.p.h + "px";
      dv.style.zIndex = (dc.z !== undefined) ? dc.z : 10 + (dc.vi + dc.vj) * 10;
      board.appendChild(dv);
    });
    coinsEl.textContent = "🪙 " + state.coins;
    renderPanel();
  }

  function attachBadge(el, text, dx, dy, cls) {
    const b = document.createElement("div");
    b.className = "badge" + (cls ? " " + cls : "");
    b.style.left = (parseFloat(el.style.left) + dx) + "px";
    b.style.top = (parseFloat(el.style.top) + dy) + "px";
    b.style.zIndex = 200;
    b.textContent = text;
    board.appendChild(b);
  }

  function attachCrop(el, t, i, j) {
    const d = CROPS[t.crop];
    const grown = t.readyAt && Date.now() >= t.readyAt;
    const k = grown ? 1 : 0.62;
    const w = Math.round(d.w * k), h = Math.round(d.h * k);
    const elL = parseFloat(el.style.left), elT = parseFloat(el.style.top);
    const img = document.createElement("div");
    img.className = "crop" + (grown ? " ready" : "");
    img.style.backgroundImage = "url(" + asset(d.img) + ")";
    img.style.width = w + "px";
    img.style.height = h + "px";
    img.style.left = (elL + d.dx + (d.w - w) / 2) + "px";
    img.style.top = (elT + d.dy + (d.h - h)) + "px";
    img.style.zIndex = 10 + (i + j) * 10;
    board.appendChild(img);
    if (grown) {
      attachBadge(el, "✋", 50, 24);
    } else {
      attachBadge(el, t.watered ? clockText(t.readyAt) : "💧", 50, 24, t.watered ? "clock" : "zzz");
    }
  }

  function clockText(readyAt) {
    const left = Math.max(0, readyAt - Date.now());
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ---------- Действия ---------- */
  function onTile(ev) {
    const el = ev.currentTarget;
    const i = +el.dataset.i, j = +el.dataset.j;
    if (!unlocked(i, j)) {
      hint("🔒 Расширяйте территорию кнопкой 🗺 сверху");
      return;
    }
    const key = i + "." + j;
    let t = state.tiles[key];

    if (t && t.crop) {
      const grown = t.readyAt && Date.now() >= t.readyAt;
      if (grown) {
        const d = CROPS[t.crop];
        state.coins += d.sell;
        delete state.tiles[key];
        hint("💰 " + d.name + " продана за " + d.sell + "!");
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
        render(); sync();
      } else {
        hint(t.watered ? "⏳ Растёт: " + clockText(t.readyAt) : "💧 Полейте, чтобы росло");
      }
      return;
    }

    const d = CROPS[selectedCrop];
    const empty = !t;
    if (empty) {
      if (state.coins < d.seed) { hint("Не хватает 🪙 на семена (" + d.seed + ")"); return; }
      state.tiles[key] = t = { soil: true, watered: false };
    }
    if (!t.watered) {
      if (state.coins < d.seed) { hint("Не хватает 🪙 на семена (" + d.seed + ")"); if (empty) delete state.tiles[key]; return; }
      t.watered = true;
      t.crop = selectedCrop;
      t.readyAt = Date.now() + d.growMs;
      state.coins -= d.seed;
      hint("🌱 " + d.name + " посажена и полита");
      if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
      render(); sync();
    } else if (!t.crop) {
      if (state.coins < d.seed) { hint("Не хватает 🪙 на семена (" + d.seed + ")"); return; }
      t.crop = selectedCrop;
      t.readyAt = Date.now() + d.growMs;
      state.coins -= d.seed;
      hint("🌱 " + d.name + " посажена");
      render(); sync();
    } else {
      hint("Здесь уже растёт: " + clockText(t.readyAt));
    }
  }

  /* ---------- Панель ---------- */
  function renderPanel() {
    cropsEl.innerHTML = "";
    Object.keys(CROPS).forEach((key) => {
      const d = CROPS[key];
      const b = document.createElement("div");
      b.className = "crop-btn" + (selectedCrop === key ? " selected" : "") + (!cropUnlocked(key) ? " locked" : "");
      b.innerHTML = '<img src="' + asset(d.img) + '" alt=""><span>' + d.name + "<br>🪙" + d.seed + " → " + d.sell + "</span>";
      b.addEventListener("click", () => {
        if (!cropUnlocked(key)) { hint("Откроется после расширения территории"); return; }
        selectedCrop = key;
        render();
      });
      b.querySelector("img").onerror = function () { this.style.display = "none"; };
      cropsEl.appendChild(b);
    });

    let expBtn = document.getElementById("btn-expand");
    if (!expBtn) {
      expBtn = document.createElement("button");
      expBtn.id = "btn-expand";
      expBtn.className = "btn gold";
      expBtn.addEventListener("click", expand);
      document.getElementById("topbar").insertBefore(expBtn, document.getElementById("btn-board"));
    }
    const next = LEVELS[state.level + 1];
    if (next) {
      expBtn.textContent = "🗺 " + next.cost;
      expBtn.disabled = state.coins < next.cost;
    } else {
      expBtn.textContent = "🗺 MAX";
      expBtn.disabled = true;
    }
  }

  function expand() {
    const next = LEVELS[state.level + 1];
    if (!next || state.coins < next.cost) return;
    state.coins -= next.cost;
    state.level++;
    hint("🎉 Территория расширена!");
    if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    render(); sync();
  }

  function hint(text) { hintEl.textContent = text; }

  /* ---------- Топ и шаринг ---------- */
  document.getElementById("btn-board").addEventListener("click", showBoard);
  document.getElementById("btn-share").addEventListener("click", share);
  document.getElementById("modal-close").addEventListener("click", () => modal.classList.add("hidden"));

  async function showBoard() {
    modalTitle.textContent = "🏆 Топ фермеров";
    modalBody.innerHTML = "<p>Загружаю…</p>";
    modal.classList.remove("hidden");
    if (!db) {
      modalBody.innerHTML =
        "<p><b>Онлайн-топ пока отключён.</b></p>" +
        "<p>Впишите бесплатные ключи Supabase в <code>config.js</code> — игроки появятся в общей таблице (инструкция в README, 5 минут).</p>";
      return;
    }
    const { data, error } = await db.from("players").select("name, coins").order("coins", { ascending: false }).limit(10);
    if (error || !data) {
      modalBody.innerHTML = "<p>Не удалось загрузить топ: " + (error && error.message) + "</p>";
      return;
    }
    let html = "<table>";
    data.forEach((r, idx) => {
      const medal = ["🥇", "🥈", "🥉"][idx] || (idx + 1);
      const me = r.name === playerName ? " class='me'" : "";
      html += "<tr" + me + "><td>" + medal + " " + (r.name || "Фермер") + "</td><td>🪙 " + r.coins + "</td></tr>";
    });
    modalBody.innerHTML = html + "</table>";
  }

  function share() {
    const url = location.href.split("?")[0];
    const text = "🌾 Заходи на мою ферму в «Общей Грядке»!";
    if (tg && tg.openTelegramLink) {
      tg.openTelegramLink("https://t.me/share/url?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(text));
    } else if (navigator.share) {
      navigator.share({ title: "Общая Грядка", text: text, url: url }).catch(() => {});
    } else {
      hint("Ссылка: " + url);
    }
  }

  /* ---------- Старт ---------- */
  ["assets/tiles/grass.png", "assets/tiles/grass2.png", "assets/tiles/soil.png", "assets/tiles/soil2.png",
   "assets/tiles/fence_e.png", "assets/tiles/fence_s.png", "assets/tiles/fence_n.png", "assets/tiles/fence_w.png",
   "assets/decor/hay.png", "assets/decor/crate.png", "assets/decor/sack.png", "assets/decor/ladder.png", "assets/decor/barn.png",
   "assets/crops/plant1.png", "assets/crops/plant2.png", "assets/crops/plant3.png"].forEach((p) => {
    const im = new Image();
    im.src = asset(p);
  });
  window.addEventListener("resize", render);
  (async () => {
    render();
    await initDb();
    render();
    setInterval(() => {
      const growing = Object.keys(state.tiles).filter(k => state.tiles[k].crop && state.tiles[k].readyAt);
      if (growing.length) render();
    }, 1000);
  })();
})();
