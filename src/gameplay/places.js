/* ==================== places: things to do across Greater Ember City ====================
   Every interactive spot is a POI {x,z,r,txt(),e(),rob()?,car?,y?}. act()/ptxt() check POIs before the downtown ones.
   EMBER MALL (Eastside)        enterable: outfits, gun counter, food court, jewellery counter to rob
   EMBER MOTORS (Eastside)      buy a car
   CHOP SHOP (Foundry)          drive a car in and sell it
   PIER 9 YARD (Port Ember)     smuggled crates to steal, dock security; climbable harbour crane
   EMBER TOWER (Heights)        elevator to the observation roof, the NOVA vault heist
   EMBER PIER / BEACH           Ferris wheel ride, beach huts
   GAS STATIONS                 snacks, robbable counters
   PALM GROVE                   night-time break-ins (houses with newspapers piling up)
   EMBER TOKENS                 24 hidden collectibles */
const POIS=[],PLACES=[],GASST=[],BRK=[],CRATES=[];let MALL=null,TOWER=null,TOKS=[];
function poi(o){o.r=o.r||3;POIS.push(o);return o}
function poiNear(car){let b=null,bd=1e9;for(const q of POIS){if(!!q.car!==!!car)continue;if(q.y!==undefined?Math.abs((P.y||0)-q.y)>2:(P.y||0)>2)continue;const d=Math.hypot(q.x-P.x,q.z-P.z);if(d<q.r&&d<bd){bd=d;b=q}}return b}
const night=()=>tod>.8||tod<.24,stars_=()=>Math.min(5,Math.floor(heat));
function pay(n){if(cash<n){msg('Not enough cash','#ff6a6a');return false}cash-=n;return true}
/* ---------- EMBER MALL ---------- */
const OUTFITS=[['EMBER RED','#e8452c'],['OCEAN BLUE','#2b8fff'],['PALM GREEN','#3ec24a'],['GOLD RUSH','#ffd23f'],['NEON VIOLET','#a14bff'],['FLAMINGO','#ff4fa3'],['MIDNIGHT','#222222'],['CLEAN WHITE','#f2f2f2']];
function buildMall(cx,cz){const ox=2560,oz=2300;
 const W=(x,z,w,d)=>{bx(w,4.5,d,0xe8e2d6,ox+x,2.25,oz+z,sc);IB.push({x1:ox+x-w/2,x2:ox+x+w/2,z1:oz+z-d/2,z2:oz+z+d/2})},F=(x,z,w,d,c,y)=>{const f=new T.Mesh(new T.PlaneGeometry(w,d),mat(c));f.rotation.x=-PI/2;f.position.set(ox+x,y||.02,oz+z);f.receiveShadow=true;sc.add(f)};
 F(0,0,32,24,0xd8d2c8);F(0,0,6,22,0xc8bfae,.03);W(0,-12,32.4,.4);W(-16,0,.4,24);W(16,0,.4,24);W(-9.5,12,13,.4);W(9.5,12,13,.4);IB.push({x1:ox-16,x2:ox+16,z1:oz+12.6,z2:oz+13});
 const cl=new T.Mesh(new T.PlaneGeometry(32.4,24.4),mat(0xf2eee6));cl.rotation.x=PI/2;cl.position.set(ox,4.5,oz);sc.add(cl);for(const x of[-8,0,8])for(const z of[-6,3])bx(3,.06,1,0xfff6e0,ox+x,4.46,oz+z,sc);
 for(const[x,z]of[[-8,-4],[8,-4],[0,6],[-8,6],[8,6]]){const l=new T.PointLight(0xfff2dc,.9,22);l.position.set(ox+x,4,oz+z);sc.add(l)}
 /* boutique (west) */bx(.1,3.4,10,0xff4fa3,ox-15.7,1.9,oz-2,sc);nsign('THREADS','#ff4fa3',ox-11,3.6,oz-7.7,6);for(let i=0;i<4;i++){bx(3,.1,.6,0x8a8f96,ox-13,1.9,oz-6+i*3,sc);for(let j=0;j<5;j++)bx(.5,1.1,.08,parseInt(ri(OUTFITS)[1].slice(1),16),ox-14.2+j*.6,1.3,oz-6+i*3,sc);IB.push({x1:ox-14.6,x2:ox-11.4,z1:oz-6.4+i*3,z2:oz-5.6+i*3})}
 OUTFITS.slice(0,3).forEach((o,i)=>{const m=person('#d8c8b0',o[1],'#2b2f3a','#d8c8b0',0);m.position.set(ox-9,0,oz-6+i*3.4);m.rotation.y=PI/2;sc.add(m)});
 /* gun counter (east) */bx(7,1.1,1.4,0x2a2a30,ox+11,.55,oz-2,sc);IB.push({x1:ox+7.5,x2:ox+14.5,z1:oz-2.7,z2:oz-1.3});bx(7,.08,1.4,0xff3b3b,ox+11,1.12,oz-2,sc);bx(.1,2.6,8,0x3a3a44,ox+15.7,2,oz-2,sc);for(let i=0;i<5;i++)bx(1.6,.2,.12,0x222222,ox+15.5,1.4+i*.5,oz-5+i*1.4,sc);nsign('EMBER ARMS','#ff3b3b',ox+11,3.6,oz-7.7,6);
 /* food court (north) */bx(12,1.1,1.6,0xc06020,ox,.55,oz-10,sc);IB.push({x1:ox-6,x2:ox+6,z1:oz-10.8,z2:oz-9.2});nsign('FOOD COURT','#ffc94a',ox,3.4,oz-11.7,7);for(const x of[-5,0,5]){cy(.8,.06,0xeeeeee,ox+x,.9,oz-6.5,12);cy(.08,.9,0x777777,ox+x,.45,oz-6.5,6);for(const s of[-1,1])cy(.3,.5,0xff6a2b,ox+x+s*1.1,.25,oz-6.5,8)}
 /* jewellery (centre) */bx(5,1,1.6,0xe8e4d8,ox+2,.5,oz+3,sc);bx(5,.5,1.6,0x9adcf0,ox+2,1.25,oz+3,sc);IB.push({x1:ox-.5,x2:ox+4.5,z1:oz+2.2,z2:oz+3.8});nsign('LUXE','#ffd23f',ox+2,3.2,oz+2.15,4);
 const st={name:'EMBER MALL',kind:'mall',ox,oz,ret:{x:cx,z:cz+7.5},cash:Math.round(rr(900,1600)),alarm:0,counted:0,buy:{x:-1e9,z:-1e9},reg:{x:ox-1.4,z:oz+4.6},exit:marker(ox,oz+10.5,0x2bf0ff),pois:[]};
 for(const[t,x,z]of[['watch',ox,oz+3],['watch',ox+1.4,oz+3],['perfume',ox+2.8,oz+3],['console',ox+4,oz+3]]){const m=itemMesh(t);m.position.set(x,1.55,z);sc.add(m);items.push({t,m,x,z,taken:0,st})}
 const g=person('#c68642','#ffd23f','#333','#111',0);g.position.set(ox+2,0,oz+1.6);clerks.push({g,x:ox+2,z:oz+1.6,hp:2,dead:0,clerk:1,st,dt:0});
 st.pois.push({x:ox-11,z:oz-2,r:3.2,txt:()=>'E - Browse outfits ($150)',e:()=>outfitPanel()},{x:ox+11,z:oz-.4,r:3,txt:()=>'E - Gun counter',e:()=>shopPanel({name:'EMBER ARMS',kind:'guns',menu:[]})},{x:ox,z:oz-8.4,r:3.4,txt:()=>'E - Food court (eat here)',e:()=>foodPanel('FOOD COURT',['burger','ramen','coffee'],0)});
 MALL=st;poi({x:cx,z:cz+7.2,r:3.5,txt:()=>'E - Enter Ember Mall',e:()=>{IN=MALL;P.x=ox;P.z=oz+9.5;P.h=PI;camYaw=PI;cam.position.set(ox,4,oz+12);msg('EMBER MALL - outfits, guns, food court','#2bf0ff')}});PLACES.push({x:cx,z:cz,icon:'bag'})}
