/* ---- helicopters & bombing ---- */

const helis=[],BOMBS=[],EXP=[],SCO=[];let bcd=0;
function groundH(x,z){let g=Math.max(0,terrH(x,z));for(const b of bNear(x,z,x,z))if(x>b.x1&&x<b.x2&&z>b.z1&&z<b.z2)g=Math.max(g,b.h+.06);return g}
function mkHeli(x,y,z,h,col){const g=new T.Group();g.rotation.order='YXZ';const pm=paintM(col),dk=TRIMM,add=(geo,m,px,py,pz)=>{const q=new T.Mesh(geo,m);q.position.set(px,py,pz);q.castShadow=true;g.add(q);return q};
 add(new T.SphereGeometry(1,20,14).scale(1.2,1.02,2.25),pm,0,1.45,.1);add(new T.SphereGeometry(1,18,12).scale(1.02,.86,1.15),GLASSM,0,1.62,1.05);add(new T.CylinderGeometry(.2,.4,4.8,12).rotateX(PI/2),pm,0,1.72,-3.4);
 add(new T.BoxGeometry(.12,1.35,.75),pm,0,2.32,-5.65);add(new T.BoxGeometry(1.7,.08,.42),pm,0,1.78,-5.15);add(new T.BoxGeometry(1,.52,1.7),dk,0,2.42,-.25);add(new T.CylinderGeometry(.16,.16,.3,10),dk,0,2.75,0);
 for(const q of[-1,1]){add(new T.CylinderGeometry(.06,.06,3.9,8).rotateX(PI/2),dk,q*.95,.1,.1);add(new T.BoxGeometry(.07,.75,.07),dk,q*.8,.45,.95);add(new T.BoxGeometry(.07,.75,.07),dk,q*.8,.45,-.8)}
 nb(.22,.14,.08,0xff2222,0,2.1,-5.95,g);nb(.1,.1,.1,0x22ff44,1.18,1.4,.4,g);nb(.1,.1,.1,0xff2222,-1.18,1.4,.4,g);
 const rotor=new T.Group();rotor.position.y=2.92;const bl=new T.BoxGeometry(9.4,.05,.36);for(const a of[0,PI/2]){const b=new T.Mesh(bl,dk);b.rotation.y=a+.3;b.castShadow=true;rotor.add(b)}g.add(rotor);
 const tr=new T.Group();tr.position.set(.22,2.32,-5.65);bx(.06,1.5,.18,0x222222,0,0,0,tr);g.add(tr);sc.add(g);
 const hl={g,rotor,tr,x,y,z,h,v:0,vy:0,rot:0,occ:0,snT:0};helis.push(hl);return hl}
mkHeli(-9,.05,18,PI/2,0xe8452c);mkHeli(0,16.06,0,0,0x2b6fd0);
const nearHeli=()=>helis.find(q=>!q.locked&&Math.hypot(q.x-P.x,q.z-P.z)<4.5&&Math.abs(q.y-(P.y||0))<3.5);
function enterHeli(q){P.heli=q;q.occ=1;P.roof=null;P.g.visible=false;P.y=q.y;msg('HELICOPTER - SPACE UP / SHIFT DOWN / LMB or B = BOMB','#2bf0ff')}
function exitHeli(){const q=P.heli,gy=groundH(q.x,q.z);if(q.y-gy>2.5)return msg('Land first - hold SHIFT to descend','#ffb02b');let l=null;
 if(gy>0){l=ladders.find(l=>Math.abs(l.roofY-gy)<.3&&q.x>l.b.x1-1&&q.x<l.b.x2+1&&q.z>l.b.z1-1&&q.z<l.b.z2+1);if(!l)return msg('Cannot exit on this roof','#ffb02b')}
 P.heli=null;q.occ=0;P.g.visible=true;P.x=q.x+cos(q.h)*2.8;P.z=q.z-sin(q.h)*2.8;P.y=gy;if(l){P.roof=l;P.roofT=performance.now();clampRoof()}}
