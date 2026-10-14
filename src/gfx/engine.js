/* ================= v8: GRAPHICS OVERHAUL — PBR materials, procedural facades, cars, people, sky, water, post ================= */
const GQ0=(()=>{try{const v=JSON.parse(localStorage.getItem('embercity_cfg')||'{}').gfx;return v===undefined?2:+v}catch(e){return 2}})(),LOWM=GQ0==0;
const GU={uNight:{value:0},uTime:{value:0},uWet:{value:0}};
const ANI=Math.min(8,rd.capabilities.getMaxAnisotropy());
const ph=(i,j,s)=>{const v=Math.sin(i*127.1+j*311.7+(s||0)*74.7)*43758.5453;return v-Math.floor(v)};
const clamp01=v=>v<0?0:v>1?1:v,smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
/* shared tileable noise field (256x256, fbm) — every procedural texture samples it */
const NZ=(()=>{const N=256,a=new Float32Array(N*N),P=[32,64,128,256],A=[.5,.25,.15,.1];
 for(let o=0;o<4;o++){const p=P[o],c=N/p,lat=new Float32Array(p*p);for(let i=0;i<p*p;i++)lat[i]=ph(i%p,(i/p)|0,o*7);
  for(let y=0;y<N;y++){const gy=y/c,j=Math.floor(gy),fy=gy-j,v=fy*fy*(3-2*fy),j0=j%p,j1=(j+1)%p;for(let x=0;x<N;x++){const gx=x/c,i=Math.floor(gx),fx=gx-i,u=fx*fx*(3-2*fx),i0=i%p,i1=(i+1)%p;
   a[y*N+x]+=A[o]*((lat[j0*p+i0]*(1-u)+lat[j0*p+i1]*u)*(1-v)+(lat[j1*p+i0]*(1-u)+lat[j1*p+i1]*u)*v)}}}return a})();
const nz=(x,y)=>NZ[((((y|0)%256)+256)%256)*256+((((x|0)%256)+256)%256)];
function cvsT(w,h,f){const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h,c);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=ANI;return t}
/* height field -> tangent-space normal map */
function nrmTex(H,w,h,str){return cvsT(w,h,(g)=>{const im=g.createImageData(w,h),d=im.data;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const l=H[y*w+(x-1+w)%w],r=H[y*w+(x+1)%w],u=H[((y-1+h)%h)*w+x],dn=H[((y+1)%h)*w+x];
  let nx=(l-r)*str,ny=(dn-u)*str,nz2=1;const L=Math.hypot(nx,ny,nz2);nx/=L;ny/=L;nz2/=L;const i=(y*w+x)*4;d[i]=(nx*.5+.5)*255;d[i+1]=(ny*.5+.5)*255;d[i+2]=nz2*255;d[i+3]=255}g.putImageData(im,0,0)})}
/* ---------- facade texture painter: albedo + roughness/metal (G/B) + window mask (R=maybe lit, G=always lit) + height ---------- */
function painter(W,H){const A=document.createElement('canvas'),M=document.createElement('canvas'),E=document.createElement('canvas');for(const c of[A,M,E]){c.width=W;c.height=H}
 const a=A.getContext('2d'),m=M.getContext('2d'),e=E.getContext('2d'),hg=new Float32Array(W*H);e.fillStyle='#000';e.fillRect(0,0,W,H);
 const R=(x,y,w,h,col,ro,me,hv,em)=>{x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);if(col){a.fillStyle=col;a.fillRect(x,y,w,h)}
  if(ro!=null){m.fillStyle='rgb(0,'+(ro*255|0)+','+((me||0)*255|0)+')';m.fillRect(x,y,w,h)}if(em){e.fillStyle='rgb('+(em[0]*255|0)+','+(em[1]*255|0)+',0)';e.fillRect(x,y,w,h)}
  if(hv!=null)for(let j=Math.max(0,y);j<Math.min(H,y+h);j++)hg.fill(hv,j*W+Math.max(0,x),j*W+Math.min(W,x+w))};
 const grime=(amt,streak,seed)=>{const im=a.getImageData(0,0,W,H),d=im.data,rm=m.getImageData(0,0,W,H),r2=rm.data;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,n=nz(x*.9+seed,y*.9),s=streak?Math.max(0,nz(x*3.1+seed*2,y*.12)-.55)*streak:0,k=1-amt*.5+amt*n-s;d[i]*=k;d[i+1]*=k;d[i+2]*=k;r2[i+1]=Math.min(255,r2[i+1]*(.9+.25*n))}
  a.putImageData(im,0,0);m.putImageData(rm,0,0)};
 const done=(str)=>{const mk=c=>{const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=ANI;return t};return{map:mk(A),rm:mk(M),mask:mk(E),nrm:nrmTex(hg,W,H,str||3)}};
 return{R,a,m,e,hg,grime,done}}
