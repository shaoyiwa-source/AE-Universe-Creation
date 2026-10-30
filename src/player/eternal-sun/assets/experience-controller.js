/* AE Eternal Experience: one music element, Player 1.1.2 transport, explicit lifecycle. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./demo-stream.js'):root.ArtDemoStream);if(typeof module==='object'&&module.exports)module.exports=api;else root.AEExperienceController=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Transport){
'use strict';
function create({media,duration,onState=()=>{}}){
 let visible=true,destroyed=false,wanted=false,generation=0,reason='',last={phase:'idle',playing:false,time:0,duration,buffering:false,seeking:false,error:'',interrupted:false};
 const snapshot=()=>({...last,time:transport?transport.currentTime():last.time,sound:wanted,busy:wanted&&['starting','buffering','seeking'].includes(last.phase),visible,reason,phase:destroyed?'destroyed':last.phase});
 const emit=()=>onState(snapshot());
 let transport=null;
 transport=Transport.create({media,duration,onState:s=>{last=s;if(['error','ended','destroyed'].includes(s.phase)||s.phase==='paused')wanted=false;if(s.interrupted)reason='interrupted';emit();}});
 async function sound(on){
  if(destroyed)return false;
  if(!on){generation++;wanted=false;reason='user';transport.pause();emit();return true;}
  if(!visible)return false;
  if(wanted)return !!last.playing;
  wanted=true;reason='user';const token=++generation;
  const ok=await transport.play();
  if(destroyed||token!==generation||!visible)return false;
  if(!ok)wanted=false;emit();return ok;
 }
 function setVisible(value){if(destroyed)return;visible=!!value;if(!visible){generation++;wanted=false;reason='hidden';transport.pause();}emit();}
 function destroy(){if(destroyed)return;destroyed=true;generation++;wanted=false;reason='destroyed';transport.destroy();media.removeAttribute?.('src');media.load?.();emit();}
 return{sound,setVisible,snapshot,destroy};
}
return{create};
});
