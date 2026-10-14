/* ---- city ---- */
const RD=[-100,-60,-20,20,60,100],CC=[-80,-40,0,40,80],B=[];
const cvs2=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;return t};
const ROADM=[],BLK={},PADS={};
function roadMat0(w,d){const t=cvs2(64,64,(g,W,H)=>{g.fillStyle='#fff';g.fillRect(0,0,W,H);for(let i=0;i<500;i++){g.fillStyle='rgba(0,0,0,'+rr(.03,.12)+')';g.fillRect(rr(0,W),rr(0,H),1+(rr(0,2)|0),1+(rr(0,2)|0))}g.strokeStyle='rgba(0,0,0,.14)';for(let i=0;i<6;i++){g.beginPath();g.moveTo(rr(0,W),rr(0,H));g.lineTo(rr(0,W),rr(0,H));g.stroke()}});t.repeat.set(w/6,d/6);const m=new T.MeshLambertMaterial({color:0x30333a,map:t});ROADM.push(m);return m}
const POOLG=new T.PlaneGeometry(16,16),POOLM=new T.MeshBasicMaterial({map:cvs2(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,230,170,.9)');gr.addColorStop(1,'rgba(255,230,170,0)');g.fillStyle=gr;g.fillRect(0,0,w,h)}),transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false});
const BEAMG=new T.PlaneGeometry(3.6,9),BEAMM=new T.MeshBasicMaterial({map:cvs2(16,64,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(255,245,190,.9)');gr.addColorStop(1,'rgba(255,245,190,0)');g.fillStyle=gr;g.fillRect(0,0,w,h)}),transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});
const ground=new T.Mesh(new T.PlaneGeometry(700,700),mat(0x5b8a4a));ground.rotation.x=-PI/2;ground.receiveShadow=true;sc.add(ground);
for(const r of RD)for(const a of[0,1]){const g=new T.PlaneGeometry(a?12:240,a?240:12),uv=g.attributes.uv;for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);if(a)uv.setXY(i,u,v*10);else uv.setXY(i,v,u*10)}
 const m=new T.Mesh(g,roadMat());m.rotation.x=-PI/2;m.position.set(a?r:0,.02+(a?.004:0),a?0:r);m.receiveShadow=true;sc.add(m)}
const wt=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,64,64);x.fillStyle='#4a5a78';
 for(let i=0;i<2;i++)for(let j=0;j<2;j++)x.fillRect(6+i*32,8+j*32,20,18);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.NearestFilter;return t})();
function sign(txt,col,x,y,z,w){const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');g.fillStyle=col;g.fillRect(0,0,256,64);g.fillStyle='#fff';g.font='bold 44px sans-serif';g.textAlign='center';g.fillText(txt,128,48);
 const m=new T.Mesh(new T.PlaneGeometry(w,w/4),new T.MeshBasicMaterial({map:new T.CanvasTexture(c)}));m.position.set(x,y,z);sc.add(m)}
const MK=[];function marker(x,z,c){const m=new T.Mesh(new T.CylinderGeometry(1.6,1.6,.15,20),new T.MeshBasicMaterial({color:c,transparent:true,opacity:.7}));m.position.set(x,.2,z);sc.add(m);MK.push(m);return{x,z}}
const NEON=[],BM=[],nm={},shops=[],IB=[];let IN=0,apt;
function nmat(c){return nm[c]||(nm[c]=(()=>{const m=new T.MeshBasicMaterial({color:c});NEON.push({m,b:new T.Color(c)});NEONB.set(m,new T.Color(c));return m})())}
function nb(w,h,d,c,x,y,z,p){const m=new T.Mesh(geo(w,h,d),nmat(c));m.position.set(x,y,z);(p||sc).add(m);return m}
function nsign(txt,col,x,y,z,w){const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');g.fillStyle='#08060f';g.fillRect(0,0,256,64);g.strokeStyle=g.fillStyle=col;g.shadowColor=col;g.shadowBlur=14;g.lineWidth=3;g.strokeRect(5,5,246,54);g.font='bold '+(txt.length>8?30:38)+'px sans-serif';g.textAlign='center';g.fillText(txt,128,47);
 const m=new T.MeshBasicMaterial({map:new T.CanvasTexture(c)});NEON.push({m,b:new T.Color(0xffffff)});const q=new T.Mesh(new T.PlaneGeometry(w,w/4),m);q.position.set(x,y,z);sc.add(q);return q}
