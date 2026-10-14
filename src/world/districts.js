/* ==================== Greater Ember City: the districts around downtown ====================
   Every 28x28 block on the RL road lattice outside downtown is filled by its district's builder.
   EMBER HEIGHTS (north)   skyscrapers, plazas, the Ember Tower
   PALM GROVE (west)       suburban houses, lawns, driveways
   FOUNDRY (south-west)    warehouses, smokestacks, tank farms, truck yards
   PORT EMBER (south-east) container yards, harbour cranes, cargo ships
   EASTSIDE (east)         apartment blocks, the mall, parking
   MIDTOWN (ring)          shops, gas stations, offices
   EMBER BEACH (coast)     sand, palms, lifeguard towers, the pier and its Ferris wheel */
const ZONES=['DOWNTOWN','EMBER HEIGHTS','PALM GROVE','FOUNDRY','PORT EMBER','EASTSIDE','MIDTOWN','EMBER BEACH','EMBER INTERNATIONAL'];
function zoneOf(x,z){if(z>COAST)return x<AIRX[0]?'EMBER BEACH':'PORT EMBER';if(Math.abs(x)<=100&&Math.abs(z)<=100)return 'DOWNTOWN';
 if(x>AIRX[0]&&x<AIRX[1]&&z>AIRZ[0]&&z<AIRZ[1])return 'EMBER INTERNATIONAL';if(z<=-100&&x>-220&&x<220)return 'EMBER HEIGHTS';
 if(x<=-100&&z<220)return 'PALM GROVE';if(z>=140)return x>=100?'PORT EMBER':'FOUNDRY';if(x>=100)return 'EASTSIDE';return 'MIDTOWN'}
const PIER={x:-150,z0:COAST,z1:438},FERRIS=[];
const DPAL={tall:[0x9aa7b8,0x7a8ab8,0xc9b8a8,0x6a9a9a,0xd0c4a0,0x8a94a8,0xb8c4d0,0xa8b8c8],house:[0xf2e6d0,0xe8d4b8,0xcfe0e8,0xf0d8d8,0xd8e8d0,0xf4ecc8,0xe0d0e8,0xfafafa,0xc8d8f0],
 roof:[0x5a2e26,0x3a3f4a,0x6a4a3a,0x7a3a2a,0x4a4a52,0x2e3a4a],shed:[0x8a8f96,0x7a6a5a,0xa05a3a,0x5a7a8a,0x9a8a6a,0x6a7a6a],box:[0xc0392b,0x2a6fd0,0xe67e22,0x2f8f4f,0x8a8f96,0xe8e4d8,0x7a3aa8,0xd9a441,0x1f6a7a]};
const CORP=['NOVA','HELIX','KAITO','ORBIT','LUMEN','APEX','VANTA','CORAL','AURA','ZENITH'],SHOPS=['DELI','PHARMACY','LAUNDRY','BAKERY','BOOKS','TACOS','GYM','SALON','MOTEL','DINER','PAWN','HARDWARE'];
/* shared materials: ribbed steel (containers, sheds) with per-object vertex colour */
const RIBM=STD({vertexColors:true,roughness:.6,metalness:.35,map:cvs2(64,64,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=4){g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x,0,1,h);g.fillStyle='rgba(255,255,255,.25)';g.fillRect(x+2,0,1,h)}})});
function rib(w,h,d,c,x,y,z,ry){const g=colGeo(new T.BoxGeometry(w,h,d),c),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*Math.max(1,Math.round(Math.max(w,d)/2)),uv.getY(i));const m=new T.Mesh(g,RIBM);m.position.set(x,y,z);if(ry)m.rotation.y=ry;m.castShadow=m.receiveShadow=true;sc.add(m);return m}
function dPad(cx,cz,grass){const k=cx+','+cz,p=bx(28,.06,28,0xb9b4aa,cx,.03,cz,sc);p.castShadow=false;p.receiveShadow=true;p.material=grass?GRASSM:PADM;PADS[k]=p;return p}
function gplane(x,z,w,d,y){const m=new T.Mesh(new T.PlaneGeometry(w,d),GRASSM);m.rotation.x=-PI/2;m.position.set(x,y||.1,z);m.receiveShadow=true;sc.add(m)}
function nRing(w,d,c,x,y,z){for(const s of[-1,1]){nb(w,.35,.3,c,x,y,z+s*d/2);nb(.3,.35,d,c,x+s*w/2,y,z)}}
const solid=(cx,cz,w,d,h)=>B.push({x1:cx-w/2,x2:cx+w/2,z1:cz-d/2,z2:cz+d/2,h});
function boxCar(x,z,ry){const g=new T.Group();g.userData.stat=1;const c=ri([0xd03030,0x2a6fd0,0xe0b020,0x30a060,0xeeeeee,0x333333,0x8a3aa8,0x9aa0a8]);
 bx(1.9,.7,4.2,c,0,.55,0,g);bx(1.7,.62,2.1,0x1c2430,0,1.2,-.2,g);for(const[a,b]of[[-.9,1.3],[.9,1.3],[-.9,-1.3],[.9,-1.3]])bx(.25,.6,.6,0x111111,a,.3,b,g);g.position.set(x,0,z);g.rotation.y=ry||0;sc.add(g);solid(x,z,2.2,2.2,1.4)}
