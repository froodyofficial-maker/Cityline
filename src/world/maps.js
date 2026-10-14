/* ---- maps ---- */
const MAPS=[{n:'EMBER CITY',d:'THE CLASSIC NEON CITY'},{n:'DUSTLINE',d:'DESERT TOWN. MESAS, CACTI AND SAND STORMS'},{n:'FROSTBITE',d:'SNOWBOUND CITY. PINES, ICE AND FALLING SNOW'},{n:'WASTELAND',d:'RUINED CITY. FIRE, ASH AND TOXIC FOG'}];
const MAPT=[null,{sky:0xe6c88e,dusk:0xff7a3a,night:0x27304f,fog:[70,230],ground:0xd9b36a,rock:0xb0643a,peak:0xd9b36a,water:0x5a8aa0,park:0x9a9a4a,pad:0xcfc09a,road:0x3a3530,tint:[1,.82,.6]},
 {sky:0xcfe4f5,dusk:0xf0a0c0,night:0x2a3a66,fog:[40,160],ground:0xf2f6fa,rock:0x9aa5b0,peak:0xffffff,water:0x9fd8e8,park:0xdde8ee,pad:0xe4eaf0,road:0x6a7280,tint:[.88,.94,1]},
 {sky:0x9a7a4a,dusk:0xc8501f,night:0x1f2a22,fog:[28,120],ground:0x4a4636,rock:0x4a4034,peak:0x6a6458,water:0x4a7a3a,park:0x5a5a3a,pad:0x6a645a,road:0x24231f,tint:[.55,.5,.44]}];
let mapOpen=0,WX=null;
const inCity=(x,z)=>Math.abs(x)<126&&Math.abs(z)<126,inAir=(x,z)=>x>112&&x<352&&z>-80&&z<62;
function scatter(n,fn){let k=0;for(let i=0;i<n*4&&k<n;i++){const x=rr(-340,340),z=rr(-340,340);if(inCity(x,z)||inAir(x,z)||Math.abs(x-80)<16)continue;const n0=sc.children.length;fn(x,z);const th=terrH(x,z);for(let q=n0;q<sc.children.length;q++)sc.children[q].position.y+=th;k++}}
function pine(x,z,q){bx(.4,1.2*q,.4,0x5a3a22,x,.6*q,z,sc);for(let i=0;i<3;i++){const m=new T.Mesh(new T.ConeGeometry(1.9*q*(1-i*.25),2.2*q,7),mat(i==2?0xf4f8fb:0x2f6a4a));m.position.set(x,(1.2+i*1.3+1.1)*q,z);m.castShadow=true;sc.add(m)}}
function cactus(x,z){const c=0x3f8f4a;bx(.6,2.6,.6,c,x,1.3,z,sc);bx(.35,.35,1,c,x+.7,1.6,z,sc);bx(.35,1,.35,c,x+1.15,2.1,z,sc);bx(.35,.35,.9,c,x-.7,1.1,z,sc);bx(.35,.9,.35,c,x-1.1,1.55,z,sc)}
function mkWeather(col,size,fall,drift,n,op){const geo=new T.BufferGeometry(),a=new Float32Array(n*3);for(let i=0;i<n;i++){a[i*3]=rr(-45,45);a[i*3+1]=rr(0,40);a[i*3+2]=rr(-45,45)}geo.setAttribute('position',new T.BufferAttribute(a,3));
 const pt=new T.Points(geo,new T.PointsMaterial({color:col,size,transparent:true,opacity:op,depthWrite:false}));pt.frustumCulled=false;sc.add(pt);WX={pt,a,n,fall,drift}}