const GL=['#2a4252','#2d4656','#2f4a5c','#283e4d','#33505f','#26394a'];
function facadeStyle(st){const W=512,P=painter(W,W),R=P.R,cell=(f)=>{for(let fl=0;fl<2;fl++)for(let bx_=0;bx_<2;bx_++)f(bx_*256,(1-fl)*256,fl,bx_)};
 if(st==0){R(0,0,W,W,'#8d99a6',.42,.75,.7);cell((x,y)=>{R(x+6,y+6,244,192,ri(GL),.05,.85,.22,[1,0]);R(x+6,y+202,244,48,'#3b4651',.3,.6,.45);R(x+126,y+6,4,192,'#8d99a6',.42,.75,.66)});P.grime(.12,0,11)}
 else if(st==1){R(0,0,W,W,'#d8d0c2',.92,0,.85);cell((x,y)=>{R(x+36,y+36,184,168,'#6d6a66',.5,.25,.7);R(x+44,y+44,168,152,ri(GL),.06,.4,.3,[1,0]);R(x+126,y+44,4,152,'#6d6a66',.5,.25,.62);R(x+28,y+204,200,12,'#efe9df',.85,0,1)});for(const y of[246,502])R(0,y,W,10,'#c8bfb0',.9,0,.9);P.grime(.3,.5,23)}
 else if(st==2){R(0,0,W,W,'#b9b1a3',.95,0,.7);const BC=['#8e3b2b','#9a4532','#a1503a','#843526','#93402f','#7d3324'];for(let r=0;r<W/14;r++)for(let c=-1;c<W/40+1;c++)R(c*40+(r%2?20:0)+1,r*14+1,38,12,BC[(ph(r,c,3)*BC.length)|0],.9,0,.85);
  cell((x,y)=>{R(x+58,y+36,140,16,'#d6cdb9',.85,0,.95);R(x+68,y+52,120,164,'#ece8df',.6,0,.75);R(x+76,y+60,104,148,ri(GL),.06,.35,.3,[1,0]);R(x+126,y+60,4,148,'#ece8df',.6,0,.72);R(x+76,y+132,104,4,'#ece8df',.6,0,.72);R(x+60,y+216,136,10,'#d6cdb9',.85,0,.95)});P.grime(.35,.35,37)}
 else if(st==3){R(0,0,W,W,'#e6e8ea',.55,.1,.85);for(const y of[0,256])R(0,y+250,W,6,'#bfc3c7',.6,.1,.75);for(let x=0;x<W;x+=128)R(x,0,3,W,'#cfd3d7',.6,.1,.8);
  cell((x,y,fl,b)=>{if(b)return;R(0,y+70,W,124,'#1f2c37',.04,.8,.3,[1,0]);for(let k=0;k<W;k+=64)R(k,y+70,4,124,'#9aa3ab',.4,.8,.6)});P.grime(.12,.2,41)}
 else if(st==4){R(0,0,W,W,'#cdb999',.85,0,.85);cell((x,y)=>{for(const wx of[44,152]){R(x+wx-4,y+26,68,198,'#9c8a6a',.7,0,.7);R(x+wx,y+30,60,190,ri(GL),.05,.4,.3,[1,0])}for(const fx of[116,124,132])R(x+fx,y+18,3,214,'#b7a483',.8,0,.95);R(x+38,y+224,180,22,'#b8954a',.32,.8,.92)});P.grime(.25,.3,53)}
 else{for(let x=0;x<W;x++){const s=Math.sin(x/W*PI*64),c=150+s*22|0;R(x,0,1,W,'rgb('+c+','+(c+6)+','+(c+12)+')',.45+s*.08,.75,.5+s*.3)}cell((x,y,fl)=>{if(fl)R(x+20,y+24,216,44,'#22303a',.05,.6,.2,[1,0])});P.grime(.3,.6,67)}
 return P.done(st==5?5:3)}
const FS=[0,1,2,3,4,5].map(facadeStyle);
const SHOPT=(()=>{const P=painter(512,256),R=P.R;R(0,0,512,256,'#232329',.55,.5,.8);R(0,0,512,54,'#15151a',.5,.3,.85);
 for(const[x,w]of[[14,206],[292,206]]){R(x,66,w,176,'#2b2620',.04,.2,.3,[0,1]);const g=P.a.createLinearGradient(0,66,0,242);g.addColorStop(0,'rgba(255,214,150,.55)');g.addColorStop(1,'rgba(120,70,40,.2)');P.a.fillStyle=g;P.a.fillRect(x,66,w,176);
  for(let k=0;k<3;k++)R(x+8,110+k*40,w-16,5,'#1a140f',null);for(let k=0;k<9;k++)R(x+12+R2(w-40),80+k*17%140,10+R2(20),12,'rgba(40,30,25,.5)',null)}
 R(234,74,44,182,'#3a3a40',.4,.6,.75);R(240,80,32,170,'#2a2a2e',.05,.3,.3,[0,1]);R(0,242,512,14,'#0e0e10',.6,.3,.9);return P.done(2.5)})();
function R2(n){return Math.random()*n|0}
const ROOFT=(()=>{const W=256,H=new Float32Array(W*W);const t=cvsT(W,W,(g)=>{const im=g.createImageData(W,W),d=im.data;for(let y=0;y<W;y++)for(let x=0;x<W;x++){const n=nz(x*2,y*2),s=nz(x*7+50,y*7),v=(70+n*40+s*30)|0,i=(y*W+x)*4,seam=(x%128<2||y%128<2)?-25:0;d[i]=v+seam;d[i+1]=v+seam;d[i+2]=v+4+seam;d[i+3]=255;H[y*W+x]=s+(seam?-.5:0)}g.putImageData(im,0,0)});return{map:t,nrm:nrmTex(H,W,W,2)}})();
/* ---------- materials ---------- */
const LAMK=['color','map','emissive','emissiveMap','vertexColors','side','transparent','opacity','alphaTest','depthWrite'];
const STD=o=>{if(!LOWM)return new T.MeshStandardMaterial(o);const q={};for(const k of LAMK)if(o[k]!==undefined&&o[k]!==null)q[k]=o[k];return new T.MeshLambertMaterial(q)};
function plainMat(c){const m=STD({color:c,roughness:.8,metalness:.02});m.userData.plain=1;return m}
const PLAINM=STD({vertexColors:true,roughness:.8,metalness:.02}),NEONM=new T.MeshBasicMaterial({vertexColors:true});
function facadeHook(s){s.uniforms.uNight=GU.uNight;s.uniforms.uTime=GU.uTime;
 s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float aSeed;varying float vSeed;varying float vWY;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSeed=aSeed+((abs(normal.x)>.99||abs(normal.z)>.99)?floor(dot(normal,vec3(17.,0.,47.))+.5):0.);vWY=(modelMatrix*vec4(transformed,1.)).y;');
 s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uNight;uniform float uTime;varying float vSeed;varying float vWY;float fh(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}')
 .replace('#include <emissivemap_fragment>','vec4 wm=texture2D(emissiveMap,vEmissiveMapUv);vec2 cl=floor(vEmissiveMapUv*2.);float sd=floor(vSeed+.5);float wr1=fh(cl+sd*.713),wr2=fh(cl*1.7+sd*.31+3.);float lit=max(step(.52,wr1)*wm.r,wm.g);vec3 tn=mix(vec3(1.,.72,.4),vec3(.7,.85,1.),step(.78,wr2));tn=mix(tn,vec3(1.,.38,.72),step(.965,wr2));float wfl=1.-step(.988,wr1)*step(.5,fract(uTime*2.3+wr2*7.));totalEmissiveRadiance=tn*lit*uNight*(.35+.55*wr2)*wfl*.85;')
 .replace('#include <aomap_fragment>','#include <aomap_fragment>\nfloat gao=mix(.5,1.,smoothstep(0.,4.,vWY));reflectedLight.indirectDiffuse*=gao;reflectedLight.directDiffuse*=mix(.7,1.,smoothstep(0.,3.,vWY));reflectedLight.indirectSpecular*=gao;')}
const FMC={},FMS=[];
function facMat(st,col){const k=st+'|'+col;if(FMC[k])return FMC[k];const S=st=='shop'?SHOPT:FS[st];let c=new T.Color(col);if(st===0||st===3||st===5)c.lerp(new T.Color(0xffffff),.6);if(st=='shop')c.setHex(0xffffff);
 const m=LOWM?new T.MeshLambertMaterial({color:c,map:S.map,emissiveMap:S.mask,emissive:0xffffff}):new T.MeshStandardMaterial({color:c,map:S.map,roughnessMap:S.rm,metalnessMap:S.rm,normalMap:S.nrm,emissiveMap:S.mask,emissive:0xffffff,roughness:1,metalness:1,envMapIntensity:1});
 m.onBeforeCompile=facadeHook;FMC[k]=m;FMS.push(m);return m}
