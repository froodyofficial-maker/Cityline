/* ---- rooftops / gibs / doorstep ---- */
let lockFail=0;const locked=()=>!!document.pointerLockElement;
function reLock(){if(started&&mode=='play'&&!locked()&&!lockFail)try{const r=cvs.requestPointerLock({unadjustedMovement:true});if(r&&r.catch)r.catch(()=>{try{cvs.requestPointerLock()}catch(x){}})}catch(x){}}
document.addEventListener('pointerlockerror',()=>{lockFail=1;msg('Mouse lock is blocked here - just move the mouse to turn the camera','#ffb02b')});
document.addEventListener('pointerlockchange',()=>{if(locked())lockFail=0});
function clampRoof(){const b=P.roof.b;P.x=Math.max(b.x1,Math.min(b.x2,P.x));P.z=Math.max(b.z1,Math.min(b.z2,P.z))}
function dropRoof(){if(P.hide){const d=P.hide;P.hide=null;d.occ=0}if(P.tank){const t=P.tank;P.tank=null;t.driven=0;P.x=t.x+3;P.z=t.z}if(P.plane){const q=P.plane;P.plane=null;q.occ=0;P.x=q.x+3;P.z=q.z}if(P.heli){const h=P.heli;P.heli=null;h.occ=0;P.x=h.x+3;P.z=h.z}if(P.roof){P.x=P.roof.x;P.z=P.roof.z;P.roof=null}P.y=0}
function climb(l,up){const hh=l.roofY;P.g.visible=true;P.h=PI/2;
 cutscene(1.2+hh/16,(p,t)=>{const k=up?p:1-p;P.y=hh*k;P.x=l.x;P.z=l.z;P.g.position.set(l.x,P.y,l.z);P.g.rotation.y=PI/2;const q=sin(t*9)*.8;P.g.l[0].rotation.x=q;P.g.l[1].rotation.x=-q;P.g.a[0].rotation.x=-2.6+q*.5;P.g.a[1].rotation.x=-2.6-q*.5;cam.position.set(l.x-5,P.y+2,l.z+1.5);cam.lookAt(l.x,P.y+1,l.z)},[],
 ()=>{P.g.a[0].rotation.x=P.g.a[1].rotation.x=0;if(up){P.roof=l;P.roofT=performance.now();P.x=l.ex.x+1.2;P.z=l.z;P.y=hh;camYaw=PI/2;msg('ROOFTOP SNIPER NEST','#2bf0ff')}else{P.roof=null;P.y=0;P.x=l.x;P.z=l.z;camYaw=-PI/2}})}
const BP=[];
function bodyParts(x,z,n,pow,y0){const cl=[0xe0ac69,0xe8452c,0xe8452c,0x2b2f3a,0x2b2f3a,0xe0ac69],sz=[[.34,.34,.34],[.5,.55,.3],[.17,.5,.2],[.17,.5,.2],[.2,.45,.2],[.17,.5,.2]];
 for(let i=0;i<n*(CFG.gore>1.5?2:1);i++){const j=i%6,q=sz[j],m=new T.Mesh(geo(q[0],q[1],q[2]),mat(cl[j]));m.position.set(x,y0||1,z);m.castShadow=true;sc.add(m);BP.push({m,v:new T.Vector3(rr(-1,1)*pow,rr(5,12)*pow/8,rr(-1,1)*pow),w:new T.Vector3(rr(-9,9),rr(-9,9),rr(-9,9)),tr:0,s:q[1]})}}
function bloodBurst(x,z,n,y0){y0=y0||0;for(let i=0;i<n*Math.min(1,CFG.gore);i++)part(x,y0+rr(.5,2),z,rr(-8,8),rr(6,18),rr(-8,8),rr(.1,.3),ri(BL),rr(8,16));if(CFG.gore>1.5)for(let i=0;i<n*1.2;i++)part(x,y0+rr(.5,2),z,rr(-10,10),rr(5,16),rr(-10,10),rr(.14,.38),ri(ORG),80)}
function bpUpdate(dt){for(const p of BP){if(p.rest)continue;const m=p.m;p.v.y-=22*dt;m.position.addScaledVector(p.v,dt);m.rotation.x+=p.w.x*dt;m.rotation.y+=p.w.y*dt;m.rotation.z+=p.w.z*dt;
  if((p.tr-=dt)<=0){p.tr=.05;part(m.position.x,m.position.y,m.position.z,rr(-1,1),rr(0,2),rr(-1,1),rr(.08,.16),ri(p.fire?FIRE:BL),rr(5,10))}
  if(m.position.y<p.s/2){m.position.y=p.s/2;if(p.v.y<-4){p.v.y*=-.35;p.v.x*=.6;p.v.z*=.6;p.w.multiplyScalar(.6);if(!p.fire)splat(m.position.x,m.position.z,rr(.5,1.1));for(let k=0;k<6;k++)part(m.position.x,.2,m.position.z,rr(-3,3),rr(2,6),rr(-3,3),rr(.08,.18),ri(p.fire?FIRE:BL),rr(6,12))}
   else{p.rest=1;p.v.set(0,0,0);if(!p.fire)splat(m.position.x,m.position.z,rr(.6,1.2))}}}
 while(BP.length>150)sc.remove(BP.shift().m)}
function doorstep(){const g=new T.Group();bx(.5,.6,.35,0xc89a5a,0,.3,0,g);bx(.5,.15,.36,0xffffff,0,.65,0,g);g.position.set(OX+rr(-.8,.8),0,OZ+8.2);g.rotation.y=rr(-.4,.4);sc.add(g);snd(300,.08,'square',.05);setTimeout(()=>snd(300,.08,'square',.05),160);setTimeout(()=>sc.remove(g),9000)}
