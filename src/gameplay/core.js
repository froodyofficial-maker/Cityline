/* ---- gore ---- */
const BL=[mat(0x9b0f14),mat(0xc2181f),mat(0x6d0b0f)],PP=[],DC=[];let pI=0,dI=0;
for(let i=0;i<560;i++){const m=new T.Mesh(geo(1,1,1),BL[0]);m.visible=false;sc.add(m);PP.push({m,v:new T.Vector3(),l:0,s:1})}
for(let i=0;i<130;i++){const m=new T.Mesh(new T.CircleGeometry(1,10),BL[2]);m.rotation.x=-PI/2;m.position.y=.09;m.visible=false;sc.add(m);DC.push(m)}
function part(x,y,z,vx,vy,vz,s,mt,l){const p=PP[pI++%560];p.m.material=mt;p.m.position.set(x,y,z);p.m.scale.set(s,s,s);p.m.visible=true;p.v.set(vx,vy,vz);p.l=l;p.s=s}
function splat(x,z,s){const d=DC[dI++%130];d.position.x=x+rr(-.4,.4);d.position.z=z+rr(-.4,.4);d.scale.setScalar(s);d.visible=true}
function gore(e,dx,dz,big){const n=Math.round((big?32:18)*Math.min(1,CFG.gore));snd(110,.18,'sawtooth',.08);
 for(let i=0;i<n;i++)part(e.x,(e.y0||0)+rr(.4,1.3),e.z,dx*rr(2,9)+rr(-3,3),rr(2,8),dz*rr(2,9)+rr(-3,3),rr(.08,.2),ri(BL),rr(6,14));
 splat(e.x,e.z,rr(.8,1.6));if(big)for(let i=0;i<3;i++)splat(e.x+rr(-2,2),e.z+rr(-2,2),rr(.4,1.1));
 if(CFG.gore>1.5)for(let k=0;k<(big?44:18);k++)part(e.x,(e.y0||0)+rr(.3,1.4),e.z,dx*rr(2,11)+rr(-4,4),rr(2,12),dz*rr(2,11)+rr(-4,4),rr(.12,.4),ri(ORG),80);
 if(big||R()<.35){e.g.hd[0].visible=e.g.hd[1].visible=false;part(e.x,(e.y0||0)+1.3,e.z,dx*5,6,dz*5,.34,mat(0xe0ac69),70);
  for(let i=0;i<(big?5:2);i++)part(e.x,(e.y0||0)+.8,e.z,dx*rr(3,9)+rr(-2,2),rr(3,8),dz*rr(3,9)+rr(-2,2),rr(.2,.4),ri([mat(0xe0ac69),mat(0x3a5ea8),mat(0x2b2f3a)]),70)}}
/* ---- entities ---- */
const peds=[],cops=[],cars=[];
const skins=['#f1c7a0','#e0ac69','#c68642','#8d5524'],shirts=['#3a5ea8','#d9a441','#7a3aa8','#3aa86b','#c0392b','#ddd','#e67e22'];
/* pedestrians and traffic live on the road segments around the player and are recycled when they fall far behind,
   so the bigger city stays busy where you are without simulating all of it */
function mkPed(){const arm=R()<.1,e={g:person(ri(skins),arm?ri(['#2a2a30','#4a2020','#20304a']):ri(shirts),ri(['#2b2f3a','#5a4a3a','#3a4a5a']),ri(['#222','#4a2f1b','#a0703c']),arm?1:0),hp:arm?3:1,arm,cd:1,dead:0,dt:0,fl:0,ph:R()*6,sp:rr(1.6,2.8)};pedPlace(e,1);peds.push(e);return e}
function pedPlace(e,init){const c=P.car||P,q=rdPick(c.x,c.z,init?0:70,init?140:170),s=q.s;e.seg=s;e.ax=s.ax;e.p=s.c+(R()<.5?8:-8);e.x=e.ax?e.p:q.u;e.z=e.ax?q.u:e.p;e.tx=e.x;e.tz=e.z;e.fl=0;newT(e)}
function newT(e){const s=e.seg,cur=e.ax?e.z:e.x,a=Math.max(s.a+9,Math.min(s.b-9,cur+rr(-45,45)));e.tx=e.ax?e.p:a;e.tz=e.ax?a:e.p}
function aiCarPlace(c,init){const p=P.car||P,q=rdPick(p.x,p.z,init?0:90,init?150:190),s=q.s,d=R()<.5?1:-1;c.seg=s;c.ax=s.ax;c.r=s.c;c.d=d;c.ln=d*3;c.v=0;
 setCar(c,c.ax?s.c+c.ln:q.u,c.ax?q.u:s.c+c.ln,c.ax?(d>0?0:PI):(d>0?PI/2:-PI/2))}
