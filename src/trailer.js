/* ==================== trailer mode ====================
   dist/ember-city-trailer.html (or index.html?trailer) plays an ~80 second cinematic trailer rendered live in the
   game engine: scripted cameras over real gameplay (races, Rosy, weather, gang wars, the empire, police chases,
   court, online play), title cards and a synthesized score. Nothing is saved while it runs. */
const TRLON=!!(window.__EMBER_TRAILER__||/[?&]trailer\b/.test(location.search));
const TRL={on:0,T0:0,fix:null,shot:-1,lt:0,act:{},skip:0,end:0};
/* ---------- score: everything synthesized with WebAudio, scheduled against the audio clock ---------- */
const TA={ctx:null,out:null,rev:null,nb:null};
const mid=m=>440*Math.pow(2,(m-69)/12);
function aInit(){try{const c=new(window.AudioContext||window.webkitAudioContext)();TA.ctx=c;const comp=c.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=3.5;comp.connect(c.destination);
 const m=c.createGain();m.gain.value=.85;m.connect(comp);TA.out=m;const L=c.sampleRate*2.8|0,b=c.createBuffer(2,L,c.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<L;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/L,2.8)}
 const cv=c.createConvolver();cv.buffer=b;const rg=c.createGain();rg.gain.value=.55;cv.connect(rg);rg.connect(m);TA.rev=cv;
 const nL=c.sampleRate*2|0,nb=c.createBuffer(1,nL,c.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nL;i++)nd[i]=Math.random()*2-1;TA.nb=nb}catch(e){TA.ctx=null}}
function aBus(v,rev){const c=TA.ctx,g=c.createGain();g.gain.value=0;g.connect(TA.out);if(rev){const s=c.createGain();s.gain.value=rev;g.connect(s);s.connect(TA.rev)}return g}
function aEnv(g,t,a,pk,hold,rel){const p=g.gain;p.setValueAtTime(0,t);p.linearRampToValueAtTime(pk,t+a);p.setValueAtTime(pk,t+a+hold);p.exponentialRampToValueAtTime(.0001,t+a+hold+rel)}
function aOsc(type,f,t,dur,v,o){o=o||{};const c=TA.ctx;if(!c)return;const g=aBus(v,o.rev||0);let n=g;if(o.lp){const f_=c.createBiquadFilter();f_.type='lowpass';f_.frequency.setValueAtTime(o.lp,t);if(o.lp2)f_.frequency.exponentialRampToValueAtTime(o.lp2,t+(o.lpt||dur));f_.Q.value=o.q||.7;f_.connect(g);n=f_}
 for(const d of o.det||[0]){const s=c.createOscillator();s.type=type;s.frequency.setValueAtTime(f,t);if(o.f2)s.frequency.exponentialRampToValueAtTime(o.f2,t+(o.ft||dur));s.detune.value=d;s.connect(n);s.start(t);s.stop(t+dur+(o.rel||.3)+.1)}
 aEnv(g,t,o.a||.005,v,Math.max(0,dur-(o.a||.005)),o.rel||.3)}
function aNoise(t,dur,v,o){o=o||{};const c=TA.ctx;if(!c)return;const s=c.createBufferSource();s.buffer=TA.nb;s.loop=true;const f=c.createBiquadFilter();f.type=o.type||'bandpass';f.frequency.setValueAtTime(o.f||1000,t);if(o.f2)f.frequency.exponentialRampToValueAtTime(o.f2,t+dur);f.Q.value=o.q||.8;
 const g=aBus(v,o.rev||0);s.connect(f);f.connect(g);aEnv(g,t,o.a||.002,v,Math.max(0,dur-(o.a||.002)),o.rel||.08);s.start(t,Math.random());s.stop(t+dur+(o.rel||.08)+.1)}
