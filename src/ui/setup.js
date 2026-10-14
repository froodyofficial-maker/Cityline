/* ---- setup page / game modes ---- */
const saveCfg=()=>{try{localStorage.setItem('embercity_cfg',JSON.stringify(CFG))}catch(e){}};
const CFG={gfx:QDEF,map:0,jump:1.6,mp:1,room:'city',name:'PLAYER'+(10+R()*89|0),pvp:1,sens:1,scopeSens:.4,tanksA:4,tanksE:5,mode:0,armyA:60,armyE:120,tanks:1,copLimit:10,skip:0,hunger:1,rent:1,dayLen:240,start:.42,cash:500,peds:40,traffic:12,heatMult:1,gore:1,exec:1,allW:0,infAmmo:0,god:0,perma:0,goal:0,shirt:'#e8452c'};
try{Object.assign(CFG,JSON.parse(localStorage.getItem('embercity_cfg')||'{}'))}catch(e){}
const SPEC=[['opt','gfx','GRAPHICS QUALITY',[['LOW',0],['MEDIUM',1],['HIGH',2],['ULTRA',3]]],['range','jump','JUMP HEIGHT (METERS, 0 = OFF)',0,12,0.2,v=>(+v).toFixed(1)+' M'],['txt','name','YOUR NAME'],['tog','pvp','ONLINE: PLAYER VS PLAYER DAMAGE'],['range','sens','MOUSE SENSITIVITY',0.2,3,0.1,v=>(+v).toFixed(1)+'X'],['range','scopeSens','SNIPER SCOPE SENSITIVITY',0.1,1.5,0.05,v=>(+v).toFixed(2)+'X'],['opt','mode','GAME MODE',[['OPEN CITY',0],['WAR',1]]],['range','armyA','WAR: YOUR ARMY SIZE',10,100,5,v=>v],['range','armyE','WAR: ENEMY ARMY SIZE',10,200,10,v=>v],['range','tanksA','WAR: YOUR TANKS',0,10,1,v=>v],['range','tanksE','WAR: ENEMY TANKS',0,15,1,v=>v],['range','copLimit','COPS TO KILL BEFORE POLICE LEAVE (PER DAY)',1,51,1,v=>v>50?'NEVER':v],['tog','skip','SKIP INTRO CUTSCENE'],['tog','hunger','HUNGER SURVIVAL'],['tog','rent','DAILY RENT ($100)'],
 ['range','dayLen','DAY LENGTH',60,600,30,v=>v+' SEC'],['opt','start','START TIME',[['MORNING',.27],['NOON',.5],['SUNSET',.73],['NIGHT',.95]]],['range','cash','START CASH',0,50000,500,v=>'$'+v],
 ['range','peds','PEDESTRIANS',0,100,5,v=>v],['range','traffic','TRAFFIC',0,30,1,v=>v],['opt','heatMult','POLICE AGGRESSION',[['CHILL',.5],['NORMAL',1],['HEAVY',2]]],['opt','gore','GORE LEVEL',[['MILD',.4],['NORMAL',1],['EXTREME',2.2]]],
 ['tog','exec','EXECUTION SCENES'],['tog','allW','ALL WEAPONS UNLOCKED'],['tog','infAmmo','INFINITE AMMO'],['tog','god','GOD MODE'],['tog','perma','HARDCORE (ONE LIFE)'],
 ['opt','goal','WIN GOAL (CASH)',[['NONE',0],['$25K',25000],['$100K',100000],['$1M',1000000]]],['sw','shirt','OUTFIT COLOR',['#e8452c','#2b8fff','#3ec24a','#ffd23f','#a14bff','#ff4fa3','#222222','#ffffff']]];
const PRE={WAR:{mode:1,armyA:60,armyE:140,tanks:1,skip:0,hunger:0,rent:0,dayLen:600,start:.5,cash:0,peds:0,traffic:3,heatMult:1,gore:2.2,exec:0,allW:1,infAmmo:0,god:0,perma:0,goal:0,copLimit:10},CLASSIC:{mode:0,copLimit:10,skip:0,hunger:1,rent:1,dayLen:240,start:.42,cash:500,peds:40,traffic:12,heatMult:1,gore:1,exec:1,allW:0,infAmmo:0,god:0,perma:0,goal:100000},
 SANDBOX:{mode:0,copLimit:3,skip:1,hunger:0,rent:0,dayLen:360,start:.5,cash:50000,peds:50,traffic:14,heatMult:.5,gore:1,exec:1,allW:1,infAmmo:1,god:1,perma:0,goal:0},
 HARDCORE:{mode:0,copLimit:51,skip:0,hunger:1,rent:1,dayLen:200,start:.27,cash:0,peds:40,traffic:12,heatMult:2,gore:1,exec:1,allW:0,infAmmo:0,god:0,perma:1,goal:100000},
 CHAOS:{mode:0,copLimit:25,skip:1,hunger:0,rent:0,dayLen:240,start:.95,cash:10000,peds:100,traffic:30,heatMult:2,gore:2.2,exec:1,allW:1,infAmmo:1,god:0,perma:0,goal:0}};
