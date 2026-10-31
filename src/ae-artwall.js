/* 藝術電視牆 Art TV Wall — paged, iPhone-Photos-style hairline grid (site v2476.55). Serves /works (and /art-wall).
   v2476.55: walls are built from a data-driven group list (groups-v2476.55.json). Each group has one tile ratio and an
   optional size label; a wall never mixes groups. Images are always shown whole (object-fit:contain), never cropped.
   Selected Works come from a static, locked list in the CURRENT Production order (same names/credits as Production /works).
   Owner-added works come from /api/artwall (server-side Blob). Visitors are read-only.
   Each wall (page) holds at most cols×rows works; walls are paged. Nothing on this page writes anything except the Owner editor. */
(()=>{'use strict';
// ---- Wall size config (edit here). Desktop picks the first rule whose min width fits; phones use a fixed page size.
const WALL={
  desktop:[{min:1200,cols:9},{min:900,cols:8}],
  phone:{dense:4,large:3},                     // phone: 4 cols (or 3 large); the works on each wall are the same on every device
  perPageMax:81,                               // default cap (9×9); groups JSON may override, never above 100 (10×10)
  demoMax:1000
};
const GROUPS_URL='/assets/artwall/groups-v2476.55.json';           // data-driven groups (ratio + optional size label per wall)
const NEW_URL='/assets/artwall/works-new-v2476.55.json';           // works picked from Drive Artworks/RAW_333 (neutral labels, no story)
const WORKS_URL='/assets/artwall/works-v2476.47.json';             // Production order — do not reorder here
const PROPOSED_URL='/assets/artwall/order-proposed-v2476.45.json';  // GPT's proposed order, NOT applied; preview-only ?order=proposed
const API='/api/artwall';
const KEY='ae-artwall-owner-key';
const $=id=>document.getElementById(id);
const wall=$('awWall'),lb=$('awLb'),keyDlg=$('awKey'),pager=$('awPager');
const qs=new URLSearchParams(location.search);
// Dev-only switches work on localhost and per-deployment preview URLs only, never on the Production domain.
const devHost=/^(localhost|127\.0\.0\.1)$/.test(location.hostname)||/^ae-universe-creation-[a-z0-9]+-ae-universe-creation\.vercel\.app$/.test(location.hostname)||/-git-[a-z0-9-]+\.vercel\.app$/.test(location.hostname);
const demoN=devHost?Math.max(0,Math.min(WALL.demoMax,parseInt(qs.get('demo')||'0',10)||0)):0;
const proposed=devHost&&qs.get('order')==='proposed';
let wallOverride=null;{const m=/^(\d{1,2})x(\d{1,2})$/.exec(qs.get('wall')||'');if(m){const c=+m[1],r=+m[2];if(c>=3&&c<=12&&r>=1&&r<=12)wallOverride={cols:c,rows:r}}}
let originals=[],extra=[],groupsCfg=null,walls=[],added=[],all=[],cur=-1,owner=false,apiState={storage:'unknown',writable:false};
let page=Math.max(0,(parseInt(qs.get('page')||'1',10)||1)-1),layoutKey='';
const zh=()=>document.documentElement.lang==='zh-Hant';
const t=(en,zhs)=>zh()?zhs:en;
const getKey=()=>{try{return sessionStorage.getItem(KEY)||''}catch(e){return ''}};
const setKey=v=>{try{v?sessionStorage.setItem(KEY,v):sessionStorage.removeItem(KEY)}catch(e){}};
function titleOf(w){if(w.kind==='o'||w.kind==='d')return w.en?(zh()?(w.zh||w.en):w.en):(w.labelEn?(zh()?(w.labelZh||w.labelEn):w.labelEn):'');return (zh()?(w.title_zh||w.title_en):(w.title_en||w.title_zh))||''}
function creditOf(w){if(w.kind==='o'||w.kind==='d')return (zh()?w.creditZh:w.creditEn)||'AE Universe Creation';return t('New work · AE Universe Creation','新上架作品・AE Universe Creation')}
function introOf(w){if(w.kind==='o'||w.kind==='d')return (zh()?(w.storyZh||w.storyEn):(w.storyEn||w.storyZh))||'';return (zh()?(w.intro_zh||w.intro_en):(w.intro_en||w.intro_zh))||''}
function isPhone(){return window.innerWidth<900}
function layout(){
  if(isPhone()){const cols=wall.dataset.mode==='large'?WALL.phone.large:WALL.phone.dense;return {cols,key:'p'+cols}}
  if(wallOverride)return {cols:wallOverride.cols,key:'o'};
  const w=window.innerWidth;const r=WALL.desktop.find(x=>w>=x.min)||WALL.desktop[WALL.desktop.length-1];
  return {cols:r.cols,key:'d'+r.cols};
}
const perMax=()=>{if(wallOverride)return Math.min(100,wallOverride.cols*wallOverride.rows);const n=groupsCfg&&+groupsCfg.perPageMax;return Math.max(1,Math.min(100,n||WALL.perPageMax))};
const ratioCss=r=>{const m=/^\s*(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)\s*$/.exec(String(r||''));return m&&+m[1]>0&&+m[2]>0?m[1]+' / '+m[2]:'1 / 1'};
const pages=()=>Math.max(1,walls.length);
// Build the flat list in group order, then cut each group into walls of at most perMax() works (evenly split).
function build(){
  const by=new Map();originals.forEach((o,k)=>by.set(o.id,{...o,kind:'o',rank:k}));extra.forEach(o=>by.set(o.id,{...o,kind:'o',rank:1e6}));
  let groups=[];const used=new Set();
  if(demoN){const base=[...by.values()];const items=[];for(let i=0;i<demoN&&base.length;i++){const b=base[i%base.length];items.push({...b,kind:'d',demo:i+1,id:'demo'+(i+1)})}groups=[{id:'demo',ratio:'1:1',items}]}
  else{
    for(const g of (groupsCfg&&Array.isArray(groupsCfg.groups)?groupsCfg.groups:[])){
      let items=(g.works||[]).map(id=>by.get(id)).filter(w=>w&&!used.has(w.id));items.forEach(w=>used.add(w.id));
      if(proposed)items=items.slice().sort((a,b)=>a.rank-b.rank);
      if(items.length)groups.push({id:g.id,ratio:g.ratio,label_en:g.label_en,label_zh:g.label_zh,items});
    }
    const rest=[...by.values()].filter(w=>!used.has(w.id)).sort((a,b)=>a.rank-b.rank);   // anything not listed in a group still shows
    if(rest.length)groups.push({id:'other',ratio:'1:1',items:rest});
    const adds=added.map(a=>({...a,kind:'a',thumb:a.img,src:a.img}));                    // Owner-added works: their own wall(s)
    if(adds.length)groups.push({id:'added',ratio:'1:1',label_en:'New works',label_zh:'新上架作品',items:adds});
  }
  all=[];walls=[];const max=perMax();
  for(const g of groups){const n=g.items.length,P=Math.ceil(n/max),size=Math.ceil(n/P);
    for(let s=0;s<n;s+=size){const start=all.length;all.push(...g.items.slice(s,s+size));walls.push({g,start,end:all.length})}}
}
const wallOf=i=>{const k=walls.findIndex(x=>i>=x.start&&i<x.end);return k<0?0:k};
function render(anim){
  const L=layout();layoutKey=L.key;
  const P=pages();page=Math.min(Math.max(0,page),P-1);
  const W=walls[page]||{g:{ratio:'1:1'},start:0,end:0};
  wall.style.setProperty('--cols',L.cols);wall.style.setProperty('--ratio',ratioCss(W.g.ratio));wall.dataset.group=W.g.id||'';
  const gl=$('awGroup');if(gl){const lab=zh()?(W.g.label_zh||W.g.label_en):(W.g.label_en||W.g.label_zh);gl.textContent=lab||'';gl.hidden=!lab}
  wall.textContent='';
  const start=W.start,end=W.end;
  for(let i=start;i<end;i++){
    const w=all[i];
    const b=document.createElement('button');b.type='button';b.className='aw-tile';b.dataset.i=i;b.dataset.kind=w.kind;
    const name=titleOf(w);b.setAttribute('aria-label',(name||t('AE Universe Creation selected artwork','AE Universe Creation 精選作品'))+(w.demo?' (demo #'+w.demo+')':'')+' — '+t('enlarge','放大'));
    const img=new Image();img.alt='';img.loading=(i-start)<L.cols*3?'eager':'lazy';if(w.w&&w.h){img.width=w.w;img.height=w.h}img.decoding='async';img.draggable=false;
    img.onload=()=>img.classList.add('ok');img.onerror=()=>img.classList.add('ok');img.src=w.thumb;b.append(img);
    if(w.kind==='a'&&!w.demo){const s=document.createElement('span');s.className='aw-new';s.textContent='NEW';b.append(s)}
    if(w.demo){const s=document.createElement('span');s.className='aw-dn';s.textContent='#'+w.demo;b.append(s)}
    b.addEventListener('click',()=>open(i));wall.append(b);
  }
  if(anim){wall.classList.remove('aw-turn');void wall.offsetWidth;wall.classList.add('aw-turn')}
  $('awCount').textContent=String(all.length);
  $('awCount').setAttribute('aria-label',all.length+t(' works',' 件作品'));
  renderPager(P,start,end);
  syncUrl();
}
function renderPager(P,start,end){
  pager.hidden=P<=1;if(P<=1)return;
  const nums=$('awPgNums');nums.textContent='';
  const max=isPhone()?7:11;let list=[];
  if(P<=max){for(let i=0;i<P;i++)list.push(i)}
  else{const s=new Set([0,P-1,page,page-1,page+1]);if(page<=2){s.add(1);s.add(2);s.add(3)}if(page>=P-3){s.add(P-2);s.add(P-3);s.add(P-4)}list=[...s].filter(i=>i>=0&&i<P).sort((a,b)=>a-b)}
  let prev=-1;
  list.forEach(i=>{
    if(prev>=0&&i-prev>1){const g=document.createElement('span');g.className='aw-gap';g.textContent='…';nums.append(g)}
    const b=document.createElement('button');b.type='button';b.className='aw-num';b.textContent=String(i+1);
    b.setAttribute('aria-label',t('Wall ','第 ')+(i+1)+t('',' 面牆'));if(i===page)b.setAttribute('aria-current','page');
    b.addEventListener('click',()=>go(i,true));nums.append(b);prev=i;
  });
  $('awPgPrev').disabled=page<=0;$('awPgNext').disabled=page>=P-1;
  $('awPgPrev').setAttribute('aria-label',t('Previous wall','上一面牆'));$('awPgNext').setAttribute('aria-label',t('Next wall','下一面牆'));
  $('awPgInfo').textContent=t('Wall ','第 ')+(page+1)+' / '+P+t('',' 面牆')+'  ·  '+(start+1)+'–'+end+' / '+all.length;
}
function syncUrl(){
  try{const u=new URL(location.href);if(page>0)u.searchParams.set('page',String(page+1));else u.searchParams.delete('page');
    if(u.href!==location.href)history.replaceState(null,'',u.pathname+u.search+u.hash)}catch(e){}
}
function go(p,scroll){
  const P=pages();p=Math.min(Math.max(0,p),P-1);if(p===page)return;page=p;render(true);
  if(scroll){const top=wall.getBoundingClientRect().top;if(top<0||top>window.innerHeight*.6)window.scrollTo({top:window.scrollY+top-90,behavior:'smooth'})}
}
$('awPgPrev').onclick=()=>go(page-1,true);
$('awPgNext').onclick=()=>go(page+1,true);
function fill(){
  const w=all[cur];if(!w)return;
  const img=$('awLbImg');img.src=w.src;img.alt=w.alt||titleOf(w)||t('AE Universe Creation selected artwork','AE Universe Creation 精選作品');
  const name=titleOf(w);$('awLbTitle').textContent=(name||'AE Universe Creation')+(w.demo?'  ['+t('demo copy #','示範複本 #')+w.demo+']':'');
  $('awLbCredit').textContent=(name?'':t('Selected Work · ','精選作品・'))+creditOf(w)+'  ·  '+(cur+1)+' / '+all.length;
  const intro=introOf(w);$('awLbIntro').textContent=intro;$('awLbIntro').hidden=!intro;
  const ln=$('awLbLink');if(w.linkHref){ln.href=w.linkHref;ln.textContent=zh()?w.linkZh:w.linkEn;ln.hidden=false}else{ln.hidden=true;ln.removeAttribute('href')}
  $('awLbActions').hidden=!(owner&&w.kind==='a'&&!w.demo);
}
function open(i){cur=i;fill();if(!lb.open){lb.showModal?lb.showModal():lb.setAttribute('open','')};document.documentElement.style.overflow='hidden'}
function close(){if(lb.open)lb.close();document.documentElement.style.overflow=''}
lb.addEventListener('close',()=>{document.documentElement.style.overflow='';if(cur>=0){const p=wallOf(cur);if(p!==page){page=p;render(true)}const el=wall.querySelector('[data-i="'+cur+'"]');if(el)el.focus({preventScroll:true})}});
$('awLbX').onclick=close;
$('awPrev').onclick=()=>{cur=(cur-1+all.length)%all.length;fill()};
$('awNext').onclick=()=>{cur=(cur+1)%all.length;fill()};
lb.addEventListener('click',e=>{if(e.target===lb)close()});
document.addEventListener('keydown',e=>{
  if(lb.open){if(e.key==='ArrowLeft')$('awPrev').click();if(e.key==='ArrowRight')$('awNext').click();return}
  if(keyDlg.open||e.altKey||e.ctrlKey||e.metaKey)return;
  const tg=e.target;if(tg&&(tg.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)))return;
  if(e.key==='ArrowLeft'||e.key==='PageUp'){if(page>0){e.preventDefault();go(page-1,false)}}
  else if(e.key==='ArrowRight'||e.key==='PageDown'){if(page<pages()-1){e.preventDefault();go(page+1,false)}}
});
let sx=null,sy=0;lb.addEventListener('touchstart',e=>{sx=e.touches.length===1?e.touches[0].clientX:null},{passive:true});
lb.addEventListener('touchend',e=>{if(sx==null)return;const dx=e.changedTouches[0].clientX-sx;sx=null;if(Math.abs(dx)>60)(dx<0?$('awNext'):$('awPrev')).click()},{passive:true});
// swipe the wall left/right on phones to change walls
let wx=null,wy=0;wall.addEventListener('touchstart',e=>{if(e.touches.length===1){wx=e.touches[0].clientX;wy=e.touches[0].clientY}else wx=null},{passive:true});
wall.addEventListener('touchend',e=>{if(wx==null)return;const dx=e.changedTouches[0].clientX-wx,dy=e.changedTouches[0].clientY-wy;wx=null;if(Math.abs(dx)>60&&Math.abs(dx)>1.5*Math.abs(dy))go(page+(dx<0?1:-1),false)},{passive:true});
// layout switch (phones/tablets): dense 4 columns ⇄ large 3 columns; same works per wall, so the wall you are on stays the same
document.querySelectorAll('.aw-mode button').forEach(b=>b.addEventListener('click',()=>{
  wall.dataset.mode=b.dataset.mode;document.querySelectorAll('.aw-mode button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  try{localStorage.setItem('ae-artwall-mode',b.dataset.mode)}catch(e){}
  render(false);
}));
try{const m=localStorage.getItem('ae-artwall-mode');if(m==='large'){wall.dataset.mode='large';document.querySelectorAll('.aw-mode button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.mode==='large')))}}catch(e){}
let rz=0;window.addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{const L=layout();if(L.key!==layoutKey){wall.style.setProperty('--cols',L.cols);layoutKey=L.key;renderPager(pages(),(walls[page]||{start:0}).start,(walls[page]||{end:0}).end)}},120)});
async function loadAdded(){
  if(demoN){apiState={storage:'demo (not loaded)',writable:false};added=[];return}
  try{const r=await fetch(API,{cache:'no-store'});const j=await r.json();apiState={storage:j.storage,writable:!!j.writable};added=Array.isArray(j.items)?j.items:[]}
  catch(e){apiState={storage:'unreachable',writable:false};added=[]}
}
// ---- Owner editor (unchanged behaviour; disabled while a ?demo dataset is shown)
const status=(m,el='awStatus')=>{$(el).textContent=m};
async function whoami(k){try{const r=await fetch(API+'?whoami=1',{headers:{'x-ae-owner-key':k},cache:'no-store'});const j=await r.json();return j}catch(e){return {ok:false}}}
function ownerUI(){
  $('awOwner').hidden=!owner||!!demoN;$('awLoginBtn').hidden=owner||!!demoN;
  $('awOwnerNote').textContent=owner?t('Logged in as Owner. Storage: ','已以 Owner 登入。儲存：')+apiState.storage+(apiState.writable?'':t(' (not writable)','（目前不可寫入）')):'';
  fill();
}
function demoUI(){
  const d=$('awDemo');const bits=[];
  if(demoN)bits.push(t('DEV DEMO · '+demoN+' in-memory copies of the Selected Works to preview paging — nothing is saved','開發示範・以 '+demoN+' 件精選作品的記憶體複本預覽分頁，不會儲存任何資料'));
  if(proposed)bits.push(t('PROPOSED ORDER (v2476.45) — preview only, not decided','提案排序（v2476.45）— 僅預覽，尚未決定'));
  d.hidden=!bits.length;d.textContent=bits.join('  ·  ');
}
$('awLoginBtn').onclick=()=>{status('', 'awKeyStatus');$('awKeyInput').value='';keyDlg.showModal()};
$('awKeyForm').addEventListener('submit',async e=>{
  if(e.submitter&&e.submitter.value==='cancel')return;
  e.preventDefault();const k=$('awKeyInput').value.trim();status(t('Checking…','確認中…'),'awKeyStatus');
  const j=await whoami(k);
  if(j&&j.owner){setKey(k);owner=true;keyDlg.close();await loadAdded();build();render(false);ownerUI()}
  else status(j&&j.keyConfigured===false?t('Owner key is not configured on this deployment.','此部署尚未設定 Owner 金鑰。'):t('Key not accepted.','金鑰不正確。'),'awKeyStatus');
});
$('awLogout').onclick=()=>{setKey('');owner=false;resetForm();ownerUI()};
function resetForm(){const f=$('awForm');f.reset();f.id.value='';$('awSave').textContent=t('Add work','新增作品');$('awCancel').hidden=true}
$('awCancel').onclick=resetForm;
function fileToDataUrl(file){return new Promise((res,rej)=>{
  const url=URL.createObjectURL(file);const im=new Image();
  im.onload=()=>{URL.revokeObjectURL(url);let w=im.naturalWidth,h=im.naturalHeight;const max=2400;const s=Math.min(1,max/Math.max(w,h));w=Math.round(w*s);h=Math.round(h*s);
    const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);
    let q=.92,d=c.toDataURL('image/jpeg',q);while(d.length>4.1e6&&q>.6){q-=.08;d=c.toDataURL('image/jpeg',q)}res({data:d,w,h})};
  im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('bad image'))};im.src=url})}