function aiCarEnd(c){if(Math.hypot(c.x-P.x,c.z-P.z)>90)return aiCarPlace(c);const s=c.seg;c.d=-c.d;c.ln=c.d*3;const u=Math.max(s.a+7.5,Math.min(s.b-7.5,c.ax?c.z:c.x));
 setCar(c,c.ax?s.c+c.ln:u,c.ax?u:s.c+c.ln,c.ax?(c.d>0?0:PI):(c.d>0?PI/2:-PI/2))}
for(let i=0;i<40;i++)mkPed();
function setCar(c,x,z,h){c.x=x;c.z=z;c.h=h;c.g.position.set(x,0,z);c.g.rotation.y=h}
for(let i=0;i<12;i++){const c=car(ri([0xd03030,0x2a6fd0,0xe0b020,0x30a060,0xeeeeee,0x333333]));c.ai=1;aiCarPlace(c,1);cars.push(c)}
{const c=car(0xe8452c);setCar(c,12,14,PI/2);cars.push(c)}
function scare(x,z,r){for(const e of peds)if(!e.dead&&Math.hypot(e.x-x,e.z-z)<r){e.fl=rr(3,6);const l=Math.hypot(e.x-x,e.z-z)||1;e.fx=(e.x-x)/l;e.fz=(e.z-z)/l}}
/* ---- tracer ---- */
const TR=[];function tracer(x1,z1,x2,z2,c,y1){y1=y1||1;const l=Math.hypot(x2-x1,z2-z1,y1-1),m=new T.Mesh(geo(.06,.06,1),new T.MeshBasicMaterial({color:c}));m.position.set((x1+x2)/2,(y1+1)/2,(z1+z2)/2);m.scale.z=l||.1;m.lookAt(x2,1,z2);sc.add(m);TR.push({m,t:.07})}
function shoot(){if(shT>0)return;shT=.2;snd(320,.12,'sawtooth',.06);const all=peds.concat(cops).filter(e=>!e.dead);let ax=sin(P.h),az=cos(P.h),bd=40,bt=null;
 for(const e of all){const dx=e.x-P.x,dz=e.z-P.z,l=Math.hypot(dx,dz);if(l<28&&(dx*ax+dz*az)/l>.8&&l<bd){bd=l;bt=e}}
 if(bt&&zoom>=.1){const dx=bt.x-P.x,dz=bt.z-P.z;ax=dx/bd;az=dz/bd;P.h=Math.atan2(ax,az)}
 let hit=null,hd=40;for(const e of all){const dx=e.x-P.x,dz=e.z-P.z,pr=dx*ax+dz*az;if(pr>0&&pr<hd&&Math.abs(dx*az-dz*ax)<.8){hd=pr;hit=e}}
 tracer(P.x+ax*.6,P.z+az*.6,P.x+ax*hd,P.z+az*hd,0xffe066);scare(P.x,P.z,22);heat=Math.max(heat,.15);
 if(hit&&--hit.hp<=0)kill(hit,ax,az,0,1);else if(hit){part(hit.x,1,hit.z,0,3,0,.12,BL[1],5);heat+=.02}}
/* ---- cutscenes ---- */
const fly=(a,b,la,lb,p)=>{const k=p*p*(3-2*p);cam.position.set(a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k);cam.lookAt(la[0]+(lb[0]-la[0])*k,la[1]+(lb[1]-la[1])*k,la[2]+(lb[2]-la[2])*k)};
function cutscene(dur,fn,lines,done){cut={t:0,dur,fn,lines,done};$('w').parentNode.classList.add('on');txt('pr','')}
function intro(){cutscene(10,p=>fly([70,60,70],[P.x-sin(camYaw)*7.7,5.1,P.z-cos(camYaw)*7.7],[0,10,0],[P.x,1.2,P.z],p),
 [[0,'WELCOME TO EMBER CITY.'],[3,'Broke. Armed. Nothing left to lose.'],[6.5,'This town owes you. Time to collect.']])}
