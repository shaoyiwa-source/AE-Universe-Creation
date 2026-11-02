/* 換個樣子 (looks) v0.7 — Owner 2026-10-21: only TWO looks are kept, 寶石 (gemstone) and 琉璃 (stained-glass lines), plus 原畫
   (no effect). The other v0.6 looks (螢光閃爍, 呼吸, 浮雕, 立體, 點綴) are removed from the UI and from this file (v0.6.2 code is in git:
   efcf4d0 src/wallpaper/looks.js); their masks (A, B, E) are no longer shipped.
   The artwork is never changed: maker.js draws it (crop + resize only) as the base layer, and each look is two SEPARATE layers
   rendered here in WebGL from colour masks precomputed from the painting (tools/looks_precompute.py, OpenCV colour/structure
   analysis, no generative model) and composited on top by maker.js with canvas blend modes (source-over + screen).
   v0.7: each look has 4 tuning sliders (PARAMS below) → one vec4 uniform uP. Every slider default reproduces the v0.6.2 look exactly.
   All motion is a pure function of the loop phase (0..1); 速度 is an integer multiplier of the phase → every loop length stays seamless.
   One WebGL context for everything (screen, thumbnails, exports); the canvas only grows, draws use a viewport/scissor
   sub-rectangle. webglcontextlost → looks switch off (maker.js falls back to 原畫); webglcontextrestored → rebuilt. */
