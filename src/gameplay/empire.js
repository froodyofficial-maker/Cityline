/* ==================== your empire: properties and gang turf (P) ====================
   PROPERTIES  seven businesses around the city with FOR SALE signs. Each one earns money every in-game day into its
               till (up to three days' worth); walk up to it to collect. Some come with perks. A business inside gang
               turf pays that gang 40% protection money until you take the turf.
   TURF        the city is split into 18 turfs. Downtown is yours; the rest belong to four gangs who hang out on
               their corners. Kill three of a gang's members on their turf to start a GANG WAR: survive three waves
               and the turf is yours. Your crew then holds the corner, every turf you own pays street tax at midnight,
               and now and then a rival gang tries to take one back while you are there.
   Saved per mode (story / open world). Paused during story missions; off in war mode. */
const GANGS={vip:{n:'LOS VIPERS',c:'#3ec24a',sh:'#2f8f3a'},kng:{n:'HARBOR KINGS',c:'#2b8fff',sh:'#1f5fbf'},fnd:{n:'FOUNDRY BOYS',c:'#ff8a2b',sh:'#c8641a'},syn:{n:'HEIGHTS SYNDICATE',c:'#d8dce4',sh:'#e8e8f0'},you:{n:'EMBER CREW',c:'#ff4fa3',sh:'#a14bff'}};
const TURFX=[-380,-220,-60,100,260,420],TURFZ=[-380,-220,-60,100,306],
 TURFN=[['NORTH GROVE','HIGHLINE','TOWER HILL','GLASS ROW','EAST POINT'],['PALM GROVE','WESTGATE','THE SPIRES','NOVA PLAZA','EASTSIDE'],['SUNSET STRIP','MAPLE CORNER','DOWNTOWN',null,null],['SMELTER YARDS','RUST BELT','FOUNDRY SQUARE','DOCKLANDS','PIER NINE']];
const TURFS=[];for(let j=0;j<4;j++)for(let i=0;i<5;i++){const n=TURFN[j][i];if(!n)continue;const x0=TURFX[i],x1=TURFX[i+1],z0=TURFZ[j],z1=TURFZ[j+1],cx=(x0+x1)/2,cz=(z0+z1)/2,zn=zoneOf(cx,cz);
 const g=n=='DOWNTOWN'?'you':cz>140&&cx<100?'fnd':zn=='EMBER HEIGHTS'?'syn':zn=='PALM GROVE'?'vip':'kng';TURFS.push({n,x0,x1,z0:j==0?-420:z0,z1:j==3?460:z1,cx,cz,own:g,home:n=='DOWNTOWN',kills:0,kt:0})}
const turfAt=(x,z)=>TURFS.find(t=>x>=t.x0&&x<t.x1&&z>=t.z0&&z<t.z1)||null;
const PROPS=[{id:'surf',n:'SURF SHACK',p:8000,inc:600,perk:''},{id:'pets',n:'PAWS & CLAWS',p:12000,inc:800,perk:'Rosy gear half price'},{id:'gas',n:'GAS & GO',p:15000,inc:1000,perk:''},
 {id:'chop',n:'CHOP SHOP',p:30000,inc:2000,perk:'+25% for chopped cars'},{id:'club',n:'THE FURNACE',p:45000,inc:3000,perk:''},{id:'pier',n:'PIER 9 SHIPPING',p:60000,inc:4000,perk:'dock security looks the other way'},{id:'motors',n:'EMBER MOTORS',p:90000,inc:6000,perk:'cars 30% off'}];
const owns=id=>{const p=PROPS.find(q=>q.id==id);return!!(p&&p.own)};
let EMPK='',EMPT=0,DAYP=0;const GW={on:0},DEF={t:rr(300,480)};
/* ---------- save / load ---------- */
function empKey(){return'embercity_empire_'+(ST.on?'story':'open')}
function empLoad(){EMPK=empKey();let s={};try{s=JSON.parse(localStorage.getItem(EMPK)||'{}')}catch(e){}
 for(const p of PROPS){const v=s.props&&s.props[p.id];p.own=v!==undefined;p.till=v||0}for(const t of TURFS)if(s.turf&&s.turf[t.n])t.own=s.turf[t.n];Object.assign(SJS,s.sj||{})}