const wl=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,64,64);x.fillStyle='#ffd27a';for(let i=0;i<2;i++)for(let j=0;j<2;j++)if((i+j)%2||R()<.5)x.fillRect(6+i*32,8+j*32,20,18);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.NearestFilter;return t})();
let WK=0;const WT=[],WL=[];
(function(){const wr=[[[6,8,20,18],[38,8,20,18],[6,40,20,18],[38,40,20,18]],[[0,10,64,14],[0,40,64,14]],[[6,6,52,52]],Array.from({length:16},(_,i)=>[4+(i%4)*15,4+(i/4|0)*15,9,9]),[[6,0,10,64],[27,0,10,64],[48,0,10,64]]];
 wr.forEach((rs,k)=>[0,1].forEach(em=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle=em?'#000':'#fff';x.fillRect(0,0,64,64);for(const r of rs){x.fillStyle=em?(R()<.65?'#ffd27a':'#000'):(k==2?'#5a86a8':'#3b4a63');x.fillRect(...r)}const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.NearestFilter;(em?WL:WT).push(t)}))})();
function wall(w,h,d,col,x,z,y0,cyl){const st=[1,3,0,2,4,5][WK]||0,m=facMat(st,col),y=(y0||0);
 const b=new T.Mesh(facGeo(w,h,d,cyl),cyl?[m,ROOFM,ROOFM]:[m,m,ROOFM,ROOFM,m,m]);b.position.set(x,y+h/2+.06,z);b.castShadow=b.receiveShadow=true;sc.add(b);const cc=st==2?0xcfc6b4:st==5?0x7a8088:0xd6d0c4;
 if(!cyl&&h>4.5){parapet(x,z,w,d,y+h+.06,cc);if(st!=0&&st!=3&&st!=5)for(let yy=9;yy<h-2;yy+=9)bx(w+.24,.22,d+.24,cc,x,y+yy+.06,z,sc)}
 else if(cyl&&h>4.5){const c2=new T.Mesh(new T.CylinderGeometry(w/2+.22,w/2+.22,.55,18,1,true),mat(cc));c2.material.side=T.DoubleSide;c2.position.set(x,y+h+.3,z);sc.add(c2)}}
