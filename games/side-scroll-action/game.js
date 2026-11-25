(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const playerSprite = new Image();
  playerSprite.src = 'SD_dot.png';
  const W = canvas.width, H = canvas.height;
  const coinLabel = document.getElementById('coin-count');
  const timerLabel = document.getElementById('timer');
  const statusLabel = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const startButton = document.getElementById('start-button');

  const worldWidth = 8500;
  const platforms = [
    {x:0,y:450,w:760,h:120},{x:850,y:450,w:430,h:120},{x:1370,y:410,w:310,h:160},
    {x:1770,y:450,w:530,h:120},{x:2400,y:390,w:300,h:180},{x:2800,y:450,w:500,h:120},
    {x:3390,y:410,w:350,h:160},{x:3830,y:450,w:480,h:120},{x:4400,y:400,w:300,h:170},
    {x:4790,y:450,w:410,h:120},
    {x:5300,y:450,w:420,h:120},{x:5810,y:405,w:330,h:165},{x:6230,y:450,w:520,h:120},
    {x:6850,y:390,w:330,h:180},{x:7270,y:450,w:520,h:120},{x:7890,y:420,w:610,h:150},
    {x:360,y:350,w:170,h:18},{x:980,y:340,w:150,h:18},{x:1490,y:300,w:140,h:18},
    {x:1940,y:345,w:150,h:18},{x:2500,y:280,w:140,h:18},{x:2940,y:340,w:150,h:18},
    {x:3500,y:300,w:140,h:18},{x:3970,y:340,w:160,h:18},{x:4500,y:290,w:130,h:18},
    {x:5410,y:340,w:150,h:18},{x:5900,y:295,w:150,h:18},{x:6410,y:340,w:160,h:18},
    {x:6950,y:275,w:150,h:18},{x:7410,y:335,w:160,h:18},{x:8010,y:315,w:150,h:18}
  ];
  const hazards = [
    {x:610,y:426,w:72,h:24},{x:1070,y:426,w:65,h:24},{x:1570,y:386,w:65,h:24},
    {x:2050,y:426,w:85,h:24},{x:2580,y:366,w:65,h:24},{x:3000,y:426,w:85,h:24},
    {x:3590,y:386,w:65,h:24},{x:4020,y:426,w:85,h:24},{x:4540,y:376,w:65,h:24},{x:5520,y:426,w:75,h:24},{x:6030,y:381,w:70,h:24},
    {x:6500,y:426,w:95,h:24},{x:7050,y:361,w:75,h:24},{x:7560,y:426,w:90,h:24},{x:8150,y:396,w:80,h:24}
  ];
  const coinSpots = [];
  const coinHeights = [390,300,390,350,330,260,390,280,330,390,260,350,390,300,390,280,330,260,390,300];
  for (let i=0;i<20;i++) coinSpots.push({x:220+i*410,y:coinHeights[i],taken:false});
  const gravePlatforms = [];
  const keys = new Set();
  let player, camera, coins, elapsed, state, lastTime, particles;
  const backgroundAI = {x:75,y:408,vx:165,vy:0,w:28,h:42,onGround:false,face:1,jumpCooldown:0};
  let backgroundClock=0;

  function reset(){
    player={x:75,y:380,w:28,h:42,vx:0,vy:0,onGround:false,face:1,invuln:0,moveStart:0,wasMoving:false};
    camera=0;coins=0;elapsed=0;particles=[];gravePlatforms.length=0;state='ready';coinSpots.forEach(c=>c.taken=false);
    updateHud();draw();
  }
  function updateHud(){
    coinLabel.innerHTML=coins+' <i>/ 20</i>';
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
    const deathX=player.x+player.w/2;
    const deathBase=Math.max(365,Math.min(480,player.y+player.h));
    // A fallen hero leaves behind a permanent, climbable gravestone.
    gravePlatforms.push({x:deathX-25,y:deathBase-42,w:50,h:10,baseY:deathBase});
    burst(deathX,player.y+player.h/2,'#ff8a78');
    burst(deathX,deathBase-34,'#d7e0d0');
    player.x=75;player.y=380;player.vx=0;player.vy=0;player.invuln=1.2;camera=0;
    state='playing';updateHud();
  }
  function updateBackgroundAI(dt){
    backgroundClock+=dt;
    const a=backgroundAI;
    a.jumpCooldown=Math.max(0,a.jumpCooldown-dt);
    const oldY=a.y;
    // Keep the distant runner on the main route; decorative upper ledges are not part of its path.
    const route=platforms.filter(p=>p.h>=100 && p.y>=390);
    const support=route.find(p=>a.x+a.w>p.x && a.x<p.x+p.w && Math.abs(a.y+a.h-p.y)<12);
    const nextRoute=route.filter(p=>p.x>a.x+a.w-4).sort((p,q)=>p.x-q.x)[0];
    const edge=support ? support.x+support.w-(a.x+a.w) : 9999;
    const gapAhead=support && nextRoute ? nextRoute.x-(support.x+support.w) : 9999;
    const nextHazard=hazards.find(h=>h.x>a.x+30 && h.x-a.x<92);
    const shouldJump=!!nextHazard || (support && nextRoute && edge<62 && gapAhead<190);
    if(a.onGround && a.jumpCooldown<=0 && shouldJump){
      a.vy=-620;
      a.onGround=false;
      a.jumpCooldown=.72;
    }
    a.vx=165;
    a.face=1;
    a.x+=a.vx*dt;
    a.vy=Math.min(850,a.vy+1450*dt);
    a.y+=a.vy*dt;
    a.onGround=false;
    for(const p of route){
      if(a.vy>=0 && oldY+a.h<=p.y+6 && a.y+a.h>=p.y && a.x+a.w>p.x && a.x<p.x+p.w){
        a.y=p.y-a.h;
        a.vy=0;
        a.onGround=true;
      }
    }
    // Recover only if a genuinely missed landing occurs; normal route gaps are jumpable.
    if(a.y>610 || a.x>worldWidth-30){
      a.x=75;a.y=408;a.vy=0;a.onGround=false;a.jumpCooldown=.2;
    }
  }
  function update(dt){
    updateBackgroundAI(dt);
    if(state!=='playing')return;
    elapsed+=dt;
    const left=keys.has('ArrowLeft'),right=keys.has('ArrowRight');
    const movingInput=left||right;
    if(movingInput&&!player.wasMoving&&player.onGround)player.moveStart=.14;
    player.wasMoving=movingInput;
    if(player.moveStart>0)player.moveStart=Math.max(0,player.moveStart-dt);
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
    for(const p of platforms.concat(gravePlatforms)){
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
    if(player.x>worldWidth-145){state='won';updateHud();showOverlay('STAGE <em>CLEAR!</em>','ゴール到達！ コイン '+coins+' / 20 枚を集めた。','PLAY AGAIN');return}
    const target=Math.max(0,Math.min(worldWidth-W,player.x-W*.36));
    camera+=(target-camera)*Math.min(1,dt*5.5);
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;p.life-=dt}
    particles=particles.filter(p=>p.life>0);
    updateHud();
  }
  function rounded(x,y,w,h,r,color){
    ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
  }
  function drawBackgroundStage(){
    const left=34,right=W-34,top=164,bottom=282;
    const project=(wx,wy)=>{
      const t=wx/worldWidth;
      return {x:left+t*(right-left),y:bottom+(wy-450)*.205+Math.abs(t-.5)*17};
    };
    ctx.save();
    const floor=ctx.createLinearGradient(0,top,0,bottom+20);
    floor.addColorStop(0,'#a9c8b277');floor.addColorStop(1,'#315f5866');
    ctx.fillStyle=floor;ctx.beginPath();
    ctx.moveTo(left+34,top+12);ctx.lineTo(right-34,top+12);
    ctx.lineTo(right,bottom+20);ctx.lineTo(left,bottom+20);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#e2e9c455';ctx.lineWidth=2;ctx.stroke();
    ctx.strokeStyle='#e4edcf22';ctx.lineWidth=1;
    for(let i=0;i<9;i++){
      const x=left+i*(right-left)/8;
      ctx.beginPath();ctx.moveTo((left+right)/2,top+12);ctx.lineTo(x,bottom+18);ctx.stroke();
    }
    for(const p of platforms){
      const a=project(p.x,p.y),b=project(p.x+p.w,p.y),depth=Math.max(2,p.h*.11);
      ctx.fillStyle='#244c49aa';ctx.fillRect(a.x,a.y,b.x-a.x,depth);
      ctx.fillStyle='#82ad7c';ctx.fillRect(a.x,a.y-2,b.x-a.x,3);
      ctx.fillStyle='#527d69';ctx.fillRect(a.x,a.y+1,b.x-a.x,depth);
    }
    for(const h of hazards){
      const a=project(h.x,h.y),b=project(h.x+h.w,h.y);
      ctx.fillStyle='#c66f6b';ctx.beginPath();
      ctx.moveTo(a.x,a.y+4);ctx.lineTo((a.x+b.x)/2,a.y-5);ctx.lineTo(b.x,a.y+4);ctx.closePath();ctx.fill();
    }
    for(const c of coinSpots){
      if(c.taken)continue;
      const p=project(c.x,c.y);
      ctx.fillStyle='#ffe7a8aa';ctx.beginPath();ctx.arc(p.x,p.y,2.1,0,Math.PI*2);ctx.fill();
    }
    const a=project(backgroundAI.x+backgroundAI.w/2,backgroundAI.y+backgroundAI.h);
    const bob=backgroundAI.onGround?Math.sin(backgroundClock*13)*.8:0;
    ctx.save();ctx.globalAlpha=.9;
    ctx.fillStyle='#183c3b77';ctx.beginPath();ctx.ellipse(a.x,a.y+2,5,1.8,0,0,Math.PI*2);ctx.fill();
    if(playerSprite.complete&&playerSprite.naturalWidth>=750&&playerSprite.naturalHeight>=332){
      ctx.translate(a.x,a.y+bob);ctx.scale(-.22,.22);
      ctx.drawImage(playerSprite,250,0,250,332,-19,-50,38,50);
    }else{
      ctx.fillStyle='#f0b17b';ctx.fillRect(a.x-3,a.y-8+bob,6,8);
      ctx.fillStyle='#31465a';ctx.fillRect(a.x-3,a.y-14+bob,6,6);
    }
    ctx.restore();
    const haze=ctx.createLinearGradient(0,top,0,bottom+20);
    haze.addColorStop(0,'#c4d9c866');haze.addColorStop(.55,'#b8d2bd33');haze.addColorStop(1,'#8eb5a022');
    ctx.fillStyle=haze;ctx.fillRect(left,top,right-left,bottom-top+20);
    ctx.restore();
  }
  function drawBackground(){
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#547f9b');sky.addColorStop(.48,'#9bc9c1');sky.addColorStop(1,'#e5d9ad');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // Distant sun and its soft atmospheric halo.
    const sunX=760-camera*.055,sunY=112;
    let glow=ctx.createRadialGradient(sunX,sunY,8,sunX,sunY,145);
    glow.addColorStop(0,'#fff4c7aa');glow.addColorStop(.35,'#ffe8a044');glow.addColorStop(1,'#ffe8a000');
    ctx.fillStyle=glow;ctx.fillRect(sunX-150,sunY-150,300,300);
    ctx.fillStyle='#fff0c4';ctx.beginPath();ctx.arc(sunX,sunY,39,0,Math.PI*2);ctx.fill();
    drawBackgroundStage();
    // Faraway mesas and mountain silhouettes.
    for(let layer=0;layer<3;layer++){
      const speed=[.075,.15,.28][layer],base=[310,360,410][layer];
      const palette=['#9bb9ae','#739f8e','#557f73'];
      ctx.fillStyle=palette[layer];ctx.beginPath();ctx.moveTo(0,H);
      for(let x=-160;x<W+180;x+=180){
        const wx=x-(camera*speed%360),peak=base-70-(layer*7)+Math.sin((x+camera*speed)*.004)*22;
        ctx.lineTo(wx,base);ctx.lineTo(wx+75,peak);ctx.lineTo(wx+180,base+Math.sin((x+camera*speed)*.006)*17);
      }
      ctx.lineTo(W,H);ctx.closePath();ctx.fill();
    }
    // Tiny distant architecture gives the landscape scale.
    for(let i=0;i<8;i++){
      const x=((i*245-camera*.19)%(W+220)+W+220)%(W+220)-90;
      const y=305+(i%3)*21;
      ctx.fillStyle='#557c78aa';ctx.fillRect(x,y-35,30,35);
      ctx.fillStyle='#d6d4b0aa';ctx.fillRect(x+5,y-28,20,28);
      ctx.fillStyle='#557c78aa';ctx.beginPath();ctx.moveTo(x-5,y-35);ctx.lineTo(x+15,y-49);ctx.lineTo(x+35,y-35);ctx.fill();
    }
    // Soft drifting cloud banks.
    for(let i=0;i<7;i++){
      const x=((i*190-camera*.12)%(W+180)+W+180)%(W+180)-70;
      const y=70+(i%3)*52;
      ctx.fillStyle='#f4fff0a0';ctx.beginPath();
      ctx.ellipse(x,y,34,9,0,0,Math.PI*2);ctx.ellipse(x+23,y-7,24,12,0,0,Math.PI*2);ctx.ellipse(x+42,y,25,8,0,0,Math.PI*2);ctx.fill();
    }
    // Distant tree silhouettes.
    for(let i=0;i<22;i++){
      const x=((i*83-camera*.34)%(W+100)+W+100)%(W+100)-30;
      const y=390+(i%4)*9,s=0.55+(i%3)*.12;
      ctx.fillStyle='#426f65aa';ctx.fillRect(x-2,y-28*s,4,30*s);
      ctx.beginPath();ctx.arc(x,y-33*s,13*s,0,Math.PI*2);ctx.fill();
    }
  }
  function drawWorld(){
    // Platform shadows, stone faces, grass caps and small vegetation.
    for(const p of platforms){
      const x=p.x-camera;if(x+p.w< -20||x>W+20)continue;
      ctx.fillStyle='#294b45aa';ctx.fillRect(x+4,p.y+7,p.w,p.h);
      ctx.fillStyle='#456b58';ctx.fillRect(x,p.y,p.w,p.h);
      ctx.fillStyle='#37604f';ctx.fillRect(x,p.y+12,p.w,p.h-12);
      ctx.fillStyle='#7ebc79';ctx.fillRect(x,p.y,p.w,8);
      ctx.fillStyle='#b5d98b';ctx.fillRect(x,p.y,p.w,3);
      ctx.fillStyle='#d6e5a055';ctx.fillRect(x+3,p.y+8,p.w-6,2);
      // Stone seams and tiny highlights.
      for(let n=24;n<p.w;n+=54){
        ctx.fillStyle='#24483f88';ctx.fillRect(x+n,p.y+25,2,15);
        ctx.fillStyle='#a2c68a55';ctx.fillRect(x+n+5,p.y+20,12,2);
      }
      // Tufts of grass along the ledge.
      for(let n=14;n<p.w;n+=47){
        ctx.strokeStyle='#c0d98a';ctx.lineWidth=2;ctx.beginPath();
        ctx.moveTo(x+n,p.y+2);ctx.lineTo(x+n-4,p.y-5-(n%3));
        ctx.moveTo(x+n,p.y+2);ctx.lineTo(x+n+4,p.y-6);ctx.stroke();
      }
    }
    // Small foreground plants near the ground.
    for(let i=0;i<38;i++){
      const wx=i*151+35,x=wx-camera*.98;
      if(x< -30||x>W+30)continue;
      const ground=platforms.find(p=>wx>=p.x&&wx<=p.x+p.w&&Math.abs(p.y-450)<5);
      if(!ground)continue;
      ctx.fillStyle=i%2?'#315f4c':'#477b55';
      ctx.beginPath();ctx.ellipse(x,ground.y-3,5,12,-.45,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(x+7,ground.y-2,4,9,.55,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#e9d58a';ctx.fillRect(x+1,ground.y-12,3,3);
    }
    // Tombstones left by previous attempts become solid platforms.
    for(let i=0;i<gravePlatforms.length;i++){
      const g=gravePlatforms[i],x=g.x-camera,base=g.baseY;
      if(x+35<0||x-35>W)continue;
      ctx.fillStyle='#243c3c88';ctx.beginPath();ctx.ellipse(x,base+3,30,7,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#657d7c';ctx.beginPath();
      ctx.moveTo(x-21,base);ctx.lineTo(x-21,base-27);
      ctx.quadraticCurveTo(x-21,base-45,x,base-45);
      ctx.quadraticCurveTo(x+21,base-45,x+21,base-27);
      ctx.lineTo(x+21,base);ctx.closePath();ctx.fill();
      ctx.fillStyle='#9aacab';ctx.beginPath();
      ctx.moveTo(x-16,base-4);ctx.lineTo(x-16,base-27);
      ctx.quadraticCurveTo(x-16,base-39,x,base-40);
      ctx.lineTo(x,base-4);ctx.closePath();ctx.fill();
      ctx.fillStyle='#40595a';ctx.fillRect(x-24,base-5,48,7);
      ctx.fillStyle='#dce6d4';ctx.fillRect(x-2,base-33,4,17);ctx.fillRect(x-7,base-28,14,4);
      ctx.fillStyle='#c4d2c4';ctx.fillRect(x-11,base-11,22,2);
    }
    // Hazards with a dark contact shadow and bright bevel.
    for(const h of hazards){
      const x=h.x-camera;if(x+h.w<0||x>W)continue;
      ctx.fillStyle='#713f48';ctx.fillRect(x,h.y+h.h-2,h.w,5);
      const count=Math.max(2,Math.floor(h.w/18)),step=h.w/count;
      for(let i=0;i<count;i++){
        ctx.fillStyle='#b95758';ctx.beginPath();ctx.moveTo(x+i*step,h.y+h.h);ctx.lineTo(x+i*step+step/2,h.y);ctx.lineTo(x+(i+1)*step,h.y+h.h);ctx.closePath();ctx.fill();
        ctx.fillStyle='#ffb18a';ctx.beginPath();ctx.moveTo(x+i*step+step/2,h.y+2);ctx.lineTo(x+i*step+step/2-4,h.y+h.h-5);ctx.lineTo(x+i*step+step/2+3,h.y+h.h-5);ctx.closePath();ctx.fill();
      }
    }
    // Glowing coins with a subtle halo and metallic rim.
    for(const c of coinSpots){
      if(c.taken)continue;const x=c.x-camera;if(x< -30||x>W+30)continue;
      const halo=ctx.createRadialGradient(x,c.y,2,x,c.y,25);
      halo.addColorStop(0,'#fff0a966');halo.addColorStop(1,'#fff0a900');
      ctx.fillStyle=halo;ctx.fillRect(x-25,c.y-25,50,50);
      ctx.fillStyle='#b77b36';ctx.beginPath();ctx.ellipse(x,c.y+1,9,13,0,0,Math.PI*2);ctx.fill();
      const gold=ctx.createLinearGradient(x-8,c.y,x+8,c.y);
      gold.addColorStop(0,'#e7a943');gold.addColorStop(.45,'#fff0a2');gold.addColorStop(1,'#d78a2e');
      ctx.fillStyle=gold;ctx.beginPath();ctx.ellipse(x,c.y,7,11,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#fff5c5';ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle='#fff9d9';ctx.fillRect(x-1,c.y-6,2,12);
    }
    // Finish flag and a little stone plinth.
    const flagX=worldWidth-110-camera;
    ctx.fillStyle='#263e43aa';ctx.fillRect(flagX+3,303,7,150);
    ctx.fillStyle='#e8ead4';ctx.fillRect(flagX,300,5,150);
    ctx.fillStyle='#e78d68';ctx.beginPath();ctx.moveTo(flagX+5,302);ctx.lineTo(flagX+72,322);ctx.lineTo(flagX+5,344);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ffe0a1';ctx.fillRect(flagX+5,302,5,39);
    ctx.fillStyle='#426653';ctx.fillRect(flagX-15,447,35,6);
  }
  function drawPlayer(){
    if(player.invuln>0 && Math.floor(performance.now()/80)%2===0)return;
    const x=player.x-camera,y=player.y;
    // Soft contact shadow keeps the sprite grounded.
    ctx.save();ctx.globalAlpha=.28;ctx.fillStyle='#183b3d';
    ctx.beginPath();ctx.ellipse(x+player.w/2,y+player.h+3,18,5,0,0,Math.PI*2);ctx.fill();ctx.restore();

    if(playerSprite.complete&&playerSprite.naturalWidth>=750&&playerSprite.naturalHeight>=332){
      // Sheet order is intentionally non-sequential: run=left, idle=middle, start=right.
      const sourceX=Math.abs(player.vx)>30?(player.moveStart>0?500:250):0;
      const drawW=38,drawH=50;
      ctx.save();
      ctx.translate(Math.round(x+player.w/2),Math.round(y+player.h));
      // The source artwork faces left, so flip only when facing right.
      ctx.scale(player.face===1?-1:1,1);
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(playerSprite,sourceX,0,250,332,-drawW/2,-drawH,drawW,drawH);
      ctx.restore();
      return;
    }

    // Fallback while the sprite sheet is loading or if it is unavailable.
    ctx.save();ctx.translate(Math.round(x+player.w/2),Math.round(y+player.h/2));ctx.scale(player.face,1);
    rounded(-13,-7,7,17,2,'#4b6f62');
    rounded(-10,-12,20,25,4,'#e9a16f');
    ctx.fillStyle='#ffd2a0';ctx.fillRect(-8,-9,16,3);
    ctx.fillStyle='#bd765b';ctx.fillRect(-9,7,18,4);
    rounded(-11,-22,22,15,5,'#283b50');
    ctx.fillStyle='#40566a';ctx.fillRect(-8,-21,14,3);
    ctx.fillStyle='#f3d4ad';ctx.fillRect(-5,-12,12,7);
    ctx.fillStyle='#25384a';ctx.fillRect(3,-10,3,3);
    ctx.fillStyle='#c96e62';ctx.beginPath();ctx.moveTo(-5,-4);ctx.lineTo(9,-2);ctx.lineTo(14,4);ctx.lineTo(5,2);ctx.closePath();ctx.fill();
    rounded(-14,-7,6,14,2,'#e9a16f');rounded(8,-7,6,14,2,'#e9a16f');
    rounded(-11,10,9,9,2,'#26394d');rounded(2,10,10,9,2,'#26394d');
    ctx.fillStyle='#9bb4a2';ctx.fillRect(-10,16,8,2);ctx.fillRect(3,16,8,2);
    ctx.restore();
  }
  function draw(){
    drawBackground();ctx.save();drawWorld();drawPlayer();
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.55);ctx.fillStyle=p.color;ctx.fillRect(p.x-camera,p.y,4,4)}
    ctx.globalAlpha=1;ctx.restore();
    // Warm directional light, subtle edge vignette and foreground depth.
    const light=ctx.createRadialGradient(W*.72,H*.2,25,W*.72,H*.2,520);
    light.addColorStop(0,'#fff2c02b');light.addColorStop(1,'#fff2c000');
    ctx.fillStyle=light;ctx.fillRect(0,0,W,H);
    const vignette=ctx.createRadialGradient(W*.5,H*.48,170,W*.5,H*.48,650);
    vignette.addColorStop(0,'#142b3000');vignette.addColorStop(1,'#142b3044');
    ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
    // Blurred-looking foreground leaves create a layered diorama effect.
    ctx.globalAlpha=.72;
    for(let i=0;i<13;i++){
      const x=((i*97-camera*1.12)%(W+120)+W+120)%(W+120)-50;
      ctx.fillStyle=i%2?'#244f48':'#315f50';
      ctx.beginPath();ctx.ellipse(x,H+10,13,34,-.35,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
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