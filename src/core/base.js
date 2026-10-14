const $C={},$=i=>{let e=$C[i];if(!e||!e.isConnected)e=$C[i]=document.getElementById(i);return e},txt=(i,v)=>{const e=$(i);v=String(v);if(e&&e._t!==v){e._t=v;e.textContent=v}},R=Math.random,T=THREE,PI=Math.PI,rr=(a,b)=>a+R()*(b-a),ri=a=>a[R()*a.length|0],sin=Math.sin,cos=Math.cos;
const PAL={r:'#e8222c',g:'#3ec24a',y:'#ffd23f',o:'#ff8a2b',k:'#1a1020',w:'#fff',b:'#2b8fff',c:'#2bf0ff',n:'#8a5a2b',d:'#555'};
const SD={cherry:["....ggg.","...g..g.","..g...g.",".rrr.rrr","rwrrrwrr","rrrrrrrr",".rrr.rrr","..r...r."],
lemon:["..yyyy..",".yyyyyy.","yywyyyyy","yyyyyyyy","yyyyyyyy",".yyyyyy.","..yyyy..","...gg..."],
bell:["...yy...","..yyyy..",".yywyyy.",".yyyyyy.","yyyyyyyy","yyyyyyyy","oooooooo","...oo..."],
diamond:["..cccc..",".cwcccb.","cccccccb",".cccccb.","..ccbb..","...cb...","....b...","........"],
seven:["rrrrrrr.","rwwwwrr.","....rr..","...rr...","..rr....","..rr....","..rr....","..rr...."],
star:["...yy...","...yy...","yyyyyyyy",".yyyyyy.","..yyyy..",".yyyyyy.",".yy..yy.","yy....yy"],
star0:["...dd...","...dd...","dddddddd",".dddddd.","..dddd..",".dddddd.",".dd..dd.","dd....dd"],
sun:["o..oo..o",".o.yy.o.","..yyyy..","oyyyyyyo","oyyyyyyo","..yyyy..",".o.yy.o.","o..oo..o"],
moon:["..wwww..",".www....","wwww....","wwww....","wwww....","wwww....",".www..w.","..wwww.."],
heart:[".rr..rr.","rrrrrrrr","rwrrrrrr","rrrrrrrr",".rrrrrr.","..rrrr..","...rr...","........"],
skull:[".wwwwww.","wwwwwwww","wkkwwkkw","wkkwwkkw","wwwkkwww",".wwwwww.",".wkwkwk.","........"],
coin:["..yyyy..",".yyyyyy.","yyyooyyy","yyoyyyyy","yyyooyyy","yyyyyoyy",".yyooyy.","..yyyy.."],
house:["...rr...","..rrrr..",".rrrrrr.","rrrrrrrr",".wwwwww.",".wwkkww.",".wwkkww.",".wwkkww."],
cup:["..w.w...","...w.w..","........","wwwwwww.","wnnnnnww","wnnnnn.w",".wnnnww.","..www..."],
burger:["..oooo..",".oooooo.","gggggggg","nnnnnnnn","gggggggg","oooooooo",".oooooo.","........"],
ramen:["...w.w..","..w.w...","yyyyyyyy","yoyoyoyy","wwwwwwww",".wwwwww.","..wwww..","........"],
medkit:["wwwwwwww","wwwrrwww","wwwrrwww","wrrrrrrw","wrrrrrrw","wwwrrwww","wwwrrwww","wwwwwwww"],
watch:["..kkkk..",".kyyyyk.","kywwwwyk","kywkwwyk","kywwwwyk",".kyyyyk.","..kkkk..","........"],
console:["........","kkkkkkkk","kddddddk","kbkddrdk","kkkkkkkk",".kddddk.","........","........"],
perfume:["...yy...","...dd...","..bbbb..",".bwbbbb.",".bwbbbb.",".bbbbbb.",".bbbbbb.","..bbbb.."],
bag:["..nnnn..","...nn...",".gggggg.","gggyyggg","ggyggggg","gggyyggg","ggggyggg",".gggggg."],
ammo:["........","oooooooo","oyyoyyyo","oyyoyyyo","oooooooo","gggggggg","gggggggg","........"],
pistol:["........","........","dddddd..","ddddddd.","dkkdd...","..dd....","..dd....","........"],
shotgun:["........","........","........","nnddddd.","nnnddddd","........","........","........"],
smg:["........","dddddddd","dddddddd",".dd.dd..",".dd.dd..","..dd....","........","........"],
sniper:["........","....bb..","dddddddd","nnddddd.","nn..d...","........","........","........"],
badge:["..bbbb..",".bbyybb.","bbyyyybb","bbyyyybb","bbbyybbb",".bbbbbb.","..bbbb..","...bb..."],
heli:["dddddddd","...d....","..rrrr..",".rrrrrr.","rrbbrrr.","rrrrrrrd","..d..d..","dddddddd"],
spade:["...kk...","..kkkk..",".kkkkkk.","kkkkkkkk","kkkkkkkk",".kk..kk.","...kk...","..kkkk.."],
hrt:[".rr..rr.","rrrrrrrr","rrrrrrrr","rrrrrrrr",".rrrrrr.","..rrrr..","...rr...","........"],
dmd:["...rr...","..rrrr..",".rrrrrr.","rrrrrrrr",".rrrrrr.","..rrrr..","...rr...","........"],
car:["........","..bbbb..",".bccccb.","bbbbbbbb","bbbbbbbb","bkbbbbkb",".k....k.","........"],
wrench:["......dd",".....d.d","....dddd","...ddd..","..ddd...",".ddd....","ddd.....","dd......"],
anchor:["...ww...","..w..w..","...ww...","wwwwwwww","...ww...","w..ww..w",".w.ww.w.","..wwww.."],
tower:["...rr...","...cc...","..cccc..","..cccc..",".cccccc.",".cccccc.","cccccccc","cccccccc"],
wheel:["..rrrr..",".r.rr.r.","r..rr..r","rrrrrrrr","r..rr..r",".r.rr.r.","..rrrr..","..w..w.."],
fuel:[".ggggg..",".gwwwg.g",".gwwwg.g",".ggggg.g",".ggggg.g",".ggggg.g",".ggggg..","ggggggg."],
paw:["..y..y..",".yy..yy.","........","y..yy..y","..yyyy..",".yyyyyy.",".yyyyyy.","..yyyy.."],
flag:["wkwkwk..","kwkwkw..","wkwkwk..","kwkwkw..","d.......","d.......","d.......","d......."],
crown:["........","y..y..y.","yy.y.yy.","yyyyyyy.","yryyyry.","yyyyyyy.","........","........"],
club:["...kk...","..kkkk..","...kk...",".kkkkkk.","kkkkkkkk","kk.kk.kk","...kk...","..kkkk.."]};
const SPR={},SU={};for(const k in SD){const c=document.createElement('canvas');c.width=c.height=8;const g=c.getContext('2d');SD[k].forEach((r,y)=>[...r].forEach((ch,x)=>{if(PAL[ch]){g.fillStyle=PAL[ch];g.fillRect(x,y,1,1)}}));SPR[k]=c;SU[k]=c.toDataURL()}
const si=(n,p)=>'<img class="px" width="'+p+'" height="'+p+'" src="'+(SU[n]||(typeof ICOU!=='undefined'&&ICOU[n]))+'">';
document.querySelectorAll('i[data-s]').forEach(e=>e.innerHTML=si(e.dataset.s,22));
/* starting graphics quality: the saved choice, else a guess from the device (phones LOW, 4-core/4GB machines MEDIUM, else HIGH) */
const QDEF=(()=>{let q;try{q=JSON.parse(localStorage.getItem('embercity_cfg')||'{}').gfx}catch(e){}if(q!==undefined&&q!==null)return +q;
 const mob=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)||(window.matchMedia&&matchMedia('(pointer:coarse)').matches);return mob?0:(navigator.hardwareConcurrency||4)<=4||(navigator.deviceMemory||8)<=4?1:2})();