function parapet(x,z,w,d,y,c){for(const s of[-1,1]){bx(w+.36,.62,.3,c,x,y+.31,z+s*(d/2+.03),sc);bx(.3,.62,d+.36,c,x+s*(w/2+.03),y+.31,z,sc)}}
function shopBase(cx,cz,w,d,y0){const g=facGeo(w+.3,3.4,d+.3,0,8,3.4),b=new T.Mesh(g,[SHOPM,SHOPM,ROOFM,ROOFM,SHOPM,SHOPM]);b.position.set(cx,(y0||0)+1.76,cz);b.castShadow=b.receiveShadow=true;sc.add(b)}
const foot=(cx,cz,w,d,h)=>B.push({x1:cx-w/2,x2:cx+w/2,z1:cz-d/2,z2:cz+d/2,h:h||12});
const WORDS=['HOTEL','BAR','RAMEN','24H','KARAOKE','ARCADE','PIZZA','CLUB','SUSHI','TATTOO','VIDEO','LIQUOR'],NC=['#ff2bd6','#2bf0ff','#ffe62b','#43ff7a','#ff6a2b','#a14bff'];
const PAL2=[0xc9b8a8,0x9aa7b8,0xb98a7a,0x8fa88f,0xd0c4a0,0x7a8ab8,0xa87a9a,0xd98a6a,0x6a9a9a,0xe8e0d0];
const KS=[0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9].sort(()=>R()-.5);
function cy(r,hh,c,x,y,z,seg){const m=new T.Mesh(new T.CylinderGeometry(r,r,hh,seg||10),mat(c));m.position.set(x,y,z);m.castShadow=true;sc.add(m)}
function roof(cx,cz,w,d,y,nc){const r=R()*6|0,y0=y+.06,mn=Math.min(w,d);
 if(r==0){cy(1.4,2.4,0x8a5a3a,cx+w*.2,y0+2.2,cz);for(const a of[-.8,.8])for(const b of[-.8,.8])bx(.2,1,.2,0x444444,cx+w*.2+a,y0+.5,cz+b,sc)}
 else if(r==1){for(let i=0;i<3;i++)bx(2,1,1.4,0xaab0b8,cx-w*.25+i*2.6,y0+.5,cz+d*.2,sc)}
 else if(r==2){cy(mn*.36,.15,0x333340,cx,y0+.08,cz,16);nb(.3,.1,2.8,0xffffff,cx-1,y0+.2,cz);nb(.3,.1,2.8,0xffffff,cx+1,y0+.2,cz);nb(2,.1,.3,0xffffff,cx,y0+.2,cz)}
 else if(r==3){const m=new T.Mesh(new T.SphereGeometry(mn*.3,12,6,0,2*PI,0,PI/2),mat(0xdde0ea));m.position.set(cx,y0,cz);sc.add(m)}
 else if(r==4){const m=new T.Mesh(new T.ConeGeometry(mn*.7,mn*.4,4),mat(0x8b3a2f));m.rotation.y=PI/4;m.position.set(cx,y0+mn*.2,cz);m.castShadow=true;sc.add(m)}
 else{bx(8,3,.3,0x222222,cx,y0+4,cz,sc);bx(.3,3,.3,0x222222,cx-3,y0+1.5,cz,sc);bx(.3,3,.3,0x222222,cx+3,y0+1.5,cz,sc);nsign(ri(WORDS),nc,cx,y0+4,cz+.2,7.5)}}
function tower(cx,cz,k){WK=R()*5|0;const col=ri(PAL2),nc=ri(NC),nh=parseInt(nc.slice(1),16);let w=rr(14,20),d=rr(14,20),h=rr(12,36),cyl=0,top=h;
 const ant=(x,z,y)=>{bx(.3,6,.3,0x444444,x,y+3,z,sc);nb(.6,.6,.6,0xff2222,x,y+6.2,z)};
 if(k==0){wall(w,h,d,col,cx,cz);const h2=rr(6,12);WK=R()*5|0;wall(w*.6,h2,d*.6,ri(PAL2),cx,cz,h);top=h+h2;nb(w*.6+.4,.3,d*.6+.4,nh,cx,h+.16,cz);roof(cx,cz,w*.6,d*.6,top,nc)}
 else if(k==1){w=d=rr(13,18);cyl=1;wall(w,h,w,col,cx,cz,0,1);ant(cx,cz,h)}
 else if(k==2){h=rr(10,14);w=d=20;wall(w,h,d,col,cx,cz);top=h;nb(w,.3,.3,nh,cx,h+.2,cz+d/2);nb(w,.3,.3,nh,cx,h+.2,cz-d/2);mkRoof(cx,cz,w,d,h,nh)}
 else if(k==3){wall(w*.42,h,d,col,cx-w*.28,cz);WK=R()*5|0;wall(w*.42,h*.7,d,ri(PAL2),cx+w*.28,cz);bx(w*.2,2,d*.6,0x556677,cx,h*.6,cz,sc);roof(cx-w*.28,cz,w*.42,d,h,nc)}
 else if(k==4)[1,.75,.5].forEach((q,i)=>wall(w*q,h/3,d*q,col^(i*0x151515),cx,cz,i*h/3));
 else if(k==5){w=d=11;h=rr(30,44);wall(w,h,d,col,cx,cz);top=h;ant(cx+w/2-1,cz+d/2-1,h);mkRoof(cx,cz,w,d,h,nh)}
 else if(k==6){wall(w,h,d*.45,col,cx,cz-d*.27);WK=R()*5|0;wall(w*.45,h*.75,d,ri(PAL2),cx-w*.27,cz);roof(cx,cz-d*.27,w,d*.45,h,nc)}
 else if(k==7){wall(w,h,d,col,cx,cz);const m=new T.Mesh(new T.ConeGeometry(Math.hypot(w,d)*.52,7,4),mat(0x8b3a2f));m.rotation.y=PI/4;m.position.set(cx,h+3.56,cz);m.castShadow=true;sc.add(m);top=h+7}
 else if(k==8)[[-.25,-.25,.4,1],[.25,-.1,.4,.7],[0,.28,.45,.5]].forEach(([a,b,q,f])=>{WK=R()*5|0;wall(w*q,h*f,d*q,ri(PAL2),cx+w*a,cz+d*b)});
 else{w=d=rr(16,20);h=rr(8,14);cyl=1;wall(w,h,w,col,cx,cz,0,1);const m=new T.Mesh(new T.SphereGeometry(w*.48,14,7,0,2*PI,0,PI/2),mat(0xd8d8e8));m.position.set(cx,h+.06,cz);m.castShadow=true;sc.add(m);top=h+w*.48;nb(.8,.8,.8,nh,cx,top+.5,cz)}
 foot(cx,cz,w,d,top);if(!cyl){shopBase(cx,cz,w,d);nb(2.2,1.8,.1,nh,cx,1,cz+d/2+.12);if(R()<.5)bx(w*.5,.25,1.6,nh,cx,3.1,cz+d/2+.8,sc);for(const sx of[-1,1])nb(.3,h*.7,.3,nh,cx+sx*w/2,h*.4+.06,cz+d/2)}
 nsign(ri(WORDS),nc,cx,4.4+rr(0,1.5),cz+d/2+.06,6);if(R()<.7){const q=nsign(ri(WORDS),ri(NC),cx+w/2+.06,5+rr(0,6),cz,5);q.rotation.y=PI/2}}