const kick=(t,v=1)=>{aOsc('sine',150,t,.02,v*.95,{f2:42,ft:.14,rel:.32});aNoise(t,.01,v*.25,{type:'lowpass',f:2500,rel:.02})},
 snare=(t,v=1)=>{aNoise(t,.03,v*.45,{f:1900,q:.6,rel:.16,rev:.25});aOsc('triangle',190,t,.02,v*.3,{f2:150,rel:.09})},
 hat=(t,v=1)=>aNoise(t,.01,v*.13,{type:'highpass',f:7500,rel:.04}),
 tom=(t,f,v=1)=>aOsc('sine',f,t,.02,v*.6,{f2:f*.55,ft:.25,rel:.3,rev:.2}),
 boom=(t,v=1)=>{aOsc('sine',62,t,.05,v,{f2:28,ft:1.6,rel:2.2,rev:.5});aNoise(t,.15,v*.5,{type:'lowpass',f:900,f2:120,rel:1.2,rev:.8})},
 braam=(t,v=1,root=26)=>{for(const m of[root,root+12,root+19])aOsc('sawtooth',mid(m),t,1.8,v*.16,{det:[-9,0,9],lp:180,lp2:1600,lpt:.5,a:.06,rel:1.4,rev:.5})},
 riser=(t,d,v=1)=>{aNoise(t,d,v*.28,{f:300,f2:7000,q:2,a:d*.9,rel:.05,rev:.4});aOsc('sawtooth',mid(38),t,d,v*.05,{f2:mid(62),a:d*.9,lp:600,lp2:4000,rel:.05})},
 pad=(t,d,ms,v=1)=>{for(const m of ms)aOsc('sawtooth',mid(m),t,d,v*.035,{det:[-8,6],lp:700,lp2:1100,a:Math.min(1.4,d*.4),rel:1.6,rev:.6})},
 bass=(t,m,d,v=1)=>aOsc('triangle',mid(m),t,d,v*.42,{lp:420,rel:.12}),
 pluck=(t,m,v=1)=>aOsc('triangle',mid(m),t,.04,v*.12,{lp:2600,lp2:700,lpt:.25,rel:.35,rev:.45}),
 gavel=t=>{aOsc('sine',520,t,.01,.5,{f2:260,ft:.08,rel:.12,rev:.6});aNoise(t,.015,.4,{f:2200,rel:.05,rev:.6})},
 thunder=(t,v=1)=>{aNoise(t,.3,v*.6,{type:'lowpass',f:400,f2:60,a:.05,rel:2.8,rev:.6});aOsc('sine',48,t,.1,v*.4,{f2:30,rel:2})},
 aGun=v=>{if(!TA.ctx)return;const t=TA.ctx.currentTime;aNoise(t,.02,.32*(v||1),{f:1400,q:.5,rel:.12,rev:.35});aOsc('square',140,t,.01,.08*(v||1),{f2:60,rel:.06})},
 siren=(t,d)=>{const c=TA.ctx;if(!c)return;const o=c.createOscillator(),l=c.createOscillator(),lg=c.createGain(),g=aBus(.05,.3);o.type='triangle';o.frequency.value=780;l.frequency.value=.9;lg.gain.value=170;l.connect(lg);lg.connect(o.frequency);o.connect(g);aEnv(g,t,.4,.05,d-.8,.4);o.start(t);l.start(t);o.stop(t+d+.2);l.stop(t+d+.2)};
const CH=[[50,53,57,62],[46,50,53,58],[45,48,53,57],[48,52,55,60]],RT=[38,34,41,36];/* Dm  Bb  F  C */
function score(T0){const c=TA.ctx;if(!c)return;const S=s=>T0+s,B=.625,BAR=2.5;
 /* cold open + aerial: drone, slow pads, a heartbeat, the riser into the title */
 aOsc('sine',mid(26),S(0),12,.12,{a:3,rel:1.5});pad(S(.3),6.4,CH[0],.8);pad(S(6.6),3,CH[1],1);pad(S(9.5),3,CH[2],1.1);
 for(let k=0;k<7;k++){kick(S(6.6+k*.9),.45+k*.05)}riser(S(9.6),2.9,1);
 boom(S(12.5),1.1);braam(S(12.5),1);
 /* the groove: 16 bars from 15.5 s, with a breakdown for Rosy, half-time for the storm, and a stop for court */
 for(let bar=0;bar<16;bar++){const t0=15.5+bar*BAR,ci=bar%4,sec=t0<30.5?'a':t0<35.5?'rosy':t0<41?'storm':'b';
  if(sec=='rosy'){pad(S(t0),BAR,CH[ci].map(m=>m+12),.7);for(let i=0;i<8;i++)pluck(S(t0+i*B/2),CH[ci][i%4]+12+(i>3?12:0),.9);bass(S(t0),RT[ci],1.2,.5);continue}
  pad(S(t0),BAR,CH[ci],sec=='storm'?.9:.7);
  for(let b=0;b<4;b++){const t=t0+b*B;
   if(sec=='storm'){if(b==0)kick(S(t),1);if(b==2)snare(S(t),1);hat(S(t+B/2),.4);continue}
   if(b==0||b==2)kick(S(t),1);if(b==2&&bar%2)kick(S(t+B/2),.8);if(b==1||b==3)snare(S(t),1);
   if(t0>=20.5){hat(S(t),.8);hat(S(t+B/2),.6);if(sec=='b'){hat(S(t+B/4),.4);hat(S(t+3*B/4),.4)}}
   bass(S(t),RT[ci]+(b==3?7:0),B*.8,1)}
  if(bar==6||bar==15)for(let i=0;i<4;i++)tom(S(t0+BAR-B+i*B/4),180-i*25,.9)}
 thunder(S(36.7),1);thunder(S(39.3),.8);siren(S(51),4.6);
 /* court: the music stops dead; two raps of the gavel */
 aNoise(S(55.5),.35,.25,{f:3000,f2:200,q:3,rel:.1});gavel(S(56.7));gavel(S(57.25));aOsc('sine',mid(26),S(56),3.8,.06,{a:1,rel:.6});
 /* online + finale: groove returns brighter with a lead, a final build, then the end card */
 for(let bar=0;bar<5;bar++){const t0=60+bar*BAR,ci=bar%4;pad(S(t0),BAR,CH[ci],.8);for(let b=0;b<4;b++){const t=t0+b*B;if(b%2==0)kick(S(t),1);else snare(S(t),1);hat(S(t),.7);hat(S(t+B/2),.6);bass(S(t),RT[ci],B*.8,1)}
  for(let i=0;i<8;i++)pluck(S(t0+i*B/2),CH[ci][[0,2,1,3,2,1,3,2][i]]+24,1.1)}
 braam(S(65.5),.9,26);for(let i=0;i<12;i++)snare(S(68.5+i*.25),.35+i*.06);riser(S(68.6),2.9,1.2);
 boom(S(71.5),1.2);braam(S(71.5),1.1,26);pad(S(71.6),9,CH[0].concat([69]),1);aOsc('sine',mid(26),S(71.5),8,.14,{a:.5,rel:3})}