function empSave(){if(!EMPK)return;const props={},turf={};for(const p of PROPS)if(p.own)props[p.id]=Math.round(p.till);for(const t of TURFS)turf[t.n]=t.own;try{localStorage.setItem(EMPK,JSON.stringify({props,turf,sj:SJS}))}catch(e){}}
function empSaveCash(){empSave();if(ST.on&&!ST.act)stSave()}
/* ---------- property signs and buildings ---------- */
const SALET=cvsT(128,64,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);g.fillStyle='#d0202a';g.fillRect(4,4,w-8,h-8);g.fillStyle='#fff';g.font='bold 26px Arial';g.textAlign='center';g.fillText('FOR',w/2,29);g.fillText('SALE',w/2,56)}),
 OWNT=cvsT(128,64,(g,w,h)=>{g.fillStyle='#111';g.fillRect(0,0,w,h);g.fillStyle='#ff4fa3';g.fillRect(4,4,w-8,h-8);g.fillStyle='#fff';g.font='bold 22px Arial';g.textAlign='center';g.fillText('EMBER',w/2,28);g.fillText('CREW',w/2,54)});
function propSign(p,x,z,ry){p.x=x;p.z=z;const g=new T.Group();g.position.set(x,0,z);g.rotation.y=ry||0;for(const s of[-1,1])bx(.1,1.6,.1,0x5a3a22,s*.6,.8,0,g);
 p.sale=new T.Mesh(new T.PlaneGeometry(1.5,.75),new T.MeshBasicMaterial({map:SALET,side:T.DoubleSide}));p.sale.position.y=1.6;p.own_=new T.Mesh(p.sale.geometry,new T.MeshBasicMaterial({map:OWNT,side:T.DoubleSide}));p.own_.position.y=1.6;p.own_.visible=false;g.add(p.sale,p.own_);sc.add(g);
 poi({x,z,r:2.4,txt:()=>p.own?'E - Collect $'+Math.floor(p.till).toLocaleString()+' from '+p.n+(protCut(p)?' (gang takes 40%)':''):'E - BUY '+p.n+'  $'+p.p.toLocaleString()+' (earns $'+p.inc.toLocaleString()+'/day)',e:()=>propUse(p)})}
function nightclub(cx,cz){dPad(cx,cz);bx(18,7,12,0x241a2e,cx,3.5,cz-6,sc);solid(cx,cz-6,18,12,7);nRing(18.3,12.3,0xff4fa3,cx,6.9,cz-6);nsign('THE FURNACE','#ff6a2b',cx,5.3,cz+.06,8);
 bx(2.4,3,.12,0x0a0a0a,cx,1.5,cz+.05,sc);for(const x of[-3.2,-1.8,1.8,3.2])cy(.06,1,0xffc94a,cx+x,.5,cz+1.4,8);bx(1.4,.06,.06,0xc0392b,cx-2.5,.9,cz+1.4,sc);bx(1.4,.06,.06,0xc0392b,cx+2.5,.9,cz+1.4,sc);
 const bo=person('#8d5524','#111111','#111','#111',0);bo.position.set(cx+1.6,0,cz+.9);bo.scale.setScalar(1.12);for(let i=0;i<3;i++){const q=person(ri(skins),ri(shirts),'#2b2f3a','#222',0);q.position.set(cx-5-i*1.3,0,cz+2);q.rotation.y=PI/2}
 PLACES.push({x:cx,z:cz,icon:'crown'});CLUBXZ=[cx,cz]}
