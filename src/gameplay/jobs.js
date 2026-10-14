/* ==================== side jobs (J) ====================
   EMBER RIDE    ride-share in whatever car you are driving: pick the fare up, get them there fast and in one piece
   EMBER EATS    collect an order from a restaurant and deliver it before it goes cold (on foot or on wheels)
   STREET RACES  four routes across the city; drive to a start line, pay the entry, beat three rivals through the checkpoints
   GETAWAY       a crew is robbing a store: be outside when they run out, lose the cops, drop them at the hideout
   Ride-share and delivery jobs keep coming until you quit (J). No side jobs during story missions. */
let SJ=null;
const AVN=['HARBOR','MAPLE','OAK','CEDAR','PINE','BIRCH','ELM','ASH','UNION','CENTRAL','EMBER','LIBERTY','MARKET','RIVER','SUNSET','HILL','KING','OCEAN','PARK','LAKE'],
 STN=['1ST','2ND','3RD','4TH','5TH','6TH','7TH','8TH','9TH','10TH','11TH','12TH','13TH','14TH','15TH','16TH','17TH','18TH','19TH','20TH'];
const sjOK=()=>!ST.act&&CFG.mode!=1&&!P.dead&&!cut;
/* a sidewalk spot mn..mx metres from (x,z), with a street address */
function curb(x,z,mn,mx){for(let t=0;t<30;t++){const q=rdPick(x,z,mn,mx),s=q.s,sd=R()<.5?-7.6:7.6,px=s.ax?s.c+sd:q.u,pz=s.ax?q.u:s.c+sd;
  if(inWater(px,pz)||pz>COAST-2||Math.abs(px)>378||pz<-378)continue;if(bNear(px-.6,pz-.6,px+.6,pz+.6).some(b=>!b.over&&px>b.x1-.5&&px<b.x2+.5&&pz>b.z1-.5&&pz<b.z2+.5))continue;
  const i=RL.indexOf(s.c),num=Math.abs(Math.round(q.u))*3%900+100;return{x:px,z:pz,a:num+' '+(s.ax?AVN[i%20]+' AVE':STN[i%20]+' ST')+', '+zoneOf(px,pz)}}
 return{x:x+20,z:z,a:'SOMEWHERE, '+zoneOf(x,z)}}
function sjHud(name,money,tm,extra){sbarSet('<span>'+name+'</span>'+(extra?'<span>'+extra+'</span>':'')+(money!=null?'<b>$'+money+'</b>':'')+(tm!=null?'<span class="tm">'+mmss(tm)+'</span>':''))}
function sjEnd(quiet){if(!SJ)return;const j=SJ;SJ=null;beaconOff();objSet('');sbarSet('');if(j.ped&&j.ped.parent)sc.remove(j.ped);if(j.crew)for(const g of j.crew)sc.remove(g);if(j.riv)for(const r of j.riv)sc.remove(r.c.g);if(!quiet)msg('JOB OVER','#ffb02b')}
function sjPay(n,line){cash+=n;SJS.earn+=n;snd(760,.12,'square',.05);setTimeout(()=>snd(1020,.15,'square',.05),110);msg(line+' +$'+n,'#ffd23f');empSaveCash()}
const SJS={ride:0,eats:0,race:0,get:0,earn:0};
/* ---------- EMBER RIDE ---------- */
const FARES=['"Ember Tower, and step on it!"','"Can you make it quick? I\'m late for a date."','"Please don\'t drive like the last guy."','"Is that a dog in the back? Hi, puppy!"','"Just get me home. Long day."','"My flight boards in an hour. Pier first, then... never mind, just go."','"Nice ride. Smells like golden retriever."','"Whatever you do, don\'t take Harbor Ave. Traffic\'s murder."'];
function rideNext(){const c=P.car||P,s=curb(c.x,c.z,60,170);const g=person(ri(skins),ri(shirts),ri(['#2b2f3a','#5a4a3a','#3a4a5a']),ri(['#222','#4a2f1b','#a0703c']),0);g.position.set(s.x,0,s.z);
 SJ={k:'ride',st:'find',ped:g,x:s.x,z:s.z,a:s.a,t:0,n:(SJ&&SJ.n)||0};beacon(s.x,s.z,2.6,0x37e6ff);objSet('EMBER RIDE: pick up your fare at *'+s.a+'*')}
