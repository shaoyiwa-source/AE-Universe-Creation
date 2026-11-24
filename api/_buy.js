'use strict';
const items=new Map(Object.entries({
 'WP-ETERNAL-SUN-4':'e3991964e5','WP-AE-HEART-UNIVERSE-9':'9b9703d58b','WP-AE-COLOR-UNIVERSE-9':'f68079f3cc','WP-COLOR-ORBITS':'91fadff481','WP-VERDANT-GARDEN':'c03931adf3','WP-NIGHT-SWIRLS':'55f40a6fbc','WP-GOLDEN-MEADOW':'8a012e351f','WP-RED-FLAME-WEAVE':'2c0cf9a510','WP-HEART-LAYERS':'92c2647120','WP-WARM-CURRENTS':'f0df559cdb','WP-INFINITY-LOOPS':'44285cfd3f','WP-FEATHER-BRIGHTS':'0f3c1b8a63','WP-SKETCHBOOK-SPARKS':'3ebaded495','WP-EARTH-TEXTURES':'7d9e944de4'
}));
const shop='https://ko-fi.com/aeuniverse1314/shop';
const payment='https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';
const target=sku=>items.has(sku)?'https://ko-fi.com/s/'+items.get(sku):shop;
const locale=(q,header)=>q==='zh'?'zh':q==='en'?'en':/^zh\b/i.test(header||'')?'zh':'en';

