import sys
src=open('ae-home-light.js').read().split('\n')
L=lambda a,b:'\n'.join(src[a-1:b])
# verbatim homepage segments (1-based line ranges in src/ae-home-light.js)
seg=[L(33,45),L(112,233),L(282,349)]
head=r"""/* AE-HOME-REPLICA v2476.69 — premium /premium/eternal-sun/ default mode 「首頁重現」.
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
"""
tail=r"""
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
"""
body='\n'.join(seg)
A='    if(!reduced.matches){\n      let bass=0'
assert A in body
body=body.replace(A,'    if(!reduced.matches&&(ambient||spotsOn)){ // v72: beat clock runs for 歡樂派對 or the 三光點 toggle; v70: ambient homepage show only in 歡樂派對; tap beams/ripples below are global\n      let bass=0',1)
B1="        if(beat.stage!=='build')launchDepth(null,null,now,beat.count);"
assert B1 in body;body=body.replace(B1,"        if(beat.stage!=='build'&&lasersOn&&ambient)launchDepth(null,null,now,beat.count); // v71: 雷射 toggle",1)
B3="        for(let i=0;i<3;i++){const hit=destination(i*2,beat.sweep,now);musicSpots.push({...hit,born:now});}"
assert B3 in body;body=body.replace(B3,"        if(spotsOn)for(let i=0;i<3;i++){const hit=destination(i*2,beat.sweep,now);musicSpots.push({...hit,born:now});} // v72: 三光點 toggle",1)
B4="      const shade=ctx.createLinearGradient"
assert B4 in body;body=body.replace(B4,"      if(ambient){ // v72: veil glow + lasers only in 歡樂派對\n"+B4,1)
B5="      ctx.shadowBlur=0;\n    }\n    bolts=bolts.filter"
assert B5 in body;body=body.replace(B5,"      ctx.shadowBlur=0;}\n    }\n    bolts=bolts.filter",1)
B2="      for(let i=0;i<beamCount;i++){"
assert B2 in body;body=body.replace(B2,"      for(let i=0;i<(lasersOn?beamCount:0);i++){ // v71: 雷射 toggle hides the homepage ambient lasers (gold points stay)",1)
open('premium/eternal-sun/assets/home-replica.js','w').write(head+body+tail)
