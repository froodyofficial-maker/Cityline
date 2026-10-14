/* ==================== street life ====================
   - you (and Rosy) visibly sit in the car you drive
   - ~8% of pedestrians carry a gun and fight back when provoked
   - killing a civilian has a 1-in-10 chance of a revenge hunt: a cutscene shows the victim and an angry relative,
     who then tracks you across the city (never for cops)
   - Rosy fights anyone who is fighting you
   - at 1-2 stars cops try to cuff you: BUSTED -> court (argue your innocence) -> prison (serve the time or break out) */
/* ---------- you and Rosy in the car ---------- */
let SEAT=null,SEATC=null;
function seatGroup(type){const G0=CARG[type||0].c;if(!G0.boundingBox)G0.computeBoundingBox();const bb=G0.boundingBox,hy=bb.max.y-.28,hz=(bb.min.z+bb.max.z)/2-.05,hw=bb.max.x,g=new T.Group(),cl=P.g.cols||['#e0ac69','#e8452c','#2b2f3a','#1a1a1a'];
 /* driver on the car's left (+x when facing +z), Rosy riding shotgun with her head out of the window */
 const dx=hw*.42;bx(.46,.44,.3,cl[1],dx,hy-.42,hz,g);bx(.3,.3,.3,cl[0],dx,hy,hz,g);bx(.32,.1,.32,cl[3],dx,hy+.18,hz,g);bx(.1,.22,.1,cl[0],dx-.18,hy-.28,hz+.3,g);
 const G=0xd9a24a,rx=-hw*.4,hd=new T.Group();hd.position.set(-hw-.08,hy-.06,hz+.2);hd.rotation.y=-.35;g.add(hd);bx(.32,.42,.5,G,rx,hy-.42,hz,g);bx(.26,.3,.5,G,-hw*.7,hy-.1,hz+.1,g);
 bx(.3,.28,.32,G,0,0,0,hd);bx(.18,.14,.22,0xecc684,0,-.06,.24,hd);bx(.08,.06,.04,0x161616,0,-.02,.36,hd);for(const s of[-1,1])bx(.06,.06,.02,0x161616,s*.08,.06,.165,hd);
 const e1=bx(.07,.24,.16,0xb07a34,-.16,.02,-.04,hd),e2=bx(.07,.24,.16,0xb07a34,.16,.02,-.04,hd);e1.rotation.z=.9;e2.rotation.z=-.5;bx(.08,.02,.12,0xff6a8a,-.02,-.15,.28,hd);
 g.traverse(o=>{if(o.isMesh)o.castShadow=false});g.userData.ears=[e1,e2];return g}
function seatsU(){const c=P.car;if(SEAT&&SEAT.userData.ears){const t=performance.now()*.02,v=c?Math.min(1,Math.abs(c.v)/12):0;SEAT.userData.ears[0].rotation.z=.9+Math.sin(t)*.5*v;SEAT.userData.ears[1].rotation.z=-.5-Math.sin(t*1.3)*.4*v}if(c===SEATC)return;if(SEAT&&SEAT.parent)SEAT.parent.remove(SEAT);SEAT=null;SEATC=c;if(c&&c.g&&!c.sv){SEAT=seatGroup(c.type);c.g.add(SEAT)}}
/* ---------- armed citizens ---------- */
function provoke(x,z,r){for(const e of peds)if(e.arm&&!e.dead&&!e.hostile&&Math.hypot(e.x-x,e.z-z)<r){e.hostile=1;e.fl=0;e.cd=rr(.4,1)}}
function foeAI(e,dt){const d=dist(e,P);if(P.dead||IN||cut){e.g.a[1].rotation.x=0;return}
 if(!e.avenger&&d>110){e.hostile=0;e.g.a[1].rotation.x=0;return}
 if(e.avenger&&d>220){const q=rdPick(P.x,P.z,90,140);e.x=q.s.ax?q.s.c+8:q.u;e.z=q.s.ax?q.u:q.s.c+8}
 const see=d<45&&los(e.x,e.z,P.x,P.z);let sp=0;
 if(!see||d>13){sp=e.avenger?5.4:4.4;const w=(see||d<9)?[P.x,P.z]:cpath(e,P.x,P.z,dt),dx=w[0]-e.x,dz=w[1]-e.z,l=Math.hypot(dx,dz)||1;e.x+=dx/l*sp*dt;e.z+=dz/l*sp*dt;e.h=Math.atan2(dx,dz)}
 if(see)e.h=Math.atan2(P.x-e.x,P.z-e.z);push(e,.4);e.ph+=dt*sp*2.2;const s=sp?sin(e.ph)*.8:0;e.g.l[0].rotation.x=s;e.g.l[1].rotation.x=-s;e.g.a[1].rotation.x=see&&d<24?-1.5:0;
 e.g.rotation.y=e.h;e.g.position.set(e.x,0,e.z);
 if(see&&d<24&&(e.cd-=dt)<=0){e.cd=rr(.7,1.4);tracer(e.x,e.z,P.x,P.z,0xff8855,1.3);snd(260,.08,'square',.03);if(R()<.32*(1-d/32)){P.hp-=P.car?3:7;hit('enemy');dmgBy='foe';shake=.25}}}