const ROOFM=STD({color:0xffffff,map:ROOFT.map,normalMap:LOWM?null:ROOFT.nrm,roughness:.95});
const SHOPM=facMat('shop',0xffffff);
/* UV scaling so one shared texture tile = 8m x 6m of facade */
function facGeo(w,h,d,cyl,TW,TH){TW=TW||8;TH=TH||6;let g;
 if(cyl){const r=w/2;g=new T.CylinderGeometry(r,r,h,18,1);const uv=g.attributes.uv,n=19*2,circ=Math.max(2,Math.round(2*PI*r/TW));for(let i=0;i<uv.count;i++){if(i<n)uv.setXY(i,uv.getX(i)*circ,uv.getY(i)*h/TH);else uv.setXY(i,uv.getX(i)*w/8,uv.getY(i)*w/8)}}
 else{g=new T.BoxGeometry(w,h,d);const uv=g.attributes.uv;for(let f=0;f<6;f++){const fw=f<2?d:w,fh=f==2||f==3?d:h,sx=f==2||f==3?fw/8:fw/TW,sy=f==2||f==3?fh/8:fh/TH;for(let i=f*4;i<f*4+4;i++)uv.setXY(i,uv.getX(i)*sx,uv.getY(i)*sy)}}
 const s=new Float32Array(g.attributes.position.count).fill(R()*64|0);g.setAttribute('aSeed',new T.BufferAttribute(s,1));return g}
/* ---------- geometry merge (also used for static batching) ---------- */
function mergeGeos(items){let tot=0;const ex=[];let hasC=false,hasS=false;
 for(const it of items){const g=it.g,ix=g.index,s=it.s||0,n=it.n!=null?Math.min(it.n,(ix?ix.count:g.attributes.position.count)-s):(ix?ix.count:g.attributes.position.count);ex.push([it,s,n]);tot+=n;if(it.col||g.attributes.color)hasC=true;if(g.attributes.aSeed)hasS=true}
 const P=new Float32Array(tot*3),N=new Float32Array(tot*3),U=new Float32Array(tot*2),C=hasC?new Float32Array(tot*3):null,S=hasS?new Float32Array(tot):null,v=new T.Vector3(),nm=new T.Matrix3();let o=0;
 for(const[it,s,n]of ex){const g=it.g,ix=g.index?g.index.array:null,pa=g.attributes.position,na=g.attributes.normal,ua=g.attributes.uv,ca=g.attributes.color,sa=g.attributes.aSeed;if(it.mx)nm.getNormalMatrix(it.mx);
  for(let k=0;k<n;k++){const i=ix?ix[s+k]:s+k;v.fromBufferAttribute(pa,i);if(it.mx)v.applyMatrix4(it.mx);P[o*3]=v.x;P[o*3+1]=v.y;P[o*3+2]=v.z;
   if(na){v.fromBufferAttribute(na,i);if(it.mx)v.applyMatrix3(nm).normalize();N[o*3]=v.x;N[o*3+1]=v.y;N[o*3+2]=v.z}
   if(ua){U[o*2]=ua.getX(i);U[o*2+1]=ua.getY(i)}
   if(C){if(it.col){C[o*3]=it.col.r;C[o*3+1]=it.col.g;C[o*3+2]=it.col.b}else if(ca){C[o*3]=ca.getX(i);C[o*3+1]=ca.getY(i);C[o*3+2]=ca.getZ(i)}else C[o*3]=C[o*3+1]=C[o*3+2]=1}
   if(S)S[o]=sa?sa.getX(i):0;o++}}
 const r=new T.BufferGeometry();r.setAttribute('position',new T.BufferAttribute(P,3));r.setAttribute('normal',new T.BufferAttribute(N,3));r.setAttribute('uv',new T.BufferAttribute(U,2));if(C)r.setAttribute('color',new T.BufferAttribute(C,3));if(S)r.setAttribute('aSeed',new T.BufferAttribute(S,1));r.computeBoundingSphere();return r}
const colGeo=(g,c)=>{const n=g.attributes.position.count,a=new Float32Array(n*3),k=new T.Color(c);for(let i=0;i<n;i++){a[i*3]=k.r;a[i*3+1]=k.g;a[i*3+2]=k.b}g.setAttribute('color',new T.BufferAttribute(a,3));return g};
/* ---------- people: vertex-coloured merged limbs (one shared material) ---------- */
const PSM=STD({vertexColors:true,roughness:.78}),VBC={};
/* HIGH+ quality: bevelled rounded boxes for the larger body parts (small face details stay crisp) */
function hqChars(){return QDEF>=2}
function pbox(w,h,d){const m=Math.min(w,h,d);return T.RoundedBoxGeometry&&hqChars()&&m>=.1?new T.RoundedBoxGeometry(w,h,d,1,m*.22):new T.BoxGeometry(w,h,d)}
function vbox(key,parts){if(VBC[key])return VBC[key];return VBC[key]=mergeGeos(parts.map(p=>({g:colGeo(pbox(p[0],p[1],p[2]).translate(p[3],p[4],p[5]),p[6])})))}
const hx=c=>'#'+new T.Color(c).getHexString();
const pLeg=pa=>['L'+pa,[[.18,.42,.21,0,-.21,0,pa],[.2,.1,.28,0,-.44,.03,'#1b1b1e']]],pArm=(sh,sk)=>['A'+sh+sk,[[.17,.36,.2,0,-.18,0,sh],[.15,.15,.17,0,-.43,0,sk]]],
 pTor=(sh,sk)=>['T'+sh+sk,[[.5,.5,.3,0,.78,0,sh],[.52,.07,.32,0,.52,0,'#26262a'],[.16,.08,.16,0,1.06,0,sk],[.3,.04,.31,0,.98,0,sh]]],
 pHead=sk=>['H'+sk,[[.34,.34,.34,0,0,0,sk],[.07,.05,.02,-.08,.03,.172,'#141418'],[.07,.05,.02,.08,.03,.172,'#141418'],[.12,.03,.02,0,-.08,.172,'#7a3e32'],[.05,.08,.04,0,-.02,.18,sk]]],
 pHair=(ha,hs)=>hs==2?['R2'+ha,[[.36,.13,.36,0,0,0,ha],[.36,.14,.06,0,-.06,-.16,ha],[.2,.2,.2,0,.06,-.22,ha]]]:hs==1?['R1'+ha,[[.36,.12,.36,0,0,0,ha],[.38,.5,.08,0,-.26,-.17,ha],[.06,.36,.3,-.18,-.16,-.02,ha],[.06,.36,.3,.18,-.16,-.02,ha]]]:['R'+ha,[[.36,.12,.36,0,0,0,ha],[.36,.2,.06,0,-.1,-.16,ha]]];