function robBank(){bank.cd=70;const bz=bank.z,bxx=bank.x;
 cutscene(9,(p,t)=>{const a=-.6+p*2.2;cam.position.set(bxx+sin(a)*13,3+p*5,bz+cos(a)*13);cam.lookAt(bxx,2.5,bz);$('sir').style.opacity=p>.5?1:0},
 [[0,'"EVERYBODY ON THE FLOOR!"'],[2.5,'Bags full. Vault wide open.'],[5,'Sirens. Already?'],[7,'Time to run.']],()=>{const m=Math.round(rr(9000,16000));cash+=m;heat=Math.max(heat,4.3);dS.heists++;msg('Bank job: +$'+m+' — GET AWAY!')})}
function wasted(){P.dead=1;const px=(P.car||P).x,pz=(P.car||P).z;if(!P.car)P.g.rotation.x=-PI/2,P.g.position.y=.18;if(P.car){P.car=null}
 cutscene(5,p=>{const a=p*2;cam.position.set(px+sin(a)*7,3+p*6,pz+cos(a)*7);cam.lookAt(px,0,pz)},[[.4,'WASTED']],respawn)}
function respawn(){P.dead=0;P.hp=100;P.x=4;P.z=14;P.g.rotation.x=0;P.g.position.y=0;P.g.visible=true;heat=0;for(const c of cops)sc.remove(c.g);cops.length=0;cash=Math.floor(cash*.9);msg('Hospital bill: -10% cash');$('sir').style.opacity=0}
/* ---- casino ---- */
const SY=['cherry','lemon','bell','diamond','seven'],showR=a=>$('rl').innerHTML=a.map(i=>si(SY[i],64)).join(''),W=[30,28,20,12,10],PAY=[3,4,6,12,30];let bet=100,busy=0;
const wp=()=>{let r=R()*100;for(let i=0;i<5;i++){if((r-=W[i])<0)return i}return 0};
const cb=()=>{$('cb').textContent=cash;txt('cash',cash)};
document.querySelectorAll('.bt').forEach(b=>b.onclick=()=>{bet=+b.dataset.b;document.querySelectorAll('.bt').forEach(x=>x.classList.toggle('sel',x==b))});
function res(t,c){$('res').textContent=t;$('res').style.color=c}
$('sp0').onclick=()=>{if(busy)return;if(cash<bet)return res('Not enough cash!','#f55');cash-=bet;cb();busy=1;res('','#fff');let n=0;
 const iv=setInterval(()=>{const s=[wp(),wp(),wp()];if(++n>14){clearInterval(iv);busy=0;let w=0;
  if(s[0]==s[1]&&s[1]==s[2])w=bet*PAY[s[0]];else if(s[0]==s[1]||s[1]==s[2]||s[0]==s[2])w=bet;showR(s);
  cash+=w;cb();res(w>bet?'WIN +$'+(w-bet)+(w>=bet*12?' — JACKPOT!':''):w==bet?'Push — bet returned':'Lost $'+bet,w>bet?'#4ade80':w?'#fff':'#f55');snd(w>bet?800:150,.3,'square');return}
  showR(s);snd(500+n*20,.05)},90)};
document.querySelectorAll('.ro').forEach(b=>b.onclick=()=>{if(busy)return;if(cash<bet)return res('Not enough cash!','#f55');cash-=bet;const n=R()*37|0,c=n==0?'g':n<19?'r':'b';let w=0;
 if(c==b.dataset.c)w=c=='g'?bet*30:bet*2;cash+=w;cb();res('Ball lands on '+n+' '+({r:'RED',b:'BLACK',g:'GREEN'})[c]+(w?' — WIN +$'+(w-bet):' — lost $'+bet),w?'#4ade80':'#f55');snd(w?800:150,.25)});
