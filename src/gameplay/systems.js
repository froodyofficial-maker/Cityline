/* ================= v4: survival, stores, weapons, day cycle, executions ================= */
const IT={coffee:{n:'COFFEE',s:'cup',f:12,h:5,p:12},burger:{n:'BURGER',s:'burger',f:35,h:10,p:25},ramen:{n:'RAMEN',s:'ramen',f:45,h:15,p:35},medkit:{n:'MEDKIT',s:'medkit',f:0,h:60,p:90},
 watch:{n:'GOLD WATCH',s:'watch',v:180},console:{n:'GAME CONSOLE',s:'console',v:320},perfume:{n:'PERFUME',s:'perfume',v:90},cashbag:{n:'CASH BAG',s:'bag',v:260}};
const WP={pistol:{n:'PISTOL',cd:.22,dmg:1,pel:1,spr:.02,rng:45,price:0,pk:30,pp:60,len:1,col:0x222222},shotgun:{n:'SHOTGUN',cd:.85,dmg:1,pel:8,spr:.16,rng:20,price:700,pk:8,pp:80,len:2.2,col:0x5a3a22},
 smg:{n:'SMG',cd:.075,dmg:1,pel:1,spr:.07,rng:38,price:1100,pk:60,pp:120,len:1.5,col:0x333a44},sniper:{n:'SNIPER',cd:1.25,dmg:3,pel:1,spr:0,rng:150,price:2800,pk:5,pp:150,len:3,col:0x1d2a1d}};
const WK2=Object.keys(WP),GOODS={cafe:['coffee','coffee','coffee','coffee','burger','burger','cashbag'],burger:['burger','burger','burger','burger','coffee','coffee','medkit'],noodle:['ramen','ramen','ramen','ramen','coffee','perfume'],
 guns:['gw_shotgun','gw_smg','gw_sniper','am_pistol','am_pistol','am_shotgun','am_smg','am_sniper','watch'],mart:['medkit','medkit','burger','ramen','am_pistol','am_pistol','am_shotgun','watch','watch','console','perfume','perfume','cashbag']},
 MENU={cafe:['coffee','burger'],burger:['burger','coffee'],noodle:['ramen','coffee'],mart:['medkit','burger','ramen'],guns:[]};
let own={pistol:1},ammo={pistol:60,shotgun:0,smg:0,sniper:0},cw='pistol',inv={},hunger=100,day=1,eodReq=0,copsOff=0,hurt=0,dmgBy='',dmgT=0,scoped=0,dispCash=500,lastCash=500,casStart=0,pend=[],stash=[],lastHot='',execd=0,fridge=0,pcTab='food',curShop=null,HOME=null;
const newDS=()=>({earn:0,spend:0,kills:0,cops:0,heists:0,stores:0,items:0,shots:0,cas:0,maxStars:0,eaten:0,orders:0,bombs:0});let dS=newDS();
const STORES=[],items=[],clerks=[];
const iname=t=>IT[t]?IT[t].n:t.startsWith('am_')?WP[t.slice(3)].n+' AMMO':WP[t.slice(3)].n;
const addInv=(id,n)=>inv[id]=(inv[id]||0)+n;
function msg(t,c){const f=$('feed'),d=document.createElement('div');d.className='nt';d.textContent=t;if(c)d.style.borderLeftColor=c;f.prepend(d);setTimeout(()=>d.classList.add('out'),3200);setTimeout(()=>d.remove(),3700);while(f.children.length>5)f.lastChild.remove()}
function hit(by){dmgBy=by;dmgT=performance.now();hurt=1}
function setW(id){if(!own[id])return;cw=id;const w=WP[id];P.g.gm.scale.z=w.len;P.g.gm.material=mat(w.col);snd(500,.05);lastHot=''}
function copsOffChk(){if(!copsOff&&CFG.copLimit<=50&&dS.cops>=CFG.copLimit){copsOff=1;for(const c of cops)sc.remove(c.g);cops.length=0;heat=0;msg('POLICE FORCE WIPED OUT - NO MORE COPS TODAY','#2bf0ff');snd(80,1,'sawtooth',.1)}}
function kill(e,dx,dz,big,byP){if(e.isVeh){if(!e.dead){e.dead=1;e.hp=0;e.onDie&&e.onDie()}return}if(e.dead)return;e.dead=1;e.dt=0;e.g.rotation.x=-PI/2;e.g.position.y=.18;gore(e,dx,dz,big);scare(e.x,e.z,18);
 if(e.enm){if(e.onDie)e.onDie();if(byP)ST.kills=(ST.kills||0)+1;if(!e.isVeh&&ST.act&&!e.noLoot)lootDrop(e.x,e.z)}else if(e.sol){if(byP&&e.team==1)WAR.pk++;if(e.tank&&!e.boom){e.boom=1;setTimeout(()=>explode(e.x,0,e.z),60)}}else if(byP){if(e.cop){dS.cops++;heat+=1.3;copsOffChk()}else{dS.kills++;kills++;heat+=e.clerk?1.2:.7;const m=Math.round(rr(10,90));cash+=m;msg('+$'+m,'#ffd23f');if(e.clerk)msg('CLERK DOWN','#ff6a6a')}}}
function mkCop(d){const e={g:person('#e0ac69','#1d3b8a','#14234a','#111',1),hp:3,dead:0,cop:1,cd:rr(.5,1.5),dt:0,ph:0,ms:'search',srch:22,sx:P.x+rr(-18,18),sz:P.z+rr(-18,18),lx:P.x,lz:P.z};const a=rr(0,6.28);d=d||42;e.x=P.x+sin(a)*d;e.z=P.z+cos(a)*d;push(e,2);cops.push(e)}
function shoot(){const w=WP[cw];if(shT>0)return;
 if(ammo[cw]<=0){shT=.3;snd(90,.05,'square',.03);if(!P.noAm){P.noAm=1;msg('OUT OF AMMO - switch weapon or buy more','#ff6a6a');setTimeout(()=>P.noAm=0,2500)}return}
 if(!CFG.infAmmo)ammo[cw]--;shT=w.cd;dS.shots++;lastHot='';snd(w.pel>1?140:cw=='sniper'?90:320,.12,'sawtooth',.07);if(w.pel>1||cw=='sniper')shake=Math.max(shake,.4);
 const all=peds.concat(cops,clerks,SOL.filter(e=>e.team==1),ENM).filter(e=>!e.dead&&(!e.st||e.st===IN)&&!(e.inside&&!IN)&&!(IN&&e.enm&&!e.inside));let ax=sin(P.h),az=cos(P.h);
 if(!(zoom<.1||scoped)){let bd=Math.min(w.rng,30),bt=null;for(const e of all){const dx=e.x-P.x,dz=e.z-P.z,l=Math.hypot(dx,dz);if((dx*ax+dz*az)/l>.8&&l<bd){bd=l;bt=e}}if(bt){ax=(bt.x-P.x)/bd;az=(bt.z-P.z)/bd;P.h=Math.atan2(ax,az)}}
 for(let i=0;i<w.pel;i++){const a=Math.atan2(ax,az)+(R()-.5)*2*w.spr,qx=sin(a),qz=cos(a);let h=null,hd=w.rng;
  for(const e of all){const dx=e.x-P.x,dz=e.z-P.z,pr=dx*qx+dz*qz;if(pr>0&&pr<hd&&Math.abs(dx*qz-dz*qx)<(e.rad||.8)){hd=pr;h=e}}
  const mh=mpRay(qx,qz,hd);if(mh){hd=mh.d;h=null;mpDmg(mh.r)}if(i<3)tracer(P.x+qx*.6,P.z+qz*.6,P.x+qx*hd,P.z+qz*hd,cw=='sniper'?0xffffff:0xffe066,(P.y||0)+1.3);if(i==0)mpShot(P.x+qx*.6,P.z+qz*.6,P.x+qx*hd,P.z+qz*hd,(P.y||0)+1.3);
  if(h){h.hp-=w.dmg*(h.isVeh?2:1);if(h.hp<=0)kill(h,qx,qz,w.pel>1&&hd<9||w.dmg>=3||R()<.2,1);else{part(h.x,1,h.z,qx*3,3,qz*3,.12,BL[1],5);if(h.cop)heat+=.02}}}
 scare(P.x,P.z,cw=='sniper'?15:26);heat=Math.max(heat,.15)}