/* ---------- the overlay: letterbox, captions, logo, end card ---------- */
function trlDom(){const st=document.createElement('style');st.textContent=`
body.trl>*:not(#w):not(#tags):not(#clog):not(#trl):not(script):not(style){display:none!important}
#trl{position:fixed;inset:0;z-index:50;pointer-events:none;font-family:'Press Start 2P',monospace;color:#fff}
#trl .lb{position:absolute;left:0;right:0;height:12.5vh;background:#000;z-index:3}#trl .lb.t{top:0}#trl .lb.b{bottom:0}
#trl .vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55) 100%);z-index:1}
#trl .blk,#trl .dip{position:absolute;inset:0;background:#000;opacity:0;z-index:2}#trl .fl{position:absolute;inset:0;background:#fff;opacity:0;z-index:4}
#trl .cap{position:absolute;left:7vw;bottom:17vh;z-index:5;max-width:80vw;opacity:0;transform:translateX(-30px);transition:opacity .45s,transform .7s cubic-bezier(.2,.8,.2,1)}
#trl .cap.on{opacity:1;transform:none}#trl .cap b{display:block;font-size:clamp(16px,2.6vw,34px);line-height:1.35;text-shadow:4px 4px 0 #000,0 0 26px rgba(0,0,0,.7);letter-spacing:.04em}
#trl .cap i{display:block;margin-top:14px;font-style:normal;font-size:clamp(8px,1vw,13px);color:#ffc94a;letter-spacing:.14em;text-shadow:3px 3px 0 #000}
#trl .cap::before{content:'';display:block;width:64px;height:6px;background:linear-gradient(90deg,#ff6a2b,#ff2f6d);margin-bottom:18px;box-shadow:3px 3px 0 #000}
#trl .ty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;z-index:5;font-size:clamp(12px,1.7vw,22px);letter-spacing:.12em;text-align:center}
#trl .ty span{min-height:1.4em}
#trl .logo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:5;opacity:0;transition:opacity .25s}
#trl .logo.on{opacity:1}#trl .logo h1{margin:0;font-weight:400;font-size:clamp(40px,9vw,128px);line-height:1;display:flex;gap:.35em;letter-spacing:.02em}
#trl .logo h1 span{background:linear-gradient(180deg,#ffd27a 0%,#ff6a2b 55%,#ff2f6d 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(6px 6px 0 #000) drop-shadow(0 0 28px rgba(255,90,40,.55))}
#trl .logo.on h1{animation:lz 3s cubic-bezier(.15,.8,.2,1) both}@keyframes lz{0%{transform:scale(1.1);letter-spacing:.14em;filter:blur(6px)}35%{filter:none}100%{transform:scale(1);letter-spacing:.02em}}
#trl .logo p{margin:26px 0 0;font-size:clamp(9px,1.1vw,14px);letter-spacing:.3em;color:#ffc94a;text-shadow:3px 3px 0 #000}
#trl .end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:6;opacity:0;transition:opacity .8s;pointer-events:none}
#trl .end.on{opacity:1;pointer-events:auto}#trl .end .st{margin-top:30px;padding:16px 26px;background:#ff2f6d;color:#fff;font-size:clamp(10px,1.3vw,16px);letter-spacing:.14em;box-shadow:0 -4px #fff,0 4px #fff,-4px 0 #fff,4px 0 #fff,8px 8px 0 #000}
#trl .end .ft{margin-top:30px;font-size:clamp(7px,.85vw,11px);letter-spacing:.2em;color:#cfc6e0;text-align:center;line-height:2.2}
#trl .end .bt{margin-top:34px;display:flex;gap:18px}#trl button,#trl a.b{font:inherit;font-size:clamp(9px,1vw,12px);padding:14px 20px;background:#ffc94a;color:#14091f;border:0;cursor:pointer;text-decoration:none;box-shadow:0 -3px #fff,0 3px #fff,-3px 0 #fff,3px 0 #fff;letter-spacing:.08em}
#trl button:hover,#trl a.b:hover{background:#fff}
#trl .tag{position:absolute;right:3vw;top:calc(12.5vh + 16px);font-size:8px;letter-spacing:.25em;color:rgba(255,255,255,.55);z-index:5;opacity:0;transition:opacity .6s}#trl .tag.on{opacity:1}
#trl .start{position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(20,9,31,.55),rgba(5,2,10,.92));pointer-events:auto;transition:opacity .8s}
#trl .start.gone{opacity:0;pointer-events:none}#trl .start h1{margin:0 0 10px;font-weight:400;font-size:clamp(34px,7vw,96px);display:flex;gap:.35em}
#trl .start h1 span{background:linear-gradient(180deg,#ffd27a,#ff6a2b 55%,#ff2f6d);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(5px 5px 0 #000)}
#trl .start .pl{margin-top:34px;font-size:clamp(12px,1.5vw,18px);padding:20px 34px;background:#ff6a2b;color:#fff}#trl .start .pl:hover{background:#ff2f6d;color:#fff}
#trl .start small{margin-top:22px;font-size:9px;letter-spacing:.2em;color:#a99fbd}#trl .hint{position:absolute;right:3vw;bottom:calc(12.5vh + 14px);font-size:7px;letter-spacing:.2em;color:rgba(255,255,255,.4);z-index:5}`;
 document.head.appendChild(st);const d=document.createElement('div');d.id='trl';
 d.innerHTML='<div class="vig"></div><div class="lb t"></div><div class="lb b"></div><div class="blk"></div><div class="dip"></div><div class="fl"></div><div class="tag">CAPTURED IN-ENGINE</div><div class="cap"><b></b><i></i></div><div class="ty"><span></span><span></span></div>'
  +'<div class="logo"><h1><span>EMBER</span><span>CITY</span></h1><p>SIX YEARS INSIDE. ONE LAST NIGHT.</p></div>'
  +'<div class="end"><h1 style="margin:0;font-weight:400;font-size:clamp(40px,8vw,112px);display:flex;gap:.35em"><span style="background:linear-gradient(180deg,#ffd27a,#ff6a2b 55%,#ff2f6d);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(6px 6px 0 #000)">EMBER</span><span style="background:linear-gradient(180deg,#ffd27a,#ff6a2b 55%,#ff2f6d);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(6px 6px 0 #000)">CITY</span></h1>'
  +'<div class="st">COMING SOON TO STEAM &middot; WISHLIST NOW</div><div class="ft">OPEN WORLD &middot; 11-CHAPTER STORY &middot; ONLINE WITH FRIENDS &middot; ROSY<br>ALL FOOTAGE CAPTURED IN-ENGINE</div>'
  +'<div class="bt"><button data-t="replay">&#8635; WATCH AGAIN</button><a class="b" href="'+(window.__EMBER_BUNDLE__?'ember-city.html':'index.html')+'">PLAY THE GAME &gt;</a></div></div>'
  +'<div class="hint">SPACE PAUSE &middot; ESC SKIP</div>'
  +'<div class="start"><h1><span>EMBER</span><span>CITY</span></h1><div style="font-size:clamp(9px,1.1vw,13px);letter-spacing:.35em;color:#ffc94a">OFFICIAL TRAILER</div><button class="pl" data-t="play">&#9654; PLAY TRAILER</button><small>SOUND ON &middot; ABOUT 80 SECONDS</small></div>';
 document.body.appendChild(d);d.addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b)return;if(b.dataset.t=='play')trlStart();else if(b.dataset.t=='replay')location.reload()});
 addEventListener('keydown',e=>{if(!TRL.on)return;if(e.code=='Space'&&TA.ctx&&!TRL.end){e.preventDefault();TA.ctx.state=='running'?TA.ctx.suspend():TA.ctx.resume()}else if(e.code=='Escape'&&!TRL.end)trlEnd()},true)}
