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
  const musicBtn=document.getElementById('aeMusicButton'),lightBtn=document.getElementById('aeLightButton'),status=document.getElementById('aeLightStatus');
  const timeline=window.aeHomeBeatTimeline;
  const tapBtn=document.getElementById('aeTapButton'),rhythm=window.aeHomeAudioEnergy.createRhythm(timeline?.events,timeline?.accents,timeline?.sections);
  let tapSound=false,lastTap=-1,noiseBuffer,tapAnalyser,tapSamples;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const forceLite=new URLSearchParams(location.search).get('lite')==='1';
  // liteLatch sticks for the rest of a playback once a frame misses the beat. Exiting early
  // brought shadowBlur back and the next kicks landed a whole frame late.
  let lite=forceLite,liteLatch=forceLite,frameEma=16.7,presentMs=12,lights=true,playing=false,busy=false,audioContext,frame=0,lastPaint=0,energy=0,viewable=true;
  let width=0,height=0,artBottom=0,sunX=0,sunY=0,spots=[],musicSpots=[],bolts=[],focus=null,needsStatic=true;
  let musicFrame={stage:'groove',dropPulse:0,buildProgress:0};
  const laserColors=['#ff416d','#57ffa0','#ffe28d','#65dbff','#c987ff','#ffac68'];
  const variation=seed=>{const n=Math.sin(seed*12.9898+78.233)*43758.5453;return n-Math.floor(n);};
  function destination(i,phase,now){
    const group=Math.floor((Number(hero.dataset.beatCount)||0)/4);
    const angle=i*Math.PI/3+phase*.24+variation(group+1)*1.7;
    const ambient={x:width*(.16+.68*(.5+.5*Math.sin(angle))),y:Math.max(30,artBottom*(.20+.60*(.5+.5*Math.cos(angle*1.3))))};
    const remaining=focus?focus.until-now:0;
    const weight=remaining>0?Math.min(1,remaining/600):0;
    const target={x:ambient.x*(1-weight)+(focus?focus.x:0)*weight,y:ambient.y*(1-weight)+(focus?focus.y:0)*weight};
    // The drop belongs to the music, even if a finger is currently focusing elsewhere.
    const impact=playing?Math.min(1,(musicFrame.dropPulse||0)*1.8):0;
    return{x:target.x*(1-impact)+sunX*impact,y:target.y*(1-impact)+Math.max(30,sunY)*impact};
  }
  const zh=()=>document.documentElement.lang==='zh-Hant';
  let message='';
  function labels(){
    const ph=window.aeHomePlayer?window.aeHomePlayer.phase:'idle',snd=window.aeHomePlayer?window.aeHomePlayer.sound:'none';
    musicBtn.textContent=busy?(zh()?'音樂載入中':'Loading…'):ph==='music'?(zh()?'♫ 暫停音樂':'♫ Pause music'):(ph==='opening'&&snd==='audio')?(zh()?'♫ 繼續聽完整音樂':'♫ Keep the full music playing'):(zh()?'♫ 播放音樂':'♫ Play music');
    musicBtn.title=musicBtn.textContent;
    lightBtn.textContent=lights?(zh()?'✦ 光效開':'✦ Light on'):(zh()?'✦ 光效關':'✦ Light off');
    musicBtn.setAttribute('aria-pressed',String(ph==='music'));lightBtn.setAttribute('aria-pressed',String(lights));
    musicBtn.disabled=busy&&ph!=='opening';
    tapBtn.textContent=tapSound?(zh()?'◌ 敲擊聲開':'◌ Tap sound on'):(zh()?'◌ 敲擊聲關':'◌ Tap sound off');
    tapBtn.setAttribute('aria-pressed',String(tapSound));hero.dataset.tapSound=tapSound?'on':'off';
    status.textContent=message||(reduced.matches?(zh()?'減少動態模式':'Reduced motion'):(zh()?'輕點畫作，讓光與聲音回應你':'Tap the painting. Let light and sound respond.'));
    hero.dataset.musicState=busy?'loading':ph==='music'?'playing':'paused';hero.dataset.lightState=lights?'on':'off';
  }
  let resizeQueued=0,lastW=-1,lastH=-1;
  // Coalesce ResizeObserver/MutationObserver bursts into one canvas reallocation per frame.
  function queueResize(){if(resizeQueued)return;resizeQueued=requestAnimationFrame(()=>{resizeQueued=0;resize();schedule();});}
  function resize(){
    const r=hero.getBoundingClientRect(),title=hero.querySelector('.hero-copy').getBoundingClientRect();
    width=r.width;height=r.height;artBottom=Math.max(0,title.top-r.top-12);
    const pseudo=getComputedStyle(hero,'::before'),paintWidth=Number.parseFloat(pseudo.width),paintTop=Number.parseFloat(pseudo.top);
    sunX=width/2;sunY=Math.min(artBottom-20,paintTop+paintWidth*1536/1110*.522);
    const ratio=Math.min(devicePixelRatio||1,2),cw=Math.round(width*ratio),ch=Math.round(height*ratio);
    if(cw!==lastW||ch!==lastH){canvas.width=cw;canvas.height=ch;lastW=cw;lastH=ch;}ctx.setTransform(ratio,0,0,ratio,0,0);
    hero.dataset.artLightBottom=String(Math.round(artBottom));needsStatic=true;
  }
  function schedule(){if(!frame&&lights&&!document.hidden&&viewable&&(playing||spots.length||musicSpots.length||bolts.length||needsStatic||(focus&&focus.until>performance.now())))frame=requestAnimationFrame(draw);}
  function clear(){ctx.clearRect(0,0,width,height);hero.dataset.audioEnergy='0';}
  function launchDepth(x,y,now,seed){
    if(reduced.matches)return;
    const number=playing?(musicFrame.stage==='drop'?6:2):6;
    for(let i=0;i<number;i++){
      const edge=i%3,ox=edge===0?-width*.12:edge===1?width*1.12:width*(.1+((i+seed)%5)*.2),oy=edge===2?-30:artBottom*(.1+((i+seed)%5)*.16);
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
    needsStatic=false;ctx.clearRect(0,0,width,height);ctx.save();ctx.beginPath();ctx.rect(0,0,width,artBottom);ctx.clip();
    if(!reduced.matches){
      let bass=0,beat={beat:false,count:Number(hero.dataset.beatCount)||0,pulse:0,phase:0,interval:60/148,stage:'groove',dropPulse:0,buildProgress:0,accentCount:0};
      if(playing){
      // One frame of lead so the kick is the one on screen when the frame presents.
      // Never more than 40ms ahead of the media clock the ear is compared against.
      const ctNow=audio.currentTime;
      let tt=trackTime()+Math.min(.032,Math.max(DISPLAY_LEAD,presentMs/1000));
      if(isFinite(ctNow))tt=Math.min(tt,ctNow+.04);
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
        const originX=i%3===0?-width*.08:i%3===1?width*1.08:width*(.15+i*.12),originY=i%3===2?-20:artBottom*(.15+(i%4)*.20);
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
        ctx.strokeStyle=colors[i];ctx.lineWidth=.7;ctx.globalAlpha=beat.pulse*.6;ctx.beginPath();ctx.arc(targetX,targetY,8+beat.phase*28,0,Math.PI*2);ctx.stroke();
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
        ctx.fillStyle='#fff6d2';ctx.beginPath();ctx.arc(tipX,tipY,1.5+(1-p)*2,0,Math.PI*2);ctx.fill();
      }
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.shadowBlur=0;
    }
    const touchLife=reduced.matches?240:playing?380:1100;
    spots=spots.filter(s=>now-s.born<touchLife);
    for(const s of spots){
      const life=(now-s.born)/touchLife,opacity=(1-life)*(playing?.28:1),radius=reduced.matches?30:playing?18+life*36:35+life*90;
      const g=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,radius);g.addColorStop(0,`rgba(255,249,210,${opacity})`);g.addColorStop(.22,`rgba(255,217,108,${opacity*.8})`);g.addColorStop(1,'rgba(245,180,45,0)');
      ctx.fillStyle=g;ctx.fillRect(s.x-radius,s.y-radius,radius*2,radius*2);
      if(!reduced.matches){ctx.strokeStyle=`rgba(255,222,127,${opacity})`;ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(s.x,s.y,8+life*55,0,Math.PI*2);ctx.stroke();}
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
    hero.dataset.musicBoltCount=String(bolts.length);hero.dataset.touchVisualCount=String(spots.length);
    ctx.restore();schedule();
  }
  function touch(event){
    if(!lights||event.target.closest('a,button,.ae-light-dock')||document.getElementById('siteMenu').classList.contains('open'))return;
    const r=hero.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;
    if(y>=artBottom||y<0)return;
    spots.push({x,y,born:performance.now()});if(spots.length>6)spots.shift();
    hero.dataset.touchCount=String((Number(hero.dataset.touchCount)||0)+1);schedule();
  }
  hero.addEventListener('pointerdown',event=>{
    touch(event);
    if(event.target.closest('a,button,.ae-light-dock')||document.getElementById('siteMenu').classList.contains('open'))return;
    const rect=hero.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    if(y<0||y>=artBottom)return;
    percussion(x);
    if(!lights)return;
    focus={x,y,until:performance.now()+2400};hero.dataset.focusX=x.toFixed(1);hero.dataset.focusY=y.toFixed(1);hero.dataset.focusBorn=performance.now().toFixed(1);
    if(!playing)launchDepth(x,y,performance.now(),Number(hero.dataset.touchCount)||1);schedule();
    if(playing)return; // Music controls intensity and flight timing; a touch controls position only.
    const burst=document.createElement('span');burst.className='ae-gold-burst';burst.setAttribute('aria-hidden','true');burst.style.left=x+'px';burst.style.top=y+'px';
    hero.appendChild(burst);setTimeout(()=>burst.remove(),reduced.matches?240:1650);
  },{passive:true});
  let lastTrail=0;hero.addEventListener('pointermove',event=>{if(!playing&&event.pointerType==='mouse'&&performance.now()-lastTrail>80){lastTrail=performance.now();touch(event);}},{passive:true});
  function stopMusicVisuals(){energy=0;rhythm.reset();musicSpots=[];bolts=[];musicFrame={stage:'groove',dropPulse:0,buildProgress:0};hero.dataset.musicStage='paused';hero.dataset.beatPulse='0';hero.dataset.dropPulse='0';needsStatic=true;clear();schedule();}
  // The only AudioContext on the page, created lazily and only for the optional tap sound.
  function ensureTapAudio(){
    if(audioContext)return;
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Audio unavailable');
    audioContext=new Audio();
    tapAnalyser=audioContext.createAnalyser();tapAnalyser.fftSize=256;tapSamples=new Uint8Array(256);tapAnalyser.connect(audioContext.destination);
    noiseBuffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*.16),audioContext.sampleRate);
    const samples=noiseBuffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(1-i/samples.length);
  }
  function percussion(x){
    if(!tapSound||!audioContext||audioContext.state!=='running')return;
    const t=audioContext.currentTime;if(t-lastTap<.045)return;lastTap=t;
    const gain=audioContext.createGain(),filter=audioContext.createBiquadFilter(),noise=audioContext.createBufferSource(),tone=audioContext.createOscillator();
    filter.type='bandpass';filter.frequency.value=650+x/Math.max(width,1)*1200;filter.Q.value=.7;
    noise.buffer=noiseBuffer;noise.connect(filter);filter.connect(gain);tone.type='sine';tone.frequency.setValueAtTime(110,t);tone.frequency.exponentialRampToValueAtTime(48,t+.11);tone.connect(gain);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.09,t+.004);gain.gain.exponentialRampToValueAtTime(.0001,t+.15);gain.connect(tapAnalyser);
    noise.start(t);tone.start(t);noise.stop(t+.16);tone.stop(t+.16);tone.onended=()=>{noise.disconnect();filter.disconnect();tone.disconnect();gain.disconnect();};
    setTimeout(()=>{tapAnalyser.getByteTimeDomainData(tapSamples);let sum=0;for(const sample of tapSamples)sum+=((sample-128)/128)**2;hero.dataset.tapPeak=Math.sqrt(sum/tapSamples.length).toFixed(4);},25);
    hero.dataset.tapSoundCount=String((Number(hero.dataset.tapSoundCount)||0)+1);
  }
  tapBtn.addEventListener('click',async()=>{
    if(tapSound){tapSound=false;message='';labels();return;}
    try{ensureTapAudio();await audioContext.resume();tapSound=true;message='';}
    catch(error){message=zh()?'敲擊聲未能開啟，請再試一次。':'Tap sound could not start. Please try again.';}
    labels();
  });
  // ================= ONE PLAYER =================
  const CUE=window.aeHomeAudioEnergy.openingTime(timeline),OPENING=15,FADE=.8,VOL=.55,DISPLAY_LEAD=.012;
  const P={phase:'idle',sound:'none',reason:'',heard:false,seq:0,lightAnchor:null,openingEnd:0,log:[]};
  const subs=new Set();
  let waiting=false,anchorT=0,anchorP=0,lastCT=-1,lastCTP=0,moved=false,tick=0,loadTimer=0;
  function stamp(ev,extra){const e={ev,phase:P.phase,sound:P.sound,track:+trackTime().toFixed(3),perf:+performance.now().toFixed(1),...(extra||{})};P.log.push(e);if(P.log.length>300)P.log.shift();return e;}
  // Track clock: native media time. Between coarse currentTime updates, advance with the
  // wall clock at playbackRate. Light-only opening uses performance.now mapped onto the cue.
  function trackTime(){
    const now=performance.now();
    const rate=audio.playbackRate>0&&isFinite(audio.playbackRate)?audio.playbackRate:1;
    if(P.lightAnchor)return P.lightAnchor.t+(now-P.lightAnchor.p)/1000*rate;
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
  const lightTime=()=>trackTime()+DISPLAY_LEAD; // opening frames: one frame of display lead
  function publish(){
    hero.dataset.playerPhase=P.phase;hero.dataset.playerSound=P.sound;hero.dataset.playerReason=P.reason;
    playing=P.phase==='music'&&!audio.paused;
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
    const t=trackTime(),left=P.openingEnd-t;
    if(P.sound==='audio'){try{audio.volume=Math.max(0,Math.min(VOL,VOL*left/FADE));}catch(e){}}
    if(left<=0)endOpening('complete');
  }
  // Must be called synchronously inside a click/tap (or at load for autoplay).
  function play(from,phase,source){
    const my=++P.seq;stopTick();P.lightAnchor=null;
    try{audio.volume=VOL;}catch(e){}
    // play() first: on a never-loaded element it runs the load algorithm, which would reset an
    // earlier seek to 0. Seeking right after keeps the cue (applied at loadedmetadata if needed).
    let pr;try{pr=audio.play();}catch(e){pr=Promise.reject(e);}
    if(from!=null)seek(from);
    busy=true;setPhase(phase,'loading',source);stamp('play-request',{from,source});
    if(phase==='opening'){P.openingEnd=(from==null?audio.currentTime:from)+OPENING;tick=setInterval(openingTick,50);
      loadTimer=setTimeout(()=>{if(my===P.seq&&P.sound==='loading'){++P.seq;audio.pause();busy=false;lightOnly(from==null?CUE:from,'slow-network');}},6000);}
    return Promise.resolve(pr).then(()=>{
      if(my!==P.seq)return false;
      clearTimeout(loadTimer);busy=false;P.heard=true;P.sound='audio';
      if(!hero.dataset.musicOpening)hero.dataset.musicOpening=CUE.toFixed(2);
      stamp('playing',{source});publish();return true;
    },err=>{
      if(my!==P.seq)return false;
      busy=false;stamp('play-refused',{source,err:String(err&&err.name||err)});
      if(phase==='opening'){lightOnly(from==null?CUE:from,'autoplay-blocked');return false;}
      setPhase(P.heard?'paused':'idle','none','refused');message=zh()?'音樂未能播放，請再試一次。':'Music could not play. Please try again.';labels();return false;
    });
  }
  function lightOnly(from,why){P.lightAnchor={t:from,p:performance.now()};P.openingEnd=from+OPENING;P.sound='light';P.reason=why;if(!tick)tick=setInterval(openingTick,50);stamp('light-only',{why});publish();}
  function endOpening(reason){
    if(P.phase!=='opening')return;
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
    stopTick();try{audio.volume=VOL;}catch(e){}
    setPhase('music','audio',source);stamp('opening-to-music',{source});
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
    startOpening:source=>play(CUE,'opening',source),endOpening,pauseMusic,dockPressed,
    subscribe:f=>{subs.add(f);return()=>subs.delete(f);},
    snapshot:()=>({phase:P.phase,sound:P.sound,reason:P.reason,heard:P.heard,busy,track:+trackTime().toFixed(3),openingEnd:+P.openingEnd.toFixed(3),
      audio:{paused:audio.paused,currentTime:+audio.currentTime.toFixed(3),playbackRate:audio.playbackRate,defaultPlaybackRate:audio.defaultPlaybackRate,preservesPitch:audio.preservesPitch,volume:+audio.volume.toFixed(3),readyState:audio.readyState,loop:audio.loop},
      audioContexts:audioContext?1:0,musicLights:playing}),
    log:()=>P.log.slice()
  };
  musicBtn.addEventListener('click',dockPressed);
  lightBtn.addEventListener('click',()=>{lights=!lights;spots=[];musicSpots=[];bolts=[];focus=null;needsStatic=true;hero.querySelectorAll('.ae-gold-burst').forEach(el=>el.remove());labels();clear();schedule();});
  audio.addEventListener('error',()=>{stamp('audio-error');if(P.phase==='opening')lightOnly(CUE,'audio-error');else{pauseMusic('error');}message=zh()?'音樂載入失敗，請再試一次。':'Music could not load. Please try again.';labels();});
  audio.addEventListener('waiting',()=>{waiting=true;});
  audio.addEventListener('playing',()=>{waiting=false;lastCT=-1;publish();});
  // A pause we did not ask for (OS audio interruption, headphones unplugged, media keys).
  audio.addEventListener('pause',()=>{if(P.phase==='music'){++P.seq;setPhase('paused','none','system');stamp('pause',{reason:'system'});}else if(P.phase==='opening'&&P.sound==='audio')endOpening('system');});
  audio.addEventListener('play',()=>{if(P.phase==='paused'||P.phase==='ended'||P.phase==='idle'){/* media keys */setPhase('music','audio','system');P.heard=true;}});
  // Same rule for every "you are not looking" signal: stop sound, keep the position; ♫ resumes it.
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseMusic('hidden');else{lastCT=-1;schedule();}});
  window.addEventListener('pagehide',()=>pauseMusic('pagehide'));
  new ResizeObserver(queueResize).observe(hero);
  new IntersectionObserver(entries=>{viewable=entries[0].isIntersecting;if(!viewable)pauseMusic('scrolled-away');else schedule();},{threshold:.03}).observe(hero);
  new MutationObserver(()=>{labels();queueResize();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang','data-theme']});
  reduced.addEventListener('change',()=>{labels();clear();schedule();});
  document.fonts.ready.then(()=>{resize();schedule();});resize();publish();
})();