/* ---- interiors ---- */
const cyg=(g,r,h,c,x,y,z)=>{const m=new T.Mesh(new T.CylinderGeometry(r,r,h,10),mat(c));m.position.set(x,y,z);g.add(m)};
function itemMesh(t){const g=new T.Group();
 if(t=='coffee'){cyg(g,.13,.3,0x7a4a2a,0,.15,0);cyg(g,.14,.05,0xffffff,0,.32,0)}
 else if(t=='burger'){bx(.4,.1,.4,0xe8a050,0,.05,0,g);bx(.42,.06,.42,0x3ec24a,0,.13,0,g);bx(.4,.08,.4,0x6a3a1a,0,.2,0,g);bx(.4,.1,.4,0xe8a050,0,.29,0,g)}
 else if(t=='ramen'){cyg(g,.24,.2,0xffffff,0,.1,0);cyg(g,.21,.04,0xff8a2b,0,.21,0)}
 else if(t=='medkit'){bx(.45,.3,.3,0xffffff,0,.15,0,g);bx(.2,.06,.31,0xe8222c,0,.15,0,g);bx(.06,.2,.31,0xe8222c,0,.15,0,g)}
 else if(t=='watch'){bx(.2,.06,.3,0xffd23f,0,.03,0,g);bx(.22,.07,.2,0x2bf0ff,0,.07,0,g)}
 else if(t=='console'){bx(.5,.12,.36,0x222233,0,.06,0,g);nb(.4,.02,.04,0x2bf0ff,0,.13,.12,g)}
 else if(t=='perfume'){bx(.2,.3,.14,0x2b8fff,0,.15,0,g);bx(.08,.08,.08,0xffd23f,0,.34,0,g)}
 else if(t=='cashbag'){bx(.4,.28,.3,0x3ec24a,0,.14,0,g);bx(.12,.12,.31,0xffd23f,0,.14,0,g)}
 else if(t.startsWith('am_')){bx(.34,.2,.24,0xff8a2b,0,.1,0,g);bx(.3,.06,.26,0x3ec24a,0,.2,0,g)}
 else{const w=WP[t.slice(3)];bx(.12,.14,.5+w.len*.3,w.col,0,.1,0,g);bx(.1,.22,.28,0x3a2a1a,0,.1,-.3-w.len*.12,g)}
 return g}
function mkStore(o,i){const ox=335+i*35,oz=300,nh=o.nh,k=o.kind,st={name:o.name,kind:k,ox,oz,ret:{x:o.x,z:o.z+1.5},cash:Math.round(rr(250,700)),menu:MENU[k],alarm:0,counted:0};
 const wc=ri([0xe8e0d4,0xd8e4ea,0xeadcc8]),iw2=(x,z,w,d)=>{bx(w,3.5,d,wc,ox+x,1.75,oz+z,sc);IB.push({x1:ox+x-w/2,x2:ox+x+w/2,z1:oz+z-d/2,z2:oz+z+d/2})};
 const fl2=(x,z,w,d,c,y)=>{const f=new T.Mesh(new T.PlaneGeometry(w,d),mat(c));f.rotation.x=-PI/2;f.position.set(ox+x,y,oz+z);f.receiveShadow=true;sc.add(f)};
 fl2(0,0,16,12,k=='guns'?0x2a2a30:0xd8d2c4,.02);fl2(0,2,5,8,0x8a8478,.03);iw2(0,-6,16.4,.4);iw2(-8,0,.4,12);iw2(8,0,.4,12);iw2(-4.75,6,6.5,.4);iw2(4.75,6,6.5,.4);IB.push({x1:ox-8,x2:ox+8,z1:oz+6.6,z2:oz+7});
 const slots=[],shelf=(x,z,w,d,n,al)=>{bx(w,1.3,d,0x6a5a4a,ox+x,.65,oz+z,sc);bx(w+.1,.12,d+.1,nh,ox+x,1.34,oz+z,sc);IB.push({x1:ox+x-w/2,x2:ox+x+w/2,z1:oz+z-d/2,z2:oz+z+d/2});for(let j=0;j<n;j++){const q=(j+.5)/n-.5;slots.push([x+(al=='z'?0:q*w),z+(al=='z'?q*d:0)])}};
 shelf(-7,-.5,1.2,8,6,'z');shelf(7,1.5,1.2,5,4,'z');shelf(-3,.5,1.2,5,4,'z');shelf(3,.5,1.2,5,4,'z');shelf(-4.2,-5.2,5,.9,4,'x');
 const gd=GOODS[k];slots.forEach((p,j)=>{const t=gd[j%gd.length],m=itemMesh(t);m.position.set(ox+p[0],1.4,oz+p[1]);m.rotation.y=R()*6;sc.add(m);items.push({t,m,x:ox+p[0],z:oz+p[1],taken:0,st})});
 bx(6,1,1,0x333340,ox+4,.5,oz-3.8,sc);IB.push({x1:ox+1,x2:ox+7,z1:oz-4.3,z2:oz-3.3});bx(.7,.4,.5,0x555566,ox+2.5,1.2,oz-3.8,sc);nb(.5,.25,.05,0x43ff7a,ox+2.5,1.3,oz-3.55);
 const cg=person('#e0ac69','#'+nh.toString(16).padStart(6,'0'),'#333','#222',0);cg.position.set(ox+4,0,oz-5);clerks.push({g:cg,x:ox+4,z:oz-5,hp:2,dead:0,clerk:1,st,dt:0});
 nsign(o.name,o.nc,ox,2.5,oz-5.75,6);nb(14,.1,.1,nh,ox,3.3,oz-5.7);const l=new T.PointLight(0xffffff,.9,20);l.position.set(ox,3.1,oz);sc.add(l);
 st.exit=marker(ox,oz+4.8,0x2bf0ff);st.buy=marker(ox+5.5,oz-2.6,nh);st.reg={x:ox+2.2,z:oz-2.6};STORES.push(st);return st}