const TQ=s=>document.querySelector('#trl '+s);
/* ---------- helpers for the shots ---------- */
const ez=x=>x<=0?0:x>=1?1:x*x*(3-2*x),LP=(a,b,k)=>a+(b-a)*k;
function camAt(p,q,hand){const t=performance.now()*.001,h=hand===undefined?.04:hand;cam.position.set(p[0]+Math.sin(t*1.3)*h,p[1]+Math.sin(t*1.7+1)*h*.7,p[2]+Math.cos(t*1.1)*h);cam.lookAt(q[0],q[1],q[2])}
function camPath(a,b,la,lb,k,hand){k=ez(k);camAt([LP(a[0],b[0],k),LP(a[1],b[1],k),LP(a[2],b[2],k)],[LP(la[0],lb[0],k),LP(la[1],lb[1],k),LP(la[2],lb[2],k)],hand)}
function wxNow(k){const W=WXK[k];Object.assign(WEA,{k,cov:W.cov,dim:W.dim,fog:W.fog,rain:W.rain,wet:k==2||k==3?1:0,t:0,next:1e9})}
const gY=(x,z)=>Math.max(0,terrH(x,z));
function placeP(x,z,h,y){P.x=x;P.z=z;P.h=h;P.y=y||0;P.g.position.set(x,y||0,z);P.g.rotation.set(0,h,0)}
function walkP(sp,dt,aim){P.ph=(P.ph||0)+dt*sp*1.6;const s=Math.sin(P.ph)*.8*Math.min(1,sp/3);P.g.l[0].rotation.x=s;P.g.l[1].rotation.x=-s;P.g.a[0].rotation.x=-s*.8;P.g.a[1].rotation.x=aim?-1.5:s*.8}
function driveCar(c,dt){c.x+=Math.sin(c.h)*c.v*dt;c.z+=Math.cos(c.h)*c.v*dt;c.g.position.set(c.x,0,c.z);c.g.rotation.y=c.h;carLod(c);if(c.g.wh)for(const w of c.g.wh)w.rotation.x+=c.v*dt/.37}
function rosyTo(x,z){ROSY.x=x;ROSY.z=z;ROSY.idle=0;ROSY.trick=null;ROSY.play=null}
function aiCars(v){for(const k of cars)if(k.ai)k.g.visible=v}
function policeCar(){const k=car(0x0d0f14,0);bx(1.97,.34,1.7,0xf2f2f2,0,.66,.15,k.g);k.lb=[nb(.42,.14,.3,0xff2030,-.32,1.5,-.25,k.g),nb(.42,.14,.3,0x2a5bff,.32,1.5,-.25,k.g)];k.g.visible=false;return k}
/* everything a shot may have changed goes back to normal before the next one */
function trlReset(){const A=TRL.act;if(P.car){P.car=null}for(const k of[A.c1,A.c2,A.c3,A.pc,A.p1,A.p2])if(k){k.g.visible=false;k.v=0}aiCars(true);
 for(const e of(A.gang||[]))gangRemove(e);A.gang=null;if(MP.on){MP.on=0;mpReset();MP.room=null}IN=0;P.y=0;P.roof=null;P.dead=0;P.g.rotation.set(0,0,0);P.g.a[0].rotation.x=P.g.a[1].rotation.x=0;
 ROSY.trick=null;ROSY.play=null;BALL.st=0;BALL.m.visible=false;wxNow(0);heat=0;TRL.noKill=0;if(DOGL.fit!=='none'){DOGL.fit='none';rosyLook()}const pr=PROPS.find(p=>p.id=='club');if(pr)pr.own=0;$('clog').innerHTML='';$('clog').classList.remove('on')}
