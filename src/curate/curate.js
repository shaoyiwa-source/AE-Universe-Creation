// Shared helpers for AE 策展室 pages.
window.CU={
  async api(a,body,method){
    const opt={method:method||(body?'POST':'GET'),headers:{'x-curate':'1'},credentials:'same-origin'};
    if(body){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body)}
    let r,j={};
    try{r=await fetch('/api/curate?a='+a,opt);j=await r.json().catch(()=>({}))}catch(e){return {ok:false,status:0,error:'網路連線不穩，請再試一次'}}
    return Object.assign({status:r.status},j,{ok:r.ok&&j.ok!==false});
  },
  msg(el,text,kind){el.textContent=text||'';el.className='cu-msg '+(kind||'err')},
  esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},
  $(s,r){return (r||document).querySelector(s)}
};
