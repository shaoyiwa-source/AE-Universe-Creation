/* AE-HOME-SOUNDLIGHT continuous sync 20261014
   ONE homepage player: one <audio> element (the real 148 BPM track, played natively — no
   MediaElementSource, no second AudioContext), ONE track clock, ONE state machine shared by
   the 15 s opening, the dock ♫ button, replay and stop. Lights are a pure function of the track
   clock + the measured beat timeline (ae-home-beats.js), so pause/seek/resize/tab-switch can
   never leave light and sound on different clocks.
   The track clock re-anchors to media.currentTime whenever it moves (no low-pass). While the
   full-power laser frame is too slow to present on the beat, the expensive passes stay off
   for the rest of that playback so the kick drawn is the kick being heard.
   phase: idle → opening(sound: audio|light|loading) → ended | music ⇄ paused */
(()=>{
  'use strict';
  const hero=document.querySelector('.hero'),canvas=document.getElementById('ae-home-light');
  if(!hero||!canvas)return;
  const ctx=canvas.getContext('2d'),audio=document.getElementById('ae-home-audio');
  // Owner 2026-10-18: ONE control — 開聲光/關聲光 (Sound & Light On/Off) toggles sound and light together.
  // The laser visuals below are unchanged from 8b64dbf.
  // Owner 2026-10-27 (v2476.10): one small round icon toggle (#aeSoundButton) controls SOUND only; the lights run on their own.
  const slBtn=document.getElementById('aeSoundButton')||document.getElementById('aeSoundLightButton'),verTag=document.getElementById('aeArtVersion'),status=document.getElementById('aeLightStatus');
  const hint=document.getElementById('aeTapHint');let hintDone=false;
  if(verTag){const v=(document.querySelector('meta[name="ae-version"]')||{}).content||'';const m=v.match(/^v[\d.]+/);if(m)verTag.textContent=m[0];}
  const timeline=window.aeHomeBeatTimeline;
  const rhythm=window.aeHomeAudioEnergy.createRhythm(timeline?.events,timeline?.accents,timeline?.sections);
  let tapSound=false,lastTap=-1,noiseBuffer,tapAnalyser,tapSamples;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const forceLite=new URLSearchParams(location.search).get('lite')==='1';
  // liteLatch sticks for the rest of a playback once a frame misses the beat. Exiting early
  // brought shadowBlur back and the next kicks landed a whole frame late.
  let lite=forceLite,liteLatch=forceLite,frameEma=16.7,presentMs=12,lights=true,playing=false,busy=false,audioContext,frame=0,lastPaint=0,energy=0,viewable=true;
  let width=0,height=0,artBottom=0,artX0=0,artW=0,sunX=0,sunY=0,spots=[],musicSpots=[],bolts=[],focus=null,needsStatic=true;
  let musicFrame={stage:'groove',dropPulse:0,buildProgress:0};
  let glows=[],coins=[],sweeps=[],lastFxFrame=0; // one-shot effects from the three round buttons (發亮光 / 金幣 / 雷射光)
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
  const zh=()=>document.documentElement.lang==='zh-Hant';
  let message='';
  // Sound is wanted by default; only an explicit mute (the icon) is remembered.
  const SOUND_KEY='ae-home-sound';
  const wantSound=()=>{try{return localStorage.getItem(SOUND_KEY)!=='off';}catch(e){return true;}};
  const setWant=on=>{try{if(on)localStorage.removeItem(SOUND_KEY);else localStorage.setItem(SOUND_KEY,'off');}catch(e){}};
  const iconOnly=!!slBtn&&slBtn.id==='aeSoundButton';
  function soundOn(){const P=window.aeHomePlayer;return !!P&&(P.phase==='music'||P.phase==='opening')&&P.sound==='audio'&&!audio.paused;}
  function labels(){
    const ph=window.aeHomePlayer?window.aeHomePlayer.phase:'idle',on=soundOn();
    // The label is the real state of the sound (light follows the same button).
    if(iconOnly){slBtn.setAttribute('aria-label',zh()?'聲音 開/關':'Sound on/off');slBtn.dataset.state=on?'on':busy?'loading':wantSound()?'waiting':'off';
      slBtn.title=on?(zh()?'聲音：開':'Sound: on'):busy?(zh()?'聲音載入中':'Sound loading'):wantSound()?(zh()?'點一下畫面即開啟聲音':'Tap anywhere to start the sound'):(zh()?'聲音：關':'Sound: off');}
    else slBtn.textContent=on?(zh()?'關聲光':'Sound & Light Off'):(zh()?'開聲光':'Sound & Light On');
    slBtn.setAttribute('aria-pressed',String(on));slBtn.setAttribute('aria-busy',String(busy));hero.dataset.tapSound=tapSound?'on':'off';
    status.textContent=message||(reduced.matches?(zh()?'減少動態模式':'Reduced motion'):'');
    hero.dataset.soundState=on?'on':busy?'loading':'off';
    hero.dataset.musicState=busy?'loading':ph==='music'?'playing':'paused';hero.dataset.lightState=lights?'on':'off';
  }
  let resizeQueued=0,lastW=-1,lastH=-1;
  // Coalesce ResizeObserver/MutationObserver bursts into one canvas reallocation per frame.
  function queueResize(){if(resizeQueued)return;resizeQueued=requestAnimationFrame(()=>{resizeQueued=0;resize();schedule();});}
  function resize(){
    const r=hero.getBoundingClientRect(),copy=hero.querySelector('.hero-copy').getBoundingClientRect();
    width=r.width;height=r.height;
    const pseudo=getComputedStyle(hero,'::before'),paintWidth=Number.parseFloat(pseudo.width),paintTop=Number.parseFloat(pseudo.top);
    // The painting box (::before left/top/width + transform), clipped to the hero. Lasers, glow, taps and
    // the version tag all follow it, so they stay inside the artwork whatever size the CSS gives it.
    let shift=-.52*paintWidth;try{const m=new DOMMatrixReadOnly(pseudo.transform==='none'?undefined:pseudo.transform);if(isFinite(m.m41))shift=m.m41;}catch(e){}
    const left=(Number.parseFloat(pseudo.left)||width/2)+shift,top=isFinite(paintTop)?paintTop:0;
    const visible=Number.parseFloat(getComputedStyle(hero).getPropertyValue('--art-visible'))||1;
    let paintBottom=Math.min(height,innerHeight-(r.top+scrollY),top+paintWidth*1536/1110*visible);
    if(paintWidth>0&&isFinite(left)){artX0=Math.max(0,left);artW=Math.max(1,Math.min(width,left+paintWidth)-artX0);}else{artX0=0;artW=width;paintBottom=height;}
    // Hero text below the painting (phones) still caps the light area, as before.
    const copyOverlaps=copy.right>artX0+4&&copy.left<artX0+artW-4;
    artBottom=Math.max(0,copyOverlaps?Math.min(paintBottom,copy.top-r.top-12):paintBottom);
        sunX=left+.52*paintWidth;sunY=Math.min(artBottom-20,top+paintWidth*1536/1110*.522);
    hero.dataset.artBox=JSON.stringify([Math.round(artX0),Math.round(artX0+artW),Math.round(artBottom)]);
    // Version tag: small inset inside the painting's visible bottom-right corner.
    // Version tag: bottom-right corner of the painting's visible area (14px inset). It only steps up when a
    // heading line or the sound button really sits under that corner (phones where the text overlaps the art).
    if(verTag){const inset=14,th=verTag.offsetHeight||16,tw=verTag.offsetWidth||60,tagR=artX0+artW-inset,tagL=tagR-tw;let tagBottom=paintBottom-inset;
      const lines=[];for(const el of hero.querySelectorAll('.hero-copy .kicker,.hero-copy h1,.hero-copy .hero-subtitle,.hero-copy .rainbow,.hero-copy .scroll-hint,#aeSoundLightButton')){
        if(el.id){lines.push(el.getBoundingClientRect());continue;}const rg=document.createRange();rg.selectNodeContents(el);for(const q of rg.getClientRects())if(q.width>0)lines.push(q);}
      for(let pass=0;pass<8;pass++){let moved=false;for(const q of lines){const qt=q.top-r.top,qb=q.bottom-r.top,ql=q.left-r.left,qr=q.right-r.left;
        if(qr>tagL-8&&ql<tagR+8&&qb>tagBottom-th-6&&qt<tagBottom+6){tagBottom=qt-8;moved=true;}}if(!moved)break;}
      verTag.style.left='auto';verTag.style.transform='none';verTag.style.right=Math.max(0,width-(artX0+artW))+inset+'px';verTag.style.top=Math.max(0,tagBottom-th)+'px';hero.dataset.tagBottom=String(Math.round(tagBottom));}
    // v2476.11: ✦ effects button sits at the painting's bottom-right, in the sound icon's column, just above
    // the hero text and the version tag (never over the title, badge or buttons); the tray slides out leftward.
    {const dock=hero.querySelector(':scope>.ae-fx-dock');if(dock){const bs=44,snd=document.getElementById('aeSoundButton');
      let rightEdge=Math.min(width,artX0+artW)-20;if(snd){const q=snd.getBoundingClientRect();if(q.width>0)rightEdge=q.right-r.left;}
      let bottom=artBottom-10;if(verTag){const tt=Number.parseFloat(verTag.style.top);if(isFinite(tt)&&rightEdge-bs<width-Number.parseFloat(verTag.style.right||0)+4)bottom=Math.min(bottom,tt-10);}
      const sndBottom=snd?snd.getBoundingClientRect().bottom-r.top:116;const topPx=Math.max(sndBottom+12,bottom-bs);
      dock.style.top=Math.round(topPx)+'px';dock.style.right=Math.round(width-rightEdge)+'px';dock.style.left='auto';hero.dataset.fxDock=JSON.stringify([Math.round(rightEdge-bs),Math.round(topPx)]);}}
    // v2476.12: the "tap for sound" hint shares the ✦ row, centred on the painting if it fits, else in the free
    // space left of ✦ (never over ✦, the sound icon, the headline or the badge).
    if(hint&&!hint.hidden){const dock=hero.querySelector(':scope>.ae-fx-dock'),w=hint.offsetWidth||190,h=hint.offsetHeight||36;
      let fxL=artX0+artW-20,cy=artBottom-32;if(dock){const q=dock.getBoundingClientRect();if(q.width>0){fxL=q.left-r.left;cy=q.top-r.top+q.height/2;}}
      const lo=Math.max(artX0,0)+12,hi=fxL-12,mid=artX0+artW/2;let x=Math.min(Math.max(mid-w/2,lo),hi-w);if(x<4)x=4;
      hint.style.left=Math.round(x)+'px';hint.style.top=Math.round(cy-h/2)+'px';hint.style.right='auto';hero.dataset.tapHintBox=JSON.stringify([Math.round(x),Math.round(cy-h/2),Math.round(x+w),Math.round(cy+h/2)]);}
    const ratio=Math.min(devicePixelRatio||1,2),cw=Math.round(width*ratio),ch=Math.round(height*ratio);
    if(cw!==lastW||ch!==lastH){canvas.width=cw;canvas.height=ch;lastW=cw;lastH=ch;}ctx.setTransform(ratio,0,0,ratio,0,0);
    hero.dataset.artLightBottom=String(Math.round(artBottom));needsStatic=true;
  }
  function schedule(){if(!frame&&lights&&!document.hidden&&viewable&&(playing||spots.length||musicSpots.length||bolts.length||glows.length||coins.length||sweeps.length||needsStatic||(focus&&focus.until>performance.now())))frame=requestAnimationFrame(draw);}
  function clear(){ctx.clearRect(0,0,width,height);hero.dataset.audioEnergy='0';}
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
    if(!reduced.matches){
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
        if(beat.stage!=='build')launchDepth(null,null,now,beat.count);
        for(let i=0;i<3;i++){const hit=destination(i*2,beat.sweep,now);musicSpots.push({...hit,born:now});}
        if(musicSpots.length>9)musicSpots.splice(0,musicSpots.length-9);
      }
      }
      energy=Math.max(bass,energy*.84);hero.dataset.audioEnergy=energy.toFixed(3);
      const shade=ctx.createLinearGradient(0,Math.max(0,artBottom-100),0,artBottom);shade.addColorStop(0,'rgba(2,5,4,.40)');shade.addColorStop(1,'rgba(2,5,4,0)');ctx.fillStyle=shade;ctx.fillRect(0,0,width,artBottom);
      const glow=ctx.createRadialGradient(sunX,sunY,3,sunX,sunY,Math.min(width*.42,190));
      glow.addColorStop(0,`rgba(255,223,115,${energy*.16+beat.pulse*.35})`);glow.addColorStop(.45,`rgba(243,178,48,${energy*.08+beat.pulse*.18})`);glow.addColorStop(1,'rgba(240,170,45,0)');
      ctx.fillStyle=glow;ctx.fillRect(0,0,width,artBottom);
      const colors=laserColors;
      const sweep=playing?(beat.sweep||0):beat.count+beat.phase;
      ctx.globalCompositeOperation='screen';
      const targets=[],group=Math.floor(beat.count/4),pattern=Math.floor(variation(group+3)*3);
      const beamCount=beat.stage==='build'?(beat.buildProgress>.7?5:3):6;
      hero.dataset.laserPattern=String(pattern);hero.dataset.musicBeams=String(beamCount);
      for(let i=0;i<beamCount;i++){
        const originX=i%3===0?artX0-artW*.08:i%3===1?artX0+artW*1.08:artX0+artW*(.15+i*.12),originY=i%3===2?-20:artBottom*(.15+(i%4)*.20);
        const target=destination(i,sweep,now),targetX=target.x,targetY=target.y;targets.push({x:Math.round(targetX),y:Math.round(targetY)});
        const power=Math.min(1,(beat.stage==='build'?.06+beat.buildProgress*.06:.07)+energy*.035+beat.pulse*.85+beat.dropPulse*.12);
        ctx.shadowColor=colors[i];ctx.shadowBlur=lite?0:14+beat.pulse*25;
        ctx.strokeStyle=colors[i];ctx.globalAlpha=power;ctx.lineWidth=.8+beat.pulse*2.2;
        ctx.beginPath();ctx.moveTo(originX,originY);ctx.lineTo(targetX,targetY);ctx.stroke();
        // Narrow pale core and prismatic rays give the beam a refracted edge.
        ctx.shadowBlur=lite?0:4;ctx.strokeStyle='#fff9df';ctx.lineWidth=.65;ctx.globalAlpha=power*.72;
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
      ctx.shadowBlur=0;
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
      const life=(now-s.born)/musicLife,opacity=(1-life)*(musicFrame.stage==='build'?.55+musicFrame.buildProgress*.25:.65),radius=musicFrame.stage==='build'?24+life*44:18+life*38;
      const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,radius);
      g.addColorStop(0,`rgba(255,247,207,${opacity})`);g.addColorStop(1,'rgba(255,210,80,0)');
      ctx.fillStyle=g;ctx.fillRect(s.x-radius,s.y-radius,radius*2,radius*2);
    }
    drawFx(now);
    hero.dataset.musicBoltCount=String(bolts.length);hero.dataset.touchVisualCount=String(spots.length);
    ctx.restore();schedule();
  }
  function touch(event){
    if(!lights||event.target.closest('a,button,.ae-light-dock,.ae-fx-dock')||document.getElementById('siteMenu').classList.contains('open'))return;
    const r=hero.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;
    if(y>=artBottom||y<0||x<artX0||x>artX0+artW)return;
    spots.push({x,y,born:performance.now()});if(spots.length>6)spots.shift();
    hero.dataset.touchCount=String((Number(hero.dataset.touchCount)||0)+1);schedule();
  }
  hero.addEventListener('pointerdown',event=>{
    touch(event);
    if(event.target.closest('a,button,.ae-light-dock,.ae-fx-dock')||document.getElementById('siteMenu').classList.contains('open'))return;
    const rect=hero.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    if(y<0||y>=artBottom||x<artX0||x>artX0+artW)return;
    // Tap sound (restored 2026-10-19): with 聲光 on the music-synced thump plays; with 聲光 off a soft
    // synthesized chime still answers the finger (off only stops music + lasers; touch light & sound stay).
    if(tapSound&&audioContext)percussion(x);else if(window.aeChime&&wantSound())window.aeChime.tap((x-artX0)/Math.max(artW,1));
    if(!lights)return;
    // Owner 2026-10-18: with sound & light on, a tap no longer steers/locks the music lasers to a focus point;
    // the tap draws the same ring + gold burst at the finger as when it is off (the thump still plays above).
    if(!playing){focus={x,y,until:performance.now()+2400};hero.dataset.focusX=x.toFixed(1);hero.dataset.focusY=y.toFixed(1);hero.dataset.focusBorn=performance.now().toFixed(1);launchDepth(x,y,performance.now(),Number(hero.dataset.touchCount)||1);}
    schedule();
    const burst=document.createElement('span');burst.className='ae-gold-burst';burst.setAttribute('aria-hidden','true');burst.style.left=x+'px';burst.style.top=y+'px';
    hero.appendChild(burst);setTimeout(()=>burst.remove(),reduced.matches?240:1650);
  },{passive:true});
  let lastTrail=0;hero.addEventListener('pointermove',event=>{if(!playing&&event.pointerType==='mouse'&&performance.now()-lastTrail>80){lastTrail=performance.now();touch(event);}},{passive:true});
  function stopMusicVisuals(){energy=0;rhythm.reset();musicSpots=[];bolts=[];musicFrame={stage:'groove',dropPulse:0,buildProgress:0};hero.dataset.musicStage='paused';hero.dataset.beatPulse='0';hero.dataset.dropPulse='0';needsStatic=true;clear();schedule();}
  // The only AudioContext on the page, created lazily and only for the optional tap sound.
  function ensureTapAudio(){
    if(audioContext)return;
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Audio unavailable');
    audioContext=(window.aeChime&&window.aeChime.context())||new Audio(); // share the chime context: one AudioContext per page
    tapAnalyser=audioContext.createAnalyser();tapAnalyser.fftSize=256;tapSamples=new Uint8Array(256);tapAnalyser.connect(audioContext.destination);
    noiseBuffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*.16),audioContext.sampleRate);
    const samples=noiseBuffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(1-i/samples.length);
  }
  function percussion(x){
    if(!tapSound||!audioContext)return;
    if(audioContext.state!=='running'){audioContext.resume().then(()=>{if(tapSound&&audioContext.state==='running')percussion(x);}).catch(()=>{});return;}
    const t=audioContext.currentTime;if(t-lastTap<.045)return;lastTap=t;
    const gain=audioContext.createGain(),filter=audioContext.createBiquadFilter(),noise=audioContext.createBufferSource(),tone=audioContext.createOscillator();
    filter.type='bandpass';filter.frequency.value=650+x/Math.max(width,1)*1200;filter.Q.value=.7;
    noise.buffer=noiseBuffer;noise.connect(filter);filter.connect(gain);tone.type='sine';tone.frequency.setValueAtTime(110,t);tone.frequency.exponentialRampToValueAtTime(48,t+.11);tone.connect(gain);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.09,t+.004);gain.gain.exponentialRampToValueAtTime(.0001,t+.15);gain.connect(tapAnalyser);
    noise.start(t);tone.start(t);noise.stop(t+.16);tone.stop(t+.16);tone.onended=()=>{noise.disconnect();filter.disconnect();tone.disconnect();gain.disconnect();};
    setTimeout(()=>{tapAnalyser.getByteTimeDomainData(tapSamples);let sum=0;for(const sample of tapSamples)sum+=((sample-128)/128)**2;hero.dataset.tapPeak=Math.sqrt(sum/tapSamples.length).toFixed(4);},25);
    hero.dataset.tapSoundCount=String((Number(hero.dataset.tapSoundCount)||0)+1);
  }

  // ================= ONE-SHOT EFFECTS (Owner 2026-10-19: three round buttons under the hero) =================
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
  function fxCoins(o){
    o=o||{};const now=performance.now(),n=reduced.matches?8:o.soft?12:24;
    for(let i=0;i<n;i++){const r=7+variation(i*5.7+now)*6;
      coins.push({i,x:artX0+artW*(.06+.88*variation(i*1.3+now%13)),y:reduced.matches?Math.max(20,artBottom*(.2+.6*variation(i*2.9))):-14-variation(i*7.1)*90,
        vx:(variation(i*3.3)-.5)*90,vy:30+variation(i*4.4)*120,r,spin:variation(i)*6,spinV:5+variation(i*9.1)*9,tilt:(variation(i*6.6)-.5)*.5,
        born:now,delay:reduced.matches?0:i*45,life:reduced.matches?1200:2300,bounces:0,ring:i%3===0,quiet:!!o.quiet});}
    if(coins.length>72)coins.splice(0,coins.length-72);
    // Clinks while they pour (more on the floor bounce, see drawFx).
    if(window.aeChime&&!o.quiet)for(let i=0;i<6;i++)setTimeout(()=>window.aeChime.coin(i*2+1),40+i*95);
    hero.dataset.fxCoinCount=String((Number(hero.dataset.fxCoinCount)||0)+1);lastFxFrame=0;schedule();
  }
  function fxLaser(o){
    o=o||{};const now=performance.now();sweeps.push({born:now,life:reduced.matches?900:1650,seed:variation(now%1000)*6});if(sweeps.length>2)sweeps.shift();
    // A zap on each pulse of the sweep (the beams flare at 148 BPM, like the music show).
    if(window.aeChime&&!o.quiet)for(let v=0;v<(reduced.matches?1:4);v++)setTimeout(()=>window.aeChime.laser(v),v*405);
    hero.dataset.fxLaserCount=String((Number(hero.dataset.fxLaserCount)||0)+1);lastFxFrame=0;schedule();
  }
  const FX={glow:fxGlow,coins:fxCoins,laser:fxLaser};
  // Owner 2026-10-27 (v2476.10): the effects live in a small ✦ tray over the top of the painting.
  // Data-driven: to add an effect later, add one entry here (or call window.aeHomeFx.register(def)) —
  // {id, zh, en, icon (class of the little orb glyph), run(opts)}; the tray button is built from it.
  // v2476.13: one-shot. A tap on a tray icon plays that effect once (tap again = again); there is no on/off
  // state. Only effects marked ambient:true (the soft glow) may run on their own; coins, laser and any other
  // burst only ever play when the visitor taps them. i18n = dict key (setLang) with zh/en as fallback.
  const EFFECTS=[
    {id:'glow',zh:'發亮光',en:'Glow',i18n:'fx_glow',icon:'ae-fx-i-glow',run:fxGlow,ambient:true},
    {id:'coins',zh:'金幣',en:'Gold coins',i18n:'fx_coins',icon:'ae-fx-i-coin',run:fxCoins},
    {id:'laser',zh:'雷射光',en:'Laser',i18n:'fx_laser',icon:'ae-fx-i-laser',run:fxLaser}
  ];
  const fxBtn=document.getElementById('aeFxButton'),fxTray=document.getElementById('aeFxTray');
  function fxLabels(){
    if(fxBtn){fxBtn.setAttribute('aria-label',zh()?'特效':'Effects');fxBtn.title=zh()?'特效':'Effects';}
    if(fxTray){fxTray.setAttribute('aria-label',zh()?'畫面特效':'Light effects on the painting');
      for(const b of fxTray.querySelectorAll('[data-fx]')){const d=EFFECTS.find(e=>e.id===b.dataset.fx);if(!d)continue;{const t=zh()?d.zh:d.en;b.querySelector('.ae-fx-label').textContent=t;b.setAttribute('aria-label',t);b.removeAttribute('title');}b.removeAttribute('aria-pressed');}}
  }
  function fxButtonFor(d){
    const b=document.createElement('button');b.type='button';b.className='ae-fx';b.dataset.fx=d.id;
    b.innerHTML='<span class="ae-fx-orb" aria-hidden="true"><i class="ae-fx-i '+d.icon+'"></i></span><span class="ae-fx-label" role="tooltip"'+(d.i18n?' data-i18n="'+d.i18n+'"':'')+'></span>';
    return b;
  }
  function registerEffect(d){
    if(!d||!d.id||typeof d.run!=='function')return false;
    if(!EFFECTS.some(e=>e.id===d.id))EFFECTS.push(d);
    FX[d.id]=d.run;
    if(fxTray&&!fxTray.querySelector('[data-fx="'+d.id+'"]'))fxTray.appendChild(fxButtonFor(d));
    fxLabels();return true;
  }
  for(const d of EFFECTS){if(fxTray)fxTray.appendChild(fxButtonFor(d));}
  const fxDock=fxBtn&&fxBtn.closest('.ae-fx-dock');let fxSeen=false;try{fxSeen=localStorage.getItem('ae-home-fx-seen')==='1';}catch(e){}
  if(fxSeen&&fxDock)fxDock.classList.add('fx-seen');
  function setTray(open){if(!fxBtn||!fxTray)return;fxTray.hidden=!open;fxBtn.setAttribute('aria-expanded',String(open));hero.dataset.fxTray=open?'open':'closed';
    if(open&&!fxSeen){fxSeen=true;if(fxDock)fxDock.classList.add('fx-seen');try{localStorage.setItem('ae-home-fx-seen','1');}catch(e){}}updateHint();}
  let fxTouch=false;
  if(fxBtn&&fxTray){
    fxBtn.addEventListener('click',()=>setTray(fxTray.hidden));
    fxTray.addEventListener('click',e=>{
      const b=e.target.closest('[data-fx]');if(!b)return;const id=b.dataset.fx,f=FX[id];if(!f)return;
      if(!lights)setLights(true);needsStatic=true;resize();f({quiet:!wantSound()});
      hero.dataset.fxTaps=String((Number(hero.dataset.fxTaps)||0)+1);hero.dataset.fxLastTap=id;
      b.classList.remove('is-firing');void b.offsetWidth;b.classList.add('is-firing');clearTimeout(b._fireT);b._fireT=setTimeout(()=>b.classList.remove('is-firing'),700);
      // Touch has no hover: show the name briefly after the tap (pointer-events:none, so it never blocks).
      if(fxTouch){for(const o of fxTray.querySelectorAll('.is-named'))if(o!==b)o.classList.remove('is-named');b.classList.add('is-named');clearTimeout(b._nameT);b._nameT=setTimeout(()=>b.classList.remove('is-named'),1100);}
    });
    // Tap outside the tray (or Esc) folds it away again.
    fxTray.addEventListener('touchstart',()=>{fxTouch=true;},{passive:true});
    fxTray.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')fxTouch=false;else if(e.pointerType)fxTouch=true;},{passive:true});
    document.addEventListener('pointerdown',e=>{if(!fxTray.hidden&&!e.target.closest('#aeFxTray,#aeFxButton'))setTray(false);},{capture:true,passive:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!fxTray.hidden){setTray(false);fxBtn.focus();}});
    setTray(false);
  }
  fxLabels();
  FX.register=registerEffect;FX.effects=()=>EFFECTS.map(d=>({id:d.id,ambient:!!d.ambient}));
  window.aeHomeFx=FX;
  // ================= ONE PLAYER =================
  const CUE=window.aeHomeAudioEnergy.openingTime(timeline),OPENING=15,FADE=.8,VOL=.55,DISPLAY_LEAD=.012;
  const P={phase:'idle',sound:'none',reason:'',heard:false,seq:0,lightAnchor:null,openingEnd:0,log:[]};
  const subs=new Set();
  let loadAnchor=null,waiting=false,anchorT=0,anchorP=0,lastCT=-1,lastCTP=0,moved=false,tick=0,loadTimer=0;
  function stamp(ev,extra){const e={ev,phase:P.phase,sound:P.sound,track:+trackTime().toFixed(3),perf:+performance.now().toFixed(1),...(extra||{})};P.log.push(e);if(P.log.length>300)P.log.shift();return e;}
  // Track clock: native media time. Between coarse currentTime updates, advance with the
  // wall clock at playbackRate. Light-only opening uses performance.now mapped onto the cue.
  function trackTime(){
    const now=performance.now();
    const rate=audio.playbackRate>0&&isFinite(audio.playbackRate)?audio.playbackRate:1;
    if(P.lightAnchor)return P.lightAnchor.t+(now-P.lightAnchor.p)/1000*rate;
    // v2476.69: while a tap-started track is still buffering, keep the light clock running from the cue
    // (before, the clock sat on the paused media time and the whole show froze until the audio arrived).
    if(loadAnchor&&busy&&(audio.paused||audio.readyState<3))return loadAnchor.t+(now-loadAnchor.p)/1000;
    const ct=audio.currentTime;
    if(!isFinite(ct))return 0;
    if(audio.paused||waiting){lastCT=ct;anchorT=ct;anchorP=now;lastCTP=now;moved=false;return ct;}
    // Hard re-anchor. The old 20% blend kept a lag whenever currentTime stepped by
    // less than the 50ms snap, and the 300ms stall then painted that stale time.
    if(ct!==lastCT){
      // Don't run the wall clock ahead of a currentTime that has not started
      // moving yet (seek just landed, decoder not ticking). Once it ticks, bridge
      // the coarse gaps.
      moved=lastCT>=0;anchorT=ct;anchorP=now;lastCT=ct;lastCTP=now;
    }
    if(!moved||now-lastCTP>500)return ct; // not started, or decoder stalled
    return anchorT+(now-anchorP)/1000*rate;
  }
  // One display clock for both the opening and the continuous section: re-anchored track time
  // plus one presented frame of lead, never more than 40ms ahead of audio.currentTime.
  function displayTime(){
    let tt=trackTime()+Math.min(.032,Math.max(DISPLAY_LEAD,presentMs/1000));
    const ctNow=audio.currentTime;
    if(!P.lightAnchor&&isFinite(ctNow))tt=Math.min(tt,ctNow+.04);
    return tt;
  }
  const lightTime=displayTime;
  // The audible opening plays the whole track once (no 15 s cap); light-only fallback keeps 15 s.
  const trackEnd=()=>isFinite(audio.duration)&&audio.duration>0?audio.duration:Infinity;
  // v2476.12 tap-for-sound hint: shown only while sound is wanted but not yet playing; once it fades it stays gone.
  function hideHint(why){if(!hint||hintDone)return;hintDone=true;hint.classList.add('is-out');hint.setAttribute('aria-hidden','true');hint.tabIndex=-1;hero.dataset.tapHint='gone:'+(why||'');
    setTimeout(()=>{hint.hidden=true;},reduced.matches?0:700);}
  function updateHint(){try{updateHint_();}catch(e){/* player not ready yet (init order) */}}
  function updateHint_(){if(!hint||hintDone)return;
    if(!wantSound()){hideHint('muted');return;}if(soundOn()||P.heard){hideHint('playing');return;}
    if(hint.hidden){hint.hidden=false;queueResize();}hint.classList.toggle('is-tucked',hero.dataset.fxTray==='open');hero.dataset.tapHint=hero.dataset.fxTray==='open'?'tucked':'shown';}
  function publish(){
    updateHint();
    hero.dataset.playerPhase=P.phase;hero.dataset.playerSound=P.sound;hero.dataset.playerReason=P.reason;
    playing=P.phase==='music'&&(!audio.paused||(busy&&!!loadAnchor));
    if(tapSound&&!busy&&P.sound!=='audio'&&P.sound!=='loading')tapSound=false;
    labels();for(const f of subs){try{f(P.phase,P.sound,P.reason);}catch(e){}}schedule();
  }
  function setPhase(phase,sound,reason){const was=P.phase;P.phase=phase;if(sound!==undefined)P.sound=sound;if(reason!==undefined)P.reason=reason;if(was==='music'&&phase!=='music')stopMusicVisuals();if(phase==='music'&&was!=='music'){rhythm.reset();spots=[];hero.querySelectorAll('.ae-gold-burst').forEach(el=>el.remove());resize();}publish();}
  function seek(t){
    const my=P.seq;let tries=0,applying=false;
    const apply=()=>{try{audio.currentTime=t;}catch(e){}lastCT=-1;};
    // play() on an unloaded element seeks back to 0 when metadata arrives. A seek issued
    // before that reset is discarded; re-apply when the reset's seeked event lands.
    const onSeeked=()=>{
      if(applying)return;
      if(my!==P.seq){audio.removeEventListener('seeked',onSeeked);return;}
      if(Math.abs(audio.currentTime-t)<=.25){audio.removeEventListener('seeked',onSeeked);return;}
      if(++tries>4){audio.removeEventListener('seeked',onSeeked);return;}
      applying=true;apply();applying=false;
    };
    audio.addEventListener('seeked',onSeeked);
    apply();
    if(audio.readyState<1)audio.addEventListener('loadedmetadata',()=>{if(my===P.seq)setTimeout(()=>{if(my===P.seq&&Math.abs(audio.currentTime-t)>.25)apply();},0);},{once:true});
  }
  function stopTick(){clearInterval(tick);tick=0;clearTimeout(loadTimer);loadTimer=0;}
  function openingTick(){
    if(P.phase!=='opening')return;
    if(P.sound!=='light')P.openingEnd=trackEnd();
    const t=trackTime(),left=P.openingEnd-t;
    if(P.sound==='audio'){try{audio.volume=Math.max(0,Math.min(VOL,VOL*left/FADE));}catch(e){}}
    if(left<=0&&P.sound!=='audio')endOpening('complete');
  }
  // Must be called synchronously inside a click/tap (or at load for autoplay).
  function play(from,phase,source){
    const my=++P.seq;stopTick();loadAnchor={t:from!=null?from:(isFinite(audio.currentTime)?audio.currentTime:0),p:performance.now()};P.lightAnchor=null;audio.loop=true;
    try{audio.volume=VOL;}catch(e){}
    // play() first: on a never-loaded element it runs the load algorithm, which would reset an
    // earlier seek to 0. Seeking right after keeps the cue (applied at loadedmetadata if needed).
    let pr;try{pr=audio.play();}catch(e){pr=Promise.reject(e);}
    if(from!=null)seek(from);
    busy=true;setPhase(phase,'loading',source);stamp('play-request',{from,source});
    if(phase==='opening'){audio.loop=false;P.openingEnd=Infinity;tick=setInterval(openingTick,50);
      loadTimer=setTimeout(()=>{if(my===P.seq&&P.sound==='loading'){++P.seq;audio.pause();busy=false;lightOnly(from==null?CUE:from,'slow-network');}},6000);}
    return Promise.resolve(pr).then(()=>{
      if(my!==P.seq)return false;
      clearTimeout(loadTimer);loadAnchor=null;lastCT=-1;busy=false;P.heard=true;P.sound='audio';
      try{ensureTapAudio();if(audioContext.state!=='running')audioContext.resume().catch(()=>{});tapSound=true;}catch(e){}
      if(!hero.dataset.musicOpening)hero.dataset.musicOpening=CUE.toFixed(2);
      stamp('playing',{source});publish();return true;
    },err=>{
      if(my!==P.seq)return false;
      loadAnchor=null;busy=false;stamp('play-refused',{source,err:String(err&&err.name||err)});
      if(phase==='opening'){lightOnly(from==null?CUE:from,'autoplay-blocked');return false;}
      if(source==='first-gesture'||source==='resume'){setPhase(P.heard?'paused':'idle','none','autoplay-blocked');if(wantSound())armGesture();return false;}
      setPhase(P.heard?'paused':'idle','none','refused');message=zh()?'音樂未能播放，請再試一次。':'Music could not play. Please try again.';labels();return false;
    });
  }
  function lightOnly(from,why){P.lightAnchor={t:from,p:performance.now()};P.openingEnd=from+OPENING;P.sound='light';P.reason=why;if(!tick)tick=setInterval(openingTick,50);stamp('light-only',{why});if(why==='autoplay-blocked'&&wantSound())armGesture();publish();}
  function endOpening(reason){
    if(P.phase!=='opening')return;audio.loop=true;
    ++P.seq;stopTick();busy=false;
    if(P.lightAnchor){P.lightAnchor=null;}else{audio.pause();}
    try{audio.volume=VOL;}catch(e){}
    setPhase('ended','none',reason);stamp('opening-end',{reason});
  }
  function pauseMusic(reason){
    if(P.phase==='opening'){endOpening(reason);return;}
    if(P.phase!=='music'){return;}
    ++P.seq;busy=false;audio.pause();setPhase('paused','none',reason);stamp('pause',{reason});
  }
  // Mid-opening ♫ with sound already running: the opening simply becomes the full song. No seek,
  // no restart, no second source — the same track keeps playing on the same clock.
  function openingToMusic(source){
    stopTick();audio.loop=true;try{audio.volume=VOL;}catch(e){}
    setPhase('music','audio',source);stamp('opening-to-music',{source});
  }
  // One toggle on the one player. Off keeps the position; on resumes (or starts the track).
  function soundPressed(){
    if(soundOn()){message='';if(P.phase==='opening')endOpening('sound-off');else pauseMusic('sound-off');return;}
    dockPressed();
  }
  function dockPressed(){
    if(busy&&P.phase!=='opening')return; // double-tap while ♫ is still loading the track
    message='';
    if(P.phase==='music'){pauseMusic('dock');return;}
    if(P.phase==='opening'&&P.sound==='audio'){openingToMusic('dock-during-opening');return;}
    if(P.phase==='opening'){play(CUE,'music',P.sound==='loading'?'dock-during-opening-load':'dock-during-light-opening');return;} // sound blocked or not started yet: music+light start together from the cue
    play(P.heard?audio.currentTime:CUE,'music','dock');
  }
  window.aeHomePlayer={
    CUE,OPENING,trackTime,lightTime,timeline,
    get phase(){return P.phase},get sound(){return P.sound},get reason(){return P.reason},get heard(){return P.heard},
    startOpening:source=>wantSound()?play(CUE,'opening',source):lightOnly(CUE,'muted'),endOpening,pauseMusic,dockPressed,soundPressed,soundLightPressed:()=>soundLightPressed(),
    subscribe:f=>{subs.add(f);return()=>subs.delete(f);},
    get openingEnd(){return P.openingEnd},
    snapshot:()=>({phase:P.phase,sound:P.sound,reason:P.reason,heard:P.heard,busy,track:+trackTime().toFixed(3),openingEnd:+P.openingEnd.toFixed(3),
      audio:{paused:audio.paused,currentTime:+audio.currentTime.toFixed(3),playbackRate:audio.playbackRate,defaultPlaybackRate:audio.defaultPlaybackRate,preservesPitch:audio.preservesPitch,volume:+audio.volume.toFixed(3),readyState:audio.readyState,loop:audio.loop},
      audioContexts:audioContext?1:0,musicLights:playing,lights}),
    log:()=>P.log.slice()
  };
  // 開聲光 / 關聲光: Off = pause the track (position kept) + music lasers stop, tap light stays; On = lights on + sound on.
  function setLights(on){if(lights===on)return;lights=on;spots=[];musicSpots=[];bolts=[];focus=null;needsStatic=true;hero.querySelectorAll('.ae-gold-burst').forEach(el=>el.remove());labels();clear();schedule();}
  function soundLightPressed(){
    // Off: pause the track and the music-driven laser show (and the tap thump); the tap light/ring response stays on.
    if(soundOn()){tapSound=false;soundPressed();labels();return;}
    try{ensureTapAudio();audioContext.resume();tapSound=true;}catch(e){}
    setLights(true);soundPressed();
  }
  // Sound-only toggle: off = pause the music (lights keep running); on = start / resume the music.
  function startSound(source){
    if(soundOn())return;
    try{ensureTapAudio();audioContext.resume();tapSound=true;}catch(e){}
    if(P.phase==='opening'||P.phase==='music'){dockPressed();return;}
    if(busy)return;
    message='';play(P.heard?audio.currentTime:CUE,'music',source);
  }
  function soundToggle(){
    hideHint('icon');
    if(soundOn()||busy){
      setWant(false);dropGesture();tapSound=false;message='';
      if(busy){++P.seq;busy=false;audio.pause();if(P.phase==='opening')endOpening('sound-off');else setPhase(P.heard?'paused':'idle','none','sound-off');}
      else soundPressed();
      labels();return;
    }
    setWant(true);startSound('button');
  }
  slBtn.addEventListener('click',iconOnly?soundToggle:soundLightPressed);
  audio.addEventListener('error',()=>{stamp('audio-error');if(P.phase==='opening')lightOnly(CUE,'audio-error');else{pauseMusic('error');}message=zh()?'音樂載入失敗，請再試一次。':'Music could not load. Please try again.';labels();});
  audio.addEventListener('ended',()=>{if(P.phase==='opening'&&P.sound==='audio'&&wantSound()){try{audio.currentTime=CUE;}catch(e){}openingToMusic('opening-complete');audio.play().catch(()=>{});return;}if(P.phase==='opening'){try{audio.currentTime=CUE;}catch(e){}endOpening('complete');}});
  // Sound on at entry: if the browser refused unmuted autoplay, the first user gesture anywhere
  // on the page starts the opening with sound (browsers only allow audio after a gesture).
  // Only events that grant user activation (pointerdown on touch does not), so play() is not refused.
  const GESTURES=['pointerup','touchend','click','keydown'];
  function onFirstGesture(e){
    if(!wantSound()||soundOn()){dropGesture();return;}
    if(e.type==='keydown'&&(e.key==='Escape'||e.key==='Tab'||e.key==='Shift'||e.key==='Alt'||e.key==='Control'||e.key==='Meta'))return; // not an activation key, not a request for music
    if(e.target&&e.target.closest&&e.target.closest('#aeSoundButton,#aeSoundLightButton,#themeButton,#aeFxButton,#aeFxTray'))return; // the icon handles itself; the theme switch is not a request for music
    if(busy&&P.phase!=='opening')return;
    dropGesture();hideHint('tap');startSound('first-gesture');
  }
  function armGesture(){for(const g of GESTURES)document.addEventListener(g,onFirstGesture,{capture:true,passive:true});}
  function dropGesture(){for(const g of GESTURES)document.removeEventListener(g,onFirstGesture,{capture:true});}
  audio.addEventListener('waiting',()=>{waiting=true;});
  audio.addEventListener('playing',()=>{waiting=false;lastCT=-1;if(!lights)setLights(true);publish();}); // sound on ⇒ light on (one button)
  // A pause we did not ask for (OS audio interruption, headphones unplugged, media keys).
  audio.addEventListener('pause',()=>{if(P.phase==='music'){++P.seq;setPhase('paused','none','system');stamp('pause',{reason:'system'});}else if(P.phase==='opening'&&P.sound==='audio')endOpening('system');});
  audio.addEventListener('play',()=>{if(P.phase==='paused'||P.phase==='ended'||P.phase==='idle'){/* media keys */setPhase('music','audio','system');P.heard=true;}});
  // Same rule for every "you are not looking" signal: stop sound, keep the position; ♫ resumes it.
  const autoPaused=()=>P.phase==='paused'&&(P.reason==='hidden'||P.reason==='scrolled-away'||P.reason==='pagehide');
  const resume=()=>{if(wantSound()&&autoPaused()&&!busy)play(audio.currentTime,'music','resume');};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseMusic('hidden');else{lastCT=-1;schedule();resume();}});
  window.addEventListener('pagehide',()=>pauseMusic('pagehide'));
  {const ro=new ResizeObserver(queueResize);ro.observe(hero);ro.observe(hero.querySelector('.hero-copy'));}addEventListener('resize',queueResize,{passive:true});
  new IntersectionObserver(entries=>{viewable=entries[0].isIntersecting;if(!viewable)pauseMusic('scrolled-away');else{schedule();resume();}},{threshold:.03}).observe(hero);
  new MutationObserver(()=>{labels();fxLabels();queueResize();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang','data-theme']});
  reduced.addEventListener('change',()=>{labels();clear();schedule();});
  // Lights on entry, no click needed (v2476.13: calm): only the soft ambient glow breathes on its own; coins,
  // laser and other bursts never fire automatically.
  // While the music plays its own beat show takes over; reduced motion keeps the painting still.
  let ambientN=0,ambientI=0;
  function ambientTick(){
    const list=EFFECTS.filter(d=>d.ambient===true);
    if(list.length&&lights&&viewable&&!document.hidden&&!reduced.matches&&!playing&&width>0){const d=list[ambientI++%list.length];d.run({quiet:true,soft:true});hero.dataset.ambientCount=String(++ambientN);hero.dataset.ambientLast=d.id;}
    setTimeout(ambientTick,3400);
  }
  setTimeout(ambientTick,700);
  if(wantSound())armGesture();
  updateHint();
  document.fonts.ready.then(()=>{resize();schedule();});resize();publish();
})();
