/* AE-HOME-REPLICA v2476.69 — premium /premium/eternal-sun/ default mode 「首頁重現」.
   GENERATED from /ae-home-light.js (homepage sound-light) by build_replica.py: the functions
   destination(), launchDepth(), draw(), drawFx(), artPoint(), fxGlow() are copied VERBATIM; only this
   shim maps the homepage's .hero / painting box / player clock onto the premium stage + #music element.
   Overlay canvas only — the painting <img> is never touched. */
(()=>{
  'use strict';
  const canvas=document.getElementById('homefx');if(!canvas)return;
  const ctx=canvas.getContext('2d'),audio=document.getElementById('music');
  const hero={dataset:{},appendChild:el=>document.getElementById('stage').appendChild(el)};
  const timeline=window.aeHomeBeatTimeline;
  const rhythm=window.aeHomeAudioEnergy.createRhythm(timeline?.events,timeline?.accents,timeline?.sections);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const forceLite=new URLSearchParams(location.search).get('lite')==='1';
  let lite=forceLite,liteLatch=forceLite,frameEma=16.7,presentMs=12,lights=true,playing=false,frame=0,lastPaint=0,energy=0,viewable=true;
  let width=0,height=0,artBottom=0,artX0=0,artW=0,sunX=0,sunY=0,spots=[],musicSpots=[],bolts=[],focus=null,needsStatic=true;
  let musicFrame={stage:'groove',dropPulse:0,buildProgress:0};
  let glows=[],coins=[],sweeps=[],lastFxFrame=0,active=true,ambient=true,lasersOn=true,spotsOn=true,idleOn=true,offY=0,dpr=1;
  const DISPLAY_LEAD=.012;
  function displayTime(){const ct=audio.currentTime||0;return ct+Math.min(.032,Math.max(DISPLAY_LEAD,presentMs/1000));}
  function clear(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(dpr,0,0,dpr,0,offY*dpr);}
  // homepage resize(): painting box -> art box. Here the box is the premium layout L.p (stage coords);
  // the canvas is translated by p.y so the homepage's "art top = 0" geometry holds unchanged.
  function resize(){
    const P=window.__premium;if(!P)return;const p=P.L.p;dpr=Math.min(devicePixelRatio||1,2);
    const W=innerWidth,H=innerHeight;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    offY=p.y;width=W;height=H;artX0=p.x;artW=p.w;artBottom=p.h;
    const paintWidth=p.w,left=p.x;sunX=left+.52*paintWidth;sunY=Math.min(artBottom-20,paintWidth*1536/1110*.522);
    ctx.setTransform(dpr,0,0,dpr,0,offY*dpr);needsStatic=true;
  }
  function schedule(){if(!frame&&active&&!document.hidden)frame=requestAnimationFrame(draw);}
  const laserColors=['#ff416d','#57ffa0','#ffe28d','#65dbff','#c987ff','#ffac68'];
  const variation=seed=>{const n=Math.sin(seed*12.9898+78.233)*43758.5453;return n-Math.floor(n);};
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
    if(!lights||document.hidden||!viewable){clear();return;}
    if(now-lastPaint>0&&now-lastPaint<8){schedule();return;}
    // presentMs is how long the previous frame took to come back. The beat is drawn for that
    // far ahead so a slow frame still lands on the kick that is playing when it appears.
    const fd=now-lastPaint;lastPaint=now;
    if(fd>0&&fd<250){frameEma=frameEma*.8+fd*.2;presentMs=presentMs*.5+Math.min(fd,80)*.5;}
    if(playing&&fd<250&&(fd>28||frameEma>22))liteLatch=true;
    if(!playing&&!forceLite)liteLatch=false;
    lite=forceLite||liteLatch;
    const bare=lite&&frameEma>45;
    hero.dataset.lightLite=lite?'1':'0';hero.dataset.lightBare=bare?'1':'0';
    needsStatic=false;ctx.clearRect(0,0,width,height);ctx.save();ctx.beginPath();ctx.rect(artX0,0,artW,artBottom);ctx.clip();
    if(!reduced.matches&&(ambient||spotsOn)){ // v72: beat clock runs for 歡樂派對 or the 三光點 toggle; v70: ambient homepage show only in 歡樂派對; tap beams/ripples below are global
      let bass=0,beat={beat:false,count:Number(hero.dataset.beatCount)||0,pulse:0,phase:0,interval:60/148,stage:'groove',dropPulse:0,buildProgress:0,accentCount:0};
      if(playing){
      // One frame of lead so the kick is the one on screen when the frame presents.
      // Never more than 40ms ahead of the media clock the ear is compared against.
      const tt=displayTime();
      bass=window.aeHomeAudioEnergy.energyAt(timeline,tt);
      beat=rhythm.update(bass,tt);
      musicFrame=beat;
      hero.dataset.beatCount=String(beat.count);hero.dataset.beatPulse=beat.pulse.toFixed(3);hero.dataset.beatInterval=beat.interval.toFixed(3);
      hero.dataset.musicTime=tt.toFixed(3);hero.dataset.musicStage=beat.stage;
      hero.dataset.accentCount=String(beat.accentCount);hero.dataset.dropPulse=beat.dropPulse.toFixed(3);
      if(!bare&&((beat.beat&&beat.stage!=='build')||(beat.accentBeat&&beat.stage==='build'))){
        if(beat.stage!=='build'&&lasersOn&&ambient)launchDepth(null,null,now,beat.count); // v71: 雷射 toggle
        if(spotsOn)for(let i=0;i<3;i++){const hit=destination(i*2,beat.sweep,now);musicSpots.push({...hit,born:now});} // v72: 三光點 toggle
        if(musicSpots.length>9)musicSpots.splice(0,musicSpots.length-9);
      }
      }
      energy=Math.max(bass,energy*.84);hero.dataset.audioEnergy=energy.toFixed(3);
      if(ambient){ // v72: veil glow + lasers only in 歡樂派對
      const shade=ctx.createLinearGradient(0,Math.max(0,artBottom-100),0,artBottom);shade.addColorStop(0,'rgba(2,5,4,.40)');shade.addColorStop(1,'rgba(2,5,4,0)');/* v74: 歡樂派對 is daytime — no bottom dimming on the art */
      const glow=ctx.createRadialGradient(sunX,sunY,3,sunX,sunY,Math.min(width*.42,190));
      glow.addColorStop(0,`rgba(255,223,115,${energy*.16+beat.pulse*.35})`);glow.addColorStop(.45,`rgba(243,178,48,${energy*.08+beat.pulse*.18})`);glow.addColorStop(1,'rgba(240,170,45,0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,width,artBottom);
      const colors=laserColors;
      const sweep=playing?(beat.sweep||0):beat.count+beat.phase;
      ctx.globalCompositeOperation='screen';
      const targets=[],group=Math.floor(beat.count/4),pattern=Math.floor(variation(group+3)*3);
      const beamCount=beat.stage==='build'?(beat.buildProgress>.7?5:3):6;
      hero.dataset.laserPattern=String(pattern);hero.dataset.musicBeams=String(beamCount);
      for(let i=0;i<(lasersOn?beamCount:0);i++){ // v71: 雷射 toggle hides the homepage ambient lasers (gold points stay)
        const originX=i%3===0?artX0-artW*.08:i%3===1?artX0+artW*1.08:artX0+artW*(.15+i*.12),originY=i%3===2?-20:artBottom*(.15+(i%4)*.20);
        const target=destination(i,sweep,now),targetX=target.x,targetY=target.y;targets.push({x:Math.round(targetX),y:Math.round(targetY)});
        const power=Math.min(1,(beat.stage==='build'?.06+beat.buildProgress*.06:.07)+energy*.035+beat.pulse*.85+beat.dropPulse*.12);
        ctx.shadowColor=colors[i];ctx.shadowBlur=lite?0:14+beat.pulse*25;
        ctx.strokeStyle=colors[i];ctx.globalAlpha=Math.min(1,power*1.5+.14);ctx.lineWidth=1.4+beat.pulse*2.6; /* v74 day: stronger beams on the bright art */
        ctx.beginPath();ctx.moveTo(originX,originY);ctx.lineTo(targetX,targetY);ctx.stroke();
        // Narrow pale core and prismatic rays give the beam a refracted edge.
        ctx.shadowBlur=lite?0:4;ctx.strokeStyle='#ffffff';ctx.lineWidth=1.1;ctx.globalAlpha=Math.min(1,power*1.2+.2); /* v74: white core */
        ctx.beginPath();ctx.moveTo(originX,originY);ctx.lineTo(targetX,targetY);ctx.stroke();
        if(!lite)for(let j=-1;j<=1;j++){
          const angle=Math.atan2(targetY-originY,targetX-originX)+j*(pattern===0?.12:pattern===1?.34:.52)+Math.sin(sweep)*.18;
          const reach=Math.min(width*.24,150)*(1+beat.pulse*.22);
          const endX=targetX+Math.cos(angle)*reach,endY=targetY+Math.sin(angle)*reach;
          const trail=ctx.createLinearGradient(targetX,targetY,endX,endY);trail.addColorStop(0,colors[(i+j+colors.length)%colors.length]);trail.addColorStop(1,'rgba(255,255,255,0)');
          ctx.strokeStyle=trail;ctx.globalAlpha=power*.72;ctx.lineWidth=.8+beat.pulse;
          ctx.beginPath();ctx.moveTo(targetX,targetY);ctx.lineTo(endX,endY);ctx.stroke();
        }
        // Soft light pools sit on the unchanged painted surface, fading outward.
        ctx.globalAlpha=1;ctx.shadowBlur=0;
        if(!bare){
          const pool=ctx.createRadialGradient(targetX,targetY,1,targetX,targetY,38+beat.pulse*48);
          pool.addColorStop(0,`rgba(255,249,218,${power*.60})`);pool.addColorStop(.18,colors[i]+Math.round(power*75).toString(16).padStart(2,'0'));pool.addColorStop(1,colors[i]+'00');
          ctx.fillStyle=pool;ctx.fillRect(targetX-90,targetY-90,180,180);
        }
        ctx.strokeStyle=colors[i];ctx.lineWidth=.7;ctx.globalAlpha=beat.pulse*.6;ctx.beginPath();ctx.arc(targetX,targetY,Math.max(0,8+beat.phase*28),0,Math.PI*2);ctx.stroke();
      }
      hero.dataset.laserTargets=JSON.stringify(targets);if(focus&&focus.until-now>600){hero.dataset.lastFocusTargets=JSON.stringify(targets);hero.dataset.lastFocusPaintTime=now.toFixed(1);}
      hero.dataset.laserFocus=focus&&focus.until>now?'active':'ambient';
      ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
      ctx.shadowBlur=0;}
    }
    bolts=bolts.filter(b=>now-b.born<b.life);
    if(!reduced.matches){
      ctx.globalCompositeOperation='screen';
      for(const b of bolts){
        const p=Math.max(0,(now-b.born)/b.life),tail=Math.max(0,p-.32),near=(1-p)**2,back=(1-tail)**2;
        const opacity=b.musical?window.aeHomeAudioEnergy.flightPower((now-b.born)/1000):Math.sin(Math.PI*p);
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
      const life=(now-s.born)/musicLife,opacity=(1-life)*(musicFrame.stage==='build'?.75+musicFrame.buildProgress*.25:.95),radius=musicFrame.stage==='build'?24+life*44:18+life*38;
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
      const life=Math.max(0,(now-g.born)/g.life),a=Math.max(0,1-life)**1.3*(g.soft?.45:1),rise=Math.min(1,life*4),R=(reduced.matches?.7:.35+.65*rise)*Math.min(artW*.62,320);
      ctx.globalCompositeOperation='lighter';
      const grad=ctx.createRadialGradient(g.x,g.y,0,g.x,g.y,R);
      grad.addColorStop(0,`rgba(255,250,222,${.9*a})`);grad.addColorStop(.25,`rgba(255,220,120,${.5*a})`);grad.addColorStop(.6,`rgba(240,170,45,${.18*a})`);grad.addColorStop(1,'rgba(240,170,45,0)');
      ctx.fillStyle=grad;ctx.fillRect(g.x-R,g.y-R,R*2,R*2);
      if(!reduced.matches){
        const rays=14,turn=life*.5;ctx.lineCap='round';
        for(let i=0;i<rays;i++){const ang=i/rays*Math.PI*2+turn,inner=R*.16,outer=R*(.72+.22*Math.sin(i*2.3));
          const x0=g.x+Math.cos(ang)*inner,y0=g.y+Math.sin(ang)*inner,x1=g.x+Math.cos(ang)*outer,y1=g.y+Math.sin(ang)*outer;
          const lg=ctx.createLinearGradient(x0,y0,x1,y1);lg.addColorStop(0,`rgba(255,240,190,${.55*a})`);lg.addColorStop(1,'rgba(255,214,110,0)');
          ctx.strokeStyle=lg;ctx.lineWidth=i%2?1:1.8;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();}
        ctx.strokeStyle=`rgba(255,226,140,${.7*a})`;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(g.x,g.y,Math.max(0,R*.42*rise+6),0,Math.PI*2);ctx.stroke();
      }
      ctx.globalCompositeOperation='source-over';
    }
    coins=coins.filter(c=>now-c.born<c.delay+c.life);
    for(const c of coins){
      const t=now-c.born-c.delay;if(t<0)continue;
      if(!reduced.matches){
        c.vy+=980*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.spin+=c.spinV*dt;
        const floor=artBottom-c.r-4;if(c.y>floor){c.y=floor;if(c.bounces<2){c.vy=-Math.abs(c.vy)*.38;c.vx*=.7;c.bounces++;if(c.bounces===1&&window.aeChime&&c.ring&&!c.quiet)window.aeChime.coin(c.i);}else c.vy=0;}
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
      const t=Math.max(0,now-w.born)/1000,life=Math.max(0,(now-w.born)/w.life),env=Math.sin(Math.PI*Math.min(1,life))**.5,beatT=t/.405,pulse=(1-(beatT-Math.floor(beatT)))**3;
      ctx.globalCompositeOperation='screen';ctx.lineCap='round';
      for(let i=0;i<6;i++){
        const ox=i%3===0?artX0-artW*.06:i%3===1?artX0+artW*1.06:artX0+artW*(.2+i*.11),oy=i%3===2?-16:artBottom*(.12+(i%4)*.2);
        const ph=t*(1.1+i*.13)+i*1.7+w.seed,tx=artX0+artW*(.5+.4*Math.sin(ph)),ty=Math.max(24,artBottom*(.3+.42*(.5+.5*Math.cos(ph*1.3))));
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
    o=o||{};const now=performance.now(),x=sunX||artX0+artW/2,y=Math.max(30,sunY||artBottom/2);
    glows.push({x,y,born:now,life:reduced.matches?900:o.soft?2400:1700,soft:!!o.soft});if(glows.length>3)glows.shift();
    if(!o.soft){const burst=document.createElement('span');burst.className='ae-gold-burst';burst.setAttribute('aria-hidden','true');burst.style.left=x+'px';burst.style.top=y+'px';hero.appendChild(burst);setTimeout(()=>burst.remove(),reduced.matches?240:1650);}
    if(!reduced.matches)for(let i=0;i<(o.soft?3:5);i++)setTimeout(()=>{spots.push({...artPoint(i+7),born:performance.now()});if(spots.length>8)spots.shift();schedule();},160+i*110);
    if(window.aeChime&&!o.quiet)window.aeChime.glow();
    hero.dataset.fxGlowCount=String((Number(hero.dataset.fxGlowCount)||0)+1);schedule();
  }
  // homepage pointerdown (idle branch): ring spot + 6 beams from the edges into the finger + focus + .ae-gold-burst
  function tap(sx,sy){
    if(!active)return;const x=sx,y=sy-offY,now=performance.now();
    if(y<0||y>=artBottom||x<artX0||x>artX0+artW)return;
    spots.push({x,y,born:now});if(spots.length>6)spots.shift();
    hero.dataset.touchCount=String((Number(hero.dataset.touchCount)||0)+1);
    const was=playing;playing=false; // homepage idle tap look: 6 beams, 650 ms flight (as recorded by the Owner)
    if(!was&&ambient)focus={x,y,until:now+2400};
    launchDepth(x,y,now,Number(hero.dataset.touchCount)||1);playing=was;
    const burst=document.createElement('span');burst.className='ae-gold-burst';burst.setAttribute('aria-hidden','true');burst.style.left=sx+'px';burst.style.top=sy+'px';
    hero.appendChild(burst);setTimeout(()=>burst.remove(),reduced.matches?240:1650);
    schedule();
  }
  function sync(){const was=playing;playing=!audio.paused&&!audio.ended;if(was&&!playing){energy=0;rhythm.reset();musicSpots=[];musicFrame={stage:'groove',dropPulse:0,buildProgress:0};}if(!was&&playing)rhythm.reset();schedule();}
  for(const ev of ['play','playing','pause','ended','seeked'])audio.addEventListener(ev,sync);
  function setActive(on){active=!!on;canvas.style.display=active?'':'none';if(!active){if(frame)cancelAnimationFrame(frame);frame=0;spots=[];bolts=[];musicSpots=[];glows=[];clear();}else{resize();schedule();}}
  addEventListener('resize',()=>setTimeout(()=>{resize();schedule();},60));
  document.addEventListener('visibilitychange',()=>schedule());
  // homepage ambientTick: the soft 發亮光 glow breathes on its own every 3.4 s while the music is not playing
  function ambientTick(){if(active&&idleOn&&!document.hidden&&!reduced.matches&&!playing&&width>0)fxGlow({quiet:true,soft:true});setTimeout(ambientTick,3400);}
  setTimeout(ambientTick,700);
  function setLasers(on){on=!!on;if(on===lasersOn)return;lasersOn=on;if(!on)bolts=bolts.filter(b=>!b.musical);schedule();}
  function setSpots(on){spotsOn=!!on;if(!spotsOn)musicSpots=[];schedule();}
  function setIdle(on){idleOn=!!on;if(!idleOn)glows=glows.filter(g=>!g.soft);schedule();}
  function setAmbient(on){on=!!on;if(on===ambient)return;ambient=on;musicSpots=[];glows=[];focus=null;if(!on)clear();schedule();}
  window.aeHomeReplica={tap,setActive,setAmbient,setLasers,setSpots,setIdle,get spots3(){return spotsOn},get idle(){return idleOn},get lasers(){return lasersOn},get ambient(){return ambient},resize,get active(){return active},state:()=>({...hero.dataset,playing,bolts:bolts.length,spots:spots.length,musicSpots:musicSpots.length,glows:glows.length})};
  const boot=()=>{if(window.__premium){resize();sync();}else setTimeout(boot,50);};boot();
})();