shops.forEach((o,i)=>o.st=mkStore(o,i));
/* apartment extras: PC desk, fridge, frames */
fu(-1.2,-8.2,2.6,.8,1.2,0x4a3a2a);bx(.9,.55,.1,0x111118,OX-1.2,1.35,OZ-8.45,sc);nb(.75,.4,.05,0x2bf0ff,OX-1.2,1.35,OZ-8.38);
const pcM=marker(OX-1.2,OZ-6.2,0x2bf0ff),fridgeM=marker(OX+10.4,OZ-6.6,0xdddddd);for(const[x,c]of[[3.2,0xff2bd6],[5.4,0x2bf0ff],[7.6,0xffd23f]])bx(1.2,.9,.06,c,OX+x,2.1,OZ-8.7,sc);
function nearItem(){let b=null,bd=1.9;for(const o of items)if(!o.taken&&o.st===IN){const d=Math.hypot(o.x-P.x,o.z-P.z);if(d<bd){bd=d;b=o}}return b}
function takeItem(o){o.taken=1;o.m.visible=false;const t=o.t;
 if(t.startsWith('am_')){const k=t.slice(3);ammo[k]+=WP[k].pk;msg('+'+WP[k].pk+' '+WP[k].n+' AMMO','#43ff7a')}else if(t.startsWith('gw_')){const k=t.slice(3);own[k]=1;ammo[k]+=WP[k].pk;msg(WP[k].n+' STOLEN','#43ff7a');setW(k)}else{addInv(t,1);msg(IT[t].n+' TAKEN (I = inventory)','#43ff7a')}
 dS.items++;snd(600,.08);lastHot='';const st=IN;if(st&&!st.alarm&&clerks.some(c=>c.st===st&&!c.dead)){st.alarm=1;heat=Math.max(heat,1.3);if(!st.counted){st.counted=1;dS.stores++}msg('SHOPLIFTER! CLERK HIT THE ALARM','#ff6a6a')}}
function robReg(){const st=IN;if(st.cash<=0)return msg('Register is empty');const cl=clerks.find(c=>c.st===st&&!c.dead);cash+=st.cash;msg('REGISTER: +$'+st.cash,'#ffd23f');st.cash=0;if(!st.counted){st.counted=1;dS.stores++}
 if(cl){cl.g.a[0].rotation.x=cl.g.a[1].rotation.x=-2.8;msg('"TAKE IT! DO NOT SHOOT!"')}heat=Math.max(heat,st.kind=='casino'?3.6:2.4);st.alarm=1;snd(900,.2);shake=.3}
function enterStore(st){IN=st;P.x=st.ox;P.z=st.oz+4.8;P.h=PI;camYaw=PI;cam.position.set(st.ox,5,st.oz+9);msg('Entered '+st.name+' - steal or shop','#2bf0ff')}
function enterApt(){if(heat>=1)return msg('Cops are on you - lose them first!','#ff6a6a');HOME=HOME||{home:1,ret:{x:apt.x,z:apt.z+1.5},exit:aexit};IN=HOME;P.x=OX;P.z=OZ+7;P.h=PI;camYaw=PI;cam.position.set(OX,5,OZ+8);msg('Home sweet home');while(stash.length)deliver(stash.pop())}
function leaveInt(){const r=IN.ret;IN=0;P.x=r.x;P.z=r.z;P.h=0;camYaw=0;cam.position.set(P.x,5,P.z-8);if(heat>=1){for(const c of cops){c.x=r.x+rr(-18,18);c.z=r.z+rr(12,24);push(c,2)}for(let i=0;i<2;i++)mkCop(14)}}
function sleep(){endDay('sleep')}
/* ---- food / orders / inventory ---- */
function deliver(o){if(IN&&IN.home){applyO(o);msg('DELIVERY ARRIVED','#2bf0ff')}else{stash.push(o);msg('Delivery waiting at your apartment','#2bf0ff')}}
function applyO(o){if(o.k=='item')addInv(o.id,o.n);else ammo[o.id]+=o.n;lastHot=''}
function useItem(id){const t=IT[id];if(!inv[id]||!t||t.v)return;inv[id]--;hunger=Math.min(100,hunger+t.f);P.hp=Math.min(100,P.hp+t.h);if(t.f)dS.eaten++;snd(450,.1,'sine');msg(t.n+': HUNGER +'+t.f+' HP +'+t.h,'#43ff7a')}
const row=(s,name,sub,btn,a)=>'<div class="ln">'+si(s,32)+'<span>'+name+'<small>'+sub+'</small></span>'+(btn?'<button data-a="'+a+'">'+btn+'</button>':'')+'</div>';
function openMd(h){document.exitPointerLock&&document.exitPointerLock();mode='cas';for(const k in K)K[k]=0;$('mdp').innerHTML=h;$('md').style.display='flex'}
function invPanel(){const ids=Object.keys(inv).filter(k=>inv[k]>0);let h='<h2>INVENTORY</h2><div class="stat">HUNGER '+Math.round(hunger)+'% / HP '+Math.round(P.hp)+'%</div>';
 h+=ids.length?ids.map(k=>{const t=IT[k];return row(t.s,t.n+' x'+inv[k],t.v?'LOOT - SELL ONLINE FOR $'+t.v:'HUNGER +'+t.f+' / HP +'+t.h,t.v?'':'USE','use:'+k)}).join(''):'<div class="ln">Empty. Rob a store or order online.</div>';
 h+='<h2>WEAPONS</h2>'+WK2.map(k=>own[k]?row(k,WP[k].n,'AMMO '+ammo[k],k==cw?'EQUIPPED':'EQUIP','eq:'+k):'').join('')+'<button data-a="close">CLOSE (I)</button>';openMd(h)}
function shopPanel(st){curShop=st;let h='<h2>'+st.name+'</h2><div class="stat">CASH $'+cash+'</div>';
 if(st.kind=='guns')for(const k of WK2.slice(1))h+=row(k,WP[k].n+(own[k]?' (OWNED)':''),'$'+WP[k].price,own[k]?'':'BUY','bw:'+k)+(own[k]?row('ammo',WP[k].n+' AMMO x'+WP[k].pk,'$'+WP[k].pp,'BUY','ba:'+k):'');
 else for(const id of st.menu)h+=row(IT[id].s,IT[id].n,'$'+IT[id].p,'BUY','bi:'+id);
 if(st.kind=='mart')for(const k of['pistol','shotgun'])h+=row('ammo',WP[k].n+' AMMO x'+WP[k].pk,'$'+WP[k].pp,'BUY','ba:'+k);
 openMd(h+'<button data-a="close">LEAVE</button>')}
function pcPanel(){let h='<h2>EMBERNET ORDERS</h2><div class="stat">CASH $'+cash+' / INSTANT DELIVERY TO YOUR DOORSTEP</div><div><button data-a="tab:food">FOOD</button><button data-a="tab:ammo">AMMO</button><button data-a="tab:sell">SELL LOOT</button></div>';
 if(pcTab=='food')for(const id of['coffee','burger','ramen','medkit'])h+='<div class="ln">'+si(IT[id].s,32)+'<span>'+IT[id].n+'<small>$'+(IT[id].p+5)+' incl. delivery</small></span><button data-a="od:'+id+'">ORDER</button><button data-a="oe:'+id+'">EAT NOW</button></div>';
 else if(pcTab=='ammo')for(const k of WK2)h+=own[k]?row('ammo',WP[k].n+' AMMO x'+WP[k].pk,'$'+(WP[k].pp+5),'ORDER','oa:'+k):'';
 else{const ids=Object.keys(inv).filter(k=>inv[k]>0&&IT[k].v);h+=ids.length?ids.map(k=>row(IT[k].s,IT[k].n+' x'+inv[k],'$'+IT[k].v+' each','SELL','sell:'+k)).join(''):'<div class="ln">No loot to sell. Steal from stores.</div>'}
 openMd(h+'<button data-a="close">CLOSE</button>')}
