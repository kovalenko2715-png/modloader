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
    carrot: { name: "Морковь", seed: 5, sell: 14, growMs: 3 * 60000, unlockLevel: 0, img: "assets/crops/carrot.png" },
    radish: { name: "Редис",   seed: 12, sell: 32, growMs: 6 * 60000, unlockLevel: 1, img: "assets/crops/radish.png" },
    potato: { name: "Картофель", seed: 35, sell: 95, growMs: 12 * 60000, unlockLevel: 2, img: "assets/crops/potato.png" }
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
  const VER = "?v=6";
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
  hintEl.textContent = "Ферма v6";
  const size = () => LEVELS[state.level].size;

  function unlocked(i, j) {
    const r = (size() - 1) / 2;
    return Math.abs(i - r) <= r && Math.abs(j - r) <= r;
  }
  function cropUnlocked(key) {
    return (CROPS[key].unlockLevel || 0) <= state.level;
  }

  /* ---------- Рендер ---------- */
  const TW = 96, TH = 58;
  function render() {
    board.innerHTML = "";
    const n = size();
    const vw = sceneEl.clientWidth || window.innerWidth || 360;
    const cw = TW * (n + 1);
    const ch = 112 + 58 * (n - 1);
    const s = Math.min(1, (vw - 8) / cw);
    board.style.transform = "translate(" + (-(cw / 2) * s) + "px, " + (-(ch / 2) * s - 20) + "px) scale(" + s + ")";
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = (i - j) * (TW / 2);
        const y = (i + j) * (TH / 2);
        const el = document.createElement("div");
        el.className = "tile";
        el.dataset.i = i; el.dataset.j = j;
        el.style.left = (x + n * TW / 2) + "px";
        el.style.top = (y + 40) + "px";
        if (!unlocked(i, j)) {
          el.classList.add("locked");
          el.style.backgroundColor = "#33422a";
          el.style.backgroundImage = "url(" + asset("assets/tiles/grass2.png") + ")";
          el.style.filter = "brightness(0.55)";
        } else {
          const t = state.tiles[i + "." + j];
          const base = ((i + j) % 2 === 0) ? "assets/tiles/grass.png" : "assets/tiles/grass2.png";
          const bgImg = t ? (t.crop ? "assets/tiles/soil.png" : (t.soil ? "assets/tiles/soil2.png" : base)) : base;
          el.style.backgroundColor = (t && t.crop) ? "#6b4f3e" : "#4d7c3a";
          el.style.backgroundImage = "url(" + asset(bgImg) + ")";
          if (t && t.crop) attachCrop(el, t);
          if (t && !t.crop && t.soil) attachBadge(el, "+", 30, 50, "seed");
        }
        el.addEventListener("click", onTile);
        board.appendChild(el);
      }
    }
    const decor = [
      { img: "assets/decor/tree.png", x: n * TW + TW / 2 + 10, y: 70, w: 100, h: 125 },
      { img: "assets/decor/tree.png", x: -45, y: 40 + (n - 1) * TH / 2, w: 88, h: 110 },
      { img: "assets/decor/animal.png", x: n * TW / 2 + 40, y: 58 * (n - 1) + 48, w: 72, h: 90 }
    ];
    decor.forEach((dc) => {
      const dv = document.createElement("div");
      dv.className = "decor";
      dv.style.backgroundImage = "url(" + asset(dc.img) + ")";
      dv.style.left = dc.x + "px";
      dv.style.top = dc.y + "px";
      dv.style.width = dc.w + "px";
      dv.style.height = dc.h + "px";
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
    b.textContent = text;
    board.appendChild(b);
  }

  function attachCrop(el, t) {
    const d = CROPS[t.crop];
    const grown = t.readyAt && Date.now() >= t.readyAt;
    const img = document.createElement("div");
    img.className = "crop" + (grown ? " ready" : (t.watered ? " stage1" : ""));
    img.style.backgroundImage = "url(" + asset(grown ? d.img : "assets/crops/stage1.png") + ")";
    img.style.left = (parseFloat(el.style.left) + 16) + "px";
    img.style.top = (parseFloat(el.style.top) + 8) + "px";
    img.style.zIndex = 10;
    board.appendChild(img);
    if (grown) {
      attachBadge(el, "✋", 30, 50);
    } else {
      attachBadge(el, t.watered ? clockText(t.readyAt) : "💧", 24, 52, t.watered ? "clock" : "zzz");
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
  ["assets/tiles/grass.png", "assets/tiles/grass2.png", "assets/tiles/soil.png", "assets/tiles/soil2.png"].forEach((p) => {
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
