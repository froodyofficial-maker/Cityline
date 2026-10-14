/* ---- multiplayer ---- */
const MP={room:null,on:0,remote:new Map(),me:'',t:0,lt:0,atk:'',atkPeer:''};
const okc=c=>typeof c=='string'&&/^#[0-9a-f]{6}$/i.test(c)?c:'#e8452c',mpE=(t,d)=>{if(MP.on)try{MP.room.emit(t,d).catch(()=>{})}catch(e){}};
async function mpStart(){if(!CFG.mp||typeof claude==='undefined'||!claude.use)return;try{const rm=await claude.use('room');if(!rm)return;let r=rm;try{r=await rm.join(CFG.room||'city')}catch(e){}
  MP.room=r;MP.on=1;msg('MULTIPLAYER ROOM "'+(CFG.room||'city')+'" - share this page to play together','#2bf0ff');
  r.on('shot',m=>{if(m.sameTab)return;const d=m.data||{};if(typeof d.x=='number'&&typeof d.ex=='number')tracer(d.x,d.z,d.ex,d.ez,0xffe066,+d.y||1.3)});
  r.on('hit',m=>{const d=m.data||{};if(d.to===MP.me&&CFG.pvp&&!P.dead&&!cut){P.hp-=Math.min(80,+d.d||0);hit('player');MP.atk=String(d.by||'PLAYER').slice(0,16);MP.atkPeer=m.peer;shake=Math.max(shake,.25)}});
  r.on('boom',m=>{if(m.sameTab)return;const d=m.data||{};if(typeof d.x=='number'&&typeof d.z=='number')explode(d.x,+d.y||0,d.z,1)});
  r.on('chat',m=>{if(m.sameTab)return;const d=m.data||{};msg(String(d.n||'PLAYER').slice(0,16)+': '+String(d.t||'').slice(0,80),'#ffe27a')});
  r.on('killed',m=>{const d=m.data||{};if(d.to===MP.me){cash+=250;msg('YOU KILLED '+String(d.n||'A PLAYER').slice(0,16)+'  +$250','#43ff7a')}else msg(String(d.by||'?').slice(0,16)+' killed '+String(d.n||'?').slice(0,16),'#ff6a6a')});
 }catch(e){}}
const mpShot=(x,z,ex,ez,y)=>mpE('shot',{x:+x.toFixed(1),z:+z.toFixed(1),ex:+ex.toFixed(1),ez:+ez.toFixed(1),y:+y.toFixed(1)}),mpBoom=(x,y,z)=>mpE('boom',{x:+x.toFixed(1),y:+y.toFixed(1),z:+z.toFixed(1)});
function mpRay(qx,qz,maxd){if(!MP.on||!CFG.pvp)return null;let b=null;for(const r of MP.remote.values()){if(r.dead)continue;const dx=r.x-P.x,dz=r.z-P.z,pr=dx*qx+dz*qz;if(pr>0&&pr<maxd&&Math.abs(dx*qz-dz*qx)<(r.vs=='f'?.9:2)&&Math.abs(r.y-(P.y||0))<5&&(!b||pr<b.d))b={r,d:pr}}return b}
function mpDmg(r){mpE('hit',{to:r.peer,d:{pistol:9,shotgun:7,smg:6,sniper:55}[cw]||8,by:CFG.name});snd(900,.05,'square',.03)}
function mpKilled(){if(MP.on&&MP.atkPeer)mpE('killed',{to:MP.atkPeer,n:CFG.name,by:MP.atk});MP.atkPeer=''}
function rVeh(s,c,k){if(s=='c')return car(parseInt(okc(c).slice(1),16)).g;const g=new T.Group();g.rotation.order='YXZ';
 if(s=='h'){bx(2.2,1.8,4.2,0x2b6fd0,0,1.3,0,g);bx(.6,.7,3.6,0x2b6fd0,0,1.6,-3.6,g);const ro=new T.Group();ro.position.y=2.7;bx(9,.08,.5,0x222222,0,0,0,ro);bx(.5,.08,9,0x222222,0,0,0,ro);g.add(ro);g.ro=ro}
 else if(s=='p'){const j=k=='jet';bx(j?2.4:1.4,j?2.4:1.4,j?14:6,0xe8ecf2,0,2.2,0,g);bx(j?16:10,.3,j?3.4:1.6,0xcfd6df,0,2,.5,g);bx(.3,3,2.4,0x2b6fd0,0,4,j?-6:-2.6,g)}
 else{bx(2.6,.9,4.2,0x2a4a6a,0,.8,0,g);bx(1.8,.7,2,0x3a5a7a,0,1.5,-.2,g);bx(.3,.3,2.6,0x222222,0,1.5,1.9,g)}
 sc.add(g);return g}