function heliU(dt){bcd-=dt;for(const q of helis){const mine=P.heli===q&&!cut&&!P.dead;
  if(mine){const fw=(K.KeyW|0)-(K.KeyS|0),st=(K.KeyA|0)-(K.KeyD|0),up=(K.Space|0)-((K.ShiftLeft|0)||(K.KeyC|0));
   q.v+=((fw>0?24:fw<0?-9:0)-q.v)*Math.min(1,dt*(fw?1.5:.7));q.h+=st*dt*1.7;q.vy+=(up*10-q.vy)*Math.min(1,dt*3);q.rot=Math.min(1,q.rot+dt);
   q.x+=sin(q.h)*q.v*dt;q.z+=cos(q.h)*q.v*dt;q.y=Math.min(150,q.y+q.vy*dt);
   for(const b of bNear(q.x-3,q.z-3,q.x+3,q.z+3))if(q.y<b.h-.3&&q.x>b.x1-2.5&&q.x<b.x2+2.5&&q.z>b.z1-2.5&&q.z<b.z2+2.5){const d=[q.x-(b.x1-2.5),b.x2+2.5-q.x,q.z-(b.z1-2.5),b.z2+2.5-q.z],m=Math.min(...d);if(m==d[0])q.x=b.x1-2.5;else if(m==d[1])q.x=b.x2+2.5;else if(m==d[2])q.z=b.z1-2.5;else q.z=b.z2+2.5;if(Math.abs(q.v)>8){shake=.6;snd(90,.2,'sawtooth',.08)}q.v*=-.3}
   q.x=Math.max(-118,Math.min(345,q.x));q.z=Math.max(-118,Math.min(118,q.z));
   if(performance.now()-mvT>1500){let d=q.h-camYaw;d=Math.atan2(sin(d),cos(d));camYaw+=d*Math.min(1,dt*2)}
   if((q.snT-=dt)<=0){q.snT=.2;snd(70,.2,'square',.015)}
   if((K.M||K.KeyB)&&bcd<=0)dropBomb(q);P.x=q.x;P.z=q.z;P.y=q.y;P.h=q.h}
  else{q.rot=Math.max(0,q.rot-dt*.4);q.v*=1-dt;q.vy=0;if(!q.occ&&q.y>groundH(q.x,q.z)+.06)q.y=Math.max(groundH(q.x,q.z)+.06,q.y-8*dt)}
  const gy=groundH(q.x,q.z)+.06;if(q.y<gy){q.y=gy;q.vy=Math.max(0,q.vy)}
  q.g.position.set(q.x,q.y,q.z);q.g.rotation.set(q.v*.012,q.h,mine?-((K.KeyA|0)-(K.KeyD|0))*.18:0);q.rotor.rotation.y+=q.rot*dt*38;q.tr.rotation.x+=q.rot*dt*38}}
function dropBomb(q){bcd=.45;const m=new T.Group();bx(.45,.45,1.1,0x2a2a30,0,0,0,m);bx(.5,.1,.4,0xff3b3b,0,0,-.6,m);m.position.set(q.x,q.y-.8,q.z);sc.add(m);BOMBS.push({m,vx:sin(q.h)*q.v,vz:cos(q.h)*q.v,vy:0});heat=Math.max(heat+.8,1.5);dS.bombs++;snd(300,.4,'sine',.06)}
function scorch(x,z){const m=new T.Mesh(new T.CircleGeometry(rr(3,5),14),new T.MeshBasicMaterial({color:0x050505,transparent:true,opacity:.7}));m.rotation.x=-PI/2;m.position.set(x,.11,z);sc.add(m);SCO.push(m);if(SCO.length>14)sc.remove(SCO.shift())}
function explode(x,y,z,net){if(!net)mpBoom(x,y,z);const mk=(g,c,o)=>{const m=new T.Mesh(g,new T.MeshBasicMaterial({color:c,transparent:true,opacity:o,side:T.DoubleSide}));m.position.set(x,y,z);sc.add(m);return m};
 const fb=mk(new T.SphereGeometry(1,12,8),0xffa030,.95),ring=mk(new T.RingGeometry(.9,1,32),0xffffff,.7),sm=mk(new T.SphereGeometry(1,10,8),0x333038,.8);ring.rotation.x=-PI/2;ring.position.y=y+.3;EXP.push({fb,ring,sm,t:0,y});
 snd(60,.9,'sawtooth',.2);snd(35,1.3,'square',.12);const dc=Math.hypot(x-cam.position.x,z-cam.position.z);shake=Math.max(shake,Math.min(2.2,45/Math.max(8,dc)));scorch(x,z);
 for(let k=0;k<45;k++)part(x,y+.5,z,rr(-10,10),rr(4,17),rr(-10,10),rr(.15,.42),ri([mat(0xff8a2b),mat(0xffd23f),mat(0x333333)]),rr(1,3));
 for(const e of peds.concat(cops,clerks,SOL,ENM)){if(e.dead||(e.st&&e.st!==IN))continue;if(e.isVeh){if(Math.hypot(e.x-x,e.z-z)<9){e.hp-=30;if(e.hp<=0)kill(e)}continue}const dx=e.x-x,dz=e.z-z,d=Math.hypot(dx,dz)||1;
  if(d<13&&(y<6||d<5)){const w=d<8;kill(e,dx/d*1.4,dz/d*1.4,1,1);bloodBurst(e.x,e.z,w?35:15);if(w){bodyParts(e.x,e.z,7,14,1);e.g.visible=false}}}
 for(const c of cars){if(Math.hypot(c.x-x,c.z-z)<10&&!c.wreck){c.wreck=1;c.ai=0;c.v*=.2;c.g.traverse(o=>{if(o.isMesh&&o.material&&(o.material.isMeshLambertMaterial||o.material.isMeshStandardMaterial))o.material=mat(0x1a1a1a)});if(P.car===c){P.hp-=45;hit('bomb')}}}
 const pd=Math.hypot(P.x-x,P.z-z);if(!P.heli&&!P.tank&&pd<10&&Math.abs((P.y||0)-y)<6){P.hp-=(10-pd)*9;hit('bomb');shake=1}}
