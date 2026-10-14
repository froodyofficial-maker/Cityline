/* ==================== more Rosy: fetch, tricks, collars and outfits, the Bark Park ====================
   Q            throw her tennis ball; she brings it back and drops it at your feet
   H            Rosy menu: perform the tricks she knows, change her collar and outfit
   BARK PARK    (Midtown) fenced dog park with an agility course and other dogs to play with;
                PAWS & CLAWS sells collars and outfits, Coach Dana teaches tricks
   Her look, tricks and fetch count are remembered between sessions. */
const COLLARS={red:['CLASSIC RED',0xe8222c,0],blue:['OCEAN BLUE',0x2b8fff,100],pink:['BUBBLEGUM',0xff6fb5,100],spike:['BLACK SPIKED',0x1a1a1e,300],neon:['NEON GLOW',0x2bf0ff,800],gold:['SOLID GOLD',0xffc94a,1500]};
const DOGFITS={none:['NO OUTFIT',0],bandana:['RED BANDANA',250],shades:['SUNGLASSES',300],party:['PARTY HAT',200],raincoat:['YELLOW RAINCOAT',450],cape:['HERO CAPE',600],crown:['GOLDEN CROWN',2500]};
const TRICKS={sit:['SIT',0,2.4],shake:['SHAKE A PAW',200,2.4],spin:['SPIN',300,1.6],rollover:['ROLL OVER',400,1.6],playdead:['PLAY DEAD',500,3.2],backflip:['BACKFLIP',1500,1.1]};
let DOGL={collar:'red',fit:'none',own:['red','none'],tricks:['sit'],fetch:0,tips:0};
try{Object.assign(DOGL,JSON.parse(localStorage.getItem('embercity_rosy')||'{}'))}catch(e){}
const dogSave=()=>{try{localStorage.setItem('embercity_rosy',JSON.stringify(DOGL))}catch(e){}};
/* ---------- accessories ---------- */
/* head pieces in the head's own frame (Rosy's head is .38 x .36 x .4, snout towards +z) */
function dogAccHead(hd,fit){const out=[],B_=(w,h,d,c,x,y,z)=>{const m=bx(w,h,d,c,x,y,z,hd);out.push(m);return m};
 if(fit=='shades'){B_(.38,.05,.03,0x111111,0,.09,.215);for(const s of[-1,1]){const l=nb(.14,.1,.02,0x101830,s*.09,.06,.225,hd);out.push(l)}}
 else if(fit=='party'){const c=new T.Mesh(new T.ConeGeometry(.12,.32,10),mat(0xff4fa3));c.position.set(.04,.33,-.02);c.rotation.z=-.15;hd.add(c);out.push(c);const pp=nb(.08,.08,.08,0xffd23f,.06,.5,-.02,hd);out.push(pp)}
 else if(fit=='crown'){B_(.26,.08,.26,0xffc94a,0,.22,-.02);for(const[x,z]of[[-.1,-.1],[.1,-.1],[-.1,.08],[.1,.08]])B_(.05,.1,.05,0xffc94a,x,.3,z);out.push(nb(.05,.05,.05,0xff3b4f,0,.24,.115,hd))}
 return out}
function dogAccBody(b,fit){const out=[],B_=(w,h,d,c,x,y,z,rx)=>{const m=bx(w,h,d,c,x,y,z,b);if(rx)m.rotation.x=rx;out.push(m);return m};
 if(fit=='bandana'){B_(.46,.24,.07,0xc0392b,0,.66,.58,.25);B_(.22,.14,.06,0xc0392b,0,.5,.62,.4)}
 else if(fit=='raincoat'){B_(.52,.3,.92,0xffd23f,0,.8,0);B_(.53,.08,.94,0xe0b020,0,.66,0)}
 else if(fit=='cape'){B_(.56,.04,.78,0xc0392b,0,.9,-.12,.06);B_(.3,.05,.12,0xffd23f,0,.92,.12)}
 return out}
function dogCollar(a,key){const c=COLLARS[key]||COLLARS.red;a.collar.material=key=='neon'?nmat(c[1]):mat(c[1]);if(a.spk){for(const m of a.spk)m.parent.remove(m);a.spk=null}
 if(key=='spike'){a.spk=[];for(const[x,z]of[[-.23,0],[.23,0],[0,-.2],[-.17,-.17],[.17,-.17]])a.spk.push(bx(.05,.05,.05,0xd0d4da,x,-.2,z-.12,a.hd))}}