function rideU(dt){const j=SJ,c=P.car;j.t+=dt;
 if(j.st=='find'){j.ped.rotation.y=Math.atan2((P.car||P).x-j.x,(P.car||P).z-j.z);j.ped.a[1].rotation.x=-2.6+Math.sin(j.t*8)*.4;
  sjHud('EMBER RIDE',null,null,'FARE '+(j.n+1));if(!c){objSet('EMBER RIDE: get in a car, then pick up your fare at *'+j.a+'*');return}
  if(Math.hypot(c.x-j.x,c.z-j.z)<7&&Math.abs(c.v)<3){sc.remove(j.ped);const d=curb(j.x,j.z,150,420);Object.assign(j,{st:'ride',dx:d.x,dz:d.z,da:d.a,dist:Math.hypot(d.x-j.x,d.z-j.z),tl:Math.hypot(d.x-j.x,d.z-j.z)/10+22,dmg0:c.dmg||0,car:c,out:0});
   beacon(d.x,d.z,3.2,0xffd23f);msg(ri(FARES),'#c8c8c8');objSet('Drive your fare to *'+d.a+'*')}return}
 j.tl-=dt;const tip=Math.max(0,Math.round(j.tl*3-((j.car.dmg||0)-j.dmg0)*4));sjHud('EMBER RIDE',Math.round(40+j.dist*.35)+tip,j.tl,'FARE '+(j.n+1));
 if(c!==j.car){if((j.out+=dt)>6){msg('"I\'m not waiting around for this." Your fare walked off.','#ff6a6a');SJ.n=j.n;rideNext()}else objSet('Get back in the car! Your fare is waiting');return}j.out=0;
 if(j.tl<=0){msg('"Forget it, I\'ll walk!" The fare got out.','#ff6a6a');rideNext();return}
 if(Math.hypot(c.x-j.dx,c.z-j.dz)<8&&Math.abs(c.v)<4){SJS.ride++;sjPay(Math.round(40+j.dist*.35)+tip,tip>40?'FARE + BIG TIP':'FARE');j.n++;const n=j.n;SJ=null;beaconOff();objSet('');setTimeout(()=>{if(!SJ&&sjOK()){rideNext();SJ.n=n}},2500)}}
/* ---------- EMBER EATS ---------- */
function eatsSpots(){const a=[{n:'SURF SHACK',x:-260,z:COAST+12},{n:'ICE CREAM STAND',x:-60,z:COAST+12},{n:'TACO HUT',x:40,z:COAST+12},{n:'EMBER MALL FOOD COURT',x:160,z:127}];
 for(const g of GASST)a.push({n:'GAS & GO',x:g.x,z:g.z});for(const o of shops)if(o.kind!='guns')a.push({n:o.name,x:o.x,z:o.z});return a}
function eatsNext(){const all=eatsSpots(),c=P.car||P;all.sort((a,b)=>Math.hypot(a.x-c.x,a.z-c.z)-Math.hypot(b.x-c.x,b.z-c.z));const r=ri(all.slice(0,4));
 SJ={k:'eats',st:'pick',r,n:(SJ&&SJ.n)||0,tl:Math.hypot(r.x-c.x,r.z-c.z)/8+40};beacon(r.x,r.z,3,0xff8a2b);objSet('EMBER EATS: pick up the order at *'+r.n+'*')}
function eatsU(dt){const j=SJ,c=P.car,q=c||P;j.tl-=dt;
 if(j.st=='pick'){sjHud('EMBER EATS',null,j.tl,'ORDER '+(j.n+1));if(j.tl<=0){msg('The restaurant gave the order to another courier.','#ff6a6a');eatsNext();return}
  if(Math.hypot(q.x-j.r.x,q.z-j.r.z)<(c?7:4)&&(!c||Math.abs(c.v)<4)){const d=curb(j.r.x,j.r.z,120,340),di=Math.hypot(d.x-j.r.x,d.z-j.r.z);Object.assign(j,{st:'drop',d,di,tl:di/(c?9:6)+25,t0:di/(c?9:6)+25});
   beacon(d.x,d.z,3,0xffd23f);snd(600,.08);msg('Order picked up: '+ri(['2 burgers + fries','large pepperoni pizza','sushi platter','pad thai, extra spicy','tacos al pastor x6','a single ice cream (hurry!)']),'#ff8a2b');objSet('Deliver the order to *'+d.a+'*')}return}
 const pay=Math.round(30+j.di*.25+Math.max(0,j.tl)*2);sjHud('EMBER EATS',pay,j.tl,'ORDER '+(j.n+1));
 if(j.tl<=0){msg('Too late - the food went cold. Order refunded.','#ff6a6a');eatsNext();return}
 if(Math.hypot(q.x-j.d.x,q.z-j.d.z)<(c?7:3.5)&&(!c||Math.abs(c.v)<4)){SJS.eats++;sjPay(pay,j.tl>j.t0*.5?'DELIVERED HOT - 5 STARS':'DELIVERED');j.n++;const n=j.n;SJ=null;beaconOff();objSet('');setTimeout(()=>{if(!SJ&&sjOK()){eatsNext();SJ.n=n}},2500)}}