function weatherU(dt){if(!WX)return;const a=WX.a;for(let i=0;i<WX.n;i++){let y=a[i*3+1]-WX.fall*dt,x=a[i*3]+WX.drift*dt;if(y<0)y+=40;if(x>45)x-=90;if(x<-45)x+=90;a[i*3]=x;a[i*3+1]=y}WX.pt.geometry.attributes.position.needsUpdate=true;WX.pt.position.set(cam.position.x,cam.position.y-18,cam.position.z)}
function applyMap(id){const t=MAPT[id];if(!t)return;cD.setHex(t.sky);cO.setHex(t.dusk);cN.setHex(t.night);sc.fog.near=t.fog[0];sc.fog.far=t.fog[1];
 paintTerrain(t.ground,t.rock,t.peak);PADM.color.setHex(t.pad).lerp(SKC.w,.5);GRASSM.color.setHex(t.park).lerp(SKC.w,.25);{const a=new T.Color(t.road),b=new T.Color(0x30333a);for(const m of ROADM)m.color.setRGB(Math.min(2.2,a.r/b.r),Math.min(2.2,a.g/b.g),Math.min(2.2,a.b/b.b))}WATERM.color.setHex(t.water);WU.uDeep.value.setHex(t.water).multiplyScalar(.35);WU.uShal.value.setHex(t.water).multiplyScalar(.75);SKYU.uCover.value=[.55,.78,.42,.38][id];const tc=new T.Color(t.tint[0],t.tint[1],t.tint[2]);for(const m of BM)m.color.multiply(tc);for(const m of FMS)m.color.multiply(tc);
 if(id==1){scatter(90,(x,z)=>cactus(x,z));scatter(16,(x,z)=>{const w=rr(24,60),h=rr(22,60),d=rr(24,60),a=Math.atan2(z,x);bx(w,h,d,0xb0643a,x,h/2,z,sc);bx(w+.4,h*.18,d+.4,0x8a4a2a,x,h*.4,z,sc);bx(w+.6,1.6,d+.6,0xc8794a,x,h+.8,z,sc)});
  scatter(26,(x,z)=>{const m=bx(rr(30,70),rr(2,6),rr(20,40),0xe3c07a,x,2,z,sc);m.rotation.y=rr(0,3)});scatter(6,(x,z)=>{for(const[a,b]of[[-1,-1],[1,-1],[-1,1],[1,1]])bx(.4,14,.4,0x333333,x+a,7,z+b,sc);bx(3.4,.6,3.4,0x555555,x,14,z,sc);bx(.5,6,.5,0xcc3333,x,17,z,sc)});mkWeather(0xe3c07a,.2,.3,12,700,.5)}
 else if(id==2){scatter(150,(x,z)=>pine(x,z,rr(.9,1.8)));for(const px of CC)for(const pz of CC)for(const[a,b]of[[-13,-13],[13,-13],[-13,13],[13,13]])if(R()<.55)pine(px+a,pz+b,rr(.8,1.3));
  for(const b of B)if(!b.air&&b.h>2)bx(b.x2-b.x1+.4,.5,b.z2-b.z1+.4,0xffffff,(b.x1+b.x2)/2,b.h+.28,(b.z1+b.z2)/2,sc);
  const lk=new T.Mesh(new T.PlaneGeometry(110,80),mat(0xbfe8f5));lk.rotation.x=-PI/2;lk.position.set(-200,.04,130);sc.add(lk);scatter(40,(x,z)=>bx(rr(3,8),rr(.6,1.6),rr(3,8),0xffffff,x,.4,z,sc));mkWeather(0xffffff,.35,4,1.2,1400,.9)}
 else if(id==3){for(const b of B)if(!b.air&&b.h>2)for(let i=0;i<3;i++){const m=bx(rr(.8,2.2),rr(.6,1.6),rr(.8,2.2),0x6a645a,(R()<.5?b.x1-1.4:b.x2+1.4),.5,rr(b.z1,b.z2),sc);m.rotation.y=rr(0,3)}
  scatter(60,(x,z)=>{bx(.5,rr(4,8),.5,0x2a2218,x,3,z,sc);bx(.3,.3,2.4,0x2a2218,x,rr(4,6),z+1,sc);bx(.3,.3,2,0x2a2218,x,rr(3,5),z-1,sc)});
  for(let i=0;i<14;i++){const r=ri(RD),al=R()<.5,x=al?rr(-110,110):r+rr(-4,4),z=al?r+rr(-4,4):rr(-110,110),c=car(0x3a2a22);c.g.position.set(x,0,z);c.g.rotation.y=rr(0,6)}
  for(let i=0;i<9;i++){const r=ri(RD),al=R()<.5,x=al?rr(-110,110):r+rr(-5,5),z=al?r+rr(-5,5):rr(-110,110);bx(.7,1,.7,0xa0522d,x,.5,z,sc);FIRES.push({x,z,t:1e9,low:1})}mkWeather(0x9a9080,.25,1.5,3,900,.7)}
 msg('MAP: '+MAPS[id].n,'#2bf0ff')}