/* ---------- EMBER HEIGHTS ---------- */
function skyscraper(cx,cz,k){const col=ri(DPAL.tall),nc=ri(NC),nh=parseInt(nc.slice(1),16),w=rr(15,21),d=rr(15,21),h=rr(42,92)*k;WK=R()*5|0;
 const h1=h*rr(.55,.7);wall(w,h1,d,col,cx,cz);WK=(WK+1+(R()*3|0))%5;wall(w*.72,h-h1,d*.72,ri(DPAL.tall),cx,cz,h1);
 nRing(w*.72+.3,d*.72+.3,nh,cx,h+.25,cz);if(R()<.6){cy(.25,10,0x666a70,cx,h+5,cz,6);nb(.7,.7,.7,0xff2222,cx,h+10.3,cz)}else bx(w*.4,3,d*.4,0x3a3f48,cx,h+1.5,cz,sc);
 shopBase(cx,cz,w,d);if(R()<.7)nsign(ri(CORP),nc,cx,h1-3.2,cz+d/2+.08,8);foot(cx,cz,w,d,h1);foot(cx,cz,w*.72,d*.72,h)}
function emberTower(cx,cz){const c=0x34405a;WK=1;wall(24,64,24,c,cx,cz);WK=1;wall(18,52,18,c,cx,cz,64);WK=1;wall(12,40,12,c,cx,cz,116);
 for(const[s,y]of[[24.4,64],[18.4,116],[12.4,156]])nRing(s,s,0xff6a2b,cx,y+.3,cz);cy(.7,34,0xd0d4da,cx,173,cz,8);nb(1.4,1.4,1.4,0xff2222,cx,190.8,cz);
 shopBase(cx,cz,24,24);nsign('EMBER TOWER','#ff6a2b',cx,6,cz+12.2,14);for(const sx of[-1,1])nb(.4,60,.4,0xff6a2b,cx+sx*12.1,32,cz+12.1);foot(cx,cz,24,24,64);foot(cx,cz,18,18,116);foot(cx,cz,12,12,156);towerPlaces(cx,cz)}
function plaza(cx,cz){dPad(cx,cz);cy(3.4,.6,0xd8d8d8,cx,.35,cz,20);cy(2.9,.4,0x2b8fff,cx,.62,cz,20);cy(.5,3,0xd8d8d8,cx,1.6,cz,10);nb(.6,.3,.6,0x37e6ff,cx,3.2,cz);solid(cx,cz,7,7,.9);
 for(const[x,z]of[[-9,-9],[9,-9],[-9,9],[9,9]]){bx(3.2,.7,3.2,0x8a8f96,cx+x,.35,cz+z,sc);tree(cx+x,cz+z,1.2)}for(const[x,z,r]of[[0,-6,0],[0,6,PI],[-6,0,PI/2],[6,0,-PI/2]])bench(cx+x,cz+z,r);
 if(R()<.5){bx(.6,4,.6,0x2a2c30,cx+11,2,cz-2,sc);nsign(ri(CORP),ri(NC),cx+11,4.6,cz-2,4).rotation.y=PI/2}}
