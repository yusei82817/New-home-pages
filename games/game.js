(() => {
  'use strict';
  const canvas = document.getElementById('arena');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const W = canvas.width, H = canvas.height, FLOOR = 414;
  const keys = new Set();
  const particles = [];
  let state = 'ready', lastTime = 0, elapsed = 0, timeLeft = 60, shake = 0, round = 1;
  let player, enemy, winnerText = '';

  const makeFighter = (x, side) => ({
    x, y: FLOOR, vx: 0, vy: 0, side, health: 100, facing: side === 'player' ? 1 : -1,
    grounded: true, crouching: false, blocking: false, attack: null, attackTimer: 0,
    hitFlash: 0, stun: 0, aiWait: .4, walk: 0
  });
  function resetMatch() {
    player = makeFighter(270, 'player');
    enemy = makeFighter(690, 'enemy');
    timeLeft = 60; elapsed = 0; winnerText = ''; state = 'playing';
    $('timer').textContent = '60'; $('round-number').textContent = String(round).padStart(2, '0');
    $('match-status').textContent = 'FIGHT!';
    $('arena-overlay').classList.add('hidden');
    updateBars();
  }
  function updateBars() {
    $('player-health').style.width = Math.max(0, player.health) + '%';
    $('enemy-health').style.width = Math.max(0, enemy.health) + '%';
  }
  function showOverlay(title, copy, button) {
    $('overlay-title').innerHTML = title;
    $('overlay-copy').textContent = copy;
    $('start-button').textContent = button;
    $('arena-overlay').classList.remove('hidden');
  }
  function start() { round = 1; resetMatch(); }
  function endMatch(text) {
    state = 'ended'; winnerText = text; $('match-status').textContent = 'RESULT';
    showOverlay(text === 'YOU WIN' ? 'VICTORY<br><span>ACHIEVED</span>' : text === 'DRAW' ? 'TIME<br><span>UP</span>' : 'MATCH<br><span>OVER</span>',
      text === 'YOU WIN' ? '見事な勝利。次のラウンドに備えよう。' : text === 'DRAW' ? '時間切れ。両者、譲らず。' : '相手に押し切られた。再戦で勝機をつかめ。',
      'REMATCH  ↻');
  }
  function attack(f, type) {
    if (state !== 'playing' || f.stun > 0 || f.attack || !f.grounded) return;
    f.attack = type; f.attackTimer = type === 'punch' ? .28 : .43;
  }
  function spawnImpact(x, y, color) {
    for (let i = 0; i < 13; i++) particles.push({x,y,vx:(Math.random()-.5)*250,vy:(Math.random()-.65)*220,life:.28+Math.random()*.22,color});
    shake = 5;
    $('hit-flash').classList.remove('active'); void $('hit-flash').offsetWidth; $('hit-flash').classList.add('active');
  }
  function tryHit(attacker, target) {
    if (!attacker.attack) return;
    const duration = attacker.attack === 'punch' ? .28 : .43;
    const progress = 1 - attacker.attackTimer / duration;
    if (progress < .35 || progress > .72 || attacker.attack.hit) return;
    const reach = attacker.attack === 'punch' ? 83 : 112;
    const distance = Math.abs(target.x - attacker.x);
    if (distance < reach && Math.abs(target.y - attacker.y) < 105) {
      attacker.attack.hit = true;
      const blocked = target.blocking && target.grounded && target.facing === -attacker.facing;
      const damage = blocked ? 3 : attacker.attack === 'punch' ? 8 : 13;
      target.health = Math.max(0, target.health - damage);
      target.stun = blocked ? .12 : .28;
      target.vx = attacker.facing * (blocked ? 65 : 180);
      if (!blocked) spawnImpact((attacker.x + target.x)/2, target.y - 65, attacker.side === 'player' ? '#d7bdff' : '#ff83ca');
      else spawnImpact(target.x, target.y - 55, '#8be9ff');
      updateBars();
      if (target.health <= 0) endMatch(attacker.side === 'player' ? 'YOU WIN' : 'CPU WINS');
    }
  }
  function updateFighter(f, dt) {
    if (f.stun > 0) f.stun -= dt;
    if (f.hitFlash > 0) f.hitFlash -= dt;
    if (f.attack) {
      f.attackTimer -= dt;
      if (f.attackTimer <= 0) f.attack = null;
    }
    f.vy += 1250 * dt; f.y += f.vy * dt;
    if (f.y >= FLOOR) { f.y = FLOOR; f.vy = 0; f.grounded = true; } else f.grounded = false;
    f.x += f.vx * dt; f.vx *= Math.pow(.001, dt);
    f.x = Math.max(58, Math.min(W-58, f.x));
    f.walk += Math.abs(f.vx) * dt * .035;
  }
  function playerInput() {
    if (state !== 'playing' || player.stun > 0) return;
    const left = keys.has('a'), right = keys.has('d');
    player.crouching = keys.has('s') && player.grounded;
    player.blocking = keys.has('l') || player.crouching;
    if (!player.attack) {
      player.vx = player.blocking ? 0 : (right ? 230 : 0) - (left ? 230 : 0);
      if (keys.has('w') && player.grounded) { player.vy = -510; player.grounded = false; }
      if (keys.has('j')) { attack(player, 'punch'); keys.delete('j'); }
      if (keys.has('k')) { attack(player, 'kick'); keys.delete('k'); }
    } else player.vx *= .2;
  }
  function cpuInput(dt) {
    if (state !== 'playing' || enemy.stun > 0) return;
    enemy.aiWait -= dt;
    const distance = Math.abs(player.x - enemy.x);
    enemy.facing = player.x < enemy.x ? -1 : 1;
    enemy.blocking = false; enemy.crouching = false;
    if (enemy.attack) return;
    if (enemy.aiWait <= 0) {
      if (distance > 145) { enemy.vx = (player.x < enemy.x ? -1 : 1) * 145; }
      else if (distance < 90 && Math.random() < .28) { enemy.blocking = true; enemy.aiWait = .35 + Math.random()*.35; }
      else { attack(enemy, Math.random() < .58 ? 'punch' : 'kick'); enemy.aiWait = .48 + Math.random()*.55; }
      if (distance > 210 && Math.random() < .18 && enemy.grounded) { enemy.vy = -460; enemy.grounded = false; }
    } else if (distance < 120 && Math.random() < .01) enemy.blocking = true;
  }
  function drawBackground() {
    const sky = ctx.createLinearGradient(0,0,0,H); sky.addColorStop(0,'#17162d'); sky.addColorStop(.65,'#292342'); sky.addColorStop(1,'#111321');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    for(let i=0;i<34;i++){const x=(i*137)%W,y=35+(i*71)%245;ctx.fillStyle='rgba(218,205,255,'+(.12+(i%4)*.035)+')';ctx.fillRect(x,y,2,2);}
    ctx.save();ctx.globalAlpha=.35;
    for(let i=0;i<8;i++){let x=i*145-30;ctx.fillStyle=i%2?'#4c3c70':'#37345f';ctx.beginPath();ctx.moveTo(x,FLOOR);ctx.lineTo(x+55,180+(i%3)*34);ctx.lineTo(x+120,FLOOR);ctx.fill();}
    ctx.restore();
    ctx.fillStyle='#171729';ctx.fillRect(0,FLOOR,W,H-FLOOR);
    ctx.strokeStyle='rgba(184,160,255,.16)';ctx.lineWidth=1;
    for(let i=0;i<=12;i++){let x=i*80;ctx.beginPath();ctx.moveTo(W/2,FLOOR);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=FLOOR+12;y<H;y+=19){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.fillStyle='rgba(199,176,255,.18)';ctx.fillRect(0,FLOOR-2,W,2);
    ctx.fillStyle='rgba(190,165,255,.08)';ctx.fillRect(0,FLOOR,W,5);
    ctx.font='700 11px sans-serif';ctx.fillStyle='rgba(222,210,255,.3)';ctx.fillText('V O I D   A R E N A',W/2-65,75);
  }
  function drawFighter(f) {
    const isP=f.side==='player', main=isP?'#bca0ff':'#ff83c8', dark=isP?'#6246a0':'#9d3d78', glow=isP?'rgba(185,148,255,.35)':'rgba(255,105,195,.32)';
    const crouch=f.crouching?14:0, bob=f.grounded?Math.sin(f.walk*2)*2:0, x=f.x, y=f.y+bob;
    ctx.save();ctx.translate(x,y);ctx.scale(f.facing,1);
    ctx.globalAlpha=.24;ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(0,3,48,9,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    if(f.hitFlash>0)ctx.globalAlpha=.5;
    // legs
    ctx.strokeStyle=dark;ctx.lineWidth=13;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-10,-43+crouch);ctx.lineTo(-16,-14);ctx.lineTo(-25+Math.sin(f.walk)*4,-3);ctx.stroke();
    ctx.beginPath();ctx.moveTo(10,-43+crouch);ctx.lineTo(17,-15);ctx.lineTo(25-Math.sin(f.walk)*4,-3);ctx.stroke();
    ctx.fillStyle=main;ctx.fillRect(-30,-7,18,6);ctx.fillRect(18,-7,17,6);
    // torso
    ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(-19,-94+crouch);ctx.lineTo(18,-94+crouch);ctx.lineTo(24,-48);ctx.lineTo(-21,-48);ctx.closePath();ctx.fill();
    ctx.fillStyle=main;ctx.fillRect(-13,-89+crouch,26,36);
    ctx.fillStyle='rgba(255,255,255,.65)';ctx.fillRect(-4,-86+crouch,3,28);
    // arms
    const punching=f.attack&&f.attack.type==='punch'&&f.attackTimer<.2;
    ctx.strokeStyle=main;ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(15,-83+crouch);ctx.lineTo(punching?55:27,-68+crouch);ctx.stroke();
    ctx.fillStyle='#f3eaff';ctx.beginPath();ctx.arc(punching?57:29,-68+crouch,7,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=dark;ctx.beginPath();ctx.moveTo(-15,-83+crouch);ctx.lineTo(-28,-64+crouch);ctx.stroke();
    // head and visor
    ctx.fillStyle=main;ctx.beginPath();ctx.arc(0,-111+crouch,16,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#171326';ctx.fillRect(2,-117+crouch,13,7);
    ctx.fillStyle=isP?'#e4d5ff':'#ffd0e9';ctx.fillRect(7,-115+crouch,6,2);
    // kick extension
    if(f.attack&&f.attack.type==='kick'&&f.attackTimer<.25){ctx.strokeStyle=main;ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(8,-43+crouch);ctx.lineTo(65,-28+crouch);ctx.stroke();}
    if(f.blocking){ctx.strokeStyle='rgba(125,226,255,.8)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-66,44,-1.2,1.2);ctx.stroke();}
    ctx.restore();
  }
  function drawParticles(dt) {
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=500*dt;if(p.life<=0){particles.splice(i,1);continue;}ctx.globalAlpha=Math.max(0,p.life*2.5);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}
    ctx.globalAlpha=1;
  }
  function render(dt) {
    ctx.save();if(shake>0){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake=Math.max(0,shake-dt*22);}
    drawBackground();
    const ordered=[player,enemy].sort((a,b)=>a.y-b.y);ordered.forEach(drawFighter);
    drawParticles(dt);
    ctx.restore();
  }
  function tick(now) {
    const dt=Math.min((now-lastTime)/1000||0,.033);lastTime=now;
    if(state==='playing'){
      elapsed+=dt;timeLeft=Math.max(0,60-Math.floor(elapsed));
      $('timer').textContent=String(timeLeft).padStart(2,'0');
      player.facing=player.x<enemy.x?1:-1;enemy.facing=enemy.x<player.x?1:-1;
      playerInput();cpuInput(dt);
      updateFighter(player,dt);updateFighter(enemy,dt);
      tryHit(player,enemy);tryHit(enemy,player);
      if(timeLeft<=0){endMatch(player.health===enemy.health?'DRAW':player.health>enemy.health?'YOU WIN':'CPU WINS');}
    }
    render(dt);requestAnimationFrame(tick);
  }
  function keyName(e){return e.key.toLowerCase();}
  window.addEventListener('keydown',e=>{
    const k=keyName(e);
    if(['arrowleft','arrowright','arrowup',' ','arrowdown'].includes(k))e.preventDefault();
    if(k==='enter'&&(state==='ready'||state==='ended')){start();return;}
    if(k==='escape'&&state==='playing'){state='paused';$('match-status').textContent='PAUSED';showOverlay('MATCH<br><span>PAUSED</span>','一時停止中。再開ボタンで戻れる。','RESUME  →');return;}
    if(k==='enter'&&state==='paused'){state='playing';$('arena-overlay').classList.add('hidden');$('match-status').textContent='FIGHT!';return;}
    if(['arrowleft','a'].includes(k))keys.add('a');
    if(['arrowright','d'].includes(k))keys.add('d');
    if(['arrowup','w',' '].includes(k))keys.add('w');
    if(['arrowdown','s'].includes(k))keys.add('s');
    if(k==='j'||k==='k'||k==='l')keys.add(k);
  });
  window.addEventListener('keyup',e=>{
    const k=keyName(e);
    if(['arrowleft','a'].includes(k))keys.delete('a');
    if(['arrowright','d'].includes(k))keys.delete('d');
    if(['arrowup','w',' '].includes(k))keys.delete('w');
    if(['arrowdown','s'].includes(k))keys.delete('s');
    keys.delete(k);
  });
  document.querySelectorAll('[data-key]').forEach(button=>{
    const k=button.dataset.key;
    const down=e=>{e.preventDefault();keys.add(k);};
    const up=e=>{e.preventDefault();keys.delete(k);};
    button.addEventListener('pointerdown',down);
    ['pointerup','pointercancel','pointerleave'].forEach(type=>button.addEventListener(type,up));
  });
  $('start-button').addEventListener('click',()=>{
    if(state==='paused'){state='playing';$('arena-overlay').classList.add('hidden');$('match-status').textContent='FIGHT!';}
    else start();
  });
  resetPreview();
  function resetPreview(){player=makeFighter(270,'player');enemy=makeFighter(690,'enemy');updateBars();}
  requestAnimationFrame(tick);
})();