/* ---------- revenge ---------- */
const FIRSTN=['MARCUS','ELENA','DESHAWN','PRIYA','TOMAS','KEIKO','RUBEN','AISHA','DMITRI','GRACE','OMAR','LUCIA','JAMAL','INGRID','HECTOR','MEI'],
 JOBS=['Bus driver','Nurse','Line cook','Night-shift security guard','Music teacher','Mechanic','Student','Florist','Taxi driver','Barista'],
 RELS=['brother','sister','son','daughter','father','mother','cousin','best friend'];let REV=null;
function revengeRoll(e){if(REV||ST.act||CFG.mode==1||e.avenger||R()>=.1)return;REV={vx:e.x,vz:e.z,vn:ri(FIRSTN),age:18+(R()*50|0),job:ri(JOBS),rel:ri(RELS),an:ri(FIRSTN)};setTimeout(revengeStart,1500)}
function revengeStart(){const R_=REV;if(!R_)return;if(P.dead||cut||IN||mode!='play'){setTimeout(revengeStart,3000);return}
 const q=rdPick(P.x,P.z,120,170),x=q.s.ax?q.s.c+8:q.u,z=q.s.ax?q.u:q.s.c+8;
 const a={g:person(ri(skins),'#2a2a30','#1a1a1e','#111',1),hp:6,dead:0,dt:0,fl:0,ph:0,sp:5,avenger:1,hostile:0,arm:1,x,z,h:0,cd:1.5,seg:q.s,ax:q.s.ax,p:q.s.c+8};a.tx=x;a.tz=z;a.g.position.set(x,0,z);peds.push(a);R_.a=a;
 const vx=R_.vx,vz=R_.vz;a.h=Math.atan2(vx-x,vz-z);a.g.rotation.y=a.h;
 cutscene(9.5,(p,t)=>{if(t<3.6){const o=t*.35;cam.position.set(vx+sin(o)*5,2.6,vz+cos(o)*5);cam.lookAt(vx,.3,vz)}
   else{cam.position.set(a.x+sin(a.h)*3.1,1.75,a.z+cos(a.h)*3.1);cam.lookAt(a.x,1.35,a.z);const k=sin(t*13);a.g.a[0].rotation.x=-2.5+k*.35;a.g.a[1].rotation.x=-2.5-k*.35;a.g.position.y=Math.abs(sin(t*6))*.06;a.g.rotation.y=a.h+sin(t*2.3)*.25}},
  [[0,R_.vn+', '+R_.age+'. '+R_.job+'.'],[1.8,'Gunned down in the street.'],[3.6,'Across town, '+R_.vn+"'s "+R_.rel+' just got the call.'],[5.4,'"'+R_.vn+'?! NO... NO!"'],[7.4,'"Whoever did this... I am going to find you."']],
  ()=>{a.g.a[0].rotation.x=0;a.g.position.y=0;a.hostile=1;a.name=R_.an;msg('REVENGE: '+R_.vn+"'s "+R_.rel.toUpperCase()+' IS HUNTING YOU','#ff4f4f')})}
/* ---------- Rosy in a fight ---------- */
function rosyTarget(){if(P.dead||IN||P.car||P.heli||P.plane||P.tank)return null;let b=null,bd=1e9;const st=Math.floor(heat),ck=e=>{if(!e||e.dead||e.isVeh)return;const dp=Math.hypot(e.x-P.x,e.z-P.z);if(dp>26)return;const d=Math.hypot(e.x-ROSY.x,e.z-ROSY.z);if(d<bd){bd=d;b=e}};
 if(st>=1)for(const e of cops)ck(e);for(const e of peds)if(e.hostile)ck(e);for(const e of ENM)ck(e);if(typeof SOL!=='undefined')for(const e of SOL)if(e.team==1&&!e.tank)ck(e);return b}
