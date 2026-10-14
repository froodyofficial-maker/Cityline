/* ===== v7: graphics + living world + police evasion ===== */
function hsh(i,j){const s=Math.sin(i*127.1+j*311.7)*43758.5453;return s-Math.floor(s)}
function vnz(x,z){const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);return hsh(i,j)*(1-u)*(1-v)+hsh(i+1,j)*u*(1-v)+hsh(i,j+1)*(1-u)*v+hsh(i+1,j+1)*u*v}
const fbm=(x,z)=>vnz(x*.012,z*.012)*.6+vnz(x*.03,z*.03)*.28+vnz(x*.08,z*.08)*.12;
/* flat city out to ~400 m, mountains beyond on three sides, the river valley at x=80 and the coast to the south */
function terrH(x,z){if(z>COAST+40)return -1.8-smooth(COAST+40,COAST+160,z)*7;
 const dc=Math.max(Math.abs(x)-410,-z-410,0);let h=smooth(0,90,dc)*(fbm(x+500,z+500)-.18)*120;if(h<0)h*=.2;
 const rv=Math.abs(x-80);h*=smooth(10,48,rv);let r=h-1.8*(1-smooth(8,11,rv));if(z>COAST)r=Math.min(r,-smooth(COAST+20,COAST+40,z)*1.8);return r}
const PONDS=[],HIDE=[],PARKS=[],DUMP=[],SIGS=[],BOATS=[];
function inWater(x,z){if(z>COAST+27){if(onPier(x,z))return false;if(x>AIRX[0]&&z<COAST+34)return false;return true}if(Math.abs(x-80)<9.2){for(const r of RL)if(r<=300&&Math.abs(z-r)<6.5)return false;return true}for(const p of PONDS)if((x-p.x)*(x-p.x)+(z-p.z)*(z-p.z)<p.r*p.r)return true;return false}
let TG=null,TH=null;const BEDC=new T.Color(0x6a5a40),SANDC=new T.Color(0xe6d2a0);
function paintTerrain(gc,rc,pc){if(!TG)return;const a=TG.attributes.color.array,pos=TG.attributes.position.array,G=new T.Color(gc),Rk=new T.Color(rc),Pk=new T.Color(pc),c=new T.Color();
 for(let i=0;i<TH.length;i++){const h=TH[i],x=pos[i*3],z=-pos[i*3+1],nz=(hsh(Math.floor(x*.5),Math.floor(z*.5))-.5)*.08;c.copy(G).lerp(Rk,smooth(6,40,h)).lerp(Pk,smooth(48,85,h));if(z>COAST-3&&x<AIRX[0])c.lerp(SANDC,smooth(COAST-3,COAST+3,z)*(1-smooth(-.9,-2.5,h)));if(h<-.3)c.lerp(BEDC,.7);a[i*3]=c.r+nz;a[i*3+1]=c.g+nz;a[i*3+2]=c.b+nz}TG.attributes.color.needsUpdate=true}
function buildTerrain(){const g=new T.PlaneGeometry(1500,1500,250,250),pos=g.attributes.position.array,n=pos.length/3;TH=new Float32Array(n);
 for(let i=0;i<n;i++){const h=terrH(pos[i*3],-pos[i*3+1]);pos[i*3+2]=h;TH[i]=h}g.setAttribute('color',new T.BufferAttribute(new Float32Array(n*3),3));g.computeVertexNormals();ground.geometry.dispose();ground.geometry=g;TG=g;ground.material=STD({vertexColors:true,map:GRASSD,roughness:.95});paintTerrain(0x5b8a4a,0x7a7466,0xeef2f5)}