function rosyLook(){const D=ROSY;dogCollar(D,DOGL.collar);if(D.acc)for(const m of D.acc)m.parent&&m.parent.remove(m);D.acc=dogAccHead(D.hd,DOGL.fit).concat(dogAccBody(D.body,DOGL.fit));
 D.g.traverse(o=>{if(o.isMesh)o.castShadow=true});if(typeof SEATC!=='undefined')SEATC=-1/* rebuild the car seat */}
/* Rosy riding in the car: same collar and hat, at the smaller head size */
function rosySeatLook(hd){const c=COLLARS[DOGL.collar]||COLLARS.red;bx(.32,.07,.3,c[1],0,-.17,-.1,hd);const h=new T.Group();h.scale.setScalar(.8);hd.add(h);dogAccHead(h,DOGL.fit)}
/* ---------- tricks ---------- */
function rosyTrick(k){const D=ROSY;if(!D.g.visible||P.car||P.dead)return msg('Rosy needs to be with you, on foot','#ffb02b');if(D.fight)return msg('Rosy is busy fighting!','#ff6a6a');
 if(Math.hypot(D.x-P.x,D.z-P.z)>6){D.x=P.x+1.4;D.z=P.z+1}fetchReset();D.trick={k,t:0,dur:TRICKS[k][2]};D.idle=0;snd(880,.08,'sine',.04);msg('"Rosy, '+TRICKS[k][0].toLowerCase()+'!"','#ffc94a')}
function trickPose(D,dt){const T_=D.trick,g=D.g;if(D.fight||P.dead){D.trick=null;return}T_.t+=dt;const p=Math.min(1,T_.t/T_.dur),k=T_.k;
 const sit=()=>{D.body.rotation.x=-.42;D.body.position.y=.02;D.legs[2].rotation.x=D.legs[3].rotation.x=-1.25;D.legs[0].rotation.x=D.legs[1].rotation.x=.12;D.hd.position.y=1.18;D.hd.position.z=.48;D.tail.position.y=.42;D.tail.rotation.x=.3},
  lie=()=>{D.body.position.y=-.3;D.body.rotation.x=0;for(const l of D.legs)l.rotation.x=l.position.z>0?-1.45:1.3;D.hd.position.y=.55};
 g.rotation.x=g.rotation.z=0;
 if(k=='sit')sit();
 else if(k=='shake'){sit();D.legs[0].rotation.x=-1.3+Math.sin(T_.t*9)*.25;D.hd.rotation.x=-.25}
 else if(k=='spin')g.rotation.y=D.h+p*PI*4;
 else if(k=='rollover'){lie();g.rotation.z=p*PI*2;g.position.y=.12+Math.sin(p*PI)*.25}
 else if(k=='playdead'){lie();const q=Math.min(1,T_.t*3);g.rotation.z=q*PI/2;g.position.y=.22*q;for(const l of D.legs)l.rotation.x=0;D.tail.rotation.y=0;D.tongue.visible=true}
 else if(k=='backflip'){g.position.y+=4*1.5*p*(1-p);g.rotation.x=-p*PI*2;for(const l of D.legs)l.rotation.x=l.position.z>0?-.8:.8}
 if(T_.t>=T_.dur){D.trick=null;g.rotation.x=g.rotation.z=0;bark();D.pet=1.4;
  /* passers-by sometimes tip a good dog */
  if(!IN&&performance.now()-(D.tipT||-1e9)>12000){const n=peds.filter(e=>!e.dead&&!e.hostile&&dist(e,P)<14).length;if(n&&R()<.25+.1*Math.min(3,n)){D.tipT=performance.now();const m=Math.round(rr(5,25)*(k=='backflip'?4:1));cash+=m;DOGL.tips+=m;dogSave();msg('A passer-by loved that! Tip: +$'+m,'#ffd23f')}}}}