async function decide(x,probe) {
 if(!x.live||!x.sku||!x.storage||!x.ref)return false;
 try{return await probe()===true}catch{return false}
}
let probeFreshUntil=0,probeWasReady=false,pending;
async function verifyMerchant({id,key,iv,reference,mac},call=fetch){
 if(Date.now()<probeFreshUntil)return probeWasReady;
 if(pending)return pending;
 pending=(async()=>{
  let ready=false,delay=60_000;
  try {
   const payload={MerchantID:id,MerchantTradeNo:reference,TimeStamp:String(Math.floor(Date.now()/1000))};
   payload.CheckMacValue=mac(payload,key,iv);
   const response=await call('https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(payload),redirect:'error',signal:AbortSignal.timeout(2300)
   });
   if(response.status===403)delay=1_800_000;
   if(response.ok){
    const raw=await response.text();
    if(raw.length<16000) {
     const values=Object.fromEntries(new URLSearchParams(raw));
     const signature=/^[A-Fa-f0-9]{64}$/.test(values.CheckMacValue||'')&&mac(values,key,iv)===values.CheckMacValue.toUpperCase();
     ready=Boolean(signature&&values.MerchantID===id&&values.MerchantTradeNo===reference&&/^\d{1,20}$/.test(values.TradeNo||'')&&values.TradeStatus==='1');
    }
   }
  }catch{}
  probeWasReady=ready;probeFreshUntil=Date.now()+(ready?300_000:delay);
  return ready;
 })().finally(()=>{pending=undefined});
 return pending;
}
function page({sku,lang,ready,nonce,inert=false,attempt=''}) {
 const ko=target(sku);
 const text=lang==='zh'?{
  fallback:'目前無法確認綠界可用',tip:'這筆購買尚未送到綠界，將為你開啟 Ko-fi 的商品頁。',continue:'立即前往 Ko-fi', check:'正在開啟結帳…', stalled:'結帳未能繼續', caution:'沒有重新送出付款。請回商店查看或稍後再試。', back:'返回商店',next:'前往結帳',browse:'前往 Ko-fi 商店'
 }:{fallback:'We could not confirm ECPay is available',tip:'You haven’t been sent to ECPay. We’ll open this product on Ko-fi instead.',continue:'Go to Ko-fi now',check:'Opening checkout…',stalled:'Checkout could not continue',caution:'We did not retry your payment. Return to the shop or try again later.',back:'Back to the shop',next:'Continue to checkout',browse:'Browse Ko-fi'};
 const header='<!doctype html><html lang="'+(lang==='zh'?'zh-Hant':'en')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+text.check+'</title><style>body{background:#faf7f0;color:#221a13;font:16px/1.55 system-ui;margin:0}main{max-width:34rem;margin:18vh auto;padding:2rem}h1{font-size:1.55rem;line-height:1.25} a{display:inline-block;margin:.5rem 0;padding:.7rem 1rem;border:1px solid currentColor;border-radius:1.5rem;color:inherit}[hidden]{display:none!important}</style></head><body><main>';
 if(!items.has(sku))return header+'<h1>'+text.stalled+'</h1><a id="kofi" href="'+shop+'" rel="noreferrer">'+text.browse+'</a></main></body></html>';
 if(inert)return header+'<h1>'+text.next+'</h1><form action="/api/ecpay/create-order?route=auto" method="post"><input type="hidden" name="sku" value="'+sku+'"><input type="hidden" name="lang" value="'+lang+'"><button type="submit">'+text.next+'</button></form><a href="'+ko+'" rel="noreferrer">'+text.continue+'</a></main></body></html>';
 if(!ready)return header+'<h1>'+text.fallback+'</h1><p>'+text.tip+'</p><a id="kofi" href="'+ko+'" rel="noreferrer">'+text.continue+'</a><script nonce="'+nonce+'">setTimeout(()=>location.replace(document.getElementById("kofi").href),6000)</script></main></body></html>';
 const titleJson=JSON.stringify(text);
 return header+'<h1 id="status" role="status">'+text.check+'</h1><p id="info"></p><a id="kofi" hidden href="'+ko+'" rel="noreferrer">'+text.continue+'</a><a id="back" hidden href="/shop/wallpapers">'+text.back+'</a>'+
 '<noscript><form action="/api/ecpay/create-order" method="post"><input type="hidden" name="sku" value="'+sku+'"><button type="submit">'+(lang==='zh'?'繼續結帳':'Continue to checkout')+'</button></form></noscript>'+
 '<script nonce="'+nonce+'">(async()=>{const t='+titleJson+',title=document.getElementById("status"),info=document.getElementById("info"),ko=document.getElementById("kofi"); const attempt='+JSON.stringify(attempt)+', guard=attempt?"ae-buy-attempt:"+attempt:""; function stalled(){title.textContent=t.stalled;info.textContent=t.caution;document.getElementById("back").hidden=false} function fallback(){title.textContent=t.fallback;info.textContent=t.tip;ko.hidden=false;setTimeout(()=>location.replace(ko.href),6000)} try{if(guard){try{if(sessionStorage.getItem(guard)){stalled();return}sessionStorage.setItem(guard,"1")}catch{}}const r=await fetch("/api/ecpay/create-order",{method:"POST",body:new URLSearchParams({sku:'+JSON.stringify(sku)+'}),credentials:"same-origin",redirect:"error",signal:AbortSignal.timeout(8000)});if(!r.ok){if(r.headers.get("content-type")?.includes("application/json")){const e=await r.json();if((r.status===403&&e.error==="PAYMENT_NOT_ENABLED")||(r.status===409&&e.error==="FULFILLMENT_NOT_READY")||(r.status===400&&e.error==="UNKNOWN_SKU")){fallback();return}}stalled();return}const result=await r.text(), parsed=new DOMParser().parseFromString(result,"text/html"), forms=parsed.querySelectorAll("form");if(forms.length!==1||forms[0].getAttribute("method")?.toLowerCase()!=="post"||forms[0].getAttribute("action")!=='+JSON.stringify(payment)+'){stalled();return}const fields=[...forms[0].querySelectorAll("input[type=hidden][name]")];if(!fields.some(x=>x.name==="CheckMacValue")||!fields.some(x=>x.name==="MerchantTradeNo")){stalled();return}const f=document.createElement("form");f.method="POST";f.action='+JSON.stringify(payment)+';for(const x of fields){const a=document.createElement("input");a.type="hidden";a.name=x.name;a.value=x.value;f.appendChild(a)}document.body.appendChild(f);HTMLFormElement.prototype.submit.call(f)}catch{stalled()}})()</script></main></body></html>';
}
function buyerOrigin(headers, deploymentHost){
 const host=String(headers.host||'').toLowerCase();
 if(host!=='ae-universe-creation.vercel.app'&&host!=='ae-universe-creation-one.vercel.app'&&host!==String(deploymentHost||'').toLowerCase())return false;
 return String(headers.origin||'')==='https://'+host&&(!headers['sec-fetch-site']||headers['sec-fetch-site']==='same-origin');
}
async function handler(req,res) {
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).send('Method Not Allowed')}
 const inert=req.method==='GET';
 if(!inert&&!buyerOrigin(req.headers,process.env.VERCEL_URL))return res.status(403).send('Open the purchase link on the AE website.');
 const args=inert?req.query:require('./ecpay/_lib').parseRequestBody(req);
 const sku=typeof args?.sku==='string'?args.sku:'',lang=locale(args?.lang,req.headers['accept-language']);
 const attempt=typeof args?.attempt==='string'&&/^[a-f0-9-]{36}$/.test(args.attempt)?args.attempt:'';
 let ready=false;
 if(!inert&&items.has(sku)) {
  try {
   const {liveCheckoutAllowed}=require('./_payment-gate');
   const {getWallpaperSku}=require('./_wallpaper-catalog');
   const {privateBlobReady}=require('./payment/ecpay-v2/_lib');
   const {createCheckMacValue}=require('./ecpay/_lib');
   const entry=getWallpaperSku(sku);
   const reference=String(process.env.AE_ECPAY_VERIFIED_REFERENCE||'').trim();
   const okRef=/^[a-zA-Z0-9]{1,20}$/.test(reference);
   ready=await decide({live:liveCheckoutAllowed(),sku:Boolean(entry?.active&&entry?.fulfillment_enabled),storage:Boolean(privateBlobReady()),ref:okRef},
    ()=>verifyMerchant({id:process.env.ECPAY_MERCHANT_ID.trim(),key:process.env.ECPAY_HASH_KEY.trim(),iv:process.env.ECPAY_HASH_IV.trim(),reference,mac:createCheckMacValue}));
  }catch{}
 }
 const nonce=require('node:crypto').randomBytes(18).toString('base64');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://payment.ecpay.com.tw; connect-src 'self'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline'");
 res.setHeader('X-AE-Checkout-Route',inert?'not-started':ready?'ecpay':'kofi');
 return res.status(200).send(page({sku,lang,ready,nonce,inert,attempt}));
}
module.exports=handler;
module.exports.decide=decide;
module.exports.target=target;
module.exports.page=page;
module.exports.verifyMerchant=verifyMerchant;
module.exports.buyerOrigin=buyerOrigin;