function bombU(dt){for(let i=BOMBS.length-1;i>=0;i--){const b=BOMBS[i],p=b.m.position;b.vy-=26*dt;p.x+=b.vx*dt;p.z+=b.vz*dt;p.y+=b.vy*dt;b.m.rotation.x=Math.atan2(-b.vy,14)*.6;const g=groundH(p.x,p.z);if(p.y<=g){explode(p.x,g,p.z);sc.remove(b.m);BOMBS.splice(i,1)}}
 for(let i=EXP.length-1;i>=0;i--){const e=EXP[i],q=e.t+=dt;e.fb.scale.setScalar(1+q*16);e.fb.material.opacity=Math.max(0,.95-q*1.1);e.fb.position.y=e.y+e.fb.scale.x*.4;e.ring.scale.setScalar(1+q*26);e.ring.material.opacity=Math.max(0,.7-q*.9);
  e.sm.position.y=e.y+2+q*5;e.sm.scale.set(2+q*3,2+q*4,2+q*3);e.sm.material.opacity=Math.max(0,.8-q*.22);if(q>3.6){for(const o of[e.fb,e.ring,e.sm])sc.remove(o);EXP.splice(i,1)}}}
let lastWc='';function hudX(){$('cpl').textContent=CFG.copLimit>50?'INF':CFG.copLimit;const t=P.heli?'heli':cw+'|'+ammo[cw];if(t!==lastWc){lastWc=t;$('wc').innerHTML=P.heli?si('heli',24)+' BOMBS INF':si(cw,24)+' '+WP[cw].n+' '+ammo[cw]}
 const h=$('hel');h.style.display=(P.heli||P.plane||P.tank)?'block':'none';if(P.tank)h.innerHTML='TANK HP '+Math.max(0,Math.round(P.tank.hp/40*100))+'%<br>LMB = FIRE SHELL';else if(P.plane&&!P.heli)h.innerHTML=planeHud();else if(P.heli)h.innerHTML='ALT '+Math.round(P.y)+'M<br>SPD '+Math.round(Math.abs(P.heli.v)*3.6)+'<br>LMB / B = BOMB'}