/* ---------- fetch ---------- */
const BALL=(()=>{const m=new T.Mesh(new T.SphereGeometry(.12,10,8),new T.MeshStandardMaterial({color:0xd8f040,roughness:.7}));m.castShadow=true;m.visible=false;m.userData.dyn=1;sc.add(m);return{m,st:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,t:0}})();
/* st: 0 pocketed, 1 flying/rolling, 2 in Rosy's mouth, 3 dropped at your feet */
const fetchTarget=()=>BALL.st==1&&ROSY.g.visible&&!P.dead?BALL:BALL.st==2?P:null,fetchCarry=()=>BALL.st==2;
function fetchReset(){BALL.st=0;BALL.m.visible=false}
function throwBall(){const D=ROSY;if(P.car||P.heli||P.plane||P.tank||P.dead||cut||IN||P.hide)return;if(!D.g.visible||D.fight)return msg('Rosy has other things on her mind right now','#ffb02b');if(BALL.st==2)return;
 if(BALL.st==3&&dist(BALL,P)>3)return msg('Pick the ball up first (it is where Rosy dropped it)','#ffb02b');
 D.trick=null;const a=camYaw;BALL.x=P.x+sin(a)*.5;BALL.z=P.z+cos(a)*.5;BALL.y=(P.y||0)+1.6;BALL.vx=sin(a)*15;BALL.vz=cos(a)*15;BALL.vy=6.5+Math.max(0,.4-camPitch)*6;BALL.st=1;BALL.t=0;BALL.m.visible=true;
 P.g.a[1].rotation.x=-2.6;setTimeout(()=>{if(P.g)P.g.a[1].rotation.x=0},200);snd(520,.05,'square',.03);if(R()<.6)bark()}
function ballGround(x,z){return IN?0:onPier(x,z)?.5:Math.max(0,terrH(x,z))}
function fetchU(dt){const b=BALL,D=ROSY;
 if(b.st==1){b.t+=dt;b.vy-=18*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;const o={x:b.x,z:b.z,y:b.y};if(push(o,.15)){b.vx*=-.4;b.vz*=-.4;b.x=o.x;b.z=o.z}
  const gy=ballGround(b.x,b.z)+.12;if(b.y<gy){if(inWater(b.x,b.z)){fetchReset();msg('Splash! Rosy gives you a look. You pull out a spare ball.','#9ad0ff');return}b.y=gy;if(b.vy<-1.5){b.vy*=-.45;b.vx*=.7;b.vz*=.7}else{b.vy=0;b.vx*=1-2.2*dt;b.vz*=1-2.2*dt}}
  b.m.position.set(b.x,b.y,b.z);b.m.rotation.x+=Math.hypot(b.vx,b.vz)*dt*4;
  if(Math.hypot(D.x-b.x,D.z-b.z)<.8&&b.y<gy+1.2){b.st=2;snd(300,.06,'square',.03)}else if(b.t>16||!D.g.visible){fetchReset()}}
 else if(b.st==2){if(!D.g.visible){fetchReset();return}D.g.updateMatrixWorld(true);FV.set(0,-.12,.5);D.hd.localToWorld(FV);b.m.position.copy(FV);b.x=FV.x;b.z=FV.z;
  if(Math.hypot(D.x-P.x,D.z-P.z)<1.7){b.st=3;b.x=P.x+sin(P.h)*.9;b.z=P.z+cos(P.h)*.9;b.y=ballGround(b.x,b.z)+.12;b.m.position.set(b.x,b.y,b.z);DOGL.fetch++;dogSave();D.pet=1.6;D.idle=1.3;
   msg(DOGL.fetch%25==0?'FETCH #'+DOGL.fetch+'! Rosy could do this all day.':'Rosy drops the ball at your feet. Again! (Q)','#ffc94a')}}
 else if(b.st==3&&dist(b,P)>30)fetchReset()}