/* --- textures --- */
const PADM0=new T.MeshLambertMaterial({color:0xb9b4aa,map:cvs2(64,64,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);g.strokeStyle='#bdbdbd';g.lineWidth=2;g.strokeRect(0,0,w,h);for(let i=0;i<60;i++){g.fillStyle='rgba(0,0,0,'+rr(.02,.07)+')';g.fillRect(rr(0,w),rr(0,h),2,2)}})});PADM0.map.repeat.set(14,14);
const GRASSM0=new T.MeshLambertMaterial({color:0x58a048,map:cvs2(64,64,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);for(let i=0;i<260;i++){g.fillStyle='rgba(0,'+(60+rr(0,60)|0)+',0,'+rr(.05,.18)+')';g.fillRect(rr(0,w),rr(0,h),1,rr(1,3))}})});GRASSM0.map.repeat.set(10,10);
const WATERM=new T.MeshPhongMaterial({color:0x2b7fc0,map:cvs2(128,128,(g,w,h)=>{g.fillStyle='#8ab8e0';g.fillRect(0,0,w,h);for(let i=0;i<240;i++){g.fillStyle='rgba(255,255,255,'+rr(.05,.3)+')';g.fillRect(rr(0,w),rr(0,h),rr(4,20),rr(1,2))}}),transparent:true,opacity:.86,shininess:100,specular:0xaad4ff});WATERM.map.repeat.set(3,40);
const XWM=new T.MeshBasicMaterial({map:cvs2(8,64,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='#fff';for(let i=0;i<8;i++)g.fillRect(0,i*8+1,w,4)}),transparent:true,alphaTest:.5,depthWrite:false});
/* --- sky --- */
let DOME=null,SUNM=null,MOONM=null,STAR=null;const CLOUDS=[],ZEN=new T.Color(0x1a3a7a),WHT=new T.Color(0xffffff);let CLM=null;
function glow(col,r){return cvs2(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,col);gr.addColorStop(r,col.replace(/[\d.]+\)$/,'.35)'));gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h)})}
function buildSky(){DOME=new T.Mesh(new T.SphereGeometry(860,40,20),new T.ShaderMaterial({uniforms:SKYU,vertexShader:'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:SKYFS,side:T.BackSide,depthWrite:false,fog:false}));DOME.renderOrder=-10;DOME.frustumCulled=false;sc.add(DOME)}
function skyX(day,sh,n,du){if(!DOME)return;DOME.visible=!IN;const U=SKYU,sa=tod*2*PI,dx=sin(sa),dy=-cos(sa);U.uHor.value.copy(tmp);U.uTop.value.copy(SKC.nTop).lerp(SKC.dTop,day).lerp(tmp,.25+du*.3);
 U.uSunDir.value.set(dx,dy,.45).normalize();U.uMoonDir.value.set(-dx,-dy,-.45).normalize();U.uSunCol.value.copy(SKC.sunW).lerp(SKC.sunO,Math.min(1,du*1.2));U.uNight.value=n;U.uCloud.value.copy(SKC.cNight).lerp(SKC.cDay,day).lerp(SKC.cDusk,du*.6);
 BEAMM.opacity=.4*n;POOLM.opacity=.32*n;XWM.color.setScalar(.4+.6*day);if(GLOWS)GLOWS.material.opacity=smooth(.35,.8,n)*.8;
 const sd=dy>-.05;WU.uSunDir.value.copy(sd?U.uSunDir.value:U.uMoonDir.value);WU.uSunCol.value.copy(sd?U.uSunCol.value:SKC.moon).multiplyScalar(sd?smooth(-.05,.25,dy):.35);WU.uFogC.value.copy(tmp);WU.uSky.value.copy(U.uTop.value);WU.uFogN.value=sc.fog.near;WU.uFogF.value=sc.fog.far}
function skyPlace(){if(DOME)DOME.position.copy(cam.position)}
function cloudU(dt){}
/* --- water, bridges, banks --- */
let WATER=null;
/* the river runs from the northern mountains to the sea; the ocean shares its reflective material */
const RZ0=-470,RZ1=COAST+30;let OCEAN=null;
function buildRiver(){WATER=new T.Mesh(new T.PlaneGeometry(19,RZ1-RZ0),waterMat(0));WATER.rotation.x=-PI/2;WATER.position.set(80,-.5,(RZ0+RZ1)/2);sc.add(WATER);
 OCEAN=new T.Mesh(new T.PlaneGeometry(2600,1400),WATER.material);OCEAN.rotation.x=-PI/2;OCEAN.position.set(0,-.5,COAST+27+700);sc.add(OCEAN);
 for(const sd of[-1,1]){const f=new T.Mesh(new T.PlaneGeometry(.7,RZ1-RZ0),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.35,depthWrite:false}));f.rotation.x=-PI/2;f.position.set(80+sd*9.3,-.45,(RZ0+RZ1)/2);sc.add(f)}
 const RDX=RL.filter(r=>r<=300),rs=[RZ0,...RDX,COAST+20];for(let i=0;i<rs.length-1;i++){const z1=rs[i]+(i?6.5:0),z2=rs[i+1]-(i<rs.length-2?6.5:0),zc=(z1+z2)/2,len=z2-z1;if(len>1)for(const sd of[-1,1])bx(.9,1.4,len,0x7a7f88,80+sd*9.9,-.35,zc,sc)}
 for(const r of RDX){bx(24,.6,12.4,0x6a707a,80,-.3,r,sc);for(const sd of[-1,1]){bx(24,1.1,.35,0x9aa0aa,80,.6,r+sd*6.1,sc);for(let i=-5;i<=5;i++)bx(.4,1.5,.5,0x7a808a,80+i*2.2,.7,r+sd*6.1,sc);nb(24,.12,.12,0x37e6ff,80,1.2,r+sd*6.1)}for(const x of[-8,0,8])bx(1.4,2.6,5,0x6a707a,80+x,-1.3,r,sc)}
 for(const z of[-240,-160,-40,0,40,80,160,240]){const g=new T.Group();bx(2.2,.7,6,0x8a3a2a,0,0,0,g);bx(1.6,.9,2.2,0xe8e4d8,0,.7,.6,g);nb(.3,.3,.3,0xffd27a,0,1.3,.6,g);g.position.set(80+rr(-3,3),-.2,z);g.rotation.y=rr(-.3,.3);sc.add(g);BOATS.push({g,y0:-.2,ph:rr(0,6)})}}
function drawRiver(g){g.fillStyle='#4a9a4a';for(const p of PARKS)g.fillRect(MX(p.cx-14),MX(p.cz-14),Math.round(28*mq),Math.round(28*mq));g.fillStyle='#e6d2a0';g.fillRect(MX(-420),MX(COAST),MX(AIRX[0])-MX(-420),Math.round(27*mq));g.fillStyle='#2b6fb0';g.fillRect(MX(70.5),MX(RZ0),Math.round(19*mq),MX(RZ1)-MX(RZ0));g.fillRect(0,MX(COAST+27),MS.width,MS.height);g.fillStyle='#8a8f99';g.fillRect(MX(AIRX[0]),MX(COAST),MX(400)-MX(AIRX[0]),Math.round(34*mq));g.fillRect(MX(PIER.x-4),MX(PIER.z0),Math.round(8*mq),MX(PIER.z1)-MX(PIER.z0));g.fillStyle='#3a3d44';for(const r of RL)if(r<=300)g.fillRect(MX(68),MX(r)-4,Math.round(24*mq),8)}
/* --- trees, parks --- */
const IG=new T.IcosahedronGeometry(1,0),TRK=new T.CylinderGeometry(.22,.3,2.4,6);
function tree(x,z,s,col){const m=new T.Mesh(TRK,mat(0x5e4128));m.scale.set(s,s*1.1,s);m.position.set(x,1.3*s,z);m.castShadow=true;sc.add(m);
 const c=new T.Mesh(canopyGeo(R()*3|0),treeM(col||ri([0x4a9a3e,0x3f8f3f,0x58a548,0x3a8538])));c.scale.setScalar(s);c.position.set(x,3.5*s,z);c.rotation.y=rr(0,6);c.castShadow=true;sc.add(c);B.push({x1:x-.35*s,x2:x+.35*s,z1:z-.35*s,z2:z+.35*s,h:1.9})}
function bush(x,z,r){const m=new T.Mesh(IG,mat(ri([0x2f7a35,0x3a8a3a,0x28702e])));m.scale.set(r,r*.7,r);m.position.set(x,r*.5,z);m.castShadow=true;sc.add(m);HIDE.push({x,z,r:r*1.1})}
function bench(x,z,rot){const g=new T.Group();g.userData.stat=1;bx(1.8,.12,.5,0x8a5a2a,0,.5,0,g);bx(1.8,.5,.1,0x8a5a2a,0,.85,-.22,g);bx(.12,.5,.4,0x333333,-.8,.25,0,g);bx(.12,.5,.4,0x333333,.8,.25,0,g);g.position.set(x,0,z);g.rotation.y=rot||0;sc.add(g)}
function lampP(x,z,ax,az){const m=new T.Mesh(LPG,mat(0x2a2c30));m.position.set(x,2.5,z);m.castShadow=true;sc.add(m);let hx2=x,hz2=z;
 if(ax!==undefined){const l=Math.hypot(ax,az)||1;hx2=x+ax/l*1.3;hz2=z+az/l*1.3;const a=new T.Mesh(geo(.08,.08,1.4),mat(0x2a2c30));a.position.set((x+hx2)/2,4.95,(z+hz2)/2);a.rotation.y=Math.atan2(ax,az);sc.add(a)}
 bx(.55,.14,.34,0x222428,hx2,4.92,hz2,sc);nb(.42,.04,.24,0xfff1c8,hx2,4.83,hz2);GLOWP.push(hx2,4.75,hz2);const p=new T.Mesh(POOLG,POOLM);p.rotation.x=-PI/2;p.position.set(hx2,.2,hz2);sc.add(p)}
function hedge(x1,x2,z1,z2){bx(x2-x1,1.2,z2-z1,0x2f7a35,(x1+x2)/2,.6,(z1+z2)/2,sc);B.push({x1,x2,z1,z2,h:1.2});const n=Math.max(1,Math.round(Math.max(x2-x1,z2-z1)/6));for(let i=0;i<n;i++)HIDE.push({x:x1+(x2-x1)*(i+.5)/n,z:z1+(z2-z1)*(i+.5)/n,r:1.4})}
function plane(x,z,w,d,c,y,rot){const m=new T.Mesh(new T.PlaneGeometry(w,d),mat(c));m.rotation.x=-PI/2;m.rotation.z=rot||0;m.position.set(x,y,z);m.receiveShadow=true;sc.add(m)}
function mkPark(cx,cz,kind){PARKS.push({cx,cz});const k=cx+','+cz;if(BLK[k])removeBlock(k);const pad=PADS[k];if(pad)pad.material=GRASSM;
 const free=(x,z)=>Math.abs(x-cx)>2.4&&Math.abs(z-cz)>2.4&&Math.hypot(x-cx,z-cz)>6;
 hedge(cx-14,cx-2.2,cz-13.9,cz-13.5);hedge(cx+2.2,cx+14,cz-13.9,cz-13.5);hedge(cx-14,cx-2.2,cz+13.5,cz+13.9);hedge(cx+2.2,cx+14,cz+13.5,cz+13.9);hedge(cx-13.9,cx-13.5,cz-12.5,cz-2.2);hedge(cx-13.9,cx-13.5,cz+2.2,cz+12.5);hedge(cx+13.5,cx+13.9,cz-12.5,cz-2.2);hedge(cx+13.5,cx+13.9,cz+2.2,cz+12.5);
 plane(cx,cz,3.4,27,0xcdbf9a,.12);plane(cx,cz,27,3.4,0xcdbf9a,.12);
 if(kind==0){plane(cx,cz,9,9,0xd8cba6,.16);cy(1.6,.5,0xdddddd,cx,.3,cz,16);cy(1.3,.3,0x2b8fff,cx,.55,cz,16);nb(.4,1.6,.4,0x37e6ff,cx,1.1,cz);
  const pond=new T.Mesh(new T.CircleGeometry(5,32),waterMat(1));pond.rotation.x=-PI/2;pond.position.set(cx+8,.14,cz-8);sc.add(pond);PONDS.push({x:cx+8,z:cz-8,r:5});for(let i=0;i<14;i++){const a=i/14*6.283;bx(.8,.4,.8,0x7a7f88,cx+8+Math.cos(a)*5.2,.2,cz-8+Math.sin(a)*5.2,sc)}
  for(let i=0;i<5;i++){const m=new T.Mesh(new T.CircleGeometry(.5,8),mat(0x3a9a4a));m.rotation.x=-PI/2;m.position.set(cx+8+rr(-3,3),.18,cz-8+rr(-3,3));sc.add(m)}
  for(let i=0;i<6;i++){const a=i/6*6.283;bx(.3,2.6,.3,0xf2f2f2,cx-8+Math.cos(a)*2.2,1.3,cz-8+Math.sin(a)*2.2,sc)}const rf=new T.Mesh(new T.ConeGeometry(3.1,1.6,6),mat(0x8b3a2f));rf.position.set(cx-8,3.4,cz-8);rf.castShadow=true;sc.add(rf);plane(cx-8,cz-8,5,5,0xd8cba6,.16)}
 else if(kind==1){plane(cx-6,cz-6,11,7,0xd0602a,.16);nb(11,.03,.2,0xffffff,cx-6,.19,cz-6);for(const sx of[-1,1]){bx(.15,3,.15,0x555555,cx-6+sx*5.3,1.5,cz-6,sc);bx(.1,1.1,1.6,0xffffff,cx-6+sx*5.2,3,cz-6,sc)}
  for(const sx of[-1,1]){bx(.2,2.8,.2,0x3a5ea8,cx+6+sx*1.6,1.4,cz+6,sc)}bx(3.6,.2,.2,0x3a5ea8,cx+6,2.8,cz+6,sc);for(const sx of[-.8,.8]){bx(.05,2.2,.05,0x888888,cx+6+sx,1.7,cz+6,sc);bx(.5,.1,.3,0xffd23f,cx+6+sx,.6,cz+6,sc)}
  const sl=bx(1,.2,4,0xe8452c,cx+8,1.2,cz+9,sc);sl.rotation.x=.5;bx(1,.15,1,0x8a5a2a,cx+8,2.2,cz+7.4,sc);bx(.2,2.4,.2,0x555555,cx+7.6,1.2,cz+7.4,sc);bx(4,.3,4,0xe3c07a,cx+8,.15,cz-8,sc)}
 else{plane(cx,cz,22,22,0xc7b98a,.09,0);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)if(i||j){bx(2.2,.1,1.2,0x8a5a2a,cx+i*7,.8,cz+j*7,sc);bx(2.2,.5,.1,0x8a5a2a,cx+i*7,.5,cz+j*7+.8,sc);bx(2.2,.5,.1,0x8a5a2a,cx+i*7,.5,cz+j*7-.8,sc)}
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){const x=cx-10.5+i*7,z=cz-10.5+j*7;if(Math.abs(x-cx)>3&&Math.abs(z-cz)>3)tree(x,z,1.1,0x7aa83a)}}
 for(let i=0;i<(kind==2?6:20);i++){let x,z,t=0;do{x=cx+rr(-12,12);z=cz+rr(-12,12);t++}while(t<20&&!free(x,z));tree(x,z,rr(.9,1.5))}
 for(let i=0;i<14;i++){let x,z,t=0;do{x=cx+rr(-12.5,12.5);z=cz+rr(-12.5,12.5);t++}while(t<20&&!free(x,z));bush(x,z,rr(.9,1.6))}
 for(const[x,z,r]of[[3,-2.6,0],[-3,2.6,PI],[2.6,3,PI/2],[-2.6,-3,-PI/2],[0,-9,0],[0,9,PI]])bench(cx+x,cz+z,r);
 for(const[x,z]of[[-12,-12],[12,-12],[-12,12],[12,12]])lampP(cx+x,cz+z);
 for(let i=0;i<18;i++)bx(.25,.35,.25,ri([0xff6aa8,0xffd23f,0xffffff,0xa14bff]),cx+rr(-9,9),.3,cz+rr(-9,9),sc)}