/* ---------- STREET RACES ---------- */
const RACES=[];
function raceRoute(sx,sz,seed){const rnd=srng(seed),pts=[[sx,sz]],seen=new Set([sx+','+sz]),D=[[1,0],[-1,0],[0,1],[0,-1]];let x=sx,z=sz,dir=(rnd()*4)|0,legs=0,len=0;
 const ok=(x,z,dx,dz)=>{const nx=x+dx*40,nz=z+dz*40;if(nx<-380||nx>380||nz<-380||nz>300||seen.has(nx+','+nz))return false;return dx?!!roadAt(0,z,x+dx*20):!!roadAt(1,x,z+dz*20)};
 for(let step=0;step<40&&legs<9;step++){let opts=D.map((d,i)=>i).filter(i=>ok(x,z,D[i][0],D[i][1])&&!(D[i][0]==-D[dir][0]&&D[i][1]==-D[dir][1]));if(!opts.length)break;
  let nd=opts.includes(dir)&&(len<2||rnd()<.55)?dir:opts[(rnd()*opts.length)|0];if(nd!==dir){if(len)pts.push([x,z]);legs++;len=0;dir=nd}
  x+=D[dir][0]*40;z+=D[dir][1]*40;seen.add(x+','+z);len++}
 pts.push([x,z]);return pts}
function buildRaces(){for(const[n,sx,sz,seed,fee,win]of[['GROVE GRAND PRIX',-300,60,11,500,3000],['HEIGHTS HILLCLIMB',-140,-260,23,800,4500],['EASTSIDE DRAG',180,-180,37,600,3600],['FOUNDRY RUN',-100,260,51,1000,6000]]){
  const pts=raceRoute(sx,sz,seed);if(pts.length<4)continue;const r={n,pts,fee,win,best:0};RACES.push(r);
  /* start gantry: two posts and a chequered banner across the road */
  const[ax,az]=pts[0],[bx_,bz]=pts[1],along=Math.abs(bx_-ax)>Math.abs(bz-az),ux=Math.sign(bx_-ax),uz=Math.sign(bz-az);
  const gx=ax+ux*14,gz=az+uz*14;for(const s of[-1,1])bx(.3,6,.3,0x222222,gx+(along?0:s*6.6),3,gz+(along?s*6.6:0),sc);const bn=new T.Mesh(new T.BoxGeometry(along?.2:13.4,1.2,along?13.4:.2),new T.MeshBasicMaterial({map:CHKT}));bn.position.set(gx,5.6,gz);sc.add(bn);
  r.sx=ax+ux*8;r.sz=az+uz*8;r.h=Math.atan2(ux,uz);
  poi({x:r.sx,z:r.sz,r:9,car:1,txt:()=>SJ&&SJ.k=='race'?'':'E - '+r.n+'  ($'+r.fee+' entry, win $'+r.win.toLocaleString()+')',e:()=>raceStart(r)});
  poi({x:r.sx,z:r.sz,r:6,txt:()=>r.n+' - bring a car to race ($'+r.fee+' entry)',e:()=>{}});PLACES.push({x:gx,z:gz,icon:'flag'})}}
