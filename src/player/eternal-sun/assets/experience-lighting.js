/* Virtual RGB pigment response + rear ambient light. One caller-owned frame clock; no RAF/audio here.
   Inspired by owner's Fluorescent Night and Magic Space references; not a physical fluorescence model. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AEExperienceLighting=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const NAMES=['blue','green','red'],RGB={red:[255,47,72],green:[85,255,125],blue:[109,83,255]},PALETTE=[[239,177,57],[40,220,128],[48,130,255],[219,57,205]];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
function responsePixel(pixel,color){const[r,g,b]=pixel.map(v=>clamp(v,0,255));const fluorescent=Math.max(0,g-r*.45-b*.25);let out;if(color==='red')out=[r*.80+g*.15+36,g*.50+r*.16+20,b*.65+r*.18+32];else if(color==='green')out=[r*.48,g*.91+fluorescent*.22,b*.15];else out=[r*.13+b*.21,g*.11+fluorescent*1.15,b*.77+r*.21+fluorescent*.12];return out.map(v=>Math.round(clamp(v,0,255)));}
function createState({reduced=false}={}){
 let mode='home',enabled=true,manual=0,selected=false,manualPending=false,anchorRaw=0,raw=0,lastKey='',from='blue',current='blue',changed=0,lastPlaying=null,clock=0,wall=0,lastSelect=-Infinity,silentOrigin=null,rebase=false,lastMix=1,lastPaletteMix=1,paletteOffset=0;
 let oldPalette=0,palette=0,paletteChange=0,paletteReady=false;
 const blend=(a,b,m)=>a.map((v,i)=>Math.round(v*(1-m)+b[i]*m));
 return{mode(v){if(['home','rgb','backlight'].includes(v)){mode=v;enabled=true;}},enabled(v){enabled=!!v;},reduced(v){reduced=!!v;},reset(){rebase=true;},select(color,nowMs){if(Number.isFinite(nowMs))wall=nowMs/1000;const index=NAMES.indexOf(color);if(index<0||wall-lastSelect<1)return false;lastSelect=wall;manual=index;anchorRaw=raw;selected=true;manualPending=true;enabled=true;return true;},frame(playback,now,beat={}){
  wall=now/1000;if(silentOrigin===null)silentOrigin=now;
  clock=playback.playing?Number(playback.time)||0:wall;raw=playback.playing?(beat.count||0)/4:(now-silentOrigin)/3000;
  if(rebase||(lastPlaying!==null&&lastPlaying!==!!playback.playing)){selected=true;if(!manualPending)manual=NAMES.indexOf(current);anchorRaw=raw;changed=clock-lastMix*.6;paletteChange=clock-lastPaletteMix*.6;paletteOffset=palette-Math.floor(raw);rebase=false;}
  lastPlaying=!!playback.playing;manualPending=false;
  const group=Math.floor(selected?Math.max(0,raw-anchorRaw):raw),index=reduced?manual:(group+(selected?manual:0))%3,color=NAMES[index],key=mode+':'+color;
  if(key!==lastKey){from=lastKey?current:color;current=color;changed=clock;lastKey=key;}
  const mix=reduced||from===current?1:clamp((clock-changed)/.6),pulse=clamp(beat.pulse||0),nextPalette=reduced?manual%4:((Math.floor(raw)+paletteOffset)%4+4)%4;
  if(!paletteReady){oldPalette=palette=nextPalette;paletteReady=true;paletteChange=clock;}
  else if(nextPalette!==palette){oldPalette=palette;palette=nextPalette;paletteChange=clock;}
  const pm=reduced?1:clamp((clock-paletteChange)/.6),haloColors=[blend(PALETTE[oldPalette],PALETTE[palette],pm),blend(PALETTE[(oldPalette+1)%4],PALETTE[(palette+1)%4],pm)];
  lastMix=mix;lastPaletteMix=pm;
  return{mode,enabled,color,from,mix,opacity:enabled?((from==='red'?.50:.78)*(1-mix)+(current==='red'?.50:.78)*mix)+.02*pulse:0,colors:RGB[color],paletteIndex:palette,haloColors,pulse,reduced};
 }};
}
function create({root,art,ambience,haloA,haloB,motion,onState=()=>{}}){
 const state=createState({reduced:!!motion.matches}),doc=root.ownerDocument;let masks={},prepared='',dead=false,last='',lastHalo=-Infinity,frame=null;
 function prepare(){if(dead||!art.complete||!art.naturalWidth)return false;const key=art.getAttribute('src');if(prepared===key)return true;const w=Math.min(320,art.naturalWidth),h=Math.round(w*art.naturalHeight/art.naturalWidth),base=doc.createElement('canvas');base.width=w;base.height=h;const ctx=base.getContext?.('2d',{willReadFrequently:true});if(!ctx)return false;try{ctx.drawImage(art,0,0,w,h);const source=ctx.getImageData(0,0,w,h);const next={};for(const color of NAMES){const canvas=doc.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d'),pixels=c.createImageData(w,h);for(let i=0;i<source.data.length;i+=4){const response=responsePixel([source.data[i],source.data[i+1],source.data[i+2]],color);pixels.data[i]=response[0];pixels.data[i+1]=response[1];pixels.data[i+2]=response[2];pixels.data[i+3]=source.data[i+3];}c.putImageData(pixels,0,0);next[color]=canvas;}masks=next;prepared=key;return true;}catch{masks={};return false;}}
 function draw(ctx,{width,height,now,playback,beat,target,boost=0}){
  if(dead)return null;state.reduced(motion.matches);frame=state.frame(playback,now,beat);const f=frame,key=f.mode+':'+f.enabled+':'+f.color;if(key!==last){last=key;onState(f);}
  root.dataset.presentation=f.mode;root.dataset.illumination=f.enabled?f.color:'off';
  ambience.hidden=!f.enabled||f.mode!=='backlight';
  if(!ambience.hidden&&(now-lastHalo>=30||lastHalo===-Infinity)){
   lastHalo=now;const [p,q]=f.haloColors;const strength=f.reduced?.65:Math.min(.95,.65+f.pulse*.12+boost*.25);
   haloA.style.background=`radial-gradient(circle,rgba(${p.join(',')},${strength}) 0%,rgba(${p.join(',')},.30) 38%,rgba(${p.join(',')},0) 72%)`;
   haloB.style.background=`radial-gradient(circle,rgba(${q.join(',')},${strength}) 0%,rgba(${q.join(',')},.28) 38%,rgba(${q.join(',')},0) 72%)`;
   const dx=target?(target.x/width-.5)*18:0,dy=target?(target.y/height-.5)*12:0;haloA.style.marginLeft=dx+'%';haloB.style.marginTop=dy+'%';
  }
  if(!f.enabled||f.mode!=='rgb')return f;
  if(!prepared)prepare();
  ctx.save();ctx.globalCompositeOperation='source-over';if(masks[f.from]){ctx.globalAlpha=f.opacity*(1-f.mix);ctx.drawImage(masks[f.from],0,0,width,height);}if(masks[f.color]){ctx.globalAlpha=f.opacity*f.mix;ctx.drawImage(masks[f.color],0,0,width,height);}ctx.globalAlpha=1;
  const pos={red:.18,green:.5,blue:.82}[f.color],x=width*pos,tx=target?.x??width*.52,ty=target?.y??height*.522;const gradient=ctx.createLinearGradient(x,0,tx,ty);gradient.addColorStop(0,`rgba(${f.colors.join(',')},${.24+Math.min(1,boost)*.22})`);gradient.addColorStop(1,`rgba(${f.colors.join(',')},0)`);ctx.globalCompositeOperation='screen';ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(x-5,0);ctx.lineTo(x+5,0);ctx.lineTo(tx+width*.28,ty+height*.15);ctx.lineTo(tx-width*.28,ty+height*.15);ctx.closePath();ctx.fill();ctx.strokeStyle=`rgba(${f.colors.join(',')},.30)`;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(tx,ty);ctx.stroke();ctx.restore();return f;
 }
 return{prepare,draw,resetTiming:()=>state.reset(),setMode:v=>state.mode(v),select:v=>state.select(v,(doc.defaultView?.performance||globalThis.performance).now()),setEnabled:v=>state.enabled(v),needsAnimation:()=>!dead&&(!frame||frame.enabled)&&!motion.matches,current:()=>frame,destroy(){dead=true;masks={};prepared='';ambience.hidden=true;delete root.dataset.presentation;delete root.dataset.illumination;}};
}
return{create,createState,responsePixel,NAMES,RGB};
});
