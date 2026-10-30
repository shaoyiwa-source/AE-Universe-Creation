/* 藝術電視牆 Art TV Wall (site v2476.45). The 27 original Selected Works are static and locked;
   Owner-added works come from /api/artwall (server-side Blob storage). Visitors are read-only. */
(()=>{'use strict';
const ORIGINALS_URL='/assets/artwall/originals-v2476.45.json';
const API='/api/artwall';
const KEY='ae-artwall-owner-key';
const $=id=>document.getElementById(id);
const wall=$('awWall'),lb=$('awLb'),keyDlg=$('awKey');
let originals=[],added=[],all=[],cur=-1,owner=false,apiState={storage:'unknown',writable:false};
const zh=()=>document.documentElement.lang==='zh-Hant';
const t=(en,zhs)=>zh()?zhs:en;
const getKey=()=>{try{return sessionStorage.getItem(KEY)||''}catch(e){return ''}};
const setKey=v=>{try{v?sessionStorage.setItem(KEY,v):sessionStorage.removeItem(KEY)}catch(e){}};
function titleOf(w){if(w.kind==='o')return w.en?(zh()?(w.zh||w.en):w.en):'';return (zh()?(w.title_zh||w.title_en):(w.title_en||w.title_zh))||''}
function creditOf(w){if(w.kind==='o')return (zh()?w.creditZh:w.creditEn)||'AE Universe Creation';return t('New work · AE Universe Creation','新上架作品・AE Universe Creation')}
function introOf(w){if(w.kind==='o')return '';return (zh()?(w.intro_zh||w.intro_en):(w.intro_en||w.intro_zh))||''}
function render(){
  all=[...originals.map(o=>({...o,kind:'o'})),...added.map(a=>({...a,kind:'a',thumb:a.img,src:a.img}))];
  wall.textContent='';
  all.forEach((w,i)=>{
    const b=document.createElement('button');b.type='button';b.className='aw-tile';b.dataset.i=i;b.dataset.kind=w.kind;b.dataset.id=w.id;
    const name=titleOf(w);b.setAttribute('aria-label',(name||t('AE Universe Creation selected artwork','AE Universe Creation 精選作品'))+' — '+t('enlarge','放大'));
    const img=new Image();img.src=w.thumb;img.alt='';img.loading=i<30?'eager':'lazy';img.decoding='async';img.draggable=false;b.append(img);
    if(w.kind==='a'){const s=document.createElement('span');s.className='aw-new';s.textContent='NEW';b.append(s)}
    b.addEventListener('click',()=>open(i));wall.append(b);
  });
  $('awCount').textContent=String(all.length);
  $('awCount').setAttribute('aria-label',all.length+t(' works',' 件作品'));
}
function fill(){
  const w=all[cur];if(!w)return;
  const img=$('awLbImg');img.src=w.src;img.alt=titleOf(w)||t('AE Universe Creation selected artwork','AE Universe Creation 精選作品');
  const name=titleOf(w);$('awLbTitle').textContent=name||'AE Universe Creation';
  $('awLbCredit').textContent=(name?'':t('Selected Work · ','精選作品・'))+creditOf(w)+'  ·  '+(cur+1)+' / '+all.length;
  const intro=introOf(w);$('awLbIntro').textContent=intro;$('awLbIntro').hidden=!intro;
  $('awLbActions').hidden=!(owner&&w.kind==='a');
}
function open(i){cur=i;fill();if(!lb.open){lb.showModal?lb.showModal():lb.setAttribute('open','')};document.documentElement.style.overflow='hidden'}
function close(){if(lb.open)lb.close();document.documentElement.style.overflow=''}
lb.addEventListener('close',()=>{document.documentElement.style.overflow=''});
$('awLbX').onclick=close;
$('awPrev').onclick=()=>{cur=(cur-1+all.length)%all.length;fill()};
$('awNext').onclick=()=>{cur=(cur+1)%all.length;fill()};
lb.addEventListener('click',e=>{if(e.target===lb)close()});
document.addEventListener('keydown',e=>{if(!lb.open)return;if(e.key==='ArrowLeft')$('awPrev').click();if(e.key==='ArrowRight')$('awNext').click()});
let sx=null;lb.addEventListener('touchstart',e=>{sx=e.touches.length===1?e.touches[0].clientX:null},{passive:true});
lb.addEventListener('touchend',e=>{if(sx==null)return;const dx=e.changedTouches[0].clientX-sx;sx=null;if(Math.abs(dx)>60)(dx<0?$('awNext'):$('awPrev')).click()},{passive:true});
// layout switch (phones/tablets): dense 3 columns ⇄ large 2 columns
document.querySelectorAll('.aw-mode button').forEach(b=>b.addEventListener('click',()=>{
  wall.dataset.mode=b.dataset.mode;document.querySelectorAll('.aw-mode button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  try{localStorage.setItem('ae-artwall-mode',b.dataset.mode)}catch(e){}
}));
try{const m=localStorage.getItem('ae-artwall-mode');if(m==='large')document.querySelector('.aw-mode [data-mode=large]').click()}catch(e){}
async function loadAdded(){
  try{const r=await fetch(API,{cache:'no-store'});const j=await r.json();apiState={storage:j.storage,writable:!!j.writable};added=Array.isArray(j.items)?j.items:[]}
  catch(e){apiState={storage:'unreachable',writable:false};added=[]}
}
// ---- Owner editor
const status=(m,el='awStatus')=>{$(el).textContent=m};
async function whoami(k){try{const r=await fetch(API+'?whoami=1',{headers:{'x-ae-owner-key':k},cache:'no-store'});const j=await r.json();return j}catch(e){return {ok:false}}}
function ownerUI(){
  $('awOwner').hidden=!owner;$('awLoginBtn').hidden=owner;
  $('awOwnerNote').textContent=owner?t('Logged in as Owner. Storage: ','已以 Owner 登入。儲存：')+apiState.storage+(apiState.writable?'':t(' (not writable)','（目前不可寫入）')):'';
  fill();
}
$('awLoginBtn').onclick=()=>{status('', 'awKeyStatus');$('awKeyInput').value='';keyDlg.showModal()};
$('awKeyForm').addEventListener('submit',async e=>{
  if(e.submitter&&e.submitter.value==='cancel')return;
  e.preventDefault();const k=$('awKeyInput').value.trim();status(t('Checking…','確認中…'),'awKeyStatus');
  const j=await whoami(k);
  if(j&&j.owner){setKey(k);owner=true;keyDlg.close();await loadAdded();render();ownerUI()}
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
  e.preventDefault();const f=e.target;const id=f.id.value;const file=f.file.files[0];
  if(!id&&!file){status(t('Choose an image first.','請先選擇圖片。'));return}
  const body={title_en:f.title_en.value,title_zh:f.title_zh.value,intro_en:f.intro_en.value,intro_zh:f.intro_zh.value};
  try{status(t('Saving…','儲存中…'));if(file){const d=await fileToDataUrl(file);body.image=d.data;body.w=d.w;body.h=d.h}
    const r=await fetch(API+(id?'?id='+encodeURIComponent(id):''),{method:id?'PUT':'POST',headers:{'content-type':'application/json','x-ae-owner-key':getKey()},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok){status(t('Save failed: ','儲存失敗：')+(j.error||r.status));return}
    await loadAdded();render();resetForm();status(t('Saved to server. It will read back on any device.','已存到伺服器，任何裝置重新整理都讀得到。'));
  }catch(err){status(t('Save failed: ','儲存失敗：')+err.message)}
});
$('awEdit').onclick=()=>{const w=all[cur];if(!w||w.kind!=='a')return;const f=$('awForm');f.id.value=w.id;f.title_en.value=w.title_en||'';f.title_zh.value=w.title_zh||'';f.intro_en.value=w.intro_en||'';f.intro_zh.value=w.intro_zh||'';
  $('awSave').textContent=t('Save changes','儲存修改');$('awCancel').hidden=false;close();$('awOwner').scrollIntoView({behavior:'smooth'});status(t('Editing: leave the image empty to keep the current one.','修改中：圖片留空即保留原圖。'))};
$('awDel').onclick=async()=>{const w=all[cur];if(!w||w.kind!=='a')return;if(!confirm(t('Delete this added work?','確定刪除這件新增作品？')))return;
  const r=await fetch(API+'?id='+encodeURIComponent(w.id),{method:'DELETE',headers:{'x-ae-owner-key':getKey()}});const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.ok){alert(t('Delete failed: ','刪除失敗：')+(j.error||r.status));return}close();await loadAdded();render();status(t('Deleted.','已刪除。'))};
new MutationObserver(()=>{render();if(lb.open)fill();ownerUI()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
(async()=>{
  try{originals=await (await fetch(ORIGINALS_URL)).json()}catch(e){originals=[]}
  render();await loadAdded();render();
  const k=getKey();if(k){const j=await whoami(k);owner=!!(j&&j.owner);if(!owner)setKey('')}
  if(/[?&]owner\b/.test(location.search)&&!owner)$('awLoginBtn').click();
  ownerUI();
})();
})();
