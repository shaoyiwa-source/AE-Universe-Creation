/* AE home/professional beam + gold-pool presentation.
 * Adapted from the verified homepage ae-home-light.js; no dark wash or artwork redraw.
 * Pure caller-owned draw clock. No audio, DOM, RAF, timer, fetch or event listener. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AEExperienceHomeVisual=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const COLORS=['#ff416d','#57ffa0','#ffe28d','#65dbff','#c987ff','#ffac68'];
const variation=seed=>{const n=Math.sin(seed*12.9898+78.233)*43758.5453;return n-Math.floor(n);};
function create(){let dead=false;return{reset(){},destroy(){dead=true;},draw(ctx,f){
 if(dead)return{beams:0,pools:0};
 const{width,height,sunX=width*.52,sunY=height*.522,nowMs,musicTime,playing,energy=0,focus,reduced,lite,bare}=f;
 const beat=f.beat||{},pulse=reduced?0:Math.min(1,beat.pulse||0),drop=playing&&!reduced?Math.min(1,(beat.dropPulse||0)*1.8):0,build=!reduced&&beat.stage==='build',sweep=reduced?0:playing?(beat.sweep||musicTime||0):nowMs/6000;
 const count=build?(beat.buildProgress>.7?5:3):6,group=reduced?0:Math.floor((beat.count||0)/4),pattern=Math.floor(variation(group+3)*3),targets=[];
 ctx.save();ctx.globalCompositeOperation='screen';
 const glow=ctx.createRadialGradient(sunX,sunY,3,sunX,sunY,Math.min(width*.42,190));
 glow.addColorStop(0,`rgba(255,223,115,${Math.min(.6,.035+energy*.16+pulse*.35)})`);glow.addColorStop(.45,`rgba(243,178,48,${.02+energy*.08+pulse*.18})`);glow.addColorStop(1,'rgba(240,170,45,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
 for(let i=0;i<count;i++){
  const angle=i*Math.PI/3+sweep*.24+variation(group+1)*1.7,effectBottom=height*.67;
  const ambient={x:width*(.16+.68*(.5+.5*Math.sin(angle))),y:Math.max(30,effectBottom*(.20+.60*(.5+.5*Math.cos(angle*1.3))))};
  const weight=focus?Math.max(0,Math.min(1,focus.weight??1)):0;
  const x=(ambient.x*(1-weight)+(focus?.x||0)*weight)*(1-drop)+sunX*drop,y=(ambient.y*(1-weight)+(focus?.y||0)*weight)*(1-drop)+sunY*drop;
  targets.push({x:Math.round(x),y:Math.round(y)});
  const ox=i%3===0?-width*.08:i%3===1?width*1.08:width*(.15+i*.12),oy=i%3===2?-20:effectBottom*(.15+(i%4)*.20);
  const power=reduced?.22:Math.min(1,(playing?(build?.08+(beat.buildProgress||0)*.06:.13):.32)+energy*.035+pulse*.85+(beat.dropPulse||0)*.12+(focus?.held?.14:0));
  if(!reduced){
   ctx.shadowColor=COLORS[i];ctx.shadowBlur=lite?0:14+pulse*25;ctx.strokeStyle=COLORS[i];ctx.globalAlpha=power;ctx.lineWidth=1+pulse*2.2;
   ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(x,y);ctx.stroke();
   ctx.shadowBlur=lite?0:4;ctx.strokeStyle='#fff9df';ctx.lineWidth=.7;ctx.globalAlpha=power*.8;ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(x,y);ctx.stroke();
   if(!lite)for(let j=-1;j<=1;j++){
    const a=Math.atan2(y-oy,x-ox)+j*(pattern===0?.12:pattern===1?.34:.52)+Math.sin(sweep)*.18,reach=Math.min(width*.278,150)*(1+pulse*.22),ex=x+Math.cos(a)*reach,ey=y+Math.sin(a)*reach;
    const trail=ctx.createLinearGradient(x,y,ex,ey);trail.addColorStop(0,COLORS[(i+j+6)%6]);trail.addColorStop(1,'rgba(255,255,255,0)');ctx.strokeStyle=trail;ctx.globalAlpha=power*.72;ctx.lineWidth=.8+pulse;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();
   }
  }
  ctx.globalAlpha=1;ctx.shadowBlur=0;
  // Keep the gold core even in the cheapest fallback; never turn the whole show invisible.
  const radius=(bare?22:38)+pulse*(bare?22:48),pool=ctx.createRadialGradient(x,y,1,x,y,radius);
  pool.addColorStop(0,`rgba(255,241,166,${Math.min(.9,power*.78)})`);pool.addColorStop(.22,`rgba(255,194,64,${power*.35})`);pool.addColorStop(1,'rgba(255,194,64,0)');ctx.fillStyle=pool;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  ctx.fillStyle=`rgba(255,226,135,${Math.min(.9,power*.8)})`;ctx.beginPath();ctx.arc(x,y,2+pulse*5,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=COLORS[i];ctx.lineWidth=.8;ctx.globalAlpha=reduced?.15:.10+pulse*.6;ctx.beginPath();ctx.arc(x,y,8+(reduced?0:(beat.phase||0)*28),0,Math.PI*2);ctx.stroke();
 }
 ctx.restore();return{beams:reduced?0:count,pools:count,targets};
}};}
return{create};
});
