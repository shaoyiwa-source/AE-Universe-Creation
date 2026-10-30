/* One scoped component for standalone and future homepage wrappers. No automatic mount. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.AEEternalExperience=api;})(typeof globalThis!=='undefined'?globalThis:this,function(scope){
'use strict';
const VERSION='0.1.0',instances=new WeakMap();let audible=null;
function mount(root,options={}){
 if(!root?.querySelector||!root?.appendChild)throw TypeError('Pass an empty element owned by the experience.');
 if(options.startTime!==undefined&&Number(options.startTime)!==0)throw RangeError('This preview supports startTime: 0 only; nonzero cue is deliberately disabled.');
 instances.get(root)?.destroy();
 const doc=root.ownerDocument,win=doc.defaultView||scope;
 const language=options.lang||doc.documentElement.lang||'zh-Hant',zh=language.startsWith('zh');
 const text=zh?{title:'盛明 · Eternal Sun',note:'輕觸畫作，讓光回應你',idle:'聲音尚未開啟',start:'輕觸開啟聲音',soundOn:'暫停聲音',soundOff:'開啟聲音',cancel:'取消載入',loading:'音樂載入中，再按聲音鍵可取消。',playing:'聲音已開啟 · 光隨音樂流動',paused:'聲音已暫停 · 光與觸碰仍可玩',hidden:'聲音已暫停，按聲音鍵繼續。',error:'音樂未能播放，按聲音鍵重試。',ended:'音樂已播畢，按聲音鍵重新欣賞。',effects:'特效',glow:'發亮光',coins:'金幣',laser:'雷射光',artfail:'畫作載入失敗，請重新整理。',reduce:'已減少動態。'}:{title:'Eternal Sun',note:'Touch the painting. Let the light answer.',idle:'Sound is off',start:'Tap to awaken sound',soundOn:'Pause sound',soundOff:'Turn sound on',cancel:'Cancel loading',loading:'Loading music. Tap the sound button to cancel.',playing:'Sound on · Light follows the music',paused:'Sound paused · Light and touch still respond',hidden:'Sound paused. Tap the sound button to resume.',error:'Music could not play. Tap the sound button to retry.',ended:'Music finished. Tap the sound button to replay.',effects:'Effects',glow:'Glow',coins:'Gold coins',laser:'Laser',artfail:'Artwork could not load. Please refresh.',reduce:'Reduced motion is on.'};
 const base=options.assetBase||'./assets/';
 root.classList.add('ae-eternal');root.dataset.aeVersion=VERSION;root.setAttribute('lang',language);
 root.innerHTML='<div class="ae-art"><img data-ae="art" class="ae-painting" alt="Eternal Sun · canonical web artwork" draggable="false"><canvas data-ae="canvas" aria-hidden="true"></canvas><div class="ae-dock"><button data-ae="sound" class="ae-round" type="button" aria-pressed="false"><span data-ae="sound-icon" aria-hidden="true">♫</span></button><button data-ae="fx-toggle" class="ae-round" type="button" aria-expanded="false">✦</button></div><div data-ae="tray" class="ae-tray" hidden><button type="button" data-fx="glow"><span aria-hidden="true">☀</span><span data-label="glow"></span></button><button type="button" data-fx="coins"><span aria-hidden="true">◉</span><span data-label="coins"></span></button><button type="button" data-fx="laser"><span aria-hidden="true">ϟ</span><span data-label="laser"></span></button></div><button data-ae="start" class="ae-start" type="button"></button></div><div class="ae-caption"><h1 data-ae="title"></h1><p data-ae="note"></p><p data-ae="status" class="ae-status" role="status" aria-live="polite"></p></div>';
 const $=n=>root.querySelector('[data-ae="'+n+'"]');
 const art=$('art'),canvas=$('canvas'),button=$('sound'),start=$('start'),tray=$('tray'),fxButton=$('fx-toggle'),status=$('status');
 $('title').textContent=text.title;$('note').textContent=text.note;start.textContent=text.start;fxButton.setAttribute('aria-label',text.effects);tray.setAttribute('aria-label',text.effects);
 for(const id of ['glow','coins','laser'])root.querySelector('[data-label="'+id+'"]').textContent=text[id];
 const media=doc.createElement('audio');media.preload='metadata';media.loop=false;media.volume=.55;media.setAttribute('playsinline','');media.setAttribute('data-ae','audio');media.hidden=true;media.src=options.audioUrl||base+'ae-eternal-stream.m4a';root.appendChild(media);
 const motion=win.matchMedia('(prefers-reduced-motion: reduce)'),listeners=[],observers=[];
 let dead=false,renderer=null,controller=null,chime=null,everPlayed=false,visible=!doc.hidden,intersecting=true,lastSound=false,artFailed=false;
 const on=(el,type,fn,opts)=>{el.addEventListener(type,fn,opts);listeners.push(()=>el.removeEventListener(type,fn,opts));};
 const deps=options.dependencies||{Controller:scope.AEExperienceController,Renderer:scope.AEExperienceRenderer,Chime:scope.AEExperienceChime,energy:scope.aeHomeAudioEnergy,timeline:scope.aeHomeBeatTimeline};
 function render(s){
  if(dead)return;
  root.dataset.soundState=s.busy?'loading':s.playing?'on':'off';root.dataset.phase=s.phase;
  const label=s.busy?text.cancel:s.sound?text.soundOn:text.soundOff;button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(s.sound));button.setAttribute('aria-busy',String(s.busy));$('sound-icon').textContent=s.busy?'×':s.sound?'♫':'♪';
  if(s.playing)everPlayed=true;start.hidden=everPlayed||s.sound;start.textContent=s.phase==='error'?text.error:text.start;
  const message=artFailed?text.artfail:s.phase==='error'?text.error:s.busy?text.loading:s.playing?text.playing:s.phase==='ended'?text.ended:s.reason==='hidden'||s.interrupted?text.hidden:everPlayed?text.paused:text.idle;
  const statusText=message+(motion.matches?' '+text.reduce:'');if(status.textContent!==statusText)status.textContent=statusText;
  if(!s.sound&&lastSound)chime?.enable(false);lastSound=s.sound;renderer?.refresh();
 }
 controller=deps.Controller.create({media,duration:181.626009,onState:render});
 chime=deps.Chime.create({AudioContext:win.AudioContext||win.webkitAudioContext});
 renderer=deps.Renderer.create({canvas,host:root,timeline:deps.timeline,energy:deps.energy,readPlayback:()=>controller.snapshot(),chime,motion});
 const instance={version:VERSION,snapshot:()=>({version:VERSION,...controller.snapshot(),art:{loaded:art.complete&&art.naturalWidth>0,source:art.getAttribute('src'),kind:'canonical-web'},renderer:renderer.snapshot(),chime:chime.snapshot()}),sound:async on=>{
  if(dead)return false;
  if(on){if(!visible||!intersecting)return false;if(audible&&audible!==instance)audible.sound(false);audible=instance;chime.enable(true);}else{chime.enable(false);if(audible===instance)audible=null;}
  const ok=await controller.sound(!!on);if(!controller.snapshot().sound)chime.enable(false);return ok;
 },effect:id=>!dead&&renderer.effect(id),destroy(){
  if(dead)return;dead=true;if(audible===instance)audible=null;for(const off of listeners)off();for(const observer of observers)observer.disconnect();renderer.destroy();chime.destroy();controller.destroy();root.replaceChildren();root.classList.remove('ae-eternal');delete root.dataset.aeVersion;delete root.dataset.soundState;delete root.dataset.phase;instances.delete(root);
 }};
 function toggleSound(){instance.sound(!controller.snapshot().sound);}
 function closeTray(){tray.hidden=true;fxButton.setAttribute('aria-expanded','false');}
 on(button,'click',toggleSound);on(start,'click',()=>instance.sound(true));
 on(fxButton,'click',()=>{tray.hidden=!tray.hidden;fxButton.setAttribute('aria-expanded',String(!tray.hidden));});
 for(const id of ['glow','coins','laser'])on(root.querySelector('[data-fx="'+id+'"]'),'click',()=>instance.effect(id));
 on(root,'keydown',e=>{if(e.key==='Escape'&&!tray.hidden){closeTray();fxButton.focus();}});
 on(doc,'pointerdown',e=>{if(!root.contains(e.target))closeTray();},{passive:true});
 let pointer=null;
 const screen=root.querySelector('.ae-art');
 on(screen,'pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};},{passive:true});
 on(screen,'pointercancel',()=>{pointer=null;},{passive:true});
 on(screen,'pointerup',e=>{const p=pointer;pointer=null;if(!p||p.id!==e.pointerId||Math.hypot(e.clientX-p.x,e.clientY-p.y)>12||e.target.closest('button'))return;const r=canvas.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;closeTray();renderer.tap(e.clientX-r.left,e.clientY-r.top);},{passive:true});
 function updateVisibility(){visible=!doc.hidden;const showing=visible&&intersecting;controller.setVisible(showing);renderer.setVisible(showing);if(!showing){pointer=null;chime.enable(false);}}
 on(doc,'visibilitychange',updateVisibility);on(win,'pagehide',()=>{visible=false;controller.setVisible(false);renderer.setVisible(false);chime.enable(false);});on(win,'pageshow',updateVisibility);
 on(motion,'change',()=>{renderer.refresh();render(controller.snapshot());});
 if(win.ResizeObserver){const ro=new win.ResizeObserver(()=>renderer.resize());ro.observe(screen);observers.push(ro);}else on(win,'resize',()=>renderer.resize());
 if(win.IntersectionObserver){const io=new win.IntersectionObserver(entries=>{intersecting=entries.some(e=>e.isIntersecting);updateVisibility();},{threshold:.03});io.observe(root);observers.push(io);}
 on(art,'load',()=>{artFailed=false;renderer.resize();render(controller.snapshot());});on(art,'error',()=>{artFailed=true;render(controller.snapshot());});
 art.src=options.artworkUrl||base+'eternal-sun.jpg';instances.set(root,instance);updateVisibility();render(controller.snapshot());return instance;
}
return{version:VERSION,mount};
});