function rosyBite(e,dt){const D=ROSY;if((D.bt=(D.bt||0)-dt)>0)return;D.bt=.75;const dx=e.x-D.x,dz=e.z-D.z,l=Math.hypot(dx,dz)||1;e.hp-=1;snd(150,.12,'sawtooth',.05);part(e.x,1,e.z,dx/l*2,2,dz/l*2,.12,BL[1],5);
 if(e.g){e.g.rotation.z=.25;setTimeout(()=>{if(e.g&&!e.dead)e.g.rotation.z=0},180)}if(e.hp<=0)kill(e,dx/l,dz/l,0,1)}
/* ---------- arrests ---------- */
const arrestable=()=>Math.min(5,Math.floor(heat))>=1&&Math.floor(heat)<=2&&!P.car&&!P.heli&&!P.plane&&!P.tank&&!IN&&!ST.act&&CFG.mode!=1&&!P.dead&&!cut&&!MP.on;
let BUST=0,BUSTM=0;
function arrestU(dt){if(!arrestable()){BUST=0;return}const c=cops.find(e=>!e.dead&&dist(e,P)<1.7);if(!c){BUST=Math.max(0,BUST-dt*2);return}
 BUST+=dt;if(!BUSTM){BUSTM=1;msg('A COP IS CUFFING YOU - RUN!','#ff4f4f');setTimeout(()=>BUSTM=0,4000)}c.g.a[0].rotation.x=c.g.a[1].rotation.x=-1.4;if(BUST>1.5)busted()}
function busted(){BUST=0;const px=P.x,pz=P.z,sev=Math.max(1,Math.min(5,Math.floor(heat)));P.dead=1;P.g.a[0].rotation.x=P.g.a[1].rotation.x=.6;
 cutscene(4,p=>{const a=p*1.6;cam.position.set(px+sin(a)*6,2.5+p*3,pz+cos(a)*6);cam.lookAt(px,1,pz);$('sir').style.opacity=1},[[.3,'BUSTED']],()=>{$('sir').style.opacity=0;P.dead=0;P.g.a[0].rotation.x=P.g.a[1].rotation.x=0;for(const c of cops)sc.remove(c.g);cops.length=0;heat=0;courtStart(sev)})}
/* ---------- court ---------- */
let COURT=null,CT=null;const CHARGES=[['PUBLIC DISORDER','RECKLESS DRIVING','PETTY THEFT'],['ASSAULT','GRAND THEFT AUTO','RESISTING ARREST'],['ARMED ROBBERY','ASSAULT ON AN OFFICER'],['MANSLAUGHTER','BANK ROBBERY'],['MURDER','DOMESTIC TERRORISM']];
const QS=[['"Where were you at 9 PM on the night in question?"',['"Eating noodles at the Ember Mall food court. There are receipts."','"I was home. My dog can vouch for me."','"I don\'t remember. It was a long night."']],
 ['"Three witnesses identified you at the scene. Explain that."',['"It was dark. Half this city owns a red jacket."','"Those witnesses work for Victor Calloway."','"Maybe I was there. That doesn\'t make me guilty."']],
 ['"Your fingerprints were found on the weapon."',['"I touched it AFTER - I was trying to take it away from someone."','"The chain of custody on that evidence is a joke."','"...No comment."']]];