/* ---------- the shots (times in seconds from the start of the trailer) ---------- */
const SHOTS=[
 {t:0,dur:6.5,set(){tod=.965;placeP(30,40,PI);rosyTo(31,41)},cam(s){camAt([-60,95,250],[0,15,-20],0)}},
 {t:6.5,dur:6,set(){tod=.965;placeP(30,40,PI);rosyTo(31,41)},cam(s){camPath([-70,92,240],[-14,46,108],[0,18,-30],[30,9,0],s/6,.15)}},
 {t:12.5,dur:3,set(){tod=.72},cam(s){camAt([110,60,-120],[0,80,-200],0)}},
 {t:15.5,dur:5,set(){tod=.742;placeP(14,-176,0);rosyTo(15,-175)},cam(s){const a=.55+s*.07,r=175-s*4,y=70+s*7;camAt([TOWER.cx+Math.sin(a)*r,y,TOWER.cz+Math.cos(a)*r],[TOWER.cx,105,TOWER.cz],.2)}},
 {t:20.5,dur:5,set(){const A=TRL.act;tod=.725;aiCars(false);TRL.noKill=1;placeP(-400,0,0);[[A.c1,-30,-103.2,26.2],[A.c2,-36,-100,25.4],[A.c3,-42,-96.8,25.8]].forEach(([k,x,z,v])=>{k.x=x;k.z=z;k.h=-PI/2;k.v=v;k.g.visible=true;driveCar(k,0)})},
  cam(s,dt){const A=TRL.act;for(const[k,dv]of[[A.c1,Math.sin(s*1.3)*.6],[A.c2,s>2.6?1.4:-.4],[A.c3,Math.sin(s*.9+1)*.5]]){k.v+=dv*dt;driveCar(k,dt)}
   const c=A.c2;if(s<2.8)camAt([c.x-4-s*.8,1.05,-105.6],[c.x-1,1,-100],.06);else camPath([c.x-13,.75,-104.8],[c.x-10,.7,-103.4],[c.x,1.1,-100],[c.x+2,1,-100],(s-2.8)/2.2,.04)}},
 {t:25.5,dur:5,set(){const A=TRL.act,k=A.pc;tod=.705;aiCars(false);TRL.noKill=1;DOGL.fit='shades';rosyLook();k.x=-260;k.z=-180;k.h=0;k.v=13;k.g.visible=true;P.car=k;driveCar(k,0)},
  cam(s,dt){const k=TRL.act.pc;driveCar(k,dt);P.x=k.x;P.z=k.z;camPath([k.x-3.4,1.55,k.z+2.2],[k.x-2.8,1.45,k.z+.4],[k.x-1,1.35,k.z+.2],[k.x-.9,1.3,k.z+.1],s/5,.05)}},
 {t:30.5,dur:5,set(){tod=.47;const D=DPARK;placeP(D.cx+1,D.cz-1,PI*.85);rosyTo(D.cx-.5,D.cz-2.5);ROSY.h=PI*.2},
  cam(s,dt){const D=DPARK;placeP(D.cx+1,D.cz-1,PI*.85);if(s>.6&&!TRL.f1){TRL.f1=1;rosyTrick('backflip')}if(s>2.9&&!TRL.f2){TRL.f2=1;Object.assign(BALL,{st:1,x:P.x,y:1.6,z:P.z,vx:-3.5,vy:6.5,vz:-9,t:0});BALL.m.visible=true;P.g.a[1].rotation.x=-2.4}
   const a=-.5+s*.12;camAt([ROSY.x+Math.sin(a)*4.2,.75+s*.08,ROSY.z+Math.cos(a)*4.2],[ROSY.x,.8,ROSY.z],.03)}},
 {t:35.5,dur:5.5,set(){tod=.935;wxNow(3);placeP(13.5,46,PI);rosyTo(14.6,47)},
  cam(s,dt){placeP(13.5,46-s*1.7,PI);walkP(2,dt);for(const[f,l]of[[1.2,0],[3.8,1]])if(s>f&&!TRL['l'+l]){TRL['l'+l]=1;const x=$('fx');x.style.background='#cfe0ff';x.style.opacity=.4;setTimeout(()=>x.style.opacity=0,120)}
   camAt([16.6,1.45,P.z-5.6+s*.25],[13.6,1.5,P.z+3],.05)}},
 {t:41,dur:5.5,set(){const A=TRL.act;tod=.765;placeP(-220.5,22,0);rosyTo(-219,21);A.gang=[[-219,52],[-221.6,53.6],[-217,55],[-220.2,57]].map(([x,z])=>{const e=gangPed('vip',x,z);e.h=Math.atan2(-220.5-x,22-z);e.g.rotation.y=e.h;return e});A.gt=0},
  cam(s,dt){const A=TRL.act;placeP(-220.5,22+Math.min(s,3)*6.5+Math.max(0,s-3)*2,-.08);walkP(s<3?7:2,dt,1);A.gt-=dt;
   if(A.gt<=0){A.gt=rr(.12,.3);const g=ri(A.gang.filter(e=>!e.dead));if(g){if(R()<.5){tracer(P.x+.2,P.z+.6,g.x+rr(-1,1),g.z,0xffe066,1.35);aGun(1)}else{tracer(g.x,g.z,P.x+rr(-1.5,1.5),P.z+rr(-1,1),0xff8855,1.35);aGun(.6)}}}
   for(const e of A.gang)if(!e.dead){e.h=Math.atan2(P.x-e.x,P.z-e.z);e.g.rotation.y=e.h;e.g.a[1].rotation.x=-1.5;e.g.position.set(e.x,0,e.z)}
   if(s>3.4&&!TRL.k1){TRL.k1=1;const e=A.gang[1];kill(e,0,1,0,0)}
   if(s<2.8)camAt([P.x+1.8,2.3,P.z-5],[-219.5,1.2,54],.08);else{const g=A.gang[2];camPath([g.x+1.4,1.7,g.z+4.8],[g.x+.9,1.5,g.z+3.6],[P.x,1.1,P.z],[P.x,1.2,P.z],(s-2.8)/2.7,.06)}}},
 {t:46.5,dur:4.5,set(){tod=.955;const[cx,cz]=CLUBXZ;const pr=PROPS.find(p=>p.id=='club');if(pr)pr.own=1;placeP(cx+3.2,cz+2.6,PI*.9);rosyTo(cx+4.3,cz+3)},
  cam(s){const[cx,cz]=CLUBXZ;camPath([cx-10,1.4,cz+7.5],[cx+1,2,cz+6.2],[cx-4,2.4,cz],[cx+1,4,cz],s/4.5,.05)}},
 {t:51,dur:4.5,set(){const A=TRL.act,k=A.pc;tod=.975;TRL.noKill=1;k.x=-20;k.z=-330;k.h=0;k.v=30;k.g.visible=true;P.car=k;driveCar(k,0);for(const[p,dz,dx]of[[A.p1,-8,-.9],[A.p2,-15,.9]]){p.x=-20+dx;p.z=k.z+dz;p.h=0;p.v=30;p.g.visible=true;driveCar(p,0)}},
  cam(s,dt){const A=TRL.act,k=A.pc;driveCar(k,dt);P.x=k.x;P.z=k.z;for(const p of[A.p1,A.p2]){p.v=30+Math.sin(s*2+p.x)*.8;driveCar(p,dt);const on=Math.floor(s*8)%2;p.lb[0].visible=!!on;p.lb[1].visible=!on}
   if(s<2.2)camAt([k.x+2.6,1.25,k.z+14-s*2],[k.x,1,k.z-9],.05);else camPath([k.x-6,3.5,k.z-26],[k.x-4,10,k.z-34],[k.x,1,k.z-4],[k.x,1,k.z+2],(s-2.2)/2.3,.08)}},
 {t:55.5,dur:4.5,set(){IN=COURT;const ox=2650,oz=2300;placeP(ox-.7,oz-2.6,PI);ROSY.g.visible=false},cam(s){const ox=2650,oz=2300;camPath([ox+3.4,2,oz+3],[ox+2.2,1.9,oz+1.4],[ox-.3,2.3,oz-9],[ox-.2,2.3,oz-9],s/4.5,.02)}},
 {t:60,dur:5.5,set(){const A=TRL.act;tod=.735;const x0=PIER.x,z0=COAST+34;placeP(x0,z0,0,.5);rosyTo(x0+1.3,z0-1);
   A.mp=[{n:'ALICE',c:'#2b8fff',x:x0-2.4,z0:z0+1.2,rc:'pink'},{n:'BOB',c:'#3ec24a',x:x0+2.5,z0:z0+.4,rc:'gold'},{n:'KAI',c:'#ffd23f',x:x0-1.2,z0:z0-3.5,rc:'neon'}];for(const q of A.mp)q.z=q.z0;
   MP.on=1;MP.me='me';MP.room={presence:()=>Promise.resolve(),peers:()=>[{peer:'me',sameTab:true}].concat(A.mp.filter(q=>!q.late||TRL.mpLate).map(q=>({peer:q.n,kind:'viewer',presence:{x:q.x,y:.5,z:q.z,h:q.h||PI,s:'f',c:q.c,n:q.n,d:0,rv:1,rx:q.x+1,rz:q.z+.8,rh:q.h||PI,rc:q.rc}})))};A.mp[2].late=1},
  cam(s,dt){const A=TRL.act;placeP(PIER.x,COAST+34+s*1.6,0,.5);walkP(1.8,dt);for(const q of A.mp){q.z=q.z0+s*1.6;q.h=0}
   if(s>.4&&!TRL.c1){TRL.c1=1;chatLog('ALICE','race you to the ferris wheel!','#2b8fff')}if(s>1.9&&!TRL.c2){TRL.c2=1;chatLog('BOB','last one there buys tacos','#3ec24a')}if(s>3.1&&!TRL.c3){TRL.c3=1;TRL.mpLate=1;chatLog('','KAI joined your world!','#43ff7a')}
   camPath([P.x+1.6,2.3,P.z-6.5],[P.x+2.2,6.5,P.z-11],[P.x,1.8,P.z+6],[PIER.x,13,PIER.z1-12],s/5.5,.05)}},
 {t:65.5,dur:6,set(){tod=.968;placeP(TOWER.cx,TOWER.cz+3,0,156.06);rosyTo(TOWER.cx+1,TOWER.cz+16)},
  cam(s){const x=TOWER.cx,z=TOWER.cz+3,y=156;camPath([x-1,y+2.1,z-2.6],[x-38,y+34,z-70],[x+.4,y+1.4,z+20],[x,y-40,z+160],s/6,.04)}},
 {t:71.5,dur:11,set(){tod=.968},cam(s){const x=TOWER.cx,z=TOWER.cz+3,y=156;camAt([x-38-s*1.5,y+34+s,z-70-s*2],[x,y-40,z+160],.04)}}];