const CHKT=cvsT(64,16,(g,w,h)=>{for(let x=0;x<w;x+=8)for(let y=0;y<h;y+=8){g.fillStyle=((x+y)/8)%2?'#111':'#fff';g.fillRect(x,y,8,8)}});CHKT.repeat.set(4,1);
function raceStart(r){if(!sjOK()||!P.car)return;if(heat>=1)return msg('Lose the cops before you race','#ffb02b');if(SJ)sjEnd(1);if(!pay(r.fee))return;
 const c=P.car,ux=sin(r.h),uz=cos(r.h);setCar(c,r.sx-ux*4,r.sz-uz*4,r.h);c.v=0;camYaw=r.h;
 const riv=[[0x111111,1,3.2,-4],[0xffd23f,1,-3.2,-4],[0xc0392b,0,3.2,-11]].map(([col,t,lat,back],i)=>{const k=car(col,t);const x=r.sx+ux*back+uz*lat,z=r.sz+uz*back-ux*lat;setCar(k,x,z,r.h);return{c:k,i:1,v:0,lat:lat*.5,top:rr(22.5,25.5)+(i==0?1.2:0),done:0}});
 SJ={k:'race',r,riv,cp:1,cd:3.4,t:0,fin:0,place:0,out:0,sp:{x:c.x,z:c.z,h:c.h}};raceBeacon();objSet('*'+r.n+'* - follow the checkpoints. First to the finish wins.');snd(400,.2,'square',.05)}
function raceBeacon(){const j=SJ,p=j.r.pts[j.cp];beacon(p[0],p[1],5,j.cp==j.r.pts.length-1?0xffffff:0xffd23f)}
function raceProg(i,x,z){const p=SJ.r.pts[Math.min(i,SJ.r.pts.length-1)];return i*1000-Math.hypot(p[0]-x,p[1]-z)}
function raceU(dt){const j=SJ,r=j.r,c=P.car,N=r.pts.length;
 if(j.cd>0){const pc=Math.ceil(j.cd-.4);j.cd-=dt;const nc=Math.ceil(j.cd-.4);if(c){c.v=0;setCar(c,j.sp.x,j.sp.z,j.sp.h)}if(nc!==pc){snd(nc>0?500:900,.18,'square',.06);if(nc>0)msg(String(nc),'#ffd23f');else msg('GO!','#43ff7a')}sjHud(r.n,null,null,'GET READY');for(const q of j.riv)rivDraw(q,0);return}
 j.t+=dt;
 /* rivals */
 const pp=raceProg(j.cp,(c||P).x,(c||P).z);
 for(const q of j.riv){if(q.done){q.v*=1-2*dt;rivDraw(q,dt);continue}const p=r.pts[q.i],pv=r.pts[q.i-1],dx0=p[0]-pv[0],dz0=p[1]-pv[1],L=Math.hypot(dx0,dz0)||1,nx=dz0/L,nz=-dx0/L;
  const tx=p[0]+nx*q.lat*2,tz=p[1]+nz*q.lat*2,dx=tx-q.c.x,dz=tz-q.c.z,d=Math.hypot(dx,dz);
  const nxt=r.pts[q.i+1],turn=nxt&&((nxt[0]-p[0])*dx0+(nxt[1]-p[1])*dz0)<1,rp=raceProg(q.i,q.c.x,q.c.z),rb=rp>pp+400?.85:rp<pp-500?1.1:1;
  const tv=(turn&&d<22?13:q.top*rb);q.v+=Math.sign(tv-q.v)*Math.min(Math.abs(tv-q.v),(tv>q.v?8.5:20)*dt);
  let a=Math.atan2(dx,dz)-q.c.h;a=Math.atan2(Math.sin(a),Math.cos(a));q.c.h+=Math.max(-2.6*dt,Math.min(2.6*dt,a));q.c.x+=sin(q.c.h)*q.v*dt;q.c.z+=cos(q.c.h)*q.v*dt;push(q.c,1.6);
  if(d<7){q.i++;if(q.i>=N){q.done=1;j.fin++;if(!j.place)msg(['A rival','Another rival','The last rival'][Math.min(2,j.fin-1)]+' crossed the finish line','#ff6a6a')}}
  if(c&&Math.hypot(c.x-q.c.x,c.z-q.c.z)<2.6){const ex=c.x-q.c.x,ez=c.z-q.c.z,l=Math.hypot(ex,ez)||1;c.x+=ex/l*.25;c.z+=ez/l*.25;q.c.x-=ex/l*.25;q.c.z-=ez/l*.25;if(Math.abs(c.v-q.v)>5){shake=.3;snd(90,.15,'sawtooth',.05)}q.v*=.97}
  for(const k of cars)if(k.ai&&Math.abs(k.x-q.c.x)+Math.abs(k.z-q.c.z)<4){const ex=k.x-q.c.x,ez=k.z-q.c.z,l=Math.hypot(ex,ez)||1;k.x+=ex/l*4*dt;k.z+=ez/l*4*dt}
  if(q.v>3)for(const e of peds)if(!e.dead&&Math.abs(e.x-q.c.x)+Math.abs(e.z-q.c.z)<2.2&&Math.hypot(e.x-q.c.x,e.z-q.c.z)<1.9)kill(e,sin(q.c.h),cos(q.c.h),1,0);
  if(!P.car&&!P.dead&&Math.hypot(P.x-q.c.x,P.z-q.c.z)<1.8&&q.v>4){P.hp-=25;hit('car');shake=.6}
  rivDraw(q,dt)}
 /* you */
 if(!c){if((j.out+=dt)>5){msg('DISQUALIFIED - you left your car','#ff6a6a');sjEnd(1)}else objSet('Get back in your car!');return}j.out=0;
 let pos=1;for(const q of j.riv)if(q.done||raceProg(q.i,q.c.x,q.c.z)>pp)pos++;
 sjHud(r.n,null,j.t,'CP '+Math.min(j.cp,N-1)+'/'+(N-1)+'  POS '+pos+'/4');
 const p=r.pts[j.cp];if(Math.hypot(c.x-p[0],c.z-p[1])<10){j.cp++;snd(880,.08,'square',.05);
  if(j.cp>=N){const place=j.fin+1;j.place=place;const prize=place==1?r.win:place==2?r.fee:0;SJS.race++;if(place==1&&(!r.best||j.t<r.best))r.best=j.t;
   if(prize)sjPay(prize,place==1?'YOU WON '+r.n+' ('+mmss(j.t)+')':'2ND PLACE - entry fee back');else msg('FINISHED '+['','1ST','2ND','3RD','4TH'][place]+' - better luck next time','#ffb02b');
   const riv=j.riv;SJ=null;beaconOff();objSet('');sbarSet('');setTimeout(()=>{for(const q of riv)sc.remove(q.c.g)},6000);return}raceBeacon()}}
