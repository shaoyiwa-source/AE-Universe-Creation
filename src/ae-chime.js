/* AE chime family 2026-10-19 — tiny synthesized sounds (WebAudio, no audio files).
   One shared AudioContext per page, created only inside a user gesture (browser autoplay rules):
   the first pointerdown / touchend / click / keydown unlocks it. Before that every call is silent.
   API: aeChime.tap(x01) soft tap chime · glow() shimmer · coin(i) one coin clink · laser(i) one zap · context() */
(()=>{
  'use strict';
  if(window.aeChime)return;
  const AC=window.AudioContext||window.webkitAudioContext;
  let ctx=null,master=null,lastTap=-1;const stats={tap:0,glow:0,coin:0,laser:0};
  function context(){
    if(!AC)return null;
    if(!ctx){ctx=new AC();master=ctx.createGain();master.gain.value=.9;
      const comp=ctx.createDynamicsCompressor();comp.threshold.value=-18;comp.ratio.value=3;master.connect(comp);comp.connect(ctx.destination);}
    return ctx;
  }
  function unlock(){
    try{const c=context();if(!c)return;if(c.state!=='running')c.resume().catch(()=>{});
      // iOS: one silent buffer inside the gesture fully opens the output.
      const b=c.createBuffer(1,1,c.sampleRate),s=c.createBufferSource();s.buffer=b;s.connect(c.destination);s.start(0);}catch(e){}
  }
  const GESTURES=['pointerdown','touchend','click','keydown'];
  function first(){unlock();if(ctx&&ctx.state==='running')for(const g of GESTURES)document.removeEventListener(g,first,true);}
  for(const g of GESTURES)document.addEventListener(g,first,{capture:true,passive:true});
  function ready(){return !!ctx&&ctx.state==='running';}
  function after(fn){if(!ctx)return;if(ctx.state==='running')fn();else ctx.resume().then(()=>{if(ctx.state==='running')fn();}).catch(()=>{});}
  // One bell-like partial: sine with a soft attack and an exponential tail.
  function partial(t,freq,peak,decay,type,detune){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type||'sine';o.frequency.setValueAtTime(freq,t);if(detune)o.detune.setValueAtTime(detune,t);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+decay);
    o.connect(g);g.connect(master);o.start(t);o.stop(t+decay+.05);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  // Pentatonic (C major) so any sequence of taps sounds consonant.
  const SCALE=[0,2,4,7,9,12,14,16];
  function tap(x01){
    after(()=>{const t=ctx.currentTime;if(t-lastTap<.05)return;lastTap=t;
      const step=SCALE[Math.max(0,Math.min(SCALE.length-1,Math.floor((+x01||.5)*SCALE.length)))],f=659.25*2**(step/12);
      stats.tap++;partial(t,f,.055,.9);partial(t,f*2,.018,.45);partial(t,f*3.01,.006,.25);});
  }
  function glow(){
    after(()=>{stats.glow++;const t=ctx.currentTime,notes=[523.25,659.25,783.99,987.77,1318.5];
      notes.forEach((f,i)=>{partial(t+i*.07,f,.045,1.6-i*.12);partial(t+i*.07,f*2,.012,.7,'sine',6);});
      // Airy shimmer on top.
      for(let i=0;i<6;i++)partial(t+.2+i*.09,2093*2**((i%3)*4/12),.008,.5,'sine',(i%2?8:-8));});
  }
  function coin(i){
    after(()=>{stats.coin++;const t=ctx.currentTime,f=1900+((i*137)%9)*130;
      partial(t,f,.04,.28);partial(t,f*2.76,.016,.16);partial(t+.045,f*1.5,.018,.2);});
  }
  function laser(i){
    after(()=>{stats.laser++;const t=ctx.currentTime,o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain(),start=1700+((i||0)%4)*220;
      o.type='sawtooth';o.frequency.setValueAtTime(start,t);o.frequency.exponentialRampToValueAtTime(140,t+.24);
      f.type='lowpass';f.frequency.setValueAtTime(4200,t);f.frequency.exponentialRampToValueAtTime(600,t+.24);f.Q.value=6;
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.035,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+.28);
      o.connect(f);f.connect(g);g.connect(master);o.start(t);o.stop(t+.3);o.onended=()=>{o.disconnect();f.disconnect();g.disconnect();};
      partial(t,start/2,.012,.12,'triangle');});
  }
  window.aeChime={context,unlock,ready,tap,glow,coin,laser,stats};
})();