function doAct(a){const[k,id]=a.split(':'),no=()=>msg('Not enough cash','#ff6a6a');
 if(k=='close')closeCas();else if(k=='use'){useItem(id);invPanel()}else if(k=='eq'){setW(id);invPanel()}
 else if(k=='bw'){const w=WP[id];if(cash<w.price)return no();cash-=w.price;own[id]=1;ammo[id]+=w.pk;msg(w.n+' ACQUIRED','#43ff7a');snd(700,.1);setW(id);shopPanel(curShop)}
 else if(k=='ba'){const w=WP[id];if(cash<w.pp)return no();cash-=w.pp;ammo[id]+=w.pk;lastHot='';msg('+'+w.pk+' '+w.n+' AMMO');shopPanel(curShop)}
 else if(k=='bi'){const t=IT[id];if(cash<t.p)return no();cash-=t.p;addInv(id,1);msg(t.n+' BOUGHT (I = inventory)');shopPanel(curShop)}
 else if(k=='tab'){pcTab=id;pcPanel()}
 else if(k=='od'){const t=IT[id];if(cash<t.p+5)return no();cash-=t.p+5;addInv(id,1);dS.orders++;doorstep();msg(t.n+' DELIVERED TO YOUR DOORSTEP - ready to eat (I)','#2bf0ff');pcPanel()}
 else if(k=='oe'){const t=IT[id];if(cash<t.p+5)return no();cash-=t.p+5;dS.orders++;addInv(id,1);doorstep();useItem(id);pcPanel()}
 else if(k=='oa'){const w=WP[id];if(cash<w.pp+5)return no();cash-=w.pp+5;ammo[id]+=w.pk;lastHot='';doorstep();msg(w.n+' AMMO DELIVERED TO YOUR DOORSTEP','#2bf0ff');pcPanel()}
 else if(k=='sell'){if(!inv[id])return;inv[id]--;cash+=IT[id].v;msg('SOLD '+IT[id].n+' +$'+IT[id].v,'#ffd23f');pcPanel()}}
$('md').onclick=e=>{const b=e.target.closest('[data-a]');if(b)doAct(b.dataset.a)};
function openCas(){document.exitPointerLock&&document.exitPointerLock();mode='cas';casStart=cash;cb();$('cas').style.display='flex';for(const k in K)K[k]=0}
function closeCas(){gRefund();if($('cas').style.display=='flex'||casOpen){dS.cas+=cash-casStart;lastCash=cash;casOpen=0}mode='play';$('cas').style.display='none';$('md').style.display='none';reLock()}$('lv').onclick=closeCas;
function xKey(e){if(e.code=='Space'&&!e.repeat)K.spDown=1;if(e.code=='KeyX'&&!P.car&&!P.heli&&!P.plane&&!P.tank&&!P.hide){P.crouch=!P.crouch;msg(P.crouch?'CROUCHING - harder to spot':'STANDING','#37e6ff')}if(e.code=='KeyY'&&MP.on){chatOpen();return}if(e.code=='KeyG'){toggleEmoWheel();return}if(emoOpen&&/^Digit[1-8]$/.test(e.code)){startEmote(+e.code[5]);return}
 if(e.code=='BracketLeft'||e.code=='BracketRight'){CFG.sens=Math.max(.2,Math.min(3,+(CFG.sens+(e.code=='BracketRight'?.1:-.1)).toFixed(1)));msg('MOUSE SENSITIVITY '+CFG.sens.toFixed(1)+'X','#2bf0ff');saveCfg()}
 if(e.code=='Minus'||e.code=='Equal'){CFG.scopeSens=Math.max(.1,Math.min(1.5,+(CFG.scopeSens+(e.code=='Equal'?.05:-.05)).toFixed(2)));msg('SCOPE SENSITIVITY '+CFG.scopeSens.toFixed(2)+'X','#2bf0ff');saveCfg()}
if(e.code.startsWith('Digit')){const i=+e.code[5]-1;if(WK2[i])setW(WK2[i])}if(e.code=='KeyI')invPanel();if(e.code=='KeyR')act('r');if(e.code=='Tab')e.preventDefault()}
function xKeyModal(e){if(e.code=='Escape'&&mode=='cas')closeCas();else if(e.code=='KeyI'&&$('md').style.display=='flex')closeCas();else if(mode=='eod'&&e.code=='Enter'&&$('eodgo'))$('eodgo').click()}
/* ---- interaction ---- */
function act(k){if(P.dead||mode!='play'||cut)return;if(storyAct(k))return;if(P.hide){if(k=='e')exitDump();return}
 if(k=='f'){if(P.tank)exitTank();else if(P.plane)exitPlane();else if(P.heli)exitHeli();else if(P.car){const c=P.car;P.x=c.x+cos(c.h)*2.4;P.z=c.z-sin(c.h)*2.4;P.car=null;P.g.visible=true;c.v*=.5}else if(!IN){const pl=nearPlane(),hl=nearHeli(),tk=nearTank();if(tk)enterTank(tk);else if(pl)enterPlane(pl);else if(hl)enterHeli(hl);else if(!P.roof){const c=nearCar();if(c){if(c.ai)heat+=.6;c.ai=0;c.v=0;P.car=c;P.g.visible=false}}}return}
 if(P.car||P.heli||P.plane||P.tank)return;if(P.roof){if(k=='e'&&dist(P,P.roof.ex)<3)climb(P.roof,0);return}if(k=='r'){if(IN&&IN.reg&&dist(P,IN.reg)<3)robReg();return}if(k!='e')return;
 if(IN){const o=nearItem();if(o)return takeItem(o);if(dist(P,IN.exit)<3.5)return leaveInt();const gm_=IN.games&&IN.games.find(g=>dist(P,g)<2.6);if(gm_)return openGame(gm_);
  if(IN.home){if(dist(P,bed)<3.5)sleep();else if(dist(P,pcM)<3.2)pcPanel();else if(dist(P,fridgeM)<3.2){if(fridge)msg('Fridge is empty today');else{fridge=1;hunger=Math.min(100,hunger+25);msg('Leftovers. HUNGER +25','#43ff7a')}}}
  else if(dist(P,IN.buy)<3.2)shopPanel(IN);return}
 {const gi=nearItem();if(gi)return takeItem(gi)}
 {const dp=nearDump();if(dp)return enterDump(dp)}
 {const lad=ladders.find(l=>dist(P,l)<2.8);if(lad)return climb(lad,1)}
 if(dist(P,bank)<3.5&&bank.cd<=0)robBank();else if(dist(P,casino)<3.5)enterCasino();else if(dist(P,apt)<3.5)enterApt();else{const o=shops.find(o=>dist(P,o)<3.5);if(o)enterStore(o.st)}}
function ptxt(){{const s_=storyPrompt();if(s_)return s_}if(P.hide)return'E - Leave dumpster'+(evading?' (cops are searching)':'');if(P.car)return'F - exit car';if(P.tank)return'WASD drive - LMB fire shell - F exit tank';if(P.plane)return planePrompt();if(P.heli)return P.y-groundH(P.x,P.z)>2.5?'LMB / B - DROP BOMB   SPACE UP - SHIFT DOWN':'F - Exit helicopter';if(!IN&&nearDump())return'E - Hide in dumpster';if(!IN&&nearTank())return'F - Drive allied tank';if(!IN&&nearHeli())return'F - Fly helicopter';if(!IN&&nearPlane())return'F - Board airplane';if(P.roof)return dist(P,P.roof.ex)<3?'E - Climb down':performance.now()-P.roofT<7000?(own.sniper?'ROOFTOP: hold RMB to scope, snipe away':'ROOFTOP: buy a sniper at the gun shop'):'';
 if(IN){const o=nearItem();if(o)return'E - TAKE '+iname(o.t)+' (STEAL)';if(dist(P,IN.exit)<3.5)return'E - Leave';{const g_=IN.games&&IN.games.find(g=>dist(P,g)<2.6);if(g_)return'E - Play '+g_.name}
  if(IN.home)return dist(P,bed)<3.5?'E - Sleep (ends the day)':dist(P,pcM)<3.2?'E - Order online (food / ammo / sell)':dist(P,fridgeM)<3.2?'E - Raid fridge':'';
  if(dist(P,IN.reg)<3)return'R - ROB REGISTER'+(IN.cash>0?' ($'+IN.cash+')':' (empty)');return dist(P,IN.buy)<3.2?'E - Shop':''}
 {const gi=nearItem();if(gi)return'E - TAKE '+iname(gi.t)+' (STEAL)'}if(ladders.find(l=>dist(P,l)<2.8))return'E - Climb to rooftop (sniper nest)';if(dist(P,bank)<3.5)return bank.cd>0?'Bank locked down ('+Math.ceil(bank.cd)+'s)':'E - ROB THE BANK';if(dist(P,casino)<3.5)return'E - Enter casino';if(dist(P,apt)<3.5)return'E - Enter your apartment';
 const o=shops.find(o=>dist(P,o)<3.5);return o?'E - Enter '+o.name:nearCar()?'F - enter car':''}
