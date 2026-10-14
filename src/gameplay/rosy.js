/* ==================== Rosy, your golden retriever ====================
   Always at your side. Nothing can hurt her (she is in none of the damage lists). She rides along in any vehicle,
   follows you indoors, waits at the foot of ladders and lifts, sits when you stop (E to pet her),
   barks when the heat goes up, and if you go down she lies beside you and keeps watch until you're back. */
const ROSY=(()=>{const g=new T.Group(),G=0xd9a24a,L=0xecc684,D=0xb07a34,a={g,x:6,z:16,h:0,ph:0,idle:0,pet:0,pant:0,ls:0,legs:[]};
 a.body=new T.Group();g.add(a.body);bx(.46,.44,1,G,0,.66,0,a.body);bx(.42,.34,.3,L,0,.58,.42,a.body);bx(.48,.1,1.02,L,0,.48,0,a.body);
 a.hd=new T.Group();a.hd.position.set(0,.98,.58);g.add(a.hd);bx(.38,.36,.4,G,0,0,0,a.hd);bx(.24,.18,.3,L,0,-.08,.32,a.hd);bx(.1,.08,.06,0x161616,0,-.02,.48,a.hd);
 for(const s of[-1,1]){bx(.06,.06,.02,0x161616,s*.1,.07,.205,a.hd);const e=new T.Group();e.position.set(s*.21,.13,-.02);bx(.08,.3,.2,D,0,-.13,0,e);a.hd.add(e);(a.ears=a.ears||[]).push(e)}
 a.tongue=bx(.1,.02,.16,0xff6a8a,0,-.19,.36,a.hd);bx(.44,.09,.38,0xe8222c,0,-.2,-.12,a.hd);nb(.08,.1,.02,0xffd23f,0,-.28,.08,a.hd);
 for(const[x,z]of[[-.15,.34],[.15,.34],[-.15,-.34],[.15,-.34]]){const l=new T.Group();l.position.set(x,.5,z);bx(.13,.5,.13,G,0,-.25,0,l);bx(.15,.08,.2,L,0,-.47,.03,l);g.add(l);a.legs.push(l)}
 a.tail=new T.Group();a.tail.position.set(0,.82,-.5);bx(.11,.11,.55,G,0,0,-.26,a.tail);bx(.13,.13,.2,L,0,0,-.5,a.tail);g.add(a.tail);
 g.traverse(o=>{if(o.isMesh)o.castShadow=true});g.scale.setScalar(.95);sc.add(g);return a})();