showR([4,4,4]);function openCas0(){document.exitPointerLock&&document.exitPointerLock();mode='cas';cb();$('cas').style.display='flex';for(const k in K)K[k]=0}
function closeCas0(){mode='play';$('cas').style.display='none'}$('lv').onclick=()=>closeCas();
/* ---- input ---- */
const K={};let drag=0;
addEventListener('keydown',e=>{if(document.activeElement&&document.activeElement.id=='chi'){if(e.code=='Enter')chatSend();else if(e.code=='Escape')chatClose();return}if(!started){if(e.code=='Enter'&&!ST.menu)setupOpen?(mapOpen?beginGame():openMaps()):openStory();return}if(mode!='play'){xKeyModal(e);return}if(e.code=='KeyM')$('mm').classList.toggle('big');if(e.code=='KeyT'){const p=tod;tod=(tod+.25)%1;if(tod<p)eodReq='midnight'}if(cut){if(e.code=='Enter')cut.t=cut.dur;return}K[e.code]=1;xKey(e);if(e.code=='KeyE')act('e');if(e.code=='KeyF')act('f');if(e.code=='Space'||e.code.startsWith('Arrow'))e.preventDefault()});
addEventListener('keyup',e=>K[e.code]=0);
const cvs=$('c');cvs.addEventListener('pointerdown',e=>{if(e.button==0){if(mode=='play'&&!cut&&!locked()&&!lockFail){reLock();return}K.M=1;K.mDown=1}else{if(e.button==2)K.R=1;drag=1}});addEventListener('pointerup',e=>{if(e.button==2)K.R=0;K.M=0;drag=0});
addEventListener('pointermove',e=>{if(drag||document.pointerLockElement||(lockFail&&mode=='play'&&!cut)){{const ms=CFG.sens*(scoped?CFG.scopeSens:1);camYaw-=e.movementX*.0035*ms;camPitch=Math.max(-.2,Math.min(1.2,camPitch+e.movementY*.003*ms))}mvT=performance.now()}});
addEventListener('wheel',e=>{zoom=Math.max(0,Math.min(1,zoom+e.deltaY*.0012))},{passive:true});cvs.addEventListener('contextmenu',e=>e.preventDefault());
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function nearCar(){let b=null,bd=4.5;for(const c of cars){if(c.sv&&!c.free)continue;const d=dist(c,P);if(d<bd){bd=d;b=c}}return b}
const cD=new T.Color(0x66b8ff),cN=new T.Color(0x1d2b5e),MOON=new T.Color(0x9fb4ff),cO=new T.Color(0xff8c4a),tmp=new T.Color();let tod=.42;
const SKC={w:new T.Color(1,1,1),sunW:new T.Color(0xfff1dc),sunO:new T.Color(0xff8a4a),moon:new T.Color(0x8ea4d8),dTop:new T.Color(0x2c66c8),nTop:new T.Color(0x05081a),cDay:new T.Color(0xf4f6fa),cDusk:new T.Color(0xffa080),cNight:new T.Color(0x1a2034),v:new T.Vector3()};
function skyU(){const sh=-cos(tod*2*PI),day=Math.max(0,Math.min(1,sh*2.2+.4)),n=1-day,du=Math.max(0,1-Math.abs(sh)*4);tmp.copy(cN).lerp(cD,day).lerp(cO,du*.55);sc.background.copy(tmp);sc.fog.color.copy(tmp);
 skyX(day,sh,n,du);const env=!!sc.environment;
 if(IN){/* interiors: warm practical-light fill instead of open sky, no sky colour leaking through door gaps */hemi.intensity=(IN===CAS?.3:.42+.1*day)*LI;hemi.color.setHex(IN===CAS?0xffd2a8:0xffe8cc);hemi.groundColor.setHex(0x5a4c40);sc.background.setHex(IN===CAS?0x0c0610:0x15110d);envK(.22)}
 else{hemi.intensity=(.3+.3*day)*(env?.6:1)*LI;hemi.color.copy(tmp).lerp(SKC.w,.5);hemi.groundColor.setHex(0x5a5248).multiplyScalar(.4+.6*day);envK(.55+.25*day)}
 if(sh>-.05){sun.color.copy(SKC.sunW).lerp(SKC.sunO,Math.min(1,du*1.15));sun.intensity=(.18+.82*smooth(-.05,.3,sh))*LI*(IN?.2:1.1)}else{sun.color.copy(SKC.moon);sun.intensity=.2*LI*(IN?.2:1)}
 for(const o of NEON)o.m.color.copy(o.b).multiplyScalar(.3+.7*n);for(const m of BM)m.emissive.setRGB(.95*n,.78*n,.45*n);GU.uNight.value=smooth(.3,.85,n);
 txt('clk',String(tod*24|0).padStart(2,'0')+':'+String((tod*24%1)*60|0).padStart(2,'0'));const ni=n>.6?'moon':'sun';if(ni!==lastN){lastN=ni;$('ci').innerHTML=si(ni,16)}}
