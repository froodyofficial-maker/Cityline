/* ================= v9: STORY MODE ENGINE — missions, cinematics, AI, saves ================= */
const ST={on:0,m:0,max:0,act:null,flags:{},games:0,ending:'',fail:0,pass:0,menu:0};
const ENM=[],SAYQ=[],PKS=[],NPC={};let CIN=null,SAYT=0,STOBJ='',STBAR='';
const SKEY='embercity_story_v1';
const SPK={NICO:'#ff9a4a',MARA:'#3fd6c4',DEX:'#5aa8ff',LENA:'#ff5f93',VICTOR:'#ffd23f',MA:'#c890ff',BRICK:'#c8c8c8',HARLAN:'#8fb0ff',SAL:'#c8c8c8',THUG:'#c8c8c8',RADIO:'#9ad0ff',PILOT:'#c8c8c8',COURIER:'#c8c8c8',NEWS:'#9ad0ff',IMANI:'#ffb0e0'};
const SNAME={MA:'MA DELACROIX',VICTOR:'VICTOR CALLOWAY',LENA:'DET. LENA CRUZ',HARLAN:'CAPT. HARLAN'};
function stSave(){try{localStorage.setItem(SKEY,JSON.stringify({m:ST.m,max:Math.max(ST.max,ST.m),flags:ST.flags,cash,own,ammo,ending:ST.ending}))}catch(e){}}
function stLoad(){try{return JSON.parse(localStorage.getItem(SKEY)||'null')}catch(e){return null}}
const lerpA=(a,b,k)=>{let d=b-a;d=Math.atan2(sin(d),cos(d));return a+d*Math.min(1,k)};
/* ---------- UI helpers ---------- */
function objSet(t){if(t===STOBJ)return;STOBJ=t;const o=$('obj');o.innerHTML=t?t.replace(/\*([^*]+)\*/g,'<b>$1</b>'):'';o.style.display=t?'block':'none'}
function sbarSet(h){if(h===STBAR)return;STBAR=h;const o=$('sbar');o.innerHTML=h;o.style.display=h?'flex':'none'}
const mmss=t=>{t=Math.max(0,Math.ceil(t));return (t/60|0)+':'+String(t%60).padStart(2,'0')};
const barH=(lab,v,col)=>'<span>'+lab+'</span><div class="sb2"><i style="width:'+Math.max(0,Math.min(100,v*100))+'%;background:'+col+'"></i></div>';
function subShow(who,txt){const c=$('csub');if(!txt){c.style.opacity=0;return}c.innerHTML=(who?'<b style="color:'+(SPK[who]||'#fff')+'">'+(SNAME[who]||who)+'</b>':'')+'<span>'+txt+'</span>';c.style.opacity=1}
function say(lines){for(const l of lines)SAYQ.push(l)}
function lineDur(l){return l[2]||Math.max(2.4,Math.min(9,1.5+l[1].length*.055))}
function sayU(dt){if(CIN)return;if(!SAYQ.length){if(SAYT>-1){SAYT=-1;subShow()}return}if(SAYT<0)SAYT=0;const l=SAYQ[0];SAYT+=dt;if(SAYT>=lineDur(l)){SAYQ.shift();SAYT=0;if(!SAYQ.length){subShow();SAYT=-1;return}}const c=SAYQ[0];subShow(c[0],c[1])}
function titleCard(big,small,dur){const t=$('mt');t.innerHTML='<small>'+(small||'')+'</small>'+big;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');clearTimeout(titleCard.h);titleCard.h=setTimeout(()=>t.classList.remove('show'),(dur||4)*1000)}
function fadeTo(v,s){const f=$('fade');f.style.transition='opacity '+(s||.6)+'s';f.style.opacity=v}
/* ---------- beacon + mission markers ---------- */
const BEA=(()=>{const g=new T.Group(),bm=new T.Mesh(new T.CylinderGeometry(1.2,1.2,70,24,1,true),new T.MeshBasicMaterial({color:0xffd23f,transparent:true,opacity:.16,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false}));bm.position.y=35;g.add(bm);
 const rg=new T.Mesh(new T.TorusGeometry(1.7,.11,8,48),new T.MeshBasicMaterial({color:0xffd23f}));rg.rotation.x=PI/2;rg.position.y=.3;g.add(rg);g.visible=false;sc.add(g);g.bm=bm;g.rg=rg;return g})();
let BEAT=null;
function beacon(x,z,r,col){BEAT={x,z,r:r||3,col:col||0xffd23f,obj:null};BEA.visible=true;BEA.position.set(x,0,z);BEA.rg.scale.setScalar((r||3)/1.7);BEA.bm.scale.set(1,1,1);BEA.bm.material.color.setHex(BEAT.col);BEA.rg.material.color.setHex(BEAT.col)}
function beaconObj(o,col){BEAT={obj:o,col:col||0x37e6ff};BEA.visible=true;BEA.rg.scale.setScalar(.8);BEA.bm.scale.set(.35,1,.35);BEA.bm.material.color.setHex(BEAT.col);BEA.rg.material.color.setHex(BEAT.col)}
function beaconOff(){BEAT=null;BEA.visible=false}
function beaconU(){if(!BEAT)return;const o=BEAT.obj;if(o){if(o.dead||o.hp<=0&&!o.isVeh){BEA.visible=false;return}BEA.visible=true;BEA.position.set(o.x,(o.y||0)+(o.isVeh?2.4:2.6),o.z)}BEA.rg.position.y=.3+sin(performance.now()/260)*.12}
const SMK=(()=>{const g=new T.Group(),bm=new T.Mesh(new T.CylinderGeometry(.9,.9,46,20,1,true),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.2,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false}));bm.position.y=23;g.add(bm);
 const cv=document.createElement('canvas');cv.width=cv.height=128;const tx=new T.CanvasTexture(cv),sp=new T.Sprite(new T.SpriteMaterial({map:tx,depthTest:false,fog:false}));sp.scale.set(2.2,2.2,1);sp.position.y=3;sp.renderOrder=5;g.add(sp);
 const rg=new T.Mesh(new T.TorusGeometry(1.5,.12,8,40),new T.MeshBasicMaterial({color:0xffffff}));rg.rotation.x=PI/2;rg.position.y=.25;g.add(rg);g.visible=false;sc.add(g);g.bm=bm;g.sp=sp;g.rg=rg;g.cv=cv;g.tx=tx;return g})();
function smkSet(D){if(!D){SMK.visible=false;return}const c=SMK.cv.getContext('2d'),col=D.col||'#ffd23f';c.clearRect(0,0,128,128);c.fillStyle='#0b0612';c.beginPath();c.arc(64,64,58,0,7);c.fill();c.lineWidth=8;c.strokeStyle=col;c.stroke();c.fillStyle=col;c.font='bold '+(D.L.length>1?46:64)+'px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(D.L,64,68);SMK.tx.needsUpdate=true;
 SMK.position.set(D.at[0],0,D.at[1]);SMK.bm.material.color.set(col);SMK.rg.material.color.set(col);SMK.visible=true}
