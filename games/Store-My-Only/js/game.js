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
    startMoney: 1000,
    startHour: 8
  };

  const state = {
    camera: { x: 12.5, y: 8.5 },
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
  // Expanded L-shaped shop: exactly 288 walkable/building tiles before the doorway cut-out.
  const SHOP_W = 26, SHOP_H = 18;
  function insideShop(x, y) {
    return (x >= 1 && x <= 24 && y >= 1 && y <= 8) ||
           (x >= 1 && x <= 12 && y >= 9 && y <= 16);
  }
  const MAP = Array.from({ length: SHOP_H }, (_, y) =>
    Array.from({ length: SHOP_W }, (_, x) => {
      if (!insideShop(x, y)) return null;
      return (!insideShop(x - 1, y) || !insideShop(x + 1, y) ||
              !insideShop(x, y - 1) || !insideShop(x, y + 1)) ? "2" : "1";
    })
  );

  // Main entrance: a two-tile opening on the south-facing wall.
  MAP[16][5] = "1";
  MAP[16][6] = "1";

  const shelves = [
    { x: 3, y: 3, length: 3, vertical: false },
    { x: 8, y: 3, length: 3, vertical: false },
    { x: 14, y: 3, length: 3, vertical: false },
    { x: 19, y: 3, length: 3, vertical: false },
    { x: 3, y: 6, length: 2, vertical: false },
    { x: 8, y: 6, length: 2, vertical: false },
    { x: 14, y: 6, length: 2, vertical: false },
    { x: 19, y: 6, length: 2, vertical: false },
    { x: 3, y: 11, length: 3, vertical: true },
    { x: 7, y: 12, length: 3, vertical: true },
    { x: 3, y: 15, length: 2, vertical: false }
  ];
  const MAP_W = SHOP_W, MAP_H = SHOP_H;

    function tileAt(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return null;
    return MAP[ty][tx];
  }

  function isBlocked(x, y) {
    if (tileAt(x, y) !== "1") return true;
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

  function cameraDepth(x, y) {
    const dx = x - state.camera.x, dy = y - state.camera.y;
    const cos = Math.cos(state.viewAngle), sin = Math.sin(state.viewAngle);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return rx + ry;
  }

  function drawMap() {
    const backdrop = ctx.createRadialGradient(canvasWidth * .52, canvasHeight * .42, 30, canvasWidth * .5, canvasHeight * .5, Math.max(canvasWidth, canvasHeight) * .78);
    backdrop.addColorStop(0, "#49443a");
    backdrop.addColorStop(.58, "#292720");
    backdrop.addColorStop(1, "#11110f");
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const floors = [];
    const walls = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = MAP[y][x];
        if (tile === "1" || tile === "0" || tile === "3" || tile === "4") {
          floors.push({x,y,tile,depth:cameraDepth(x+.5,y+.5)});
        }
        if (tile === "2") {
          const edges = [
            {a:[x,y],b:[x+1,y],nx:0,ny:-1,color:"#655b4c"},
            {a:[x+1,y],b:[x+1,y+1],nx:1,ny:0,color:"#51483c"},
            {a:[x+1,y+1],b:[x,y+1],nx:0,ny:1,color:"#494136"},
            {a:[x,y+1],b:[x,y],nx:-1,ny:0,color:"#5a5043"}
          ];
          for (const edge of edges) {
            if (tileAt(x+edge.nx+.5,y+edge.ny+.5) !== null) continue;
            const mx=(edge.a[0]+edge.b[0])/2, my=(edge.a[1]+edge.b[1])/2;
            const centerDepth=cameraDepth(x+.5,y+.5);
            if (cameraDepth(mx,my) < centerDepth) continue;
            walls.push({...edge,x,y,depth:cameraDepth(mx,my)});
          }
        }
      }
    }

    floors.sort((a,b)=>a.depth-b.depth || a.y-b.y || a.x-b.x);
    for (const item of floors) {
      const {x,y,tile}=item;
      const p=worldToScreen(x+.5,y+.5);
      if (tile==="3" || tile==="4") {
        drawTileTop(x,y,"#765438","#bd9160");
        ctx.fillStyle="#4a3020";
        ctx.fillRect(p.x-14,p.y-24,28,23);
        ctx.fillStyle="#a8794b";
        ctx.fillRect(p.x-12,p.y-22,24,4);
        ctx.fillRect(p.x-12,p.y-10,24,3);
      } else {
        const floor=(x+y)%2?"#797468":"#7e796e";
        drawTileTop(x,y,tile==="0"?"#9b805b":floor,"rgba(205,194,173,.28)");
        if(tile!=="0") {
          const inset=.12;
          const pts=[
            worldToScreen(x+inset,y+inset),
            worldToScreen(x+1-inset,y+inset),
            worldToScreen(x+1-inset,y+1-inset),
            worldToScreen(x+inset,y+1-inset)
          ];
          ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
          pts.slice(1).forEach(q=>ctx.lineTo(q.x,q.y));ctx.closePath();
          ctx.strokeStyle="rgba(35,31,25,.10)";ctx.lineWidth=.65;ctx.stroke();
        }
        if(tile==="0") {
          ctx.fillStyle="#d4b47a";ctx.fillRect(p.x-8,p.y-7,16,14);
          ctx.fillStyle="#493a2a";ctx.fillRect(p.x+4,p.y-1,2,2);
        }
      }
    }

    // Walls are continuous vertical planes along the shop perimeter, not stacked cubes.
    walls.sort((a,b)=>a.depth-b.depth);
    const wallHeight=CONFIG.pixelsPerUnit*1.65;
    for(const wall of walls) {
      const a=worldToScreen(wall.a[0],wall.a[1]);
      const b=worldToScreen(wall.b[0],wall.b[1]);
      ctx.beginPath();
      ctx.moveTo(a.x,a.y-wallHeight);
      ctx.lineTo(b.x,b.y-wallHeight);
      ctx.lineTo(b.x,b.y);
      ctx.lineTo(a.x,a.y);
      ctx.closePath();
      ctx.fillStyle=wall.color;
      ctx.fill();
      ctx.strokeStyle="rgba(224,202,164,.24)";
      ctx.lineWidth=.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.x,a.y-wallHeight);
      ctx.lineTo(b.x,b.y-wallHeight);
      ctx.strokeStyle="rgba(255,229,184,.48)";
      ctx.lineWidth=1.4;
      ctx.stroke();
    }

    drawShelves();
    const light=ctx.createRadialGradient(canvasWidth*.52,canvasHeight*.48,12,canvasWidth*.52,canvasHeight*.48,Math.max(canvasWidth,canvasHeight)*.58);
    light.addColorStop(0,"rgba(255,205,125,.075)");
    light.addColorStop(.55,"rgba(255,178,92,.025)");
    light.addColorStop(1,"rgba(0,0,0,.28)");
    ctx.fillStyle=light;ctx.fillRect(0,0,canvasWidth,canvasHeight);
  }

  function drawShelves() {
    const ordered = shelves.map((shelf, index) => ({ shelf, index }))
      .sort((a, b) => cameraDepth(a.shelf.x + (a.shelf.vertical ? .5 : a.shelf.length / 2), a.shelf.y + (a.shelf.vertical ? a.shelf.length / 2 : .5)) -
                     cameraDepth(b.shelf.x + (b.shelf.vertical ? .5 : b.shelf.length / 2), b.shelf.y + (b.shelf.vertical ? b.shelf.length / 2 : .5)));
    ordered.forEach(({ shelf, index }) => {
      const w = shelf.vertical ? 1 : shelf.length, h = shelf.vertical ? shelf.length : 1;
      const a = worldToScreen(shelf.x, shelf.y), b = worldToScreen(shelf.x + w, shelf.y);
      const c = worldToScreen(shelf.x + w, shelf.y + h), d = worldToScreen(shelf.x, shelf.y + h);
      const lift = 15, selected = state.selectedShelf === index;
      const top = [a, b, c, d].map(p => ({ x: p.x, y: p.y - lift }));
      ctx.save();
      ctx.globalAlpha = .22;
      ctx.filter = "blur(5px)";
      ctx.beginPath();
      ctx.moveTo(a.x + 3, a.y + 4); ctx.lineTo(b.x + 3, b.y + 4);
      ctx.lineTo(c.x + 3, c.y + 4); ctx.lineTo(d.x + 3, d.y + 4);
      ctx.closePath();
      ctx.fillStyle = "#080604";
      ctx.fill();
      ctx.restore();
      // Draw all four vertical shelf sides before the tabletop.
      const sideFaces = [
        {points:[a,b], color:"#65452d"},
        {points:[b,c], color:"#5a3b27"},
        {points:[c,d], color:"#493020"},
        {points:[d,a], color:"#765237"}
      ];
      for (const face of sideFaces) {
        ctx.beginPath();
        ctx.moveTo(face.points[0].x,face.points[0].y-lift);
        ctx.lineTo(face.points[1].x,face.points[1].y-lift);
        ctx.lineTo(face.points[1].x,face.points[1].y);
        ctx.lineTo(face.points[0].x,face.points[0].y);
        ctx.closePath();
        ctx.fillStyle=face.color;ctx.fill();
        ctx.strokeStyle="#b88758";ctx.lineWidth=.8;ctx.stroke();
      }
      // Fill the entire tabletop after its sides, then outline it.
      ctx.beginPath(); ctx.moveTo(top[0].x,top[0].y); top.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.closePath();
      ctx.fillStyle=selected?"#a87843":"#765035"; ctx.fill();
      ctx.strokeStyle=selected?"#ffe2a0":"#c99a68"; ctx.lineWidth=selected?2:1; ctx.stroke();
      ctx.save();
      ctx.beginPath(); ctx.moveTo(top[0].x,top[0].y); top.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.closePath(); ctx.clip();
      ctx.strokeStyle = "rgba(239,190,126,.19)";
      ctx.lineWidth = .8;
      for (let g = 1; g <= 3; g++) {
        const t = g / 4;
        const p1 = {x:top[0].x+(top[3].x-top[0].x)*t,y:top[0].y+(top[3].y-top[0].y)*t};
        const p2 = {x:top[1].x+(top[2].x-top[1].x)*t,y:top[1].y+(top[2].y-top[1].y)*t};
        ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
      }
      ctx.restore();
      if (shelf.length > 1) {
        ctx.strokeStyle="rgba(35,22,13,.38)"; ctx.lineWidth=.7;
        for(let n=1;n<shelf.length;n++){
          const t=n/shelf.length;
          const p1={x:top[0].x+(top[1].x-top[0].x)*t,y:top[0].y+(top[1].y-top[0].y)*t};
          const p2={x:top[3].x+(top[2].x-top[3].x)*t,y:top[3].y+(top[2].y-top[3].y)*t};
          ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();
        }
      }
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
        if (tileAt(x, y) !== "1") { setMessage("壁または店舗の外側のため回転できません。"); return; }
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

  // The shopkeeper does not have free movement in this management view.

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
      for (const key of ["money", "year", "month", "day", "minutes"]) {
        if (Number.isFinite(saved[key])) state[key] = saved[key];
      }
      if (typeof saved.isShopOpen === "boolean") state.isShopOpen = saved.isShopOpen;
    } catch (error) {
      console.warn("Save data could not be loaded:", error);
    }
  }

  // ---------- Input ----------
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    if (event.repeat) return;
    if (key === "q") state.targetViewAngle -= Math.PI / 36;
    if (key === "e") state.targetViewAngle += Math.PI / 36;
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
  ui.shopToggle.addEventListener("click", toggleShop);
  ui.closePanel.addEventListener("click", closeInteraction);
  window.addEventListener("resize", resizeCanvas);

  // ---------- Main Loop ----------
  function frame(timestamp) {
    const deltaSeconds = Math.min((timestamp - lastFrame) / 1000 || 0, 0.05);
    lastFrame = timestamp;
    const rotationDelta = state.targetViewAngle - state.viewAngle;
    state.viewAngle += rotationDelta * (1 - Math.exp(-deltaSeconds * 10));
    if (Math.abs(rotationDelta) < 0.0005) state.viewAngle = state.targetViewAngle;
    updateGameTime(deltaSeconds);
    drawMap();
    updateUI();
    requestAnimationFrame(frame);
  }

  loadGame();
  resizeCanvas();
  updateUI();
  requestAnimationFrame(frame);
})();