(()=>{'use strict';
const ART_W=1440,ART_H=1993,SUN={x:.5086,y:.5193};
// Slider definitions (UI labels: short, Chinese). u = which component of the uP uniform; map = slider value → shader value.
const DEG=Math.PI/180;
const PARAMS={
  gem:[{k:'amt',zh:'強度',min:.3,max:1.6,step:.05,def:1,u:0,fmt:v=>Math.round(v*100)+'%'},
       {k:'spk',zh:'閃爍',min:0,max:2.5,step:.05,def:1,u:1,fmt:v=>Math.round(v*100)+'%'},
       {k:'hue',zh:'色調',min:-180,max:180,step:5,def:0,u:2,map:v=>v*DEG,fmt:v=>(v>0?'+':'')+v+'°'},
       {k:'cut',zh:'切面',min:.5,max:2,step:.05,def:1,u:3,fmt:v=>'×'+(+v).toFixed(2)}],
  glass:[{k:'amt',zh:'強度',min:.3,max:1.6,step:.05,def:1,u:0,fmt:v=>Math.round(v*100)+'%'},
         {k:'line',zh:'線條粗細',min:.3,max:1.2,step:.05,def:.5,u:1,fmt:v=>(v<=.4?'極細':v<=.6?'細':v<=.9?'中':'略粗')+' '+(+v).toFixed(2)}, // v0.9b: half-width of the thin lead line in mask texels; default 0.5 (≈60% of v0.9's 0.8), max 1.2 (v0.8 lines were 5–14 texels wide)
         {k:'hue',zh:'色調',min:-180,max:180,step:5,def:0,u:2,map:v=>v*DEG,fmt:v=>(v>0?'+':'')+v+'°'},
         {k:'spd',zh:'速度',min:1,max:3,step:1,def:1,u:3,fmt:v=>['','慢','中','快'][v]||v}]};
const LOOKS=[{id:'orig',zh:'原畫'},
  {id:'gem',zh:'寶石',passes:['source-over','screen'],params:PARAMS.gem},
  {id:'glass',zh:'琉璃',passes:['source-over','screen'],params:PARAMS.glass}];
const ORDER=[0,1,2]; // picker order: 原畫 → 寶石 → 琉璃
const defaults=i=>Object.fromEntries((LOOKS[i].params||[]).map(p=>[p.k,p.def]));
// slider values {k:v} → vec4 for the shader (missing keys = defaults); values are clamped to the slider range
function uvec(i,vals){const o=[1,1,0,1];for(const p of LOOKS[i].params||[]){let v=vals&&vals[p.k]!=null?+vals[p.k]:p.def;if(!isFinite(v))v=p.def;v=Math.min(p.max,Math.max(p.min,v));if(p.k==='spd')v=Math.round(v);o[p.u]=p.map?p.map(v):v;}return o;}
const MASKS=['C','D','T'].map(k=>`/premium/eternal-sun/assets/looks/mask${k}.png`); // premium v2476.61: masks copied from AE Living Wallpaper v0.9 (trial-pack)

const VS=`attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FS0=`
uniform sampler2D uArt,uC,uD,uT;uniform vec2 uRes,uTex;uniform vec4 uRect,uP;uniform float uPh,uAsp,uFade;
const float TAU=6.2831853;const vec2 SUN=vec2(${SUN.x},${SUN.y});
vec2 h2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
vec3 hsv(float h,float s,float v){vec3 k=clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.);return v*mix(vec3(1),k,s);}
vec3 hrot(vec3 c,float a){if(a==0.)return c;const vec3 k=vec3(.57735027);float ca=cos(a);return max(c*ca+cross(k,c)*sin(a)+k*dot(k,c)*(1.-ca),0.);} // hue rotation around the grey axis
void layers(vec2 u,out vec4 O0,out vec4 O1){O0=vec4(0);O1=vec4(0);
 float a=TAU*uPh;
#if LOOK==1
 // 寶石: material change. The purple fan becomes faceted amethyst, the sun disc a brilliant-cut gem: each facet refracts
 // the painting beneath it (with R/G/B split = dispersion), facets flash as the light circles, star glints and inner glow.
 // uP = (強度, 閃爍, 色調 radians, 切面 size ×)
 vec4 Cm=texture2D(uC,u);float cm=Cm.g,gm=Cm.b;if(cm+gm<.002)return;
 vec2 P=u*vec2(1.,1./uAsp),SP=SUN*vec2(1.,1./uAsp);vec3 L=normalize(vec3(cos(a)*.75,sin(a)*.75,.66));
 vec3 n;float edge,fid,K,star=0.,sheen=.5,sh0=.5,shL=.45,eW=.85;vec3 tint,glowc;
 if(gm>cm){ // brilliant cut: table + 8 star facets + 16 upper-girdle facets
  const float R=.0613;vec2 d=P-SP;float r=length(d)/R,an=atan(d.y,d.x);
  float ring=r<.42?0.:(r<.72?1.:2.),ns=ring==0.?1.:(ring==1.?8.:16.),of=ring==2.?.5:0.;
  float x=an/TAU*ns+of,sec=floor(x),fa=fract(x),ca=(sec+.5-of)/ns*TAU;
  float r0=ring==0.?0.:(ring==1.?.42:.72),r1=ring==0.?.42:(ring==1.?.72:1.08);
  float edR=min(ring==0.?1.:r-r0,r1-r)*R,edA=min(fa,1.-fa)*TAU/ns*r*R;edge=ring==0.?edR:min(edA,edR);
  float tl=ring==0.?.12:(ring==1.?.5:.85);n=normalize(vec3(cos(ca)*tl,sin(ca)*tl,1.));fid=ring*17.+sec;K=.022;
  vec2 fc=vec2(cos(ca),sin(ca))*(r0+r1)*.5;if(ring==0.)fc=vec2(0.);vec2 q=d/R-fc;
  star=exp(-abs(q.x)*60.)*exp(-abs(q.y)*5.)+exp(-abs(q.y)*60.)*exp(-abs(q.x)*5.);
  tint=vec3(1.04,1.,.92);glowc=vec3(1.,.86,.55);sh0=.92;shL=.38;eW=.45;sheen=clamp(.5+dot(q,normalize(n.xy+1e-4))*2.,0.,1.);
 }else{ // amethyst: Voronoi facets ~1/30 of the width at 切面 ×1 (bigger 切面 = bigger facets)
  float G=24./uP.w;vec2 g=P*G,ip=floor(g),fp=fract(g),best=vec2(0),bid=vec2(0);float d1=8.,d2=8.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 o=vec2(float(i),float(j)),c=o+h2(ip+o)-fp;float dd=dot(c,c);
   if(dd<d1){d2=d1;d1=dd;best=c;bid=ip+o;}else if(dd<d2)d2=dd;}
  edge=(sqrt(d2)-sqrt(d1))*.5/G;vec2 hh=h2(bid+17.3);n=normalize(vec3((hh-.5)*1.15,1.));fid=dot(bid,vec2(7.,113.));K=.011;
  vec2 q=-best;star=(exp(-abs(q.x)*38.)*exp(-abs(q.y)*3.5)+exp(-abs(q.y)*38.)*exp(-abs(q.x)*3.5))*step(.72,hh.x);
  tint=vec3(.84,.62,1.06);glowc=vec3(.62,.38,1.);vec2 nd=normalize(n.xy+1e-4);sheen=clamp(.5+dot(q,nd)*1.3,0.,1.);
 }
 tint=hrot(tint,uP.z);glowc=hrot(glowc,uP.z);
 float m=max(cm,gm),lit=max(dot(n,L),0.),fl=pow(max(dot(reflect(-L,n),vec3(0,0,1)),0.),48.);
 fl=max(fl,.55*pow(.5+.5*cos(2.*a+fid*2.399),30.)); // each facet also gets its own flash moment in the loop
 float e=1.-smoothstep(.0003,.0016,edge);
 {vec2 rd=n.xy*vec2(1.,uAsp)*K;
  float sh=sh0+shL*lit+.3*(sheen-.5)*(.4+lit);vec3 c=vec3(texture2D(uArt,u-rd).r,texture2D(uArt,u-rd*1.2).g,texture2D(uArt,u-rd*1.4).b)*tint*sh;
  c=mix(c,vec3(1.,.97,1.),e*smoothstep(.25,.9,lit)*eW);c=mix(c,tint*.18,e*(1.-smoothstep(.1,.5,lit))*.6); // lit facet edges catch the light, the far ones go dark
  float al=m*.88;O0=vec4(min(c,1.)*al,al);}
 {vec3 fire=hsv(fract(fid*.137+uPh+uP.z/TAU),.75,1.);
  vec3 c=glowc*m*(.08+.05*cos(a))*(.5+sheen)+(mix(vec3(1.),fire,.5)*fl*(.45+1.2*star)*m+fire*e*fl*.8*m)*uP.y;c=min(c,1.);O1=vec4(c,max(c.r,max(c.g,c.b)));}
#elif LOOK==2
 // 琉璃: lead lines from the painting's LONG strokes (confetti outlines dropped) + a broad colour wave from the sun;
 // the fan and sun ring keep the warm halos of the close-up the Owner liked. uP = (強度, 線條粗細 ×, 色調 radians, 速度 1|2|3)
  vec4 D=texture2D(uD,u);float cmk=texture2D(uC,u).g+texture2D(uC,u).b,ph=uPh*uP.w,dr=D.r;
  // v0.9 thin lines: maskT = distance (mask texels ×32) to the centre line of each lead line → keep a uniform thin band around it.
  // uP.y = half-width in mask texels (線條粗細). The band starts thinner while the look fades in (uFade) and breathes only
  // slightly over the loop (×0.9..×1.1, a function of the loop phase → seamless).
  const float LA=.6; // v0.9b line opacity factor (Owner: thinner + more transparent)
  {float tw=uP.y*(.7+.3*uFade)*(.9+.2*(.5-.5*cos(TAU*uPh))),s=texture2D(uT,u).r*7.97;dr=(1.-smoothstep(tw-.55,tw+.55,s))*smoothstep(.08,.35,D.r);}
  vec2 d=(u-SUN)*vec2(uAsp,1.);float r=length(d),h0=fract(atan(d.y,d.x)/TAU+ph+r*.6),hu=fract(.83+.32*(.5+.5*sin(TAU*h0))+uP.z/TAU),w=.6+.4*cos(TAU*(r*1.4-ph)); // jewel hues: magenta → rose → amber → gold (色調 rotates them)
  float fan=clamp(cmk*1.5,0.,1.);{float al=dr*(.82-.32*fan)*LA;O0=vec4(vec3(.04,.02,.09)*al,al);} // v0.9b: lead line ×0.6 alpha = fine translucent outline
  {float fz=1.-.75*fan;vec3 c=hsv(hu,.7,1.)*min(D.g,.85)*(.22+.5*w)*fz+hsv(fract(hu+.05),.55,1.)*min(D.g*1.2,1.)*fan*(.16+.55*w*w)+vec3(1.,.98,.95)*dr*w*w*w*.22*LA;
   c=min(c,1.);O1=vec4(c,max(c.r,max(c.g,c.b)));}
#endif
}
void main(){vec2 f=vec2(gl_FragCoord.x/uRes.x,1.-gl_FragCoord.y/uRes.y),u=(f-uRect.xy)/uRect.zw;
 if(u.x<0.||u.y<0.||u.x>1.||u.y>1.){gl_FragColor=vec4(0);return;}
 vec4 o0,o1;layers(u,o0,o1);vec4 o=PASS==0?o0:o1;float k=uP.x; // 強度: scales the layer (source-over pass: its coverage; screen pass: its colour)
 if(k!=1.&&o.a>0.){if(PASS==0){float a2=min(1.,o.a*k);o.rgb*=a2/o.a;o.a=a2;}else{o.rgb=min(o.rgb*k,1.);o.a=max(o.r,max(o.g,o.b));}}
 gl_FragColor=o;}`;
let cv=null,gl=null,progs={},cur=null,texArt=null,texHi=null,tex1=[1/720,1/996],vs=null;
let state='idle',imgs=null,artImg=null,hiImg=null,loading=null,listeners=[],lostN=0,restoredN=0,draws=0;
const emit=(ev)=>{for(const f of listeners)try{f(ev);}catch(e){console.warn(e);}};
const load=src=>new Promise((res,rej)=>{const i=new Image();i.decoding='async';i.onload=()=>res(i);i.onerror=()=>rej(new Error('load '+src));i.src=src;});
function sh(t,src){const o=gl.createShader(t);gl.shaderSource(o,src);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)&&!gl.isContextLost())throw new Error(gl.getShaderInfoLog(o));return o;}
function tex(unit,img){const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);
  const rep=gl.CLAMP_TO_EDGE;
  for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,rep],[gl.TEXTURE_WRAP_T,rep]])gl.texParameteri(gl.TEXTURE_2D,k,v);return t;}
// texture units: 0 = painting (1440 px for the screen; unit 4 holds the 2600 px version used by exports), 1 = mask C, 2 = mask D, 3 = mask T (v0.9 thin-line distance)
function setup(){ // (re)build every GL resource from the decoded images; called at first use and after a context restore
  progs={};cur=null;texHi=null;
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  vs=sh(gl.VERTEX_SHADER,VS);
  texArt=tex(0,artImg);tex(1,imgs[0]);tex(2,imgs[1]);tex(3,imgs[2]);tex1=[1/imgs[0].width,1/imgs[0].height];
  if(hiImg)texHi=tex(4,hiImg);
  gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
}
function use(look,pass){const key=look+':'+pass;let P=progs[key];
  if(!P){const prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,`precision highp float;\n#define LOOK ${look}\n#define PASS ${pass}\n`+FS0));
    gl.bindAttribLocation(prog,0,'p');gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS)&&!gl.isContextLost())throw new Error(gl.getProgramInfoLog(prog));
    const u={};for(const n of ['uArt','uC','uD','uT','uRes','uTex','uRect','uP','uPh','uAsp','uFade'])u[n]=gl.getUniformLocation(prog,n);
    gl.useProgram(prog);gl.uniform1i(u.uArt,0);gl.uniform1i(u.uC,1);gl.uniform1i(u.uD,2);gl.uniform1i(u.uT,3);
    gl.uniform2f(u.uTex,tex1[0],tex1[1]);gl.uniform1f(u.uAsp,ART_W/ART_H);P=progs[key]={prog,u};}
  if(cur!==P){gl.useProgram(P.prog);cur=P;}return P.u;}