const ladders=[];
const LT=(()=>{const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');g.fillStyle='#b8c0ca';g.fillRect(2,0,2,16);g.fillRect(12,0,2,16);g.fillRect(3,6,10,2);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.NearestFilter;return t})();
function mkRoof(cx,cz,w,d,h,nh){const ry=h+.06,bw=cx-w/2,t=LT.clone();t.needsUpdate=true;t.repeat.set(1,Math.round(h/1.4));
 const lm=new T.Mesh(new T.PlaneGeometry(1.2,h),new T.MeshBasicMaterial({map:t,transparent:true,alphaTest:.5,side:T.DoubleSide}));lm.rotation.y=PI/2;lm.position.set(bw-.1,h/2+.06,cz);sc.add(lm);
 const mk=marker(bw-1,cz,0xffffff);
 for(let i=0;i<3;i++)bx(1.4,.5,.5,0x8a7a5a,cx+w/2-2,ry+.25,cz-d/2+2+i*1.6,sc);
 const em=new T.Mesh(new T.CylinderGeometry(1.2,1.2,.12,16),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.6}));em.position.set(bw+1.6,ry+.1,cz);sc.add(em);
 ladders.push({x:mk.x,z:mk.z,roofY:ry,b:{x1:bw+.6,x2:cx+w/2-.6,z1:cz-d/2+.6,z2:cz+d/2-.6},ex:{x:bw+1.6,z:cz}})}
