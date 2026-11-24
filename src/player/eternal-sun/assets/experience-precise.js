/* Stable1.1.2 decoded scheduling path, scoped to one verified bundled track. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.AEExperiencePrecise=api;})(typeof globalThis!=='undefined'?globalThis:this,function(scope){
'use strict';
const MANIFEST={sha256:'4ccff4a083e20672037be9597adb39505db4f4bed00f34ee9cb0537dbe256936',analysis:{duration:181.626009,sampleRate:44100}};
const MEMORY=80*1024*1024;
function create({url,volume=.55,muted=false,AudioContext=scope.AudioContext||scope.webkitAudioContext,fetch:fetcher=scope.fetch?.bind(scope),Source=scope.AEDemoSource,Model=scope.ArtMusicModel,Transport=scope.ArtMusicTransport}={}){
 let context=null,transport=null,inflight=null,dead=false,actualDuration=MANIFEST.analysis.duration,activeAbort=null;
 function check(signal){if(dead||signal?.aborted)throw Object.assign(Error('已取消音樂準備'),{name:'AbortError'});}
 function unlock(){check();if(!context){if(!AudioContext)throw Error('此瀏覽器不支援精準跳播。');scope.ArtAudioOutput?.configure(scope.navigator);context=new AudioContext({sampleRate:44100});}return context.resume();}
 async function prepare({signal}={}){
  check(signal);if(transport)return;
  if(inflight){try{await inflight;}catch{}check(signal);return prepare({signal});}
  if(!context)throw Error('請先按播放準備音訊。');
  const abort=new AbortController(),onAbort=()=>abort.abort();activeAbort=abort;signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)abort.abort();
  const job=(async()=>{check(abort.signal);const response=await fetcher(url,{signal:abort.signal});check(abort.signal);if(!response.ok)throw Error('完整音樂下載失敗，請重試。');const {file,verified}=await Source.verify(await response.blob(),MANIFEST,abort.signal);check(abort.signal);const buffer=await Source.decode(file,verified,context,{signal:abort.signal,memoryBytes:0,memoryBudgetBytes:MEMORY});check(abort.signal);
   actualDuration=buffer.length/buffer.sampleRate;
   const model=Model.buildMusic([{id:'eternal',assetId:'a',trimIn:0,trimOut:actualDuration}],{a:{duration:actualDuration}});
   const candidate=Transport.create({context,memoryBudgetBytes:MEMORY,maxClips:1});try{candidate.setProgram(model,{a:buffer});candidate.setVolume(volume);candidate.setMuted(muted);check(abort.signal);transport=candidate;}catch(e){candidate.destroy();throw e;}
  })();inflight=job;
  try{await job;}finally{signal?.removeEventListener('abort',onAbort);if(inflight===job)inflight=null;if(activeAbort===abort)activeAbort=null;}
 }
 function destroy(){if(dead)return;dead=true;activeAbort?.abort();transport?.destroy();transport=null;if(context)Promise.resolve(context.close()).catch(()=>{});context=null;}
 return{unlock,prepare,play:t=>{check();if(!transport)throw Error('完整音樂尚未準備好。');return transport.play(t)},pause:()=>transport?.pause()||0,currentTime:()=>transport?.currentTime()||0,duration:()=>actualDuration,isRunning:()=>context?.state==='running',destroy};
}
return{create,MANIFEST,MEMORY};
});