// v0.6.2: 「這個瀏覽器不支援換樣子」 is shown exactly when this returns false = the browser gives NO WebGL 1 context at all
// (no WebGLRenderingContext, or getContext('webgl') and 'experimental-webgl' both null). Looks use plain WebGL 1 + 8-bit RGB
// textures only (no extension, no float texture, no WebGL 2). Probed once and cached.
let sup=null,why='';const GLOPT={premultipliedAlpha:true,preserveDrawingBuffer:true,alpha:true,antialias:false,depth:false,stencil:false};
const ctx3d=c=>c.getContext('webgl',GLOPT)||c.getContext('experimental-webgl',GLOPT);
function supported(){if(sup!==null)return sup;if(gl){sup=true;return sup;}try{if(!window.WebGLRenderingContext){why='no WebGLRenderingContext';sup=false;}
  else{const c=document.createElement('canvas'),g=ctx3d(c);sup=!!g;why=g?'':'getContext(webgl) returned null';const x=g&&g.getExtension('WEBGL_lose_context');if(x)x.loseContext();}}catch(e){why='getContext threw: '+e;sup=false;}return sup;}
function prepare(art){ // idempotent; resolves true when looks can be drawn
  if(state==='ready')return Promise.resolve(true);if(loading)return loading;
  artImg=art;state='loading';
  loading=Promise.all(MASKS.map(load)).then(ms=>{imgs=ms;
    cv=document.createElement('canvas');cv.width=cv.height=16;
    gl=ctx3d(cv);
    if(!gl){state='unsupported';why=why||'getContext(webgl) returned null at prepare';return false;}
    cv.addEventListener('webglcontextlost',e=>{e.preventDefault();state='lost';lostN++;progs={};cur=null;emit('lost');},false);
    cv.addEventListener('webglcontextrestored',()=>{try{setup();state='ready';restoredN++;emit('restored');}catch(e){state='unsupported';console.warn('looks restore',e);emit('failed');}},false);
    setup();
    for(let look=1;look<LOOKS.length;look++)for(const [p,m] of LOOKS[look].passes.entries())if(m)use(look,p); // compile up front: no hitch on the first switch
    state='ready';emit('ready');return true;
  }).catch(e=>{console.warn('looks unavailable',e);state='unsupported';loading=null;emit('failed');return false;});
  return loading;}