function outfitPanel(){let h='<h2>THREADS</h2><div class="stat">CASH $'+cash+' / $150 PER OUTFIT</div>';for(const[n,c]of OUTFITS)h+='<div class="ln"><i style="display:inline-block;width:28px;height:28px;background:'+c+';box-shadow:0 0 0 3px #000"></i><span>'+n+(CFG.shirt==c?' (WEARING)':'')+'</span>'+(CFG.shirt==c?'':'<button data-a="outfit:'+c+'">BUY</button>')+'</div>';openMd(h+'<button data-a="close">LEAVE</button>')}
function foodPanel(name,ids,mk){curFood={name,ids,mk};let h='<h2>'+name+'</h2><div class="stat">CASH $'+cash+' / HUNGER '+Math.round(hunger)+'%</div>';for(const id of ids){const t=IT[id],p=Math.round(t.p*(mk?1.3:1));h+=row(t.s,t.n,'$'+p+' / HUNGER +'+t.f+' HP +'+t.h,'EAT','eat:'+id)}openMd(h+'<button data-a="close">LEAVE</button>')}
let curFood=null;
function placesAct(k,id){if(k=='court'){courtAct(id);return true}if(k=='outfit'){if(!pay(150))return true;setShirt(id);CFG.shirt=id;saveCfg();snd(700,.1);msg('NEW OUTFIT','#43ff7a');outfitPanel();return true}
 if(k=='eat'){const t=IT[id],p=Math.round(t.p*(curFood&&curFood.mk?1.3:1));if(!pay(p))return true;addInv(id,1);useItem(id);foodPanel(curFood.name,curFood.ids,curFood.mk);return true}
 if(k=='car'){const m=MODELS[+id];if(!pay(m.p))return true;const c=car(ri(m.cols),m.t);setCar(c,DEAL.x+9,DEAL.z+13,PI/2);cars.push(c);snd(700,.15);msg(m.n+' BOUGHT - parked out front','#43ff7a');closeCas();return true}return false}
