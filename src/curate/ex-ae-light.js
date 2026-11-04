// 「AE 光影首頁」版型：柔和光點 + 可開關的聲光 + 燈箱。不修改任何作品圖片。
(()=>{
  const cv=document.getElementById('exlLight'),au=document.getElementById('exlAudio'),btn=document.getElementById('exlSound');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let beat=0;
  if(cv&&cv.getContext){
    const g=cv.getContext('2d');let W,H,dpr,pts=[];
    const size=()=>{dpr=Math.min(2,devicePixelRatio||1);W=cv.clientWidth;H=cv.clientHeight;cv.width=W*dpr;cv.height=H*dpr;g.setTransform(dpr,0,0,dpr,0,0);pts=Array.from({length:Math.round(Math.min(46,W/22))},()=>({x:Math.random()*W,y:Math.random()*H,r:.6+Math.random()*1.8,v:.08+Math.random()*.25,h:[46,8,95,190,280][Math.random()*5|0]}))};
    size();addEventListener('resize',size);
    let t0=performance.now();
    const draw=t=>{g.clearRect(0,0,W,H);const k=(t-t0)/1000;
      if(au&&!au.paused){beat=Math.max(0,1-((au.currentTime*148/60)%1)*3)}else beat*=.9;
      for(const p of pts){p.y-=p.v*(1+beat*2);if(p.y<-6){p.y=H+6;p.x=Math.random()*W}
        const a=.25+.35*Math.sin(k*1.3+p.x)+beat*.4;g.beginPath();g.fillStyle=`hsla(${p.h},85%,75%,${Math.max(.05,Math.min(.9,a))})`;g.arc(p.x,p.y,p.r*(1+beat),0,7);g.fill()}
      if(beat>.05){const gr=g.createRadialGradient(W*.7,H*.25,0,W*.7,H*.25,Math.max(W,H)*.6);gr.addColorStop(0,`rgba(237,205,117,${beat*.12})`);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,W,H)}
      if(!document.hidden)requestAnimationFrame(draw)};
    if(!reduce)requestAnimationFrame(draw);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!reduce)requestAnimationFrame(draw)});
  }
  if(btn&&au){btn.addEventListener('click',()=>{if(au.paused){au.volume=.55;au.play().then(()=>btn.setAttribute('aria-pressed','true')).catch(()=>{})}else{au.pause();btn.setAttribute('aria-pressed','false')}})}
  const lb=document.getElementById('exlLb');if(!lb)return;
  const frames=[...document.querySelectorAll('[data-lb]')];let i=0;
  const show=n=>{i=(n+frames.length)%frames.length;const f=frames[i],im=f.querySelector('img');lb.querySelector('img').src=im.src;lb.querySelector('img').alt=im.alt;lb.querySelector('figcaption').textContent=im.alt;lb.hidden=false;document.body.style.overflow='hidden'};
  const close=()=>{lb.hidden=true;document.body.style.overflow=''};
  frames.forEach((f,n)=>f.addEventListener('click',()=>show(n)));
  lb.querySelector('.exl-lb-x').onclick=close;lb.querySelector('.exl-lb-p').onclick=()=>show(i-1);lb.querySelector('.exl-lb-n').onclick=()=>show(i+1);
  lb.addEventListener('click',e=>{if(e.target===lb)close()});
  addEventListener('keydown',e=>{if(lb.hidden)return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')show(i-1);if(e.key==='ArrowRight')show(i+1)});
})();