function setHi(img){hiImg=img;if(state==='ready'&&!texHi&&img)texHi=tex(4,img);}
// render one layer (premultiplied RGBA) into the bottom-left W×H corner of the shared GL canvas; returns the source rect
function layer(look,pass,W,H,r,ph,hi,P,fade=1){
  if(cv.width<W||cv.height<H){cv.width=Math.max(cv.width,W);cv.height=Math.max(cv.height,H);}
  const U=use(look,pass);gl.viewport(0,0,W,H);gl.enable(gl.SCISSOR_TEST);gl.scissor(0,0,W,H);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,hi&&texHi?texHi:texArt);
  gl.uniform4f(U.uRect,r.x/W,r.y/H,r.w/W,r.h/H);gl.uniform2f(U.uRes,W,H);gl.uniform1f(U.uPh,ph);gl.uniform1f(U.uFade,fade);gl.uniform4f(U.uP,P[0],P[1],P[2],P[3]);
  gl.drawArrays(gl.TRIANGLES,0,3);draws++;return[0,cv.height-H,W,H];}
// composite the look's layers onto a 2D context. r = where the painting is drawn (maker.js artRect: fit preset + zoom/pan),
// vals = the look's slider values ({k:v}; missing = default). scale<1 renders the layers at fewer pixels and upscales
// (screen-only fallback when a phone can't hold the frame rate; exports always use scale 1).
function draw(ctx,W,H,r,ph,look,alpha,hi,scale=1,vals=null){
  if(state!=='ready'||!look||!(alpha>0))return false;const L=LOOKS[look];if(!L||!L.passes)return false;
  const w=Math.max(1,Math.round(W*scale)),h=Math.max(1,Math.round(H*scale)),k=w/W,rr={x:r.x*k,y:r.y*h/H,w:r.w*k,h:r.h*h/H},P=uvec(look,vals);
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  L.passes.forEach((mode,p)=>{if(!mode)return;const s=layer(look,p,w,h,rr,ph,hi,P,alpha);ctx.globalCompositeOperation=mode;ctx.globalAlpha=alpha;ctx.drawImage(cv,s[0],s[1],s[2],s[3],0,0,W,H);});
  ctx.restore();return true;}
function loseForTest(){const x=gl&&gl.getExtension('WEBGL_lose_context');if(!x)return false;x.loseContext();setTimeout(()=>x.restoreContext(),400);return true;}
window.AELooks={LOOKS,ORDER,PARAMS,defaults,uvec,supported,get why(){return why;},prepare,setHi,draw,on(f){listeners.push(f);},
  get ok(){return state==='ready';},get state(){return state;},get stats(){return{lostN,restoredN,draws,canvas:cv?[cv.width,cv.height]:null};},loseForTest};
})();