/* ---------- EMBER MOTORS ---------- */
const DISP=[];/* showroom cars get the same distance LOD as traffic */
const MODELS=[{n:'EMBER SEDAN',t:0,p:3500,cols:[0xd03030,0x2a6fd0,0xeeeeee,0x333333]},{n:'VELOCE COUPE',t:1,p:9000,cols:[0xffc94a,0xff2f6d,0x111111,0x2bf0ff]},{n:'RANGER SUV',t:2,p:6000,cols:[0x30a060,0x6a7078,0x8a3aa8,0xe8e4d8]}];let DEAL=null;
function dealership(cx,cz){dPad(cx,cz);WK=1;wall(18,6,10,0xb8c4d0,cx,cz-7);nsign('EMBER MOTORS','#2bf0ff',cx,6.6,cz-1.9,10);nRing(18.3,10.3,0x2bf0ff,cx,6.2,cz-7);foot(cx,cz-7,18,10,6);
 const pl=new T.Mesh(new T.PlaneGeometry(26,12),roadMat());pl.rotation.x=-PI/2;pl.position.set(cx,.1,cz+7);sc.add(pl);
 MODELS.forEach((m,i)=>{const c=car(m.cols[0],m.t);c.x=cx-8+i*8;c.z=cz+5;DISP.push(c);c.g.position.set(cx-8+i*8,0,cz+5);c.g.rotation.y=PI*.15;bx(5,.2,5,0x3a3f48,cx-8+i*8,.1,cz+5,sc);solid(cx-8+i*8,cz+5,2.4,4.6,1.4);for(const s of[-1,1])bx(.1,4,.1,0xdddddd,cx-8+i*8+s*2.4,2,cz+2.4,sc)});
 DEAL={x:cx,z:cz};poi({x:cx,z:cz-1,r:3.4,txt:()=>'E - Buy a car',e:()=>{let h='<h2>EMBER MOTORS</h2><div class="stat">CASH $'+cash+' / DRIVE IT OFF THE LOT</div>';MODELS.forEach((m,i)=>h+=row('star',m.n,'$'+m.p.toLocaleString(),'BUY','car:'+i));openMd(h+'<button data-a="close">LEAVE</button>')}});PLACES.push({x:cx,z:cz,icon:'car'})}