/* ---------- minimap blips ---------- */
function mmPt(x,z,big,c){if(big)return[MX(x),MX(z),0];let dx=(MX(x)-MX(c.x))*1.8,dz=(MX(z)-MX(c.z))*1.8;const a=camYaw-PI,rx=dx*cos(a)-dz*sin(a),ry=dx*sin(a)+dz*cos(a),l=Math.hypot(rx,ry),e=l>70;return e?[80+rx/l*70,80+ry/l*70,1]:[80+rx,80+ry,0]}
function storyMM(big,c){if(!ST.on||IN)return;const dot=(x,z,col,lab,r)=>{const p=mmPt(x,z,big,c);mg.fillStyle=col;mg.strokeStyle='#000';mg.lineWidth=2;mg.beginPath();mg.arc(p[0],p[1],r||(lab?6:4),0,7);mg.fill();mg.stroke();if(lab){mg.fillStyle='#000';mg.font='bold 8px Arial';mg.textAlign='center';mg.fillText(lab,p[0],p[1]+3)}};
 if(SMK.visible&&!ST.act){const D=MIS[ST.m];if(D)dot(D.at[0],D.at[1],D.col||'#ffd23f',D.L,7)}
 if(BEAT){if(BEAT.obj){if(!BEAT.obj.dead)dot(BEAT.obj.x,BEAT.obj.z,'#'+new T.Color(BEAT.col).getHexString())}else dot(BEAT.x,BEAT.z,'#ffd23f')}
 for(const e of ENM)if(!e.dead&&!e.hideBlip)dot(e.x,e.z,'#ff3b3b',null,e.isVeh?4:2.5);
 if(ST.act)for(const a of ST.act.al)if(!a.hidden&&!a.inCar)dot(a.x,a.z,'#37e6ff',null,3)}
/* ---------- NPC actors (used by cutscenes and as allies) ---------- */
const LOOK={MA:['#6b3f22','#7a3a8a','#4a3a5a','#eeeeee',0,2,.94],MARA:['#e0ac69','#3fb8af','#3a3a4a','#4a2f1b',0,1],DEX:['#8d5524','#2b6fd0','#2b4a7a','#111111',0,0],LENA:['#c68642','#24272e','#2b2f3a','#1a1010',1,1],VICTOR:['#f1c7a0','#f2f0ea','#e8e6e0','#b8b8b8',0,0],
 BRICK:['#8d5524','#2e2e33','#1f1f24','#8d5524',1,0,1.28],HARLAN:['#f1c7a0','#1d3b8a','#14234a','#8a8a8a',1,0],SAL:['#e0ac69','#2a2a2e','#1f1f24','#3a2a1a',1,0],ORTEGA:['#c68642','#6a7a4a','#3a3a2a','#222',0,0],COURIER:['#e0ac69','#3a3a44','#222','#111',0,0],
 IMANI:['#8d5524','#ff6aa8','#3a3a4a','#111',0,1,.78]};
function npc(n){if(n=='NICO')return PN;if(NPC[n])return NPC[n];let g;{const L=LOOK[n]||['#e0ac69','#222','#222','#111',1,0];g=person(L[0],L[1],L[2],L[3],L[4],L[5]);if(L[6])g.scale.setScalar(L[6])}
 const a={name:n,g,x:0,z:0,h:0,y:0,to:null,sp:1.6,anim:'idle',ph:R()*6,face:null,hp:100,maxhp:100};g.visible=false;NPC[n]=a;return a}
const PN={name:'NICO',get g(){return P.g},get x(){return P.x},set x(v){P.x=v},get z(){return P.z},set z(v){P.z=v},get h(){return P.h},set h(v){P.h=v},y:0,to:null,sp:1.6,anim:'idle',ph:0,face:null,hp:100};
function place(n,x,z,h,an){const a=npc(n);a.x=x;a.z=z;a.h=h||0;a.to=null;a.path=null;a.toH=null;a.y=0;a.anim=an||'idle';a.face=null;a.hidden=0;a.inCar=null;a.g.visible=true;a.g.rotation.set(0,a.h,0);if(n=='NICO'){P.car=null;P.y=0;P.dead=0;P.g.visible=true;P.g.position.set(x,0,z)}return a}
function walk(n,x,z,sp,h){const a=npc(n);a.to=[x,z];a.sp=sp||1.6;a.toH=h;return a}
function anim(n,an){npc(n).anim=an}
function face(n,t){npc(n).face=t}
function hideN(n){const a=NPC[n];if(a){a.g.visible=false;a.hidden=1;a.to=null}}
function hideAll(){for(const k in NPC)hideN(k)}
function npcAnim(a,dt,talk){const g=a.g;if(!g)return;let mv=0;a.ph+=dt;
 if(a.to){const dx=a.to[0]-a.x,dz=a.to[1]-a.z,d=Math.hypot(dx,dz);if(d>.06){const s=Math.min(d,a.sp*dt);a.x+=dx/d*s;a.z+=dz/d*s;a.h=lerpA(a.h,Math.atan2(dx,dz),dt*10);mv=1;a.wph=(a.wph||0)+dt*a.sp*2.4}else{a.to=null;if(a.path&&a.path.length)a.to=a.path.shift();else if(a.toH!==undefined&&a.toH!==null)a.h=a.toH}}
 if(!mv&&a.face){const f=typeof a.face=='string'?npc(a.face):a.face;if(f&&f!==a)a.h=lerpA(a.h,Math.atan2(f.x-a.x,f.z-a.z),dt*5)}
 const t=a.ph;let yo=a.y||0,rx=0;

 const L=g.l,A=g.a;let l0=0,l1=0,a0=0,a1=0,z0=0,z1=0,hdx=0;
 if(mv){const s=sin(a.wph)*.8;l0=s;l1=-s;a0=-s*.7;a1=s*.7}
 else switch(a.anim){case'gun':a1=-1.5;a0=-.2;break;case'hands':a0=a1=-2.9;break;case'hug':a0=a1=-1.35;z0=.55;z1=-.55;break;case'sit':l0=l1=-1.5;yo+=(a.seat!==undefined?a.seat:.52)-.45;a0=a1=-.35;break;
  case'lie':case'dead':rx=-PI/2;yo+=.18;break;case'kneel':l0=-1.55;l1=.1;yo-=.32;a0=a1=-.5;break;case'cross':a0=a1=-1.15;z0=.95;z1=-.95;break;case'phone':a1=-2.65;z1=-.45;break;
  case'point':a1=-1.55;break;case'hurt':rx=.22;a0=-.7;z0=.4;hdx=.3;break;case'cry':a0=a1=-2.3;z0=.45;z1=-.45;hdx=.45;break;case'down':hdx=.35;a0=a1=.1;break;case'work':a0=-1.1+sin(t*6)*.2;a1=-1.2-sin(t*6)*.2;rx=.35;break;
  case'lean':rx=-.08;a0=a1=-.2;z0=.25;z1=-.25;break}
 if(talk&&!mv&&!/gun|hands|lie|dead|phone|hug|cry/.test(a.anim)){a1=Math.min(a1,-.45-.4*Math.abs(sin(t*3.3)));z1=-.18;a0=Math.min(a0,-.15-.25*Math.abs(sin(t*2.6+1)))}
 L[0].rotation.x=l0;L[1].rotation.x=l1;A[0].rotation.x=a0;A[1].rotation.x=a1;A[0].rotation.z=z0;A[1].rotation.z=z1;
 g.rotation.set(rx,a.h,0);g.position.set(a.x,yo+(!mv&&!rx?sin(t*1.9)*.008:0),a.z);if(g.hd&&g.hd[0].rotation){const hb=talk?sin(t*4.1)*.05:0;g.hd[0].rotation.x=g.hd[1].rotation.x=hdx+hb}}
/* ---------- cinematic engine ---------- */
function cinPlay(shots,done,instant){CIN={shots,i:-1,st:0,li:0,lt:0,done,tm:0,ev:{},fov:50};if(instant){cinEnd(1);return}
 for(const k in K)K[k]=0;heat=0;for(const c of cops)sc.remove(c.g);cops.length=0;$('sir').style.opacity=0;document.body.classList.add('cin');objSet('');SAYQ.length=0;subShow();cut={t:0,dur:1e9,fn:cinFn,lines:[],done:()=>cinEnd(0)};document.body.classList.add('on');txt('pr','');$('lk').style.display='none';cinShot(0)}