let setupOpen=0,won=0,lastHeat=0;
function renderSetup(){$('pre').innerHTML=Object.keys(PRE).map(k=>'<button data-p="'+k+'">'+k+'</button>').join('');
 $('sg').innerHTML=SPEC.map((sp,i)=>{const t=sp[0],k=sp[1];let c='';
  if(t=='range')c='<input type="range" data-k="'+k+'" min="'+sp[3]+'" max="'+sp[4]+'" step="'+sp[5]+'" value="'+CFG[k]+'">';else if(t=='tog')c='<span class="tog'+(CFG[k]?' on':'')+'" data-k="'+k+'" data-t="1"></span>';
  else if(t=='txt')c='<input type="text" data-k="'+k+'" maxlength="20" value="'+String(CFG[k]).replace(/[^A-Za-z0-9 _-]/g,'')+'">';else if(t=='opt')c='<div class="opts">'+sp[3].map(o=>'<button class="'+(CFG[k]==o[1]?'sel':'')+'" data-k="'+k+'" data-v="'+o[1]+'">'+o[0]+'</button>').join('')+'</div>';
  else c=sp[3].map(o=>'<span class="sw'+(CFG[k]==o?' sel':'')+'" style="background:'+o+'" data-k="'+k+'" data-v="'+o+'"></span>').join('');
  return'<div class="sr" style="animation-delay:'+(i*.04)+'s"><label><span>'+sp[2]+'</span><b id="v_'+k+'">'+(t=='range'?sp[6](CFG[k]):'')+'</b></label>'+c+'</div>'}).join('')}
function openSetup(){setupOpen=1;$('setup').style.display='flex';renderSetup();snd(400,.1,'square',.04)}
$('sb').onclick=()=>{setupOpen=0;$('setup').style.display='none'};$('sgo').onclick=()=>openMaps();$('mb2').onclick=()=>{mapOpen=0;$('maps').style.display='none'};$('mgo').onclick=()=>beginGame();
$('sp').addEventListener('input',e=>{const k=e.target.dataset.k;if(k&&e.target.type=='text'){CFG[k]=k=='room'?(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,20)||'city'):(e.target.value.replace(/[^A-Za-z0-9 _-]/g,'').slice(0,16)||'PLAYER');return}if(k&&e.target.type=='range'){CFG[k]=+e.target.value;$('v_'+k).textContent=SPEC.find(x=>x[1]==k)[6](CFG[k])}});
$('sp').addEventListener('click',e=>{const t=e.target;if(t.dataset.p){Object.assign(CFG,PRE[t.dataset.p]);renderSetup();snd(600,.1,'square',.04);return}const k=t.dataset.k;if(!k)return;
 if(t.dataset.t){CFG[k]=CFG[k]?0:1;t.classList.toggle('on')}else if(t.dataset.v!==undefined){CFG[k]=isNaN(t.dataset.v)?t.dataset.v:+t.dataset.v;t.parentNode.querySelectorAll('[data-k]').forEach(x=>x.classList.toggle('sel',x===t));if(!t.classList.contains('sw')&&t.parentNode.classList.contains('sr'))t.classList.add('sel')}});