/* ---------- CHOP SHOP ---------- */
function chopShop(cx,cz){dPad(cx,cz);const c=0x6a6e74;rib(.4,7,14,c,cx-10,3.56,cz-3);rib(.4,7,14,c,cx+10,3.56,cz-3);rib(20.4,7,.4,c,cx,3.56,cz-10);rib(20.4,.4,14.4,0x4a4e54,cx,7.2,cz-3);rib(20.4,2.2,.4,c,cx,6,cz+4);
 for(const s of[-1,1])solid(cx+s*10,cz-3,.6,14,7);solid(cx,cz-10,20,.6,7);B.push({x1:cx-10,x2:cx+10,z1:cz-10,z2:cz+4,h:7.4,over:1});
 nsign('CHOP SHOP','#ff6a2b',cx,6,cz+4.3,8);bx(2.4,.2,5,0xffc94a,cx-4,1.6,cz-4,sc);for(const s of[-1,1])bx(.3,1.6,.3,0x8a8e94,cx-4+s*1.1,.8,cz-4,sc);
 for(let i=0;i<5;i++)cy(.45,.3,0x1a1a1a,cx+7,.15+i*.3,cz-8,12);bx(3,1,.8,0xc0392b,cx+6.5,.5,cz-1,sc);solid(cx+6.5,cz-1,3,.8,1);const l=new T.PointLight(0xffd8a0,1.2,18);l.position.set(cx,5.5,cz-3);sc.add(l);
 poi({x:cx,z:cz,r:8,car:1,txt:()=>{const p=chopPrice(P.car);return p?'E - Sell this car to the chop shop ($'+p+')':heat>=1?'Lose the cops first - nobody buys a hot car':'This one is too hot to sell'},e:()=>chopSell()});
 poi({x:cx,z:cz+4,r:6,txt:()=>'CHOP SHOP - drive a car in here to sell it',e:()=>{}});PLACES.push({x:cx,z:cz,icon:'wrench'})}
function chopPrice(c){if(!c||c.sv||c.story||heat>=1)return 0;return Math.round([1400,3200,2200][c.type||0]*(1-Math.min(.7,(c.dmg||0)/120))/10)*10}
function chopSell(){const c=P.car,p=chopPrice(c);if(!p)return;P.car=null;P.g.visible=true;P.x=c.x+3;P.z=c.z+4;sc.remove(c.g);cars.splice(cars.indexOf(c),1);cash+=p;snd(500,.2,'square',.05);msg('CHOPPED: +$'+p,'#ffd23f')}
/* ---------- PIER 9 YARD (Port Ember) ---------- */
function portYard(cx,cz){dPad(cx,cz);for(const[a,b,c,d]of[[-13.5,-13.5,13.5,-13.5],[-13.5,13.5,-3,13.5],[3,13.5,13.5,13.5],[-13.5,-13.5,-13.5,13.5],[13.5,-13.5,13.5,13.5]])fence(cx+a,cz+b,cx+c,cz+d);
 for(const[x,z]of[[-8,-6],[-8,2],[8,-6]]){for(let k=0;k<2;k++)rib(6.1,2.6,2.44,ri(DPAL.box),cx+x,1.36+k*2.62,cz+z);solid(cx+x,cz+z,6.2,2.5,5.3)}
 bx(3,2.6,3,0xe8e4d8,cx+9,1.3,cz+9,sc);bx(3.2,.2,3.2,0x2a6fd0,cx+9,2.7,cz+9,sc);solid(cx+9,cz+9,3,3,2.6);nsign('PIER 9','#ffc94a',cx,4,cz+13.6,5).rotation.y=PI;
 for(const[x,z]of[[0,-2],[4,4],[-3,7]]){const g=new T.Group();g.userData.dyn=1;bx(1.4,1,1,0x6a3a1a,0,.5,0,g);nb(1.42,.12,1.02,0xff3b3b,0,.9,0,g);nb(.12,1.02,1.02,0xff3b3b,0,.5,0,g);g.position.set(cx+x,0,cz+z);sc.add(g);
  const cr={g,x:cx+x,z:cz+z,cd:0};CRATES.push(cr);poi({x:cr.x,z:cr.z,r:2.2,txt:()=>cr.cd>0?'':'E - Grab the smuggled crate',e:()=>grabCrate(cr)})}PLACES.push({x:cx,z:cz,icon:'anchor'})}