function rivDraw(q,dt){const c=q.c;c.g.position.set(c.x,Math.max(0,terrH(c.x,c.z)),c.z);c.g.rotation.y=c.h;carLod(c);if(c.g.wh)for(const w of c.g.wh)w.rotation.x+=q.v*dt/.37}
/* ---------- GETAWAY ---------- */
function getStart(){if(!P.car)return msg('You need a getaway car first','#ffb02b');const all=GASST.map(g=>({n:'GAS & GO',x:g.x,z:g.z+4})).concat(shops.map(o=>({n:o.name,x:o.x,z:o.z+3})));const c=P.car;
 const far=all.filter(o=>Math.hypot(o.x-c.x,o.z-c.z)>90);const s=ri(far.length?far:all);
 SJ={k:'get',st:'go',s,tl:Math.hypot(s.x-c.x,s.z-c.z)/10+35,peak:0};beacon(s.x,s.z,4,0xff3b3b);objSet('GETAWAY: the crew hits *'+s.n+'* soon. Be parked outside when they run out.');msg('"We go in when you\'re outside. Don\'t be late." - Dice','#c8c8c8')}
function getU(dt){const j=SJ,c=P.car;
 if(j.st=='go'){j.tl-=dt;sjHud('GETAWAY',null,j.tl,'GET TO '+j.s.n);if(j.tl<=0){msg('The crew went in without you. Dice won\'t call again today.','#ff6a6a');sjEnd(1);return}
  if(!c){objSet('GETAWAY: you need a car!');return}
  if(Math.hypot(c.x-j.s.x,c.z-j.s.z)<8&&Math.abs(c.v)<3){j.st='wait';j.w=4;j.car=c;j.crew=[];for(let i=0;i<2;i++){const g=person(ri(skins),'#1a1a1e','#1a1a1e','#111',1);g.position.set(j.s.x+rr(-2,2),0,j.s.z-5+i);j.crew.push(g)}
   msg('"GO GO GO!"','#ff4f4f');snd(900,.3,'square',.06)}return}
 if(j.st=='wait'){j.w-=dt;for(const g of j.crew){const dx=c?c.x-g.position.x:0,dz=c?c.z-g.position.z:0,l=Math.hypot(dx,dz)||1;if(l>1){g.position.x+=dx/l*7*dt;g.position.z+=dz/l*7*dt}g.rotation.y=Math.atan2(dx,dz);g.l[0].rotation.x=Math.sin(j.w*14)*.9;g.l[1].rotation.x=-g.l[0].rotation.x}
  if(j.w<=2.6&&j.crew.length){for(const g of j.crew)sc.remove(g);j.crew=[];heat=Math.max(heat,3);for(let i=0;i<3;i++)mkCop(30);msg('Crew is in! LOSE THE COPS','#ff4f4f')}
  if(j.w<=0){j.st='lose';beaconOff();objSet('GETAWAY: *lose the cops*, then drop the crew at the hideout')}return}
 if(c!==j.car){if((j.out=(j.out||0)+dt)>4){msg('You ditched the car - the crew scattered with the money.','#ff6a6a');sjEnd(1)}else objSet('Get back in the getaway car!');return}j.out=0;
 j.peak=Math.max(j.peak,Math.min(5,Math.floor(heat)));
 if(j.st=='lose'){sjHud('GETAWAY',null,null,Math.floor(heat)+' STARS - LOSE THEM');if(heat<1){const h=curb(c.x,c.z,180,360);j.h=h;j.st='home';beacon(h.x,h.z,4,0x43ff7a);objSet('Clean! Drop the crew at the hideout: *'+h.a+'*')}return}
 if(j.st=='home'){const pay=3000+j.peak*600;sjHud('GETAWAY',pay,null,'TO THE HIDEOUT');if(heat>=1){j.st='lose';beaconOff();objSet('They spotted you again - *lose the cops*');return}
  if(Math.hypot(c.x-j.h.x,c.z-j.h.z)<8&&Math.abs(c.v)<4){SJS.get++;sjPay(pay,'GETAWAY CUT');SJ=null;beaconOff();objSet('');sbarSet('')}}}