/* captions: [from, to, title, subtitle] */
const CAPS=[[16,20.2,'NINE DISTRICTS. NO RULES.','THE CITY THAT RAISED YOU'],[21.2,25.2,'RACE ITS STREETS','FOUR ROUTES · THREE RIVALS'],[26.2,30.2,'WITH YOUR BEST FRIEND RIDING SHOTGUN',''],
 [31,35.2,'ROSY NEVER LEAVES YOUR SIDE','TEACH HER TRICKS · DRESS HER UP · PLAY FETCH'],[36,40.7,'A CITY WITH MOODS','RAIN · STORMS · FOG'],[41.6,46.2,'TAKE THE TURF','18 TURFS · 4 GANGS · ONE CREW'],
 [47,50.7,'BUILD YOUR EMPIRE','CLUBS · CHOP SHOPS · DOCKS · DEALERSHIPS'],[51.5,55.2,'OUTRUN THE LAW',''],[56.2,59.8,'...OR TALK YOUR WAY OUT OF IT','COURT · PRISON · ESCAPE'],
 [60.6,65.2,'PLAY WITH FRIENDS','UP TO 8 PLAYERS ONLINE'],[66.2,71.2,'11 CHAPTERS. TWO ENDINGS.','ONE LAST NIGHT TO SETTLE EVERYTHING']];