let MAH=null;
/* the Delacroix family house (west side): two storeys, porch, picket fence, garden */
function delacroixHouse(cx,cz){const hz=cz-3;bx(26,.05,26,0x5b9a4a,cx,.085,cz,sc);
 const fn=(x1,x2,z1,z2)=>{for(let x=x1;x<=x2+.01;x+=.5)if(z2-z1<.5)bx(.12,.9,.08,0xf4f1ea,x,.45,(z1+z2)/2,sc);for(let z=z1;z<=z2+.01&&x2-x1<.5;z+=.5)bx(.08,.9,.12,0xf4f1ea,(x1+x2)/2,.45,z,sc);
  bx(x2-x1+.1,.1,z2-z1+.1,0xf4f1ea,(x1+x2)/2,.72,(z1+z2)/2,sc);B.push({x1,x2,z1,z2,h:1})};
 fn(cx-12,cx-2,cz+11.9,cz+12.1);fn(cx+2,cx+12,cz+11.9,cz+12.1);fn(cx-12,cx+12,cz-12.1,cz-11.9);fn(cx-12.1,cx-11.9,cz-12,cz+12);fn(cx+11.9,cx+12.1,cz-12,cz+12);
 WK=3;wall(16,4,10,0xd9cbb4,cx,hz);WK=3;wall(16,3.6,10,0xd9cbb4,cx,hz,4);foot(cx,hz,16,10,7.6);
 const rf=new T.Mesh(new T.ConeGeometry(12.2,4.2,4,1),mat(0x5a2e26));rf.rotation.y=PI/4;rf.scale.set(1,1,.66);rf.position.set(cx,7.7+2.1,hz);rf.castShadow=true;sc.add(rf);
 bx(17,.35,4,0x8a6a4a,cx,.18,hz+7,sc);bx(17.2,.25,4.2,0x6a3a2a,cx,3.7,hz+7,sc);for(const x of[-8,-4,4,8])bx(.3,3.5,.3,0xf4f1ea,cx+x,1.9,hz+8.8,sc);
 for(let i=0;i<8;i++)bx(16.6,.06,.08,0xf4f1ea,cx,.65+i*.06,hz+8.9,sc);bx(2.2,.3,1.4,0x8a6a4a,cx,.15,hz+9.6,sc);
 bx(1.4,2.5,.12,0x5a2a1a,cx,1.6,hz+5.06,sc);nb(.25,.25,.05,0xffd27a,cx+1.1,2.2,hz+5.12);for(const x of[-5,5]){bx(2,1.5,.1,0x2a3a48,cx+x,2.1,hz+5.08,sc);nb(1.8,1.3,.05,0xffd27a,cx+x,2.1,hz+5.1)}
 for(const x of[-5,0,5]){bx(2,1.5,.1,0x2a3a48,cx+x,5.9,hz+5.08,sc)}
 for(let i=0;i<22;i++)bx(.25,.35,.25,ri([0xff6aa8,0xffd23f,0xffffff,0xa14bff,0xff8a2b]),cx+rr(-10.5,10.5),.26,cz+rr(7.5,11),sc);
 for(const[x,z]of[[-10.4,10],[10.4,10],[-10.6,-10.6],[10.6,-10.6]]){const sc_=rr(1,1.3);cy(.3*sc_,2.6*sc_,0x5e4128,cx+x,1.3*sc_,cz+z,8);const m=new T.Mesh(canopyGeo(1),treeM(0x4a9a3e));m.scale.setScalar(sc_);m.position.set(cx+x,3.5*sc_,cz+z);m.castShadow=true;sc.add(m);B.push({x1:cx+x-.4,x2:cx+x+.4,z1:cz+z-.4,z2:cz+z+.4,h:1.9})}
 bx(.1,1.1,.1,0x555555,cx+3,.6,cz+13.2,sc);bx(.5,.4,.3,0x2b8fff,cx+3,1.3,cz+13.2,sc);bx(1.6,.5,.6,0x6a4a2a,cx-6,.45,hz+8.2,sc);
 return{cx,cz,hz,mk:{x:-9999,z:-9999},door:{x:cx,z:hz+6.6}}}