function setShirt(c){reShirt(P.g,c)}
function applyCfg(){try{localStorage.setItem('embercity_cfg',JSON.stringify(CFG))}catch(e){}
 if(CFG.mode==1){CFG.hunger=0;CFG.rent=0;CFG.peds=0;CFG.traffic=3;CFG.dayLen=600;copsOff=1}
 while(peds.length<CFG.peds)mkPed();while(peds.length>CFG.peds){const e=peds.pop();sc.remove(e.g)}
 const ai=cars.filter(c=>c.ai);while(ai.length<CFG.traffic){const c=car(ri([0xd03030,0x2a6fd0,0xe0b020,0x30a060,0xeeeeee,0x333333]));c.ai=1;aiCarPlace(c,1);cars.push(c);ai.push(c)}
 while(ai.length>CFG.traffic){const c=ai.pop();sc.remove(c.g);cars.splice(cars.indexOf(c),1)}
 cash=dispCash=lastCash=CFG.cash;tod=CFG.start;if(CFG.allW)for(const k of WK2){own[k]=1;ammo[k]=Math.max(ammo[k],200)}lastHot='';setShirt(CFG.shirt);initGfx();applyMap(CFG.map);gfxFinalize();if(CFG.mode==1)startWar()}
function cfgU(dt){const dh=heat-lastHeat;if(dh>0&&CFG.heatMult!=1)heat=lastHeat+dh*CFG.heatMult;lastHeat=heat;if(CFG.god){P.hp=100;hunger=100}if(CFG.goal&&cash>=CFG.goal&&!won&&!cut&&!P.dead){won=1;winScreen()}}
function winScreen(){mode='eod';document.exitPointerLock&&document.exitPointerLock();$('eodp').innerHTML='<h2>YOU MADE IT</h2><div class="er"><span>GOAL REACHED</span><b>$'+CFG.goal+'</b></div><div class="er"><span>DAY</span><b>'+day+'</b></div><div class="er"><span>CIVILIANS KILLED</span><b>'+kills+'</b></div><div class="stamp" style="animation-delay:.6s">W</div><button id="eodgo">KEEP PLAYING &gt;</button> <button id="eodnew">NEW GAME</button>';
 $('eod').style.display='flex';$('eodgo').onclick=()=>{$('eod').style.display='none';mode='play';reLock()};$('eodnew').onclick=()=>location.reload();snd(700,.4,'sine')}
function gameOver(){mode='eod';document.exitPointerLock&&document.exitPointerLock();$('eodp').innerHTML='<h2>GAME OVER</h2><div class="er"><span>DAYS SURVIVED</span><b>'+(day-1)+'</b></div><div class="er"><span>CASH</span><b>$'+cash+'</b></div><div class="er"><span>CIVILIANS KILLED</span><b>'+kills+'</b></div><div class="er"><span>COPS KILLED TODAY</span><b>'+dS.cops+'</b></div><button id="eodgo">BACK TO MENU</button>';
 $('eod').style.display='flex';$('eodgo').onclick=()=>location.reload();snd(120,1,'sawtooth',.1)}
/* ---- jumping ---- */
function walkH(x,z){if(onPier(x,z))return .5;if(inWater(x,z))return -.4;let g=Math.max(0,terrH(x,z));for(const b of bNear(x,z,x,z))if(!b.air&&b.h>2&&!(b.over&&(P.y||0)<b.h-1.5)&&x>b.x1&&x<b.x2&&z>b.z1&&z<b.z2)g=Math.max(g,b.h+.06);return g}
function footY(dt){P.g.scale.y=P.crouch?.76:1;const gy=IN?0:walkH(P.x,P.z);P.y=P.y||0;P.vy=P.vy||0;
 if(CFG.god){P.vy=(K.Space?12:0)-(K.KeyC?12:0);P.y=Math.max(gy,P.y+P.vy*dt);P.roof=null;P.gr=P.y<=gy+.02;return}
 if(P.y<=gy+.02&&P.vy<=0){P.y=gy;P.vy=0;P.gr=1;if(P.jr&&CFG.jump>0){P.vy=Math.sqrt(2*22*CFG.jump);P.gr=0;snd(420,.1,'sine',.03)}}
 if(P.y>gy+.02||P.vy>0){P.vy-=22*dt;P.y+=P.vy*dt;P.g.a[0].rotation.x=P.g.a[1].rotation.x=-.8;if(P.y<=gy){const vv=-P.vy;P.y=gy;P.vy=0;const lim=Math.max(15,Math.sqrt(44*CFG.jump)+2);if(vv>lim){P.hp-=(vv-lim)*5;hit('fall');shake=Math.max(shake,.5);snd(80,.2,'sawtooth',.08)}}}else P.y=gy;
 P.roof=(gy>1&&P.y<=gy+.3)?(ladders.find(l=>Math.abs(l.roofY-gy)<.3&&P.x>l.b.x1-1&&P.x<l.b.x2+1&&P.z>l.b.z1-1&&P.z<l.b.z2+1)||null):null}