function heights(cx,cz){if(cx==0&&cz==-200)return emberTower(cx,cz);if(R()<.13)return plaza(cx,cz);dPad(cx,cz);const k=1.15-Math.min(1,Math.hypot(cx,cz+200)/260)*.55;skyscraper(cx,cz,k)}
/* ---------- PALM GROVE ---------- */
function gRoof(w,d,h,c,x,y,z){const r=Math.hypot(w,d)/2*1.04,m=new T.Mesh(new T.ConeGeometry(r,h,4,1),mat(c));m.rotation.y=PI/4;m.scale.set(w/(r*1.414)*1.04,1,d/(r*1.414)*1.04);m.position.set(x,y+h/2,z);m.castShadow=true;sc.add(m)}
function house(lx,lz,face){/* lot is 12x12; front faces the outer road, back fence on the block's centre line */
 const col=ri(DPAL.house),rc=ri(DPAL.roof),two=R()<.42,w=rr(6.6,7.6),d=rr(6.4,7.2),h=two?6.1:3.3,gs=R()<.5?-1:1,span=w+4.4,hx=lx-gs*(span/2-w/2),gx=lx+gs*(span/2-2.2),hz=lz-face*1.2,fz=hz+face*d/2;
 gplane(lx,lz,12,12);bx(w,h,d,col,hx,h/2+.06,hz,sc);gRoof(w,d,two?2.4:2.1,rc,hx,h+.06,hz);
 bx(4.2,2.9,5.6,col,gx,1.5,hz+face*.6,sc);bx(4.4,.3,5.8,rc,gx,3.05,hz+face*.6,sc);bx(3.4,2.3,.08,0xd8d8d8,gx,1.2,hz+face*3.42,sc);
 const dw=new T.Mesh(new T.PlaneGeometry(3.6,3.8),mat(0xb8b4ac));dw.rotation.x=-PI/2;dw.position.set(gx,.13,lz+face*4.1);dw.receiveShadow=true;sc.add(dw);
 const pw=new T.Mesh(new T.PlaneGeometry(1.2,3.7),mat(0xc8c0b0));pw.rotation.x=-PI/2;pw.position.set(hx,.135,lz+face*4.15);sc.add(pw);
 bx(1.1,2.1,.1,ri([0x6a3a2a,0x2a4a6a,0x8a2a2a,0x2a5a3a]),hx,1.1,fz+face*.05,sc);for(const sx of[-1,1]){const wx=hx+sx*(w/4+.3);bx(1.4,1.1,.08,0x2a3a48,wx,1.7,fz+face*.05,sc);nb(1.2,.9,.04,0xffd27a,wx,1.7,fz+face*.09);
  if(two){bx(1.4,1.1,.08,0x2a3a48,wx,4.6,fz+face*.05,sc);if(R()<.6)nb(1.2,.9,.04,0xffd27a,wx,4.6,fz+face*.09)}}
 foot(hx,hz,w,d,h+2);solid(gx,hz+face*.6,4.2,5.6,3.1);
 const bz=lz-face*6;bx(12,.9,.1,0xf4f1ea,lx,.45,bz,sc);B.push({x1:lx-6,x2:lx+6,z1:bz-.1,z2:bz+.1,h:.9});
 const mx=lx+(gs>0?-5.2:5.2);bx(.1,1.1,.1,0x555555,mx,.55,lz+face*5.6,sc);bx(.5,.4,.32,ri([0x2b6fd0,0x333333,0xc0392b]),mx,1.2,lz+face*5.6,sc);
 if(R()<.22){for(let i=0;i<3;i++)bx(.35,.12,.25,0xf2f0ea,hx+rr(-.6,.6),.12+i*.12,fz+face*1.1,sc);const h={x:hx,z:fz+face*1.5,f:face,day:-1};BRK.push(h);poi({x:h.x,z:h.z,r:2.4,txt:()=>night()?'E - Break in (newspapers piling up - nobody home?)':'Newspapers piling up... come back after dark',e:()=>breakIn(h)})}
 if(R()<.75)tree(lx-gs*4.4,lz+face*4.3,rr(.75,1.05));bush(hx-w/2+.4,fz+face*.9,rr(.55,.8));bush(hx+w/2-.4,fz+face*.9,rr(.55,.8))}
function park(cx,cz){dPad(cx,cz,1);mkPark(cx,cz,R()*3|0)}
function grove(cx,cz){const r=R();if(r<.08)return park(cx,cz);if(r<.13)return gasStation(cx,cz);dPad(cx,cz);
 for(const sx of[-1,1])for(const sz of[-1,1])house(cx+sx*6,cz+sz*6,sz)}