function snapA(a){if(!a.to)return;const t=a.path&&a.path.length?a.path[a.path.length-1]:a.to;a.x=t[0];a.z=t[1];a.to=null;a.path=null;if(a.toH!==undefined&&a.toH!==null)a.h=a.toH}
function cinShot(i){const C=CIN;C.i=i;C.st=0;C.li=0;C.lt=0;C.evf={};const s=C.shots[i];if(!s)return;s._oc=undefined;if(i>0&&!s.keep){for(const n in NPC)snapA(NPC[n]);snapA(PN)}if(s.tod!==undefined)tod=s.tod;if(s.on)s.on();if(s.fade!==undefined)fadeTo(s.fade,s.fs);if(s.title)titleCard(s.title[0],s.title[1],s.title[2]);
 s._d=s.d||((s.l||[]).reduce((a,l)=>a+lineDur(l),0)+(s.pad||.4));C.fov=s.fov||50;if(s.sfx)s.sfx()}
function cinFn(p,t){const C=CIN;if(!C)return;let dt=Math.min(.1,t-C.tm);C.tm=t;if(dt<0)dt=0;const s=C.shots[C.i];if(!s){cut.t=cut.dur;return}
 C.st+=dt;C.lt+=dt;const L=s.l||[];if(C.li<L.length&&C.lt>=lineDur(L[C.li])){C.li++;C.lt=0}
 if(s.ev)for(let k=0;k<s.ev.length;k++)if(!C.evf[k]&&C.st>=s.ev[k][0]){C.evf[k]=1;s.ev[k][1]()}
 const cl=L[Math.min(C.li,L.length-1)],talkWho=C.li<L.length&&cl?cl[0]:null;if(C.li<L.length&&cl)subShow(cl[0],cl[1]);else subShow();
 for(const n in NPC){const a=NPC[n];if(!a.hidden&&a.g.visible)npcAnim(a,dt,talkWho==n)}npcAnim(PN,dt,talkWho=='NICO');P.g.position.set(P.x,P.g.position.y,P.z);
 cinCam(s,Math.min(1,C.st/s._d),dt);
 if(C.st>=s._d&&C.li>=L.length){if(s.post&&!s._pd){s._pd=1;s.post()}if(C.i+1<C.shots.length)cinShot(C.i+1);else cut.t=cut.dur}}

function hOff(a){return a.anim=='sit'?(a.seat!==undefined?a.seat:.52)-.45:a.anim=='kneel'?-.32:a.anim=='lie'||a.anim=='dead'?-1.1:0}
function npos(n,dy){const a=npc(n);return[a.x,(a.y||0)+hOff(a)+(dy===undefined?1.5:dy)*(a.g&&a.g.scale?a.g.scale.y:1),a.z]}
function cinCam(s,k,dt){const e=k*k*(3-2*k),c=s.c;let p,l;
 if(s.ots){const A=npc(s.ots[0]),B=npc(s.ots[1]),dx=B.x-A.x,dz=B.z-A.z,d=Math.hypot(dx,dz)||1,ux=dx/d,uz=dz/d,sd=s.ots[2]||1;p=[A.x-ux*1.5+uz*.7*sd,(A.y||0)+hOff(A)+1.85,A.z-uz*1.5-ux*.7*sd];const bp=npos(s.ots[1],1.45);l=bp;p[0]+=ux*e*.25;p[2]+=uz*e*.25}
 else if(s.two){const A=npc(s.two[0]),B=npc(s.two[1]),mx=(A.x+B.x)/2,mz=(A.z+B.z)/2,dx=B.x-A.x,dz=B.z-A.z,d=Math.hypot(dx,dz)||1,D=s.two[2]||4.6,sd=s.two[3]||1;const my=((A.y||0)+(B.y||0))/2+(hOff(A)+hOff(B))/2;p=[mx+dz/d*D*sd-dx/d*e*.6,my+1.7,mz-dx/d*D*sd-dz/d*e*.6];l=[mx,my+1.35,mz]}
 else if(s.cu){const A=npc(s.cu[0]),D=s.cu[1]||1.7,sd=s.cu[2]||.35,hs=A.g&&A.g.scale?A.g.scale.y:1;const ho=(A.y||0)+hOff(A);p=[A.x+sin(A.h)*D+cos(A.h)*sd,ho+1.55*hs-.05+e*.04,A.z+cos(A.h)*D-sin(A.h)*sd];l=[A.x,ho+1.42*hs,A.z]}
 else if(s.fol){const A=npc(s.fol[0]);p=[A.x+s.fol[1],(A.y||0)+s.fol[2],A.z+s.fol[3]];l=[A.x,(A.y||0)+(s.fol[4]||1.2),A.z]}
 else if(s.orb){const o=s.orb,a=o[5]+(o[6]-o[5])*e;p=[o[0]+sin(a)*o[3],o[1]+o[4],o[2]+cos(a)*o[3]];l=[o[0],o[1]+(o[7]||1.2),o[2]]}
 else if(c){const c2=s.c2||c;p=[c[0]+(c2[0]-c[0])*e,c[1]+(c2[1]-c[1])*e,c[2]+(c2[2]-c[2])*e];l=[c[3]+(c2[3]-c[3])*e,c[4]+(c2[4]-c[4])*e,c[5]+(c2[5]-c[5])*e]}
 if(!p)return;if(!c||s.clip){camFree(p,l);if(s._oc===undefined)s._oc=camOcc(p,l);if(s._oc<1)for(let i=0;i<3;i++)p[i]=l[i]+(p[i]-l[i])*s._oc}cam.position.set(p[0],p[1],p[2]);if(s.shake){cam.position.x+=rr(-1,1)*s.shake;cam.position.y+=rr(-1,1)*s.shake}cam.lookAt(l[0],l[1],l[2])}
/* line of sight from subject to camera: if furniture, a car or a pole is in the way, pull the camera in front of it (computed once per shot) */
const OCR=new T.Raycaster(),OCO=new T.Vector3(),OCD=new T.Vector3();
function camOcc(p,l){OCO.set(l[0],l[1],l[2]);OCD.set(p[0]-l[0],p[1]-l[1],p[2]-l[2]);const d=OCD.length();if(d<.9)return 1;OCD.divideScalar(d);OCR.set(OCO,OCD);OCR.near=.35;OCR.far=d;
 const skip=new Set([P.g,DOME,WATER,GLOWS,RAIN]);for(const n in NPC)skip.add(NPC[n].g);if(PN&&PN.g)skip.add(PN.g);const list=sc.children.filter(o=>o.visible&&!skip.has(o)&&!o.isLight&&!o.isCamera);
 for(const h of OCR.intersectObjects(list,true)){const o=h.object,m=Array.isArray(o.material)?o.material[0]:o.material;if(!o.isMesh||!m||!m.visible||m.transparent&&m.opacity<.6)continue;
  let v=true;for(let q=o;q;q=q.parent)if(!q.visible){v=false;break}if(!v)continue;return Math.max(.75/d,(h.distance-.3)/d)}return 1}
function camIn(x,z,y){const L=IN?IB:bNear(x-.3,z-.3,x+.3,z+.3);for(const b of L)if(!b.air&&!b.over&&(b.h===undefined||y<b.h+.25)&&x>b.x1-.28&&x<b.x2+.28&&z>b.z1-.28&&z<b.z2+.28)return 1;return 0}
function camFree(p,l){let k=0;while(k<45&&camIn(p[0],p[2],p[1])){p[0]+=(l[0]-p[0])*.06;p[1]+=(l[1]-p[1])*.06;p[2]+=(l[2]-p[2])*.06;k++}}
function cinNext(){const C=CIN;if(!C||!cut)return;const s=C.shots[C.i];if(!s)return;const L=s.l||[];if(C.li<L.length){C.li++;C.lt=0;if(C.li>=L.length)C.st=Math.max(C.st,s._d)}else C.st=s._d}
function cinEnd(instant){const C=CIN;if(!C)return;for(let i=Math.max(0,C.i);i<C.shots.length;i++){const s=C.shots[i];if(i>C.i){if(s.tod!==undefined)tod=s.tod;if(s.on)s.on()}if(s.post&&!s._pd){s._pd=1;s.post()}}PN.anim='idle';PN.y=0;P.g.rotation.set(0,P.h,0);for(const l of P.g.l)l.rotation.x=0;for(const a of P.g.a){a.rotation.x=0;a.rotation.z=0}if(P.g.hd[0].rotation)P.g.hd[0].rotation.x=P.g.hd[1].rotation.x=0;
 for(const n in NPC){const a=NPC[n];if(!a.hidden&&a.g.visible)npcAnim(a,0,0)}subShow();document.body.classList.remove('cin');fadeTo(0,.5);const d=C.done;CIN=null;if(!instant)cam.position.set(P.x-sin(camYaw)*7.7,(P.y||0)+5.1,P.z-cos(camYaw)*7.7);d&&d()}