/* ---- per-frame systems ---- */
function xUpdate(dt){const live=!cut&&!P.dead;storyU(dt);storyWorldU();bpUpdate(dt);heliU(dt);bombU(dt);planeU(dt);tankU(dt);emoBub();mpU(dt);weatherU(dt);worldU(dt);cfgU(dt);warU(dt);
 if(live&&CFG.hunger){hunger=Math.max(0,hunger-dt*100/420);if(hunger<=0){P.hp-=dt*1.5;if(!P.sr||performance.now()-P.sr>4000){P.sr=performance.now();msg('STARVING - order food from your PC at home','#ffb02b');hit('hunger')}}else if(hunger<20&&!P.hw){P.hw=1;msg('You are getting hungry','#ffb02b');setTimeout(()=>P.hw=0,30000)}}
 for(let i=pend.length-1;i>=0;i--){pend[i].t-=dt;if(pend[i].t<=0)deliver(pend.splice(i,1)[0])}
 if(eodReq&&live){if(CFG.mode==1||ST.on)eodReq=0;else endDay(eodReq)}
 const dc=cash-lastCash;lastCash=cash;if(dc>0)dS.earn+=dc;else dS.spend-=dc;dS.maxStars=Math.max(dS.maxStars,Math.min(5,Math.floor(heat)));if(copsOff)heat=0;
 scoped=cw=='sniper'&&K.R&&live&&!P.car&&!P.heli&&!P.plane&&!IN?1:0;const tf=scoped?18:(CIN&&cut)?CIN.fov:60;if(Math.abs(cam.fov-tf)>.3){cam.fov+=(tf-cam.fov)*Math.min(1,dt*10);cam.updateProjectionMatrix()}
 $('scope').style.opacity=scoped?1:0;$('xh').style.opacity=((zoom<.1||scoped)&&!P.car&&live)?1:0;
 $('lk').style.display=(!locked()&&!lockFail&&live)?'block':'none';hurt=Math.max(0,hurt-dt*1.6);$('hurt').style.opacity=Math.min(1,hurt*.8+(P.hp<30&&live?.25+.2*sin(performance.now()/180):0))}
function hudU(dt,stars){hudX();$('stars').classList.toggle('blink',!!evading);dispCash+=(cash-dispCash)*Math.min(1,dt*8);txt('cash',Math.round(dispCash));txt('k',kills);txt('cpk',dS.cops);txt('dy','DAY '+day+' ');
 $('hpb').style.width=Math.max(0,P.hp)+'%';$('hpb').style.setProperty('--c',P.hp<30?'#ff3b3b':'#4ade80');$('hgb').style.width=hunger+'%';$('hgb').style.setProperty('--c',hunger<20?'#ff3b3b':'#ffb02b');
 if(stars!==lastS){lastS=stars;$('stars').innerHTML=[0,1,2,3,4].map(i=>si(i<stars?'star':'star0',24)).join('')}
 const hk=cw+'|'+WK2.map(k=>own[k]?ammo[k]:'-').join(',');if(hk!==lastHot){lastHot=hk;$('hot').innerHTML=WK2.map((k,i)=>'<div class="sl'+(k==cw?' on':'')+(own[k]?'':' off')+'">'+si(k,32)+'<b>'+(i+1)+'</b><u>'+(own[k]?ammo[k]:'--')+'</u></div>').join('')}}
/* ---- end of day ---- */
function endDay(why){eodReq=0;if(mode!='play')return;mode='eod';document.exitPointerLock&&document.exitPointerLock();for(const k in K)K[k]=0;
 const s=dS,net=s.earn-s.spend,sco=Math.max(0,net/80+s.kills*3+s.cops*8+s.heists*80+s.stores*25+s.items*2),g=sco>300?'S':sco>180?'A':sco>90?'B':sco>30?'C':'D';
 const rw=[['CASH EARNED',s.earn,'$',''],['CASH SPENT',s.spend,'-$',''],['CASINO NET',s.cas,'$',''],['CIVILIANS KILLED',s.kills,'',''],['COPS KILLED',s.cops,'','/'+(CFG.copLimit>50?'INF':CFG.copLimit)],['BANK HEISTS',s.heists,'',''],['STORES ROBBED',s.stores,'',''],['ITEMS STOLEN',s.items,'',''],['SHOTS FIRED',s.shots,'',''],['MEALS EATEN',s.eaten,'',''],['BOMBS DROPPED',s.bombs,'',''],['PEAK WANTED',s.maxStars,'','/5'],['NET PROFIT',net,'$','']];
 let h='<h2>'+(why=='sleep'?'YOU SLEPT. ':'MIDNIGHT. ')+'DAY '+day+' COMPLETE</h2>';
 rw.forEach((r,i)=>{const d=.4+i*.28;h+='<div class="er'+(i==rw.length-1?' big':'')+'" style="animation-delay:'+d+'s"><span>'+r[0]+'</span><b data-v="'+r[1]+'" data-p="'+r[2]+'" data-s="'+r[3]+'" data-d="'+d+'">0</b></div>'});
 const t0=.4+rw.length*.28;h+='<div class="er" style="animation-delay:'+t0+'s"><span>RENT DUE</span><b>-$'+(CFG.rent?100:0)+'</b></div><div class="er" style="animation-delay:'+(t0+.3)+'s"><span>TOMORROW</span><b>COPS RESTOCKED</b></div><div class="stamp" style="animation-delay:'+(t0+.8)+'s">'+g+'</div><button id="eodgo" style="animation-delay:'+(t0+1.2)+'s">CONTINUE &gt;</button>';
 $('eodp').innerHTML=h;$('eod').style.display='flex';snd(200,.4,'sine',.06);
 $('eodp').querySelectorAll('b[data-v]').forEach(b=>{const v=+b.dataset.v,p=b.dataset.p,sf=b.dataset.s;setTimeout(()=>{const t=performance.now();(function f(){const q=Math.min(1,(performance.now()-t)/600);b.textContent=(v<0?'-':'')+p+Math.abs(Math.round(v*q))+sf;if(q<1)requestAnimationFrame(f);else snd(500,.05,'square',.03)})()},b.dataset.d*1000+250)});
 $('eodgo').onclick=()=>contDay(why)}
