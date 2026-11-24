/* Bundled native-media transport. Local editable queues retain their decoded transport. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArtDemoStream=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function create({media,duration,onState=()=>{}}){
 if(!media||typeof media.play!=='function')throw Error('需要可播放的音訊元素');
 const length=Number(duration);if(!Number.isFinite(length)||length<=0)throw Error('示範音樂長度無效');
 let phase='idle',wanted=false,generation=0,cancelPending=null,error='',buffering=false,seeking=false,disposed=false,interrupted=false;
 const bound=value=>Math.min(length,Math.max(0,Number(value)||0));
 const currentTime=()=>bound(media.currentTime);
 const getState=()=>({phase,playing:!disposed&&wanted&&phase==='playing'&&!media.paused&&!media.ended&&!media.seeking&&!seeking&&!buffering&&media.readyState>=2,buffering,seeking:seeking||!!media.seeking,time:currentTime(),duration:length,error,interrupted});
 const notify=()=>onState(getState());
 function invalidate(){generation++;if(cancelPending){const cancel=cancelPending;cancelPending=null;cancel(false);}}
 function fail(cause){wanted=false;phase='error';error=cause?.message||String(cause||'音樂無法播放');buffering=false;seeking=false;invalidate();media.pause();notify();}
 const handlers={
  playing(){if(disposed||!wanted){media.pause();return;}buffering=false;seeking=!!media.seeking;phase='playing';notify();},
  waiting(){if(!wanted||disposed)return;buffering=true;phase='buffering';notify();},
  seeking(){if(disposed)return;seeking=true;if(wanted)phase='seeking';notify();},
  seeked(){if(disposed)return;seeking=false;if(wanted&&!media.paused&&media.readyState>=2&&!buffering)phase='playing';notify();},
  pause(){if(disposed||!media.paused)return;if(media.ended){handlers.ended();return;}if(!['error','ended'].includes(phase)){interrupted=wanted;wanted=false;phase='paused';buffering=false;invalidate();}notify();},
  ended(){if(disposed||!media.ended)return;wanted=false;interrupted=false;phase='ended';buffering=false;seeking=false;invalidate();notify();},
  error(){if(!disposed&&media.error)fail(Error('音訊載入失敗（代碼 '+(media.error?.code||0)+'）'));}
 };
 for(const [name,handler] of Object.entries(handlers))media.addEventListener(name,handler);
 function play(time=currentTime()){
  if(disposed)return Promise.resolve(false);
  invalidate();const token=generation;wanted=true;interrupted=false;error='';buffering=false;seeking=false;phase='starting';
  const target=bound(time)>=length?0:bound(time);
  let started;
  const cancelled=new Promise(resolve=>{cancelPending=resolve;});
  try{const recovering=!!media.error;if(recovering&&typeof media.load==='function')media.load();if(recovering||media.ended||Math.abs(currentTime()-target)>.05)media.currentTime=target;started=media.play();}
  catch(cause){fail(cause);return Promise.resolve(false);}
  notify();
  return Promise.race([Promise.resolve(started).then(()=>{
   if(disposed||token!==generation||!wanted)return false;
   if(!media.paused&&!buffering&&!media.seeking){phase='playing';seeking=false;}notify();return true;
  }).catch(cause=>{if(!disposed&&token===generation)fail(cause);return false;}),cancelled]).finally(()=>{if(token===generation)cancelPending=null;});
 }
 function pause(){if(disposed)return currentTime();wanted=false;interrupted=false;phase='paused';buffering=false;seeking=false;invalidate();media.pause();notify();return currentTime();}
 function seek(time){if(disposed)return currentTime();const target=bound(time);try{media.currentTime=target;}catch(cause){fail(cause);}notify();return currentTime();}
 function stop(){pause();return seek(0);}
 function destroy(){if(disposed)return;pause();disposed=true;phase='destroyed';for(const [name,handler] of Object.entries(handlers))media.removeEventListener(name,handler);notify();}
 return {play,pause,stop,seek,currentTime,getState,setVolume(value){media.volume=Math.min(1,Math.max(0,Number(value)||0));},setMuted(value){media.muted=!!value;},destroy};
}
return {create};
});