function buildCourt(){const ox=2650,oz=2300,W=(x,z,w,d,h,c)=>{bx(w,h||5,d,c||0x6a4a32,ox+x,(h||5)/2,oz+z,sc);IB.push({x1:ox+x-w/2,x2:ox+x+w/2,z1:oz+z-d/2,z2:oz+z+d/2})};
 const fl=new T.Mesh(new T.PlaneGeometry(26,24),mat(0xa07a52));fl.rotation.x=-PI/2;fl.position.set(ox,.02,oz);sc.add(fl);const C=0xe8dcc4;W(0,-12,26,.4,5,C);W(0,12,26,.4,5,C);W(-13,0,.4,24,5,C);W(13,0,.4,24,5,C);for(const[x,z,w,d]of[[0,-11.75,26,.1],[0,11.75,26,.1],[-12.75,0,.1,24],[12.75,0,.1,24]])bx(w,1.4,d,0x6a4a32,ox+x,.7,oz+z,sc);
 bx(10,2.4,2.2,0x4a3020,ox,1.2,oz-8,sc);IB.push({x1:ox-5,x2:ox+5,z1:oz-9.1,z2:oz-6.9});bx(10.4,.15,2.6,0x8a6a42,ox,2.45,oz-8,sc);const jd=person('#c68642','#111111','#111','#cccccc',0);jd.position.set(ox,1.2,oz-9.2);sc.add(jd);
 nsign('EMBER COUNTY COURT','#ffc94a',ox,4.4,oz-11.7,9);for(const s of[-1,1]){bx(.1,3,.1,0x888888,ox+s*6.5,1.5,oz-10.5,sc);bx(1.2,.8,.05,s>0?0x2a6fd0:0xd03030,ox+s*6.5+.6,2.6,oz-10.5,sc)}
 bx(5,1,2.4,0x5a3a26,ox-9.5,.5,oz-3,sc);for(let i=0;i<6;i++){const j=person(ri(skins),ri(shirts),'#333',ri(['#222','#4a2f1b']),0);j.position.set(ox-11+(i%3)*1.4,0,oz-3.6+(i/3|0)*1.4);j.rotation.y=PI/2;sc.add(j)}
 for(const x of[-3.5,3.5]){bx(3,.9,1.2,0x5a3a26,ox+x,.45,oz-2,sc);IB.push({x1:ox+x-1.5,x2:ox+x+1.5,z1:oz-2.6,z2:oz-1.4})}const pr=person('#f1c7a0','#3a3f48','#2a2a30','#555',0);pr.position.set(ox+3.5,0,oz-3.2);sc.add(pr);
 for(let r=0;r<3;r++){bx(18,.5,.8,0x6a4a32,ox,.45,oz+3+r*2.5,sc);for(let i=0;i<4;i++)if(R()<.6){const q=person(ri(skins),ri(shirts),'#333','#222',0);q.position.set(ox-7+i*4.5+rr(-1,1),0,oz+3.6+r*2.5);q.rotation.y=PI;q.scale.y=.8;sc.add(q)}}
 for(const[x,z]of[[-6,-7],[6,-7],[0,-2],[-6,5],[6,5]]){const l=new T.PointLight(0xfff0dc,1.3,26);l.position.set(ox+x,4.4,oz+z);sc.add(l)}const cl=new T.Mesh(new T.PlaneGeometry(26,24),mat(0xe8e0d0));cl.rotation.x=PI/2;cl.position.set(ox,5,oz);sc.add(cl);
 COURT={name:'COURT',kind:'court',ox,oz,ret:{x:CTH.x,z:CTH.z+10},exit:{x:-1e9,z:-1e9},buy:{x:-1e9,z:-1e9},reg:{x:-1e9,z:-1e9},pois:[{x:ox-3.5,z:oz-.8,r:3,txt:()=>'E - Face the judge',e:()=>courtPanel()}]}}
function courtStart(sev){if(!COURT)return;CT={sev,round:-1,score:0,lawyer:0,ch:CHARGES[sev-1]};IN=COURT;P.x=COURT.ox-3.5;P.z=COURT.oz-.8;P.h=PI;camYaw=PI;msg('EMBER COUNTY COURT','#ffc94a');courtCam();courtPanel()}
function courtCam(){cam.position.set(COURT.ox+4.5,3.2,COURT.oz+4);cam.lookAt(COURT.ox-1,1.6,COURT.oz-8)}
function courtPanel(){if(!CT)return;courtCam();let h='<h2>THE PEOPLE v. YOU</h2><div class="stat">CHARGES: '+CT.ch.join(', ')+'</div>';
 if(CT.round<0){h+='<div class="ln"><span>The judge peers over her glasses. "How does the defendant plead?"<small>Prove your innocence, or it\'s prison.</small></span></div>'+row('badge','HIRE A LAWYER','$1,500 - much better odds','HIRE','court:lawyer')+row('star0','REPRESENT YOURSELF','free - risky','PLEAD','court:self')+row('coin','BRIBE THE JUDGE','$4,000 - coin flip, contempt if it fails','BRIBE','court:bribe')}
 else if(CT.round<QS.length){const q=QS[CT.round];h+='<div class="ln"><span>PROSECUTOR: '+q[0]+'</span></div>'+q[1].map((a,i)=>'<div class="ln"><span>'+a+'</span><button data-a="court:a'+i+'">SAY IT</button></div>').join('')}
 openMd(h)}