function contDay(why){$('eod').style.display='none';day++;cash=Math.max(0,cash-(CFG.rent?100:0));lastCash=cash;dS=newDS();copsOff=CFG.mode==1?1:0;fridge=0;for(const st of STORES){st.cash=st.kind=='casino'?Math.round(rr(5000,9000)):Math.round(rr(250,700));st.alarm=0;st.counted=0}
 for(const o of items){o.taken=0;o.m.visible=true}for(const c of clerks){if(c.dead){c.dead=0;c.hp=2;c.g.rotation.x=0;c.g.position.y=0;c.g.hd.forEach(h=>h.visible=true)}c.g.a.forEach(a=>a.rotation.x=0)}bank.cd=0;
 if(why=='sleep'){tod=.27;P.hp=100;heat=0;hunger=Math.max(hunger-10,40)}msg('DAY '+day+' BEGINS - POLICE BACK AT FULL STRENGTH','#2bf0ff');mode='play';reLock()}
/* ---- death, execution ---- */
function wasted(){dropRoof();if(dmgBy=='player')mpKilled();if(CFG.exec&&dmgBy=='cop'&&performance.now()-dmgT<5000)return execute();P.dead=1;const px=(P.car||P).x,pz=(P.car||P).z;if(!P.car)P.g.rotation.x=-PI/2,P.g.position.y=.18;if(P.car)P.car=null;
 cutscene(5,p=>{const a=p*2;cam.position.set(px+sin(a)*7,3+p*6,pz+cos(a)*7);cam.lookAt(px,0,pz)},[[.4,'WASTED']],respawn)}
function respawn(){if(CFG.perma){gameOver();return}tScale=1;P.dead=0;P.hp=100;hunger=Math.max(hunger,40);P.x=CFG.mode?0:4;P.z=CFG.mode?92:14;IN=0;P.roof=null;P.heli=null;P.plane=null;P.tank=null;P.hide=null;P.crouch=0;P.y=0;P.car=null;P.g.rotation.set(0,0,0);P.g.position.y=0;P.g.visible=true;P.g.a.forEach(a=>a.rotation.x=0);heat=0;for(const c of cops)sc.remove(c.g);cops.length=0;
 if(execd){cash=Math.floor(cash*.5);inv={};own={pistol:1};ammo={pistol:30,shotgun:0,smg:0,sniper:0};setW('pistol');msg('EXECUTED - lost half your cash, loot and guns','#ff3b3b')}else{cash=Math.floor(cash*.9);msg('Hospital bill: -10% cash')}
 execd=0;dmgBy='';$('sir').style.opacity=0;$('fx').style.opacity=0;lastHot='';storyDeath()}
function execute(){dropRoof();P.dead=1;execd=1;const px=P.x,pz=P.z;if(P.car){P.car.v=0;P.car=null}P.g.visible=true;P.g.position.set(px,0,pz);P.g.rotation.set(0,0,0);P.g.a[0].rotation.x=P.g.a[1].rotation.x=-2.9;P.g.l[0].rotation.x=P.g.l[1].rotation.x=0;
 (R()<.5?squad:nuke)(px,pz,$('fx'))}
function volley(px,pz,fx,n){shake=1.3;snd(70,.5,'sawtooth',.2);for(let k=0;k<5;k++)tracer(px+(k-2)*1.6,pz+8,px,pz,0xffe066);for(let k=0;k<n;k++)gore(P,(R()-.5)*.6,-1,true);
 for(let i=0;i<6;i++)splat(px+rr(-2,2),pz+rr(-2,2),rr(1,2.2));P.g.visible=false;bodyParts(px,pz,n*3,10,1.2);bloodBurst(px,pz,80);hurt=1;fx.style.background='#c00';fx.style.opacity=.7}
function squad(px,pz,fx){const sq=[];for(let i=0;i<5;i++){const g=person('#e0ac69','#1d3b8a','#14234a','#111',1);g.position.set(px+(i-2)*1.6,0,pz+8);g.rotation.y=PI;g.a[1].rotation.x=-1.5;sq.push(g)}let f1=0,f2=0;
 cutscene(14,(p,t)=>{cam.position.set(px+11-p*1.5,2.2,pz+4);cam.lookAt(px,1.2,pz+4);if(t>6.8&&!f1){f1=1;volley(px,pz,fx,5)}if(t>8.4&&!f2){f2=1;volley(px,pz,fx,6)}if(t>6.8)fx.style.opacity=Math.max(0,.7-(t-6.8)*.4)},
 [[0,'THE COURT FINDS YOU GUILTY.'],[2.6,'SENTENCE: DEATH BY FIRING SQUAD.'],[4.8,'READY...'],[5.6,'AIM...'],[6.4,'FIRE!'],[8.8,'...'],[10.5,'EXECUTED']],()=>{for(const g of sq)sc.remove(g);respawn()})}
function nuke(px,pz,fx){const mis=new T.Group();bx(.8,5,.8,0x888888,0,0,0,mis);bx(.7,1.2,.7,0xff3b3b,0,3,0,mis);nb(.5,6,.5,0xff9a2b,0,-5,0,mis);mis.position.set(px,200,pz);sc.add(mis);
 const mk=(geom,c,o)=>{const m=new T.Mesh(geom,new T.MeshBasicMaterial({color:c,transparent:true,opacity:o,side:T.DoubleSide}));m.visible=false;sc.add(m);return m};
 const fb=mk(new T.SphereGeometry(1,16,12),0xffc04a,.95),stalk=mk(new T.CylinderGeometry(1,2.2,1,12),0xa86a3a,1),cap=mk(new T.SphereGeometry(1,16,10),0xe0803a,1),ring=mk(new T.RingGeometry(.9,1,40),0xffffff,.8);ring.rotation.x=-PI/2;ring.position.set(px,.3,pz);let boom=0;
 cutscene(15,(p,t)=>{cam.position.set(px+34,10,pz+34);cam.lookAt(px,6+Math.max(0,t-7)*3,pz);
  if(t<6.6){mis.position.y=Math.max(.5,200-(t/6.6)**2*200)}
  else{if(!boom){boom=1;mis.visible=false;shake=2.2;snd(40,3,'sawtooth',.3);snd(25,4,'square',.2);for(let k=0;k<6;k++)gore(P,R()-.5,R()-.5,true);P.g.visible=false;bodyParts(px,pz,24,22,1);bloodBurst(px,pz,120);for(const e of peds)if(!e.dead&&Math.hypot(e.x-px,e.z-pz)<60)kill(e,R()-.5,R()-.5,1,0);fb.visible=stalk.visible=cap.visible=ring.visible=true}
   const q=t-6.6,s=Math.min(1+q*9,26);fx.style.background='#fff';fx.style.opacity=Math.max(0,1-q*.5);fb.scale.setScalar(s);fb.position.set(px,s*.5,pz);fb.material.opacity=Math.max(0,.95-q*.18);ring.scale.setScalar(1+q*30);ring.material.opacity=Math.max(0,.8-q*.12);
   const sh=Math.min(q*7,38),w=Math.min(1+q*.6,4);stalk.scale.set(w,sh,w);stalk.position.set(px,sh/2,pz);cap.scale.set(Math.min(3+q*2.2,16),Math.min(2+q*1.4,9),Math.min(3+q*2.2,16));cap.position.set(px,sh+2,pz);cam.position.x+=rr(-1,1)*Math.max(0,1-q*.15)}},
 [[0,'THE CITY HAS VOTED.'],[2.5,'TACTICAL STRIKE AUTHORIZED.'],[4.4,'IMPACT IN 3...'],[5.2,'2...'],[5.9,'1...'],[8,'.'],[11.5,'EXECUTED']],()=>{for(const o of[mis,fb,stalk,cap,ring])sc.remove(o);fx.style.opacity=0;respawn()})}