let CLUBXZ=[40,120];
function buildEmpire(){const P_=id=>PROPS.find(p=>p.id==id),g=GASST[0];
 propSign(P_('surf'),-254,COAST+9);if(DPARK)propSign(P_('pets'),DPARK.kiosk.x-4.4,DPARK.kiosk.z+.6);if(g)propSign(P_('gas'),g.x+6,g.z+.4);
 propSign(P_('chop'),-48,206);propSign(P_('club'),CLUBXZ[0]+4,CLUBXZ[1]+2.2);propSign(P_('pier'),249,211.4);propSign(P_('motors'),247,119)}
const protCut=p=>{const t=turfAt(p.x,p.z);return t&&t.own!='you'};
function propUse(p){if(!p.own){if(!pay(p.p))return;p.own=1;p.till=0;empSaveCash();snd(700,.2);setTimeout(()=>snd(1050,.25),150);msg('YOU NOW OWN '+p.n+'! It earns $'+p.inc.toLocaleString()+' a day'+(p.perk?' - perk: '+p.perk:''),'#43ff7a');if(protCut(p))msg(GANGS[turfAt(p.x,p.z).own].n+' run this turf - they will take a 40% cut','#ffb02b');return}
 const m=Math.floor(p.till);if(m<1)return msg(p.n+': nothing in the till yet','#ffb02b');p.till-=m;cash+=m;snd(900,.1);msg(p.n+': collected $'+m.toLocaleString(),'#ffd23f');empSaveCash()}
/* ---------- gang members and your crew ---------- */
const GANGP=[];/* every gang member / crew member alive in the world (they also live in peds[]) */
function gangPed(g,x,z,o){const G=GANGS[g],e={g:person(ri(skins),G.sh,'#1a1a1e',ri(['#111','#2a1a10']),1),hp:g=='you'?5:3,arm:g=='you'?0:1,cd:rr(.5,1.2),dead:0,dt:0,fl:0,ph:R()*6,sp:4,x,z,h:R()*6,tx:x,tz:z,idle:1,gang:g=='you'?null:g,crew:g=='you'?1:0,gk:g};
 Object.assign(e,o||{});{const b=bx(.5,.12,.5,parseInt(G.c.slice(1),16),0,1.52,0,e.g);b.castShadow=false}e.g.position.set(x,0,z);e.g.rotation.y=e.h;peds.push(e);GANGP.push(e);return e}
function gangRemove(e){const i=peds.indexOf(e);if(i>=0)peds.splice(i,1);const k=GANGP.indexOf(e);if(k>=0)GANGP.splice(k,1);sc.remove(e.g)}
function gangClear(){for(const e of GANGP.slice())gangRemove(e)}
/* a corner inside the turf, 30-80 m from you, out of sight if possible */
function cornerIn(t,mn,mx){for(let k=0;k<12;k++){const s=curb(P.x,P.z,mn,mx);if(s.x>t.x0+4&&s.x<t.x1-4&&s.z>t.z0+4&&s.z<t.z1-4)return s}return null}
function hangoutU(t,dt){if((t.hcd=(t.hcd||0)-dt)>0||GANGP.some(e=>!e.dead&&e.hang===t))return;t.hcd=3;const s=cornerIn(t,35,80);if(!s)return;const n=t.own=='you'?3:3+(R()*3|0);
 for(let i=0;i<n;i++){const a=i/n*PI*2,e=gangPed(t.own,s.x+Math.cos(a)*1.4,s.z+Math.sin(a)*1.4,{hang:t});e.h=Math.atan2(s.x-e.x,s.z-e.z);e.g.rotation.y=e.h}}