function vm(def,p){const m=new T.Mesh(vbox(def[0],def[1]),PSM);m.castShadow=true;p.add(m);return m}
function person2(skin,shirt,pants,hair,gun,hs){skin=hx(skin);shirt=hx(shirt);pants=hx(pants);hair=hx(hair);const g=new T.Group();g.rotation.order='YXZ';g.l=[];g.a=[];
 for(const x of[-.14,.14]){const p=new T.Group();p.position.set(x,.45,0);vm(pLeg(pants),p);g.add(p);g.l.push(p)}
 for(const x of[-.34,.34]){const p=new T.Group();p.position.set(x,1,0);vm(pArm(shirt,skin),p);g.add(p);g.a.push(p)}
 g.torso=vm(pTor(shirt,skin),g);const hd=vm(pHead(skin),g);hd.position.y=1.2;const hr=vm(pHair(hair,hs),g);hr.position.y=1.4;g.hd=[hd,hr];g.cols=[skin,shirt,pants,hair];
 if(gun)g.gm=bx(.1,.12,.35,0x222222,0,-.5,.15,g.a[1]);sc.add(g);return g}
function reShirt(g,c){c=hx(c);g.cols[1]=c;const d=pTor(c,g.cols[0]);g.torso.geometry=vbox(d[0],d[1]);for(const a of g.a){const e=pArm(c,g.cols[0]);a.children[0].geometry=vbox(e[0],e[1])}}
/* ---------- cars: extruded bodies, glass, clearcoat paint, spinning wheels ---------- */
const GLASSM=STD({color:0x0b131b,roughness:.04,metalness:.9,envMapIntensity:1.6}),TIREM=STD({color:0x141414,roughness:.92}),RIMM=STD({color:0xc8ccd2,roughness:.22,metalness:1}),TRIMM=STD({color:0x18191c,roughness:.55,metalness:.3});
const CPM={};function paintM(c){return CPM[c]||(CPM[c]=LOWM?new T.MeshLambertMaterial({color:c}):new T.MeshPhysicalMaterial({color:c,metalness:.12,roughness:.36,clearcoat:.75,clearcoatRoughness:.08,envMapIntensity:.9}))}
const CARP=[{b:[[-2.15,.32],[2.1,.32],[2.18,.55],[2.05,.8],[1.05,.92],[-1.5,.95],[-2.12,.88],[-2.2,.6]],c:[[1.02,.9],[.22,1.42],[-.95,1.45],[-1.55,.92]],bw:1.9,cw:1.6,ly:.66,wz:1.35,wr:.36},
 {b:[[-2.2,.3],[2.15,.3],[2.26,.48],[2.12,.64],[.9,.78],[-1.6,.82],[-2.15,.78],[-2.26,.55]],c:[[.86,.76],[-.08,1.16],[-.78,1.18],[-1.66,.82]],bw:1.96,cw:1.52,ly:.56,wz:1.38,wr:.35},
 {b:[[-2.25,.42],[2.2,.42],[2.28,.72],[2.16,1.0],[1.3,1.1],[-2.2,1.12],[-2.28,.72]],c:[[1.26,1.06],[.74,1.74],[-2.14,1.78],[-2.2,1.08]],bw:2.02,cw:1.86,ly:.8,wz:1.42,wr:.42}];
const CARG={};
function exGeo(pts,w,bev){const s=new T.Shape();pts.forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1]));const dp=w-bev*2,g=new T.ExtrudeGeometry(s,{depth:dp,bevelEnabled:true,bevelThickness:bev,bevelSize:bev*.8,bevelSegments:2,curveSegments:2});g.translate(0,0,-dp/2);g.rotateY(-PI/2);return g}
let BLOBT=null;
function mkCar(col,type){if(type===undefined)type=R()<.14?1:R()<.22?2:0;const S=CARP[type],G=CARG[type]||(CARG[type]={b:exGeo(S.b,S.bw,.08),c:exGeo(S.c,S.cw,.06),w:new T.CylinderGeometry(S.wr,S.wr,.26,16).rotateZ(PI/2),r:new T.CylinderGeometry(S.wr*.62,S.wr*.62,.28,10).rotateZ(PI/2)});
 const g=new T.Group(),fz=Math.max(...S.b.map(p=>p[0])),rz=Math.min(...S.b.map(p=>p[0]));
 const body=new T.Mesh(G.b,paintM(col));body.castShadow=true;g.add(body);const cab=new T.Mesh(G.c,GLASSM);cab.castShadow=true;g.add(cab);
 g.wh=[];for(const x of[-1,1])for(const z of[-1,1]){const w=new T.Group();w.position.set(x*(S.bw/2-.1),S.wr,z*S.wz);const t=new T.Mesh(G.w,TIREM);t.castShadow=true;w.add(t,new T.Mesh(G.r,RIMM));g.add(w);g.wh.push(w)}
 for(const x of[-1,1]){nb(.42,.15,.06,0xfff4d8,x*S.bw*.31,S.ly,fz-.02,g);nb(.4,.13,.06,0xff2424,x*S.bw*.32,S.ly+.06,rz+.02,g)}
 const tb=new T.Mesh(geo(S.bw*.92,.16,.14),TRIMM);tb.position.set(0,.4,fz-.04);g.add(tb);const tr=new T.Mesh(geo(S.bw*.92,.16,.14),TRIMM);tr.position.set(0,.4,rz+.04);g.add(tr);
 const gr=new T.Mesh(geo(S.bw*.5,.14,.05),TRIMM);gr.position.set(0,S.ly-.06,fz);g.add(gr);
 if(!BLOBT)BLOBT=cvsT(64,64,(c,w,h)=>{const r=c.createRadialGradient(32,32,4,32,32,32);r.addColorStop(0,'rgba(0,0,0,.62)');r.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=r;c.fillRect(0,0,w,h)});
 if(!BLOBM)BLOBM=new T.MeshBasicMaterial({map:BLOBT,transparent:true,depthWrite:false});const bl=new T.Mesh(BLOBG,BLOBM);bl.rotation.x=-PI/2;bl.position.y=.04;bl.scale.set(S.bw*1.35,(fz-rz)*1.25,1);g.add(bl);
 {const bm=new T.Mesh(BEAMG,BEAMM);bm.rotation.x=-PI/2;bm.position.set(0,.08,fz+4.4);g.add(bm)}
 g.castShadow=true;sc.add(g);return{g,x:0,z:0,h:0,v:0,ai:0,type}}