/* the shadow camera is snapped to whole shadow-map texels in light space and the sun angle is stepped in 1-degree increments,
   so shadow edges stay put instead of crawling and shimmering while you move */
const SUNR=new T.Vector3(),SUNU=new T.Vector3(),SUNY=new T.Vector3(0,1,0);
function sunPlace(){const sa=Math.round(tod*360)/360*2*PI,dy=-cos(sa),dx=sin(sa),d=SKC.v;if(dy>-.05)d.set(dx,Math.max(dy,.1),.45);else d.set(-dx,Math.max(-dy,.15),-.45);d.normalize();const c=IN?cam.position:(P.car||P.heli||P.plane||P);
 const ts=sun.shadow.camera.right*2/sun.shadow.mapSize.x;SUNR.crossVectors(SUNY,d).normalize();SUNU.crossVectors(d,SUNR);
 const a=Math.round((c.x*SUNR.x+c.z*SUNR.z)/ts)*ts,b=Math.round((c.x*SUNU.x+c.z*SUNU.z)/ts)*ts,w=c.x*d.x+c.z*d.z;
 const tx=SUNR.x*a+SUNU.x*b+d.x*w,ty=SUNR.y*a+SUNU.y*b+d.y*w,tz=SUNR.z*a+SUNU.z*b+d.z*w;sun.target.position.set(tx,ty,tz);sun.position.set(tx+d.x*100,ty+d.y*100,tz+d.z*100)}
/* the minimap canvas covers the whole world (-420..420 m) at 2/3 px per metre; the full-screen map shows it 1:1 */
const MS=document.createElement('canvas');MS.width=MS.height=560;const mg=$('mm').getContext('2d'),mq=160/240,MX=v=>Math.round((v+420)*mq);
function mmInit(){const g=MS.getContext('2d');g.fillStyle='#24401f';g.fillRect(0,0,MS.width,MS.height);g.fillStyle='#2f5a2f';g.fillRect(MX(WB.x0),MX(WB.z0),MX(WB.x1)-MX(WB.x0),MX(COAST)-MX(WB.z0));g.fillStyle='#3a3d44';
 for(const s of ROADS)if(s.ax)g.fillRect(MX(s.c)-4,MX(s.a),8,MX(s.b)-MX(s.a));else g.fillRect(MX(s.a),MX(s.c)-4,MX(s.b)-MX(s.a),8);
 g.fillStyle='#3a3d44';g.fillRect(MX(120),MX(20)-4,MX(340)-MX(120),8);g.fillRect(MX(120),MX(-20)-4,MX(340)-MX(120),8);g.fillStyle='#55555e';g.fillRect(MX(130),MX(-46),MX(270)-MX(130),MX(16)-MX(-46));g.fillStyle='#22222a';g.fillRect(MX(140),MX(-66),MX(340)-MX(140),Math.round(20*mq));
 drawRiver(g);g.fillStyle='#8a8f99';for(const b of B)g.fillRect(MX(b.x1),MX(b.z1),Math.round((b.x2-b.x1)*mq),Math.round((b.z2-b.z1)*mq));
 g.font='8px "Press Start 2P",monospace';g.textAlign='center';for(const[t,x,z]of[['HEIGHTS',0,-250],['PALM GROVE',-260,-20],['FOUNDRY',-140,220],['PORT EMBER',250,200],['EASTSIDE',250,-200],['BEACH',-150,322],['AIRPORT',230,-30]]){g.fillStyle='#000';g.fillText(t,MX(x)+1,MX(z)+1);g.fillStyle='#ffe9b0';g.fillText(t,MX(x),MX(z))}
 const ic=(o,n)=>g.drawImage(SPR[n],MX(o.x)-4,MX(o.z)-4);for(const p of PLACES)ic(p,p.icon);ic(bank,'coin');ic(casino,'seven');ic(apt,'house');ic({x:MAH.cx,z:MAH.cz},'house');for(const o of shops)ic(o,o.kind=='guns'?'pistol':'cup')}
