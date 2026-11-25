(()=>{
  'use strict';
  if(window.__aeMagicLayerLoaded)return;
  window.__aeMagicLayerLoaded=true;
  const mark=document.querySelector('.brand-mark');
  if(!mark)return;

  const wash=document.createElement('div'); wash.id='ae-magic-wash'; wash.setAttribute('aria-hidden','true');
  const hint=document.createElement('div'); hint.id='ae-magic-hint'; hint.setAttribute('aria-live','polite');
  const reveal=document.createElement('div'); reveal.id='ae-magic-reveal'; reveal.setAttribute('aria-live','polite');
  const floor=document.createElement('div'); floor.id='ae-magic-floor'; floor.setAttribute('aria-label','AE Magic stars');

  const stars=[];
  for(let i=0;i<5;i++){
    const b=document.createElement('button');
    b.className='ae-magic-star'; b.type='button'; b.textContent='★';
    b.setAttribute('aria-label','Magic star '+(i+1));
    floor.appendChild(b); stars.push(b);
  }
  const counter=document.createElement('div');
  counter.id='ae-magic-coin-count'; counter.setAttribute('aria-live','polite'); counter.setAttribute('aria-label','Magic coins');
  counter.innerHTML='🪙 <span>0</span>'; floor.appendChild(counter);
  document.body.append(wash,hint,reveal,floor);

  const countEl=counter.querySelector('span');
  const found=new Set();
  let coins=0,audio=null;
  const isZh=()=>document.documentElement.lang==='zh-Hant';

  function ensureAudio(){
    try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume()}catch(_){}
  }
  function chime(freq=880,dur=.34){
    ensureAudio(); if(!audio)return;
    const now=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();
    o.type='sine';o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(freq*1.4,now+dur);
    g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.07,now+.018);g.gain.exponentialRampToValueAtTime(.0001,now+dur);
    o.connect(g);g.connect(audio.destination);o.start(now);o.stop(now+dur+.03);
  }
  function sparkle(x,y,n=9){
    for(let i=0;i<n;i++){
      const s=document.createElement('i');s.className='ae-magic-spark';
      const a=Math.PI*2*i/n+Math.random()*.3,r=18+Math.random()*34;
      s.style.left=x+'px';s.style.top=y+'px';s.style.setProperty('--sx',Math.cos(a)*r+'px');s.style.setProperty('--sy',Math.sin(a)*r+'px');
      document.body.appendChild(s);setTimeout(()=>s.remove(),820);
    }
  }
  function coinBurst(rect,n=5){
    for(let i=0;i<n;i++){
      const c=document.createElement('i');c.className='ae-magic-coin';c.textContent='✦';
      c.style.left=(rect.left+rect.width/2+(Math.random()-.5)*18)+'px';c.style.top=(rect.top+rect.height/2)+'px';
      c.style.setProperty('--dx',((Math.random()-.5)*90)+'px');c.style.setProperty('--rot',((Math.random()-.5)*720)+'deg');
      document.body.appendChild(c);setTimeout(()=>c.remove(),1150);
    }
  }
  function setHint(){hint.textContent=isZh()?'AE MAGIC · 點一顆星':'AE MAGIC · touch a star'}
  function toggleMagic(){
    document.body.classList.toggle('ae-magic-on');
    if(document.body.classList.contains('ae-magic-on')){
      setHint();chime(740,.3);const r=mark.getBoundingClientRect();sparkle(r.left+r.width/2,r.top+r.height/2,12);
    }
  }

  mark.dataset.aeMagicReady='1'; mark.setAttribute('role','button'); mark.setAttribute('tabindex','0'); mark.setAttribute('aria-label','AE Magic');
  mark.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();toggleMagic();});
  mark.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleMagic();}});

  stars.forEach((star,i)=>star.addEventListener('click',()=>{
    const rect=star.getBoundingClientRect(),fresh=!found.has(i);
    found.add(i);coins+=fresh?3:1;countEl.textContent=String(coins);
    star.classList.remove('ae-found');void star.offsetWidth;star.classList.add('ae-found');
    sparkle(rect.left+rect.width/2,rect.top+rect.height/2);coinBurst(rect,fresh?6:4);chime([660,740,830,990,1110][i],.32);
    if(found.size===5){
      reveal.textContent=isZh()?'你找到了一個小宇宙 ✦':'You found a little universe ✦';
      reveal.classList.add('show');chime(1320,.52);setTimeout(()=>reveal.classList.remove('show'),3000);
    }
  }));

  document.addEventListener('click',e=>{if(e.target.closest('[data-language]'))setTimeout(setHint,0)});
})();
