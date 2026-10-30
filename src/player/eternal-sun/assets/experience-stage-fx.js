/* AE Light Player 0.4.0 — full-stage overlay show (lasers from the screen edges, crisp gold rings,
 * gold orbs, drag trails, idle ambience, drop flash). Built on the homepage sound-light core
 * (same six laser colours, white-core beams, gold touch rings, 148 BPM beat timeline).
 * HARD RULE: this layer never reads, redraws, filters, tints or moves the artwork; it only adds light
 * on its own transparent canvas (pointer-events:none). Caller owns the frame clock and the beat data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AEExperienceStageFx=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const COLORS=['#ff416d','#57ffa0','#ffe28d','#65dbff','#c987ff','#ffac68','#ff5fd2','#7dffea','#fff07a','#5f8bff','#ff8a3d','#b6ff5c'];
const RGB=COLORS.map(h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)));
const CAP={beams:40,particles:80,rings:24};
const v=s=>{const n=Math.sin(s*12.9898+78.233)*43758.5453;return n-Math.floor(n);};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=t=>1-Math.pow(1-clamp(t),3);
function create({canvas,dpr=1,vibrate=null}){
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
 let W=0,H=0,ratio=1,dead=false,lite=false,slowSince=0,fastSince=0,ema=16.7,lastNow=0,recoverMs=6000,liteAt=0;
 let bolts=[],rings=[],orbs=[],motes=[],trail=[],flash=0,lastDrop=0,lastBeat=-1,lastTouch=-1e9,lastIdleSweep=0,idleSweeps=[],held=null,stats={};
 function resize(){const w=Math.max(1,canvas.clientWidth||1),h=Math.max(1,canvas.clientHeight||1);const r=Math.min(lite?1:dpr,2);if(w===W&&h===H&&r===ratio)return;W=w;H=h;ratio=r;canvas.width=Math.round(W*r);canvas.height=Math.round(H*r);ctx.setTransform(r,0,0,r,0,0);}
 // Beam origins all sit on the screen edges / corners, outside the painting.
 function origin(i){const k=i%12,t=v(i*7.7);
  switch(k){case 0:return[-8,H*.08];case 1:return[W+8,H*.08];case 2:return[-8,H*(.45+.2*t)];case 3:return[W+8,H*(.45+.2*t)];
   case 4:return[W*(.18+.1*t),-8];case 5:return[W*(.82-.1*t),-8];case 6:return[-8,H+8];case 7:return[W+8,H+8];
   case 8:return[W*.5,-8];case 9:return[-8,H*.25];case 10:return[W+8,H*.25];default:return[W*.5,H+8];}}
 function beam(x0,y0,x1,y1,rgb,power,width,extend){
  if(power<=.01)return;const dx=x1-x0,dy=y1-y0,ex=x1+dx*extend,ey=y1+dy*extend,c=rgb.join(',');
  ctx.lineCap='round';
  if(!lite){ctx.strokeStyle=`rgba(${c},${.13*power})`;ctx.lineWidth=width*4.2;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(ex,ey);ctx.stroke();}
  ctx.strokeStyle=`rgba(${c},${.55*power})`;ctx.lineWidth=width*1.9;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(ex,ey);ctx.stroke();
  let g;if(lite)g=`rgba(255,255,246,${.92*power})`;else{g=ctx.createLinearGradient(x0,y0,ex,ey);g.addColorStop(0,`rgba(255,255,248,${.95*power})`);g.addColorStop(.82,`rgba(255,253,236,${.92*power})`);g.addColorStop(1,'rgba(255,253,236,0)');}
  ctx.strokeStyle=g;ctx.lineWidth=Math.max(1.2,width*.62);ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(ex,ey);ctx.stroke();
 }
 function hit(x,y,rgb,power,r){if(power<=.02)return;if(lite){ctx.fillStyle=`rgba(${rgb.join(',')},${.4*power})`;ctx.beginPath();ctx.arc(x,y,r*.45,0,6.283);ctx.fill();ctx.fillStyle=`rgba(255,255,245,${.9*power})`;ctx.beginPath();ctx.arc(x,y,r*.18,0,6.283);ctx.fill();return;}const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(255,255,245,${.95*power})`);g.addColorStop(.25,`rgba(${rgb.join(',')},${.55*power})`);g.addColorStop(1,`rgba(${rgb.join(',')},0)`);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
 function goldRing(x,y,radius,alpha,lw=2){if(alpha<=.01||radius<=0)return;
  ctx.strokeStyle=`rgba(255,214,110,${.28*alpha})`;ctx.lineWidth=lw*4;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle=`rgba(255,226,140,${alpha})`;ctx.lineWidth=lw;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle=`rgba(255,252,232,${.85*alpha})`;ctx.lineWidth=Math.max(.8,lw*.45);ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();}
 function goldCore(x,y,r,alpha){if(alpha<=.01)return;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(255,253,236,${alpha})`);g.addColorStop(.35,`rgba(255,222,130,${.75*alpha})`);g.addColorStop(1,'rgba(255,196,70,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
 function fire(x,y,now,n,life){for(let i=0;i<n;i++){const o=origin(Math.floor(v(now*.013+i*3.1)*12));bolts.push({ox:o[0],oy:o[1],x,y,born:now+i*14,life,c:(i+Math.floor(now/97))%12});}
  if(bolts.length>24)bolts.splice(0,bolts.length-24);}
 function addRing(x,y,now,big){rings.push({x,y,born:now,life:big?1500:1150,big});if(rings.length>CAP.rings)rings.shift();}
 function addMote(x,y,now,o={}){if(orbs.length+motes.length+trail.length>=CAP.particles)motes.shift();const a=v(now*.7+x)*Math.PI*2,s=(o.speed??18)*(.4+v(y+now)*.9);motes.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-(o.rise??8),born:now,life:o.life??(1800+v(x*y)*1400),r:o.r??(1.2+v(x+y)*2.2)});}
 // ---------- public input (viewport coordinates) ----------
 function tap(x,y,now,beat){lastTouch=now;
  // fire immediately (latency), echo on the next 1/8 beat while music plays
  fire(x,y,now,5,340);addRing(x,y,now,false);
  if(beat&&beat.playing){const step=(beat.interval||.405)/2,delay=step*1000*(1-((beat.phase||0)*2%1));later.push({at:now+Math.min(220,delay),fn:t=>{fire(x,y,t,3,300);addRing(x,y,t,false);}});}
  for(let i=0;i<5;i++)addMote(x,y,now,{speed:60,rise:20,life:900+i*120,r:1.6+i*.3});
  try{vibrate&&vibrate(10);}catch(e){}
 }
 function hold(x,y,now){if(!held){held={x,y,start:now};lastTouch=now;}else{const d=Math.hypot(x-held.x,y-held.y);held.x=x;held.y=y;lastTouch=now;if(d>2&&!lite){trail.push({x,y,born:now,c:Math.floor(now/60)%12});if(trail.length>40)trail.shift();}}}
 function release(now,beat){if(!held)return;const{x,y,start}=held,power=clamp((now-start)/1200,.35,1);held=null;lastTouch=now;
  addRing(x,y,now,true);fire(x,y,now,Math.round(6+power*4),420);
  const n=Math.round(8+power*8);for(let i=0;i<n;i++){const a=i/n*Math.PI*2+v(now+i)*.4,s=70+v(i*3.3+now)*120*power;orbs.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,born:now+i*12,life:1500+v(i)*500,r:9+v(i*5.1)*11});}
  if(orbs.length>24)orbs.splice(0,orbs.length-24);
  try{vibrate&&vibrate([12,40,18]);}catch(e){}
 }
 function cancel(){held=null;}
 const later=[];
 // ---------- frame ----------
 function draw(f){
  if(dead)return stats;const{now,art,playing,beat={},reduced}=f;
  const fd=lastNow?now-lastNow:16.7;lastNow=now;
  // P0-1: hysteresis, never latch on one hitch. lite after 2 s slow, recover after 6 s smooth (back-off up to 48 s if it keeps falling back).
  if(fd>0&&fd<500)ema=ema*.9+fd*.1;
  if(ema>22){fastSince=0;slowSince=slowSince||now;if(!lite&&now-slowSince>2000){lite=true;if(liteAt&&now-liteAt<recoverMs+4000)recoverMs=Math.min(recoverMs*2,48000);liteAt=now;resize();}}
  else if(ema<18){slowSince=0;fastSince=fastSince||now;if(lite&&now-fastSince>recoverMs){lite=false;liteAt=now;resize();}}
  else{slowSince=0;fastSince=0;}
  resize();ctx.clearRect(0,0,W,H);
  for(let i=later.length-1;i>=0;i--)if(now>=later[i].at){const j=later.splice(i,1)[0];j.fn(now);}
  if(reduced){for(const r of rings.filter(r=>now-r.born<r.life))goldRing(r.x,r.y,30,1-(now-r.born)/r.life);rings=rings.filter(r=>now-r.born<r.life);bolts=[];orbs=[];motes=[];trail=[];return stats={beams:0,particles:0,lite};}
  const ax=art.x,ay=art.y,aw=art.w,ah=art.h,cx=ax+aw*.52,cy=ay+ah*.522;
  const stage=beat.stage||'groove',pulse=playing?clamp(beat.pulse||0):0,drop=playing?clamp(beat.dropPulse||0):0;
  const idle=!playing&&!held&&now-lastTouch>1500;
  ctx.globalCompositeOperation=lite?'source-over':'lighter';
  // --- ambient laser show ---
  let count=0;
  if(playing){count=stage==='build'?8:(drop>.15?12:6);}
  const sweepT=playing?(beat.sweep||0):now/2400;
  let beams=0;
  for(let i=0;i<count;i++){
   const [ox,oy]=origin(i),a=i*2.399+sweepT*(playing?.21:.5)+v(Math.floor((beat.count||0)/8)+i)*1.4;
   let tx=ax+aw*(.5+.42*Math.sin(a)),ty=ay+ah*(.5+.40*Math.cos(a*1.31));
   if(held){const w=clamp((now-held.start)/500);tx=tx*(1-w)+held.x*w;ty=ty*(1-w)+held.y*w;}
   if(drop>.3){tx=tx*(1-drop)+cx*drop;ty=ty*(1-drop)+cy*drop;}
   const base=stage==='build'?.28+(beat.buildProgress||0)*.45:.42;
   const p=clamp(base+pulse*.6+drop*.4+(held?.2:0));
   beam(ox,oy,tx,ty,RGB[i%12],p,2.6+pulse*3.2+drop*2,.35);hit(tx,ty,RGB[i%12],p,16+pulse*18);beams++;
  }
  // --- idle ambience: slow sweeps every ~2.6 s, floating specks ---
  if(idle){if(now-lastIdleSweep>2600){lastIdleSweep=now;const n=2+Math.floor(v(now)*2);for(let i=0;i<n;i++)idleSweeps.push({born:now+i*260,life:2300,i:Math.floor(v(now+i*9)*12),seed:v(now*.3+i)*6});}}
  idleSweeps=idleSweeps.filter(s=>now-s.born<s.life);
  for(const s of idleSweeps){const t=(now-s.born)/s.life;if(t<0)continue;const env=Math.sin(Math.PI*t),[ox,oy]=origin(s.i),a=s.seed+t*1.6,tx=ax+aw*(.5+.38*Math.sin(a)),ty=ay+ah*(.45+.35*Math.cos(a*1.2));beam(ox,oy,tx,ty,RGB[s.i],Math.min(1,env*1.1),3.4,.3);hit(tx,ty,RGB[s.i],env*.85,26);beams++;}
  if(!playing&&motes.length<6&&v(now*.001)>.4&&now%7<2)addMote(ax+aw*(.1+.8*v(now)),ay+ah*(.2+.7*v(now*1.7)),now,{speed:6,rise:10,life:3200,r:1.6+v(now)*2});
  // --- beat-driven gold specks / build / drop ---
  if(playing&&beat.beat&&beat.count!==lastBeat){lastBeat=beat.count;
   const n=stage==='build'?Math.round(2+(beat.buildProgress||0)*6):(beat.count%4===0?6:2);
   for(let i=0;i<n;i++){const a=v(beat.count*3+i)*Math.PI*2,r=aw*.18*v(i+beat.count);addMote(cx+Math.cos(a)*r,cy+Math.sin(a)*r,now,{speed:40,rise:14,life:1100});}
   if(beat.count%4===0&&now-lastTouch>4000){addRing(cx+aw*(v(beat.count)-.5)*.6,cy+ah*(v(beat.count*2)-.5)*.6,now,false);}
  }
  if(drop>.9&&now-lastDrop>800){lastDrop=now;flash=1;for(let i=0;i<12;i++)orbs.push({x:cx,y:cy,vx:Math.cos(i/12*6.283)*190,vy:Math.sin(i/12*6.283)*190,born:now,life:1500,r:12+v(i)*10});if(orbs.length>24)orbs.splice(0,orbs.length-24);}
  if(flash>0){const g=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*.7);g.addColorStop(0,`rgba(255,250,225,${.30*flash})`);g.addColorStop(.5,`rgba(255,220,140,${.12*flash})`);g.addColorStop(1,'rgba(255,220,140,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);flash=Math.max(0,flash-fd/120);}
  // --- hold: gather light at the fingertip ---
  if(held){const w=clamp((now-held.start)/1200);goldCore(held.x,held.y,26+w*40,.55+w*.4);goldRing(held.x,held.y,14+w*26+Math.sin(now/90)*3,.6+w*.4,2);
   if(!lite&&motes.length<CAP.particles-20&&Math.floor(now/50)%2===0){const a=v(now)*6.283,r=90+v(now*1.3)*80;motes.push({x:held.x+Math.cos(a)*r,y:held.y+Math.sin(a)*r,vx:-Math.cos(a)*r/0.7,vy:-Math.sin(a)*r/0.7,born:now,life:700,r:1.6+v(now)*1.6});}
   for(let i=0;i<3;i++){const[ox,oy]=origin(i*4+1);beam(ox,oy,held.x,held.y,RGB[(i*4+1)%12],.35+w*.55,2+w*2.5,0);beams++;}}
  // --- drag trail ---
  trail=trail.filter(p=>now-p.born<650);
  for(let i=1;i<trail.length;i++){const p=trail[i],q=trail[i-1],a=1-(now-p.born)/650;ctx.strokeStyle=`rgba(${RGB[p.c].join(',')},${.75*a})`;ctx.lineWidth=3+6*a;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.strokeStyle=`rgba(255,255,245,${.8*a})`;ctx.lineWidth=1.4;ctx.stroke();}
  // --- tap / release bolts (flying lasers) ---
  bolts=bolts.filter(b=>now-b.born<b.life);
  for(const b of bolts){const t=(now-b.born)/b.life;if(t<0)continue;const fly=ease(t/.35),p=t<.35?1:1-(t-.35)/.65;const tx=b.ox+(b.x-b.ox)*fly,ty=b.oy+(b.y-b.oy)*fly;beam(b.ox,b.oy,tx,ty,RGB[b.c],p,3.4,0);hit(tx,ty,RGB[b.c],p,20);beams++;}
  // --- crisp gold rings (stack) ---
  rings=rings.filter(r=>now-r.born<r.life);
  for(const r of rings){const t=(now-r.born)/r.life;if(t<0)continue;const a=1-t,R=(r.big?70:52);
   goldCore(r.x,r.y,(r.big?30:20)*(1-t*.6),a*.9);
   goldRing(r.x,r.y,10+ease(t)*R,a,2.2);goldRing(r.x,r.y,6+ease(Math.max(0,t-.08))*R*.68,a*.85,1.8);if(r.big||t<.7)goldRing(r.x,r.y,3+ease(Math.max(0,t-.16))*R*.4,a*.7,1.5);}
  // --- gold orbs (release bursts) ---
  const dt=Math.min(.05,fd/1000);orbs=orbs.filter(o=>now-o.born<o.life);
  for(const o of orbs){const t=(now-o.born)/o.life;if(t<0)continue;o.x+=o.vx*dt;o.y+=o.vy*dt;o.vx*=.965;o.vy=o.vy*.965-6*dt;const a=t<.1?t/.1:1-(t-.1)/.9;goldCore(o.x,o.y,o.r*1.4,a*.8);goldRing(o.x,o.y,o.r,a,1.6);}
  // --- motes ---
  motes=motes.filter(m=>now-m.born<m.life);
  for(const m of motes){m.x+=m.vx*dt;m.y+=m.vy*dt;const t=(now-m.born)/m.life,a=Math.sin(Math.PI*clamp(t));ctx.fillStyle=`rgba(255,232,150,${.9*a})`;ctx.beginPath();ctx.arc(m.x,m.y,m.r,0,6.283);ctx.fill();}
  ctx.globalCompositeOperation='source-over';
  const particles=orbs.length+motes.length+trail.length;
  stats={recoverMs,beams,bolts:bolts.length,rings:rings.length,orbs:orbs.length,particles,lite,ema:+ema.toFixed(1),idle,held:!!held};
  canvas.dataset.beams=String(beams);canvas.dataset.particles=String(particles);canvas.dataset.lite=lite?'1':'0';canvas.dataset.rings=String(rings.length);
  return stats;
 }
 function clear(){bolts=[];rings=[];orbs=[];motes=[];trail=[];idleSweeps=[];held=null;flash=0;later.length=0;ctx.clearRect(0,0,W,H);}
 return{resize,draw,tap,hold,release,cancel,clear,destroy(){dead=true;clear();},snapshot:()=>({...stats,cap:CAP})};
}
return{create,COLORS,CAP};
});