let bank,casino;
function marker2(x,z,c){return marker(x,z,c)}
function shop(cx,cz,name,kind,col,nc){const nh=parseInt(nc.slice(1),16);WK=1;wall(16,5,10,col,cx,cz-6);shopBase(cx,cz-6,16,10);bx(16.6,.3,3.5,nh,cx,3.6,cz-.4,sc);nsign(name,nc,cx,4.5,cz-.94,7);
 for(const x of[-5,0,5]){const tx=cx+x;bx(1.4,.12,1.4,0xf2f2f2,tx,.95,cz+3,sc);bx(.2,.9,.2,0x444444,tx,.45,cz+3,sc);bx(.5,.5,.5,nh,tx-1.1,.3,cz+3,sc);bx(.5,.5,.5,nh,tx+1.1,.3,cz+3,sc)}
 for(const x of[-12,12]){bx(.4,2,.4,0x6b4a2b,cx+x,1,cz+8,sc);bx(2.2,2.2,2.2,0x3f8f3f,cx+x,3,cz+8,sc)}
 B.push({x1:cx-8,x2:cx+8,z1:cz-11,z2:cz-1,h:5});const m=marker(cx,cz+5.5,nh);shops.push({x:m.x,z:m.z,name,kind,nh,nc,col})}
let ti=0;
for(const cx of CC)for(const cz of CC){const pad=bx(28,.06,28,0xb9b4aa,cx,.03,cz,sc);pad.castShadow=false;pad.receiveShadow=true;PADS[cx+','+cz]=pad;const k=cx+','+cz;
 if(k=='0,0'){WK=4;wall(20,16,20,0xd9c27a,cx,cz);foot(cx,cz,20,20,16);mkRoof(cx,cz,20,20,16,0x43ff7a);nsign('BANK','#43ff7a',cx,13,cz+10.06,14);nb(20.4,.4,.4,0x43ff7a,cx,16.2,cz+10);bank={...marker(cx,cz+12.5,0xffd23f),cd:0}}
 else if(k=='40,0'){WK=2;wall(20,14,20,0x8a4bd0,cx,cz);foot(cx,cz,20,20,14);mkRoof(cx,cz,20,20,14,0xff2bd6);nsign('CASINO','#ff2bd6',cx,11,cz+10.06,16);nb(20.4,.4,.4,0xff2bd6,cx,14.2,cz+10);nb(.4,14,.4,0xffe62b,cx-10,7,cz+10);nb(.4,14,.4,0xffe62b,cx+10,7,cz+10);casino=marker(cx,cz+12.5,0xc050ff)}
 else if(k=='-40,0'){WK=3;wall(18,28,18,0xb8a090,cx,cz);foot(cx,cz,18,18,28);mkRoof(cx,cz,18,18,28,0x2bf0ff);for(let y=5;y<27;y+=5)for(const x of[-4.5,4.5])bx(5,.3,1.4,0x444444,cx+x,y,cz+9.6,sc);nsign('APARTMENTS','#2bf0ff',cx,3.6,cz+9.06,11);apt=marker(cx,cz+12.5,0x2bf0ff)}
 else if(k=='0,40')shop(cx,cz,'CAFE','cafe',0x7a5230,'#ffb02b');
 else if(k=='-40,40')shop(cx,cz,'BURGER','burger',0xb03030,'#ff2b2b');
 else if(k=='40,40')shop(cx,cz,'NOODLES','noodle',0x2f6f6f,'#2bf0ff');else if(k=='-40,-40')shop(cx,cz,'GUNS','guns',0x3a3a44,'#ff3b3b');else if(k=='40,-40')shop(cx,cz,'MART','mart',0x2f7f4f,'#43ff7a');
 else if(k=='-80,0')MAH=delacroixHouse(cx,cz);
 else{const n0=sc.children.length,b0=B.length,l0=ladders.length;tower(cx,cz,KS[ti++]);BLK[k]={objs:sc.children.slice(n0),bs:B.slice(b0),ls:ladders.slice(l0),cx,cz}}}
for(const a of RD)for(const b of RD)lampP(a+7,b+7,-.7,-.7)
function push(o,r){let hit=0;for(const b of IN?IB:B)if(!b.air&&!(o.y>b.h)&&o.x>b.x1-r&&o.x<b.x2+r&&o.z>b.z1-r&&o.z<b.z2+r){const d=[o.x-(b.x1-r),b.x2+r-o.x,o.z-(b.z1-r),b.z2+r-o.z],m=Math.min(...d);
 if(m==d[0])o.x=b.x1-r;else if(m==d[1])o.x=b.x2+r;else if(m==d[2])o.z=b.z1-r;else o.z=b.z2+r;hit=1}
 if(!IN){o.x=Math.max(-112,Math.min(345,o.x));o.z=Math.max(-112,Math.min(112,o.z))}return hit}