function courtAct(id){if(!CT)return;if(id=='lawyer'){if(!pay(1500))return courtPanel();CT.lawyer=1;CT.score+=2;CT.round=0;msg('Your lawyer straightens their tie.','#2bf0ff');return courtPanel()}
 if(id=='self'){CT.round=0;return courtPanel()}
 if(id=='bribe'){if(!pay(4000))return courtPanel();if(R()<.5){msg('The judge pockets the envelope. "Case dismissed."','#43ff7a');return verdict(1)}msg('"Bailiff! Contempt of court!"','#ff4f4f');CT.sev+=1;return verdict(0)}
 if(id=='open'){return courtPanel()}if(id=='free'){closeCas();return courtLeave()}if(id=='jail'){closeCas();return jailStart(CT.days)}
 if(id[0]=='a'){const k=+id[1],good=(CT.round*7+CT.sev*3+(k*5))%3,g=k==good?2:R()<.5?1:0;CT.score+=g;msg(g==2?'The jury nods along.':g==1?'Murmurs in the gallery.':'The prosecutor smirks.',g==2?'#43ff7a':g==1?'#ffc94a':'#ff6a6a');CT.round++;
  if(CT.round>=QS.length){const need=2+CT.sev+(CT.lawyer?0:1);return verdict(CT.score+(R()<.5?1:0)>=need)}return courtPanel()}}
function verdict(ok){CT.days=CT.sev+1;openMd(ok?'<h2>NOT GUILTY</h2><div class="stat">The jury believes you. You walk out a free citizen.</div><button data-a="court:free">WALK FREE</button>':
 '<h2>GUILTY</h2><div class="stat">SENTENCE: '+CT.days+' DAYS IN EMBER STATE PENITENTIARY</div><div class="ln"><span>Serve your time, or find a way out. Rumour says the yard fence has a weak spot.</span></div><button data-a="court:jail">TO PRISON</button>')}
