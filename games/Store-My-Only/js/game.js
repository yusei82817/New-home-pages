(() => {
  "use strict";

  // =========================================================
  // Store My Only - Game Core
  // Map data is intentionally left empty for the creator.
  // =========================================================

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const ui = {
    money: document.getElementById("money-value"),
    date: document.getElementById("date-value"),
    time: document.getElementById("time-value"),
    shopStatus: document.getElementById("shop-status"),
    shopDescription: document.getElementById("shop-description"),
    shopToggle: document.getElementById("shop-toggle"),
    message: document.getElementById("message-text"),
    panel: document.getElementById("interaction-panel"),
    panelTitle: document.getElementById("interaction-title"),
    panelDescription: document.getElementById("interaction-description"),
    closePanel: document.getElementById("close-panel")
  };

  const CONFIG = {
    saveKey: "store-my-only-save-v1",
    pixelsPerUnit: 56,
    moveSpeed: 3.2,
    startMoney: 1000,
    startHour: 8
  };

  const state = {
    player: { x: 2.5, y: 2.5 },
    camera: { x: 0, y: 0 },
    money: CONFIG.startMoney,
    year: 1,
    month: 1,
    day: 1,
    minutes: CONFIG.startHour * 60,
    isShopOpen: false,
    scene: "blacksmith",
    viewAngle: 0,
    targetViewAngle: 0,
    selectedShelf: -1,
    paused: false
  };

  const keys = new Set();
  let lastFrame = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;

  // ---------- Core / Canvas ----------
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvasWidth = rect.width;
    canvasHeight = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  // ---------- World ----------
  // 4の直後の半角スペースは長尺棚が占有する2マス目。
  const MAP_ROWS = [
    "2222220222222",
    "2111111111112",
    "2111111111112",
    "2111111111112",
    "2111111111112",
    "2111111111112",
    "2113334 4 4 2",
    "2222222222222"
  ];
  const shelves = [
    { x: 3, y: 6, length: 1, vertical: false },
    { x: 4, y: 6, length: 1, vertical: false },
    { x: 5, y: 6, length: 1, vertical: false },
    { x: 6, y: 6, length: 2, vertical: false },
    { x: 8, y: 6, length: 2, vertical: false },
    { x: 10, y: 6, length: 2, vertical: false }
  ];
  const MAP = MAP_ROWS.map((row) => [...row].map((code) => code === " " || code === "3" || code === "4" ? "1" : code));
  const TILE_W = CONFIG.pixelsPerUnit;
  const TILE_H = TILE_W / 2;
  const MAP_W = MAP[0].length;
  const MAP_H = MAP.length;

  function tileAt(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return "2";
    return MAP[ty][tx] || "2";
  }

  function isBlocked(x, y) {
    if (tileAt(x, y) === "2") return true;
    return shelves.some((shelf) => {
      const w = shelf.vertical ? 1 : shelf.length;
      const h = shelf.vertical ? shelf.length : 1;
      return x >= shelf.x && x < shelf.x + w && y >= shelf.y && y < shelf.y + h;
    });
  }

  function drawTileTop(x, y, fill, stroke, lift = 0) {
    const a = worldToScreen(x, y);
    const b = worldToScreen(x + 1, y);
    const c = worldToScreen(x + 1, y + 1);
    const d = worldToScreen(x, y + 1);
    [a, b, c, d].forEach((p) => { p.y -= lift; });

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();

    const shade = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
    shade.addColorStop(0, "rgba(255,255,255,.055)");
    shade.addColorStop(.5, "rgba(255,255,255,0)");
    shade.addColorStop(1, "rgba(0,0,0,.075)");
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.5;
    ctx.lineJoin = "round";
    ctx.stroke();
    return { a, b, c, d };
  }

  function drawMap() {
    ctx.fillStyle = "#24231f";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = MAP[y][x];
        const p = worldToScreen(x + 0.5, y + 0.5);
        if (tile === "2") {
          const h = CONFIG.pixelsPerUnit * 0.52;
          const base = [worldToScreen(x, y), worldToScreen(x + 1, y), worldToScreen(x + 1, y + 1), worldToScreen(x, y + 1)];
          const top = base.map((point) => ({ x: point.x, y: point.y - h }));
          ctx.beginPath();
          ctx.moveTo(top[3].x, top[3].y); ctx.lineTo(top[2].x, top[2].y);
          ctx.lineTo(base[2].x, base[2].y); ctx.lineTo(base[3].x, base[3].y);
          ctx.closePath(); ctx.fillStyle = "#484137"; ctx.fill();
          ctx.beginPath();
          ctx.moveTo(top[1].x, top[1].y); ctx.lineTo(top[2].x, top[2].y);
          ctx.lineTo(base[2].x, base[2].y); ctx.lineTo(base[1].x, base[1].y);
          ctx.closePath(); ctx.fillStyle = "#575044"; ctx.fill();
          drawTileTop(x, y, "#62594c", "rgba(190,174,148,.48)", h);
        } else if (tile === "3" || tile === "4") {
          drawTileTop(x, y, "#765438", "#bd9160");
          ctx.fillStyle = "#4a3020";
          ctx.fillRect(p.x - 14, p.y - 24, 28, 23);
          ctx.fillStyle = "#a8794b";
          ctx.fillRect(p.x - 12, p.y - 22, 24, 4);
          ctx.fillRect(p.x - 12, p.y - 10, 24, 3);
        } else {
          const floor = (x + y) % 2 ? "#797468" : "#7e796e";
          drawTileTop(x, y, tile === "0" ? "#9b805b" : floor, "rgba(205,194,173,.22)");
          if (tile === "0") {
            ctx.fillStyle = "#d4b47a";
            ctx.fillRect(p.x - 8, p.y - 7, 16, 14);
            ctx.fillStyle = "#493a2a";
            ctx.fillRect(p.x + 4, p.y - 1, 2, 2);
          }
        }
      }
    }
    drawShelves();
  }

  function drawShelves() {
    shelves.forEach((shelf, index) => {
      const w = shelf.vertical ? 1 : shelf.length;
      const h = shelf.vertical ? shelf.length : 1;
      const a = worldToScreen(shelf.x, shelf.y);
      const b = worldToScreen(shelf.x + w, shelf.y);
      const c = worldToScreen(shelf.x + w, shelf.y + h);
      const d = worldToScreen(shelf.x, shelf.y + h);
      const lift = 15;
      const selected = state.selectedShelf === index;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - lift); ctx.lineTo(b.x, b.y - lift);
      ctx.lineTo(c.x, c.y - lift); ctx.lineTo(d.x, d.y - lift); ctx.closePath();
      ctx.fillStyle = selected ? "#a87843" : "#765035";
      ctx.strokeStyle = selected ? "#ffe2a0" : "#b88758";
      ctx.lineWidth = selected ? 2 : 0.8;
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - lift); ctx.lineTo(c.x, c.y - lift);
      ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
      ctx.fillStyle = "#4a3020"; ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - lift); ctx.lineTo(c.x, c.y - lift);
      ctx.lineTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.closePath();
      ctx.fillStyle = "#5a3b27"; ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - lift); ctx.lineTo(b.x, b.y - lift);
      ctx.lineTo(c.x, c.y - lift); ctx.lineTo(d.x, d.y - lift);
      ctx.strokeStyle = "#c99a68"; ctx.lineWidth = 1.2; ctx.stroke();
    });
  }

  function rotateSelectedShelf() {
    const shelf = shelves[state.selectedShelf];
    if (!shelf || shelf.length !== 2) { setMessage("回転できる長尺棚を選択してください。"); return; }
    const nextX = shelf.x;
    const nextY = shelf.vertical ? shelf.y + 1 : shelf.y - 1;
    const nextW = shelf.vertical ? 2 : 1;
    const nextH = shelf.vertical ? 1 : 2;
    for (let y = nextY; y < nextY + nextH; y++) {
      for (let x = nextX; x < nextX + nextW; x++) {
        if (tileAt(x, y) === "2") { setMessage("壁があるため回転できません。"); return; }
        const occupied = shelves.some((other, i) => i !== state.selectedShelf && x >= other.x && x < other.x + (other.vertical ? 1 : other.length) && y >= other.y && y < other.y + (other.vertical ? other.length : 1));
        if (occupied) { setMessage("ほかの棚と重なるため回転できません。"); return; }
      }
    }
    shelf.x = nextX;
    shelf.y = nextY;
    shelf.vertical = !shelf.vertical;
    setMessage("長尺棚を90度回転しました。");
  }

  function worldToScreen(x, y) {
    const dx = x - state.camera.x, dy = y - state.camera.y;
    const cos = Math.cos(state.viewAngle), sin = Math.sin(state.viewAngle);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    const scale = CONFIG.pixelsPerUnit;
    return {
      x: canvasWidth / 2 + (rx - ry) * scale * 0.5,
      y: canvasHeight / 2 + (rx + ry) * scale * 0.25
    };
  }

  // ---------- Player ----------
  function updatePlayer(deltaSeconds) {
    if (state.paused) return;
    let dx = 0;
    let dy = 0;
    if (keys.has("w") || keys.has("arrowup")) dy -= 1;
    if (keys.has("s") || keys.has("arrowdown")) dy += 1;
    if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
    if (keys.has("d") || keys.has("arrowright")) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const screenDx = dx, screenDy = dy;
      const cos = Math.cos(state.viewAngle), sin = Math.sin(state.viewAngle);
      dx = screenDx * cos + screenDy * sin;
      dy = -screenDx * sin + screenDy * cos;
      const length = Math.hypot(dx, dy);
      const step = CONFIG.moveSpeed * deltaSeconds / length;
      const nextX = state.player.x + dx * step;
      const nextY = state.player.y + dy * step;
      const radius = 0.18;
      if (!isBlocked(nextX + Math.sign(dx) * radius, state.player.y)) state.player.x = nextX;
      if (!isBlocked(state.player.x, nextY + Math.sign(dy) * radius)) state.player.y = nextY;
    }

    // Camera follows the player. Map boundaries will be added with map data.
    state.camera.x += (state.player.x - state.camera.x) * Math.min(1, deltaSeconds * 8);
    state.camera.y += (state.player.y - state.camera.y) * Math.min(1, deltaSeconds * 8);
  }

  function drawPlayer() {
    const p = worldToScreen(state.player.x, state.player.y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(0, 8, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d9b879";
    ctx.strokeStyle = "#fff0c5";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 13);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ---------- Business ----------
  function toggleShop() {
    state.isShopOpen = !state.isShopOpen;
    updateUI();
    setMessage(state.isShopOpen ? "鍛冶屋の営業を開始した。" : "鍛冶屋を閉店した。");
  }

  // ---------- Time / UI ----------
  function updateGameTime(deltaSeconds) {
    if (state.paused) return;
    // Prototype clock: 1 real second = 1 in-game minute.
    state.minutes += deltaSeconds;
    while (state.minutes >= 24 * 60) {
      state.minutes -= 24 * 60;
      state.day += 1;
      if (state.day > 30) {
        state.day = 1;
        state.month += 1;
        if (state.month > 12) {
          state.month = 1;
          state.year += 1;
        }
      }
    }
  }

  function updateUI() {
    const hours = Math.floor(state.minutes / 60);
    const minutes = Math.floor(state.minutes % 60);
    ui.money.textContent = Math.floor(state.money).toLocaleString("ja-JP") + " G";
    ui.date.textContent = state.year + "年 " + state.month + "月 " + state.day + "日";
    ui.time.textContent = String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
    ui.shopStatus.textContent = state.isShopOpen ? "営業中" : "準備中";
    ui.shopDescription.textContent = state.isShopOpen ? "お客様を迎える準備ができています。" : "開店準備を整えよう。";
    ui.shopToggle.textContent = state.isShopOpen ? "閉店する" : "営業開始";
  }

  function setMessage(message) {
    ui.message.textContent = message;
  }

  function openInteraction() {
    state.paused = true;
    ui.panelTitle.textContent = "鍛冶屋";
    ui.panelDescription.textContent = "廃れた鍜治場の初期店舗です。棚や設備の商品データは今後接続します。";
    ui.panel.hidden = false;
  }

  function closeInteraction() {
    ui.panel.hidden = true;
    state.paused = false;
  }

  // ---------- Save / Load ----------
  function saveGame() {
    const payload = {
      player: state.player,
      money: state.money,
      year: state.year,
      month: state.month,
      day: state.day,
      minutes: state.minutes,
      isShopOpen: state.isShopOpen
    };
    try {
      localStorage.setItem(CONFIG.saveKey, JSON.stringify(payload));
      setMessage("セーブしました。");
    } catch (error) {
      console.error("Save failed:", error);
      setMessage("セーブできませんでした。");
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(CONFIG.saveKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.player && Number.isFinite(saved.player.x) && Number.isFinite(saved.player.y)) {
        state.player = saved.player;
      }
      for (const key of ["money", "year", "month", "day", "minutes"]) {
        if (Number.isFinite(saved[key])) state[key] = saved[key];
      }
      if (typeof saved.isShopOpen === "boolean") state.isShopOpen = saved.isShopOpen;
      state.camera.x = state.player.x;
      state.camera.y = state.player.y;
    } catch (error) {
      console.warn("Save data could not be loaded:", error);
    }
  }

  // ---------- Input ----------
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    keys.add(key);
    if (event.repeat) return;
    if (key === "q") state.targetViewAngle -= Math.PI / 2;
    if (key === "e") state.targetViewAngle += Math.PI / 2;
    if (key === "f" && ui.panel.hidden) openInteraction();
    if (key === "r") rotateSelectedShelf();
    if (key === "escape" && !ui.panel.hidden) closeInteraction();
    if (key === "f5") {
      event.preventDefault();
      saveGame();
    }
  });

  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left, my = event.clientY - rect.top;
    let found = -1, best = 38;
    shelves.forEach((shelf, index) => {
      const w = shelf.vertical ? 1 : shelf.length, h = shelf.vertical ? shelf.length : 1;
      const p = worldToScreen(shelf.x + w / 2, shelf.y + h / 2);
      const d = Math.hypot(mx - p.x, my - p.y);
      if (d < best) { best = d; found = index; }
    });
    state.selectedShelf = found;
    if (found >= 0) setMessage("棚を選択中。長尺棚はRキーで90度回転。");
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());
  ui.shopToggle.addEventListener("click", toggleShop);
  ui.closePanel.addEventListener("click", closeInteraction);
  window.addEventListener("resize", resizeCanvas);

  // ---------- Main Loop ----------
  function frame(timestamp) {
    const deltaSeconds = Math.min((timestamp - lastFrame) / 1000 || 0, 0.05);
    lastFrame = timestamp;
    state.viewAngle += (state.targetViewAngle - state.viewAngle) * Math.min(1, deltaSeconds * 7.5);
    updatePlayer(deltaSeconds);
    updateGameTime(deltaSeconds);
    drawMap();
    drawPlayer();
    updateUI();
    requestAnimationFrame(frame);
  }

  loadGame();
  resizeCanvas();
  updateUI();
  requestAnimationFrame(frame);
})();