const BLOBG=new T.PlaneGeometry(1,1);let BLOBM=null;
/* ---------- vegetation ---------- */
const TCAN=[];
function canopyGeo(v){if(TCAN[v])return TCAN[v];const gs=[],n=4+v;for(let i=0;i<n;i++){const g=new T.IcosahedronGeometry(1,1),p=g.attributes.position,a=i/n*PI*2+v,rad=i==0?0:.85,cx=Math.cos(a)*rad,cz=Math.sin(a)*rad,cy=i==0?.5:ph(i,v,5)*.5,r=i==0?1.55:1.05+ph(i,v,9)*.45;
  const c=new Float32Array(p.count*3);for(let k=0;k<p.count;k++){const x=p.getX(k),y=p.getY(k),z=p.getZ(k),j=.8+.38*ph(Math.round(x*40),Math.round(y*40)+Math.round(z*40)*7,i+v*9);p.setXYZ(k,cx+x*r*j,cy+y*r*j*.85,cz+z*r*j);const sh=.62+.5*clamp01((y+1)/2)+(ph(i,k%7,2)-.5)*.08;c[k*3]=sh;c[k*3+1]=sh;c[k*3+2]=sh}
  g.setAttribute('color',new T.BufferAttribute(c,3));gs.push({g})}return TCAN[v]=mergeGeos(gs)}
const TRM={};const treeM=c=>TRM[c]||(TRM[c]=LOWM?new T.MeshLambertMaterial({color:c,vertexColors:true}):new T.MeshStandardMaterial({color:c,vertexColors:true,flatShading:true,roughness:.85}));
let PALMG=null;
function palmGeo(){if(PALMG)return PALMG;const its=[];let x=0,y=0;for(let i=0;i<8;i++){const g=new T.CylinderGeometry(.15-i*.008,.2-i*.008,1.05,7);g.translate(x,y+.52,0);its.push({g:colGeo(g,i%2?0x8a6a48:0x76583a)});y+=1;x+=.05+i*.025}
 for(let k=0;k<9;k++){const a=k/9*PI*2+ph(k,1,4)*.3,pos=[],L=3.1+ph(k,2,4)*.7,seg=6,P2=[];for(let s=0;s<=seg;s++){const t=s/seg,w=Math.sin(Math.min(1,t*1.15)*PI)*.5+.03,dr=t*L,dy=.5*t-1.8*t*t;pos.push([dr,dy-.1*w,-w],[dr,dy+.08,0],[dr,dy-.1*w,w])}
  const q=v=>P2.push(v[0],v[1],v[2]);for(let s=0;s<seg;s++){const A=pos[s*3],C=pos[s*3+1],D=pos[s*3+2],A2=pos[s*3+3],C2=pos[s*3+4],D2=pos[s*3+5];q(A);q(C);q(A2);q(C);q(C2);q(A2);q(C);q(D);q(C2);q(D);q(D2);q(C2)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P2,3));g.computeVertexNormals();g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(P2.length/3*2),2));g.rotateY(a);g.translate(x,y,0);colGeo(g,k%2?0x3f8a3a:0x4f9a40);its.push({g})}
 for(let k=0;k<3;k++){const g=new T.SphereGeometry(.16,6,5);g.translate(x+Math.cos(k*2.1)*.22,y-.15,Math.sin(k*2.1)*.22);its.push({g:colGeo(g,0x5a3a1a)})}
 return PALMG=mergeGeos(its)}