/* ---------- enemies ---------- */
const SUITS=[['#1b1b20','#18181c'],['#2a2a30','#1a1a1e'],['#3a1b1b','#18181c']];
function lootDrop(x,z){const r=R();if(r<.24)pickup(x,z,'',{auto:1,r:1.7,col:0xe8222c,onPick:()=>{P.hp=Math.min(100,P.hp+30);msg('+30 HEALTH','#43ff7a')}});else if(r<.46)pickup(x,z,'',{auto:1,r:1.7,col:0x3a5a2a,onPick:()=>{const w=WP[cw];ammo[cw]+=Math.ceil(w.pk*.6);lastHot='';msg('+'+Math.ceil(w.pk*.6)+' '+w.n+' AMMO','#43ff7a')}})}
function thug(x,z,o){o=o||{};const s=ri(SUITS),g=person(ri(skins),o.shirt||s[0],o.pants||s[1],ri(['#111','#2a1a10','#3a2a1a']),1);if(o.big)g.scale.setScalar(1.25);
 const e={g,x,z,h:0,hp:o.hp||(o.big?7:3),dead:0,enm:1,cd:rr(.6,1.6),ph:R()*6,tg:o.tg||null,mode:o.mode||'attack',to:o.to||null,sp:o.sp||(o.big?3.6:4.4),acc:o.acc||.27,dmg:o.dmg||(o.big?8:5),rng:o.rng||40,pref:o.pref||rr(9,15),st:0,alert:o.alert||22,y:o.y||0,onDie:o.onDie,lbl:o.lbl};
 g.position.set(x,e.y,z);ENM.push(e);if(ST.act)ST.act.ents.push(e);return e}
function thugU(dt){const live=!cut&&!P.dead;for(const e of ENM){if(e.isVeh)continue;if(e.dead){e.dt=(e.dt||0)+dt;continue}if(IN&&!e.inside)continue;
  const tg=e.tg&&!e.tg.dead&&e.tg.hp>0&&!e.tg.hidden?e.tg:P,tx=tg.x,tz=tg.z,d=Math.hypot(tx-e.x,tz-e.z);let sp=0,dx=0,dz=0;e.cd-=dt;
  if(e.mode=='guard'){if((d<e.alert&&tg===P)||(shT>.05&&Math.hypot(P.x-e.x,P.z-e.z)<45)||e.hp<e.hp0){e.mode='attack'}else{e.g.rotation.y=e.h;continue}}
  if(e.mode=='goto'&&e.to){const gx=e.to[0]-e.x,gz=e.to[1]-e.z,gd=Math.hypot(gx,gz);if(gd>1){const w=gd>8?cpath(e,e.to[0],e.to[1],dt):e.to,wx=w[0]-e.x,wz=w[1]-e.z,wl=Math.hypot(wx,wz)||1;dx=wx/wl;dz=wz/wl;sp=e.sp}else{e.at=(e.at||0)+dt;e.h=Math.atan2(gx||.01,gz||.01)}
   if(d<14&&tg===P&&live)e.mode='attack'}
  else{const sees=live&&d<e.rng&&(Math.abs((P.y||0)-(e.y||0))>6||los(e.x,e.z,tx,tz));e.sees=sees;
   if(!sees||d>e.pref+4){const w=(d>9&&!sees)?cpath(e,tx,tz,dt):[tx,tz],wx=w[0]-e.x,wz=w[1]-e.z,wl=Math.hypot(wx,wz)||1;dx=wx/wl;dz=wz/wl;sp=e.sp*(sees?.75:1)}
   else if(d<e.pref-4){dx=-(tx-e.x)/d;dz=-(tz-e.z)/d;sp=e.sp*.6}
   else{e.st+=dt;const sd=sin(e.st*.9+e.ph)>0?1:-1;dx=(tz-e.z)/d*sd;dz=-(tx-e.x)/d*sd;sp=e.sp*.35}
   if(sees&&e.cd<=0&&live){e.cd=rr(.75,1.5);const oy=(e.y||0)+1.3;tracer(e.x,e.z,tx,tz,0xff8855,oy);snd(260,.08,'square',.025);
    let ch=e.acc*Math.max(.15,1-d/(e.rng+12));if(tg===P){if(P.car)ch*=.65;if(P.crouch)ch*=.7;if(R()<ch){P.hp-=P.car?e.dmg*.5:e.dmg;hit('enemy');shake=Math.max(shake,.22)}}else if(R()<ch*1.1){tg.hp-=e.dmg;part(tg.x,1.2,tg.z,0,3,0,.12,BL[1],4)}}}
  if(sp>0&&!e.fixed){e.x+=dx*sp*dt;e.z+=dz*sp*dt;e.h=Math.atan2(dx,dz);e.ph+=dt*sp*1.8}if(!e.fixed)push(e,.4);if(e.sees||e.mode=='attack'&&d<e.rng)e.h=Math.atan2(tx-e.x,tz-e.z);
  const g=e.g,q=sp>0?sin(e.ph)*.8:0;g.position.set(e.x,e.y||0,e.z);g.rotation.y=e.h;g.l[0].rotation.x=q;g.l[1].rotation.x=-q;g.a[0].rotation.x=-q*.5;g.a[1].rotation.x=e.sees?-1.5:-q*.5}}
function aliveN(a){return a.filter(e=>!e.dead).length}
/* ---------- story vehicles (chase / tail / pursue / scripted) ---------- */
function svCar(key,col,type,x,z,h,o){o=o||{};const c=car(col,type);setCar(c,x,z,h||0);c.sv=1;c.mode=o.mode||'park';c.sp=0;c.top=o.top||18;c.free=o.free||0;c.key=key;cars.push(c);
 if(o.hp){const e={isVeh:1,enm:1,c,x,z,hp:o.hp,hp0:o.hp,rad:1.9,dead:0,onDie:()=>{svBoom(c);o.onDie&&o.onDie()}};c.ent=e;ENM.push(e);if(ST.act)ST.act.ents.push(e)}
 if(ST.act){ST.act.v[key]=c;ST.act.ents.push({car:c})}return c}
function svBoom(c){if(c.boomed)return;c.boomed=1;explode(c.x,.5,c.z);c.wreck=1;c.mode='park';c.sp=0;c.v=0;c.g.traverse(o=>{if(o.isMesh&&o.material&&(o.material.isMeshStandardMaterial||o.material.isMeshLambertMaterial))o.material=mat(0x1a1a1a)});FIRES.push({x:c.x,z:c.z,t:14})}
function svRoute(c,pts,sp){c.mode='route';c.pts=pts.map(p=>p.slice());c.pi=0;c.top=sp||c.top;c.done=0}
function svNext(c){const nb=[];const ix=RD.reduce((a,r)=>Math.abs(r-c.nx)<Math.abs(a-c.nx)?r:a,RD[0]),iz=RD.reduce((a,r)=>Math.abs(r-c.nz)<Math.abs(a-c.nz)?r:a,RD[0]);
 for(const[dx,dz]of[[40,0],[-40,0],[0,40],[0,-40]]){const nx=ix+dx,nz=iz+dz;if(nx<-100||nx>100||nz<-100||nz>100)continue;if(c.px!==undefined&&Math.abs(nx-c.px)<1&&Math.abs(nz-c.pz)<1)continue;nb.push([nx,nz])}
 let b=nb[0],bs=-1e9;for(const n of nb){const s=Math.hypot(n[0]-P.x,n[1]-P.z)+rr(0,18);if(s>bs){bs=s;b=n}}c.px=ix;c.pz=iz;c.nx=b[0];c.nz=b[1]}
