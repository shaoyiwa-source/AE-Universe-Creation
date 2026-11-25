/* A single gesture, not extra modes: tap / hold or horizontal drag / release. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AEExperienceGesture=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
function create({tap,begin,move,release,cancel:cancelFocus,later=setTimeout,cancelLater=clearTimeout}){let point=null,start=null,timer=null,active=false,dead=false;
 const clear=()=>{if(timer!==null)cancelLater(timer);timer=null;};
 function activate(){clear();if(!point||active||dead)return;active=true;begin(point);}
 function cancel(){clear();if(point||active)cancelFocus();point=start=null;active=false;}
 return{down(p){if(dead)return;cancel();point=start={...p};timer=later(activate,260);},move(p){if(dead||!point||p.id!==point.id)return;const dx=p.x-start.x,dy=p.y-start.y;if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)*1.1){cancel();return;}point={...p};if(!active&&Math.abs(dx)>=10)activate();if(active)move(point);},up(p){if(dead||!point||p.id!==point.id)return;clear();if(active)release(point);else if(Math.hypot(p.x-start.x,p.y-start.y)<=12)tap(p);point=start=null;active=false;},cancel,destroy(){cancel();dead=true;},snapshot:()=>({active,pending:!!point})};}
return{create};});