const PALMM=STD({vertexColors:true,roughness:.8,side:T.DoubleSide});
/* ---------- lamp glows (one Points cloud) ---------- */
const GLOWP=[];let GLOWS=null;
function glowTex(){return cvsT(64,64,(g)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,240,200,1)');r.addColorStop(.18,'rgba(255,210,140,.55)');r.addColorStop(1,'rgba(255,180,100,0)');g.fillStyle=r;g.fillRect(0,0,64,64)})}
/* ---------- sky ---------- */
const SKYFS=`uniform vec3 uTop;uniform vec3 uHor;uniform vec3 uSunDir;uniform vec3 uSunCol;uniform vec3 uMoonDir;uniform vec3 uCloud;uniform float uNight;uniform float uTime;uniform float uCover;varying vec3 vD;
float h1(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(vec3(i,1.)),h1(vec3(i+vec2(1.,0.),1.)),f.x),mix(h1(vec3(i+vec2(0.,1.),1.)),h1(vec3(i+1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=0.,m=.5;for(int i=0;i<5;i++){a+=m*n2(p);p=p*2.03+vec2(1.7,9.2);m*=.5;}return a;}
void main(){vec3 d=normalize(vD);float h=d.y;vec3 col=mix(uHor,uTop,pow(clamp(h,0.,1.),.42));
 col+=uHor*.18*exp(-abs(h)*14.);col=mix(col,uHor*.78,smoothstep(0.,-.3,h));
 col+=vec3(.42,.2,.12)*exp(-max(h,0.)*8.)*uNight*.45;
 float sd=max(dot(d,uSunDir),0.),day=1.-uNight;
 col+=uSunCol*(pow(sd,7.)*.32+pow(sd,80.)*.55)*day;
 col=mix(col,uSunCol*1.5+.45,smoothstep(.99955,.99985,sd)*day);
 float md=max(dot(d,uMoonDir),0.);col+=vec3(.5,.58,.78)*pow(md,28.)*.16*uNight;col=mix(col,vec3(.93,.95,1.),smoothstep(.99925,.9996,md)*uNight);
 if(h>0.){vec3 sp=d*230.;vec3 c=floor(sp);float s=h1(c);vec3 f=fract(sp)-.5;float st=step(.9962,s)*smoothstep(.5,0.,length(f)*2.)*(.65+.35*sin(uTime*2.3+s*97.));col+=vec3(st)*uNight*smoothstep(0.,.22,h)*1.6;
  vec2 cp=d.xz/(h+.12)*1.5+vec2(uTime*.005,uTime*.002);float cn=fbm(cp*1.3);float dn=smoothstep(uCover,uCover+.3,cn);
  float lit=clamp(dot(normalize(vec3(d.x,0.,d.z)+1e-4),normalize(vec3(uSunDir.x,0.,uSunDir.z)+1e-4))*.5+.5,0.,1.);
  vec3 cc=mix(uCloud*.58,uCloud*1.06,lit)*(1.-.35*smoothstep(.55,.95,cn))+uSunCol*pow(sd,5.)*.55*day;
  col=mix(col,cc,dn*smoothstep(0.,.16,h)*.93);}
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const SKYU={uTop:{value:new T.Color()},uHor:{value:new T.Color()},uSunDir:{value:new T.Vector3(0,1,0)},uSunCol:{value:new T.Color()},uMoonDir:{value:new T.Vector3(0,-1,0)},uCloud:{value:new T.Color(1,1,1)},uNight:{value:0},uTime:GU.uTime,uCover:{value:.55}};
/* ---------- water ---------- */
const WNRM=(()=>{const W=256,H=new Float32Array(W*W),wv=[];for(let i=0;i<26;i++){const a=R()*PI*2,f=1+(R()*9|0);wv.push([Math.round(Math.cos(a)*f),Math.round(Math.sin(a)*f),R()*6.28,1/(f*.8+1)])}
 for(let y=0;y<W;y++)for(let x=0;x<W;x++){let h=0;for(const w of wv)h+=Math.sin((w[0]*x+w[1]*y)/W*PI*2+w[2])*w[3];H[y*W+x]=h}const t=nrmTex(H,W,W,2.2);t.anisotropy=ANI;return t})();
const WVS='uniform mat4 uTM;varying vec3 vW;varying vec2 vU;varying vec4 vR;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vU=uv;vR=uTM*vec4(position,1.);gl_Position=projectionMatrix*viewMatrix*w;}';
const WFS=`uniform samplerCube uEnv;uniform sampler2D uRefl;uniform sampler2D uNrm;uniform float uHasEnv;uniform float uHasRefl;uniform float uTime;uniform float uNight;uniform float uRound;
uniform vec3 uDeep;uniform vec3 uShal;uniform vec3 uSunDir;uniform vec3 uSunCol;uniform vec3 uFogC;uniform vec3 uSky;uniform float uFogN;uniform float uFogF;varying vec3 vW;varying vec2 vU;varying vec4 vR;
void main(){vec2 p=vW.xz;vec3 n1=texture2D(uNrm,p*.045+vec2(uTime*.011,uTime*.028)).xyz*2.-1.;vec3 n2=texture2D(uNrm,p*.12-vec2(uTime*.021,-uTime*.016)).xyz*2.-1.;vec3 n3=texture2D(uNrm,p*.014+vec2(0.,uTime*.006)).xyz*2.-1.;
 vec3 nt=n1+n2*.55+n3*.9;vec3 N=normalize(vec3(nt.x*.3,1.,nt.y*.3));vec3 V=normalize(cameraPosition-vW);float dist=length(cameraPosition-vW);
 float fr=.02+.98*pow(1.-max(dot(N,V),0.),5.);vec3 Rv=reflect(-V,N);Rv.y=abs(Rv.y);
 vec3 env=uHasEnv>.5?textureCube(uEnv,Rv).rgb:mix(uFogC,uSky,clamp(Rv.y*1.6,0.,1.));
 if(uHasRefl>.5){vec2 ruv=vR.xy/vR.w+N.xz*.035;env=mix(env,texture2D(uRefl,ruv).rgb,.92);}
 float e=uRound>.5?length(vU-.5)*2.:abs(vU.x-.5)*2.;vec3 body=mix(uDeep,uShal,smoothstep(.5,1.,e)*.65)*(.3+.7*(1.-uNight*.75));
 vec3 Hh=normalize(uSunDir+V);float nh=max(dot(N,Hh),0.);float sp=pow(nh,500.)*7.+pow(nh,70.)*.22;
 vec3 col=mix(body,env,clamp(fr*1.15+.06,0.,1.))+uSunCol*sp;
 float fm=smoothstep(.84,.99,e)*(.45+.55*sin(p.x*1.1+p.y*1.3+uTime*1.6+n1.x*4.));col=mix(col,vec3(.88,.93,.97)*(1.-uNight*.8),clamp(fm,0.,1.)*.5);
 col=mix(col,uFogC,smoothstep(uFogN,uFogF,dist));gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const WU={uEnv:{value:null},uRefl:{value:null},uNrm:{value:WNRM},uHasEnv:{value:0},uHasRefl:{value:0},uTime:GU.uTime,uNight:GU.uNight,uDeep:{value:new T.Color(0x0e3a52)},uShal:{value:new T.Color(0x2f7f8a)},uSunDir:{value:new T.Vector3(0,1,0)},uSunCol:{value:new T.Color(1,1,1)},uFogC:{value:new T.Color()},uSky:{value:new T.Color()},uFogN:{value:60},uFogF:{value:200}};
function waterMat(round){const u=Object.assign({},WU,{uTM:{value:new T.Matrix4()},uRound:{value:round?1:0},uHasRefl:{value:0},uRefl:{value:null}});return new T.ShaderMaterial({uniforms:u,vertexShader:WVS,fragmentShader:WFS})}
/* ---------- planar reflection for the river (HIGH/ULTRA) ---------- */
const RF={rt:null,cam:new T.PerspectiveCamera(),on:0,s:.4,pl:new T.Plane(),cp:new T.Vector4(),q:new T.Vector4(),v:new T.Vector3(),t:new T.Vector3(),l:new T.Vector3(),rm:new T.Matrix4(),n:new T.Vector3(0,1,0),wp:new T.Vector3()};
function reflRender(){if(!RF.on||!WATER||IN)return;if(CFG.gfx<3&&(RF.k=(RF.k||0)+1)%2)return;/* HIGH: refresh the reflection every other frame */const M=WATER,u=M.material.uniforms;M.updateMatrixWorld();RF.wp.setFromMatrixPosition(M.matrixWorld);const cp=cam.position;
 if(Math.abs(cp.x-80)>230||cp.y<RF.wp.y+.2){u.uHasRefl.value=0;return}RF.pm=RF.pm||new T.Matrix4();RF.fr=RF.fr||new T.Frustum();cam.updateMatrixWorld();RF.pm.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);RF.fr.setFromProjectionMatrix(RF.pm);RF.bb=RF.bb||new T.Box3(new T.Vector3(70.4,-.6,-350),new T.Vector3(89.6,-.4,350));if(!RF.fr.intersectsBox(RF.bb)){u.uHasRefl.value=0;return}
 const w=Math.round(innerWidth*RF.s*rd.getPixelRatio()),h=Math.round(innerHeight*RF.s*rd.getPixelRatio());if(RF.rt.width!==w||RF.rt.height!==h)RF.rt.setSize(w,h);
 const n=RF.n,v=RF.v.subVectors(RF.wp,cp);v.reflect(n).negate();v.add(RF.wp);RF.rm.extractRotation(cam.matrixWorld);RF.l.set(0,0,-1).applyMatrix4(RF.rm).add(cp);
 const t=RF.t.subVectors(RF.wp,RF.l);t.reflect(n).negate();t.add(RF.wp);const vc=RF.cam;vc.position.copy(v);vc.up.set(0,1,0).applyMatrix4(RF.rm).reflect(n);vc.lookAt(t);vc.far=cam.far;vc.updateMatrixWorld();vc.projectionMatrix.copy(cam.projectionMatrix);
 const tm=u.uTM.value;tm.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);tm.multiply(vc.projectionMatrix);tm.multiply(vc.matrixWorldInverse);tm.multiply(M.matrixWorld);
 RF.pl.setFromNormalAndCoplanarPoint(n,RF.wp);RF.pl.applyMatrix4(vc.matrixWorldInverse);const c=RF.cp.set(RF.pl.normal.x,RF.pl.normal.y,RF.pl.normal.z,RF.pl.constant),pm=vc.projectionMatrix,q=RF.q;
 q.x=(Math.sign(c.x)+pm.elements[8])/pm.elements[0];q.y=(Math.sign(c.y)+pm.elements[9])/pm.elements[5];q.z=-1;q.w=(1+pm.elements[10])/pm.elements[14];c.multiplyScalar(2/c.dot(q));pm.elements[2]=c.x;pm.elements[6]=c.y;pm.elements[10]=c.z+1-.003;pm.elements[14]=c.w;
 M.visible=false;const su=rd.shadowMap.autoUpdate;rd.shadowMap.autoUpdate=false;const ot=rd.getRenderTarget();if(DOME)DOME.position.copy(vc.position);rd.setRenderTarget(RF.rt);rd.clear();rd.render(sc,vc);rd.setRenderTarget(ot);rd.shadowMap.autoUpdate=su;M.visible=true;if(DOME)DOME.position.copy(cam.position);
 u.uRefl.value=RF.rt.texture;u.uHasRefl.value=1}