function grabCrate(cr){if(cr.cd>0)return;cr.cd=600;cr.g.visible=false;const m=Math.round(rr(1200,2600)),it=ri(['watch','console','cashbag']);cash+=m;addInv(it,1);snd(600,.1);
 if(!CRATES.some(c=>c!==cr&&c.cd>0)){heat=Math.max(heat,2.6);msg('DOCK SECURITY ALERTED!','#ff4f4f');for(let i=0;i<3;i++)mkCop(24)}msg('CRATE: +$'+m+' and '+IT[it].n,'#ffd23f')}
function craneLadder(x){const zq=COAST+12,lx=x-6.4,lz=zq-7,t=LT.clone();t.needsUpdate=true;t.repeat.set(1,24);const lm=new T.Mesh(new T.PlaneGeometry(1.2,34),new T.MeshBasicMaterial({map:t,transparent:true,alphaTest:.5,side:T.DoubleSide}));lm.rotation.y=PI/2;lm.position.set(x-5.65,17,lz);sc.add(lm);
 B.push({x1:x-5.8,x2:x+5.8,z1:zq-17,z2:zq+57,h:35,over:1});const mk=marker(lx,lz,0xffffff);ladders.push({x:mk.x,z:mk.z,roofY:35.06,b:{x1:x-5.6,x2:x+5.6,z1:zq-16,z2:zq+56},ex:{x:x-5.8,z:lz}})}
/* ---------- EMBER TOWER ---------- */
function towerPlaces(cx,cz){const top={x:cx,z:cz+3,roofY:156.06,b:{x1:cx-5.6,x2:cx+5.6,z1:cz-5.6,z2:cz+5.6},ex:{x:cx,z:cz+3},elev:1,base:{x:cx,z:cz+14}};ladders.push(top);TOWER={cx,cz,cd:0,top};
 for(const s of[-1,1]){bx(12,.9,.12,0xd0d4da,cx,156.5,cz+s*6,sc);bx(.12,.9,12,0xd0d4da,cx+s*6,156.5,cz,sc)}B.push({x1:cx-.9,x2:cx+.9,z1:cz-.9,z2:cz+.9,h:190});for(const[x,z]of[[-4,-4],[4,-4]]){cy(.12,1.2,0x444444,cx+x,156.6,cz+z,6);bx(.3,.3,.9,0x2a2a30,cx+x,157.3,cz+z,sc)}
 poi({x:cx,z:cz+14,r:3,txt:()=>'E - Elevator to the observation roof',e:()=>elevator(top,1)});
 poi({x:cx+14,z:cz,r:3,txt:()=>TOWER.cd>0?'NOVA vault on lockdown ('+Math.ceil(TOWER.cd)+'s)':'E - CRACK THE NOVA VAULT',e:()=>novaHeist()});bx(.2,2.6,2.4,0x2a3a48,cx+12.15,1.3,cz,sc);nb(.06,.3,.3,0xff3b3b,cx+12.3,2.4,cz+1.4);PLACES.push({x:cx,z:cz,icon:'tower'})}