/* ---- emotes ---- */
let emoOpen=0;const EMO=['WAVE','DANCE','SALUTE','FLEX','SIT','LAUGH','TAUNT','BOW'],emoV=new T.Vector3();
function toggleEmoWheel(){emoOpen=!emoOpen;const w=$('emw');w.style.display=emoOpen?'flex':'none';if(emoOpen)w.innerHTML=EMO.map((x,i)=>'<div><b>'+(i+1)+'</b>'+x+'</div>').join('')}
function startEmote(n){emoOpen=0;$('emw').style.display='none';if(P.car||P.heli||P.plane||P.tank||P.dead||cut)return;P.emo={id:n-1,t0:performance.now()};snd(380+n*70,.14,'square',.04);if(n==6)for(let i=0;i<4;i++)setTimeout(()=>snd(520+i*40,.1,'square',.03),i*130)}
function emoteU(){const e=P.emo;if(!e)return;const g=P.g,t=(performance.now()-e.t0)/1000,sn=Math.sin;
 if(K.KeyW||K.KeyA||K.KeyS||K.KeyD||K.M||K.Space||t>(e.id==4?90:4)){P.emo=null;g.rotation.x=0;g.a[0].rotation.z=g.a[1].rotation.z=0;return}
 switch(e.id){
  case 0:g.a[1].rotation.x=-2.7;g.a[1].rotation.z=sn(t*10)*.5;break;
  case 1:g.position.y=(P.y||0)+Math.abs(sn(t*8))*.25;g.rotation.y=P.h+t*3;g.a[0].rotation.x=sn(t*8)*1.6-1.2;g.a[1].rotation.x=-sn(t*8)*1.6-1.2;g.l[0].rotation.x=sn(t*8)*.7;g.l[1].rotation.x=-sn(t*8)*.7;break;
  case 2:g.a[1].rotation.x=-2.3;g.a[1].rotation.z=.5;break;
  case 3:g.a[0].rotation.x=g.a[1].rotation.x=-1.7+sn(t*6)*.15;g.a[0].rotation.z=.9;g.a[1].rotation.z=-.9;break;
  case 4:g.position.y=(P.y||0)-.45;g.l[0].rotation.x=g.l[1].rotation.x=-1.5;g.a[0].rotation.x=g.a[1].rotation.x=-.9;break;
  case 5:g.rotation.x=sn(t*18)*.18;g.a[0].rotation.x=-.8+sn(t*18)*.4;g.a[1].rotation.x=-.8-sn(t*18)*.4;break;
  case 6:g.a[0].rotation.x=-1.6+sn(t*9)*.5;g.a[1].rotation.x=-1.6-sn(t*9)*.5;g.rotation.x=-.12;break;
  case 7:g.rotation.x=Math.min(1.1,t*4)*(t<2?1:Math.max(0,1-(t-2)*3));g.a[0].rotation.x=g.a[1].rotation.x=.4;break}
}
function emoBub(){const b=$('emo'),e=P.emo;if(!e||P.car||P.heli||P.plane||P.tank||zoom<.1||P.dead||cut){if(e&&(P.car||P.heli||P.plane||P.tank||P.dead))P.emo=null;b.style.display='none';return}
 emoV.set(P.x,(P.y||0)+2.3,P.z).project(cam);if(emoV.z>1){b.style.display='none';return}b.style.display='block';b.textContent=EMO[e.id]+'!';b.style.left=((emoV.x*.5+.5)*innerWidth)+'px';b.style.top=((-emoV.y*.5+.5)*innerHeight)+'px'}
/* ---- drivable tank ---- */
let tcd=0,tScale=1;const nearTank=()=>WAR.on&&SOL.find(e=>e.tank&&e.team==0&&!e.dead&&!e.driven&&Math.hypot(e.x-P.x,e.z-P.z)<5);
function enterTank(t){P.tank=t;t.driven=1;t.v=0;P.g.visible=false;msg('TANK - WASD DRIVE, LMB FIRE SHELL, F EXIT','#2bf0ff')}
function exitTank(){const t=P.tank;P.tank=null;t.driven=0;P.g.visible=true;P.x=t.x+cos(t.h||0)*3.5;P.z=t.z-sin(t.h||0)*3.5}
function tankU(dt){tcd-=dt;const t=P.tank;if(!t)return;
 if(t.dead){P.tank=null;t.driven=0;P.x=t.x;P.z=t.z;P.g.visible=true;P.hp-=60;hit('tank');return}if(cut||P.dead)return;
 if(t.h===undefined)t.h=Math.atan2(t.fx||0,t.fz||-1);const fw=(K.KeyW|0)-(K.KeyS|0),st=(K.KeyA|0)-(K.KeyD|0);t.v=(t.v||0)+((fw*10)-(t.v||0))*Math.min(1,dt*1.5);t.h+=st*dt*1.1*Math.min(1,Math.abs(t.v)/3+.3);
 t.x+=sin(t.h)*t.v*dt;t.z+=cos(t.h)*t.v*dt;push(t,1.8);t.g.position.set(t.x,0,t.z);t.g.rotation.y=t.h;P.x=t.x;P.z=t.z;P.y=0;P.h=t.h;
 if(performance.now()-mvT>1500){let d=t.h-camYaw;d=Math.atan2(sin(d),cos(d));camYaw+=d*Math.min(1,dt*2)}
 for(const e of SOL)if(!e.dead&&e.team==1&&!e.tank&&Math.abs(t.v)>2&&Math.hypot(e.x-t.x,e.z-t.z)<2.4)kill(e,sin(t.h),cos(t.h),1,1);
 if(K.M&&tcd<=0){tcd=1.1;let px=t.x,pz=t.z;for(let d=3;d<=75;d+=1.5){px=t.x+sin(t.h)*d;pz=t.z+cos(t.h)*d;if(groundH(px,pz)>.5)break;let hitE=0;for(const e of SOL)if(!e.dead&&e.team==1&&Math.hypot(e.x-px,e.z-pz)<2.4){hitE=1;break}if(hitE)break}
  tracer(t.x+sin(t.h)*3,t.z+cos(t.h)*3,px,pz,0xffaa33,2);explode(px,0,pz);snd(90,.4,'sawtooth',.1);shake=Math.max(shake,.7)}}
/* ---- war mode ---- */
const SOL=[],WAR={on:0,res:[0,0],tot:[0,0],t:0,over:0,pk:0,sp:0,cc:0,cav:0},TC=[{sh:'#2b8fff',pa:'#1d3b8a',tr:0x37e6ff},{sh:'#c0392b',pa:'#4a1010',tr:0xff4f4f}];
function spawnSol(t,x0,z0){const heavy=R()<.1,tc=TC[t],g=person('#e0ac69',tc.sh,tc.pa,heavy?'#111':'#3a4a2a',1);if(heavy)g.scale.setScalar(1.35);
 const x=x0!==undefined?x0:rr(-95,95),z=z0!==undefined?z0:(t==0?100:-100)+rr(-4,4),e={g,x,z,team:t,hp:heavy?8:3,dead:0,sol:1,cd:rr(.2,1),ph:rr(0,6),dt:0,heavy,lane:ri(RD)+rr(-3,3),tg:null,tt:0};g.position.set(x,0,z);SOL.push(e);return e}
function spawnTank(t){const g=new T.Group();g.rotation.order='YXZ';const col=t?0x5a2a2a:0x2a4a6a;bx(2.6,.9,4.2,col,0,.8,0,g);bx(1.8,.7,2,col^0x101010,0,1.5,-.2,g);bx(.3,.3,2.6,0x222222,0,1.5,1.9,g);for(const q of[-1.4,1.4])bx(.7,.7,4.4,0x222222,q,.4,0,g);
 g.hd=[{visible:1},{visible:1}];sc.add(g);const x=rr(-80,80),z=t==0?100:-100,e={g,x,z,team:t,hp:40,dead:0,sol:1,tank:1,cd:rr(1,3),dt:0,lane:ri(RD),tg:null,tt:0,ph:0};g.position.set(x,0,z);SOL.push(e)}