$('awForm').addEventListener('submit',async e=>{
  e.preventDefault();if(demoN)return;const f=e.target;const id=f.id.value;const file=f.file.files[0];
  if(!id&&!file){status(t('Choose an image first.','請先選擇圖片。'));return}
  const body={title_en:f.title_en.value,title_zh:f.title_zh.value,intro_en:f.intro_en.value,intro_zh:f.intro_zh.value};
  try{status(t('Saving…','儲存中…'));if(file){const d=await fileToDataUrl(file);body.image=d.data;body.w=d.w;body.h=d.h}
    const r=await fetch(API+(id?'?id='+encodeURIComponent(id):''),{method:id?'PUT':'POST',headers:{'content-type':'application/json','x-ae-owner-key':getKey()},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok){status(t('Save failed: ','儲存失敗：')+(j.error||r.status));return}
    await loadAdded();build();render(false);resetForm();status(t('Saved to server. It will read back on any device.','已存到伺服器，任何裝置重新整理都讀得到。'));
  }catch(err){status(t('Save failed: ','儲存失敗：')+err.message)}
});
$('awEdit').onclick=()=>{const w=all[cur];if(!w||w.kind!=='a'||w.demo)return;const f=$('awForm');f.id.value=w.id;f.title_en.value=w.title_en||'';f.title_zh.value=w.title_zh||'';f.intro_en.value=w.intro_en||'';f.intro_zh.value=w.intro_zh||'';
  $('awSave').textContent=t('Save changes','儲存修改');$('awCancel').hidden=false;close();$('awOwner').scrollIntoView({behavior:'smooth'});status(t('Editing: leave the image empty to keep the current one.','修改中：圖片留空即保留原圖。'))};
$('awDel').onclick=async()=>{const w=all[cur];if(!w||w.kind!=='a'||w.demo)return;if(!confirm(t('Delete this added work?','確定刪除這件新增作品？')))return;
  const r=await fetch(API+'?id='+encodeURIComponent(w.id),{method:'DELETE',headers:{'x-ae-owner-key':getKey()}});const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.ok){alert(t('Delete failed: ','刪除失敗：')+(j.error||r.status));return}close();await loadAdded();build();render(false);status(t('Deleted.','已刪除。'))};
new MutationObserver(()=>{render(false);if(lb.open)fill();ownerUI();demoUI()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
(async()=>{
  const [o,x,g]=await Promise.all([WORKS_URL,NEW_URL,GROUPS_URL].map(u=>fetch(u).then(r=>r.ok?r.json():null).catch(()=>null)));
  originals=Array.isArray(o)?o:[];extra=Array.isArray(x)?x:[];groupsCfg=g&&Array.isArray(g.groups)?g:null;
  if(proposed){try{const p=await (await fetch(PROPOSED_URL)).json();const by=new Map(originals.map(o=>[o.id,o]));const re=p.ids.map(id=>by.get(id)).filter(Boolean);if(re.length===originals.length)originals=re}catch(e){}}
  demoUI();build();render(false);await loadAdded();build();render(false);
  if(!demoN){const k=getKey();if(k){const j=await whoami(k);owner=!!(j&&j.owner);if(!owner)setKey('')}
    if(/[?&]owner\b/.test(location.search)&&!owner)$('awLoginBtn').click();}
  ownerUI();
})();
})();