/* ---------- FOUNDRY ---------- */
function fence(x1,z1,x2,z2){const L=Math.hypot(x2-x1,z2-z1),n=Math.max(1,Math.round(L/4)),a=Math.atan2(x2-x1,z2-z1);for(let i=0;i<=n;i++)bx(.12,2.2,.12,0x6a6e74,x1+(x2-x1)*i/n,1.1,z1+(z2-z1)*i/n,sc);
 const r=bx(.06,.06,L,0x8a8e94,(x1+x2)/2,2.15,(z1+z2)/2,sc);r.rotation.y=a;const p=bx(.03,1.9,L,0x9aa0a6,(x1+x2)/2,1.05,(z1+z2)/2,sc);p.rotation.y=a;p.material=CHAINM;B.push({x1:Math.min(x1,x2)-.1,x2:Math.max(x1,x2)+.1,z1:Math.min(z1,z2)-.1,z2:Math.max(z1,z2)+.1,h:2.2})}
const CHAINM=new T.MeshStandardMaterial({color:0xb8bec6,metalness:.6,roughness:.5,transparent:true,alphaTest:.5,side:T.DoubleSide,map:cvs2(32,32,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle='#fff';g.lineWidth=2;for(let i=-w;i<w*2;i+=8){g.beginPath();g.moveTo(i,0);g.lineTo(i+h,h);g.stroke();g.beginPath();g.moveTo(i+h,0);g.lineTo(i,h);g.stroke()}})});CHAINM.map.repeat.set(6,1);
function warehouse(cx,cz,w,d,h){const c=ri(DPAL.shed);rib(w,h,d,c,cx,h/2+.06,cz);const n=Math.max(3,Math.round(w/6));for(let i=0;i<n;i++){const s=bx(w/n,.25,d*.55,0x5a5f66,cx-w/2+(i+.5)*w/n,h+1,cz,sc);s.rotation.z=.32}
 for(let i=0;i<3;i++){const x=cx-w/3+i*w/3;bx(3.6,4.2,.1,0xa8acb2,x,2.2,cz+d/2+.06,sc);bx(4,.5,.5,0xffc94a,x,4.6,cz+d/2+.3,sc)}bx(w*.9,1.2,2.2,0x9a968e,cx,.6,cz+d/2+1.2,sc);solid(cx,cz+d/2+1.2,w*.9,2.2,1.2);
 nsign(ri(['FREIGHT','STORAGE','EMBER STEEL','DOCK 7','COLD STORE','PARTS']),ri(['#ffc94a','#ff6a2b','#2bf0ff']),cx-w/4,h-1.4,cz+d/2+.12,7);foot(cx,cz,w,d,h+1.4)}
function truck(x,z,ry){const g=new T.Group();g.userData.stat=1;bx(2.4,2.4,2.6,ri([0xd03030,0x2a6fd0,0xeeeeee,0x30a060]),0,1.6,4.6,g);bx(2.2,.7,.1,0x1c2430,0,2.3,5.92,g);bx(2.5,2.8,9,ri(DPAL.box),0,1.9,-1.4,g);for(const a of[-1.1,1.1])for(const b of[4.6,-.5,-4.4])bx(.3,.9,.9,0x111111,a,.45,b,g);g.position.set(x,0,z);g.rotation.y=ry||0;sc.add(g);
 const s=Math.abs(Math.sin(ry||0))>.7;solid(x,z,s?13:2.6,s?2.6:13,2.9)}
function smokestack(x,z,h){cy(1.5,h,0x8a4a3a,x,h/2,z,12);for(let y=h-8;y<h;y+=4)cy(1.56,1.2,0xe8e4d8,x,y,z,12);cy(1.7,.8,0x2a2a2e,x,h,z,12);solid(x,z,3.2,3.2,h)}
function foundry(cx,cz){dPad(cx,cz);const r=R();
 if(r<.5){warehouse(cx,cz-2,rr(20,25),rr(15,19),rr(7,10));if(R()<.5)truck(cx+rr(-6,6),cz+12,PI/2)}
 else if(r<.66){for(const[x,z]of[[-6,-6],[6,-6],[-6,6],[6,6]]){cy(4.4,7,0xdcdcdc,cx+x,3.5,cz+z,18);cy(4.5,.4,0x9aa0a6,cx+x,7.1,cz+z,18);solid(cx+x,cz+z,9,9,7.2)}bx(24,.4,.4,0x8a8e94,cx,6,cz,sc);bx(.4,.4,24,0x8a8e94,cx,6,cz,sc);fence(cx-13.5,cz+13.5,cx+13.5,cz+13.5)}
 else if(r<.82){warehouse(cx-3,cz+2,rr(15,18),rr(14,18),rr(9,12));smokestack(cx+9,cz-8,rr(22,32));if(R()<.6)smokestack(cx+9,cz-2,rr(18,26))}
 else{for(let i=0;i<3;i++)truck(cx-8+i*8,cz-3,0);for(let i=0;i<5;i++){const h=1+(R()*3|0);for(let k=0;k<h;k++)rib(2.44,2.6,6.1,ri(DPAL.box),cx-10+i*5,1.36+k*2.62,cz+9)}solid(cx,cz+9,26,6.2,8);fence(cx-13.5,cz-13.5,cx+13.5,cz-13.5)}}
