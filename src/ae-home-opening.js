/* AE-HOME-SOUNDLIGHT-15S-20261014-0730
   15-second homepage sound-and-light opening.
   Light/laser drawing and WebAudio rhythm are reused from the Owner-reviewed prototype
   "AE_Feel_the_Flow_Interactive_Preview.html" (sha256 e4a6ecfb…a14a9): 112 BPM sine kick
   + triangle bass (55/65.41/73.42/49 Hz), sun glow, pulsing ellipse ring, two corner lasers
   and beat specks. Light and music are driven by ONE clock: AudioContext.currentTime when
   sound runs, performance.now() when the browser blocks sound. Hard stop at 15 s. */
(()=>{
  'use strict';
  const hero=document.querySelector('.hero');
  if(!hero)return;
  const params=new URLSearchParams(location.search);
  const HOME_GAIN=1.7,DURATION=15,LEAD=.075,BPM=112,BEAT=60/BPM,FADE_IN=.6,FADE_OUT=.8,MASTER=.16;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const canvas=document.createElement('canvas');
  canvas.id='ae-home-opening-fx';canvas.setAttribute('aria-hidden','true');canvas.dataset.state='idle';
  const baseLayer=document.getElementById('ae-home-light');
  if(baseLayer&&baseLayer.nextSibling)hero.insertBefore(canvas,baseLayer.nextSibling);else hero.prepend(canvas);
  const ctx=canvas.getContext('2d');
  const side=document.createElement('div');side.className='ae-opening-side';side.hidden=true;
  side.innerHTML='<button type="button" id="aeOpeningSound" hidden></button><button type="button" id="aeOpeningReplay" hidden></button><small id="aeOpeningHint" aria-live="polite"></small>';
  hero.appendChild(side);
  const soundBtn=side.querySelector('#aeOpeningSound'),replayBtn=side.querySelector('#aeOpeningReplay'),hint=side.querySelector('#aeOpeningHint');
  const zh=()=>document.documentElement.lang==='zh-Hant';
  const T={
    replay:()=>zh()?'▶ 重播聲光':'▶ Replay light & sound',
    replayHint:()=>zh()?'想再感受一次？點這裡重播聲光':'Want to feel it again? Tap here to replay',
    sound:()=>zh()?'🔊 點一下開啟聲音':'🔊 Tap to turn on sound',
    soundHint:()=>zh()?'瀏覽器暫停了自動播放聲音；點一下，音樂與光會從頭同步開始':'Your browser paused autoplay sound. Tap once and music and light restart together.',
    noAudio:()=>zh()?'此瀏覽器無法播放聲音，只顯示光效':'Sound is not available in this browser; showing light only.'
  };
  // ---- state ----
  let meter=null,meterBuf=null,syncSamples=[],pulses=0,frames=0,audio=null,master=null,mode='idle',state='idle',run=0,t0=0,p0=0,raf=0,tick=0,prev=0,nBeat=0,nextBeat=0,lastDrawnBeat=-1;
  let W=0,H=0,dpr=1,sunX=0,sunY=0,artBottom=0,specks=[],nodes=new Set(),gentle=false,blocked=false,noAudio=false;
  const log=[];const stamp=(ev,extra)=>{const e={ev,run,mode,clock:+clock().toFixed(3),perf:+performance.now().toFixed(1),...(extra||{})};log.push(e);if(log.length>200)log.shift();return e;};
  function clock(){
    if(state!=='running')return 0;
    if(mode==='audio'&&audio)return Math.max(0,audio.currentTime-t0);
    return Math.max(0,(performance.now()-p0)/1000);
  }
  // Light uses the same clock, shifted by the device's output latency so pulses match what is heard.
  function lightClock(){
    if(mode==='audio'&&audio){const lat=(audio.outputLatency||audio.baseLatency||0);return Math.max(0,clock()-lat);}
    return clock();
  }
  // ---- geometry: follow the homepage artwork (hero::before) ----
  function resize(){
    const r=hero.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    const copy=hero.querySelector('.hero-copy');artBottom=copy?Math.max(80,copy.getBoundingClientRect().top-r.top-12):H*.55;
    const pseudo=getComputedStyle(hero,'::before'),pw=parseFloat(pseudo.width),pt=parseFloat(pseudo.top);
    if(pw>0&&isFinite(pt)){sunX=W/2-pw*.02;sunY=pt+pw*1536/1110*.522;/* centre of the painted sun/eye */}else{sunX=W*.55;sunY=H*.40;}
    sunY=Math.max(40,sunY);
  }
  // ---- prototype audio (verbatim voice design) ----
  function ensureAudio(){
    if(audio)return audio;
    if(!window.aeHomeAudio){noAudio=true;return null;}
    try{audio=window.aeHomeAudio.context();master=audio.createGain();master.gain.value=0;meter=audio.createAnalyser();meter.fftSize=512;meterBuf=new Float32Array(512);master.connect(meter);meter.connect(audio.destination);}catch(e){noAudio=true;audio=null;}
    return audio;
  }
  function osc(time,bass){
    const o=audio.createOscillator(),g=audio.createGain();o.type=bass?'triangle':'sine';
    const f=bass?[55,65.41,73.42,49][Math.floor(nBeat/4)%4]:126;
    o.frequency.setValueAtTime(f,time);if(!bass)o.frequency.exponentialRampToValueAtTime(48,time+.17);
    g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(bass?.10:.34,time+.013);g.gain.exponentialRampToValueAtTime(.0001,time+(bass?.35:.25));
    o.connect(g).connect(master);o.start(time);o.stop(time+(bass?.38:.26));
    nodes.add(o);o.onended=()=>{nodes.delete(o);try{o.disconnect();g.disconnect();}catch(e){}};
  }
  function scheduleAudio(){
    if(mode!=='audio'||!audio)return;
    const end=t0+DURATION-.3; // no new hit can ring past the hard stop
    while(nextBeat<audio.currentTime+.17&&nextBeat<end){osc(nextBeat,false);if(nBeat%2===0)osc(nextBeat,true);nBeat++;nextBeat+=BEAT;}
  }
  function unlockGesture(){
    // Must run synchronously inside the tap: resume + a silent buffer (iOS Safari unlock).
    const a=ensureAudio();if(!a)return null;
    try{const b=a.createBuffer(1,1,22050),s=a.createBufferSource();s.buffer=b;s.connect(a.destination);s.start(0);}catch(e){}
    const p=a.resume();return p&&p.then?p:Promise.resolve();
  }
  // ---- prototype light (draw adapted to the homepage artwork position) ----
  function add(x,y,n){if(gentle)return;for(let i=0;i<n;i++){const a=Math.random()*6.283,s=15+Math.random()*28;specks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,age:0,life:.4+Math.random()*.45,color:[45,170,195,330][i%4]})}specks=specks.slice(-60);}
  function envelope(t){return Math.max(0,Math.min(1,t/FADE_IN,(DURATION-t)/FADE_OUT));}
  function draw(now){
    raf=0;if(state!=='running')return;
    const dt=Math.min(.05,(now-prev)/1000)||.016;prev=now;
    const tc=clock();if(tc>=DURATION){finish('complete');return;}
    const t=lightClock(),env=envelope(t);
    ctx.clearRect(0,0,W,H);ctx.save();ctx.globalCompositeOperation='screen';
    const time=Math.max(0,t-LEAD),beatIndex=Math.floor(time/BEAT),phase=(time/BEAT)%1;
    // Soft → night-light → soft: the prototype's two intensities, as a 15 s arc.
    const neon=t>5&&t<12,intensity=(neon?1.45:1)*env*HOME_GAIN;
    const x=sunX,y=sunY,r=Math.min(W*.39,175);
    if(gentle){
      const breathe=.5+.5*Math.sin(t*Math.PI*2/(BEAT*4));
      const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,223,116,'+((.05+.06*breathe)*env)+')');g.addColorStop(1,'rgba(120,250,230,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }else{
      const pow=t<LEAD?0:Math.pow(1-phase,4);
      if(mode==='audio'&&meter){meter.getFloatTimeDomainData(meterBuf);let q=0;for(let i=0;i<meterBuf.length;i++)q+=meterBuf[i]*meterBuf[i];syncSamples.push([pow,Math.sqrt(q/meterBuf.length)]);if(syncSamples.length>900)syncSamples.shift();}
      let g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,223,116,'+((.04+.16*pow)*intensity)+')');g.addColorStop(.43,'rgba(134,252,189,'+((.02+.07*pow)*intensity)+')');g.addColorStop(1,'rgba(120,250,230,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
      ctx.beginPath();ctx.ellipse(x,y,Math.min(93,W*.16)+pow*14,Math.min(75,W*.13)+pow*10,-.12,0,2*Math.PI);ctx.lineWidth=1.4;ctx.strokeStyle='rgba(255,221,135,'+(pow*.29*intensity)+')';ctx.stroke();
      const top=Math.min(H*.09,artBottom*.18);
      const origins=[[W*.08,top],[W*.92,top]];if(neon)origins.push([W*.02,artBottom*.42],[W*.98,artBottom*.42]);
      for(let i=0;i<origins.length;i++){const side=i%2;ctx.beginPath();ctx.moveTo(origins[i][0],origins[i][1]);ctx.lineTo(x+(side?1:-1)*Math.sin(time*.46+i*.7)*r*.65,y+Math.cos(time*.3+i)*16);const col=side?'rgba(252,85,126,'+Math.min(1,(.06+.13*pow)*intensity)+')':'rgba(73,253,169,'+Math.min(1,(.06+.18*pow)*intensity)+')';ctx.shadowColor=side?'#fc557e':'#49fda9';ctx.shadowBlur=6+pow*14;ctx.strokeStyle=col;ctx.lineWidth=1.5+pow*1.6;ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,249,223,'+Math.min(1,pow*.35*intensity)+')';ctx.lineWidth=.7;ctx.stroke();}
      if(beatIndex!==lastDrawnBeat&&t>=LEAD){lastDrawnBeat=beatIndex;pulses++;if(beatIndex%4===0)add(x,y,neon?16:10);hero.dataset.openingBeat=String(beatIndex);}
      specks=specks.filter(p=>p.age<p.life);for(const p of specks){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;const a=Math.max(0,1-p.age/p.life);ctx.fillStyle='hsla('+p.color+',90%,78%,'+a*.73*env+')';ctx.beginPath();ctx.arc(p.x,p.y,a*2+.25,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();frames++;
    raf=requestAnimationFrame(draw);
  }
  // ---- lifecycle ----
  function stopNodes(hard){
    if(!audio||!master)return;
    const now=audio.currentTime;
    try{master.gain.cancelScheduledValues(now);master.gain.setValueAtTime(hard?0:master.gain.value,now);if(!hard)master.gain.linearRampToValueAtTime(0,now+.08);}catch(e){}
    const list=[...nodes];
    const kill=()=>{for(const o of list){try{o.stop(0);o.disconnect();}catch(e){}nodes.delete(o);}};
    // Never suspend the shared context here. Suspending on the music handoff
    // reconfigures the output device under the track that is about to start.
    if(hard){kill();return;}
    setTimeout(kill,90);
  }
  function halt(){
    clearInterval(tick);tick=0;if(raf)cancelAnimationFrame(raf);raf=0;specks=[];
    ctx.clearRect(0,0,W,H);
  }
  function finish(reason){
    if(state!=='running')return;
    const at=clock();state='ended';halt();stopNodes(reason!=='complete');
    canvas.dataset.state='ended';hero.dataset.openingState='ended';hero.dataset.openingEndReason=reason;
    stamp('end',{reason,elapsed:+at.toFixed(3)});
    showReplay();
    if(reason!=='dock-music')setTimeout(()=>{if(state!=='running'&&window.aeHomeAudio&&!window.aeHomeAudio.isPlaying())window.aeHomeAudio.suspendIfIdle();},180);
  }
  function begin(nextMode){
    if(state==='running'){state='restarting';halt();stopNodes(true);}
    run++;mode=nextMode;state='running';specks=[];syncSamples=[];nBeat=0;lastDrawnBeat=-1;pulses=0;frames=0;resize();
    // One experience at a time: pause the homepage music dock if it is playing.
    if(hero.dataset.musicState==='playing'){const m=document.getElementById('aeMusicButton');if(m){pausingDock=true;m.click();pausingDock=false;}}
    if(mode==='audio'){
      t0=audio.currentTime+.02;nextBeat=t0+LEAD;
      master.gain.cancelScheduledValues(0);master.gain.setValueAtTime(MASTER,t0);master.gain.setValueAtTime(MASTER,t0+DURATION-FADE_OUT);master.gain.linearRampToValueAtTime(0,t0+DURATION);
      scheduleAudio();
    }
    p0=performance.now();
    tick=setInterval(()=>{if(state!=='running')return;scheduleAudio();if(clock()>=DURATION)finish('complete');},50);
    canvas.dataset.state='running';hero.dataset.openingState='running';hero.dataset.openingMode=mode;hero.dataset.openingRun=String(run);
    stamp('start',{ctxState:audio?audio.state:'none',gentle});
    prev=performance.now();if(!raf)raf=requestAnimationFrame(draw);
    if(mode==='light'&&blocked&&!noAudio)showSound();else hideSide();
  }
  let pausingDock=false;
  function hideSide(){side.hidden=true;soundBtn.hidden=true;replayBtn.hidden=true;hint.textContent='';}
  function showSound(){side.hidden=false;replayBtn.hidden=true;soundBtn.hidden=false;soundBtn.textContent=T.sound();hint.textContent=T.soundHint();}
  function showReplay(){side.hidden=false;soundBtn.hidden=true;replayBtn.hidden=false;replayBtn.textContent=T.replay();hint.textContent=noAudio?T.noAudio():T.replayHint();}
  function relabel(){if(side.hidden)return;if(!soundBtn.hidden){soundBtn.textContent=T.sound();hint.textContent=T.soundHint();}if(!replayBtn.hidden){replayBtn.textContent=T.replay();hint.textContent=noAudio?T.noAudio():T.replayHint();}}
  function playWithSound(source){
    gentle=motion.matches;
    const p=unlockGesture();
    if(!p){begin('light');return;}
    stamp('sound-request',{source});
    p.then(()=>{if(audio.state==='running'){blocked=false;begin('audio');}else{blocked=true;begin('light');}})
     .catch(()=>{blocked=true;begin('light');});
  }
  soundBtn.addEventListener('click',()=>playWithSound('tap-to-sound'));
  replayBtn.addEventListener('click',()=>playWithSound('replay'));
  // If the visitor starts the homepage music dock, the opening yields immediately.
  document.addEventListener('click',e=>{if(!pausingDock&&state==='running'&&e.target.closest&&e.target.closest('#aeMusicButton'))finish('dock-music');},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish('hidden');});
  addEventListener('pagehide',()=>finish('pagehide'));
  new MutationObserver(relabel).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  if('ResizeObserver' in window)new ResizeObserver(()=>{if(state==='running')resize();}).observe(hero);
  addEventListener('resize',()=>{if(state==='running')resize();});
  // ---- QA surface (read-only) ----
  window.__aeOpening={
    snapshot:()=>({state,mode,run,gentle,blocked,noAudio,clock:+clock().toFixed(3),rafActive:!!raf,tickActive:!!tick,activeAudioNodes:nodes.size,ctxState:audio?audio.state:'none',masterGain:master?+master.gain.value.toFixed(4):null,pulses,frames,beatsScheduled:nBeat,specks:specks.length,sun:{x:Math.round(sunX),y:Math.round(sunY)},side:{hidden:side.hidden,sound:!soundBtn.hidden,replay:!replayBtn.hidden,label:(!replayBtn.hidden?replayBtn:soundBtn).textContent,hint:hint.textContent}}),
    log:()=>log.slice(),
    sync:()=>{const n=syncSamples.length;if(n<20)return{n};let ma=0,mb=0;for(const[x,y]of syncSamples){ma+=x;mb+=y;}ma/=n;mb/=n;let c=0,va=0,vb=0;for(const[x,y]of syncSamples){c+=(x-ma)*(y-mb);va+=(x-ma)**2;vb+=(y-mb)**2;}
      const grid=mode==='audio'&&audio?((nextBeat-t0-LEAD)/BEAT):null;
      const corr=(k)=>{let sa=0,sb=0,m=0;for(let i=Math.max(0,-k);i<n&&i+k<n;i++){sa+=syncSamples[i][0];sb+=syncSamples[i+k][1];m++;}sa/=m;sb/=m;let cc=0,xa=0,xb=0;for(let i=Math.max(0,-k);i<n&&i+k<n;i++){const u=syncSamples[i][0]-sa,v=syncSamples[i+k][1]-sb;cc+=u*v;xa+=u*u;xb+=v*v;}return cc/Math.sqrt(xa*xb||1);};
      let best=0,bestC=-2;const lags={};for(let k=-16;k<=16;k++){const v=corr(k);lags[k]=+v.toFixed(3);if(v>bestC){bestC=v;best=k;}}
      return{bestLagFrames:best,bestLagCorrelation:+bestC.toFixed(3),halfBeatOffCorrelation:lags[16],lags,n,correlation:+(c/Math.sqrt(va*vb||1)).toFixed(3),meanPow:+ma.toFixed(3),meanRms:+mb.toFixed(4),audioGridBeats:grid===null?null:+grid.toFixed(6),lightTime:+lightClock().toFixed(3),outputLatency:audio?+(audio.outputLatency||audio.baseLatency||0).toFixed(4):0};}
  };
  // ---- autostart on homepage entry ----
  function autostart(){
    if(params.get('opening')==='off'){stamp('skipped',{why:'opening=off'});showReplay();return;}
    if(motion.matches){gentle=true;stamp('skipped',{why:'prefers-reduced-motion'});showReplay();return;}
    const a=ensureAudio();
    if(!a){begin('light');return;}
    if(a.state==='running'){begin('audio');return;}
    let settled=false;
    const p=a.resume();
    const decide=()=>{if(settled)return;settled=true;if(a.state==='running'){begin('audio');}else{blocked=true;stamp('autoplay-blocked',{ctxState:a.state});begin('light');}};
    if(p&&p.then)p.then(decide,decide);
    setTimeout(decide,350); // Chrome/Safari keep resume() pending until a gesture: light starts alone.
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',autostart,{once:true});else autostart();
})();