function gangU(dt){const now=performance.now()*.001;
 for(const e of GANGP.slice()){const d=dist(e,P);
  if(e.dead){if(!e.cnt){e.cnt=1;if(e.gang&&e.hang&&!GW.on){const t=e.hang;if(now-t.kt>90)t.kills=0;t.kt=now;t.kills++;if(t.kills>=3&&t.own!='you'&&!SJ)gwStart(t,'take')}else if(e.wave)GW.left--}if(e.dt>25||d>220)gangRemove(e);continue}
  if(d>200&&!e.wave){gangRemove(e);continue}pedLod(e);
  if(e.crew){crewAI(e,dt);continue}
  if(e.hostile)continue;
  /* idle on the corner: shuffle, look around, warn you off */
  e.g.rotation.y=e.h+Math.sin(now*.7+e.ph)*.3;e.g.a[0].rotation.x=Math.sin(now*1.3+e.ph)*.15;
  if(d<7&&!P.car&&!P.dead){e.warn=(e.warn||0)+dt;if(e.warn>2.5&&!e.said){e.said=1;msg('"This is '+GANGS[e.gang].n+' turf. Walk away."','#'+GANGS[e.gang].c.slice(1))}if(e.warn>7)for(const o of GANGP)if(o.hang===e.hang&&!o.dead){o.hostile=1;o.cd=rr(.3,.9)}}else e.warn=Math.max(0,(e.warn||0)-dt)}}
function crewAI(e,dt){e.g.rotation.y=e.h;if((e.cd-=dt)>0)return;e.cd=rr(.9,1.5);let b=null,bd=32;for(const o of peds)if(o.hostile&&!o.dead){const d=dist(o,e);if(d<bd&&los(e.x,e.z,o.x,o.z)){bd=d;b=o}}
 if(!b){e.g.a[1].rotation.x=0;return}e.h=Math.atan2(b.x-e.x,b.z-e.z);e.g.rotation.y=e.h;e.g.a[1].rotation.x=-1.5;tracer(e.x,e.z,b.x,b.z,0xff9ad0,1.3);snd(300,.06,'square',.02);if(R()<.4&&--b.hp<=0)kill(b,(b.x-e.x)/bd,(b.z-e.z)/bd,0,0)}
/* ---------- gang wars ---------- */
function gwStart(t,kind,by){if(GW.on||ST.act)return;Object.assign(GW,{on:1,t,kind,g:kind=='take'?t.own:by,wave:0,waves:kind=='take'?3:2,left:0,gap:2,out:0});
 for(const e of GANGP)if(e.hang===t&&!e.dead&&e.gang)e.hostile=1;
 const G=GANGS[GW.g];msg(kind=='take'?'GANG WAR! Take '+t.n+' from the '+G.n:'YOUR TURF IS UNDER ATTACK! The '+G.n+' want '+t.n+' back','#ff4f4f');snd(200,.5,'sawtooth',.06);objSet(kind=='take'?'GANG WAR: survive *3 waves* of the '+G.n+' to take *'+t.n+'*':'DEFEND *'+t.n+'*: fight off the '+G.n)}
function gwWave(){GW.wave++;const n=2+GW.wave*2+(GW.kind=='take'?0:-1);GW.left=n;for(let i=0;i<n;i++){const s=curb(P.x,P.z,40,70);const e=gangPed(GW.g,s.x+rr(-1,1),s.z+rr(-1,1),{wave:1,hostile:1});e.sp=5;e.hp=3}
 msg('WAVE '+GW.wave+'/'+GW.waves+' - '+n+' '+GANGS[GW.g].n+' INCOMING','#ff4f4f')}
function gwEnd(win){const t=GW.t,k=GW.kind,g=GW.g;GW.on=0;objSet('');if(!SJ)sbarSet('');if(win==null)return;
 if(k=='take'&&win){t.own='you';t.kills=0;cash+=2500;msg(t.n+' IS NOW EMBER CREW TURF! +$2,500','#43ff7a');for(const e of GANGP.slice())if(e.hang===t)gangRemove(e)}
 else if(k=='take'){msg('You lost the war. The '+GANGS[g].n+' keep '+t.n,'#ff6a6a')}
 else if(win){cash+=1500;msg('Turf defended! '+t.n+' stays yours. +$1,500','#43ff7a')}
 else{t.own=g;msg('The '+GANGS[g].n+' took '+t.n+' back','#ff6a6a');for(const e of GANGP.slice())if(e.hang===t)gangRemove(e)}
 snd(win?880:180,.4,'square',.05);empSaveCash()}