/* ---------- PORT EMBER ---------- */
function stacks(cx,cz){for(let row=0;row<3;row++)for(let col=0;col<3;col++){const x=cx-8.5+col*8.5,z=cz-8+row*8,h=1+(R()*4|0);for(let k=0;k<h;k++)rib(6.1,2.6,2.44,ri(DPAL.box),x,1.36+k*2.62,z);solid(x,z,6.2,2.5,h*2.62)}}
function crane(x){const zq=COAST+12,c=ri([0xe8452c,0xffc94a,0x2a6fd0]);for(const dx of[-5,5])for(const z of[zq-7,zq+7]){bx(1.2,34,1.2,c,x+dx,17,z,sc);solid(x+dx,z,1.4,1.4,34)}
 bx(1.6,2,74,c,x-5,34,zq+20,sc);bx(1.6,2,74,c,x+5,34,zq+20,sc);for(let z=zq-14;z<zq+56;z+=8)bx(10,.6,.6,c,x,34.8,z,sc);bx(6,4,6,0x3a3f48,x,37,zq-6,sc);bx(3,2.6,3,0xe8e4d8,x,31,zq+14,sc);
 for(const dx of[-.6,.6])bx(.08,18,.08,0x222222,x+dx,23,zq+14,sc);rib(6.1,2.6,2.44,ri(DPAL.box),x,13,zq+14)}
function ship(x,z,len){const hc=ri([0x7a1f1f,0x1f3a6a,0x2a2a30,0x1f5a3a]);bx(len,8,15,hc,x,.2,z,sc);bx(len+.2,.6,15.2,0xe8e4d8,x,4.3,z,sc);bx(10,9,13,0xf2f0ea,x+len/2-7,9,z,sc);for(let i=0;i<5;i++)nb(8.6,.5,.05,0xffd27a,x+len/2-7,6+i*1.8,z-6.55);
 bx(2,7,2,0x2a2a30,x+len/2-4,16,z,sc);for(let i=0;i<Math.floor((len-16)/6.4);i++){const h=1+(R()*3|0);for(let k=0;k<h;k++)rib(6.1,2.6,12,ri(DPAL.box),x-len/2+5+i*6.4,5.9+k*2.62,z)}solid(x,z,len,15,8)}
function quay(){const x0=AIRX[0],x1=400,z0=COAST,z1=COAST+34;const q=new T.Mesh(new T.PlaneGeometry(x1-x0,z1-z0),PADM);q.rotation.x=-PI/2;q.position.set((x0+x1)/2,.05,(z0+z1)/2);q.receiveShadow=true;sc.add(q);
 bx(x1-x0,3,1,0x6a6e74,(x0+x1)/2,-1.2,z1+.5,sc);nb(x1-x0,.05,.3,0xffc94a,(x0+x1)/2,.09,z1-1.2);for(let x=x0+6;x<x1;x+=12){cy(.35,.6,0x2a2a2e,x,.35,z1-.6,8);solid(x,z1-.6,.7,.7,.6)}
 for(let x=150;x<x1-20;x+=70)crane(x);craneLadder(150);ship(190,COAST+66,84);ship(310,COAST+70,96)}
