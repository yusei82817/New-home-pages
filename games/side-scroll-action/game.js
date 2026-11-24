(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const coinLabel = document.getElementById('coin-count');
  const timerLabel = document.getElementById('timer');
  const statusLabel = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const startButton = document.getElementById('start-button');

  const worldWidth = 5200;
  const platforms = [
    {x:0,y:450,w:760,h:120},{x:850,y:450,w:430,h:120},{x:1370,y:410,w:310,h:160},
    {x:1770,y:450,w:530,h:120},{x:2400,y:390,w:300,h:180},{x:2800,y:450,w:500,h:120},
    {x:3390,y:410,w:350,h:160},{x:3830,y:450,w:480,h:120},{x:4400,y:400,w:300,h:170},
    {x:4790,y:450,w:410,h:120},
    {x:360,y:350,w:170,h:18},{x:980,y:340,w:150,h:18},{x:1490,y:300,w:140,h:18},
    {x:1940,y:345,w:150,h:18},{x:2500,y:280,w:140,h:18},{x:2940,y:340,w:150,h:18},
    {x:3500,y:300,w:140,h:18},{x:3970,y:340,w:160,h:18},{x:4500,y:290,w:130,h:18}
  ];
  const hazards = [
    {x:610,y:426,w:72,h:24},{x:1070,y:426,w:65,h:24},{x:1570,y:386,w:65,h:24},
    {x:2050,y:426,w:85,h:24},{x:2580,y:366,w:65,h:24},{x:3000,y:426,w:85,h:24},
    {x:3590,y:386,w:65,h:24},{x:4020,y:426,w:85,h:24},{x:4540,y:376,w:65,h:24}
  ];
  const coinSpots = [];
  for (let i=0;i<12;i++) coinSpots.push({x:220+i*405,y:[390,300,390,350,330,260,390,280,330,390,260,350][i],taken:false});
  const keys = new Set();
  let player, camera, coins, elapsed, state, lastTime, particles;

  function reset(){
    player={x:75,y:380,w:28,h:42,vx:0,vy:0,onGround:false,face:1,invuln:0};
    camera=0;coins=0;elapsed=0;particles=[];state='ready';
    updateHud();draw();
  }
  function updateHud(){
    coinLabel.innerHTML=coins+' <i>/ 12</i>';
    timerLabel.textContent=String(Math.floor(elapsed)).padStart(3,'0');
    statusLabel.textContent=state==='playing'?'PLAYING':state==='won'?'CLEAR':state==='dead'?'RETRY':'READY';
  }
  function start(){
    if(state==='won') reset();
    state='playing';overlay.classList.add('hidden');updateHud();
  }
  function showOverlay(title, message, button){
    overlayTitle.innerHTML=title;overlayText.textContent=message;startButton.textContent=button+' →';
    overlay.classList.remove('hidden');
  }
  function rects(a,b){return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;}
  function burst(x,y,color){
    for(let i=0;i<12;i++)particles.push({x,y,vx:(Math.random()-.5)*190,vy:(Math.random()-.7)*170,life:.55,color});
  }
  function respawn(){
    burst(player.x+player.w/2,player.y+player.h/2,'#ff8a78');
    player.x=75;player.y=380;player.vx=0;player.vy=0;player.invuln=1.2;camera=0;
    state='playing';updateHud();
  }
  function update(dt){
    if(state!=='playing')return;
    elapsed+=dt;
    const left=keys.has('ArrowLeft'),right=keys.has('ArrowRight');
    const accel=1900, maxSpeed=310;
    if(left){player.vx-=accel*dt;player.face=-1}
    if(right){player.vx+=accel*dt;player.face=1}
    if(!left&&!right)player.vx*=Math.pow(.0008,dt);
    player.vx=Math.max(-maxSpeed,Math.min(maxSpeed,player.vx));
    const oldY=player.y;
    player.x+=player.vx*dt;
    player.x=Math.max(0,Math.min(worldWidth-player.w,player.x));
    player.vy=Math.min(900,player.vy+1900*dt);
    player.y+=player.vy*dt;
    player.onGround=false;
    for(const p of platforms){
      if(player.vy>=0 && oldY+player.h<=p.y+5 && player.y+player.h>=p.y && player.x+player.w>p.x && player.x<p.x+p.w){
        player.y=p.y-player.h;player.vy=0;player.onGround=true;
      }
    }
    if(player.y>H+150){respawn();return}
    if(player.invuln>0)player.invuln-=dt;
    for(const h of hazards){
      const hit={x:h.x+5,y:h.y+7,w:h.w-10,h:h.h-7};
      if(player.invuln<=0 && rects(player,hit)){respawn();return}
    }
    for(const c of coinSpots){
      if(c.taken)continue;
      if(rects(player,{x:c.x-11,y:c.y-11,w:22,h:22})){c.taken=true;coins++;burst(c.x,c.y,'#ffdf83')}
    }
    if(player.x>worldWidth-145){state='won';updateHud();showOverlay('STAGE <em>CLEAR!</em>','ゴール到達！ コイン '+coins+' / 12 枚を集めた。','PLAY AGAIN');return}
    const target=Math.max(0,Math.min(worldWidth-W,player.x-W*.36));
    camera+=(target-camera)*Math.min(1,dt*5.5);
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;p.life-=dt}
    particles=particles.filter(p=>p.life>0);
    updateHud();
  }
  function rounded(x,y,w,h,r,color){
    ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
  }
  function drawBackground(){
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#83cbdc');sky.addColorStop(1,'#d4e8c8');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#ffe8a6';ctx.beginPath();ctx.arc(760-camera*.08,105,43,0,Math.PI*2);ctx.fill();
    for(let layer=0;layer<3;layer++){
      const speed=[.12,.23,.4][layer],base=[330,370,420][layer],color=['#a5d3c0','#78b69e','#548f7e'][layer];
      ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,H);
      for(let x=-100;x<=W+150;x+=150){const wx=x+(camera*speed%300);ctx.lineTo(x,base+Math.sin((x+camera*speed)*.006+layer)*28);ctx.lineTo(x+75,base-55-layer*12);ctx.lineTo(x+150,base+Math.sin((x+150+camera*speed)*.006+layer)*28)}
      ctx.lineTo(W,H);ctx.closePath();ctx.fill();
    }
    ctx.fillStyle='#ffffff55';
    for(let i=0;i<7;i++){const x=((i*190-camera*.18)%(W+150)+W+150)%(W+150)-60;const y=75+(i%3)*55;ctx.beginPath();ctx.ellipse(x,y,32,8,0,0,Math.PI*2);ctx.ellipse(x+22,y-7,22,10,0,0,Math.PI*2);ctx.fill()}
  }
  function drawWorld(){
    for(const p of platforms){
      const x=p.x-camera;if(x+p.w<0||x>W)continue;
      ctx.fillStyle='#315b4c';ctx.fillRect(x,p.y,p.w,p.h);
      ctx.fillStyle='#5d9a67';ctx.fillRect(x,p.y,p.w,9);
      ctx.fillStyle='#83c477';ctx.fillRect(x,p.y,p.w,4);
      ctx.fillStyle='#ffffff12';
      for(let n=18;n<p.w;n+=38)ctx.fillRect(x+n,p.y+24,3,3);
    }
    for(const h of hazards){
      const x=h.x-camera;if(x+h.w<0||x>W)continue;
      ctx.fillStyle='#df766b';ctx.beginPath();
      const count=Math.max(2,Math.floor(h.w/18)),step=h.w/count;
      for(let i=0;i<count;i++){ctx.moveTo(x+i*step,h.y+h.h);ctx.lineTo(x+i*step+step/2,h.y);ctx.lineTo(x+(i+1)*step,h.y+h.h)}
      ctx.fill();
      ctx.fillStyle='#a94e50';ctx.fillRect(x,h.y+h.h-3,h.w,3);
    }
    for(const c of coinSpots){
      if(c.taken)continue;const x=c.x-camera;if(x<-20||x>W+20)continue;
      ctx.fillStyle='#f5c85f';ctx.beginPath();ctx.ellipse(x,c.y,8,11,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#fff0b0';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#fff2bb';ctx.fillRect(x-1,c.y-6,2,12);
    }
    const flagX=worldWidth-110-camera;
    ctx.fillStyle='#f1f4e9';ctx.fillRect(flagX,300,5,150);
    ctx.fillStyle='#f0a36f';ctx.beginPath();ctx.moveTo(flagX+5,302);ctx.lineTo(flagX+70,322);ctx.lineTo(flagX+5,344);ctx.closePath();ctx.fill();
    ctx.fillStyle='#315b4c';ctx.fillRect(flagX-12,447,30,4);
  }
  function drawPlayer(){
    if(player.invuln>0 && Math.floor(performance.now()/80)%2===0)return;
    const x=player.x-camera,y=player.y;
    ctx.save();ctx.translate(x+player.w/2,y+player.h/2);ctx.scale(player.face,1);
    rounded(-11,-16,22,27,7,'#f2a56f');
    rounded(-10,-22,20,15,6,'#24364d');
    ctx.fillStyle='#fff';ctx.fillRect(2,-17,4,4);
    rounded(-12,8,10,10,3,'#26394e');rounded(2,8,10,10,3,'#26394e');
    ctx.fillStyle='#f7d7aa';ctx.fillRect(-5,-3,11,4);
    ctx.restore();
  }
  function draw(){
    drawBackground();ctx.save();drawWorld();drawPlayer();
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.55);ctx.fillStyle=p.color;ctx.fillRect(p.x-camera,p.y,4,4)}
    ctx.globalAlpha=1;ctx.restore();
    if(state==='ready'){ctx.fillStyle='#18324b';ctx.font='700 14px sans-serif';ctx.fillText('PRESS START TO BEGIN',W/2-83, H-28)}
  }
  function loop(time){
    const dt=Math.min((time-lastTime)/1000||0,.033);lastTime=time;
    update(dt);draw();requestAnimationFrame(loop);
  }
  document.addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
    keys.add(e.code);
    if(e.code==='Space'&&!e.repeat&&state==='playing'&&player.onGround){player.vy=-690;player.onGround=false}
    if(e.code==='KeyR'){reset();start()}
    if(e.code==='Enter'&&(state==='ready'||state==='won'))start();
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>keys.clear());
  startButton.addEventListener('click',start);
  document.getElementById('restart-button').addEventListener('click',()=>{reset();start()});
  reset();requestAnimationFrame(t=>{lastTime=t;loop(t)});
})();