function mmDraw(){const cv=$('mm'),big=cv.classList.contains('big'),c=IN?IN.ret:P,S=big?MS.width:160;if(cv.width!==S){cv.width=cv.height=S;mg.imageSmoothingEnabled=false}mg.fillStyle='#14091f';mg.fillRect(0,0,S,S);mg.save();
 if(!big){mg.translate(80,80);mg.rotate(camYaw-PI);mg.scale(1.8,1.8);mg.translate(-MX(c.x),-MX(c.z))}
 mg.drawImage(MS,0,0);if(!IN){for(const e of peds)if(e.hostile&&!e.dead){if(e.avenger)mg.drawImage(SPR.skull,MX(e.x)-4,MX(e.z)-4);else{mg.fillStyle='#ff3b3b';mg.fillRect(MX(e.x)-1,MX(e.z)-1,3,3)}}mg.fillStyle='#ffc94a';mg.fillRect(MX(ROSY.x)-1,MX(ROSY.z)-1,3,3);mg.fillStyle='#fff';for(const e of peds)if(!e.dead)mg.fillRect(MX(e.x),MX(e.z),1,1);mg.fillStyle='#f33';for(const e of cops)if(!e.dead)mg.fillRect(MX(e.x)-1,MX(e.z)-1,3,3);mg.fillStyle='#ff0';for(const q of cars)if(!q.ai)mg.fillRect(MX(q.x)-1,MX(q.z)-2,3,4);for(const q of helis.concat(planes))if(!q.crashed)mg.drawImage(SPR.heli,MX(q.x)-4,MX(q.z)-4);mg.fillStyle='#37e6ff';for(const r of MP.remote.values())mg.fillRect(MX(r.x)-2,MX(r.z)-2,4,4)}
 mg.restore();mg.save();mg.translate(big?MX(c.x):80,big?MX(c.z):80);if(big)mg.rotate(PI-P.h);mg.fillStyle='#ff4fa3';mg.strokeStyle='#fff';mg.lineWidth=1;mg.beginPath();mg.moveTo(0,-5);mg.lineTo(4,4);mg.lineTo(-4,4);mg.closePath();mg.fill();mg.stroke();mg.restore();storyMM(big,c)}
