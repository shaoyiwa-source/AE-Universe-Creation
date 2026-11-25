/* Scoped adaptation of AE homepage chime family 2026-10-19.
 * Same timbres; no global gesture listener, no second copy of tap percussion.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AEExperienceChime=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function create({AudioContext:AC=globalThis.AudioContext||globalThis.webkitAudioContext}={}){
 let ctx=null,master=null,lastTap=-1,enabled=false,dead=false,generation=0;const nodes=new Set();
 const stats={tap:0,glow:0,coin:0,laser:0};
 function context(){if(!AC||dead)return null;if(!ctx){ctx=new AC();master=ctx.createGain();master.gain.value=.9;const comp=ctx.createDynamicsCompressor();comp.threshold.value=-18;comp.ratio.value=3;master.connect(comp);comp.connect(ctx.destination);}return ctx;}
 function silence(){for(const o of nodes)try{o.stop();o.disconnect();}catch{}nodes.clear();}
 function enable(value){if(dead)return;enabled=!!value;generation++;if(!enabled){silence();if(ctx&&ctx.state==='running')Promise.resolve(ctx.suspend()).catch(()=>{});return;}try{const c=context();if(c&&c.state!=='running')Promise.resolve(c.resume()).catch(()=>{});}catch{enabled=false;}}
 function after(fn){if(dead||!enabled||!ctx)return;const token=generation;if(ctx.state==='running')fn();else Promise.resolve(ctx.resume()).then(()=>{if(!dead&&enabled&&token===generation&&ctx.state==='running')fn();}).catch(()=>{});}
  // One bell-like partial: sine with a soft attack and an exponential tail.
  function partial(t,freq,peak,decay,type,detune){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type||'sine';o.frequency.setValueAtTime(freq,t);if(detune)o.detune.setValueAtTime(detune,t);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+decay);
    o.connect(g);g.connect(master);nodes.add(o);o.start(t);o.stop(t+decay+.05);o.onended=()=>{nodes.delete(o);o.disconnect();g.disconnect();};
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
      o.connect(f);f.connect(g);g.connect(master);nodes.add(o);o.start(t);o.stop(t+.3);o.onended=()=>{nodes.delete(o);o.disconnect();f.disconnect();g.disconnect();};
      partial(t,start/2,.012,.12,'triangle');});
  }

 function destroy(){if(dead)return;dead=true;enabled=false;generation++;silence();if(ctx&&ctx.state!=='closed')Promise.resolve(ctx.close()).catch(()=>{});master?.disconnect();}
 return{enable,tap,glow,coin,laser,destroy,snapshot:()=>({enabled,dead,contexts:ctx?1:0,nodes:nodes.size,stats:{...stats}})};
}
return{create};
});