/* MEDIUM+ anti-alias inside the post chain (SMAA / MSAA), so the default framebuffer only needs it on LOW */
let comp=null,gradeP=null,bloomP=null;const rd=new T.WebGLRenderer({canvas:$('c'),antialias:QDEF===0,powerPreference:'high-performance',stencil:false});rd.setPixelRatio(Math.min(devicePixelRatio,2));rd.shadowMap.enabled=true;
const sc=new T.Scene(),SKY=0xf7b27b;sc.background=new T.Color(SKY);sc.fog=new T.Fog(SKY,60,200);
const cam=new T.PerspectiveCamera(60,1,.25,400);
function rs(){rd.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();if(comp){comp.setSize(innerWidth,innerHeight);if(comp.onResize)comp.onResize()}}addEventListener('resize',rs);rs();
const hemi=new T.HemisphereLight(0xffe2c4,0x4a5a6a,.9);sc.add(hemi);
const sun=new T.DirectionalLight(0xfff0d0,.9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
{const s=sun.shadow.camera;s.left=s.bottom=-45;s.right=s.top=45;s.far=200}sc.add(sun,sun.target);
const MT={},GE={};
const mat=c=>MT[c]||(MT[c]=plainMat(c)),geo=(w,h,d)=>GE[w+','+h+','+d]||(GE[w+','+h+','+d]=new T.BoxGeometry(w,h,d));
function bx(w,h,d,c,x,y,z,p){const m=new T.Mesh(geo(w,h,d),mat(c));m.position.set(x,y,z);m.castShadow=true;p&&p.add(m);return m}
function person(skin,shirt,pants,hair,gun,hs){return person2(skin,shirt,pants,hair,gun,hs)}
function car(col,type){return mkCar(col,type)}