const DIPS=[6.5,15.5,20.5,25.5,30.5,35.5,41,46.5,51,60,65.5];
/* ---------- run ---------- */
function trlClock(){if(TRL.fix!=null)return TRL.fix;return TA.ctx?TA.ctx.currentTime-TRL.T0:(performance.now()*.001-TRL.T0)}
function trlStart(){if(TRL.on)return;TRL.on=1;aInit();TQ('.start').classList.add('gone');try{if(window.self===window.top&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{})}catch(e){}
 Object.assign(CFG,{mode:0,map:0,mp:0,skip:1,hunger:0,rent:0,exec:0,perma:0,goal:0,god:1,gore:.4,copLimit:0,peds:45,traffic:14,heatMult:.5,dayLen:1e7,cash:500,allW:1,infAmmo:1,gfx:Math.max(CFG.gfx,2)});
 beginGame();copsOff=1;document.body.classList.add('trl');DOGL.collar='red';DOGL.fit='none';rosyLook();
 const A=TRL.act;A.c1=car(0xffc94a,1);A.c2=car(0xe8452c,1);A.c3=car(0x111111,1);A.pc=car(0xe8452c,1);A.p1=policeCar();A.p2=policeCar();
 for(const k of[A.c1,A.c2,A.c3,A.pc]){k.g.visible=false;k.g.userData.dyn=1}
 /* compile every material once now, so no shot stutters the first time it appears */
 for(const k of[A.c1,A.c2,A.c3,A.pc,A.p1,A.p2]){k.g.visible=true;k.g.position.set(cam.position.x,0,cam.position.z)}try{rd.compile(sc,cam)}catch(e){}for(const k of[A.c1,A.c2,A.c3,A.pc,A.p1,A.p2])k.g.visible=false;
 cut={t:0,dur:1e9,fn:trlFrame,lines:[],done:null};TRL.T0=(TA.ctx?TA.ctx.currentTime:performance.now()*.001)+.25;if(TA.ctx)score(TRL.T0);TRL.lt=performance.now()}