/* ---- update ---- */
const ease=(a,b,k)=>a+(b-a)*k;
function update(dt){
 if(toastT>0&&(toastT-=dt)<=0)$('tt').textContent='';
 {const pt=tod;tod=(tod+dt/CFG.dayLen)%1;if(tod<pt)eodReq='midnight'}skyU();xUpdate(dt);
 if(cut){cut.t+=dt/Math.max(tScale,.05);cut.fn(Math.min(1,cut.t/cut.dur),cut.t);const l=cut.lines.filter(a=>a[0]<=cut.t).pop(),s=$('sub');s.textContent=l?l[1]:'';s.className=/^(WASTED|EXECUTED)$/.test(l?l[1]:'')?'w':'';
  if(cut.t>=cut.dur){const d=cut.done;cut=null;$('w').parentNode.classList.remove('on');$('sub').textContent='';d&&d()}}
 const live=!cut&&!P.dead;shT-=dt;bank.cd-=dt;
 if(live){
  if(K.ArrowLeft)camYaw+=dt*2;if(K.ArrowRight)camYaw-=dt*2;
  if(!P.car&&!P.heli&&!P.plane&&!P.tank&&!P.hide){const fw=(K.KeyW|0)-(K.KeyS|0),rt=(K.KeyD|0)-(K.KeyA|0);let mx=sin(camYaw)*fw-cos(camYaw)*rt,mz=cos(camYaw)*fw+sin(camYaw)*rt;const l=Math.hypot(mx,mz);let sp=0;
   if(l){mx/=l;mz/=l;P.h=Math.atan2(mx,mz);sp=(K.ShiftLeft?9:5.5)*(CFG.god&&(P.y||0)>.5?2.2:1)*(P.crouch?.5:1)*((P.y||0)<-.2?.45:1);P.x+=mx*sp*dt;P.z+=mz*sp*dt}
   if(zoom<.1||scoped)P.h=camYaw;if(cw=='sniper'?K.mDown:K.M)shoot();K.mDown=0;P.jr=K.spDown||K.Space;K.spDown=0;push(P,.5);footY(dt);P.ph=(P.ph||0)+dt*sp*1.6;P.g.l[0].rotation.x=sin(P.ph)*.8*!!sp;P.g.l[1].rotation.x=-sin(P.ph)*.8*!!sp;
   P.g.a[0].rotation.x=-sin(P.ph)*.7*!!sp;P.g.a[1].rotation.x=shT>.08?-1.5:sin(P.ph)*.7*!!sp;P.g.position.set(P.x,P.y||0,P.z);P.g.rotation.y=P.h;emoteU()}
  else if(P.car){const c=P.car,fw=(K.KeyW|0)-(K.KeyS|0),st=(K.KeyA|0)-(K.KeyD|0);
   if(fw>0)c.v+=14*dt;else if(fw<0)c.v+=(c.v>0?-26:-10)*dt;if(K.Space)c.v*=1-3*dt;c.v*=1-.35*dt;c.v=Math.max(-9,Math.min(26,c.v));
   c.h+=st*dt*1.9*Math.max(-1,Math.min(1,c.v/6));if(performance.now()-mvT>1500){let d=c.h-camYaw;d=Math.atan2(sin(d),cos(d));camYaw+=d*Math.min(1,dt*2.5)}P.x=c.x;P.z=c.z;P.h=c.h;if(K.M&&cw!='sniper')shoot()}
  if(P.hp<100&&heat<=0)P.hp=Math.min(100,P.hp+dt*.8);
  if(P.hp<=0)wasted()}
 /* cars */
 for(const c of cars){carLod(c);if(c.sv&&P.car!==c)svAI(c,dt);if(c.ai){let tv=9;const ahead=(sx,sz)=>{const dx=P.x-c.x,dz=P.z-c.z,f=dx*sx+dz*sz;return f>0&&f<10&&Math.abs(dx*sz-dz*sx)<2.2};
   const sx=sin(c.h),sz=cos(c.h);if(P.car!==c&&ahead(sx,sz))tv=0;c.v=ease(c.v,tv,Math.min(1,dt*3));
   if(!c.seg)aiCarPlace(c);const u=(c.ax?c.z:c.x)+c.d*c.v*dt;if(c.ax)c.z=u;else c.x=u;if(u>c.seg.b-7||u<c.seg.a+7)aiCarEnd(c);else if(P.car!==c&&Math.abs(c.x-P.x)+Math.abs(c.z-P.z)>240)aiCarPlace(c)}
  else{c.x+=sin(c.h)*c.v*dt;c.z+=cos(c.h)*c.v*dt;if(push(c,1.7)){if(Math.abs(c.v)>6){shake=.5;snd(90,.2,'sawtooth',.08)}c.dmg=(c.dmg||0)+Math.max(0,Math.abs(c.v)-4)*2.5;c.v*=-.35}if(c!==P.car)c.v*=1-2*dt}
  {const iw=inWater(c.x,c.z);if(iw){c.v*=1-2.5*dt;if(c===P.car){P.hp-=dt*6;hit('water')}}c.g.position.set(c.x,iw?-.9:Math.max(0,terrH(c.x,c.z)),c.z)}c.g.rotation.y=c.h;if(c.g.wh&&Math.abs(c.v)>.05)for(const w of c.g.wh)w.rotation.x+=c.v*dt/.37;
  if(Math.abs(c.v)>3)for(const e of peds.concat(cops,ENM.filter(q=>!q.isVeh)))if(!e.dead&&Math.hypot(e.x-c.x,e.z-c.z)<1.9){kill(e,sin(c.h),cos(c.h),1,c===P.car);c.v*=.96;if(c===P.car)shake=.4}
  if(c.ai&&c.v>4&&!P.car&&!P.dead&&(P.y||0)<1.2&&dist(c,P)<1.8){P.hp-=30;hit('car');P.x+=sin(c.h)*3;P.z+=cos(c.h)*3;shake=.6}}
 /* peds */
 for(const e of peds){if(e.dead){if((e.dt+=dt)>30){e.dead=2}continue}if(e.hostile){foeAI(e,dt);continue}if(e.avenger)continue;
  let sp=e.sp,dx,dz;if(e.fl>0){e.fl-=dt;dx=e.fx;dz=e.fz;sp=7}else{dx=e.tx-e.x;dz=e.tz-e.z;const l=Math.hypot(dx,dz);if(l<.6){newT(e);continue}dx/=l;dz/=l}
  e.x+=dx*sp*dt;e.z+=dz*sp*dt;push(e,.4);e.ph+=dt*sp*2.2;e.g.rotation.y=Math.atan2(dx,dz);e.g.position.set(e.x,0,e.z);pedLod(e);
  const s=sin(e.ph)*.8;e.g.l[0].rotation.x=s;e.g.l[1].rotation.x=-s;e.g.a[0].rotation.x=-s*.8;e.g.a[1].rotation.x=s*.8;if(e.fl>0)e.g.a[0].rotation.x=e.g.a[1].rotation.x=-2.5}
 for(let i=peds.length-1;i>=0;i--)if(peds[i].dead==2){sc.remove(peds[i].g);peds.splice(i,1);mkPed()}
 for(const e of peds)if(!e.dead&&!e.hostile&&!e.avenger&&Math.abs(e.x-P.x)+Math.abs(e.z-P.z)>260)pedPlace(e)
 /* cops */
 const stars=Math.min(5,Math.floor(heat));
 if(stars>0&&!P.dead&&!copsOff&&!IN&&unseen<8&&cops.filter(c=>!c.dead).length<stars*2)mkCop();
 copsU(dt,stars,live);
 /* fx */
 for(const p of PP)if(p.l>0){p.l-=dt;if(p.v.lengthSq()>0){p.v.y-=22*dt;p.m.position.addScaledVector(p.v,dt);if(p.m.position.y<p.s/2){p.m.position.y=p.s/2;p.v.set(0,0,0);if(p.s<.25)p.m.scale.y=.1}}if(p.l<=0)p.m.visible=false}
 for(let i=TR.length-1;i>=0;i--)if((TR[i].t-=dt)<=0){sc.remove(TR[i].m);TR.splice(i,1)}
 MK.forEach(m=>m.position.y=.2+sin(performance.now()/300)*.1);
 /* hud */
 const pr=ptxt();
 if(live)txt('pr',pr);
 hudU(dt,stars);
 if(!cut)$('sir').style.opacity=stars?1:0;
 /* camera */
 const fp=(zoom<.1||scoped)&&!cut;P.g.visible=!P.car&&!P.heli&&!P.plane&&!P.tank&&!fp;
 if(!cut){const c=P.car||P.heli||P.plane||P.tank||P,d=Math.min(IN?4.4:1e9,zoom*(P.car?13:P.tank?17:P.heli?19:P.plane?(P.plane.kind=='jet'?40:24):8.5)),cp=cos(camPitch);
  if(fp){const hy=(c.y||0)+(P.car?1.5:P.plane?(P.plane.kind=='jet'?3.6:2.4):P.tank?2.6:1.55),la=.45-camPitch;cam.position.set(c.x+sin(camYaw)*.2,hy,c.z+cos(camYaw)*.2);cam.lookAt(c.x+sin(camYaw)*cos(la)*5,hy+sin(la)*5,c.z+cos(camYaw)*cos(la)*5)}
  else{const des=new T.Vector3(c.x-sin(camYaw)*cp*d,(c.y||0)+Math.max(.5,1.3+sin(camPitch)*d),c.z-cos(camYaw)*cp*d);if(IN)des.y=Math.min(des.y,(IN===CAS?4.5:3.5)-.45);cam.position.lerp(des,1-Math.exp(-dt*8));if(IN)push(cam.position,.35);else if(!P.roof&&!P.plane)push(cam.position,.7);cam.lookAt(c.x,(c.y||0)+1.2,c.z)}
  shake=Math.max(0,shake-dt*1.5);cam.position.x+=rr(-1,1)*shake*.4;cam.position.y+=rr(-1,1)*shake*.4}
 sunPlace();mmDraw()}