/* ---- airport & airplanes ---- */
const planes=[],FIRES=[],ORG=[mat(0xd96a7a),mat(0x8a1020),mat(0xcf3a4a),mat(0xb0a0a8),mat(0xe8908a)],FIRE=[mat(0xff8a2b),mat(0xffd23f),mat(0x333333),mat(0xff4f2b)],PR=[];
(function(){const F=(x,z,w,d,c,y)=>{const f=new T.Mesh(new T.PlaneGeometry(w,d),mat(c));f.rotation.x=-PI/2;f.position.set(x,y,z);f.receiveShadow=true;sc.add(f)};
 F(230,20,220,12,0x30333a,.02);F(230,-20,220,12,0x30333a,.02);F(200,-15,140,62,0x4a4a52,.025);F(240,-56,200,20,0x2a2a30,.03);
 for(let i=0;i<16;i++)nb(8,.02,.5,0xffffff,150+i*12,.05,-56);for(let j=0;j<6;j++)nb(5,.02,.6,0xffffff,146,.05,-56+(j-2.5)*2.4);nb(200,.02,.3,0xffffff,240,.05,-46.8);nb(200,.02,.3,0xffffff,240,.05,-65.2);
 for(let i=0;i<20;i++)for(const z of[-46.2,-65.8])nb(.4,.5,.4,0xffe27a,142+i*10,.25,z);nb(110,.02,.25,0xffd23f,200,.05,-30);nb(.25,.02,30,0xffd23f,160,.05,-31);nb(.25,.02,30,0xffd23f,225,.05,-31);
 WK=2;wall(50,9,16,0x7fa8c8,190,38);foot(190,38,50,16,9);let q=nsign('EMBER INTL','#37e6ff',190,6.5,29.9,14);q.rotation.y=PI;
 WK=0;wall(6,26,6,0xcfd4da,140,44);wall(10,5,10,0x2a3a4a,140,44,26);foot(140,44,10,10,31);nb(.8,.8,.8,0xff2222,140,32.5,44);
 WK=4;for(const x of[285,315]){wall(24,10,20,0x8a8f99,x,34);foot(x,34,24,20,10);nb(14,6,.1,0xffe27a,x,3.1,23.9)}
 for(const z of[14,26])bx(.4,9,.4,0x333333,128,4.5,z,sc);q=nsign('AIRPORT','#ffd23f',128.3,8,20,12);q.rotation.y=-PI/2;
 bx(.2,6,.2,0x888888,255,3,-72,sc);const ws=new T.Mesh(new T.ConeGeometry(.8,3,8),mat(0xff8a2b));ws.rotation.z=PI/2;ws.position.set(256.5,6,-72);sc.add(ws)})();