function svAI(c,dt){if(c.wreck){c.sp=Math.max(0,c.sp-dt*20);c.v=c.sp;if(c.ent&&!c.ent.dead){c.ent.hp=0;kill(c.ent)}return}
 let tx=null,tz=null,top=c.top;
 if(c.mode=='route'&&c.pts){const p=c.pts[c.pi];if(!p){c.done=1;c.sp=Math.max(0,c.sp-dt*16);c.v=c.sp;return}const nx=c.pts[c.pi+1],ddx=p[0]-c.x,ddz=p[1]-c.z,dd=Math.hypot(ddx,ddz);
  const fx=ddx/(dd||1),fz=ddz/(dd||1),lane=p[2]===undefined?3:p[2];tx=p[0]+fz*lane;tz=p[1]+fx*lane;if(dd<6){c.pi++;if(c.pi>=c.pts.length){c.done=1}}if(nx&&dd<16){const a1=Math.atan2(fx,fz),a2=Math.atan2(nx[0]-p[0],nx[1]-p[1]);let da=Math.abs(Math.atan2(sin(a2-a1),cos(a2-a1)));top=Math.min(top,da>.6?9:top)}if(p[3])top=Math.min(top,p[3])}
 else if(c.mode=='flee'){if(c.nx===undefined){c.nx=c.x;c.nz=c.z;svNext(c)}const ddx=c.nx-c.x,ddz=c.nz-c.z,dd=Math.hypot(ddx,ddz);if(dd<5)svNext(c);const fx=ddx/(dd||1),fz=ddz/(dd||1);tx=c.nx+fz*3;tz=c.nz+fx*3;if(dd<14)top=Math.min(top,11)}
 else if(c.mode=='pursue'){const t=P.car||P;tx=t.x;tz=t.z;const d=Math.hypot(tx-c.x,tz-c.z);top=d<10?Math.max(4,(P.car?Math.abs(P.car.v):0)):c.top;
  if(c.gunner&&d<30&&!cut&&!P.dead&&(c.gcd=(c.gcd||0)-dt)<=0){c.gcd=rr(.5,1.1);tracer(c.x,c.z,t.x,t.z,0xff8855,1.4);snd(240,.07,'square',.025);if(R()<.28*(1-d/40)){P.hp-=P.car?3:6;hit('enemy');shake=Math.max(shake,.25)}}}
 else if(c.mode=='goto'&&c.gt){tx=c.gt[0];tz=c.gt[1];const d=Math.hypot(tx-c.x,tz-c.z);top=Math.min(c.top,d*1.2);if(d<1.2){c.mode='park';c.sp=0;if(c.gt[2]!==undefined)c.h=c.gt[2]}}
 else{c.sp=Math.max(0,c.sp-dt*18);c.v=c.sp;return}
 if(tx!==null){const want=Math.atan2(tx-c.x,tz-c.z);let d=want-c.h;d=Math.atan2(sin(d),cos(d));c.h+=Math.max(-1,Math.min(1,d*2.2))*dt*2.4*Math.min(1,.3+c.sp/8);if(Math.abs(d)>1.1)top=Math.min(top,7)}
 if(c.mode!='pursue'&&!c.ram){const sx=sin(c.h),sz=cos(c.h),q=P.car||P,ax=q.x-c.x,az=q.z-c.z,f=ax*sx+az*sz;if(f>0&&f<9&&Math.abs(ax*sz-az*sx)<2.2&&q!==c)top=Math.min(top,c.mode=='flee'?top:2)}
 c.sp+=(top-c.sp)*Math.min(1,dt*(top>c.sp?1.4:3));c.v=c.sp;
 if(c.ent){c.ent.x=c.x;c.ent.z=c.z}
 if(P.car&&P.car!==c){const pc=P.car,dx=pc.x-c.x,dz=pc.z-c.z,d=Math.hypot(dx,dz);if(d<3.3&&d>.01){const ov=(3.3-d)/2;pc.x+=dx/d*ov;pc.z+=dz/d*ov;c.x-=dx/d*ov;c.z-=dz/d*ov;const rel=Math.abs(pc.v-c.v*cos(pc.h-c.h));
   if((c.hcd=(c.hcd||0)-dt)<=0&&rel>5){c.hcd=.5;shake=Math.max(shake,.5);snd(90,.2,'sawtooth',.08);if(c.ent){c.ent.hp-=rel*.55}pc.v*=.55;if(c.mode=='flee'||c.mode=='route')c.sp*=.7}}}
 if(c.ent&&c.ent.hp<=0&&!c.ent.dead)kill(c.ent)}
/* ---------- pickups / interaction points ---------- */
function pickup(x,z,txt,o){o=o||{};let m=o.mesh;if(!m){m=new T.Group();const b=new T.Mesh(geo(.5,.34,.38),mat(o.col||0x8a6a3a));b.position.y=.17;m.add(b);const s=new T.Mesh(geo(.52,.06,.4),mat(0xffd23f));s.position.y=.3;m.add(s)}
 m.position.set(x,o.y||0,z);sc.add(m);const p={x,z,y:o.y||0,m,txt,got:0,r:o.r||2.2,auto:o.auto,onPick:o.onPick,inside:o.inside};PKS.push(p);if(ST.act)ST.act.ents.push({pk:p});return p}
function nearPk(){if(P.car)return null;for(const p of PKS)if(!p.got&&Math.hypot(p.x-P.x,p.z-P.z)<p.r&&Math.abs((P.y||0)-p.y)<2.5&&(!p.inside||IN===p.inside))return p;return null}
function pkU(){const t=performance.now()/1000;for(const p of PKS){if(p.got)continue;p.m.rotation.y=t*1.5;p.m.position.y=p.y+.25+sin(t*3)*.08;if(p.auto&&nearPk()===p)takePk(p)}}
function takePk(p){p.got=1;sc.remove(p.m);snd(700,.12,'sine',.06);if(p.onPick)p.onPick()}
function storyAct(k){if(!ST.on||k!='e'||cut)return 0;const p=nearPk();if(p){takePk(p);return 1}return 0}
function storyPrompt(){if(!ST.on||cut)return'';const p=nearPk();if(p)return'E - '+p.txt;if(SMK.visible&&!ST.act){const D=MIS[ST.m];if(D&&Math.hypot(P.x-D.at[0],P.z-D.at[1])<6)return heat>=1?'Lose the cops to start the mission':''}return''}
/* ---------- allies ---------- */
function ally(n,x,z,o){o=o||{};const a=place(n,x,z,o.h||0);a.hp=a.maxhp=o.hp||100;a.ally=1;a.follow=o.follow!==undefined?o.follow:1;a.vital=o.vital!==undefined?o.vital:1;a.shoot=o.shoot||0;a.inCar=null;a.cd=1;a.downed=0;if(ST.act&&!ST.act.al.includes(a))ST.act.al.push(a);return a}
function allyU(dt){if(!ST.act||cut)return;for(const a of ST.act.al){if(a.hidden)continue;if(a.hp<=0){if(!a.downed){a.anim='lie'}npcAnim(a,dt,0);continue}
  if(a.follow){if(P.car&&!a.inCar){const d=Math.hypot(P.car.x-a.x,P.car.z-a.z);if(d<7.5){a.inCar=P.car;a.g.visible=false;a.to=null}else{a.to=[P.car.x+rr(-.5,.5),P.car.z];a.sp=d>6?5.5:2.2}}
   else if(a.inCar){if(P.car!==a.inCar){const c=a.inCar;a.inCar=null;a.g.visible=true;a.x=c.x-cos(c.h)*2.4;a.z=c.z+sin(c.h)*2.4;push(a,.4)}else{a.x=a.inCar.x;a.z=a.inCar.z}}
   else{const d=Math.hypot(P.x-a.x,P.z-a.z);if(d>3.2&&!P.dead){a.to=[P.x,P.z];a.sp=d>9?5.6:d>5?3.6:2}else a.to=null;if(d>60&&!P.car){a.x=P.x-sin(P.h)*2;a.z=P.z-cos(P.h)*2}}}
  if(a.shoot&&!a.inCar&&(a.cd-=dt)<=0){let b=null,bd=a.shoot;for(const e of ENM)if(!e.dead&&!e.isVeh){const d=Math.hypot(e.x-a.x,e.z-a.z);if(d<bd&&los(a.x,a.z,e.x,e.z)){bd=d;b=e}}
   if(b){a.cd=rr(.9,1.8);a.face=b;tracer(a.x,a.z,b.x,b.z,0x9ad0ff,1.3);snd(330,.07,'square',.025);if(R()<.33){b.hp-=(a.dmgE||1);if(b.hp<=0)kill(b,(b.x-a.x)/bd,(b.z-a.z)/bd,0,0)}a.anim='gun'}else{a.cd=.5;if(a.anim=='gun')a.anim='idle';a.face=null}}
  if(!a.inCar){if(!a.to)push(a,.4);npcAnim(a,dt,0)}}}
