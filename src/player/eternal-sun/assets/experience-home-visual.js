/* AE home beam + colour-pool presentation · Light Player 0.4.1.
 * A line-for-line port of the official homepage ae-home-light.js beam pass (src/ae-home-light.js
 * lines 154-193): hairline beams with a soft halo and a pale core, prismatic rays, colour pools,
 * beat rings and the beat-driven sun glow. Same 6 colours, same 'screen' blend, same power curve
 * (.07 between beats, a flash on each kick), same targets. Two deliberate differences only:
 *  - no bottom dark shade (the player never darkens the painting);
 *  - a held finger adds +.14 power so the gathered beams are readable (player interaction).
 * Pure caller-owned draw clock. No audio, DOM, RAF, timer, fetch or event listener. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AEExperienceHomeVisual=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const COLORS=['#ff416d','#57ffa0','#ffe28d','#65dbff','#c987ff','#ffac68'];
const variation=seed=>{const n=Math.sin(seed*12.9898+78.233)*43758.5453;return n-Math.floor(n);};
const hex=a=>Math.round(Math.max(0,Math.min(255,a))).toString(16).padStart(2,'0');
// Exactly the homepage destination(): ambient path per 4-beat group, eased toward a finger, pulled to the sun on the drop.
function destination(i,phase,f){
 const{artX0=0,artW,artBottom,sunX,sunY,playing,beat={},focus,reduced}=f;
 const group=reduced?0:Math.floor((beat.count||0)/4),angle=i*Math.PI/3+phase*.24+variation(group+1)*1.7;
 const ambient={x:artX0+artW*(.16+.68*(.5+.5*Math.sin(angle))),y:Math.max(30,artBottom*(.20+.60*(.5+.5*Math.cos(angle*1.3))))};
 const weight=focus?Math.max(0,Math.min(1,focus.weight??1)):0;
 const target={x:ambient.x*(1-weight)+(focus?.x||0)*weight,y:ambient.y*(1-weight)+(focus?.y||0)*weight};
 const impact=playing&&!reduced?Math.min(1,(beat.dropPulse||0)*1.8):0;
 return{x:target.x*(1-impact)+sunX*impact,y:target.y*(1-impact)+Math.max(30,sunY)*impact};
}
function create(){let dead=false;return{reset(){},destroy(){dead=true;},destination,draw(ctx,f){
 if(dead)return{beams:0,pools:0};
 const{width,height,artX0=0,artW=width,artBottom=height,sunX=width*.52,sunY=height*.522,playing,energy=0,focus,reduced,lite,bare}=f;
 const beat=reduced?{count:0,phase:0,pulse:0,dropPulse:0,stage:'groove'}:(f.beat||{});
 const pulse=playing?Math.min(1,beat.pulse||0):0,phase=playing?(beat.phase||0):0,drop=playing?(beat.dropPulse||0):0,build=playing&&beat.stage==='build',bp=beat.buildProgress||0;
 // Homepage: between plays the beams freeze where the last beat left them (count+phase).
 const sweep=playing?(beat.sweep||0):(beat.count||0)+(beat.phase||0);
 const count=build?(bp>.7?5:3):6,group=Math.floor((beat.count||0)/4),pattern=Math.floor(variation(group+3)*3),targets=[];
 const g={...f,beat};
 ctx.save();
 // Sun glow: invisible until the music pushes it (homepage values, source-over like the homepage).
 const glowA=energy*.16+pulse*.35;
 if(glowA>.004){const glow=ctx.createRadialGradient(sunX,sunY,3,sunX,sunY,Math.min(artW*.42,190));
  glow.addColorStop(0,`rgba(255,223,115,${glowA})`);glow.addColorStop(.45,`rgba(243,178,48,${energy*.08+pulse*.18})`);glow.addColorStop(1,'rgba(240,170,45,0)');
  ctx.fillStyle=glow;ctx.fillRect(artX0,0,artW,artBottom);}
 ctx.globalCompositeOperation='screen';
 for(let i=0;i<count;i++){
  const ox=i%3===0?artX0-artW*.08:i%3===1?artX0+artW*1.08:artX0+artW*(.15+i*.12),oy=i%3===2?-20:artBottom*(.15+(i%4)*.20);
  const t=destination(i,sweep,g),x=t.x,y=t.y;targets.push({x:Math.round(x),y:Math.round(y)});
  const power=reduced?.16:Math.min(1,(build?.06+bp*.06:.07)+energy*.035+pulse*.85+drop*.12+(focus?.held?.14:0));
  if(!reduced){
   // The homepage paints these strokes with 'screen' over a painting its hero gradient has dimmed.
   // The player never dims the painting, and 'screen' on bright pink paint vanishes, so the same
   // strokes are laid as a plain overlay (source-over): same width, alpha curve and halo.
   ctx.globalCompositeOperation='source-over';
   ctx.shadowColor=COLORS[i];ctx.shadowBlur=lite?0:14+pulse*25;ctx.strokeStyle=COLORS[i];ctx.globalAlpha=power;ctx.lineWidth=.8+pulse*2.2;
   ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(x,y);ctx.stroke();
   ctx.shadowBlur=lite?0:4;ctx.strokeStyle='#fff9df';ctx.lineWidth=.65;ctx.globalAlpha=power*.72;
   ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(x,y);ctx.stroke();
   if(!lite)for(let j=-1;j<=1;j++){
    const a=Math.atan2(y-oy,x-ox)+j*(pattern===0?.12:pattern===1?.34:.52)+Math.sin(sweep)*.18,reach=Math.min(artW*.24,150)*(1+pulse*.22),ex=x+Math.cos(a)*reach,ey=y+Math.sin(a)*reach;
    const trail=ctx.createLinearGradient(x,y,ex,ey);trail.addColorStop(0,COLORS[(i+j+6)%6]);trail.addColorStop(1,'rgba(255,255,255,0)');
    ctx.strokeStyle=trail;ctx.globalAlpha=power*.72;ctx.lineWidth=.8+pulse;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();
   }
  }
  ctx.globalAlpha=1;ctx.shadowBlur=0;
  // Pools too: on the undimmed painting a 'screen' pool is invisible; the homepage's lit dot reads as a soft overlay.
  if(!bare){const pool=ctx.createRadialGradient(x,y,1,x,y,38+pulse*48);
   pool.addColorStop(0,`rgba(255,249,218,${power*.60})`);pool.addColorStop(.18,COLORS[i]+hex(power*75));pool.addColorStop(1,COLORS[i]+'00');
   ctx.fillStyle=pool;ctx.fillRect(x-90,y-90,180,180);}
  if(pulse>.01){ctx.strokeStyle=COLORS[i];ctx.lineWidth=.7;ctx.globalAlpha=pulse*.6;ctx.beginPath();ctx.arc(x,y,Math.max(0,8+phase*28),0,Math.PI*2);ctx.stroke();}
 }
 ctx.restore();return{beams:reduced?0:count,pools:bare?0:count,targets};
}};}
return{create,destination,COLORS};
});