function mkPlane(kind,x,z,h){const g=new T.Group();g.rotation.order='YXZ';let prop=null,pass,len;const add=(geo,m,px,py,pz)=>{const q=new T.Mesh(geo,m);q.position.set(px,py,pz);q.castShadow=true;g.add(q);return q};
 const flat=(pts,dep)=>{const sh=new T.Shape();pts.forEach((p,i)=>i?sh.lineTo(p[0],p[1]):sh.moveTo(p[0],p[1]));return new T.ExtrudeGeometry(sh,{depth:dep,bevelEnabled:false})};
 if(kind=='jet'){const W=paintM(0xeef1f5),B2=paintM(0x2b6fd0),Gm=STD({color:0xb4bcc6,roughness:.35,metalness:.7});
  add(new T.CylinderGeometry(1.25,1.25,12.4,20).rotateX(PI/2),W,0,2.4,0);add(new T.SphereGeometry(1.25,20,12,0,PI*2,0,PI/2).scale(1,1.9,1).rotateX(PI/2),W,0,2.4,6.2);add(new T.ConeGeometry(1.25,4.6,20).rotateX(-PI/2),W,0,2.62,-8.5);
  add(flat([[-1.1,1.8],[1.1,1.8],[8.3,-2.3],[8.3,-3.3],[1.1,-1.1],[-1.1,-1.1],[-8.3,-3.3],[-8.3,-2.3]],.24).rotateX(PI/2),Gm,0,1.95,0);
  add(flat([[-.6,0],[.6,0],[3.4,-1.6],[3.4,-2.2],[.6,-1.1],[-.6,-1.1],[-3.4,-2.2],[-3.4,-1.6]],.14).rotateX(PI/2),Gm,0,3.05,-7.6);
  add(flat([[0,0],[-2.6,0],[-3.7,3.7],[-2.5,3.7]],.22).translate(0,0,-.11).rotateY(-PI/2),B2,0,3.1,-6.6);
  for(const q of[-4,4]){add(new T.CylinderGeometry(.6,.52,2.8,16).rotateX(PI/2),Gm,q,1.45,.6);add(new T.CircleGeometry(.5,16),TRIMM,q,1.45,2.01);add(new T.BoxGeometry(.18,.5,1.2),Gm,q,1.85,.4)}
  for(const q of[-1,1]){add(new T.BoxGeometry(.04,.26,9.6),GLASSM,q*1.245,2.78,-.6);add(new T.BoxGeometry(.04,.12,12.2),B2,q*1.25,2.12,0)}add(new T.BoxGeometry(1.7,.36,.7).rotateX(-.5),GLASSM,0,3.12,6.05);
  for(const[q,zz]of[[-1.3,1.6],[1.3,1.6],[0,7]]){add(new T.BoxGeometry(.12,1.1,.12),TRIMM,q,.85,zz);add(new T.CylinderGeometry(.32,.32,.28,12).rotateZ(PI/2),TIREM,q,.32,zz)}
  nb(.3,.3,.3,0xff2222,-8.3,1.95,-2.8,g);nb(.3,.3,.3,0x22ff44,8.3,1.95,-2.8,g);nb(.2,.2,.2,0xffffff,0,6.4,-9.4,g);pass=24;len=14}
 else{const W=paintM(0xffffff),Rd=paintM(0xd03030);
  add(new T.CylinderGeometry(.62,.42,5.6,12).rotateX(PI/2),W,0,1.45,-.3);add(new T.CylinderGeometry(.72,.66,1.3,14).rotateX(PI/2),Rd,0,1.45,3.0);add(new T.SphereGeometry(.24,10,8),TRIMM,0,1.45,3.7);
  add(new T.BoxGeometry(1.2,.55,1.5),GLASSM,0,2.05,1.25);add(new T.BoxGeometry(10.4,.14,1.55),Rd,0,2.36,.75);for(const q of[-1,1])add(new T.BoxGeometry(.08,1.05,.12).rotateZ(q*.5),TRIMM,q*1.05,1.85,.9);
  add(flat([[0,0],[-1.4,0],[-1.9,1.5],[-1.1,1.5]],.12).translate(0,0,-.06).rotateY(-PI/2),Rd,0,1.6,-2.5);add(new T.BoxGeometry(3.2,.1,.8),W,0,1.62,-2.9);
  prop=new T.Group();prop.position.set(0,1.45,3.78);bx(2.8,.2,.08,0x222222,0,0,0,prop);g.add(prop);
  for(const[q,zz]of[[-.8,.8],[.8,.8],[0,3]]){add(new T.BoxGeometry(.08,.7,.08),TRIMM,q,.5,zz);add(new T.CylinderGeometry(.24,.24,.16,10).rotateZ(PI/2),TIREM,q,.24,zz)}pass=2;len=6}
 g.position.set(x,0,z);g.rotation.y=h;sc.add(g);const pl={g,kind,x,y:0,z,h,pitch:0,roll:0,sp:0,thr:0,occ:0,crashed:0,prop,pass,len,x0:x,z0:z,h0:h,cp:0,cy:0,vy:0,wide:kind=='jet'?5:3,wn:0};planes.push(pl);return pl}
mkPlane('jet',185,-22,PI/2);mkPlane('jet',230,-22,PI/2);mkPlane('cessna',160,-36,PI/2);mkPlane('cessna',215,-36,PI/2);
const nearPlane=()=>planes.find(p=>!p.locked&&!p.crashed&&Math.hypot(p.x-P.x,p.z-P.z)<(p.kind=='jet'?9:5)&&Math.abs(p.y-(P.y||0))<4&&p.sp<4);
function enterPlane(p){P.plane=p;p.occ=1;P.roof=null;P.g.visible=false;msg('AIRPLANE - W/S THROTTLE, SPACE NOSE UP, SHIFT NOSE DOWN, A/D TURN','#2bf0ff')}
function exitPlane(){const p=P.plane;if(p.sp>4||p.y>groundH(p.x,p.z)+.4)return msg('Stop on the ground first','#ffb02b');P.plane=null;p.occ=0;P.g.visible=true;P.x=p.x+cos(p.h)*(p.kind=='jet'?5:3.5);P.z=p.z-sin(p.h)*(p.kind=='jet'?5:3.5);P.y=0}
const planeHud=()=>{const p=P.plane;return'SPD '+Math.round(p.sp*3.6)+' KMH<br>ALT '+Math.round(p.y)+'M<br>THR '+Math.round(p.thr*100)+'%<br>PASSENGERS '+p.pass};
const planePrompt=()=>{const p=P.plane;return p.sp<4&&p.y<1?'F - Exit airplane   (W = throttle up)':'SPACE nose up - SHIFT nose down - A/D turn - W/S throttle'};
function debris(x,y,z,n){const cl=[0xe8ecf2,0xcfd6df,0x2b6fd0,0x888c96,0x1a1a1a],sz=[[3,.3,1.4],[1.2,1.2,2.5],[.4,2.2,1.2],[2,.25,1],[.8,.8,.8]];
 for(let i=0;i<n;i++){const j=i%5,q=sz[j],m=new T.Mesh(geo(q[0],q[1],q[2]),mat(cl[j]));m.position.set(x+rr(-2,2),y+1,z+rr(-2,2));m.castShadow=true;sc.add(m);BP.push({m,v:new T.Vector3(rr(-1,1)*18,rr(6,18),rr(-1,1)*18),w:new T.Vector3(rr(-6,6),rr(-6,6),rr(-6,6)),tr:0,s:Math.min(q[1],q[0])*.6+.1,fire:1})}}