function allyNear(a){return a.inCar?(P.car===a.inCar):Math.hypot(P.x-a.x,P.z-a.z)<9}
/* ---------- mission runtime ---------- */
function stStart(i,retry){const D=MIS[i];if(!D)return;stClean();ST.m=i;const seen=retry&&ST.act0&&ST.act0.i==i?ST.act0.seen:{};
 ST.act={D,i,s:-1,t:0,seen,ents:[],v:{},al:[],fl:{},timer:0,snap:{cash,own:Object.assign({},own),ammo:Object.assign({},ammo)}};ST.act0=ST.act;smkSet(null);heat=0;
 if(P.car){const c=P.car;P.car=null;P.x=c.x+cos(c.h)*2.4;P.z=c.z-sin(c.h)*2.4;c.v=0}if(IN&&!D.keepIn)IN=0;P.hp=100;P.crouch=0;if(D.pre)D.pre();
 copsOff=0;dS.cops=0;if(D.tod0!==undefined&&Math.abs(((tod-D.tod0+1.5)%1)-.5)>.04){fadeTo(1,0);tod=D.tod0;skyU();setTimeout(()=>fadeTo(0,1.4),60)}if(!retry&&!D.noTitle)titleCard(D.t,D.ch,4.2);stNext()}
function stNext(){const A=ST.act;if(!A)return;A.s++;A.t=0;A.cd=0;objSet('');sbarSet('');beaconOff();const s=A.D.steps[A.s];A.step=s;if(!s){stPass();return}if(s.init)s.init(A);if(ST.act===A&&A.step===s&&!s.tick&&!s.wait)stNext()}
function stTick(dt){const A=ST.act;if(!A||!A.step||ST.fail||ST.pass)return;A.t+=dt;const s=A.step;const r=s.tick?s.tick(A,dt):1;if(ST.act!==A||A.step!==s)return;
 if(r===true||r===1){if(s.done)s.done(A);stNext();return}if(typeof r=='string'){stFail(r);return}
 for(const a of A.al)if(a.vital&&a.hp<=0&&!a.downed&&!a.hidden){a.downed=1;a.anim='lie';stFail((SNAME[a.name]||a.name.charAt(0)+a.name.slice(1).toLowerCase())+' was killed.');return}}
function stClean(ok){const A=ST.act;for(let i=ENM.length-1;i>=0;i--){const e=ENM[i];if(!e.isVeh)sc.remove(e.g);ENM.splice(i,1)}
 if(A){for(const x of A.ents){if(x.car){const c=x.car;if(P.car===c){P.car=null;P.g.visible=true}if(!(c.keep&&ok)){sc.remove(c.g);const k=cars.indexOf(c);if(k>=0)cars.splice(k,1)}else{c.sv=0;c.mode='park'}}if(x.pk){sc.remove(x.pk.m);const k=PKS.indexOf(x.pk);if(k>=0)PKS.splice(k,1)}if(x.obj)sc.remove(x.obj)}for(const a of A.al){a.ally=0;a.inCar=null}}
 for(let i=PKS.length-1;i>=0;i--)if(!PKS[i].keep){sc.remove(PKS[i].m);PKS.splice(i,1)}
 hideAll();SAYQ.length=0;subShow();objSet('');sbarSet('');beaconOff();setRain(0);heat=0;for(const c of cops)sc.remove(c.g);cops.length=0;$('sir').style.opacity=0}
function stPass(){const A=ST.act;if(!A)return;ST.pass=1;const D=A.D;objSet('');sbarSet('');const rw=D.reward||0;cash+=rw;
 ST.m=Math.min(MIS.length,A.i+1);ST.max=Math.max(ST.max,ST.m);if(D.onPass)D.onPass();stSave();snd(520,.25,'sine',.07);setTimeout(()=>snd(780,.35,'sine',.07),180);setTimeout(()=>snd(1040,.5,'sine',.06),380);
 const r=$('mres');r.className='pass';r.innerHTML='<div class="big">MISSION PASSED</div><div class="mn">'+D.t+'</div>'+(rw?'<div class="rw">+$'+rw.toLocaleString()+'</div>':'')+(ST.flags.debt?'<div class="dbt">MARA\'S DEBT: $'+ST.flags.debt.toLocaleString()+'</div>':'');r.style.display='flex';
 setTimeout(()=>{r.style.display='none';ST.pass=0;if(ST.act!==A)return;const keep=D.keepAfter;stClean(1);ST.act=null;if(keep)keep();if(D.final){storyCredits();return}const N=MIS[ST.m];if(D.after)setTimeout(()=>{if(!ST.act&&!cut)say(D.after)},2600);if(N){smkSet(N);objSet(D.hint||'');setTimeout(()=>{if(!ST.act)objSet('')},14000)}},4600)}
function stFail(why){if(ST.fail||!ST.act)return;ST.fail=1;mode='eod';document.exitPointerLock&&document.exitPointerLock();for(const k in K)K[k]=0;if(CIN){const d=CIN;CIN=null;cut=null;document.body.classList.remove('on','cin');subShow()}
 const r=$('mres');r.className='fail';r.innerHTML='<div class="big">MISSION FAILED</div><div class="mn">'+why+'</div><div class="btns"><button id="mretry">RETRY (ENTER)</button><button id="mquit">QUIT MISSION (ESC)</button></div>';r.style.display='flex';snd(140,.8,'sawtooth',.08);
 $('mretry').onclick=stRetry;$('mquit').onclick=stQuit}