/* ---- apartment interior ---- */
const OX=300,OZ=300;let aexit,bed;
function iw(x,z,w,d){bx(w,3.5,d,0xe8e0d4,OX+x,1.75,OZ+z,sc);IB.push({x1:OX+x-w/2,x2:OX+x+w/2,z1:OZ+z-d/2,z2:OZ+z+d/2})}
function fu(x,z,w,h,d,c,ns){bx(w,h,d,c,OX+x,h/2,OZ+z,sc);if(!ns)IB.push({x1:OX+x-w/2,x2:OX+x+w/2,z1:OZ+z-d/2,z2:OZ+z+d/2})}
function fl(x,z,w,d,c,y){const f=new T.Mesh(new T.PlaneGeometry(w,d),mat(c));f.rotation.x=-PI/2;f.position.set(OX+x,y,OZ+z);f.receiveShadow=true;sc.add(f)}
(function(){fl(0,0,24,18,0x9a7650,.02);fl(-8,5,8,8,0xcfe3ea,.03);fl(8,-6,8,6,0xd8d8d0,.03);fl(2,4.5,5,3.5,0x2b3a6a,.03);
 iw(0,-9,24,.4);iw(-7.25,9,9.5,.4);iw(7.25,9,9.5,.4);iw(-12,0,.4,18);iw(12,0,.4,18);iw(-4,-6,.4,6);iw(-4,1,.4,4);iw(-4,7,.4,4);iw(-8,1,8,.4);IB.push({x1:OX-12,x2:OX+12,z1:OZ+9.6,z2:OZ+10});
 fu(-9,-5.5,3.4,.7,4.4,0x6a5acd);fu(-9,-7.4,2.4,.9,.8,0xffffff,1);fu(-5,-8.3,2.4,2.4,1.2,0x5a4030);fu(-10.8,5,2,.6,4,0xffffff);fu(-5.5,8.2,.8,.8,1,0xffffff);fu(-8,8.3,1.4,1,.8,0xdddddd);
 fu(2,6.5,4.5,.9,1.6,0xc04060);fu(2,7.3,4.5,1.6,.4,0xa03050,1);fu(2,2.2,3.4,.5,.6,0x333333);bx(3,1.4,.15,0x0a0a14,OX+2,1.2,OZ+2.2,sc);nb(2.8,1.2,.05,0x2bf0ff,OX+2,1.2,OZ+2.3);fu(2,4.4,2,.45,1,0x4a3a2a);
 fu(6.5,-8.2,7,1,1.2,0x3a3a44);fu(11,-8.2,1.2,2.2,1.2,0xdddddd);fu(7.5,-5,3.5,1,1.2,0x2a2a33);fu(9,2,2.6,.8,1.6,0x7a5a3a);fu(7,2,.7,.5,.7,0x333333,1);fu(11,2,.7,.5,.7,0x333333,1);
 nb(10,.15,.1,0xff2bd6,OX+7,3,OZ-8.7);nb(.1,.15,6,0x2bf0ff,OX+11.7,3,OZ-3);nb(.1,.15,6,0xff2bd6,OX-11.7,3,OZ-3);
 for(const[x,z]of[[-8,-4],[-8,6],[3,3],[8,-5]]){const l=new T.PointLight(0xffe2b0,.7,16);l.position.set(OX+x,2.8,OZ+z);sc.add(l)}
 aexit=marker(OX,OZ+7,0x2bf0ff);bed=marker(OX-6,OZ-5.5,0xffffff)})();
function leaveApt(){IN=0;P.x=apt.x;P.z=apt.z+1.5;P.h=0;camYaw=0;cam.position.set(P.x,5,P.z-8)}
function sleep(){tod=.27;P.hp=100;heat=0;msg('Slept until morning. Fully healed.');snd(400,.4,'sine')}
