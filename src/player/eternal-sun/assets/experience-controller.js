/* One audio owner: stable Player native streaming, then verified precise decoded transport on explicit seek. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./demo-stream.js'):root.ArtDemoStream);if(typeof module==='object'&&module.exports)module.exports=api;else root.AEExperienceController=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Transport){
'use strict';
function create({media,duration,onState=()=>{},precise=null}){
 let visible=true,destroyed=false,wanted=false,generation=0,reason='',mode='native',position=0,ready=false,retired=false,task=null;
 let phase='idle',error='',last={phase:'idle',playing:false,time:0,duration,buffering:false,seeking:false,error:'',interrupted:false};
 const length=()=>ready?precise.duration():duration;
 const bound=t=>Math.min(length(),Math.max(0,Number(t)||0));
 function snapshot(){
  if(mode==='native')return{...last,time:transport?transport.currentTime():last.time,sound:wanted,busy:wanted&&['starting','buffering','seeking'].includes(last.phase),visible,reason,phase:destroyed?'destroyed':last.phase,mode};
  let changed=false;
  if(ready&&phase==='playing'){
   position=bound(precise.currentTime());
   if(position>=length()){precise.pause();phase='ended';wanted=false;changed=true;}
   else if(!precise.isRunning()){precise.pause();phase='paused';wanted=false;reason='interrupted';changed=true;}
  }
  const state={phase:destroyed?'destroyed':phase,playing:!destroyed&&wanted&&phase==='playing',time:position,duration:length(),buffering:false,seeking:phase==='preparing',error,interrupted:reason==='interrupted',sound:wanted,busy:wanted&&['preparing','starting'].includes(phase),visible,reason,mode};if(changed)onState(state);return state;
 }
 const emit=()=>onState(snapshot());
 let transport=null;
 transport=Transport.create({media,duration,onState:s=>{last=s;if(mode!=='native')return;if(['error','ended','destroyed','paused'].includes(s.phase))wanted=false;if(s.interrupted)reason='interrupted';emit();}});
 function invalidate(){generation++;if(task){task.abort.abort();task.cancel(false);task=null;}}
 function pause(why='user'){
  invalidate();wanted=false;reason=why;
  if(mode==='native')transport.pause();else{if(ready&&phase==='playing')position=bound(precise.pause());else precise?.pause();phase='paused';}
  emit();return true;
 }
 async function sound(on){
  if(destroyed)return false;
  if(!on)return pause();
  if(!visible)return false;
  if(wanted)return !!snapshot().playing;
  if(mode==='native'){
   wanted=true;reason='user';const token=++generation;const ok=await transport.play();
   if(destroyed||token!==generation||!visible)return false;
   if(!ok)wanted=false;emit();return ok;
  }
  if(!precise){phase='error';error='Precise playback is not available';wanted=false;emit();return false;}
  invalidate();const token=generation,abort=new AbortController();let cancel;const cancellation=new Promise(r=>cancel=r);task={abort,cancel};
  wanted=true;reason='user';error='';phase=ready?'starting':'preparing';emit();
  const valid=()=>!destroyed&&token===generation&&!abort.signal.aborted&&visible&&wanted;
  // unlock() is deliberately invoked synchronously in the user gesture, before any fetch/decode await.
  let unlocked;try{unlocked=Promise.resolve(precise.unlock());}catch(e){unlocked=Promise.reject(e);}unlocked.catch(()=>{});
  const work=(async()=>{
   try{
    await Promise.all([unlocked,precise.prepare({signal:abort.signal})]);if(!valid())return false;
    ready=true;mode='precise';if(!retired){retired=true;transport.destroy();media.removeAttribute?.('src');media.load?.();}
    if(position>=length())position=0;
    phase='starting';emit();const ok=await precise.play(position);if(!valid())return false;
    if(ok===false||!precise.isRunning())throw Error('Audio playback did not start');phase='playing';emit();return true;
   }catch(e){if(!valid())return false;abort.abort();wanted=false;phase='error';error=e?.message||String(e);precise.pause();emit();return false;}
   finally{if(token===generation)task=null;}
  })();
  return Promise.race([work,cancellation]);
 }
 function seek(time){
  if(destroyed)return position;const target=bound(time);pause('seek');
  if(!ready&&target===0&&!retired){mode='native';transport.seek(0);position=0;}else{mode=ready?'precise':'staged';position=target;phase='paused';error='';}
  emit();return target;
 }
 function setVisible(value){if(destroyed)return;visible=!!value;if(!visible)pause('hidden');else emit();}
 function destroy(){if(destroyed)return;pause('destroyed');destroyed=true;wanted=false;transport.destroy();precise?.destroy();media.removeAttribute?.('src');media.load?.();emit();}
 return{sound,seek,setVisible,snapshot,destroy};
}
return{create};
});