function crashPlane(p,cause){if(p.crashed)return;p.crashed=1;const x=p.x,y=Math.max(p.y,.5),z=p.z,gy=groundH(x,z);snd(50,2,'sawtooth',.25);
 for(let i=0;i<4;i++)setTimeout(()=>explode(x+rr(-5,5),Math.min(y,gy+6),z+rr(-5,5)),i*140);explode(x,Math.min(y,gy+6),z);
 p.g.visible=false;debris(x,y,z,p.kind=='jet'?22:12);let ry=y;if(cause==2)for(const b of B){const e=p.wide;if(x>b.x1-e&&x<b.x2+e&&z>b.z1-e&&z<b.z2+e)ry=Math.max(2,Math.min(y,b.h-1.5))}ragdolls(x,ry,z,p.pass,sin(p.h),cos(p.h),Math.min(70,p.sp*(cause==2?1.15:.6)+(cause==2?10:4)));bodyParts(x,z,p.pass,16,y+1);bloodBurst(x,z,40+p.pass*5);hurt=1;shake=2.5;heat=Math.max(heat,4);
 for(let i=0;i<4;i++)bx(rr(1,2.4),rr(.6,1.4),rr(2,5),0x151515,x+rr(-4,4),.5,z+rr(-4,4),sc);FIRES.push({x,z,t:30});msg('AIRPLANE DESTROYED','#ff3b3b');
 if(P.plane===p){P.plane=null;p.occ=0;P.x=x;P.z=z;P.y=0;P.g.visible=false;P.dead=1;bodyParts(x,z,6,14,y+1);
  const hs=RAG.slice(RAG.length-p.pass);let hi=0;const cp=new T.Vector3(x+14,y+4,z+14);
  cutscene(9,(pp,t)=>{tScale=t<5?.3:1;const now=performance.now();while(hs[hi]&&hs[hi].when&&now-hs[hi].when>1700)hi++;const h=hs[hi];
   if(h){const des=new T.Vector3(h.x-h.dx*9-h.dz*4,h.y+2.8,h.z-h.dz*9+h.dx*4);cp.lerp(des,.16);cam.position.copy(cp);cam.lookAt(h.x,h.y+.6,h.z)}
   else{const a=t*.5;cp.set(x+sin(a)*30,Math.max(9,y*.35+10),z+cos(a)*30);cam.position.copy(cp);cam.lookAt(x,3,z)}},
   [[0,'MAYDAY... MAYDAY...'],[1,'WE ARE GOING DOWN!'],[2.4,'...'],[6.4,'WASTED']],()=>{tScale=1;respawn()})}
 PR.push({t:60,k:p.kind,x:p.x0,z:p.z0,h:p.h0});const i=planes.indexOf(p);if(i>=0)planes.splice(i,1)}