/* --- street life --- */
/* dumpster: the body is one vertex-coloured mesh that joins the static merge; only the hinged lid stays a separate object */
let DUMPG=null;
function mkDump(x,z,alongZ){if(!DUMPG)DUMPG=mergeGeos([[2.4,1.3,1.5,0,.65,0,0x2f6a3a],[2.5,.15,.2,0,1.3,.7,0x1f4a28],[.15,.3,.15,-1.1,.15,.6,0x111111],[.15,.3,.15,1.1,.15,.6,0x111111]].map(p=>({g:colGeo(new T.BoxGeometry(p[0],p[1],p[2]).translate(p[3],p[4],p[5]),p[6])})));
 const body=new T.Mesh(DUMPG,PLAINM);body.position.set(x,0,z);body.rotation.y=alongZ?PI/2:0;body.castShadow=body.receiveShadow=true;sc.add(body);
 const g=new T.Group();g.userData.dyn=1;const lid=new T.Group();lid.position.set(0,1.32,-.75);bx(2.5,.12,1.55,0x24543a,0,.06,.78,lid);g.add(lid);g.position.set(x,0,z);g.rotation.y=alongZ?PI/2:0;sc.add(g);
 const hw=alongZ?.8:1.25,hd=alongZ?1.25:.8;B.push({x1:x-hw,x2:x+hw,z1:z-hd,z2:z+hd,h:1.6});DUMP.push({x,z,g,lid,occ:0,alongZ,open:0})}
