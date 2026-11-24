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
    pixelsPerUnit: 48,
    moveSpeed: 3.2,
    startMoney: 1000,
    startHour: 8
  };

  const state = {
    player: { x: 0, y: 0 },
    camera: { x: 0, y: 0 },
    money: CONFIG.startMoney,
    year: 1,
    month: 1,
    day: 1,
    minutes: CONFIG.startHour * 60,
    isShopOpen: false,
    scene: "blacksmith",
    paused: false
  };

  const keys = new Set();
  let lastFrame = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;

  // ---------- Core / Canvas ----------
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = rect.width;
    canvasHeight = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- World ----------
  function drawMap() {
    // TODO: ここに制作者が作成するマップデータの描画処理を接続する。
    // マップのタイル、地形、建物、当たり判定はまだ定義しない。
    ctx.fillStyle = "#34342d";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  function worldToScreen(x, y) {
    // 2.5D斜め見下ろし用の簡易座標変換。
    const scale = CONFIG.pixelsPerUnit;
    return {
      x: canvasWidth / 2 + (x - state.camera.x - y + state.camera.y) * scale * 0.5,
      y: canvasHeight / 2 + (x - state.camera.x + y - state.camera.y) * scale * 0.25
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
      const length = Math.hypot(dx, dy);
      const step = CONFIG.moveSpeed * deltaSeconds / length;
      state.player.x += dx * step;
      state.player.y += dy * step;
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
    ui.panelDescription.textContent = "店舗・設備・商品データは今後接続します。マップと建物の配置は未設定です。";
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
    if (key === "e" && ui.panel.hidden) openInteraction();
    if (key === "escape" && !ui.panel.hidden) closeInteraction();
    if (key === "f5") {
      event.preventDefault();
      saveGame();
    }
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