function courtLeave(){CT=null;IN=0;P.x=CTH.x;P.z=CTH.z+11;P.h=0;camYaw=0;heat=0;cam.position.set(P.x,5,P.z-8);msg('Free to go. Rosy is waiting on the courthouse steps.','#43ff7a')}
/* ---------- prison ---------- */
let PRISON=null,JAIL=null;const JG=[];
function buildPrison(){const ox=2800,oz=2300,W=(x,z,w,d,h,c)=>{bx(w,h||5,d,c||0x9a9aa0,ox+x,(h||5)/2,oz+z,sc);IB.push({x1:ox+x-w/2,x2:ox+x+w/2,z1:oz+z-d/2,z2:oz+z+d/2})};
 const fl=new T.Mesh(new T.PlaneGeometry(40,32),mat(0x8a8a86));fl.rotation.x=-PI/2;fl.position.set(ox,.02,oz);sc.add(fl);const yd=new T.Mesh(new T.PlaneGeometry(40,15),mat(0x8a7a5a));yd.rotation.x=-PI/2;yd.position.set(ox,.03,oz+8.5);sc.add(yd);
 W(0,-16,40,.4,6);W(-20,0,.4,32,6);W(20,0,.4,32,6);W(0,16,40,.4,1.2);for(let x=-20;x<=20;x+=2.5)bx(.12,5,.12,0x6a6e74,ox+x,2.5,oz+16,sc);const ch=bx(40,4.6,.04,0x9aa0a6,ox,2.5,oz+16,sc);ch.material=CHAINM;
 for(let i=0;i<5;i++){const cx=-12+i*6;W(cx-3,-12.5,.3,7,3.4);for(let b=0;b<9;b++)if(!(i==1&&b>2&&b<6))bx(.08,3.2,.08,0x4a4e54,ox+cx-2.6+b*.65,1.6,oz-9,sc);if(i==1){IB.push({x1:ox+cx-3,x2:ox+cx-.9,z1:oz-9.1,z2:oz-8.9},{x1:ox+cx+.9,x2:ox+cx+3,z1:oz-9.1,z2:oz-8.9})}else IB.push({x1:ox+cx-3,x2:ox+cx+3,z1:oz-9.1,z2:oz-8.9});bx(2.2,.5,1,0x6a5a4a,ox+cx-1.2,.25,oz-14.6,sc)}W(15,-12.5,.3,7,3.4);
 for(const[x,z]of[[-12,-12],[0,-12],[12,-12],[-8,4],[8,4]]){const l=new T.PointLight(0xe8f0ff,.8,20);l.position.set(ox+x,4.5,oz+z);sc.add(l)}
 bx(3,1,1.4,0x5a4a3a,ox+14,.5,oz-3,sc);IB.push({x1:ox+12.5,x2:ox+15.5,z1:oz-3.7,z2:oz-2.3});bx(.8,.4,.5,0xd03030,ox+14,1.2,oz-3,sc);
 bx(2.2,.06,.1,0x2a2a2a,ox+15,1.4,oz+15.95,sc);bx(.06,1.6,.1,0x2a2a2a,ox+16,.8,oz+15.95,sc);nb(.3,.3,.05,0xffc94a,ox+15,2.2,oz+15.9);
 for(const s of[-1,1]){bx(.6,1.8,.6,0x3a3f48,ox+s*14,.9,oz+10,sc)}nsign('EMBER STATE PENITENTIARY','#ff3b3b',ox,4.6,oz-15.7,12);
 for(const wp of[[[-16,-6],[16,-6]],[[-14,2],[10,12],[-10,12]]]){const g=person('#c68642','#2a3a28','#1a2a18','#111',1);sc.add(g);JG.push({g,x:ox+wp[0][0],z:oz+wp[0][1],h:0,wp:wp.map(p=>[ox+p[0],oz+p[1]]),i:1,ph:0})}
 const cellX=ox-6,cellZ=oz-12.5;
 PRISON={name:'PRISON',kind:'prison',ox,oz,ret:{x:PEN.x,z:PEN.z+16},exit:{x:-1e9,z:-1e9},buy:{x:-1e9,z:-1e9},reg:{x:-1e9,z:-1e9},cell:{x:cellX,z:cellZ},pois:[
  {x:cellX-1.2,z:oz-14,r:2.4,txt:()=>'E - Serve your sentence ('+JAIL.days+' days)',e:()=>serveTime()},
  {x:ox+14,z:oz-1.8,r:2.4,txt:()=>JAIL.cut?'Toolbox (empty)':'E - Steal the wire cutters',e:()=>{if(JAIL.cut)return;JAIL.cut=1;snd(500,.08);msg('WIRE CUTTERS - now find the weak spot in the yard fence. Stay out of the guards\' sight.','#ffc94a')}},
  {x:ox+15,z:oz+14.6,r:2.6,txt:()=>JAIL.cut?'E - Cut through the fence':'The fence is rusted through here... you need cutters',e:()=>{if(JAIL.cut)breakOut()}}]}}
function jailStart(days){JAIL={days,cut:0};IN=PRISON;toCell();msg('PRISON: '+days+' DAYS. Yard time - the cell doors are open.','#ff6a6a')}
function toCell(){P.x=PRISON.cell.x;P.z=PRISON.cell.z;P.h=0;camYaw=0;cam.position.set(P.x,3,P.z+6)}
function serveTime(){const d=JAIL.days;cutscene(3.4,p=>{cam.position.set(PRISON.cell.x+3,2.6,PRISON.cell.z+4);cam.lookAt(PRISON.cell.x,1,PRISON.cell.z)},[[0,'DAY 1...'],[1.2,'DAY '+Math.ceil(d/2)+'...'],[2.4,'DAY '+d+'. Released.']],
 ()=>{day+=d;cash=Math.floor(cash*.85);JAIL=null;IN=0;P.x=CTH.x;P.z=CTH.z+11;P.h=0;camYaw=0;heat=0;cam.position.set(P.x,5,P.z-8);msg('Time served. The state kept 15% of your cash.','#ffc94a')})}
function breakOut(){const px=PRISON.ox+15,pz=PRISON.oz+15;cutscene(4.2,p=>{cam.position.set(px-4,2.2,pz+5);cam.lookAt(px,1,pz);P.g.visible=true;P.g.position.set(px,0,pz+p*2)},[[0,'Snip. Snip. Snip.'],[2,'PRISON BREAK!']],
 ()=>{JAIL=null;IN=0;P.x=PEN.x+rr(-6,6);P.z=PEN.z+17;P.h=0;camYaw=0;heat=Math.max(heat,3.2);cam.position.set(P.x,5,P.z-8);msg('PRISON BREAK - the whole city is looking for you!','#ff4f4f')})}