function stRestoreP(){const s=ST.act&&ST.act.snap;if(s){cash=Math.max(cash,s.cash);own=Object.assign({},s.own);ammo=Object.assign({},s.ammo);lastHot='';if(!own[cw])setW('pistol')}P.dead=0;P.hp=100;P.g.rotation.set(0,0,0);P.g.position.y=0;P.g.visible=true;P.g.hd.forEach(h=>h.visible=true);P.car=null;P.heli=null;P.plane=null;P.tank=null;P.hide=null;P.roof=null;P.y=0;heat=0;tScale=1;IN=0}
function stRetry(){if(!ST.fail)return;const i=ST.act.i,D=MIS[i];$('mres').style.display='none';stRestoreP();ST.fail=0;mode='play';P.x=D.at[0];P.z=D.at[1]+2;stStart(i,1);reLock()}
function stQuit(){if(!ST.fail)return;$('mres').style.display='none';stRestoreP();ST.fail=0;mode='play';stClean();ST.act=null;smkSet(MIS[ST.m]);reLock()}
function storyDeath(){if(ST.on&&ST.act&&!ST.fail)setTimeout(()=>stFail('You were wasted.'),50)}
/* ---------- step factories ---------- */
const SC=name=>({k:'cut',init(A){A.cd=0;const f=CS[name];const inst=!!A.seen[name];A.seen[name]=1;cinPlay(f(A),()=>{A.cd=1},inst)},tick(A){return A.cd},wait:1});
function SGO(x,z,txt,o){o=o||{};return{k:'go',x,z,o,init(A){if(o.time)A.timer=o.time;A.gtxt='';beacon(x,z,o.r||3.2,o.col)},tick(A,dt){let t=txt,ok=1;const src=P.car||P;
 if(o.time){A.timer-=dt;sbarSet('<span>TIME</span><b class="tm">'+mmss(A.timer)+'</b>');if(A.timer<=0)return o.timeFail||'You ran out of time.'}
 if(o.veh){const v=A.v[o.veh];if(!v||v.wreck)return o.vehFail||'The vehicle was destroyed.';if(v.dmg>(o.maxDmg||1e9))return o.vehFail||'The vehicle is wrecked.';if(P.car!==v){t=o.vehTxt||'Get back in the *vehicle*.';ok=0;beaconObj(v,0x37e6ff)}else if(!BEAT||BEAT.obj)beacon(x,z,o.r||3.2,o.col);if(o.maxDmg){const q=1-Math.min(1,(v.dmg||0)/o.maxDmg);sbarSet((o.time?'<span>TIME</span><b class="tm">'+mmss(A.timer)+'</b>':'')+barH('CONDITION',q,q<.3?'#ff4f4f':'#43ff7a'))}}
 else if(o.car&&!P.car){t=o.carTxt||'Get a *car*.';ok=0}
 if(ok&&o.foot&&P.car){t='Get out of the vehicle.';ok=0}
 if(ok&&o.ally)for(const n of o.ally){const a=npc(n);if(!allyNear(a)){t='Wait for *'+n.charAt(0)+n.slice(1).toLowerCase()+'*.';ok=0;break}}
 if(ok&&o.clean&&heat>=1){t='Lose the *cops* first.';ok=0}
 objSet(t);if(ok&&Math.hypot(src.x-x,src.z-z)<(o.r||3.2)&&(!o.y||Math.abs((P.y||0)-o.y)<3)&&(!o.slow||!P.car||Math.abs(P.car.v)<6))return 1;return 0}}}
const SKILL=(txt,spawn,o)=>({k:'kill',init(A){A.grp=[];spawn(A,A.grp);objSet(txt)},tick(A){const n=aliveN(A.grp);if(!(o&&o.noBar))sbarSet('<span>ENEMIES</span><b>'+n+'</b>');if(o&&o.check){const r=o.check(A);if(r)return r}return n==0}});
const SLOSE=(txt,st)=>({k:'lose',init(A){heat=Math.max(heat,st+.6);objSet(txt||'Lose the *cops*.')},tick(A){return A.t>2&&heat<1}});
const SDO=f=>({init(A){f(A)}});
const SWAIT=(s,txt)=>({init(A){if(txt)objSet(txt)},tick(A){return A.t>=s}});
const STALK=(lines,txt)=>({k:'talk',init(A){say(lines);if(txt)objSet(txt)},tick(A){return!SAYQ.length}});
const SSAY=lines=>({init(A){say(lines)}});
const SPICK=(x,z,txt,lab,o)=>({k:'pick',init(A){o=o||{};A.pk=pickup(x,z,lab,Object.assign({onPick:()=>{A.pkd=1}},o));A.pkd=0;beaconObj(A.pk,0xffd23f);objSet(txt)},tick(A){return A.pkd}});
const SCOND=(f,txt,b)=>({k:'cond',init(A){if(txt)objSet(txt);if(b)beacon(b[0],b[1],b[2]||2.6)},tick(A,dt){return f(A,dt)}});
const SCHOICE=(q,a,b)=>({k:'choice',init(A){A.ch=0;showChoice(q,a,b,v=>{A.ch=v})},tick(A){return A.ch?1:0}});
function SCHASE(txt,key,o){o=o||{};return{k:'chase',key,init(A){const c=A.v[key];c.mode=o.mode||'flee';objSet(txt);beaconObj(c.ent||c,0xff3b3b)},tick(A){const c=A.v[key],e=c.ent;if(e&&e.dead)return 1;const d=Math.hypot((P.car||P).x-c.x,(P.car||P).z-c.z);
 sbarSet(barH(o.lab||'TARGET',e?e.hp/e.hp0:1,'#ff4f4f')+'<span>'+Math.round(d)+'M</span>');if(d>(o.lose||170))return o.loseTxt||'The target got away.';if(o.check){const r=o.check(A);if(r)return r}return 0}}}
function STAIL(txt,key,o){o=o||{};return{k:'tail',key,init(A){A.close=0;objSet(txt);beaconObj(A.v[key],0x37e6ff)},tick(A,dt){const c=A.v[key],q=P.car||P,d=Math.hypot(q.x-c.x,q.z-c.z),mn=o.min||12,mx=o.max||75;
 if(c.done&&(!o.arrive||d<o.arrive*3))return 1;if(d>mx)return o.lostTxt||'You lost him.';if(d<mn){A.close+=dt;if(A.close>(o.spot||3.5))return o.spotTxt||'He spotted you.'}else A.close=Math.max(0,A.close-dt*.5);
 const z=d<mn?'#ff4f4f':d>mx*.8?'#ffb02b':'#43ff7a';sbarSet('<span>DISTANCE</span><div class="sb2 tl"><i style="left:'+Math.min(100,d/mx*100)+'%;background:'+z+'"></i><u style="left:'+(mn/mx*100)+'%"></u></div><b style="color:'+z+'">'+(d<mn?'TOO CLOSE':d>mx*.8?'FALLING BEHIND':'GOOD')+'</b>');return 0}}}
function SDEF(txt,dur,spawn,o){o=o||{};return{k:'def',init(A){A.grp=[];A.timer=dur;A.sp=0;A.wv=0;objSet(txt)},tick(A,dt){A.timer-=dt;A.sp-=dt;if(A.sp<=0&&A.timer>(o.stop||8)){A.sp=o.every||9;spawn(A,A.grp,A.wv++)}
 if(o.check){const r=o.check(A);if(r)return r}sbarSet('<span>'+(o.lab||'HOLD ON')+'</span><b class="tm">'+mmss(Math.max(0,A.timer))+'</b>'+(o.prog?barH(o.prog,1-A.timer/dur,'#ffd23f'):'')+(o.ally?barH(o.ally,npc(o.ally).hp/npc(o.ally).maxhp,'#37e6ff'):''));
 return A.timer<=0&&(!o.clear||aliveN(A.grp)==0)}}}
/* ---------- choice + credits ---------- */
function showChoice(q,a,b,cb){mode='eod';document.exitPointerLock&&document.exitPointerLock();const c=$('choice');c.innerHTML='<div class="q">'+q+'</div><button id="ch1">1 · '+a+'</button><button id="ch2">2 · '+b+'</button>';c.style.display='flex';
 const pick=v=>{c.style.display='none';mode='play';showChoice.cb=null;cb(v);reLock()};showChoice.cb=pick;$('ch1').onclick=()=>pick(1);$('ch2').onclick=()=>pick(2)}
function storyCredits(){mode='eod';document.exitPointerLock&&document.exitPointerLock();const c=$('credits');c.innerHTML='<div class="roll">'+CREDITS.map(l=>l.startsWith('#')?'<h1>'+l.slice(1)+'</h1>':l.startsWith('!')?'<h3>'+l.slice(1)+'</h3>':'<p>'+l+'</p>').join('')+'</div><button id="crc">CONTINUE IN FREE ROAM &gt;</button>';c.style.display='block';
 $('crc').onclick=()=>{c.style.display='none';mode='play';objSet('Story complete. Ember City is yours. Replay chapters from the main menu.');setTimeout(()=>objSet(''),9000);reLock()}}