function port(cx,cz){dPad(cx,cz);if(R()<.7)stacks(cx,cz);else warehouse(cx,cz,rr(22,25),rr(18,22),rr(8,11))}
/* ---------- EASTSIDE ---------- */
function apartments(cx,cz){const col=ri(DPAL.house),w=rr(16,22),d=rr(12,16),h=3*(4+(R()*6|0));WK=R()<.5?3:1;wall(w,h,d,col,cx,cz);shopBase(cx,cz,w,d);
 for(let y=6;y<h-1;y+=3)for(const sz of[-1,1]){bx(w*.8,.18,1.3,0xd8d4cc,cx,y,cz+sz*(d/2+.65),sc);bx(w*.8,.9,.06,0x6a7078,cx,y+.5,cz+sz*(d/2+1.28),sc)}
 nsign(ri(SHOPS),ri(NC),cx,4.3,cz+d/2+.1,6);foot(cx,cz,w,d+2.6,h);if(R()<.4)mkRoof(cx,cz,w,d,h,parseInt(ri(NC).slice(1),16));else if(R()<.5)bx(w*.3,2,d*.3,0x8a8f96,cx,h+1,cz,sc)}
function parking(cx,cz,n){const p=new T.Mesh(new T.PlaneGeometry(27,27),roadMat());p.rotation.x=-PI/2;p.position.set(cx,.1,cz);p.receiveShadow=true;sc.add(p);
 for(let i=0;i<9;i++)for(const z of[-8,8])bx(.12,.02,5,0xffffff,cx-12+i*3,.09,cz+z,sc);for(let i=0;i<n;i++){const s=R()*16|0;boxCar(cx-10.5+(s%8)*3,cz+(s<8?-8:8),R()<.5?0:PI)}}
function mall(cx,cz){dPad(cx,cz);WK=0;wall(26,9,18,0xe8e0d0,cx,cz-4);bx(26.4,.5,3,0xff2f6d,cx,6,cz+5.2,sc);nsign('EMBER MALL','#ff2f6d',cx,7.6,cz+5.1,12);for(const x of[-8,0,8])bx(4,3.2,.1,0x2a3a48,x+cx,1.7,cz+5.06,sc);foot(cx,cz-4,26,18,9);
 for(let i=0;i<4;i++)if(i!=1&&i!=2)boxCar(cx-10+i*6.5,cz+10.5,PI/2);buildMall(cx,cz)}
function eastside(cx,cz){const r=R();if(r<.08)return park(cx,cz);dPad(cx,cz);if(r<.3)return parking(cx,cz,6+(R()*8|0));apartments(cx,cz)}
/* ---------- MIDTOWN ---------- */
function gasStation(cx,cz){dPad(cx,cz);bx(16,.6,10,0xf2f2f2,cx,5.3,cz+2,sc);nb(16.2,.25,10.2,0x43ff7a,cx,5,cz+2);for(const[x,z]of[[-7,-2.5],[7,-2.5],[-7,6.5],[7,6.5]])bx(.4,5,.4,0xdddddd,cx+x,2.5,cz+z,sc);
 for(const x of[-4,0,4]){bx(.9,1.6,.6,0xd0302a,cx+x,.8,cz+2,sc);nb(.6,.4,.05,0x43ff7a,cx+x,1.3,cz+2.32);solid(cx+x,cz+2,1,.7,1.6)}
 WK=0;wall(10,4,6,0xe8e4d8,cx,cz-9);nsign('GAS','#43ff7a',cx,3.4,cz-5.9,4);foot(cx,cz-9,10,6,4);gasPlaces(cx,cz);bx(.4,7,.4,0x333333,cx+12,3.5,cz+11,sc);nb(2.4,1.6,.2,0x43ff7a,cx+12,7,cz+11)}
function shopRow(cx,cz){dPad(cx,cz);for(const sz of[-1,1])for(let i=0;i<3;i++){const x=cx-8.5+i*8.5,z=cz+sz*6,h=rr(4.5,8);WK=R()*5|0;wall(8,h,9,ri(PAL2),x,z);shopBase(x,z,8,9);
  const s=nsign(ri(SHOPS),ri(NC),x,3.9,z+sz*4.6,5.5);if(sz<0)s.rotation.y=PI;bx(7.4,.25,1.4,parseInt(ri(NC).slice(1),16),x,3.1,z+sz*5.1,sc);foot(x,z,8,9,h)}}
function midtown(cx,cz){const r=R();if(r<.1)return park(cx,cz);if(r<.22)return gasStation(cx,cz);if(r<.5)return shopRow(cx,cz);if(r<.62){dPad(cx,cz);return parking(cx,cz,8+(R()*6|0))}
 dPad(cx,cz);tower(cx,cz,ri([0,1,2,3,4,5,6,7,8,9]))}