function mpU(dt){if(!MP.on)return;const now=performance.now(),r=MP.room;
 if(now-MP.t>90){MP.t=now;const v=P.car||P.heli||P.plane||P.tank||P,s=P.heli?'h':P.plane?'p':P.tank?'t':P.car?'c':'f';
  r.presence({x:+v.x.toFixed(1),y:+(P.y||0).toFixed(1),z:+v.z.toFixed(1),h:+((v.h!==undefined?v.h:P.h)||0).toFixed(2),s,c:CFG.shirt,vc:P.car?'#'+P.car.g.children[0].material.color.getHexString():'',n:CFG.name,hp:Math.round(P.hp),w:cw,d:P.dead?1:0,k:P.plane?P.plane.kind:''}).catch(()=>{})}
 const seen=new Set();for(const p of r.peers()){if(p.sameTab){MP.me=p.peer;continue}if(p.kind!='viewer')continue;const pr=p.presence||{};if(typeof pr.x!='number'||typeof pr.z!='number')continue;seen.add(p.peer);let q=MP.remote.get(p.peer);
  if(!q){if(MP.remote.size>=15)continue;q={peer:p.peer,g:person('#e0ac69',okc(pr.c),'#2b2f3a','#1a1a1a',1),veh:null,vs:'',vk:'',x:pr.x,y:pr.y||0,z:pr.z,h:pr.h||0,tag:document.createElement('div'),ph:0,dead:0};$('tags').appendChild(q.tag);MP.remote.set(p.peer,q)}q.pr=pr}
 for(const[id,q]of MP.remote){if(!seen.has(id)){sc.remove(q.g);if(q.veh)sc.remove(q.veh);q.tag.remove();MP.remote.delete(id);continue}
  const pr=q.pr,k=1-Math.exp(-dt*10),px=q.x,pz=q.z;q.x+=(pr.x-q.x)*k;q.y+=((pr.y||0)-q.y)*k;q.z+=(pr.z-q.z)*k;let dh=(pr.h||0)-q.h;dh=Math.atan2(sin(dh),cos(dh));q.h+=dh*k;
  const sp=Math.hypot(q.x-px,q.z-pz)/Math.max(dt,.001);q.ph+=dt*Math.min(sp,9)*1.8;q.dead=!!pr.d;const s=pr.s||'f';
  if(s!=q.vs||(s=='p'&&pr.k!=q.vk)){if(q.veh){sc.remove(q.veh);q.veh=null}q.vs=s;q.vk=pr.k;if(s!='f')q.veh=rVeh(s,pr.vc,pr.k)}
  q.g.visible=s=='f';if(q.veh){q.veh.position.set(q.x,q.y,q.z);q.veh.rotation.set(0,q.h,0);if(q.veh.ro)q.veh.ro.rotation.y+=dt*30}
  q.g.position.set(q.x,q.y,q.z);q.g.rotation.y=q.h;if(q.dead){q.g.rotation.x=-PI/2;q.g.position.y=q.y+.18}else{q.g.rotation.x=0;const w=sp>.5?sin(q.ph)*.8:0;q.g.l[0].rotation.x=w;q.g.l[1].rotation.x=-w;q.g.a[0].rotation.x=-w*.6;q.g.a[1].rotation.x=-.4}
  emoV.set(q.x,q.y+2.4,q.z).project(cam);const t=q.tag;if(emoV.z>1||Math.hypot(q.x-P.x,q.z-P.z)>150)t.style.display='none';else{t.style.display='block';t.textContent=String(pr.n||'PLAYER').slice(0,16)+(typeof pr.hp=='number'?'  '+pr.hp:'');t.style.left=((emoV.x*.5+.5)*innerWidth)+'px';t.style.top=((-emoV.y*.5+.5)*innerHeight)+'px'}}
 if(now-MP.lt>1000){MP.lt=now;$('mpl').innerHTML='ROOM: '+String(CFG.room||'city').replace(/[<>&]/g,'')+'<br>ONLINE '+(MP.remote.size+1)+'<br>'+[...MP.remote.values()].map(q=>String(q.pr.n||'PLAYER').slice(0,16).replace(/[<>&]/g,'')).join('<br>')}}
function chatOpen(){if(!MP.on)return;document.exitPointerLock&&document.exitPointerLock();$('chat').style.display='block';$('chi').value='';$('chi').focus()}
function chatClose(){$('chat').style.display='none';$('chi').blur();reLock()}
function chatSend(){const t=$('chi').value.trim().slice(0,80);if(t){mpE('chat',{n:CFG.name,t});msg(CFG.name+': '+t,'#ffe27a')}chatClose()}