function elevator(l,up){const x=l.x,z=l.z;cutscene(4.2,p=>{const k=up?p:1-p,y=1.5+k*156;cam.position.set(x+34,y+6,z+30);cam.lookAt(x,y,z);P.g.visible=false},[[0,up?'Going up...':'Going down...']],()=>{P.g.visible=true;if(up){P.roof=l;P.roofT=performance.now();P.x=l.ex.x;P.z=l.ex.z+1.5;P.y=l.roofY;camYaw=PI;msg('EMBER TOWER - OBSERVATION ROOF','#2bf0ff')}else{P.roof=null;P.y=0;P.x=l.base.x;P.z=l.base.z+1;camYaw=0}})}
function novaHeist(){if(TOWER.cd>0)return;TOWER.cd=420;const x=TOWER.cx,z=TOWER.cz;
 cutscene(10,(p,t)=>{const a=p*2.4;cam.position.set(x+sin(a)*36,6+p*30,z+cos(a)*36);cam.lookAt(x,20+p*20,z);$('sir').style.opacity=p>.55?1:0},
 [[0,'"NOVA Systems. Floor B2. Nobody upstairs knows this vault exists."'],[3,'Thermal lance through the door. Ninety seconds.'],[6,'Bearer bonds, diamonds, cold cash.'],[8.4,'Every cop in the Heights is coming.']],
 ()=>{const m=Math.round(rr(22000,38000));cash+=m;addInv('watch',2);heat=Math.max(heat,4.8);dS.heists++;msg('NOVA VAULT: +$'+m.toLocaleString()+' - GET OUT OF THE HEIGHTS!','#ffd23f')})}
/* ---------- beach: Ferris wheel + huts ---------- */
function beachPlaces(){const fx=PIER.x,fz=PIER.z1-12;poi({x:fx,z:PIER.z1-24,r:3.4,txt:()=>'E - Ride the Ferris wheel ($20)',e:()=>{if(pay(20))ferrisRide(fx,fz)}});PLACES.push({x:fx,z:fz,icon:'wheel'});
 for(const[x,n,ids]of[[-260,'SURF SHACK',['coffee','burger']],[-60,'ICE CREAM',['coffee']],[40,'TACOS',['burger','ramen']]])poi({x,z:COAST+12,r:3,txt:()=>'E - '+n,e:()=>foodPanel(n,ids,1)})}
function ferrisRide(fx,fz){const cyc=fz-.8,R0=13,cy0=.5+R0+2;cutscene(16,p=>{const a=-PI/2+p*PI*2*.999,py=cy0+Math.sin(a)*R0,pz=cyc;cam.position.set(fx+Math.cos(a)*R0,py-1,pz-1.6);cam.lookAt(fx*.4,8+py*.25,-120)},
 [[.5,'Up over the pier...'],[5,'The whole of Ember City, end to end.'],[10,'From up here it almost looks peaceful.']],()=>{P.x=fx;P.z=PIER.z1-24;msg('What a view.','#ffc94a')})}
/* ---------- gas stations ---------- */
function gasPlaces(cx,cz){const g={x:cx,z:cz-4.6,cash:0,cd:0};GASST.push(g);
 poi({x:g.x,z:g.z,r:3,txt:()=>'E - Snacks   R - ROB THE COUNTER'+(g.cd>0?' (just robbed)':''),e:()=>shopPanel({name:'GAS & GO',kind:'gas',menu:['coffee','burger','medkit']}),rob:()=>{if(g.cd>0)return msg('Register is empty');const m=Math.round(rr(260,680));g.cd=300;cash+=m;heat=Math.max(heat,2.2);dS.stores++;shake=.3;snd(900,.2);msg('GAS STATION: +$'+m,'#ffd23f')}});PLACES.push({x:cx,z:cz,icon:'fuel'})}