/* ---------- EMBER BEACH & the pier ---------- */
function umbrella(x,z){const c=ri([0xff2f6d,0xffc94a,0x2bf0ff,0x43ff7a,0xff6a2b]);bx(.08,2.4,.08,0xeeeeee,x,1.2,z,sc);const m=new T.Mesh(new T.ConeGeometry(1.5,.6,10),mat(c));m.position.set(x,2.5,z);m.castShadow=true;sc.add(m);
 const t=bx(1,.03,2,ri([0xffffff,0x2b6fd0,0xff2f6d,0xffc94a]),x+rr(-1.5,1.5),.06,z+1.2,sc);t.rotation.y=rr(-.4,.4)}
function lifeguard(x,z){for(const a of[-1,1])for(const b of[-1,1])bx(.18,2.4,.18,0xf2f2f2,x+a,1.2,z+b,sc);bx(2.6,.2,2.6,0xf2f2f2,x,2.5,z,sc);bx(2.4,1.8,2.2,0xe8452c,x,3.5,z,sc);bx(2.8,.2,2.6,0xf2f2f2,x,4.5,z,sc);const r=bx(.6,.1,3,0xf2f2f2,x,1.3,z+2.2,sc);r.rotation.x=.8;solid(x,z,2.6,2.6,2.4)}
function hut(x,z,txt,c){WK=0;bx(5,3,4,0xf4ecd8,x,1.5,z,sc);for(let i=0;i<5;i++)bx(1,.15,1.6,i%2?0xffffff:c,x-2+i,3.2,z+2.6,sc);nsign(txt,'#'+c.toString(16).padStart(6,'0'),x,3.9,z+2.05,4);solid(x,z,5,4,3)}
function ferris(x,z){const g=new T.Group();g.userData.dyn=1;const wheel=new T.Group();g.add(wheel);const R0=13,c=0xff2f6d;
 const ring=new T.Mesh(new T.TorusGeometry(R0,.35,6,40),nmat(c));wheel.add(ring);const ring2=ring.clone();ring2.position.z=-1.6;wheel.add(ring2);
 for(let i=0;i<16;i++){const a=i/16*PI*2,s=bx(.18,R0,.18,0xe8e4d8,Math.cos(a)*R0/2,Math.sin(a)*R0/2,-.8,wheel);s.rotation.z=a-PI/2;const p=new T.Group();p.position.set(Math.cos(a)*R0,Math.sin(a)*R0,-.8);bx(1.4,1.2,1.2,ri([0xffc94a,0x2bf0ff,0x43ff7a,0xff6a2b]),0,-1,0,p);wheel.add(p)}
 wheel.position.y=R0+2;for(const sx of[-1,1]){const l=bx(.5,R0+3,.5,0xe8e4d8,sx*4,(R0+2)/2,-.8,g);l.rotation.z=sx*.28}g.position.set(x,.5,z);sc.add(g);FERRIS.push({wheel,pods:wheel.children.filter(o=>o.isGroup)})}