function startWar(){WAR.on=1;WAR.res=[CFG.armyA,CFG.armyE];WAR.tot=[CFG.armyA,CFG.armyE];WAR.t=0;WAR.over=0;WAR.pk=0;for(let t=0;t<2;t++){const n=Math.min(WAR.res[t],t?55:40);for(let i=0;i<n;i++){WAR.res[t]--;spawnSol(t)}}
 for(let i=0;i<CFG.tanksA;i++)spawnTank(0);for(let i=0;i<CFG.tanksE;i++)spawnTank(1);P.x=0;P.z=92;P.h=PI;camYaw=PI;copsOff=1;heat=0;msg('WAR MODE - HOLD THE LINE','#ff4f4f')}
function warIntro(){cutscene(9,p=>fly([0,70,-70],[0,9,104],[0,4,-100],[0,2,90],p),[[0,'THEY OUTNUMBER US.'],[3,'BUT THEY HAVE NEVER FACED US.'],[6,'HOLD THE LINE.']])}
function soldierFire(e,tg,d){e.cd=e.tank?rr(2.5,4):rr(.45,1.1);const near=Math.hypot(e.x-P.x,e.z-P.z)<75,tc=TC[e.team].tr;
 if(e.tank){const sx=tg.x+rr(-3,3),sz=tg.z+rr(-3,3);if(near)tracer(e.x,e.z,sx,sz,0xffaa33,2);explode(sx,0,sz);return}
 const ox=e.x+(e.fx||0)*.6,oz=e.z+(e.fz||0)*.6;
 if(tg===P){if(P.heli&&P.y>10)return;if(near)tracer(ox,oz,P.x,P.z,tc);if(R()<.35*(1-d/28)+.1){P.hp-=P.tank?.5:P.car?2:4;shake=Math.max(shake,.2);hit('enemy')}return}
 if(near)tracer(ox,oz,tg.x,tg.z,tc);if(R()<.4){tg.hp-=1;if(tg.hp<=0)kill(tg,(tg.x-e.x)/d,(tg.z-e.z)/d,R()<.25,0);else part(tg.x,1,tg.z,0,3,0,.12,BL[1],4)}}
function warU(dt){if(!WAR.on)return;WAR.t+=dt;const al=[[],[]];for(const e of SOL)if(!e.dead)al[e.team].push(e);
 if((WAR.sp-=dt)<=0){WAR.sp=.35;for(let t=0;t<2;t++)if(al[t].filter(e=>!e.tank).length<(t?55:40)&&WAR.res[t]>0){WAR.res[t]--;spawnSol(t)}}
 if(!WAR.cav&&WAR.t>50&&!WAR.over){WAR.cav=1;msg('THE CAVALRY HAS ARRIVED!','#37e6ff');snd(300,1,'sine',.1);for(let i=0;i<30;i++){const a=i/30*6.28,x=P.x+sin(a)*16,z=P.z+cos(a)*16,e=spawnSol(0,x,z);push(e,1);const pm=new T.Mesh(new T.CylinderGeometry(.8,.8,14,10),new T.MeshBasicMaterial({color:0x37e6ff,transparent:true,opacity:.5}));pm.position.set(e.x,7,e.z);sc.add(pm);setTimeout(()=>sc.remove(pm),1400)}}
 for(const e of SOL){if(e.dead){e.dt+=dt;if(e.dt>25&&!e.rm){e.rm=1;sc.remove(e.g)}continue}if(e.driven)continue;
  if((e.tt-=dt)<=0){e.tt=rr(.4,.9);let b=null,bd=1e9;for(const o of al[1-e.team]){const d=(o.x-e.x)**2+(o.z-e.z)**2;if(d<bd){bd=d;b=o}}if(e.team==1&&!P.dead){const d=(P.x-e.x)**2+(P.z-e.z)**2;if(d<bd){bd=d;b=P}}e.tg=b}
  const tg=e.tg;let dx=0,dz=0,mv=0;const sp=e.tank?3:e.heavy?3.6:5.2,fwd=e.team==0?-1:1;
  if(tg&&!tg.dead){const tx=tg.x-e.x,tz=tg.z-e.z,d=Math.hypot(tx,tz)||1,rng=e.tank?38:20;
   if(d<rng){e.fx=tx/d;e.fz=tz/d;if(d>(e.tank?25:11)){dx=tx/d;dz=tz/d;mv=1}else if(d<7&&!e.tank){dx=-tx/d;dz=-tz/d;mv=1}if((e.cd-=dt)<=0)soldierFire(e,tg,d)}
   else if(d<45){dx=tx/d;dz=tz/d;mv=1;e.fx=dx;e.fz=dz}
   else{if(Math.abs(e.x-e.lane)>1.2)dx=Math.sign(e.lane-e.x);else dz=fwd;mv=1;e.fx=dx;e.fz=dz}}
  else{dz=fwd;mv=1;e.fx=0;e.fz=fwd}
  if(mv){e.x+=dx*sp*dt;e.z+=dz*sp*dt;e.ph+=dt*sp*1.6}
  push(e,e.tank?1.8:.45);e.g.position.set(e.x,0,e.z);if(e.fx||e.fz)e.g.rotation.y=Math.atan2(e.fx,e.fz);
  if(!e.tank){const q=mv?sin(e.ph)*.8:0;e.g.l[0].rotation.x=q;e.g.l[1].rotation.x=-q;e.g.a[0].rotation.x=-q*.6;e.g.a[1].rotation.x=e.cd>0&&e.cd<.15?-1.5:-.4}}
 if((WAR.cc+=dt)>1){WAR.cc=0;for(let i=SOL.length-1;i>=0;i--)if(SOL[i].rm)SOL.splice(i,1)}
 const na=al[0].length+WAR.res[0],ne=al[1].length+WAR.res[1];$('war').style.display='flex';$('wa').textContent=na;$('we').textContent=ne;$('wab').style.width=(na/Math.max(1,WAR.tot[0])*100)+'%';$('web').style.width=(ne/Math.max(1,WAR.tot[1])*100)+'%';
 const mm=WAR.t/60|0,ss=String(WAR.t%60|0).padStart(2,'0');$('wt').textContent=mm+':'+ss;if(!WAR.over&&WAR.t>3&&(na==0||ne==0)){WAR.over=1;warEnd(ne==0,na,ne)}}
function warEnd(win,na,ne){mode='eod';document.exitPointerLock&&document.exitPointerLock();
 $('eodp').innerHTML='<h2>'+(win?'VICTORY':'DEFEAT')+'</h2><div class="er"><span>BATTLE TIME</span><b>'+(WAR.t/60|0)+':'+String(WAR.t%60|0).padStart(2,'0')+'</b></div><div class="er"><span>YOUR KILLS</span><b>'+WAR.pk+'</b></div><div class="er"><span>ALLIES LEFT</span><b>'+na+'</b></div><div class="er"><span>ENEMIES LEFT</span><b>'+ne+'</b></div><div class="stamp" style="animation-delay:.6s">'+(win?'W':'L')+'</div><button id="eodgo">KEEP PLAYING &gt;</button> <button id="eodnew">REMATCH</button>';
 $('eod').style.display='flex';$('eodgo').onclick=()=>{$('eod').style.display='none';mode='play';reLock()};$('eodnew').onclick=()=>location.reload();snd(win?800:120,.8,win?'sine':'sawtooth',.1)}