/* ---------- menu, per frame ---------- */
function jobsMenu(){if(ST.act)return msg('Not during a story mission','#ffb02b');let h='<h2>SIDE JOBS</h2><div class="stat">EARNED SO FAR $'+SJS.earn.toLocaleString()+'</div>';
 if(SJ)h+='<button data-a="job:quit">QUIT THE CURRENT JOB</button>';
 h+=row('car','EMBER RIDE','Ride-share in any car. Fast + no dents = big tips. Fares done: '+SJS.ride,'START','job:ride');
 h+=row('burger','EMBER EATS','Deliver food before it goes cold - on foot or driving. Orders done: '+SJS.eats,'START','job:eats');
 h+=row('pistol','GETAWAY DRIVER','Wait outside a robbery, lose the cops, drop the crew. Jobs done: '+SJS.get,'START','job:get');
 for(let i=0;i<RACES.length;i++){const r=RACES[i];h+=row('flag',r.n,'$'+r.fee+' entry / win $'+r.win.toLocaleString()+(r.best?' / best '+mmss(r.best):'')+' - drive to the start line','SHOW','job:race'+i)}
 openMd(h+'<button data-a="close">CLOSE (J)</button>')}
function jobAct(id){closeCas();if(id=='quit'){sjEnd();return}if(!sjOK())return;
 if(id.startsWith('race')){const r=RACES[+id.slice(4)];if(SJ)sjEnd(1);beacon(r.sx,r.sz,5,0xffffff);SJ={k:'show',r};objSet('Drive to the start line of *'+r.n+'* (marked)');return}
 if(SJ)sjEnd(1);if(id=='ride'){if(!P.car)msg('Get in a car to start picking up fares','#ffb02b');rideNext()}else if(id=='eats')eatsNext();else if(id=='get')getStart()}
function jobsU(dt){if(!SJ)return;if(!sjOK()){if(P.dead||ST.act){msg('JOB FAILED','#ff6a6a');sjEnd(1)}return}if(!ST.on)beaconU();
 if(SJ.k=='ride')rideU(dt);else if(SJ.k=='eats')eatsU(dt);else if(SJ.k=='race')raceU(dt);else if(SJ.k=='get')getU(dt);
 else if(SJ.k=='show'&&Math.hypot((P.car||P).x-SJ.r.sx,(P.car||P).z-SJ.r.sz)<9){beaconOff();objSet('');SJ=null}}