const FV=new T.Vector3();
/* ---------- the Bark Park (Midtown) ---------- */
let DPARK=null;const DOGS=[];
function dogPark(cx,cz){dPad(cx,cz,1);PARKS.push({cx,cz});const W=0x8a5a2a,post=(x,z)=>bx(.16,1.2,.16,W,x,.6,z,sc);
 /* low wooden fence with a gate in the middle of each side */
 const side=(x1,z1,x2,z2)=>{const L=Math.hypot(x2-x1,z2-z1),n=Math.max(1,Math.round(L/3));for(let i=0;i<=n;i++)post(x1+(x2-x1)*i/n,z1+(z2-z1)*i/n);for(const y of[.45,.95]){const r=bx(.08,.1,L,W,(x1+x2)/2,y,(z1+z2)/2,sc);r.rotation.y=Math.atan2(x2-x1,z2-z1)}B.push({x1:Math.min(x1,x2)-.1,x2:Math.max(x1,x2)+.1,z1:Math.min(z1,z2)-.1,z2:Math.max(z1,z2)+.1,h:1.2})};
 const e=13.4,gw=2.2;for(const s of[-1,1]){side(cx-e,cz+s*e,cx-gw,cz+s*e);side(cx+gw,cz+s*e,cx+e,cz+s*e);side(cx+s*e,cz-e,cx+s*e,cz-gw);side(cx+s*e,cz+gw,cx+s*e,cz+e)}
 nsign('BARK PARK','#ffc94a',cx,2.4,cz+e+.1,5).rotation.y=0;for(const s of[-1,1])bx(.18,2.6,.18,W,cx+s*2.4,1.3,cz+e+.05,sc);
 /* agility course: A-frame, hoops, weave poles, tunnel */
 for(const s of[-1,1]){const a=bx(1.4,.08,2.4,0x2a6fd0,cx-6,.9,cz-6+s*.95,sc);a.rotation.x=s*.75}bx(1.4,.1,.4,0xffd23f,cx-6,1.75,cz-6,sc);
 for(let i=0;i<3;i++){const x=cx+3+i*3,z=cz-8;for(const s of[-1,1])bx(.1,1.1,.1,0xeeeeee,x+s*.6,.55,z,sc);const h=new T.Mesh(new T.TorusGeometry(.5,.05,6,18),mat([0xff3b4f,0xffd23f,0x3ec24a][i]));h.position.set(x,.95,z);h.castShadow=true;sc.add(h)}
 for(let i=0;i<6;i++)cy(.04,1.1,i%2?0xff3b4f:0xffffff,cx+8,.55,cz-2+i*.9,6);
 {const t=new T.Mesh(new T.CylinderGeometry(.55,.55,3,14,1,true),mat(0x3aa86b));t.rotation.z=PI/2;t.position.set(cx+2,.55,cz+6);t.castShadow=true;sc.add(t);solid(cx+2,cz+6,3,1.1,1.1)}
 /* benches, trees, a water bowl */
 for(const[x,z,r]of[[-9,9,0],[-4,11,0],[10,10,PI]])bench(cx+x,cz+z,r);for(const[x,z]of[[-11,-11],[11,-11],[-11,4],[11,3]])tree(cx+x,cz+z,1.1);cy(.3,.12,0x2a6fd0,cx-1,.06,cz+1,12);
 /* PAWS & CLAWS kiosk + Coach Dana */
 const kx=cx-9,kz=cz-1;bx(3,2.2,2,0xf2e6d0,kx,1.1,kz,sc);for(let i=0;i<5;i++)bx(.6,.12,2.4,i%2?0xffffff:0xff4fa3,kx-1.2+i*.6,2.32,kz+.2,sc);bx(3.1,.12,.5,0x8a5a2a,kx,1,kz+1.15,sc);nsign('PAWS & CLAWS','#ff4fa3',kx,2.9,kz+1.05,3.2);solid(kx,kz,3,2,2.2);
 const coach=person('#8d5524','#3ec24a','#2b2f3a','#111',0);coach.position.set(cx-2,0,cz-9);coach.rotation.y=PI*.1;
 DPARK={cx,cz,e,kiosk:{x:kx+1.8,z:kz+1.6},coach:{x:cx-2,z:cz-9,g:coach}};
 poi({x:kx+.6,z:kz+2,r:2.6,txt:()=>'E - PAWS & CLAWS (collars & outfits for Rosy)',e:()=>dogShop()});
 poi({x:cx-2,z:cz-7.6,r:2.6,txt:()=>'E - Coach Dana: teach Rosy a trick',e:()=>dogTrainer()});
 /* the regulars */
 const breeds=[[0x1a1a1e,0x2a2a30,0x101014,{collar:0x2b8fff}],[0xf2f2f2,0xffffff,0x1a1a1e,{collar:0xff4fa3,spots:[[0,.78,.2],[0,.7,-.25],[.05,.86,-.05]],s:.85}],[0x9a6a3a,0xc8a070,0x5a3a1a,{collar:0x3ec24a,s:.75}],[0x8a9098,0xe8eaee,0x5a6068,{collar:0xffd23f,prick:1}],[0xc8803a,0xf0e0c0,0x8a5020,{collar:0xff8a2b,s:.6,prick:1}]];
 breeds.forEach((b,i)=>{const d=mkDog(b[0],b[1],b[2],b[3]);d.g.userData.dyn=1;d.x=cx+rr(-9,9);d.z=cz+rr(-9,9);d.tx=d.x;d.tz=d.z;d.sp=0;d.wt=rr(0,3);d.bk=rr(4,12);d.g.position.set(d.x,0,d.z);DOGS.push(d)});
 for(const[x,z,h]of[[6,9,PI*.8],[-6,3,PI*.3]]){const o=person(ri(skins),ri(shirts),'#2b2f3a',ri(['#222','#4a2f1b','#a0703c']),0);o.position.set(cx+x,0,cz+z);o.rotation.y=h}
 PLACES.push({x:cx,z:cz,icon:'paw'})}