function signal(x,z,grp){bx(.18,4.2,.18,0x333333,x,2.1,z,sc);bx(.5,1.2,.5,0x222222,x,4.4,z,sc);const r=new T.Mesh(geo(.3,.3,.1),nmat(0xff2222)),gm=new T.Mesh(geo(.3,.3,.1),nmat(0x22ff44));r.position.set(x,4.75,z+.28);gm.position.set(x,4.1,z+.28);sc.add(r,gm);SIGS.push({r,g:gm,grp,ph:-1})}
function streetLife(){
 for(const a of RD)for(const b of RD){signal(a-7,b-7,0);signal(a+7,b-7,0);signal(a-7,b+7,1);
  for(const[ax,az,rot]of[[a+9,b,0],[a-9,b,0],[a,b+9,PI/2],[a,b-9]]){const m=new T.Mesh(new T.PlaneGeometry(3,11),XWM);m.rotation.x=-PI/2;m.rotation.z=rot||0;m.position.set(ax,.07,az);sc.add(m)}
  const p=new T.Mesh(POOLG,POOLM);p.rotation.x=-PI/2;p.position.set(a+7,.2,b+7);sc.add(p)}
 for(const r of RD)for(const t of[-80,-40,0,40,80]){lampP(r+7,t,-1,0);if(t!=80)lampP(t,r+7,0,-1)}
 /* outside downtown: a lamp every block on alternating sides, zebra crossings at every junction */
 const dt0=(x,z)=>Math.abs(x)<=104&&Math.abs(z)<=104;
 for(const s of ROADS)for(let u=Math.ceil((s.a+20)/40)*40;u<=s.b-14;u+=40){if(s.skip&&u>s.skip[0]-8&&u<s.skip[1]+8)continue;const sd=((u/40)&1)?1:-1,x=s.ax?s.c+sd*7:u,z=s.ax?u:s.c+sd*7;if(dt0(x,z)||(!s.ax&&Math.abs(u-80)<14))continue;s.ax?lampP(x,z,-sd,0):lampP(x,z,0,-sd)}
 for(const v of ROADS)if(v.ax)for(const h of ROADS)if(!h.ax&&v.c>=h.a&&v.c<=h.b&&h.c>=v.a&&h.c<=v.b&&!dt0(v.c,h.c)&&!(h.skip&&v.c>h.skip[0]&&v.c<h.skip[1]))
  for(const[ax,az,rot]of[[v.c+9,h.c,0],[v.c-9,h.c,0],[v.c,h.c+9,PI/2],[v.c,h.c-9,0]]){if((ax-v.c)&&!(ax>=h.a&&ax<=h.b))continue;if((az-h.c)&&!(az>=v.a&&az<=v.b))continue;const m=new T.Mesh(new T.PlaneGeometry(3,11),XWM);m.rotation.x=-PI/2;m.rotation.z=(az-h.c)?PI/2:0;m.position.set(ax,.07,az);sc.add(m)}
 for(const k in PADS){if(!PADS[k].parent)continue;const[cx,cz]=k.split(',').map(Number);if(PARKS.some(p=>p.cx==cx&&p.cz==cz))continue;
  bx(.4,.9,.4,0xd0302a,cx+13.2,.45,cz-13.2,sc);bx(.5,.3,.5,0xd0302a,cx+13.2,.95,cz-13.2,sc);cy(.35,.9,0x3a3a3a,cx-13.2,.45,cz+13.2,8);bench(cx+rr(-8,8),cz+13.4,PI)}
 const ks=Object.keys(BLK);for(const k of ks){const b=BLK[k];mkDump(b.cx+12.6,b.cz+rr(-7,7),1);mkDump(b.cx+rr(-7,7),b.cz-12.6,0)}
 const ccol=[0xd03030,0x2a6fd0,0xe0b020,0x30a060,0xeeeeee,0x333333,0x8a3aa8];let n=0;for(let t=0;t<200&&n<22;t++){const r=ri(RD),al=R()<.5,s=R()<.5?-1:1,u=rr(-105,105);if(Math.abs(u-80)<16||RD.some(q=>Math.abs(u-q)<10))continue;
  const x=al?u:r+s*5.3,z=al?r+s*5.3:u,h=al?(s>0?PI/2:-PI/2):(s>0?0:PI);if(cars.some(c=>Math.hypot(c.x-x,c.z-z)<6))continue;const c=car(ri(ccol));setCar(c,x,z,h);cars.push(c);n++}}
