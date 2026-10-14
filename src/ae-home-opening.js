/* AE-HOME-SOUNDLIGHT-15S-20261014-0730 + FIX-20261014-0817
   15-second homepage sound-and-light opening = the first 15 s of the homepage ♫ music.
   v2 (fix): no private 112 BPM WebAudio synth and no second AudioContext any more. The opening
   plays the real track (aurelia-techno-eternal-148bpm.m4a) from the shared cue through
   window.aeHomePlayer (ae-home-light.js): snare-roll build → drop → groove, and stops at 15.0 s.
   Light/laser drawing is the Owner-reviewed prototype look (sun glow, pulsing ring, corner
   lasers, beat specks) but every pulse now comes from the measured beat timeline of that same
   track, on the same track clock. Mid-opening ♫ = keep the same song playing (no restart). */
(()=>{
  'use strict';
  const hero=document.querySelector('.hero'),player=window.aeHomePlayer;
  if(!hero||!player)return;
  const params=new URLSearchParams(location.search);
  const tl=player.timeline,CUE=player.CUE,DURATION=player.OPENING,FADE_IN=.6,FADE_OUT=.8,HOME_GAIN=1.7;
  const rhythm=window.aeHomeAudioEnergy.createRhythm(tl?.events,tl?.accents,tl?.sections);
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const canvas=document.createElement('canvas');
  canvas.id='ae-home-opening-fx';canvas.setAttribute('aria-hidden','true');canvas.dataset.state='idle';
  const baseLayer=document.getElementById('ae-home-light');
  if(baseLayer&&baseLayer.nextSibling)hero.insertBefore(canvas,baseLayer.nextSibling);else hero.prepend(canvas);
  const ctx=canvas.getContext('2d');
  const side=document.createElement('div');side.className='ae-opening-side';side.hidden=true;
  side.innerHTML='<button type="button" id="aeOpeningSound" hidden></button><button type="button" id="aeOpeningStop" hidden></button><button type="button" id="aeOpeningReplay" hidden></button><small id="aeOpeningHint" aria-live="polite"></small>';
  hero.appendChild(side);
  const soundBtn=side.querySelector('#aeOpeningSound'),stopBtn=side.querySelector('#aeOpeningStop'),replayBtn=side.querySelector('#aeOpeningReplay'),hint=side.querySelector('#aeOpeningHint');
  const zh=()=>document.documentElement.lang==='zh-Hant';
  const T={
    replay:()=>zh()?'▶ 重播聲光':'▶ Replay light & sound',
    replayHint:()=>zh()?'想再感受一次？點這裡重播聲光':'Want to feel it again? Tap here to replay',
    sound:()=>zh()?'🔊 點一下開啟聲音':'🔊 Tap to turn on sound',
    soundHint:()=>zh()?'瀏覽器暫停了自動播放聲音；點一下，音樂與光會從頭同步開始':'Your browser paused autoplay sound. Tap once and music and light restart together.',
    stop:()=>zh()?'■ 停止聲光':'■ Stop light & sound',
    stopHint:()=>zh()?'按 ♫ 可接著聽完整音樂':'Press ♫ to keep the full music playing'
  };
  let replayReady=false;
  let W=0,H=0,dpr=1,sunX=0,sunY=0,artBottom=0,specks=[],raf=0,prev=0,lastBeat=-1,gentle=false,state='idle',run=0,frames=0,pulses=0;
  const trace=[];// QA: [trackTime, pulse] per painted frame
  const log=[];const stamp=(ev,extra)=>{const e={ev,run,phase:player.phase,sound:player.sound,track:+player.trackTime().toFixed(3),perf:+performance.now().toFixed(1),...(extra||{})};log.push(e);if(log.length>200)log.shift();return e;};
  function resize(){
    const r=hero.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,2);
    const cw=Math.round(W*dpr),ch=Math.round(H*dpr);if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}ctx.setTransform(dpr,0,0,dpr,0,0);
    const copy=hero.querySelector('.hero-copy');artBottom=copy?Math.max(80,copy.getBoundingClientRect().top-r.top-12):H*.55;
    const pseudo=getComputedStyle(hero,'::before'),pw=parseFloat(pseudo.width),pt=parseFloat(pseudo.top);
    if(pw>0&&isFinite(pt)){sunX=W/2-pw*.02;sunY=pt+pw*1536/1110*.522;}else{sunX=W*.55;sunY=H*.40;}
    sunY=Math.max(40,sunY);
  }
  let resizeQueued=0;const queueResize=()=>{if(state!=='running'||resizeQueued)return;resizeQueued=requestAnimationFrame(()=>{resizeQueued=0;resize();});};
  function add(x,y,n){if(gentle)return;for(let i=0;i<n;i++){const a=Math.random()*6.283,s=15+Math.random()*28;specks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,age:0,life:.4+Math.random()*.45,color:[45,170,195,330][i%4]})}specks=specks.slice(-60);}
  function envelope(t,track){const end=player.openingEnd;return Math.max(0,Math.min(1,t/FADE_IN,isFinite(end)?(end-track)/FADE_OUT:1));}
  function draw(now){
    raf=0;if(state!=='running')return;
    const dt=Math.min(.05,(now-prev)/1000)||.016;prev=now;
    const track=player.lightTime(),t=Math.max(0,track-CUE),env=envelope(t,track);
    ctx.clearRect(0,0,W,H);ctx.save();ctx.globalCompositeOperation='screen';
    const b=rhythm.update(0,track);
    // Real-track arc: build (snare roll) → drop flash → groove at night-light strength → fade.
    const neon=b.stage!=='build',build=b.stage==='build'?b.buildProgress:1;
    const intensity=(neon?1.45:.85+.45*build)*env*HOME_GAIN*(1+b.dropPulse*.6);
    const pow=player.sound==='loading'?0:Math.min(1,b.pulse);
    const x=sunX,y=sunY,r=Math.min(W*.39,175);
    if(gentle){
      const breathe=.5+.5*Math.sin(t*Math.PI*2/(60/148*4));
      const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,223,116,'+((.05+.06*breathe)*env)+')');g.addColorStop(1,'rgba(120,250,230,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }else{
      let g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,223,116,'+((.04+.16*pow)*intensity)+')');g.addColorStop(.43,'rgba(134,252,189,'+((.02+.07*pow)*intensity)+')');g.addColorStop(1,'rgba(120,250,230,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
      ctx.beginPath();ctx.ellipse(x,y,Math.min(93,W*.16)+pow*14,Math.min(75,W*.13)+pow*10,-.12,0,2*Math.PI);ctx.lineWidth=1.4;ctx.strokeStyle='rgba(255,221,135,'+(pow*.29*intensity)+')';ctx.stroke();
      const top=Math.min(H*.09,artBottom*.18),time=t;
      const origins=[[W*.08,top],[W*.92,top]];if(neon)origins.push([W*.02,artBottom*.42],[W*.98,artBottom*.42]);
      for(let i=0;i<origins.length;i++){const sd=i%2;ctx.beginPath();ctx.moveTo(origins[i][0],origins[i][1]);ctx.lineTo(x+(sd?1:-1)*Math.sin(time*.46+i*.7)*r*.65,y+Math.cos(time*.3+i)*16);const col=sd?'rgba(252,85,126,'+Math.min(1,(.06+.13*pow)*intensity)+')':'rgba(73,253,169,'+Math.min(1,(.06+.18*pow)*intensity)+')';ctx.shadowColor=sd?'#fc557e':'#49fda9';ctx.shadowBlur=6+pow*14;ctx.strokeStyle=col;ctx.lineWidth=1.5+pow*1.6;ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,249,223,'+Math.min(1,pow*.35*intensity)+')';ctx.lineWidth=.7;ctx.stroke();}
      const beatNo=b.stage==='build'?b.accentCount:b.count;
      if(beatNo!==lastBeat&&(b.beat||b.accentBeat)){lastBeat=beatNo;pulses++;if(b.stage!=='build'&&b.count%4===0)add(x,y,16);else if(b.stage==='build'&&b.buildProgress>.6&&b.accentCount%4===0)add(x,y,8);if(b.dropPulse>.9)add(x,y,24);hero.dataset.openingBeat=String(b.count);}
      specks=specks.filter(p=>p.age<p.life);for(const p of specks){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;const a=Math.max(0,1-p.age/p.life);ctx.fillStyle='hsla('+p.color+',90%,78%,'+a*.73*env+')';ctx.beginPath();ctx.arc(p.x,p.y,a*2+.25,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();frames++;trace.push([+track.toFixed(4),+pow.toFixed(3),b.stage]);if(trace.length>1200)trace.shift();
    hero.dataset.openingTrack=track.toFixed(3);hero.dataset.openingStage=b.stage;
    raf=requestAnimationFrame(draw);
  }
  function startVisual(){
    run++;state='running';specks=[];lastBeat=-1;frames=0;pulses=0;trace.length=0;rhythm.reset();resize();
    canvas.dataset.state='running';hero.dataset.openingState='running';hero.dataset.openingRun=String(run);delete hero.dataset.openingEndReason;
    prev=performance.now();if(!raf)raf=requestAnimationFrame(draw);
  }
  function stopVisual(reason){
    if(state!=='running')return;
    state='ended';if(raf)cancelAnimationFrame(raf);raf=0;specks=[];const myRun=run;setTimeout(()=>{if(state!=='running'&&run===myRun)ctx.clearRect(0,0,W,H);},500);/* CSS fades the last frame out (.45s), then it is cleared */
    canvas.dataset.state='ended';hero.dataset.openingState='ended';hero.dataset.openingEndReason=reason;
    stamp('end',{reason});
  }
  function hideSide(){side.hidden=true;soundBtn.hidden=true;stopBtn.hidden=true;replayBtn.hidden=true;hint.textContent='';}
  function render(){
    const ph=player.phase,snd=player.sound;
    hero.dataset.openingMode=snd==='light'?'light':snd==='audio'?'audio':snd;
    if(ph==='opening'){
      if(state!=='running')startVisual();
      side.hidden=false;replayBtn.hidden=true;
      if(snd==='light'){soundBtn.hidden=false;soundBtn.textContent=T.sound();stopBtn.hidden=false;stopBtn.textContent=T.stop();hint.textContent=T.soundHint();}
      else{soundBtn.hidden=true;stopBtn.hidden=false;stopBtn.textContent=T.stop();hint.textContent=T.stopHint();}
      return;
    }
    if(state==='running')stopVisual(player.phase==='music'?'to-music:'+player.reason:player.reason||'stopped');
    if(ph==='music'||(player.sound==='loading'))hideSide();
    else if(ph==='ended'||ph==='paused'||(ph==='idle'&&replayReady)){side.hidden=false;soundBtn.hidden=true;stopBtn.hidden=true;replayBtn.hidden=false;replayBtn.textContent=T.replay();hint.textContent=T.replayHint();}
    else hideSide();
  }
  player.subscribe(()=>render());
  soundBtn.addEventListener('click',()=>{gentle=motion.matches;stamp('sound-request',{source:'tap-to-sound'});player.startOpening('tap-to-sound');});
  replayBtn.addEventListener('click',()=>{gentle=motion.matches;stamp('replay');if(state==='running')stopVisual('replay');player.startOpening('replay');});
  stopBtn.addEventListener('click',()=>player.endOpening('stop'));
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  if('ResizeObserver' in window)new ResizeObserver(queueResize).observe(hero);
  // ---- QA surface (read-only) ----
  window.__aeOpening={
    snapshot:()=>({state,phase:player.phase,mode:player.sound,reason:player.reason,run,gentle,clock:+Math.max(0,player.trackTime()-CUE).toFixed(3),track:+player.trackTime().toFixed(3),rafActive:!!raf,frames,pulses,specks:specks.length,player:player.snapshot(),
      side:{hidden:side.hidden,sound:!soundBtn.hidden,stop:!stopBtn.hidden,replay:!replayBtn.hidden,label:(!replayBtn.hidden?replayBtn:!soundBtn.hidden?soundBtn:stopBtn).textContent,hint:hint.textContent}}),
    log:()=>log.concat(player.log().map(e=>({...e,src:'player'}))).sort((a,b)=>a.perf-b.perf),
    trace:()=>trace.slice()
  };
  // ---- autostart on homepage entry ----
  function autostart(){
    replayReady=true;
    if(params.get('opening')==='off'){stamp('skipped',{why:'opening=off'});render();return;}
    if(motion.matches){gentle=true;stamp('skipped',{why:'prefers-reduced-motion'});render();return;}
    gentle=false;player.startOpening('autostart');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',autostart,{once:true});else autostart();
})();