const inPark=(x,z)=>DPARK&&Math.abs(x-DPARK.cx)<DPARK.e-.5&&Math.abs(z-DPARK.cz)<DPARK.e-.5;
function dogParkU(dt){if(!DPARK)return;const near=!IN&&Math.abs(P.x-DPARK.cx)+Math.abs(P.z-DPARK.cz)<160;for(const d of DOGS)d.g.visible=near;if(!near){ROSY.play=null;return}const t=performance.now()*.001;
 for(const d of DOGS){if((d.wt-=dt)<=0){d.wt=rr(2,6);const o=R()<.35&&DOGS.length>1?ri(DOGS):null;if(o&&o!==d){d.chase=o;d.wt=rr(2,4)}else{d.chase=null;d.tx=DPARK.cx+rr(-11,11);d.tz=DPARK.cz+rr(-11,11)}}
  if(d.chase){d.tx=d.chase.x;d.tz=d.chase.z}if(ROSY.play===d){d.tx=ROSY.x+sin(t)*2;d.tz=ROSY.z+cos(t)*2}
  const dx=d.tx-d.x,dz=d.tz-d.z,l=Math.hypot(dx,dz),sp=l>.6?Math.min(d.chase||ROSY.play===d?8:3,1+l*1.5):0;if(sp){d.x+=dx/l*sp*dt;d.z+=dz/l*sp*dt;d.h=Math.atan2(dx,dz)}
  d.x=Math.max(DPARK.cx-12.6,Math.min(DPARK.cx+12.6,d.x));d.z=Math.max(DPARK.cz-12.6,Math.min(DPARK.cz+12.6,d.z));
  d.ph+=dt*sp*2.6;const s=Math.sin(d.ph)*Math.min(.9,sp*.13);d.legs[0].rotation.x=d.legs[3].rotation.x=s;d.legs[1].rotation.x=d.legs[2].rotation.x=-s;d.tail.rotation.y=Math.sin(t*(sp?13:6)+d.wt)*.45;
  d.g.position.set(d.x,Math.abs(s)*.05,d.z);d.g.rotation.y=d.h||0;
  if((d.bk-=dt)<=0){d.bk=rr(6,16);if(Math.hypot(d.x-P.x,d.z-P.z)<30)snd(rr(380,620),.07,'square',.02)}}
 /* in the park on foot and standing about: Rosy runs off to play with the others */
 const D=ROSY,idle=!P.car&&!P.dead&&!D.trick&&!D.fight&&BALL.st!=1&&BALL.st!=2&&inPark(P.x,P.z);
 if(idle&&!D.play&&D.idle>2.5&&(D.pl=(D.pl||0)-dt)<=0){D.play=ri(DOGS);D.plT=rr(5,9);D.pl=rr(6,12)}
 if(D.play&&(!idle||(D.plT-=dt)<=0))D.play=null}