let sigT=0,wtT=0;
function worldU(dt){ferrisU(dt);zoneU(dt);if(WATER){wtT+=dt;WATERM.map.offset.y+=dt*.035;WATERM.map.offset.x=Math.sin(wtT*.3)*.02;for(const b of BOATS)b.g.position.y=b.y0+Math.sin(wtT*1.3+b.ph)*.08}
 const ph=Math.floor(performance.now()/7000)%2;if(sigT!==ph+1){sigT=ph+1;for(const s of SIGS){const on=(s.grp==ph);s.r.material=nmat(on?0x330808:0xff2222);s.g.material=nmat(on?0x22ff44:0x083308)}}
 for(const d of DUMP){const want=d.occ?1.25:0;d.open+=(want-d.open)*Math.min(1,dt*6);d.lid.rotation.x=-d.open}cloudU(dt);$('hid').style.display=P.hide?'block':'none'}
/* --- hide + crouch --- */
const nearDump=()=>DUMP.find(d=>!d.occ&&Math.hypot(d.x-P.x,d.z-P.z)<2.7),inBush=(x,z)=>HIDE.some(h=>(h.x-x)*(h.x-x)+(h.z-z)*(h.z-z)<h.r*h.r);
function enterDump(d){if(P.hide||(P.y||0)>1.2)return;P.hide=d;d.occ=1;P.x=d.x;P.z=d.z;P.g.visible=false;P.crouch=0;let any=0;for(const c of cops)if(!c.dead&&c.see&&dist(c,P)<32){c.knows=d;c.ms='chase';any=1}msg(any?'THEY SAW YOU HIDE...':'HIDING - stay quiet until the heat dies down','#37e6ff');snd(160,.15,'square',.04)}
function exitDump(){const d=P.hide;if(!d)return;P.hide=null;d.occ=0;P.g.visible=true;P.x=d.x+(d.alongZ?2:0);P.z=d.z+(d.alongZ?0:2);push(P,.5);for(const c of cops)if(c.knows===d)c.knows=null}
function los(ax,az,bx_,bz){const dx=bx_-ax,dz=bz-az;for(const b of bNear(Math.min(ax,bx_),Math.min(az,bz),Math.max(ax,bx_),Math.max(az,bz))){if(b.over||b.h<3||b.h<(P.y||0)-.5)continue;let t0=0,t1=1;
  if(Math.abs(dx)<1e-6){if(ax<b.x1||ax>b.x2)continue}else{let a=(b.x1-ax)/dx,c=(b.x2-ax)/dx;if(a>c){const t=a;a=c;c=t}t0=Math.max(t0,a);t1=Math.min(t1,c)}
  if(Math.abs(dz)<1e-6){if(az<b.z1||az>b.z2)continue}else{let a=(b.z1-az)/dz,c=(b.z2-az)/dz;if(a>c){const t=a;a=c;c=t}t0=Math.max(t0,a);t1=Math.min(t1,c)}
  if(t0<=t1&&t0<1&&t1>0)return false}return true}