/* ---------- rain (story atmosphere) ---------- */
let RAIN=null;function setRain(on){if(on&&!RAIN){const n=2600,g=new T.BufferGeometry(),a=new Float32Array(n*6);for(let i=0;i<n;i++){const x=rr(-40,40),y=rr(0,36),z=rr(-40,40);a.set([x,y,z,x-.08,y-.9,z],i*6)}g.setAttribute('position',new T.BufferAttribute(a,3));
  RAIN=new T.LineSegments(g,new T.LineBasicMaterial({color:0x9ab4d0,transparent:true,opacity:.45,depthWrite:false}));RAIN.frustumCulled=false;sc.add(RAIN);if(ROADMAT){ROADMAT.userData.r0=ROADMAT.roughness;ROADMAT.roughness=.42}SKYU.uCover.value=.18}
 else if(!on&&RAIN){sc.remove(RAIN);RAIN=null;if(ROADMAT&&ROADMAT.userData.r0)ROADMAT.roughness=ROADMAT.userData.r0;SKYU.uCover.value=.55}}
function rainU(dt){if(!RAIN)return;const a=RAIN.geometry.attributes.position.array;for(let i=0;i<a.length;i+=6){let y=a[i+1]-dt*34;if(y<0)y+=36;a[i+1]=y;a[i+4]=y-.9}RAIN.geometry.attributes.position.needsUpdate=true;RAIN.position.set(cam.position.x,cam.position.y-16,cam.position.z);if(R()<.002&&!cut){$('fx').style.background='#cfe0ff';$('fx').style.opacity=.35;setTimeout(()=>$('fx').style.opacity=0,90);setTimeout(()=>snd(40,2.2,'sawtooth',.06),700)}}
/* ---------- per-frame ---------- */
function storyLocks(){const h=!ST.on||!!ST.flags.heli,p=!ST.on||!!ST.flags.plane;for(const q of helis){q.locked=!h;q.g.visible=h||P.heli===q}for(const q of planes){if(q.story)continue;q.locked=!p;q.g.visible=p||P.plane===q}}
function storyU(dt){storyLocks();if(!ST.on)return;sayU(dt);beaconU();pkU();thugU(dt);rainU(dt);
 if(!cut&&!P.dead&&mode=='play'){allyU(dt);stTick(dt);
  if(!ST.act&&SMK.visible){const D=MIS[ST.m];if(D){SMK.rg.position.y=.25+sin(performance.now()/300)*.1;const d=Math.hypot((P.car||P).x-D.at[0],(P.car||P).z-D.at[1]);if(d<3&&heat<1&&!IN&&(P.y||0)<2&&!P.heli&&!P.plane)stStart(ST.m)}}}
 if(ST.act&&ST.act.D.hud)ST.act.D.hud(ST.act);const dc=$('debt');if(ST.flags.debt&&!cut){dc.style.display='flex';dc.lastChild.textContent='$'+ST.flags.debt.toLocaleString()}else dc.style.display='none'}
/* ---------- boot / menu ---------- */
function storyBoot(){ST.on=1;const s=stLoad();if(s&&!ST.fresh){ST.flags=s.flags||{};ST.max=s.max||0;ST.ending=s.ending||'';if(!ST.pick){ST.m=s.m||0;cash=dispCash=lastCash=s.cash||cash;own=Object.assign({pistol:1},s.own||{});ammo=Object.assign({pistol:60,shotgun:0,smg:0,sniper:0},s.ammo||{});lastHot=''}}
 else{ST.flags={debt:120000};ST.max=0;ST.m=0}
 if(ST.pick!==undefined&&ST.pick!==null){ST.m=ST.pick;ST.flags=Object.assign({debt:120000},ST.flags)}
 tod=MIS[ST.m]?MIS[ST.m].tod0||.45:.45;stSave();if(ST.m>=MIS.length){objSet('Story complete. Replay chapters from the main menu.');return}
 if(ST.m==0){stStart(0);return}P.x=-40;P.z=16;P.h=0;camYaw=0;smkSet(MIS[ST.m]);objSet((MIS[ST.m-1]||{}).hint||'');setTimeout(()=>{if(!ST.act)objSet('')},14000)}
function openStory(){if(ST.menu)return;ST.menu=1;const s=stLoad(),m=$('smenu'),cur=s?Math.min(s.m||0,MIS.length):0,mx=s?Math.max(s.max||0,cur):0;
 let h='<h2>STORY MODE</h2><div class="stat">EMBER CITY · A STORY IN '+MIS.length+' CHAPTERS · ~1 HOUR+</div>';
 if(s&&cur>0)h+='<button class="sbig" data-s="cont">CONTINUE · '+(cur<MIS.length?MIS[cur].ch+' — '+MIS[cur].t:'STORY COMPLETE')+'</button>';
 h+='<button class="sbig" data-s="new">'+(s?'NEW STORY (RESETS PROGRESS)':'BEGIN THE STORY')+'</button>';
 if(mx>0)h+='<div class="stat">CHAPTER SELECT</div><div class="chs">'+MIS.map((d,i)=>i<=Math.min(mx,MIS.length-1)?'<button data-s="ch'+i+'">'+(i+1)+'. '+d.t+'</button>':'').join('')+'</div>';
 h+='<div class="stat">GRAPHICS</div><div class="opts gq">'+[['LOW',0],['MEDIUM',1],['HIGH',2],['ULTRA',3]].map(o=>'<button data-g="'+o[1]+'" class="'+(CFG.gfx==o[1]?'sel':'')+'">'+o[0]+'</button>').join('')+'</div><button data-s="back">&lt; BACK</button>';
 m.innerHTML='<div class="pn" id="smp">'+h+'</div>';m.style.display='flex';snd(400,.1,'square',.04)}
$('smenu').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.g!==undefined){CFG.gfx=+b.dataset.g;saveCfg();b.parentNode.querySelectorAll('button').forEach(x=>x.classList.toggle('sel',x===b));if(CFG.gfx==0)msg('LOW quality takes full effect after a page reload','#ffb02b');return}
 const v=b.dataset.s;if(!v)return;if(v=='back'){ST.menu=0;$('smenu').style.display='none';return}
 if(v=='new'){try{localStorage.removeItem(SKEY)}catch(x){}ST.fresh=1;ST.pick=null}else if(v=='cont'){ST.fresh=0;ST.pick=null}else if(v.startsWith('ch')){ST.fresh=0;ST.pick=+v.slice(2)}
 Object.assign(CFG,{mode:0,map:0,mp:0,skip:1,hunger:0,rent:0,exec:0,perma:0,goal:0,copLimit:12,peds:40,traffic:12,heatMult:.6,gore:1,allW:0,infAmmo:0,god:0,dayLen:1440,cash:500});ST.on=1;$('smenu').classList.add('out');setTimeout(()=>{$('smenu').remove()},1000);beginGame()});
addEventListener('keydown',e=>{if(ST.fail){if(e.code=='Enter')stRetry();else if(e.code=='Escape')stQuit();return}if(showChoice.cb){if(e.code=='Digit1')showChoice.cb(1);else if(e.code=='Digit2')showChoice.cb(2);return}
 if(CIN&&cut&&(e.code=='Space'||e.code=='KeyE')){e.preventDefault();cinNext()}});
cvs.addEventListener('pointerdown',()=>{if(CIN&&cut)cinNext()});
/* ---------- casino hook (mission: play rounds) ---------- */
{const g0=gAct;gAct=function(a){const b=cash;g0(a);if(/^(spin|rspin|deal)$/.test(a)&&(cash!==b||gm.busy)){ST.games++;if(ST.act&&ST.games==3)setTimeout(()=>{if(mode=='cas'){closeCas()}},3200)}}}