/* ---------- environment (IBL) capture ---------- */
const ENV={cube:null,cc:null,pm:null,rt:null,t:-1e9,tod:-1,res:0};
function envSetup(res){if(ENV.cube){sc.remove(ENV.cc);ENV.cube.dispose();ENV.cube=null}if(!res){sc.environment=null;WU.uHasEnv.value=0;return}ENV.res=res;ENV.cube=new T.WebGLCubeRenderTarget(res,{generateMipmaps:true,minFilter:T.LinearMipmapLinearFilter,type:T.HalfFloatType});ENV.cc=new T.CubeCamera(1,350,ENV.cube);sc.add(ENV.cc);ENV.pm=ENV.pm||new T.PMREMGenerator(rd);ENV.t=-1e9}
function envUpdate(){if(!ENV.cube||!started)return;const now=performance.now(),iv=CFG.gfx>=3?5000:CFG.gfx>=2?8000:12000;if(now-ENV.t<iv&&Math.abs(tod-ENV.tod)<.015&&ENV.in===IN)return;ENV.t=now;ENV.tod=tod;ENV.in=IN;
 const c=ENV.cc,src=IN?cam.position:(P.car||P);c.position.set(src.x,IN?2:Math.max(6,(P.y||0)+6),src.z);const su=rd.shadowMap.autoUpdate;rd.shadowMap.autoUpdate=false;const pv=P.g.visible;P.g.visible=false;if(WATER)WATER.visible=false;if(DOME)DOME.position.copy(c.position);if(GLOWS)GLOWS.visible=false;
 WU.uEnv.value=null;c.update(rd,sc);rd.shadowMap.autoUpdate=su;P.g.visible=pv;if(WATER)WATER.visible=true;if(GLOWS)GLOWS.visible=true;if(DOME)DOME.position.copy(cam.position);
 const old=ENV.rt;ENV.rt=ENV.pm.fromCubemap(ENV.cube.texture);sc.environment=ENV.rt.texture;if(old)old.dispose();WU.uEnv.value=ENV.cube.texture;WU.uHasEnv.value=1}
/* ---------- static batching: merge thousands of static meshes into a few chunked draw calls ---------- */
let MERGED=0;
function mergeStatic(){if(MERGED)return;MERGED=1;const t0=performance.now();const made=[];try{sc.updateMatrixWorld(true);
 if(!NEON.some(o=>o.m===NEONM))NEON.push({m:NEONM,b:new T.Color(1,1,1)});
 const ex=new Set([ground,WATER]);for(const m of MK)ex.add(m);for(const s of SIGS){ex.add(s.r);ex.add(s.g)}for(const p of PP)ex.add(p.m);for(const d of DC)ex.add(d);
 const cand=[];for(const o of sc.children){if(o.isMesh)cand.push(o);else if(o.isGroup&&o.userData.stat)o.traverse(c=>{if(c.isMesh)cand.push(c)})}
 const bk=new Map(),used=[],wp=new T.Vector3(),okM=m=>m&&!m.isShaderMaterial&&!m.isPointsMaterial&&!m.isSpriteMaterial&&(m.isMeshStandardMaterial||m.isMeshLambertMaterial||m.isMeshBasicMaterial||m.isMeshPhongMaterial);
 for(const o of cand){if(ex.has(o)||!o.visible||o.userData.dyn||o.isSkinnedMesh||o.isInstancedMesh)continue;const ms=o.material,g=o.geometry;if(!g||!g.attributes||!g.attributes.position)continue;const arr=Array.isArray(ms);if(arr&&!g.groups.length)continue;
  const parts=arr?g.groups.map(gr=>({m:ms[gr.materialIndex],s:gr.start,n:gr.count})):[{m:ms,s:0,n:null}];if(!parts.every(p=>okM(p.m)))continue;
  o.getWorldPosition(wp);const ck=Math.floor(wp.x/72)+','+Math.floor(wp.z/72);
  for(const p of parts){let tm=p.m,col=null;if(tm.userData.plain){col=tm.color.clone();tm=PLAINM}else if(NEONB.has(tm)){col=NEONB.get(tm);tm=NEONM}
   const key=tm.uuid+'|'+ck+'|'+(o.castShadow?1:0);let b=bk.get(key);if(!b){b={m:tm,items:[],cast:o.castShadow};bk.set(key,b)}b.items.push({g,mx:o.matrixWorld,col,s:p.s,n:p.n})}
  used.push(o)}
 for(const b of bk.values()){const m=new T.Mesh(mergeGeos(b.items),b.m);m.castShadow=b.cast;m.receiveShadow=!b.m.isMeshBasicMaterial;m.matrixAutoUpdate=false;m.updateMatrix();made.push(m)}
 for(const o of used)o.parent.remove(o);for(const m of made)sc.add(m);console.log('static merge: '+used.length+' meshes -> '+made.length+' batches in '+(performance.now()-t0|0)+'ms')}
 catch(e){console.log('merge failed',e);for(const m of made)sc.remove(m)}}