let unseen=0,evading=0,lastStars=0;
function copsU(dt,stars,live){let seenAny=false,nearest=1e9;const night=Math.max(0,Math.min(1,-cos(tod*2*PI)*2.2+.4))<.4,conc=!!P.hide||(P.crouch&&inBush(P.x,P.z));
 for(const e of cops){if(e.dead){e.dt+=dt;continue}const d=dist(e,P);nearest=Math.min(nearest,d);
  if((e.vt=(e.vt||0)-dt)<=0){e.vt=.25;let see=false,range=(P.car?42:P.crouch?9:34)*(night?.75:1);if((P.y||0)>14)range*=.6;if(conc)range=P.hide?0:3;
   if(!IN&&d<range)see=los(e.x,e.z,P.x,P.z);if(!see&&!conc&&!IN&&((shT>.1&&d<60)||(K.ShiftLeft&&(K.KeyW||K.KeyA||K.KeyS||K.KeyD)&&d<12)))see=true;
   e.see=see;if(see){e.lx=P.x;e.lz=P.z;e.ms='chase'}else if(e.ms=='chase'){e.ms='search';e.srch=16;e.sx=e.lx;e.sz=e.lz}}
  if(e.see)seenAny=true;let tx=P.x,tz=P.z,sp=0;
  if(stars==0&&heat<.3){tx=e.x+(e.x-P.x);tz=e.z+(e.z-P.z);sp=5}
  else if(e.knows&&P.hide===e.knows){tx=e.knows.x;tz=e.knows.z;sp=5}
  else if(e.ms=='chase'&&e.see){sp=4.5+stars*.5;if(d<(arrestable()?1.2:6))sp=0}
  else if(e.ms=='search'){tx=e.sx;tz=e.sz;if(Math.hypot(tx-e.x,tz-e.z)<2.5){if((e.wt=(e.wt||0)-dt)<=0){e.wt=rr(2,4);e.sx=e.lx+rr(-14,14);e.sz=e.lz+rr(-14,14)}sp=1.8}else sp=3.6;if((e.srch-=dt)<=0)e.ms='idle'}
  if(P.hide&&e.ms=='search'){const h=P.hide,dd=Math.hypot(e.x-h.x,e.z-h.z);if(dd<3.4&&((e.knows===h)||((e.chk=(e.chk||0)-dt)<=0&&(e.chk=2)&&R()<.3))){exitDump();P.hp-=18;hit('cop');heat=Math.max(heat,2);msg('FOUND! They pulled you out','#ff4f4f');for(const c of cops)if(!c.dead&&dist(c,P)<30){c.ms='chase';c.lx=P.x;c.lz=P.z}}}
  if(sp>0&&!IN){const w=(e.see||Math.hypot(tx-e.x,tz-e.z)<9)?[tx,tz]:cpath(e,tx,tz,dt),dx=w[0]-e.x,dz=w[1]-e.z,l=Math.hypot(dx,dz)||1;e.x+=dx/l*sp*dt;e.z+=dz/l*sp*dt;e.ph+=dt*sp*1.8;e.h=Math.atan2(dx,dz)}
  push(e,.4);if(e.see)e.h=Math.atan2(P.x-e.x,P.z-e.z);e.g.rotation.y=e.h||0;e.g.position.set(e.x,0,e.z);const s=sp>0?sin(e.ph)*.8:0;e.g.l[0].rotation.x=s;e.g.l[1].rotation.x=-s;e.g.a[1].rotation.x=(e.see&&d<16)?-1.5:0;
  if(live&&e.see&&d<16&&!(arrestable()&&d<10)&&!((P.heli||P.plane)&&P.y>8)&&(e.cd-=dt)<=0){e.cd=rr(.8,1.6);tracer(e.x,e.z,P.x,P.z,0xff5555);snd(220,.1,'square',.03);if(R()<.4){P.hp-=P.car?3:6;shake=.25;hit('cop')}}}
 for(let i=cops.length-1;i>=0;i--){const c=cops[i];if(c.dead&&c.dt>20||stars==0&&heat<.3&&dist(c,P)>45){sc.remove(c.g);cops.splice(i,1)}}
 if(stars>0){if(seenAny)unseen=0;else unseen+=dt}else unseen=0;
 evading=stars>0&&!seenAny&&cops.length>0&&unseen>1.5;if(evading&&!evMsg&&unseen>3){evMsg=1;msg('LOST THE COPS - stay hidden and keep your distance','#37e6ff')}if(seenAny)evMsg=0;
 if(IN&&IN.kind&&IN.kind!='casino'){}else{const rate=unseen>4?(.12+Math.min(unseen,40)*.012)*(P.hide?2:1)*(nearest>55?1.6:1):0;if(rate>0)heat=Math.max(0,heat-rate*dt);else if(stars==0)heat=Math.max(0,heat-dt*.05)}
 if(stars==0&&lastStars>0){msg('WANTED LEVEL CLEARED','#43ff7a');unseen=0;evMsg=0}lastStars=stars}