/* ---------- Palm Grove break-ins ---------- */
function breakIn(h){if(!night())return msg('Too many eyes around in daylight. Come back after dark.','#ffb02b');if(h.day===day)return msg('Already cleaned this one out today');h.day=day;
 cutscene(2.2,p=>{cam.position.set(h.x+sin(p)*5,2.4,h.z+h.f*5);cam.lookAt(h.x,1.2,h.z)},[[0,'Lock picked. Quiet now...']],()=>{const m=Math.round(rr(150,600)),it=ri(['watch','console','perfume','perfume','watch']);cash+=m;addInv(it,1);
  if(R()<.35){heat=Math.max(heat,1.6);msg('THE OWNERS WERE HOME! THEY CALLED THE COPS','#ff4f4f')}msg('BREAK-IN: +$'+m+' and '+IT[it].n,'#ffd23f')})}
/* ---------- Ember Tokens (collectibles, remembered between sessions) ---------- */
function srng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const TOKM=new T.MeshStandardMaterial({color:0xffc94a,emissive:0xff8a2b,emissiveIntensity:.6,metalness:.9,roughness:.25}),TOKG=new T.CylinderGeometry(.5,.5,.1,20).rotateX(PI/2);
function buildTokens(){let got=[];try{got=JSON.parse(localStorage.getItem('embercity_tokens')||'[]')}catch(e){}const rnd=srng(1717),spots=[];
 const fixed=[[PIER.x,PIER.z1-3,0],[TOWER?TOWER.cx+3:0,TOWER?TOWER.cz-3:-200,156.06],[150-5.8+3,COAST+12+20,35.06],[-300,COAST+16,0],[80-9.6,-300,0],[2,COAST-3,0]];
 for(const f of fixed)spots.push(f);let t=0;while(spots.length<24&&t++<4000){const c=RL[rnd()*RL.length|0],u=Math.round((rnd()*720-360)/40)*40+10,sd=rnd()<.5?-8.5:8.5,ax=rnd()<.5,x=ax?c+sd:u,z=ax?u:c+sd;
  if(Math.abs(x)<110&&Math.abs(z)<110)continue;if(z>COAST-2||inWater(x,z)||bNear(x-1,z-1,x+1,z+1).some(b=>x>b.x1-.6&&x<b.x2+.6&&z>b.z1-.6&&z<b.z2+.6))continue;if(x>AIRX[0]-4&&x<AIRX[1]+4&&z>AIRZ[0]-4&&z<AIRZ[1]+4)continue;if(spots.some(s=>Math.hypot(s[0]-x,s[1]-z)<120))continue;spots.push([x,z,0])}
 TOKS=spots.map((s,i)=>{const m=new T.Mesh(TOKG,TOKM);m.position.set(s[0],s[2]+1.2,s[1]);m.userData.dyn=1;sc.add(m);const got_=got.includes(i);m.visible=!got_;return{i,x:s[0],z:s[1],y:s[2],m,got:got_}})}
function tokensU(dt){const t=performance.now()*.002;for(const k of TOKS){if(k.got)continue;k.m.rotation.y=t*1.5;k.m.position.y=k.y+1.2+Math.sin(t+k.i)*.15;
  if(Math.abs(P.x-k.x)<1.4&&Math.abs(P.z-k.z)<1.4&&Math.abs((P.y||0)-k.y)<2.5&&!P.car){k.got=1;k.m.visible=false;const n=TOKS.filter(q=>q.got).length;cash+=250;snd(980,.12,'sine',.06);setTimeout(()=>snd(1320,.18,'sine',.06),90);
   try{localStorage.setItem('embercity_tokens',JSON.stringify(TOKS.filter(q=>q.got).map(q=>q.i)))}catch(e){}
   if(n==TOKS.length){cash+=10000;msg('ALL '+n+' EMBER TOKENS! +$10,000','#ffd23f')}else msg('EMBER TOKEN '+n+'/'+TOKS.length+'  +$250','#ffc94a')}}}
/* ---------- per frame ---------- */
function placesU(dt){for(const c of DISP)carLod(c);for(const g of GASST)if(g.cd>0)g.cd-=dt;for(const c of CRATES)if(c.cd>0&&(c.cd-=dt)<=0)c.g.visible=true;if(TOWER&&TOWER.cd>0)TOWER.cd-=dt;tokensU(dt)}
function buildPlaces(){beachPlaces();buildTokens();buildCourt();buildPrison()}