function mapPrev(c,id){c.width=160;c.height=90;const g=c.getContext('2d'),pal=[['#ff7a3a','#2a1450','#2d6a3a'],['#f6d79a','#e8b86a','#d9b36a'],['#e0f0ff','#a8cbe8','#f2f6fa'],['#9a7a4a','#5a3a1a','#4a4636']][id],bc=['#8a6aa0','#b8855a','#9ab0c8','#5a5048'][id];
 const gr=g.createLinearGradient(0,0,0,60);gr.addColorStop(0,pal[1]);gr.addColorStop(1,pal[0]);g.fillStyle=gr;g.fillRect(0,0,160,60);g.fillStyle=pal[2];g.fillRect(0,58,160,32);g.fillStyle='#2a2d34';g.fillRect(0,68,160,9);
 [[8,34,18],[30,20,22],[56,40,16],[76,26,20],[102,44,18],[126,28,24]].forEach(([x,h,w],i)=>{g.fillStyle=bc;g.fillRect(x,64-h,w,h);if(id==2){g.fillStyle='#fff';g.fillRect(x-1,62-h,w+2,3)}
  if(id==3&&i%2){g.fillStyle=pal[0];g.fillRect(x+w/2,64-h,w/2,6)}g.fillStyle=id==3?'#6a5a3a':'#ffd27a';for(let j=0;j<h-8;j+=7)for(let k=3;k<w-3;k+=6)if((j+k+i)%3)g.fillRect(x+k,64-h+4+j,2,3)});
 if(id==1){g.fillStyle='#3f8f4a';[[6,80],[148,84],[84,82]].forEach(([x,y])=>{g.fillRect(x,y-10,3,10);g.fillRect(x-3,y-7,3,2);g.fillRect(x+3,y-8,3,2)});g.fillStyle='#b0643a';g.fillRect(138,36,22,24)}
 if(id==2){g.fillStyle='#2f6a4a';[[10,84],[150,86],[132,80]].forEach(([x,y])=>{g.beginPath();g.moveTo(x,y-14);g.lineTo(x-6,y);g.lineTo(x+6,y);g.fill()})}
 if(id==3){g.fillStyle='#ff8a2b';g.fillRect(70,76,4,5);g.fillStyle='#ffd23f';g.fillRect(71,73,2,4);g.fillStyle='#3a3a3a';g.fillRect(120,84,10,4)}}
function renderMaps(){$('mg').innerHTML=MAPS.map((m,i)=>'<div class="mc'+(CFG.map==i?' sel':'')+'" data-m="'+i+'" style="animation-delay:'+i*.08+'s"><canvas></canvas><b>'+m.n+'</b><small>'+m.d+'</small></div>').join('');$('mg').querySelectorAll('canvas').forEach((c,i)=>mapPrev(c,i))}
function openMaps(){mapOpen=1;$('maps').style.display='flex';renderMaps();snd(500,.1,'square',.04)}
$('mg').addEventListener('click',e=>{const c=e.target.closest('[data-m]');if(!c)return;CFG.map=+c.dataset.m;$('mg').querySelectorAll('.mc').forEach(x=>x.classList.toggle('sel',x===c));snd(700,.08,'square',.04)});