let evMsg=0;
/* --- graphics pipeline --- */
function gfxFinalize(){if(gfxFinalize.done){skyU();return}gfxFinalize.done=1;curbs();ceilings();if(CFG.map<2&&CFG.mode!=1)addPalms();if(GLOWP.length&&!GLOWS){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(GLOWP,3));GLOWS=new T.Points(g,new T.PointsMaterial({map:glowTex(),size:1.8,transparent:true,depthWrite:false,blending:T.AdditiveBlending,color:0xffe0b0,opacity:0}));GLOWS.frustumCulled=false;sc.add(GLOWS)}srgbMaps();
 mergeStatic();skyU()}
function addPalms(){const pl=(x,z,s)=>{if(bNear(x-1,z-1,x+1,z+1).some(b=>!b.air&&x>b.x1-1&&x<b.x2+1&&z>b.z1-1&&z<b.z2+1))return;const m=new T.Mesh(palmGeo(),PALMM);m.scale.setScalar(s);m.position.set(x,0,z);m.rotation.y=rr(0,6);m.castShadow=true;sc.add(m);B.push({x1:x-.3,x2:x+.3,z1:z-.3,z2:z+.3,h:2})};
 for(let z=-380;z<=COAST-4;z+=11){if(RL.some(r=>Math.abs(z-r)<9))continue;pl(68.2,z+rr(-1,1),rr(.9,1.15));pl(91.6,z+rr(-1,1),rr(.9,1.15))}
 for(let x=132;x<=330;x+=16){pl(x,27.5,rr(.95,1.2));pl(x,-27.5,rr(.95,1.2))}
 for(const[cx,cz]of[[0,0],[40,0],[-40,0]])for(const sx of[-1,1])pl(cx+sx*12.6,cz+12.8,rr(1,1.2))}