function gwU(dt){const t=GW.t;if(P.dead||ST.act){gwEnd(false);return}
 heat=Math.min(heat,.95);/* the cops stay out of gang wars */
 const out=P.x<t.x0-60||P.x>t.x1+60||P.z<t.z0-60||P.z>t.z1+60;if(out){if((GW.out+=dt)>4){msg('You ran from the fight.','#ff6a6a');gwEnd(false);return}}else GW.out=0;
 const alive=GANGP.filter(e=>!e.dead&&e.wave&&e.gk==GW.g).length+(GW.wave==0?GANGP.filter(e=>!e.dead&&e.hang===t&&e.gang).length:0);
 if(alive==0){if(GW.wave>=GW.waves){gwEnd(true);for(const e of GANGP.slice())if(e.wave)gangRemove(e);return}if((GW.gap-=dt)<=0){GW.gap=3;gwWave()}}
 for(const e of GANGP)if(e.wave&&!e.dead&&dist(e,P)>120){const s=curb(P.x,P.z,45,70);e.x=s.x;e.z=s.z}
 if(!SJ)sbarSet('<span>'+(GW.kind=='take'?'GANG WAR':'DEFEND')+'</span><span>'+t.n+'</span><b>WAVE '+Math.max(1,GW.wave)+'/'+GW.waves+'</b><span>'+alive+' LEFT</span>')}
/* ---------- per frame ---------- */
function empireU(dt){const ok=CFG.mode!=1&&!ST.act;if(EMPK!==empKey())empLoad();
 /* tills fill up through the day */
 for(const p of PROPS){if(p.own)p.till=Math.min(p.inc*3,p.till+p.inc*(protCut(p)?.6:1)*dt/CFG.dayLen);if(p.sale){p.sale.visible=!p.own;p.own_.visible=!!p.own}}
 /* midnight: street tax from every turf you hold */
 if(tod<DAYP-.5){const n=TURFS.filter(t=>t.own=='you').length;if(n){const m=n*400;cash+=m;msg('STREET TAX: +$'+m.toLocaleString()+' from '+n+' turf'+(n>1?'s':''),'#ffd23f')}}DAYP=tod;
 if((EMPT+=dt)>20){EMPT=0;empSave()}
 if(!ok){if(GANGP.length)gangClear();return}
 if(IN||cut)return;
 const t=turfAt(P.x,P.z);if(t&&!GW.on&&!t.home)hangoutU(t,dt);gangU(dt);
 if(GW.on)gwU(dt);
 else if(t&&t.own=='you'&&!SJ&&!P.dead&&(DEF.t-=dt)<=0){DEF.t=rr(420,720);const g=Object.keys(GANGS).filter(k=>k!='you'&&TURFS.some(q=>q.own==k));if(g.length)gwStart(t,'defend',ri(g))}}