const RAG=[];
function ragdolls(x,y,z,n,fx,fz,spd){for(let i=0;i<n;i++){const g=person(ri(skins),ri(shirts),ri(['#2b2f3a','#5a4a3a','#3a4a5a']),ri(['#222','#4a2f1b','#a0703c']),0),a=rr(0,6.28),pw=rr(8,24);g.position.set(x+rr(-2,2),y+(fx!==undefined?rr(-1,1):rr(0,2)),z+rr(-2,2));
  const v=fx!==undefined?new T.Vector3(fx*spd*rr(.7,1.2)+rr(-5,5),rr(-2,5),fz*spd*rr(.7,1.2)+rr(-5,5)):new T.Vector3(sin(a)*pw,rr(5,22),cos(a)*pw),l=Math.hypot(v.x,v.z)||1;
  RAG.push({g,x:g.position.x,y:g.position.y,z:g.position.z,v,dx:v.x/l,dz:v.z/l,w:new T.Vector3(rr(-9,9),rr(-9,9),rr(-9,9)),dead:0,dt:0,tr:0,sc:rr(0,.9)})}}
const WD=[];let wdI=0;
function wallBlood(x,y,z,nx,nz){for(let k=0;k<6;k++){let m=WD[wdI%90];if(!m){m=new T.Mesh(new T.CircleGeometry(1,10),new T.MeshBasicMaterial({color:0x8a0f14,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}));sc.add(m);WD[wdI%90]=m}wdI++;
  const q=k<2?rr(1.2,2.6):rr(.3,.8);m.scale.set(q,k>=3?q*3.5:q,1);m.position.set(x+nx*.07+(nz?rr(-1.3,1.3):0),y+rr(-1.3,1.3)-(k>=3?q*2:0),z+nz*.07+(nx?rr(-1.3,1.3):0));m.rotation.set(0,Math.atan2(nx,nz),0)}}
function ragU(dt){for(let i=RAG.length-1;i>=0;i--){const r=RAG[i];
  if(r.dead){if((r.dt+=dt)>40){sc.remove(r.g);RAG.splice(i,1)}continue}
  r.v.y-=22*dt;r.x+=r.v.x*dt;r.y+=r.v.y*dt;r.z+=r.v.z*dt;r.g.position.set(r.x,r.y,r.z);r.g.rotation.x+=r.w.x*dt;r.g.rotation.y+=r.w.y*dt;r.g.rotation.z+=r.w.z*dt;
  if((r.sc-=dt)<=0&&r.sc>-.1)snd(rr(700,1100),.9,'sawtooth',.03);if((r.tr-=dt)<=0){r.tr=.05;part(r.x,r.y+.8,r.z,rr(-1,1),rr(0,2),rr(-1,1),rr(.1,.2),ri(BL),rr(6,12))}
  if(!r.hitW)for(const b of bNear(r.x,r.z,r.x,r.z))if(r.x>b.x1&&r.x<b.x2&&r.z>b.z1&&r.z<b.z2&&r.y<b.h&&r.y>.6){const d=[r.x-b.x1,b.x2-r.x,r.z-b.z1,b.z2-r.z],m=Math.min(...d);let nx=0,nz=0;
   if(m==d[0]){nx=-1;r.x=b.x1-.3}else if(m==d[1]){nx=1;r.x=b.x2+.3}else if(m==d[2]){nz=-1;r.z=b.z1-.3}else{nz=1;r.z=b.z2+.3}
   r.hitW=1;r.when=performance.now();wallBlood(nx<0?b.x1:nx>0?b.x2:r.x,r.y,nz<0?b.z1:nz>0?b.z2:r.z,nx,nz);gore({x:r.x,z:r.z,g:r.g,y0:r.y-.8},nx*3,nz*3,true);bloodBurst(r.x,r.z,26,r.y-1);bodyParts(r.x,r.z,6,12,r.y);shake=Math.max(shake,.8);snd(110,.25,'sawtooth',.06);
   r.v.set(nx*2,Math.min(r.v.y,0),nz*2);r.w.multiplyScalar(.3);if(R()<.6){r.g.visible=false;r.gone=1}break}
  const gy=groundH(r.x,r.z);if(r.y<=gy){r.dead=1;r.when=r.when||performance.now();r.y=gy;if(r.gone){r.dt=39;continue}const dx=r.v.x*.05,dz=r.v.z*.05;r.g.position.y=gy+.18;r.g.rotation.set(-PI/2,rr(0,6),0);gore({x:r.x,z:r.z,g:r.g},dx,dz,true);bloodBurst(r.x,r.z,18);if(R()<.55){bodyParts(r.x,r.z,5,10,gy+1);r.g.visible=false}}}}