const NEONB=new Map();
/* ---------- ground surfaces: asphalt w/ baked markings + puddles, paving, grass ---------- */
function surfTex(W,H,fn,str){const A=document.createElement('canvas'),M=document.createElement('canvas');A.width=M.width=W;A.height=M.height=H;const a=A.getContext('2d'),m=M.getContext('2d'),ia=a.createImageData(W,H),im=m.createImageData(W,H),hg=new Float32Array(W*H),o={};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){fn(x,y,o);const i=(y*W+x)*4;ia.data[i]=o.r;ia.data[i+1]=o.g;ia.data[i+2]=o.b;ia.data[i+3]=255;im.data[i]=0;im.data[i+1]=o.ro*255;im.data[i+2]=(o.me||0)*255;im.data[i+3]=255;hg[y*W+x]=o.h}
 a.putImageData(ia,0,0);m.putImageData(im,0,0);const mk=c=>{const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=ANI;return t};return{map:mk(A),rm:mk(M),nrm:nrmTex(hg,W,H,str),a,A}}
const ASPH=surfTex(256,512,(x,y,o)=>{const n=nz(x*1.6,y*1.6),s=nz(x*7+90,y*7+31),wet=smooth(.66,.74,nz(x*.45+200,y*.45+60)),tr=Math.max(0,1-Math.abs(((x+64)%128)-64)/14)*.5;
 let v=40+n*18+(s>.64?14:0)-(s<.28?9:0)-tr*7;v*=1-wet*.3;o.r=v;o.g=v;o.b=v*1.04+2;o.ro=Math.max(.3,.9-wet*.55-tr*.06);o.h=s*.5+n*.5-wet*.3;
 const ln=(c,w)=>Math.abs(x-c)<w,worn=nz(x*5+7,y*3)>.3;
 if((ln(123,2.6)||ln(133,2.6))&&worn){o.r=224;o.g=186;o.b=64;o.ro=.5;o.h=.95}else if((ln(11,2.4)||ln(245,2.4))&&worn&&(y%96)<80){o.r=o.g=o.b=222;o.ro=.5;o.h=.95}},2.2);
(()=>{const g=ASPH.a;g.strokeStyle='rgba(10,10,12,.55)';for(let k=0;k<14;k++){g.lineWidth=rr(.6,1.6);g.beginPath();let x=rr(20,236),y=rr(0,512);g.moveTo(x,y);for(let j=0;j<8;j++){x+=rr(-9,9);y+=rr(-14,14);g.lineTo(x,y)}g.stroke()}
 for(let k=0;k<5;k++){g.fillStyle='rgba(15,15,18,.35)';g.beginPath();g.ellipse(rr(30,226),rr(0,512),rr(6,22),rr(4,14),rr(0,3),0,7);g.fill()}ASPH.map.needsUpdate=true})();
let ROADMAT=null;function roadMat(){if(ROADMAT)return ROADMAT;ROADMAT=STD({color:0xffffff,map:ASPH.map,roughnessMap:LOWM?null:ASPH.rm,normalMap:LOWM?null:ASPH.nrm,roughness:1,metalness:0,envMapIntensity:.75});if(ROADMAT.normalScale)ROADMAT.normalScale.set(.45,.45);ROADM.push(ROADMAT);return ROADMAT}
const PAVT=surfTex(256,256,(x,y,o)=>{const px=x%64,py=y%64,gr=px<3||py<3,id=((x/64)|0)+((y/64)|0)*4,n=nz(x*2,y*2),tone=ph(id,1,2)*16-8,st=nz(x*.7+40,y*.7)>.7?-14:0,gum=ph(x>>2,y>>2,8)>.997?-40:0;
 const v=gr?78:128+tone+n*14+st+gum;o.r=v;o.g=v-3;o.b=v-9;o.ro=gr?.95:.82-n*.1;o.h=gr?0:.8+n*.2},2.5);
const PADM=STD({color:0xffffff,map:PAVT.map,roughnessMap:LOWM?null:PAVT.rm,normalMap:LOWM?null:PAVT.nrm,roughness:1});PAVT.map.repeat.set(14,14);
const GRT=surfTex(256,256,(x,y,o)=>{const n=nz(x*2,y*2),b=nz(x*9+70,y*2.2+11),v=.72+n*.25+(b>.62?.12:0)-(b<.3?.08:0);o.r=v*200;o.g=v*230;o.b=v*170;o.ro=.95;o.h=b},1.6);
const GRASSM=STD({color:0x6fb455,map:GRT.map,normalMap:LOWM?null:GRT.nrm,roughness:.95});GRT.map.repeat.set(10,10);
const GRASSD=(()=>{const t=surfTex(256,256,(x,y,o)=>{const n=nz(x*1.5,y*1.5),b=nz(x*8+13,y*8+77),v=.8+n*.2+(b>.66?.1:0)-(b<.26?.09:0);o.r=o.g=o.b=v*255;o.ro=.95;o.h=b},1).map;t.repeat.set(170,170);return t})();
function curbs(){for(const k in PADS){const p=PADS[k];if(!p.parent)continue;const[cx,cz]=k.split(',').map(Number);for(const s of[-1,1]){bx(28.2,.16,.32,0xc9c5bc,cx,.08,cz+s*13.95,sc);bx(.32,.16,28.2,0xc9c5bc,cx+s*13.95,.08,cz,sc)}}}
const LPG=new T.CylinderGeometry(.08,.12,5,7);

/* ---------- interior ceilings (face down only: invisible to the overhead gameplay camera, solid in cutscenes) ---------- */
const CEILM=new T.MeshBasicMaterial({color:0xfff1d6});
function ceilings(){const cl=(x,z,w,d,y,c)=>{const m=new T.Mesh(new T.PlaneGeometry(w,d),mat(c));m.rotation.x=PI/2;m.position.set(x,y,z);m.castShadow=true;sc.add(m)},lp=(x,z,y,w,d)=>{const m=new T.Mesh(new T.PlaneGeometry(w||1.3,d||1.3),CEILM);m.rotation.x=PI/2;m.position.set(x,y-.02,z);sc.add(m)};
 cl(OX,OZ,24.4,19.4,3.5,0xefebe2);for(const[x,z]of[[-8,-4],[-8,6],[3,3],[8,-5]])lp(OX+x,OZ+z,3.5);
 for(const st of STORES){if(st.kind=='casino'){cl(st.ox,st.oz,28.4,21.4,4.5,0x1a0c24);for(const x of[-9,0,9])for(const z of[-6,0,6])lp(st.ox+x,st.oz+z,4.5,.8,.8)}else{cl(st.ox,st.oz,16.4,13.4,3.5,0xeceae4);for(const x of[-4,4])for(const z of[-3,2])lp(st.ox+x,st.oz+z,3.5,2.4,.5)}}
 }