/* ---------- the P panel and the map overlay ---------- */
function empMenu(){let h='<h2>EMBER CREW EMPIRE</h2>';const mine=TURFS.filter(t=>t.own=='you'),inc=PROPS.filter(p=>p.own).reduce((a,p)=>a+p.inc*(protCut(p)?.6:1),0);
 h+='<div class="stat">PROPERTIES $'+Math.round(inc).toLocaleString()+'/DAY + STREET TAX $'+(mine.length*400).toLocaleString()+'/DAY</div>';
 for(const p of PROPS)h+=row(p.own?'crown':'coin',p.n,p.own?'OWNED - $'+Math.floor(p.till).toLocaleString()+' in the till'+(protCut(p)?' - gang takes 40%':'')+(p.perk?' - '+p.perk:''):'FOR SALE $'+p.p.toLocaleString()+' - earns $'+p.inc.toLocaleString()+'/day','','');
 h+='<div class="stat">TURF: YOU HOLD '+mine.length+'/'+TURFS.length+'</div>';for(const k in GANGS){if(k=='you')continue;const n=TURFS.filter(t=>t.own==k).length;h+='<div class="ln"><i style="display:inline-block;width:22px;height:22px;background:'+GANGS[k].c+';box-shadow:0 0 0 3px #000"></i><span>'+GANGS[k].n+'<small>'+(n?n+' turf'+(n>1?'s':''):'WIPED OUT')+'</small></span></div>'}
 h+='<div class="stat">KILL 3 GANG MEMBERS ON THEIR TURF TO START A WAR</div>';openMd(h+'<button data-a="close">CLOSE (P)</button>')}
function turfMM(big){if(IN||CFG.mode==1)return;mg.save();mg.globalAlpha=big?.2:.14;for(const t of TURFS){mg.fillStyle=GANGS[t.own].c;mg.fillRect(MX(t.x0),MX(Math.max(t.z0,-420)),MX(t.x1)-MX(t.x0),MX(Math.min(t.z1,COAST))-MX(Math.max(t.z0,-420)))}
 mg.globalAlpha=big?.55:.35;mg.lineWidth=big?1:.6;for(const t of TURFS){mg.strokeStyle=GANGS[t.own].c;mg.strokeRect(MX(t.x0)+.5,MX(Math.max(t.z0,-420))+.5,MX(t.x1)-MX(t.x0)-1,MX(Math.min(t.z1,COAST))-MX(Math.max(t.z0,-420))-1)}
 mg.globalAlpha=1;if(big){mg.font='7px "Press Start 2P",monospace';mg.textAlign='center';for(const t of TURFS){const y=MX(Math.min(t.z1,COAST))-6;mg.fillStyle='#000';mg.fillText(t.n,MX(t.cx)+1,y+1);mg.fillStyle=GANGS[t.own].c;mg.fillText(t.n,MX(t.cx),y)}}mg.restore()}
function sideMM(big,c){if(IN)return;if(!ST.on&&BEAT&&!BEAT.obj){const p=mmPt(BEAT.x,BEAT.z,big,c);mg.fillStyle='#'+new T.Color(BEAT.col).getHexString();mg.strokeStyle='#000';mg.lineWidth=2;mg.beginPath();mg.arc(p[0],p[1],4.5,0,7);mg.fill();mg.stroke()}
 for(const e of GANGP)if(!e.dead&&(e.hostile||e.crew)){const p=mmPt(e.x,e.z,big,c);if(p[2])continue;mg.fillStyle=e.crew?'#ff4fa3':GANGS[e.gk].c;mg.fillRect(p[0]-1.5,p[1]-1.5,3,3)}}
/* ---------- glue: per-frame, keys, menu buttons, story missions ---------- */
function sideU(dt){if(!started)return;fetchU(dt);dogParkU(dt);jobsU(dt);empireU(dt)}
function sideKey(e){const c=e.code;if(c=='KeyQ'){throwBall();return 1}if(c=='KeyH'){rosyMenu();return 1}if(c=='KeyJ'){jobsMenu();return 1}if(c=='KeyP'){empMenu();return 1}if(c=='KeyN'){netMenu();return 1}if(c=='Enter'&&MP.on){chatOpen();return 1}return 0}
function sideAct(k,id){if(k=='dog'){dogAct(id);return 1}if(k=='job'){jobAct(id);return 1}if(k=='net'){netAct(id);return 1}return 0}
/* a story mission is starting: clear the stage */
function freeRoamPause(){wxRelease();sjEnd(1);if(GW.on)gwEnd(null);gangClear();fetchReset();ROSY.trick=null;ROSY.play=null}