function guardsU(dt){if(IN!==PRISON||!JAIL||cut)return;for(const q of JG){const w=q.wp[q.i],dx=w[0]-q.x,dz=w[1]-q.z,l=Math.hypot(dx,dz);if(l<.4)q.i=(q.i+1)%q.wp.length;else{q.x+=dx/l*2*dt;q.z+=dz/l*2*dt;q.h=Math.atan2(dx,dz)}
  q.ph+=dt*4;q.g.position.set(q.x,0,q.z);q.g.rotation.y=q.h;q.g.l[0].rotation.x=sin(q.ph)*.6;q.g.l[1].rotation.x=-sin(q.ph)*.6;
  const px=P.x-q.x,pz=P.z-q.z,d=Math.hypot(px,pz),fac=(px*sin(q.h)+pz*cos(q.h))/(d||1),risky=JAIL.cut||Math.hypot(P.x-(PRISON.ox+14),P.z-(PRISON.oz-3))<4||P.z>PRISON.oz+11;
  if(risky&&d<(P.crouch?3.5:8)&&fac>.35){JAIL.cut=0;JAIL.days++;toCell();snd(200,.3,'sawtooth',.06);msg('CAUGHT! Back in your cell. +1 day.','#ff4f4f');return}}}
/* ---------- world buildings: courthouse + penitentiary ---------- */
let CTH={x:-40,z:120},PEN={x:-280,z:240};
function courthouse(cx,cz){dPad(cx,cz);CTH={x:cx,z:cz};WK=0;wall(22,10,14,0xe8e2d4,cx,cz-4);foot(cx,cz-4,22,14,10);const rf=new T.Mesh(new T.ConeGeometry(14,3.4,4,1),mat(0xd8d2c4));rf.rotation.y=PI/4;rf.scale.set(1.15,1,.7);rf.position.set(cx,11.8,cz-4);rf.castShadow=true;sc.add(rf);
 for(let i=0;i<6;i++){cy(.5,8.6,0xf2eee6,cx-8+i*3.2,4.4,cz+4.2,12);solid(cx-8+i*3.2,cz+4.2,1,1,8.6)}bx(22,.6,2.4,0xe8e2d4,cx,9,cz+4.2,sc);for(let s=0;s<3;s++)bx(20,.3,1.2,0xd8d2c4,cx,.15+s*.3,cz+6.4+s*-.6,sc);
 nsign('COURTHOUSE','#ffc94a',cx,9.9,cz+5.5,9);PLACES.push({x:cx,z:cz,icon:'badge'})}
function penitentiary(cx,cz){dPad(cx,cz);PEN={x:cx,z:cz};const c=0x8a8f96;for(const[x,z,w,d]of[[0,-13,28,1],[0,13,28,1],[-13,0,1,26],[13,0,1,26]]){if(z==13){for(const s of[-1,1]){bx(10,6,1,c,cx+s*9,3,cz+z,sc);solid(cx+s*9,cz+z,10,1,6)}bx(8,1,1,c,cx,5.5,cz+z,sc)}else{bx(w,6,d,c,cx+x,3,cz+z,sc);solid(cx+x,cz+z,w,d,6)}}
 for(const[x,z]of[[-13,-13],[13,-13],[-13,13],[13,13]]){bx(2.4,10,2.4,0x6a6e74,cx+x,5,cz+z,sc);bx(3.2,.4,3.2,0x4a4e54,cx+x,10.2,cz+z,sc);nb(.4,.4,.4,0xff3b3b,cx+x,10.8,cz+z)}
 WK=0;wall(14,8,10,0xb8b4ac,cx,cz-3);foot(cx,cz-3,14,10,8);nsign('EMBER STATE PENITENTIARY','#ff3b3b',cx,7,cz+14,14).rotation.y=PI;PLACES.push({x:cx,z:cz,icon:'skull'})}
/* ---------- per frame ---------- */
function streetU(dt){seatsU();arrestU(dt);guardsU(dt);if(REV&&REV.a&&REV.a.dead){msg(REV.a.name+" won't be coming after you again.",'#ffc94a');REV=null}}