function bark(){snd(560,.07,'square',.045);setTimeout(()=>snd(480,.09,'square',.045),130)}
function rosyWatch(x,z){ROSY.watch={x,z};ROSY.wt=0}
function rosyHome(){ROSY.watch=null;ROSY.x=P.x+1.4;ROSY.z=P.z+1;ROSY.idle=0}
const nearRosy=()=>ROSY.g.visible&&!P.car&&!P.dead&&ROSY.idle>2.2&&Math.hypot(ROSY.x-P.x,ROSY.z-P.z)<2.2&&(P.y||0)<1.5;
function petRosy(){const D=ROSY;D.pet=2.2;D.idle=0;bark();if(performance.now()-(D.pt||-1e9)>20000){D.pt=performance.now();P.hp=Math.min(100,P.hp+10);msg('Rosy wags her whole body. Good girl! HP +10','#ffc94a')}else msg('Rosy leans into your leg. Good girl!','#ffc94a')}
function rosyU(dt){const D=ROSY,g=D.g,t=performance.now()*.001,veh=P.car||P.heli||P.plane||P.tank;
 if(P.dead&&!D.watch)rosyWatch(D.inV?D.x:P.x,D.inV?D.z:P.z);else if(!P.dead&&D.watch)rosyHome();
 D.fight=0;g.visible=!veh&&!(typeof CIN!=='undefined'&&CIN)&&IN!==COURT&&IN!==PRISON;if(veh){D.x=veh.x;D.z=veh.z;D.inV=1;return}
 if(D.inV){D.inV=0;D.x=P.x+cos(P.h)*1.5;D.z=P.z-sin(P.h)*1.5;D.idle=0}
 if(D.inside!==IN){D.inside=IN;D.x=P.x+1.3;D.z=P.z+1.2}
 let tx,tz,lie=0;const tg=P.dead?null:rosyTarget();
 if(P.dead&&D.watch){tx=D.watch.x+1.4;tz=D.watch.z+.6;lie=1;if((D.wt-=dt)<=0){D.wt=2.6;snd(640,.35,'sine',.018)}}
 else if(tg){tx=tg.x;tz=tg.z;D.fight=1;if(Math.hypot(tg.x-D.x,tg.z-D.z)<1.4)rosyBite(tg,dt)}
 else if((P.y||0)>2.4||P.hide){tx=D.x;tz=D.z}
 else{tx=P.x-sin(P.h)*1.25+cos(P.h)*1.05;tz=P.z-cos(P.h)*1.25-sin(P.h)*1.05}
 let dx=tx-D.x,dz=tz-D.z,d=Math.hypot(dx,dz);if(d>34&&!lie){D.x=tx;D.z=tz;d=0}
 const sp=d>(D.fight?1.1:.45)?Math.min(D.fight?12.5:10.5,1.2+d*2.6):0;if(sp){D.x+=dx/d*sp*dt;D.z+=dz/d*sp*dt;D.h=Math.atan2(dx,dz);D.idle=0;D.pant=Math.min(6,D.pant+dt*sp*.25)}else{D.idle+=dt;D.pant=Math.max(0,D.pant-dt*.6);
  const fx=(lie&&D.watch?D.watch.x:P.x)-D.x,fz=(lie&&D.watch?D.watch.z:P.z)-D.z;if(fx*fx+fz*fz>.01){let a=Math.atan2(fx,fz)-D.h;a=Math.atan2(Math.sin(a),Math.cos(a));D.h+=a*Math.min(1,dt*4)}}
 const pv={x:D.x,z:D.z,y:0};push(pv,.35);D.x=pv.x;D.z=pv.z;
 const y=IN?0:onPier(D.x,D.z)?.5:inWater(D.x,D.z)?-.35:Math.max(0,terrH(D.x,D.z));g.position.set(D.x,y,D.z);g.rotation.y=D.h;
 /* pose: run, sit (stopped for a moment), lie (watching over you) */
 D.ph+=dt*sp*2.6;const sit=!lie&&D.idle>1.2&&!sp,amp=Math.min(.9,sp*.13),s=Math.sin(D.ph)*amp;
 D.legs[0].rotation.x=s;D.legs[3].rotation.x=s;D.legs[1].rotation.x=-s;D.legs[2].rotation.x=-s;
 const k=Math.min(1,dt*6),tb=lie?0:sit?-.42:0,ty=lie?-.3:sit?.02:0;D.body.rotation.x+=(tb-D.body.rotation.x)*k;D.body.position.y+=(ty-D.body.position.y)*k;
 if(sit){D.legs[2].rotation.x=D.legs[3].rotation.x=-1.25;D.legs[0].rotation.x=D.legs[1].rotation.x=.12}if(lie)for(const l of D.legs)l.rotation.x=l.position.z>0?-1.45:1.3;
 const hy=lie?.55:sit?1.18:.98;D.hd.position.y+=(hy-D.hd.position.y)*k;D.hd.position.z+=((sit?.48:.58)-D.hd.position.z)*k;D.hd.rotation.x=lie?.25:sit?-.15:Math.sin(D.ph*2)*.05;
 for(const e of D.ears)e.rotation.z=(e.position.x>0?1:-1)*(lie?.6:.08+Math.abs(s)*.3);
 D.tail.position.y=lie?.4:sit?.42:.82;D.tail.rotation.x=lie?.2:sit?.3:-.6;D.tail.rotation.y=Math.sin(t*(D.pet>0?18:sp?13:7))*(lie?.08:D.pet>0?.9:.45);D.pet=Math.max(0,D.pet-dt);
 D.tongue.visible=!lie&&(D.pant>.6||D.pet>0);
 const st_=Math.min(5,Math.floor(heat));if(st_>D.ls&&!P.dead)bark();D.ls=st_}