function trlEnd(){if(TRL.end)return;TRL.end=1;if(TA.ctx&&TRL.skip!==2){const t=TA.ctx.currentTime;TA.out.gain.cancelScheduledValues(t);TA.out.gain.setValueAtTime(TA.out.gain.value,t);TA.out.gain.linearRampToValueAtTime(0,t+.6)}
 TQ('.blk').style.opacity=1;TQ('.end').classList.add('on');TQ('.cap').classList.remove('on');TQ('.logo').classList.remove('on');TQ('.tag').classList.remove('on');TQ('.hint').style.display='none'}
function trlFrame(){const now=performance.now(),dt=Math.min(.05,(now-TRL.lt)/1000);TRL.lt=now;const T=trlClock();if(T<0)return;
 let i=SHOTS.length-1;while(i>0&&T<SHOTS[i].t)i--;const S=SHOTS[i];
 if(i!==TRL.shot){TRL.shot=i;trlReset();for(const k of['f1','f2','l0','l1','k1','c1','c2','c3','mpLate'])TRL[k]=0;S.set()}
 heat=0;S.cam(T-S.t,dt);
 /* overlay timing */
 const blk=T<6.5?1:T>=12.5&&T<15.5?1:T>=71.5?Math.min(1,(T-71.5)/.5):0;TQ('.blk').style.opacity=TRL.end?1:blk;
 let dip=0;for(const d of DIPS)dip=Math.max(dip,1-Math.abs(T-d)/.22);TQ('.dip').style.opacity=dip;
 TQ('.fl').style.opacity=Math.max(0,1-Math.abs(T-12.5)/.35)*.9+Math.max(0,1-Math.abs(T-71.5)/.4)*.7;
 const ty=TQ('.ty').children,tw=(s,a,r)=>s.slice(0,Math.max(0,Math.min(s.length,Math.floor((T-a)*r))));ty[0].textContent=T<6.4?tw('SIX YEARS INSIDE.',.6,14):'';ty[1].textContent=T<6.4?tw('ONE LAST NIGHT TO SETTLE EVERYTHING.',2.6,17):'';
 TQ('.logo').classList.toggle('on',T>=12.5&&T<15.4);TQ('.tag').classList.toggle('on',T>=15.5&&T<71);
 const c=CAPS.find(q=>T>=q[0]&&T<q[1]),ce=TQ('.cap');if(c){if(ce.k!==c){ce.k=c;ce.classList.remove('on');ce.querySelector('b').textContent=c[2];ce.querySelector('i').textContent=c[3];void ce.offsetWidth}ce.classList.add('on')}else ce.classList.remove('on');
 if(T>=73.5&&!TRL.end){TRL.skip=2;trlEnd()}}
if(TRLON){trlDom();/* no saving while the trailer plays */const si=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(String(k).startsWith('embercity'))return;return si.call(this,k,v)};
 reLock=()=>{};const k0=kill;kill=function(e,...a){if(TRL.noKill&&!e.gk)return;return k0(e,...a)};const hm=$('hm');if(hm)hm.style.display='none';
 window.TRL_SEEK=t=>{TRL.fix=t};}