function beach(){for(let x=-380;x<AIRX[0]-2;x+=14){const pm=new T.Mesh(palmGeo(),PALMM);pm.scale.setScalar(rr(.95,1.25));pm.position.set(x+rr(-2,2),0,COAST+5);pm.rotation.y=rr(0,6);pm.castShadow=true;sc.add(pm);solid(x,COAST+5,.6,.6,2)}
 const pr=new T.Mesh(new T.PlaneGeometry(AIRX[0]+386,3.4),PADM);pr.rotation.x=-PI/2;pr.position.set((AIRX[0]-386)/2,.06,COAST+1.8);pr.receiveShadow=true;sc.add(pr);
 for(let i=0;i<70;i++){const x=rr(-370,AIRX[0]-10);if(Math.abs(x-PIER.x)<8)continue;umbrella(x,COAST+rr(10,22))}
 for(let x=-340;x<AIRX[0]-20;x+=90)lifeguard(x,COAST+20);for(const[x,t,c]of[[-260,'SURF','2bf0ff'],[-60,'ICE CREAM','ff2f6d'],[40,'TACOS','ffc94a']])hut(x,COAST+9,t,parseInt(c,16));
 for(const sx of[-1,1])bx(.15,2.4,.15,0xeeeeee,-210+sx*4,1.2,COAST+16,sc);bx(8,1,.05,0xf2f2f2,-210,1.9,COAST+16,sc);
 /* the pier: deck at y 1.3 on pilings, wider platform at the end with the Ferris wheel */
 const L=PIER.z1-PIER.z0;bx(8,.4,L,0x8a6a48,PIER.x,.3,(PIER.z0+PIER.z1)/2,sc);for(let z=PIER.z0+6;z<PIER.z1;z+=8)for(const sx of[-1,1]){bx(.5,4,.5,0x5a4430,PIER.x+sx*3.6,-1.8,z,sc);bx(.12,1,.12,0xe8e4d8,PIER.x+sx*3.9,1,z,sc)}
 for(const sx of[-1,1])bx(.1,.1,L,0xe8e4d8,PIER.x+sx*3.9,1.5,(PIER.z0+PIER.z1)/2,sc);bx(28,.4,24,0x8a6a48,PIER.x,.3,PIER.z1-10,sc);for(let x=-12;x<=12;x+=6)for(const z of[-20,-10,0])bx(.6,4,.6,0x5a4430,PIER.x+x,-1.8,PIER.z1+z,sc);
 for(let z=PIER.z0+12;z<PIER.z1-24;z+=24)lampP(PIER.x+3.4,z,-1,0);ferris(PIER.x,PIER.z1-12);nsign('EMBER PIER','#ff2f6d',PIER.x,5,PIER.z0+1,8).rotation.y=PI;for(const sx of[-1,1])nb(.4,5,.4,0xff2f6d,PIER.x+sx*4.2,2.5,PIER.z0+1)}
function onPier(x,z){return(Math.abs(x-PIER.x)<4.2&&z>PIER.z0-1&&z<PIER.z1)||(Math.abs(x-PIER.x)<14&&z>PIER.z1-22&&z<PIER.z1+2)}
function ferrisU(dt){for(const f of FERRIS){f.wheel.rotation.z+=dt*.06;for(const p of f.pods)p.rotation.z=-f.wheel.rotation.z}}
/* ---------- assemble ---------- */
const SPECIAL={'-40,120':courthouse,'-280,240':penitentiary,'160,120':mall,'240,120':dealership,'-40,200':chopShop,'240,200':portYard};
function buildDistricts(){const t0=performance.now();let n=0;
 for(let cx=-360;cx<=360;cx+=40)for(let cz=-360;cz<=280;cz+=40){if(Math.abs(cx)<=80&&Math.abs(cz)<=80)continue;if(cx==80)continue;if(cx>=120&&cx<=360&&cz>=-80&&cz<=40)continue;
  const z=zoneOf(cx,cz),sp=SPECIAL[cx+','+cz];n++;if(sp)sp(cx,cz);else if(z=='EMBER HEIGHTS')heights(cx,cz);else if(z=='PALM GROVE')grove(cx,cz);else if(z=='FOUNDRY')foundry(cx,cz);else if(z=='PORT EMBER')port(cx,cz);else if(z=='EASTSIDE')eastside(cx,cz);else midtown(cx,cz)}
  for(let cx=-360;cx<=360;cx+=40)for(let cz=-360;cz<=280;cz+=40){const z=zoneOf(cx,cz);if(PADS[cx+','+cz]&&!PARKS.some(p=>p.cx==cx&&p.cz==cz)&&z!='PALM GROVE'&&!SPECIAL[cx+','+cz]&&R()<.6&&!(Math.abs(cx)<=80&&Math.abs(cz)<=80)){const dx=cx+13,dz=cz+(R()<.5?-1:1)*rr(4,9);if(!bNear(dx-1.5,dz-1.5,dx+1.5,dz+1.5).some(b=>dx+1>b.x1&&dx-1<b.x2&&dz+1.5>b.z1&&dz-1.5<b.z2))mkDump(dx,dz,1)}}
 beach();quay();console.log('districts: '+n+' blocks in '+(performance.now()-t0|0)+'ms')}
/* district name card when the player crosses into a new part of the city */
let ZN='',ZNT=0;
function zoneU(dt){if((ZNT-=dt)>0)return;ZNT=.5;if(IN||cut||(typeof CIN!=='undefined'&&CIN))return;const c=P.car||P.heli||P.plane||P,z=zoneOf(c.x,c.z);if(z===ZN)return;const first=!ZN;ZN=z;if(first)return;
 const e=$('zn');if(!e)return;e.textContent=z;e.classList.remove('on');void e.offsetWidth;e.classList.add('on')}
