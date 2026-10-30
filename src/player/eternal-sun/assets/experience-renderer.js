/* AE Eternal shared renderer 0.1.0.
 * Adapted from official homepage ae-home-light.js (2026-10-30 sha256 a1b58497…26c).
 * One renderer for the standalone wrapper and future homepage mounting. Artwork is never drawn/transformed here.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AEExperienceRenderer=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
// Official home display-clock policy: hard re-anchor to source time, bridge coarse samples,
// and compensate only one presentation frame, bounded to40ms. Never integrate a BPM clock.
function createDisplayClock(){
 let last=-1,anchor=0,stamp=0,moved=false;
 return{reset(){last=-1;anchor=stamp=0;moved=false;},read(state,now,presentMs=12){
  const ct=Math.max(0,Number(state.time)||0);if(!state.playing){last=ct;anchor=ct;stamp=now;moved=false;return ct;}
  if(ct!==last){moved=last>=0&&ct>last;last=ct;anchor=ct;stamp=now;}
  const bridge=moved&&now-stamp<=500?Math.max(0,now-stamp)/1000:0;
  const lead=Math.min(.032,Math.max(.012,presentMs/1000));
  return Math.min(ct+.04,anchor+bridge+lead);
 }};
}
function geometry(width,height){return{width,height,artX0:0,artW:width,artBottom:height,sunX:width*.52,sunY:height*.522};}
function create({canvas,host:hero,timeline,energy:audioEnergy,readPlayback,chime=null,lighting=null,motion:reduced,environment={}}){
 const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('Canvas unavailable');
 const env={now:()=>globalThis.performance.now(),raf:f=>requestAnimationFrame(f),cancelRaf:i=>cancelAnimationFrame(i),later:(f,t)=>globalThis.setTimeout(f,t),cancelLater:i=>clearTimeout(i),dpr:globalThis.devicePixelRatio||1,...environment};
 const performance={now:()=>env.now()};
 const timers=new Set();let dead=false;
 function later(fn,ms){if(dead)return;const id=env.later(()=>{timers.delete(id);if(!dead)fn();},ms);timers.add(id);return id;}
 const rhythm=audioEnergy.createRhythm(timeline?.events,timeline?.accents,timeline?.sections);
 let lite=false,liteLatch=false,frameEma=16.7,presentMs=12,lights=true,playing=false,wasPlaying=false,frame=0,lastPaint=0,energy=0,viewable=true,forceLite=false;
 let width=0,height=0,artBottom=0,artX0=0,artW=0,sunX=0,sunY=0,spots=[],musicSpots=[],bolts=[],focus=null,needsStatic=true;
 let musicFrame={stage:'groove',dropPulse:0,buildProgress:0},specks=[],musicTime=0;const displayClock=createDisplayClock();
 let glows=[],coins=[],sweeps=[],lastFxFrame=0,pendingRelease=null;
 const laserColors=['#ff416d','#57ffa0','#ffe28d','#65dbff','#c987ff','#ffac68'];
 const variation=seed=>{const n=Math.sin(seed*12.9898+78.233)*43758.5453;return n-Math.floor(n);};
 const displayTime=()=>displayClock.read(readPlayback(),performance.now(),presentMs);
 function resize(){if(dead)return;const r=canvas.getBoundingClientRect();({width,height,artBottom,artX0,artW,sunX,sunY}=geometry(Math.max(1,r.width),Math.max(1,r.height)));const ratio=Math.min(env.dpr,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);hero.dataset.artBox=JSON.stringify([0,0,width,height]);needsStatic=true;schedule();}
 function schedule(){if(!dead&&!frame&&lights&&viewable&&(readPlayback().playing||spots.length||musicSpots.length||bolts.length||glows.length||coins.length||sweeps.length||needsStatic||lighting?.needsAnimation()||(focus&&focus.until>performance.now())))frame=env.raf(draw);}
 function clear(){ctx.clearRect(0,0,width,height);hero.dataset.audioEnergy='0';}
  function destination(i,phase,now){
    const group=Math.floor((Number(hero.dataset.beatCount)||0)/4);
    const angle=i*Math.PI/3+phase*.24+variation(group+1)*1.7;
    const ambient={x:artX0+artW*(.16+.68*(.5+.5*Math.sin(angle))),y:Math.max(30,artBottom*(.20+.60*(.5+.5*Math.cos(angle*1.3))))};
    const remaining=focus?focus.until-now:0;
    const weight=remaining>0?Math.min(1,remaining/600):0;
    const target={x:ambient.x*(1-weight)+(focus?focus.x:0)*weight,y:ambient.y*(1-weight)+(focus?focus.y:0)*weight};
    // The drop belongs to the music, even if a finger is currently focusing elsewhere.
    const impact=playing?Math.min(1,(musicFrame.dropPulse||0)*1.8):0;
    return{x:target.x*(1-impact)+sunX*impact,y:target.y*(1-impact)+Math.max(30,sunY)*impact};
  }
  function launchDepth(x,y,now,seed){
    if(reduced.matches)return;
    const number=playing?(musicFrame.stage==='drop'?6:2):6;
    for(let i=0;i<number;i++){
      const edge=i%3,ox=edge===0?artX0-artW*.12:edge===1?artX0+artW*1.12:artX0+artW*(.1+((i+seed)%5)*.2),oy=edge===2?-30:artBottom*(.1+((i+seed)%5)*.16);
      const target=x===null?destination(i,seed,now):{x,y};
      bolts.push({ox,oy,x:target.x,y:target.y,born:now+(playing?0:i*12),life:playing?180:650,musical:playing,color:laserColors[i]});
    }
    if(bolts.length>36)bolts.splice(0,bolts.length-36);
  }
  function draw(now){
    frame=0;
    const state=readPlayback(),previousPlaying=wasPlaying;playing=!!state.playing;
    if(!playing&&wasPlaying)resetTiming();
    wasPlaying=playing;
    if(dead||!lights||!viewable){clear();return;}
    if(now-lastPaint>0&&now-lastPaint<(playing?8:30)){schedule();return;}
    // presentMs is how long the previous frame took to come back. The beat is drawn for that
    // far ahead so a slow frame still lands on the kick that is playing when it appears.
    const fd=now-lastPaint;lastPaint=now;
    if(previousPlaying&&fd>0){frameEma=frameEma*.8+Math.min(fd,250)*.2;presentMs=presentMs*.5+Math.min(fd,80)*.5;}
    if(playing&&previousPlaying&&(fd>28||frameEma>22))liteLatch=true;
    if(!playing&&!forceLite)liteLatch=false;
    lite=forceLite||liteLatch;
    const bare=lite&&frameEma>45;
    hero.dataset.lightLite=lite?'1':'0';hero.dataset.lightBare=bare?'1':'0';
    needsStatic=false;ctx.clearRect(0,0,width,height);ctx.save();ctx.beginPath();ctx.rect(artX0,0,artW,artBottom);ctx.clip();
    if(!reduced.matches&&playing){
      musicTime=displayTime();const bass=audioEnergy.energyAt(timeline,musicTime);
      musicFrame=rhythm.update(bass,musicTime);
      const beat=musicFrame;
      energy=Math.max(bass,energy*Math.pow(.84,Math.max(0,fd)/(1000/60)));
      hero.dataset.audioEnergy=energy.toFixed(3);hero.dataset.beatCount=String(beat.count);hero.dataset.beatPulse=beat.pulse.toFixed(3);hero.dataset.beatInterval=beat.interval.toFixed(3);
      hero.dataset.musicTime=musicTime.toFixed(3);hero.dataset.musicStage=beat.stage;hero.dataset.accentCount=String(beat.accentCount);hero.dataset.dropPulse=beat.dropPulse.toFixed(3);
      // Exactly one primary music pass: the actual homepage opening choreography,
      // retained throughout audible playback. No stacked continuous-beam show or15s cutoff.
      if(pendingRelease&&musicTime>=pendingRelease.time){const hit=pendingRelease;pendingRelease=null;if(musicTime-hit.time<.18)bloom(hit.x,hit.y);}

    }
    const illumination=lighting?.draw(ctx,{width,height,now,playback:{...state,time:musicTime||state.time},beat:musicFrame,boost:glows.reduce((m,g)=>Math.max(m,Math.max(0,1-(now-g.born)/g.life)),0),target:focus&&focus.until>now?focus:null});
    const front=!illumination||(illumination.enabled&&illumination.mode==='rgb');
    if(!front){spots=[];musicSpots=[];bolts=[];glows=illumination?.enabled?glows.filter(g=>now-g.born<g.life):[];coins=[];sweeps=[];ctx.restore();schedule();return;}
    if(playing&&!reduced.matches)drawOpening(now,bare);
    if(!playing||reduced.matches)drawIdle(now);
    bolts=bolts.filter(b=>now-b.born<b.life);
    if(!reduced.matches){
      ctx.globalCompositeOperation='screen';
      for(const b of bolts){
        const p=Math.max(0,(now-b.born)/b.life),tail=Math.max(0,p-.32),near=(1-p)**2,back=(1-tail)**2;
        const opacity=b.musical?audioEnergy.flightPower((now-b.born)/1000):Math.sin(Math.PI*p);
        const tipX=b.x+(b.ox-b.x)*near,tipY=b.y+(b.oy-b.y)*near,startX=b.x+(b.ox-b.x)*back,startY=b.y+(b.oy-b.y)*back;
        const streak=ctx.createLinearGradient(startX,startY,tipX,tipY);streak.addColorStop(0,b.color+'00');streak.addColorStop(1,b.color);
        ctx.strokeStyle=streak;ctx.lineWidth=1.4+(1-p)*7;ctx.shadowColor=b.color;ctx.shadowBlur=lite?0:20;ctx.globalAlpha=opacity*.95;
        ctx.beginPath();ctx.moveTo(startX,startY);ctx.lineTo(tipX,tipY);ctx.stroke();
        ctx.strokeStyle='#fff9e9';ctx.lineWidth=.7+(1-p)*1.5;ctx.globalAlpha=opacity*.85;
        ctx.beginPath();ctx.moveTo(startX+(tipX-startX)*.5,startY+(tipY-startY)*.5);ctx.lineTo(tipX,tipY);ctx.stroke();
        ctx.fillStyle='#fff6d2';ctx.beginPath();ctx.arc(tipX,tipY,Math.max(0,1.5+(1-p)*2),0,Math.PI*2);ctx.fill();
      }
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.shadowBlur=0;
    }
    const touchLife=reduced.matches?240:1100; // Owner: the tap ring looks the same with sound & light on or off
    spots=spots.filter(s=>now-s.born<touchLife);
    for(const s of spots){
      const life=(now-s.born)/touchLife,opacity=1-life,radius=reduced.matches?30:35+life*90;
      const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,radius);g.addColorStop(0,`rgba(255,249,210,${opacity})`);g.addColorStop(.22,`rgba(255,217,108,${opacity*.8})`);g.addColorStop(1,'rgba(245,180,45,0)');
      ctx.fillStyle=g;ctx.fillRect(s.x-radius,s.y-radius,radius*2,radius*2);
      if(!reduced.matches){ctx.strokeStyle=`rgba(255,222,127,${opacity})`;ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(s.x,s.y,Math.max(0,8+life*55),0,Math.PI*2);ctx.stroke();}
    }
    // Musical accents are painted above the small touch response and own their own buffer.
    const musicLife=musicFrame.stage==='build'?90:150;
    musicSpots=musicSpots.filter(s=>now-s.born<musicLife);
    for(const s of musicSpots){
      const life=(now-s.born)/musicLife,opacity=(1-life)*(musicFrame.stage==='build'?.55+musicFrame.buildProgress*.25:.65),radius=musicFrame.stage==='build'?24+life*44:18+life*38;
      const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,radius);
      g.addColorStop(0,`rgba(255,247,207,${opacity})`);g.addColorStop(1,'rgba(255,210,80,0)');
      ctx.fillStyle=g;ctx.fillRect(s.x-radius,s.y-radius,radius*2,radius*2);
    }
    drawFx(now);

    hero.dataset.musicBoltCount=String(bolts.length);hero.dataset.touchVisualCount=String(spots.length);
    ctx.restore();schedule();
  }
  function drawFx(now){
    const dt=lastFxFrame?Math.min(.05,(now-lastFxFrame)/1000):.016;lastFxFrame=(glows.length||coins.length||sweeps.length)?now:0;
    glows=glows.filter(g=>now-g.born<g.life);
    for(const g of glows){
      const rgb=(g.color||[255,220,120]).join(',');
      const life=Math.max(0,(now-g.born)/g.life),a=Math.max(0,1-life)**1.3*(g.soft?.45:1),rise=Math.min(1,life*4),R=(reduced.matches?.7:.35+.65*rise)*Math.min(artW*.62,320);
      ctx.globalCompositeOperation='lighter';
      const grad=ctx.createRadialGradient(g.x,g.y,0,g.x,g.y,R);
      grad.addColorStop(0,`rgba(${rgb},${.9*a})`);grad.addColorStop(.25,`rgba(${rgb},${.5*a})`);grad.addColorStop(.6,`rgba(${rgb},${.18*a})`);grad.addColorStop(1,'rgba(240,170,45,0)');
      ctx.fillStyle=grad;ctx.fillRect(g.x-R,g.y-R,R*2,R*2);
      if(!reduced.matches){
        const rays=14,turn=life*.5;ctx.lineCap='round';
        for(let i=0;i<rays;i++){const ang=i/rays*Math.PI*2+turn,inner=R*.16,outer=R*(.72+.22*Math.sin(i*2.3));
          const x0=g.x+Math.cos(ang)*inner,y0=g.y+Math.sin(ang)*inner,x1=g.x+Math.cos(ang)*outer,y1=g.y+Math.sin(ang)*outer;
          const lg=ctx.createLinearGradient(x0,y0,x1,y1);lg.addColorStop(0,`rgba(${rgb},${.55*a})`);lg.addColorStop(1,'rgba(255,214,110,0)');
          ctx.strokeStyle=lg;ctx.lineWidth=i%2?1:1.8;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();}
        ctx.strokeStyle=`rgba(${rgb},${.7*a})`;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(g.x,g.y,Math.max(0,R*.42*rise+6),0,Math.PI*2);ctx.stroke();
      }
      ctx.globalCompositeOperation='source-over';
    }
    coins=coins.filter(c=>now-c.born<c.delay+c.life);
    for(const c of coins){
      const t=now-c.born-c.delay;if(t<0)continue;
      if(!reduced.matches){
        c.vy+=980*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.spin+=c.spinV*dt;
        const floor=artBottom-c.r-4;if(c.y>floor){c.y=floor;if(c.bounces<2){c.vy=-Math.abs(c.vy)*.38;c.vx*=.7;c.bounces++;if(c.bounces===1&&chime&&c.ring&&!c.quiet)chime.coin(c.i);}else c.vy=0;}
      }
      const fade=Math.min(1,t/120)*Math.min(1,(c.life-t)/450);if(fade<=0)continue;
      const sx=reduced.matches?1:Math.max(.12,Math.abs(Math.cos(c.spin)));
      ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.tilt);ctx.scale(sx,1);ctx.globalAlpha=fade;
      ctx.shadowColor='rgba(255,200,80,.55)';ctx.shadowBlur=lite?0:10;
      const cg=ctx.createRadialGradient(-c.r*.35,-c.r*.4,c.r*.1,0,0,c.r);cg.addColorStop(0,'#fff6cf');cg.addColorStop(.45,'#efc457');cg.addColorStop(1,'#9c6b1a');
      ctx.fillStyle=cg;ctx.beginPath();ctx.arc(0,0,c.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      ctx.strokeStyle='rgba(120,78,16,.85)';ctx.lineWidth=1;ctx.stroke();
      ctx.strokeStyle='rgba(255,236,170,.75)';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(0,0,c.r*.68,0,Math.PI*2);ctx.stroke();
      // a tiny ✦ struck into the coin
      ctx.fillStyle='rgba(120,78,16,.7)';ctx.beginPath();const k=c.r*.36;ctx.moveTo(0,-k);ctx.lineTo(k*.28,-k*.28);ctx.lineTo(k,0);ctx.lineTo(k*.28,k*.28);ctx.lineTo(0,k);ctx.lineTo(-k*.28,k*.28);ctx.lineTo(-k,0);ctx.lineTo(-k*.28,-k*.28);ctx.closePath();ctx.fill();
      ctx.restore();
      if(sx>.96&&!reduced.matches){ctx.globalAlpha=fade*.9;ctx.fillStyle='#fffbe8';ctx.beginPath();ctx.arc(c.x-c.r*.35,c.y-c.r*.4,1.6,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    }
    sweeps=sweeps.filter(w=>now-w.born<w.life);
    for(const w of sweeps){
      const t=Math.max(0,now-w.born)/1000,life=Math.max(0,(now-w.born)/w.life),env=Math.sin(Math.PI*Math.min(1,life))**.5,beatT=t/.405,pulse=playing?Math.min(1,musicFrame.pulse||0):(1-(beatT-Math.floor(beatT)))**3;
      ctx.globalCompositeOperation='screen';ctx.lineCap='round';
      for(let i=0;i<6;i++){
        const ox=i%3===0?artX0-artW*.06:i%3===1?artX0+artW*1.06:artX0+artW*(.2+i*.11),oy=i%3===2?-16:artBottom*(.12+(i%4)*.2);
        const ph=(reduced.matches?0:t)*(1.1+i*.13)+i*1.7+w.seed,tx=artX0+artW*(.5+.4*Math.sin(ph)),ty=Math.max(24,artBottom*(.3+.42*(.5+.5*Math.cos(ph*1.3))));
        const col=laserColors[i],power=Math.min(1,env*(.35+.65*pulse));
        if(reduced.matches){const pool=ctx.createRadialGradient(tx,ty,1,tx,ty,40);pool.addColorStop(0,`rgba(255,249,218,${.4*env})`);pool.addColorStop(1,col+'00');ctx.fillStyle=pool;ctx.fillRect(tx-40,ty-40,80,80);continue;}
        ctx.shadowColor=col;ctx.shadowBlur=lite?0:16+pulse*18;ctx.strokeStyle=col;ctx.globalAlpha=power;ctx.lineWidth=1.2+pulse*2.4;
        ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(tx,ty);ctx.stroke();
        ctx.shadowBlur=lite?0:4;ctx.strokeStyle='#fff9df';ctx.lineWidth=.7;ctx.globalAlpha=power*.8;ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(tx,ty);ctx.stroke();
        ctx.shadowBlur=0;ctx.globalAlpha=1;
        const pool=ctx.createRadialGradient(tx,ty,1,tx,ty,30+pulse*34);pool.addColorStop(0,`rgba(255,249,218,${power*.7})`);pool.addColorStop(.2,col+Math.round(power*90).toString(16).padStart(2,'0'));pool.addColorStop(1,col+'00');
        ctx.fillStyle=pool;ctx.fillRect(tx-70,ty-70,140,140);
      }
      ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.globalCompositeOperation='source-over';
    }
    hero.dataset.fxGlows=String(glows.length);hero.dataset.fxCoins=String(coins.length);hero.dataset.fxSweeps=String(sweeps.length);
  }
  function artPoint(seed){const v=variation(seed+performance.now()%997);return{x:artX0+artW*(.14+.72*v),y:Math.max(28,artBottom*(.14+.62*variation(seed*3.1+v)))};}
  function fxGlow(o){
    o=o||{};const now=performance.now(),x=o.x??(sunX||artX0+artW/2),y=o.y??Math.max(30,sunY||artBottom/2);
    glows.push({x,y,color:lighting?.current()?.colors||[255,220,120],born:now,life:reduced.matches?900:o.soft?2400:1700,soft:!!o.soft});if(glows.length>3)glows.shift();
    // The original glow/ray/ring canvas effect is sufficient; no uncropped DOM burst.
    if(!reduced.matches)for(let i=0;i<(o.soft?3:5);i++)later(()=>{spots.push({...artPoint(i+7),born:performance.now()});if(spots.length>8)spots.shift();schedule();},160+i*110);
    if(chime&&!o.quiet)chime.glow();
    hero.dataset.fxGlowCount=String((Number(hero.dataset.fxGlowCount)||0)+1);schedule();
  }
  function fxCoins(o){
    o=o||{};const now=performance.now(),n=reduced.matches?8:o.soft?12:24;
    for(let i=0;i<n;i++){const r=7+variation(i*5.7+now)*6;
      coins.push({i,x:artX0+artW*(.06+.88*variation(i*1.3+now%13)),y:reduced.matches?Math.max(20,artBottom*(.2+.6*variation(i*2.9))):-14-variation(i*7.1)*90,
        vx:(variation(i*3.3)-.5)*90,vy:30+variation(i*4.4)*120,r,spin:variation(i)*6,spinV:5+variation(i*9.1)*9,tilt:(variation(i*6.6)-.5)*.5,
        born:now,delay:reduced.matches?0:i*45,life:reduced.matches?1200:2300,bounces:0,ring:i%3===0,quiet:!!o.quiet});}
    if(coins.length>72)coins.splice(0,coins.length-72);
    // Clinks while they pour (more on the floor bounce, see drawFx).
    if(chime&&!o.quiet)for(let i=0;i<6;i++)later(()=>chime.coin(i*2+1),40+i*95);
    hero.dataset.fxCoinCount=String((Number(hero.dataset.fxCoinCount)||0)+1);lastFxFrame=0;schedule();
  }
  function fxLaser(o){
    o=o||{};const now=performance.now();sweeps.push({born:now,life:reduced.matches?900:1650,seed:variation(now%1000)*6});if(sweeps.length>2)sweeps.shift();
    // A zap on each pulse of the sweep (the beams flare at 148 BPM, like the music show).
    if(chime&&!o.quiet){const at=Number(readPlayback().time)||0,beats=playing?(musicFrame.stage==='build'?timeline.accents:timeline.events).filter(t=>t>=at&&t<=at+1.65).slice(0,reduced.matches?1:4):[0,1,2,3].slice(0,reduced.matches?1:4).map(v=>at+v*.405);beats.forEach((t,v)=>later(()=>chime.laser(v),Math.max(0,(t-at)*1000)));}
    hero.dataset.fxLaserCount=String((Number(hero.dataset.fxLaserCount)||0)+1);lastFxFrame=0;schedule();
  }
  const FX={glow:fxGlow,coins:fxCoins,laser:fxLaser};

 // Actual homepage opening choreography, using one authoritative display time.
 // Full artwork remains unchanged; geometry is scoped to its complete canonical box.
 function drawOpening(now,bare){
  const t=musicTime,state=readPlayback(),end=Number(state.duration)||181.626009;
  const env=Math.max(0,Math.min(1,t/.6,(end-t)/.8));
  const b=musicFrame,lamp=lighting?.current(),led=lamp?.colors||[255,223,116],pow=Math.min(1,b.pulse||0),build=b.stage==='build'?(b.buildProgress||0):1;
  const intensity=(b.stage!=='build'?1.45:.85+.45*build)*env*1.7*(1+(b.dropPulse||0)*.6);
  const influence=focus?Math.min(1,Math.max(0,(focus.until-now)/600))*(1-Math.min(1,(b.dropPulse||0)*1.8)):0,x=sunX*(1-influence)+(focus?.x||0)*influence,y=sunY*(1-influence)+(focus?.y||0)*influence,r=Math.min(artW*.39,175);hero.dataset.focusTarget=JSON.stringify([Math.round(x),Math.round(y)]);
  ctx.save();ctx.globalCompositeOperation='screen';
  const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba('+led.join(',')+','+((.04+.16*pow)*intensity)+')');g.addColorStop(.43,'rgba('+led.join(',')+','+((.02+.07*pow)*intensity)+')');g.addColorStop(1,'rgba('+led.join(',')+',0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  ctx.beginPath();ctx.ellipse(x,y,Math.max(0,Math.min(93,artW*.16)+pow*14),Math.max(0,Math.min(75,artW*.13)+pow*10),-.12,0,2*Math.PI);ctx.lineWidth=1.4;ctx.strokeStyle='rgba(255,221,135,'+(pow*.29*intensity)+')';ctx.stroke();
  const effectBottom=artBottom*.67,top=Math.min(height*.09,effectBottom*.18),origins=[[artW*.08,top],[artW*.92,top]];if(b.stage!=='build')origins.push([artW*.02,effectBottom*.42],[artW*.98,effectBottom*.42]);
  for(let i=0;i<(lamp?0:origins.length);i++){const sd=i%2,tx=x+(sd?1:-1)*Math.sin(t*.46+i*.7)*r*.65,ty=y+Math.cos(t*.3+i)*16,col=sd?'rgba(252,85,126,'+Math.min(1,(.06+.13*pow)*intensity)+')':'rgba(73,253,169,'+Math.min(1,(.06+.18*pow)*intensity)+')';ctx.beginPath();ctx.moveTo(...origins[i]);ctx.lineTo(tx,ty);ctx.shadowColor=sd?'#fc557e':'#49fda9';ctx.shadowBlur=lite?0:6+pow*14;ctx.strokeStyle=col;if(lite){ctx.globalAlpha=.15;ctx.lineWidth=7+pow*8;ctx.stroke();ctx.globalAlpha=1;}ctx.lineWidth=1.5+pow*1.6;ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,249,223,'+Math.min(1,pow*.35*intensity)+')';ctx.lineWidth=.7;ctx.stroke();}
  function add(n,born){const age=Math.max(0,t-born);if(age>=.85)return;for(let i=0;i<n;i++){const seed=(b.count*97+b.accentCount*31+i),a=variation(seed)*Math.PI*2,s=15+variation(seed+1)*28;specks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,born,life:.4+variation(seed+2)*.45,color:[45,170,195,330][i%4]});}specks=specks.slice(-(bare?12:lite?24:60));}
  const eventTime=b.stage==='build'?timeline.accents?.[b.accentCount-1]:timeline.events?.[b.count-1];
  if((b.stage==='build'?b.accentBeat:b.beat)&&Number.isFinite(eventTime)){
   if(b.stage!=='build'&&b.count%4===0)add(16,eventTime);
   else if(b.stage==='build'&&b.buildProgress>.6&&b.accentCount%4===0)add(8,eventTime);
   if(b.dropPulse>.9)add(24,eventTime);
  }
  specks=specks.filter(p=>t>=p.born&&t-p.born<p.life);
  for(const p of specks){const age=t-p.born,a=Math.max(0,1-age/p.life);ctx.fillStyle='hsla('+p.color+',90%,78%,'+a*.73*env+')';ctx.beginPath();ctx.arc(p.x+p.vx*age,p.y+p.vy*age,Math.max(0,a*2+.25),0,Math.PI*2);ctx.fill();}
  ctx.restore();hero.dataset.openingState='running';hero.dataset.openingTrack=t.toFixed(3);hero.dataset.openingStage=b.stage;hero.dataset.openingSpecks=String(specks.length);hero.dataset.oldestSpeckAge=specks.length?Math.max(...specks.map(p=>t-p.born)).toFixed(3):'0';hero.dataset.musicPasses='1';
 }
 function resetTiming(){lighting?.resetTiming();cancelFocus();glows=[];coins=[];sweeps=[];for(const id of timers)env.cancelLater(id);timers.clear();if(!dead)later(ambient,700);rhythm.reset();displayClock.reset();musicSpots=[];specks=[];bolts=bolts.filter(b=>!b.musical);energy=0;musicFrame={stage:'groove',dropPulse:0,buildProgress:0};hero.dataset.audioEnergy='0';hero.dataset.openingSpecks='0';needsStatic=true;}

 function drawIdle(now){
  const target=focus&&focus.until>now?focus:{x:sunX,y:sunY};
  ctx.save();ctx.globalCompositeOperation='screen';
  const strength=focus?.held ? .22 : .055,rgb=(lighting?.current()?.colors||[255,223,115]).join(',');
  const g=ctx.createRadialGradient(target.x,target.y,0,target.x,target.y,Math.min(width*.3,120));g.addColorStop(0,`rgba(${rgb},${strength})`);g.addColorStop(1,'rgba(255,223,115,0)');ctx.fillStyle=g;ctx.fillRect(target.x-120,target.y-120,240,240);
  if(!lighting&&!reduced.matches)for(let i=0;i<6;i++){ctx.strokeStyle=laserColors[i];ctx.globalAlpha=strength;ctx.lineWidth=focus?.held?1.5:.7;ctx.beginPath();ctx.moveTo(i%2?width:0,height*(.12+i*.10));ctx.lineTo(target.x,target.y);ctx.stroke();}
  ctx.restore();hero.dataset.idleBeams=reduced.matches?'0':'6';
 }
 function beginFocus(x,y){if(dead||!viewable)return false;pendingRelease=null;focus={x:Math.max(0,Math.min(width,x)),y:Math.max(0,Math.min(height,y)),until:Infinity,held:true};needsStatic=true;schedule();return true;}
 function moveFocus(x,y){if(!focus?.held)return false;return beginFocus(x,y);}
 function bloom(x,y){fxGlow({x,y,quiet:!readPlayback().sound});hero.dataset.gestureBlooms=String((Number(hero.dataset.gestureBlooms)||0)+1);}
 function releaseFocus(){if(!focus?.held)return false;const now=performance.now(),p={x:focus.x,y:focus.y},state=readPlayback();focus={...p,until:now+600,held:false};if(state.playing&&!reduced.matches){const next=timeline.events?.find(t=>t>state.time+.02);if(next!==undefined&&next-state.time<1.0)pendingRelease={...p,time:next};else bloom(p.x,p.y);}else bloom(p.x,p.y);needsStatic=true;schedule();return true;}
 function cancelFocus(){focus=null;pendingRelease=null;needsStatic=true;}

 function tap(x,y){if(dead||!viewable||x<0||x>width||y<0||y>height)return false;const now=performance.now();spots.push({x,y,born:now});if(spots.length>6)spots.shift();hero.dataset.touchCount=String((Number(hero.dataset.touchCount)||0)+1);if(!readPlayback().playing){focus={x,y,until:now+2400};launchDepth(x,y,now,Number(hero.dataset.touchCount));}if(readPlayback().sound&&chime)chime.tap(x/width);schedule();return true;}
 function effect(id){if(dead||!viewable||!FX[id])return false;FX[id]({quiet:!readPlayback().sound});hero.dataset.fxLastTap=id;hero.dataset.fxTaps=String((Number(hero.dataset.fxTaps)||0)+1);return true;}
 function ambient(){if(dead)return;if(!lighting&&viewable&&!reduced.matches&&!readPlayback().playing&&width>0)fxGlow({quiet:true,soft:true});later(ambient,3400);}
 function setVisible(value){viewable=!!value;if(!viewable){if(frame)env.cancelRaf(frame);frame=0;spots=[];musicSpots=[];specks=[];bolts=[];glows=[];coins=[];sweeps=[];focus=null;pendingRelease=null;clear();}else{needsStatic=true;schedule();}}
 function refresh(preferenceChanged=false){if(dead)return;if(preferenceChanged){spots=[];musicSpots=[];specks=[];bolts=[];glows=[];coins=[];sweeps=[];clear();}needsStatic=true;schedule();}
 function destroy(){if(dead)return;dead=true;cancelFocus();if(frame)env.cancelRaf(frame);frame=0;for(const id of timers)env.cancelLater(id);timers.clear();spots=[];musicSpots=[];specks=[];bolts=[];glows=[];coins=[];sweeps=[];clear();}
 resize();later(ambient,700);
 return{resize,tap,beginFocus,moveFocus,releaseFocus,cancelFocus,effect,setVisible,refresh,resetTiming,destroy,snapshot:()=>({destroyed:dead,timers:timers.size,raf:!!frame,width,height,playing:!!readPlayback().playing})};
}
return{create,geometry,createDisplayClock};
});