function planeU(dt){ragU(dt);for(let i=PR.length-1;i>=0;i--){PR[i].t-=dt;if(PR[i].t<=0){const r=PR.splice(i,1)[0];mkPlane(r.k,r.x,r.z,r.h)}}
 for(let i=FIRES.length-1;i>=0;i--){const f=FIRES[i];if((f.t-=dt)<=0){FIRES.splice(i,1);continue}if(f.low&&R()<.75)continue;for(let k=0;k<2;k++)part(f.x+rr(-2.5,2.5),.4,f.z+rr(-2.5,2.5),rr(-1,1),rr(3,8),rr(-1,1),rr(.2,.55),ri(FIRE),rr(.5,1.3))}
 for(const p of planes.slice()){if(p.crashed)continue;const mine=P.plane===p&&!cut&&!P.dead,gy=groundH(p.x,p.z),was=p.y>gy+.15,lift=Math.max(0,Math.min(1,(p.sp-14)/14));
  if(mine){const th=(K.KeyW|0)-(K.KeyS|0);p.thr=Math.max(0,Math.min(1,p.thr+th*dt*.5));p.cp=(K.Space|0)-((K.ShiftLeft|0)||(K.KeyC|0));p.cy=(K.KeyA|0)-(K.KeyD|0);
   if(performance.now()-mvT>1500){let d=p.h-camYaw;d=Math.atan2(sin(d),cos(d));camYaw+=d*Math.min(1,dt*1.5)}}else{p.thr*=1-dt;p.cp=p.cy=0}
  p.sp+=((p.thr*(p.kind=='jet'?52:38))-p.sp)*dt*(was?.3:.28);if(!was&&(!mine||(K.KeyS&&p.thr==0)))p.sp=Math.max(0,p.sp-dt*18);if(!mine&&was)p.sp*=1-dt*.1;
  const maxP=was?.5:(p.sp>20?.45:0),tp=p.cp>0?maxP:p.cp<0?-.5:0;p.pitch+=(tp-p.pitch)*Math.min(1,dt*1.8);p.roll+=((was?-p.cy*.6:0)-p.roll)*Math.min(1,dt*3);p.h+=p.cy*dt*(was?.55*Math.max(.3,lift):.6*Math.min(1,p.sp/10));
  let vy=0;if(was||(p.pitch>.05&&lift>.4))vy=Math.sin(p.pitch)*p.sp*Math.max(.15,lift)-(1-lift)*20;p.vy=vy;p.y=Math.min(170,p.y+vy*dt);p.x+=sin(p.h)*Math.cos(p.pitch)*p.sp*dt;p.z+=cos(p.h)*Math.cos(p.pitch)*p.sp*dt;p.x=Math.max(-118,Math.min(345,p.x));p.z=Math.max(-118,Math.min(118,p.z));
  if(mine&&p.sp<16&&p.y>6&&(p.wn-=dt)<=0){p.wn=3;msg('STALL! Throttle up and nose down','#ff3b3b')}
  const g2=groundH(p.x,p.z),th=terrH(p.x,p.z);let crash=0;if(th>1&&p.y<th+.6&&p.sp>8)crash=2;
  for(const b of bNear(p.x-p.wide,p.z-p.wide,p.x+p.wide,p.z+p.wide)){const e=p.wide;if(p.x>b.x1-e&&p.x<b.x2+e&&p.z>b.z1-e&&p.z<b.z2+e&&p.y<b.h+1){if(p.sp>12)crash=2;else{p.sp=0;p.x-=sin(p.h)*2;p.z-=cos(p.h)*2}}}
  if(p.y<=g2){if(was&&(g2>0||p.vy<-13||p.pitch<-.3||Math.abs(p.roll)>.5))crash=1;p.y=g2;if(p.pitch<0)p.pitch*=1-dt*4}
  if(crash){crashPlane(p,crash);continue}
  p.g.position.set(p.x,p.y,p.z);p.g.rotation.set(-p.pitch,p.h,p.roll);if(p.prop)p.prop.rotation.z+=(p.thr*40+2)*dt;
  if(mine){P.x=p.x;P.z=p.z;P.y=p.y;P.h=p.h}}}