/* ---------- shop, trainer and the Rosy menu (H) ---------- */
function dogShop(){let h='<h2>PAWS &amp; CLAWS</h2><div class="stat">CASH $'+cash+' / EVERYTHING FITS A GOLDEN RETRIEVER</div><div class="stat">COLLARS</div>';
 for(const k in COLLARS){const c=COLLARS[k],o=DOGL.own.includes(k),on=DOGL.collar==k;h+='<div class="ln"><i style="display:inline-block;width:28px;height:28px;background:#'+c[1].toString(16).padStart(6,'0')+';box-shadow:0 0 0 3px #000"></i><span>'+c[0]+'<small>'+(o?(on?'WEARING':'OWNED'):'$'+Math.round(c[2]*(owns('pets')?.5:1)))+'</small></span>'+(on?'':'<button data-a="dog:c-'+k+'">'+(o?'PUT ON':'BUY')+'</button>')+'</div>'}
 h+='<div class="stat">OUTFITS</div>';for(const k in DOGFITS){const c=DOGFITS[k],o=DOGL.own.includes(k),on=DOGL.fit==k;h+=row('paw',c[0],o?(on?'WEARING':'OWNED'):'$'+Math.round(c[1]*(owns('pets')?.5:1)),on?'':(o?'PUT ON':'BUY'),'dog:f-'+k)}
 openMd(h+'<button data-a="close">LEAVE</button>')}
function dogTrainer(){let h='<h2>COACH DANA</h2><div class="stat">"Rosy is a smart girl. One lesson and she\'s got it."</div>';
 for(const k in TRICKS){const t=TRICKS[k],o=DOGL.tricks.includes(k);h+=row('paw',t[0],o?'KNOWS IT':'$'+t[1]+' PER LESSON',o?'':'TEACH','dog:t-'+k)}openMd(h+'<button data-a="close">LEAVE</button>')}
function rosyMenu(){let h='<h2>ROSY</h2><div class="stat">GOOD GIRL / FETCHES '+DOGL.fetch+' / TIPS EARNED $'+DOGL.tips+'</div><div class="stat">TRICKS</div>';
 for(const k of DOGL.tricks)h+=row('paw',TRICKS[k][0],'','DO IT','dog:do-'+k);
 if(DOGL.tricks.length<Object.keys(TRICKS).length)h+='<div class="stat">COACH DANA AT THE BARK PARK (MIDTOWN) TEACHES MORE</div>';
 h+='<div class="stat">COLLAR</div><div>'+DOGL.own.filter(k=>COLLARS[k]).map(k=>'<button data-a="dog:c-'+k+'"'+(DOGL.collar==k?' class="sel"':'')+'>'+COLLARS[k][0]+'</button>').join('')+'</div>';
 h+='<div class="stat">OUTFIT</div><div>'+DOGL.own.filter(k=>DOGFITS[k]).map(k=>'<button data-a="dog:f-'+k+'"'+(DOGL.fit==k?' class="sel"':'')+'>'+DOGFITS[k][0]+'</button>').join('')+'</div>';
 h+='<div class="stat">Q - THROW THE BALL FOR HER</div>';openMd(h+'<button data-a="close">CLOSE (H)</button>')}
function dogAct(id){const[k,v]=id.split('-'),fromMenu=$('mdp').querySelector('h2').textContent=='ROSY',back=()=>fromMenu?rosyMenu():k=='t'?dogTrainer():dogShop();
 if(k=='do'){closeCas();rosyTrick(v);return}
 if(k=='c'||k=='f'){if(!DOGL.own.includes(v)){const p=Math.round((k=='c'?COLLARS[v][2]:DOGFITS[v][1])*(owns('pets')?.5:1));if(!pay(p))return;DOGL.own.push(v);snd(700,.12);msg('BOUGHT: '+(k=='c'?COLLARS[v][0]:DOGFITS[v][0]),'#43ff7a')}
  if(k=='c')DOGL.collar=v;else DOGL.fit=v;dogSave();rosyLook();empSaveCash();back();return}
 if(k=='t'){if(DOGL.tricks.includes(v))return;if(!pay(TRICKS[v][1]))return;DOGL.tricks.push(v);dogSave();empSaveCash();snd(880,.15,'sine',.05);msg('Rosy learned '+TRICKS[v][0]+'! Press H to show it off.','#43ff7a');back()}}
rosyLook();
