/* Shared homepage audio clock (AE-HOME-SOUNDLIGHT-15S fix).
   The 15s opening and the Aurelia track share ONE AudioContext.
   The track is decoded once and played with AudioBufferSourceNode, so the
   light reads AudioContext.currentTime — the clock that renders the samples.
   The previous path kept a second context for the opening (suspended on
   handoff) and pulled <audio> through MediaElementSourceNode. That node has
   its own media clock, and Chrome can latch its resampler at the wrong ratio
   when a window drag blocks the main thread: the file keeps currentTime at
   1x while the heard pitch/speed changes, so the lasers slip off the kicks. */
(()=>{
  'use strict';
  const el=document.getElementById('ae-home-audio');
  if(!el)return;
  const url=el.getAttribute('src');
  const log=[];
  const stamp=(ev,extra)=>{const row={ev,t:+performance.now().toFixed(1),...(extra||{})};log.push(row);if(log.length>80)log.shift();return row;};
  let ctx=null,master=null,analyser=null,bins=null,buffer=null,loadP=null,source=null;
  let playing=false,origin=0,offset=0,latchedLatency=0;
  const bytesP=fetch(url).then(r=>{if(!r.ok)throw new Error('music '+r.status);return r.arrayBuffer();});
  function context(){
    if(ctx)return ctx;
    const A=window.AudioContext||window.webkitAudioContext;if(!A)throw new Error('Audio unavailable');
    ctx=new A({latencyHint:'interactive'});
    master=ctx.createGain();master.gain.value=.55;
    analyser=ctx.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.08;
    master.connect(analyser);analyser.connect(ctx.destination);
    bins=new Uint8Array(analyser.frequencyBinCount);
    ctx.addEventListener('statechange',()=>stamp('ctx',{state:ctx.state,sampleRate:ctx.sampleRate}));
    return ctx;
  }
  function unlock(){
    const c=context();
    try{const b=c.createBuffer(1,1,22050),s=c.createBufferSource();s.buffer=b;s.connect(c.destination);s.start(0);}catch(e){}
    const p=c.resume();return p&&p.then?p:Promise.resolve();
  }
  function load(){
    if(buffer)return Promise.resolve(buffer);
    if(loadP)return loadP;
    loadP=bytesP.then(ab=>context().decodeAudioData(ab.slice(0))).then(buf=>{buffer=buf;stamp('decoded',{duration:+buf.duration.toFixed(3),sampleRate:buf.sampleRate,ctxRate:context().sampleRate});return buf;}).catch(err=>{loadP=null;throw err;});
    return loadP;
  }
  function stopSource(){
    if(!source)return;
    const node=source;source=null;
    try{node.onended=null;node.stop(0);node.disconnect();}catch(e){}
  }
  function latency(){return ctx?(ctx.outputLatency||ctx.baseLatency||0):0;}
  function transportTime(){
    if(!playing||!ctx)return offset;
    const dur=buffer?buffer.duration:0;
    let elapsed=ctx.currentTime-origin;if(elapsed<0)elapsed=0;
    let t=offset+elapsed;
    if(dur>0){t%=dur;if(t<0)t+=dur;}
    return t;
  }
  function audibleTime(){
    guardRate();
    if(!playing||!ctx||!buffer)return offset;
    let elapsed=ctx.currentTime-origin;if(elapsed<0)elapsed=0;
    return window.aeHomeAudioEnergy.audiblePosition(offset,elapsed,latchedLatency,buffer.duration);
  }
  function guardRate(){
    if(!source)return;
    const rate=source.playbackRate.value;
    if(Math.abs(rate-1)>1e-4){stamp('rate-corrected',{was:rate});source.playbackRate.setValueAtTime(1,ctx.currentTime);}
  }
  function play(from){
    const c=context();if(!buffer)throw new Error('Music is not decoded');
    stopSource();
    const dur=buffer.duration;
    let start=isFinite(from)?from:0;
    if(start<0)start=0;
    if(dur>0&&start>=dur)start%=dur;
    const node=c.createBufferSource();
    node.buffer=buffer;node.loop=true;node.playbackRate.setValueAtTime(1,c.currentTime);
    node.connect(master);
    const when=c.currentTime+.03;
    node.start(when,start);
    source=node;origin=when;offset=start;playing=true;latchedLatency=latency();
    node.onended=()=>{if(source===node){source=null;playing=false;stamp('ended',{offset});}};
    stamp('play',{from:+start.toFixed(3),when:+when.toFixed(3),sampleRate:c.sampleRate,latency:+latency().toFixed(4)});
    return {from:start,when};
  }
  function pause(){
    if(playing)offset=transportTime();
    playing=false;stopSource();
    stamp('pause',{offset:+offset.toFixed(3)});
    return offset;
  }
  function suspendIfIdle(){
    if(!ctx||playing)return;
    if(ctx.state==='running')ctx.suspend().catch(()=>{});
  }
  function readBass(){if(!analyser||!bins)return new Uint8Array(0);analyser.getByteFrequencyData(bins);return bins;}
  function probe(){
    return {playing,offset:+offset.toFixed(3),transport:playing?+transportTime().toFixed(3):+offset.toFixed(3),audible:playing?+audibleTime().toFixed(3):+offset.toFixed(3),sampleRate:ctx?ctx.sampleRate:0,state:ctx?ctx.state:'none',latency:+latency().toFixed(4),rate:source?source.playbackRate.value:1,kind:'buffer',duration:buffer?+buffer.duration.toFixed(3):0,contexts:1};
  }
  function snapshot(){return {...probe(),log:log.slice()};}
  addEventListener('blur',()=>stamp('blur',probe()));
  addEventListener('focus',()=>stamp('focus',probe()));
  document.addEventListener('visibilitychange',()=>stamp('visibility',{hidden:document.hidden,vis:document.visibilityState,...probe()}));
  addEventListener('resize',()=>stamp('resize',{w:innerWidth,h:innerHeight,...probe()}));
  const idle=()=>load().catch(()=>{});
  if('requestIdleCallback' in window)requestIdleCallback(idle,{timeout:4000});else setTimeout(idle,1500);
  window.aeHomeAudio={context,unlock,load,play,pause,suspendIfIdle,audibleTime,transportTime,latency,readBass,isPlaying:()=>playing,snapshot,probe,log:()=>log.slice()};
})();
