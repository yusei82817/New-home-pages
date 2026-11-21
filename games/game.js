(() => {
'use strict';
const canvas=document.getElementById('arena'),ctx=canvas.getContext('2d',{alpha:false}),$=id=>document.getElementById(id);
const W=960,H=500,FLOOR=420,STEP=1/60,GRAVITY=1750;
const keys=new Set(),particles=[],afterimages=[];
const MOVES={
 jab:{startup:.10,active:.10,recovery:.19,damage:7,range:82,knock:145,meter:9},
 cross:{startup:.17,active:.12,recovery:.29,damage:11,range:96,knock:220,meter:12},
 kick:{startup:.22,active:.14,recovery:.34,damage:15,range:120,knock:285,meter:15}
};
let p1,cpu,game='title',last=0,acc=0,clock=0,time=60,hitstop=0,shake=0,camera=0,combo=0,comboOwner=null,comboLife=0;

function makeFighter(x,team){return{x,y:FLOOR,vx:0,vy:0,team,hp:100,meter:0,face:team==='p1'?1:-1,ground:true,crouch:false,guard:false,attack:null,stun:0,flash:0,action:'idle',walk:0,ai:.2,buffer:[],trail:0};}
function hud(){$('player-health').style.width=p1.hp+'%';$('enemy-health').style.width=cpu.hp+'%';$('player-meter').style.width=p1.meter+'%';$('enemy-meter').style.width=cpu.meter+'%';}
function reset(){p1=makeFighter(285,'p1');cpu=makeFighter(675,'cpu');clock=0;time=60;hitstop=0;shake=0;combo=0;comboOwner=null;comboLife=0;particles.length=0;afterimages.length=0;game='fight';$('timer').textContent='60';$('match-status').textContent='FIGHT!';$('round-number').textContent='01';$('arena-overlay').classList.add('hidden');hud();$('round-banner').classList.remove('show');void $('round-banner').offsetWidth;$('round-banner').classList.add('show');}
function show(title,copy,button){$('overlay-title').innerHTML=title;$('overlay-copy').textContent=copy;$('start-button').textContent=button;$('arena-overlay').classList.remove('hidden');}
function result(w){if(game!=='fight')return;game='result';$('match-status').textContent='RESULT';show(w==='YOU WIN'?'VICTORY<br><span>ACHIEVED</span>':w==='DRAW'?'TIME<br><span>UP</span>':'MATCH<br><span>OVER</span>',w==='YOU WIN'?'THE SENTINELを撃破。見事な勝利。':w==='DRAW'?'時間切れ。両者、譲らず。':'THE VIOLETは敗北した。戦術を変えて再挑戦。','REMATCH  ↻');}
function callout(t){const el=$('combat-callout');el.textContent=t;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
function burst(x,y,color,n=15,power=260){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=power*(.25+Math.random()*.75);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.25+Math.random()*.3,max:.55,size:2+Math.random()*4,color});}}
function beginAttack(f,name){if(!f.ground||f.stun||f.attack)return false;f.attack={name,t:0,hit:false,face:f.face};f.guard=false;f.action='attack';f.vx*=.25;return true;}
function queueAttack(name){if(game==='fight')p1.buffer.push({name,at:clock});}
function consumeBuffer(f){if(!f.buffer.length)return;const q=f.buffer[0];if(clock-q.at>.24){f.buffer.shift();return;}if(!f.attack&&f.ground&&!f.stun&&beginAttack(f,q.name))f.buffer.shift();}
function strike(a,d){
 const m=MOVES[a.attack.name],t=a.attack.t;
 if(a.attack.hit||t<m.startup||t>m.startup+m.active)return;
 const b=a===p1?cpu:p1,dx=(b.x-a.x)*a.attack.face,dy=Math.abs(b.y-a.y);
 if(dx<10||dx>m.range+24||dy>90)return;
 a.attack.hit=true;
 const blocked=b.guard&&b.ground&&b.face===-a.attack.face;
 b.hp=Math.max(0,b.hp-(blocked?Math.max(1,Math.round(m.damage*.17)):m.damage));
 b.meter=Math.min(100,b.meter+(blocked?5:8));a.meter=Math.min(100,a.meter+m.meter);
 b.stun=blocked?.12:(a.attack.name==='kick'?.4:.28);
 b.vx=a.attack.face*(blocked?72:m.knock);if(!blocked&&a.attack.name==='kick'){b.vy=-135;b.ground=false;}
 b.attack=null;b.action=blocked?'guardhit':'hit';b.flash=.18;
 if(blocked){burst(b.x,b.y-65,'#82eaff',9,145);callout('GUARD');hitstop=Math.max(hitstop,.035);}
 else{burst(b.x+a.attack.face*20,b.y-70,a.team==='p1'?'#d8c4ff':'#ff91d0',18,320);hitstop=Math.max(hitstop,.075);shake=Math.max(shake,7);if(comboOwner===a&&comboLife>0)combo++;else{combo=1;comboOwner=a;}comboLife=1.05;callout(a===p1&&combo>1?combo+' HIT COMBO':a.attack.name==='kick'?'CRUSH!':'HIT!');}
 hud();if(b.hp<=0)result(a.team==='p1'?'YOU WIN':'CPU WINS');
}
function updateAttack(f,dt){if(!f.attack)return;f.attack.t+=dt;const m=MOVES[f.attack.name];if(f.attack.t>=m.startup+m.active+m.recovery){f.attack=null;f.action='idle';}}
function playerControl(f,dt){
 if(f.stun>0){f.stun=Math.max(0,f.stun-dt);return;}
 consumeBuffer(f);
 const l=keys.has('a'),r=keys.has('d'),duck=keys.has('s')&&f.ground;
 f.crouch=duck;f.guard=(keys.has('l')||duck)&&!f.attack;
 if(!f.attack){
  if(f.guard){f.vx*=Math.pow(.0001,dt);f.action=duck?'crouch':'guard';}
  else{const dir=(r?1:0)-(l?1:0);f.vx+=dir*(f.ground?1850:850)*dt;f.vx=Math.max(-265,Math.min(265,f.vx));if(!dir)f.vx*=Math.pow(.035,dt);f.action=Math.abs(f.vx)>25?'walk':'idle';}
  if(keys.has('w')&&f.ground){f.vy=-590;f.ground=false;f.action='jump';keys.delete('w');}
 }
}
function cpuControl(f,dt){
 if(f.stun>0){f.stun=Math.max(0,f.stun-dt);return;}
 f.ai-=dt;const dx=p1.x-f.x,d=Math.abs(dx),dir=Math.sign(dx)||-1;
 f.guard=false;f.crouch=false;
 if(!f.attack&&f.ai<=0){
  f.ai=.12+Math.random()*.12;
  if(p1.attack&&d<155&&Math.random()<.62){f.guard=true;f.action='guard';f.vx*=.25;}
  else if(d>116){f.vx+=dir*130;f.vx=Math.max(-210,Math.min(210,f.vx));f.action='walk';}
  else if(d<82&&Math.random()<.2){f.guard=true;f.action='guard';}
  else beginAttack(f,d<90&&Math.random()<.5?'jab':'kick');
  if(d>225&&f.ground&&Math.random()<.05){f.vy=-510;f.ground=false;}
 }
}
function moveFighter(f,dt){
 if(f.flash>0)f.flash=Math.max(0,f.flash-dt);
 updateAttack(f,dt);
 f.vy+=GRAVITY*dt;f.y+=f.vy*dt;
 if(f.y>=FLOOR){f.y=FLOOR;f.vy=0;f.ground=true;}else f.ground=false;
 f.x+=f.vx*dt;f.vx*=Math.pow(.045,dt);f.x=Math.max(65,Math.min(W-65,f.x));
 f.walk+=Math.abs(f.vx)*dt*.025;
 if(f.attack)strike(f,0);
}
function update(dt){
 clock+=dt;time=Math.max(0,60-Math.floor(clock));$('timer').textContent=String(time).padStart(2,'0');
 if(comboLife>0){comboLife-=dt;if(comboLife<=0){combo=0;comboOwner=null;}}
 p1.face=p1.x<cpu.x?1:-1;cpu.face=cpu.x<p1.x?1:-1;
 playerControl(p1,dt);cpuControl(cpu,dt);moveFighter(p1,dt);moveFighter(cpu,dt);
 const gap=cpu.x-p1.x;if(Math.abs(gap)<62){const push=(62-Math.abs(gap))*.5,dir=Math.sign(gap)||1;p1.x-=push*dir;cpu.x+=push*dir;if(p1.vx*dir>0)p1.vx=0;if(cpu.vx*dir<0)cpu.vx=0;}
 if(time<=0)result(p1.hp===cpu.hp?'DRAW':p1.hp>cpu.hp?'YOU WIN':'CPU WINS');
 for(let i=particles.length-1;i>=0;i--){const q=particles[i];q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=620*dt;q.vx*=.985;if(q.life<=0)particles.splice(i,1);}
 for(let i=afterimages.length-1;i>=0;i--){afterimages[i].life-=dt;if(afterimages[i].life<=0)afterimages.splice(i,1);}
 hud();
}
function line(x1,y1,x2,y2,w,c,glow=0){ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=w;ctx.strokeStyle=c;if(glow){ctx.shadowColor=c;ctx.shadowBlur=glow;}ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();}
function dot(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function drawFighter(f){
 const p=f.team==='p1',main=p?'#cbb4ff':'#ff8fcf',shade=p?'#7053ad':'#a3427a',glow=p?'#ad8aff':'#ff67bd';
 let arm=[27,-72],back=[-25,-68],legF=[17,-25],legB=[-17,-26],lean=0,c=f.crouch?13:0;
 if(f.action==='walk'){const s=Math.sin(f.walk*9);legF=[17+s*13,-27];legB=[-17-s*13,-27];arm=[25-s*10,-72];back=[-25+s*10,-70];}
 if(f.action==='jump'){legF=[25,-35];legB=[-23,-49];arm=[31,-82];back=[-30,-78];lean=5;}
 if(f.action==='guard'||f.action==='guardhit'){arm=[28,-91];back=[-19,-78];}
 if(f.action==='crouch'){arm=[28,-58];back=[-22,-56];legF=[18,-18];legB=[-18,-18];}
 if(f.action==='hit'){lean=-12;arm=[45,-64];back=[-36,-61];}
 if(f.attack){const m=MOVES[f.attack.name],active=f.attack.t>=m.startup&&f.attack.t<=m.startup+m.active;if(f.attack.name==='kick'){arm=[31,-87];back=[-25,-75];legF=active?[76,-35]:[22,-22];legB=active?[-20,-48]:[-18,-28];lean=active?9:3;}else{arm=active?[68,-76]:[40,-78];back=active?[-12,-91]:[-24,-70];legF=[22,-24];legB=[-21,-30];lean=active?13:5;}}
 const bob=f.ground&&f.action==='idle'?Math.sin(clock*3.4+(p?0:1))*2:0;
 ctx.save();ctx.translate(f.x,f.y+bob);ctx.scale(f.face,1);
 ctx.globalAlpha=.22;ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(0,2,43,8,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
 if(f.flash>0){ctx.shadowColor='#fff';ctx.shadowBlur=25;}
 // articulated legs
 line(-10,-47+c,-17+legB[0]*.35,legB[1],13,shade,4);line(-17+legB[0]*.35,legB[1],legB[0],-5,10,main,3);
 line(10,-47+c,12+legF[0]*.35,legF[1],14,shade,4);line(12+legF[0]*.35,legF[1],legF[0],-5,11,main,3);
 ctx.fillStyle='#171326';ctx.fillRect(legB[0]-7,-7,17,6);ctx.fillRect(legF[0]-7,-7,19,6);
 // torso, armor, shoulders
 ctx.save();ctx.translate(lean,0);ctx.fillStyle=shade;ctx.beginPath();ctx.moveTo(-20,-91+c);ctx.quadraticCurveTo(0,-99+c,20,-91+c);ctx.lineTo(17,-44+c);ctx.quadraticCurveTo(0,-37+c,-18,-44+c);ctx.closePath();ctx.fill();
 ctx.fillStyle=main;ctx.beginPath();ctx.moveTo(-13,-86+c);ctx.lineTo(13,-86+c);ctx.lineTo(12,-50+c);ctx.lineTo(-11,-50+c);ctx.closePath();ctx.fill();
 ctx.fillStyle='rgba(255,255,255,.68)';ctx.fillRect(-2,-82+c,3,27);
 ctx.fillStyle=main;ctx.beginPath();ctx.moveTo(-18,-83+c);ctx.lineTo(-28,-74+c);ctx.lineTo(-15,-62+c);ctx.lineTo(-7,-76+c);ctx.fill();ctx.beginPath();ctx.moveTo(18,-83+c);ctx.lineTo(28,-74+c);ctx.lineTo(15,-62+c);ctx.lineTo(7,-76+c);ctx.fill();
 // back arm and front arm with elbow
 line(-17,-76+c,-25,-68+c,11,shade,3);line(-25,-68+c,back[0],back[1]+c,9,main,3);
 const ex=(20+arm[0])*.48,ey=(-74+c+arm[1])*.48;line(17,-76+c,ex,ey,13,shade,5);line(ex,ey,arm[0],arm[1]+c,10,main,4);dot(ex,ey,6,main);dot(arm[0],arm[1]+c,8,'#f1eaff');
 // neck/head/visor
 ctx.fillStyle=shade;ctx.fillRect(-6,-101+c,12,14);ctx.fillStyle=main;ctx.beginPath();ctx.arc(0,-115+c,17,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#171326';ctx.beginPath();ctx.moveTo(0,-122+c);ctx.lineTo(16,-120+c);ctx.lineTo(15,-111+c);ctx.lineTo(1,-112+c);ctx.closePath();ctx.fill();
 ctx.fillStyle=p?'#f0dcff':'#ffe0ef';ctx.shadowColor=glow;ctx.shadowBlur=10;ctx.fillRect(5,-118+c,8,3);ctx.shadowBlur=0;
 ctx.fillStyle='#171326';ctx.fillRect(-14,-51+c,28,5);ctx.fillStyle=main;ctx.fillRect(-3,-52+c,7,7);
 ctx.restore();
 if(f.guard){ctx.strokeStyle='rgba(112,231,255,.78)';ctx.lineWidth=2;ctx.shadowColor='#74eaff';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(0,-72,48,-1.2,1.2);ctx.stroke();ctx.shadowBlur=0;}
 if(f.attack){const m=MOVES[f.attack.name];if(f.attack.t>=m.startup&&f.attack.t<=m.startup+m.active){ctx.globalAlpha=.25;ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(f.attack.name==='kick'?62:48,-66,f.attack.name==='kick'?53:42,18,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}}
 ctx.restore();
}
function stage(){
 const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#090b20');sky.addColorStop(.5,'#242044');sky.addColorStop(1,'#151323');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.shadowColor='#c9b5ff';ctx.shadowBlur=28;ctx.fillStyle='#d9d1ff';ctx.beginPath();ctx.arc(765,91,34,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#25203e';ctx.beginPath();ctx.arc(778,80,32,0,Math.PI*2);ctx.fill();ctx.restore();
 for(let i=0;i<55;i++){const x=(i*173+clock*3)%W,y=25+(i*83)%235;ctx.globalAlpha=.2+(i%4)*.09;ctx.fillStyle='#e7dcff';ctx.fillRect(x,y,1.5,1.5);}ctx.globalAlpha=1;
 for(let layer=0;layer<3;layer++){const base=280+layer*34,off=(camera*(layer+1)*.12)%170;ctx.fillStyle=['#17172f','#20203b','#2a2447'][layer];for(let i=-1;i<9;i++){const x=i*145-off;ctx.fillRect(x,base-((i*37+layer*19)%45),92,H-base+60);ctx.fillStyle='rgba(193,169,255,.16)';for(let a=0;a<4;a++)for(let b=0;b<4;b++)ctx.fillRect(x+12+a*18,base-30-((i*37+layer*19)%45)+b*15,5,7);ctx.fillStyle=['#17172f','#20203b','#2a2447'][layer];}}
 const beam=ctx.createLinearGradient(100,0,300,FLOOR);beam.addColorStop(0,'rgba(173,145,255,0)');beam.addColorStop(1,'rgba(173,145,255,.13)');ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(105,0);ctx.lineTo(310,0);ctx.lineTo(460,FLOOR);ctx.lineTo(175,FLOOR);ctx.fill();
 ctx.fillStyle='#111322';ctx.fillRect(0,FLOOR,W,H-FLOOR);const g=ctx.createLinearGradient(0,FLOOR,0,H);g.addColorStop(0,'rgba(166,132,255,.16)');g.addColorStop(1,'rgba(12,13,26,0)');ctx.fillStyle=g;ctx.fillRect(0,FLOOR,W,H-FLOOR);
 ctx.strokeStyle='rgba(181,157,255,.18)';for(let i=0;i<=16;i++){const x=i*60;ctx.beginPath();ctx.moveTo(W/2,FLOOR);ctx.lineTo(x,H);ctx.stroke();}for(let y=FLOOR+10;y<H;y+=17){ctx.globalAlpha=.12+(y-FLOOR)/(H-FLOOR)*.12;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.globalAlpha=1;
 ctx.fillStyle='rgba(198,173,255,.5)';ctx.fillRect(0,FLOOR-2,W,2);ctx.font='800 11px sans-serif';ctx.textAlign='center';ctx.fillStyle='rgba(221,209,255,.26)';ctx.fillText('V O I D   C O L I S E U M',W/2,55);ctx.textAlign='left';
}
function render(dt){
 ctx.save();if(shake>0){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake=Math.max(0,shake-dt*24);}stage();
 for(const a of afterimages){ctx.globalAlpha=Math.max(0,a.life/.17)*.17;ctx.fillStyle=a.color;ctx.beginPath();ctx.ellipse(a.x,a.y-60,17,48,0,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
 [p1,cpu].sort((a,b)=>a.y-b.y).forEach(drawFighter);
 for(const q of particles){ctx.globalAlpha=Math.max(0,q.life/q.max);ctx.fillStyle=q.color;ctx.shadowColor=q.color;ctx.shadowBlur=10;ctx.fillRect(q.x,q.y,q.size,q.size);ctx.shadowBlur=0;}ctx.globalAlpha=1;
 const v=ctx.createRadialGradient(W/2,H/2,180,W/2,H/2,600);v.addColorStop(.55,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.48)');ctx.fillStyle=v;ctx.fillRect(0,0,W,H);ctx.restore();
}
function loop(now){
 const dt=Math.min((now-last)/1000||0,.05);last=now;
 if(game==='fight'){
  if(hitstop>0)hitstop=Math.max(0,hitstop-dt);
  else{acc+=dt;let n=0;while(acc>=STEP&&n++<5){update(STEP);acc-=STEP;}}
  camera+=((p1.x+cpu.x)/2-W/2-camera)*Math.min(1,dt*2.8);
  for(const f of [p1,cpu]){f.trail+=dt;if(Math.abs(f.vx)>220&&f.trail>.055){afterimages.push({x:f.x,y:f.y,life:.17,color:f.team==='p1'?'#c7aaff':'#ff8fcf'});f.trail=0;}}
 }
 render(dt);requestAnimationFrame(loop);
}
function down(e){
 const k=e.key.toLowerCase(),map={arrowleft:'a',arrowright:'d',arrowup:'w',arrowdown:'s',' ':'w'};
 if(['a','d','w','s','j','k','l','arrowleft','arrowright','arrowup','arrowdown',' '].includes(k))e.preventDefault();
 if(k==='enter'&&(game==='title'||game==='result')){reset();return;}
 if(k==='escape'&&game==='fight'){game='pause';$('match-status').textContent='PAUSED';show('MATCH<br><span>PAUSED</span>','一時停止中。Enterまたはボタンで再開。','RESUME  →');return;}
 if(k==='enter'&&game==='pause'){game='fight';$('arena-overlay').classList.add('hidden');$('match-status').textContent='FIGHT!';return;}
 if(k==='j'||k==='k'){if(!e.repeat)queueAttack(k==='j'?'jab':'kick');return;}
 keys.add(map[k]||k);
}
function up(e){const k=e.key.toLowerCase(),map={arrowleft:'a',arrowright:'d',arrowup:'w',arrowdown:'s',' ':'w'};keys.delete(map[k]||k);}
window.addEventListener('keydown',down,{passive:false});window.addEventListener('keyup',up);window.addEventListener('blur',()=>keys.clear());
document.querySelectorAll('[data-key]').forEach(b=>{const k=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();if(k==='j'||k==='k')queueAttack(k==='j'?'jab':'kick');else keys.add(k);});['pointerup','pointercancel','pointerleave'].forEach(t=>b.addEventListener(t,e=>{e.preventDefault();keys.delete(k);}));});
$('start-button').addEventListener('click',()=>{if(game==='pause'){game='fight';$('arena-overlay').classList.add('hidden');$('match-status').textContent='FIGHT!';}else reset();});
p1=makeFighter(285,'p1');cpu=makeFighter(675,'cpu');hud();requestAnimationFrame(loop);
})();