/* world matrices are updated once per frame (three.js would redo all ~5000 objects in every render pass);
   the sun's shadow map is drawn once per frame, by the main scene render only (not the reflection or env passes) */
sc.matrixWorldAutoUpdate=false;let LRF=0;
function renderFrame(){const now=performance.now(),fdt=now-LRF;LRF=now;GU.uTime.value=now*.001;rd.info.autoReset=false;rd.info.reset();skyPlace();lightsU();sc.updateMatrixWorld();envUpdate();reflRender();rd.shadowMap.autoUpdate=false;rd.shadowMap.needsUpdate=true;if(comp){gradeU();comp.render()}else rd.render(sc,cam);fpsU(fdt)}
/* --- build everything --- */
function removeBlock(k){const b=BLK[k];if(!b)return;for(const o of b.objs)sc.remove(o);for(const x of b.bs){const i=B.indexOf(x);if(i>=0)B.splice(i,1)}for(const l of b.ls){const i=ladders.indexOf(l);if(i>=0)ladders.splice(i,1)}delete BLK[k]}
function buildWorld(){buildTerrain();buildSky();for(const pk in PADS)PADS[pk].material=PADM;
 for(const z of CC){const k='80,'+z;removeBlock(k);if(PADS[k])sc.remove(PADS[k])}
 buildRiver();mkPark(0,-40,0);mkPark(-80,-40,1);mkPark(40,80,2);buildDistricts();buildPlaces();streetLife();buildCityGrid();buildWorldGrid()}
buildWorld();
