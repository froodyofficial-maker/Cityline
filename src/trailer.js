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
 const m=c.createGain();m.gain.value=.85;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=18000;m.connect(lp);lp.connect(comp);TA.out=m;TA.lp=lp;const L=c.sampleRate*2.8|0,b=c.createBuffer(2,L,c.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<L;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/L,2.8)}
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
/* dark, tense score in D minor: drones, a pulsing low ostinato, ticking clock, heartbeats, braams and taiko */
const DK=[[38,41,45,50],[34,38,41,46],[31,34,38,43],[33,37,40,45]],DR=[26,22,19,21];/* Dm  Bb  Gm  A */
const tick=(t,v=1)=>{aOsc('sine',2600,t,.004,v*.05,{rel:.03});aNoise(t,.004,v*.05,{type:'highpass',f:6000,rel:.02})},
 heart=(t,v=1)=>{aOsc('sine',58,t,.02,v*.7,{f2:40,ft:.1,rel:.18});aOsc('sine',52,t+.2,.02,v*.45,{f2:38,ft:.1,rel:.2})},
 ost=(t,m,v=1,lp=900)=>aOsc('sawtooth',mid(m),t,.06,v*.07,{det:[-6,6],lp,lp2:lp*.4,lpt:.12,rel:.08}),
 taiko=(t,v=1)=>{aOsc('sine',95,t,.02,v*.8,{f2:48,ft:.2,rel:.45,rev:.35});aNoise(t,.02,v*.25,{type:'lowpass',f:600,rel:.12,rev:.3})},
 stab=(t,v=1)=>{aNoise(t,.03,v*.3,{type:'highpass',f:3000,rel:.35,rev:.7});aOsc('sine',70,t,.03,v*.5,{f2:40,ft:.3,rel:.4})},
 swell=(t,d,v=1)=>aNoise(t,d,v*.3,{f:200,f2:5000,q:1.5,a:d,rel:.02,rev:.6}),
 cluster=(t,v=1)=>{for(const m of[26,38,39,45])aOsc('sawtooth',mid(m),t,2.2,v*.12,{det:[-10,0,10],lp:150,lp2:1300,lpt:.45,a:.05,rel:1.8,rev:.55})},
 slowFx=(t,d)=>{if(!TA.lp)return;const f=TA.lp.frequency;f.setValueAtTime(18000,t);f.exponentialRampToValueAtTime(480,t+.12);f.setValueAtTime(480,t+d-.15);f.exponentialRampToValueAtTime(18000,t+d);
  aNoise(t,.5,.35,{f:4000,f2:300,q:1,rel:.3,rev:.6});aOsc('sine',44,t,.1,.6,{f2:28,ft:.8,rel:1.2})};
function score(T0){const c=TA.ctx;if(!c)return;const S=s=>T0+s,B=.6667,BAR=2.6667,ostP=[0,0,12,0,0,1,0,3];
 /* cold open: the clock ticks, a heartbeat, a drone that will not resolve */
 aOsc('sine',mid(26),S(0),11.5,.13,{a:3,rel:1});aOsc('sine',mid(86),S(1),10,.012,{det:[0,14],a:3,rel:2});
 for(let t=.4;t<11.4;t+=B)tick(S(t),t<5.5?1:.6);for(const t of[1.2,2.9,4.6])heart(S(t),.8);
 pad(S(5.5),6,DK[0],.9);for(let t=7.5;t<11.4;t+=B/4){const i=Math.round((t-7.5)/(B/4));ost(S(t),26+ostP[i%8],.4+(t-7.5)*.12,300+(t-7.5)*180)}swell(S(9.4),2.1,1);
 cluster(S(11.5),1.1);boom(S(11.5),1.2);
 /* act I + II: ostinato drives everything; chords Dm Bb Gm A */
 const groove=(a,b,o)=>{for(let t0=a;t0<b-.01;t0+=BAR){const ci=Math.round((t0-a)/BAR)%4;pad(S(t0),BAR,DK[ci],o.pad||.8);
  for(let i=0;i<16;i++){const t=t0+i*B/4;if(t>=b)break;ost(S(t),DR[ci]+12+ostP[i%8],o.ov||1,o.lp||1100)}
  for(let k=0;k<4;k++){const t=t0+k*B;if(t>=b)break;if(o.kick&&(k==0||(o.kick>1&&k==2)))kick(S(t),1);if(o.snare&&(k==1||k==3))snare(S(t),.9);if(o.taiko)taiko(S(t+(k%2?B/2:0)),.7);if(o.tick)tick(S(t),.7);if(o.hat){hat(S(t+B/2),.5);if(o.hat>1){hat(S(t+B/4),.3);hat(S(t+3*B/4),.3)}}bass(S(t),DR[ci]+12,B*.7,o.bass||.8)}}};
 groove(14.5,25.5,{kick:1,tick:1,lp:900});for(const t of[14.5,16.7,18.9,21.1,23.3])stab(S(t),.8);
 groove(25.5,34.5,{kick:2,snare:1,hat:1,lp:1400});tom(S(33.8),150);tom(S(34.1),120);
 groove(34.5,38.5,{pad:.6,ov:.6,lp:600,bass:.4});heart(S(35),.7);heart(S(36.4),.7);heart(S(37.8),.7);
 groove(38.5,43,{kick:1,taiko:1,lp:800});thunder(S(39.6),1.1);thunder(S(41.9),.9);
 groove(43,47,{kick:2,snare:1,hat:2,taiko:1,lp:1600});
 /* the drop into act III: almost silence, then the hit */
 aOsc('sine',mid(26),S(47),3.5,.1,{a:.4,rel:.3});for(let t=47.2;t<50.4;t+=B/2)tick(S(t),1.1);heart(S(47.5),1);heart(S(48.9),1.1);swell(S(49.3),1.2,1.3);
 cluster(S(50.5),1.2);boom(S(50.5),1.3);
 groove(50.5,69.5,{kick:2,snare:1,hat:2,taiko:1,lp:2000,ov:1.15});for(const t of[55.5,60.5,64.5])cluster(S(t),.7);
 for(const[t,d]of[[52.6,1.4],[57.8,1.4],[62.6,1.2],[67,1.2]])slowFx(S(t),d);
 aNoise(S(62.6),.04,.6,{f:2500,q:.4,rel:.5,rev:.6});aOsc('square',90,S(62.6),.02,.2,{f2:40,rel:.3});siren(S(64.5),5);boom(S(67),1.3);
 /* court: everything stops but the gavel */
 aNoise(S(69.5),.3,.25,{f:3000,f2:150,q:3,rel:.1});gavel(S(70.1));gavel(S(70.65));aOsc('sine',mid(26),S(69.6),1.9,.08,{a:.3,rel:.4});
 groove(71.5,76.5,{kick:2,snare:1,hat:1,taiko:1,lp:1500});
 groove(76.5,82.5,{kick:2,snare:1,hat:2,taiko:1,lp:2400,ov:1.2});cluster(S(76.5),.9);cluster(S(79.2),.8);for(let i=0;i<14;i++)snare(S(79.4+i*.22),.3+i*.05);riser(S(79.6),2.9,1.2);
 boom(S(82.5),1.4);cluster(S(82.5),1.2);pad(S(82.6),9,DK[0].concat([57]),1);aOsc('sine',mid(26),S(82.5),9,.15,{a:.4,rel:3});for(let t=84;t<91;t+=B)tick(S(t),.5)}
/* ---------- the overlay: letterbox, captions, logo, end card ---------- */
function trlDom(){const st=document.createElement('style');st.textContent=`
body.trl>*:not(#w):not(#tags):not(#clog):not(#trl):not(#scope):not(script):not(style){display:none!important}
#trl{--bar:max(9vh,calc((100vh - 41.84vw) / 2))}
#trl{position:fixed;inset:0;z-index:50;pointer-events:none;font-family:'Press Start 2P',monospace;color:#fff}
#trl .lb{position:absolute;left:0;right:0;height:var(--bar);background:#000;z-index:3}
#trl .gr{position:absolute;inset:0;mix-blend-mode:soft-light;opacity:0;transition:opacity 1.2s;z-index:1}
#trl .loc{position:absolute;left:5vw;top:calc(var(--bar) + 4vh);z-index:5;font-size:clamp(9px,1.05vw,13px);letter-spacing:.4em;color:#fff;text-shadow:3px 3px 0 #000;opacity:0;transition:opacity .35s}#trl .loc.on{opacity:1}#trl .loc::before{content:'';display:inline-block;width:26px;height:3px;background:#ff2f6d;vertical-align:middle;margin-right:14px}#trl .lb.t{top:0}#trl .lb.b{bottom:0}
#trl .vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55) 100%);z-index:1}
#trl .blk,#trl .dip{position:absolute;inset:0;background:#000;opacity:0;z-index:2}#trl .fl{position:absolute;inset:0;background:#fff;opacity:0;z-index:4}
#trl .cap{position:absolute;left:7vw;bottom:calc(var(--bar) + 5vh);z-index:5;max-width:80vw;opacity:0;transform:translateX(-30px);transition:opacity .45s,transform .7s cubic-bezier(.2,.8,.2,1)}
#trl .cap.on{opacity:1;transform:none}#trl .cap b{display:block;font-size:clamp(16px,2.6vw,34px);line-height:1.35;text-shadow:4px 4px 0 #000,0 0 26px rgba(0,0,0,.7);letter-spacing:.04em}
#trl .cap i{display:block;margin-top:14px;font-style:normal;font-size:clamp(8px,1vw,13px);color:#ffc94a;letter-spacing:.14em;text-shadow:3px 3px 0 #000}
#trl .cap::before{content:'';display:block;width:64px;height:6px;background:linear-gradient(90deg,#ff6a2b,#ff2f6d);margin-bottom:18px;box-shadow:3px 3px 0 #000}
#trl .ty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:5;font-size:clamp(14px,2.2vw,30px);letter-spacing:.14em;text-align:center;text-shadow:0 0 24px rgba(255,60,60,.35)}
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
#trl .tag{position:absolute;right:3vw;top:calc(var(--bar) + 16px);font-size:8px;letter-spacing:.25em;color:rgba(255,255,255,.55);z-index:5;opacity:0;transition:opacity .6s}#trl .tag.on{opacity:1}
#trl .start{position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(20,9,31,.55),rgba(5,2,10,.92));pointer-events:auto;transition:opacity .8s}
#trl .start.gone{opacity:0;pointer-events:none}#trl .start h1{margin:0 0 10px;font-weight:400;font-size:clamp(34px,7vw,96px);display:flex;gap:.35em}
#trl .start h1 span{background:linear-gradient(180deg,#ffd27a,#ff6a2b 55%,#ff2f6d);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(5px 5px 0 #000)}
#trl .start .pl{margin-top:34px;font-size:clamp(12px,1.5vw,18px);padding:20px 34px;background:#ff6a2b;color:#fff}#trl .start .pl:hover{background:#ff2f6d;color:#fff}
#trl .start small{margin-top:22px;font-size:9px;letter-spacing:.2em;color:#a99fbd}#trl .hint{position:absolute;right:3vw;bottom:calc(var(--bar) + 14px);font-size:7px;letter-spacing:.2em;color:rgba(255,255,255,.4);z-index:5}`;
 document.head.appendChild(st);const d=document.createElement('div');d.id='trl';
 d.innerHTML='<div class="gr"></div><div class="vig"></div><div class="loc"></div><div class="lb t"></div><div class="lb b"></div><div class="blk"></div><div class="dip"></div><div class="fl"></div><div class="tag">CAPTURED IN-ENGINE</div><div class="cap"><b></b><i></i></div><div class="ty"><span></span></div>'
  +'<div class="logo"><h1><span>EMBER</span><span>CITY</span></h1><p>AN OPEN-WORLD CRIME SANDBOX</p></div>'
  +'<div class="end"><h1 style="margin:0;font-weight:400;font-size:clamp(40px,8vw,112px);display:flex;gap:.35em"><span style="background:linear-gradient(180deg,#ffd27a,#ff6a2b 55%,#ff2f6d);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(6px 6px 0 #000)">EMBER</span><span style="background:linear-gradient(180deg,#ffd27a,#ff6a2b 55%,#ff2f6d);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(6px 6px 0 #000)">CITY</span></h1>'
  +'<div class="st">COMING SOON TO STEAM &middot; WISHLIST NOW</div><div class="ft">OPEN WORLD &middot; ONLINE WITH FRIENDS &middot; HEISTS &middot; GANG WARS &middot; 7 BUSINESSES &middot; ROSY<br>PLUS AN 11-CHAPTER STORY MODE &middot; ALL FOOTAGE CAPTURED IN-ENGINE &middot; CONTAINS STRONG VIOLENCE</div>'
  +'<div class="bt"><button data-t="replay">&#8635; WATCH AGAIN</button><a class="b" href="'+(window.__EMBER_BUNDLE__?'ember-city.html':'index.html')+'">PLAY THE GAME &gt;</a></div></div>'
  +'<div class="hint">SPACE PAUSE &middot; ESC SKIP</div>'
  +'<div class="start"><h1><span>EMBER</span><span>CITY</span></h1><div style="font-size:clamp(9px,1.1vw,13px);letter-spacing:.35em;color:#ffc94a">OFFICIAL TRAILER</div><button class="pl" data-t="play">&#9654; PLAY TRAILER</button><small>SOUND ON &middot; ABOUT 90 SECONDS &middot; STRONG VIOLENCE</small></div>';
 document.body.appendChild(d);d.addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b)return;if(b.dataset.t=='play')trlStart();else if(b.dataset.t=='replay')location.reload()});
 addEventListener('keydown',e=>{if(!TRL.on)return;if(e.code=='Space'&&TA.ctx&&!TRL.end){e.preventDefault();TA.ctx.state=='running'?TA.ctx.suspend():TA.ctx.resume()}else if(e.code=='Escape'&&!TRL.end)trlEnd()},true)}
const TQ=s=>document.querySelector('#trl '+s);
/* ---------- helpers for the shots ---------- */
const ez=x=>x<=0?0:x>=1?1:x*x*(3-2*x),LP=(a,b,k)=>a+(b-a)*k;
function camAt(p,q,hand){const t=performance.now()*.001,h=hand===undefined?.04:hand;cam.position.set(p[0]+Math.sin(t*1.3)*h,p[1]+Math.sin(t*1.7+1)*h*.7,p[2]+Math.cos(t*1.1)*h);cam.lookAt(q[0],q[1],q[2])}
function camPath(a,b,la,lb,k,hand){k=ez(k);camAt([LP(a[0],b[0],k),LP(a[1],b[1],k),LP(a[2],b[2],k)],[LP(la[0],lb[0],k),LP(la[1],lb[1],k),LP(la[2],lb[2],k)],hand)}
const fov=v=>{if(Math.abs(cam.fov-v)>.01){cam.fov=v;cam.updateProjectionMatrix()}};
function wxNow(k){const W=WXK[k];Object.assign(WEA,{k,cov:W.cov,dim:W.dim,fog:W.fog,rain:W.rain,wet:k==2||k==3?1:0,t:0,next:1e9})}
const gY=(x,z)=>Math.max(0,terrH(x,z));
function placeP(x,z,h,y){P.x=x;P.z=z;P.h=h;P.y=y||0;P.g.position.set(x,y||0,z);P.g.rotation.set(0,h,0)}
function walkP(sp,dt,aim){P.ph=(P.ph||0)+dt*sp*1.6;const s=Math.sin(P.ph)*.8*Math.min(1,sp/3);P.g.l[0].rotation.x=s;P.g.l[1].rotation.x=-s;P.g.a[0].rotation.x=-s*.8;P.g.a[1].rotation.x=aim?-1.5:s*.8}
function driveCar(c,dt){c.x+=Math.sin(c.h)*c.v*dt;c.z+=Math.cos(c.h)*c.v*dt;c.g.position.set(c.x,c.y||0,c.z);c.g.rotation.y=c.h;carLod(c);if(c.g.wh)for(const w of c.g.wh)w.rotation.x+=c.v*dt/.37}
function rosyTo(x,z){ROSY.x=x;ROSY.z=z;ROSY.idle=0;ROSY.trick=null;ROSY.play=null}
function aiCars(v){for(const k of cars)if(k.ai)k.g.visible=v}
function policeCar(){const k=car(0x0d0f14,0);bx(1.97,.34,1.7,0xf2f2f2,0,.66,.15,k.g);k.lb=[nb(.42,.14,.3,0xff2030,-.32,1.5,-.25,k.g),nb(.42,.14,.3,0x2a5bff,.32,1.5,-.25,k.g)];k.g.visible=false;return k}
const flash=(k,s)=>{const on=Math.floor(s*8)%2;k.lb[0].visible=!!on;k.lb[1].visible=!on};
/* people placed by hand for a shot (not part of the street simulation) */
function prop(kind,x,z,h){const g=kind=='cop'?person('#e0ac69','#1d3b8a','#14234a','#111',1):kind=='thug'?person(ri(skins),'#2a2a30','#1a1a1e','#111',1):person(ri(skins),ri(shirts),'#2b2f3a','#222',0);
 const e={g,x,z,h,hp:1,dead:0,dt:0,fl:0,ph:R()*6};g.position.set(x,0,z);g.rotation.y=h;(TRL.act.props=TRL.act.props||[]).push(e);return e}
const aim=(e,x,z)=>{e.h=Math.atan2(x-e.x,z-e.z);e.g.rotation.y=e.h;e.g.a[1].rotation.x=-1.5};
function fire(a,b,col,v){tracer(a.x+Math.sin(a.h)*.5,a.z+Math.cos(a.h)*.5,b.x+rr(-.6,.6),b.z+rr(-.6,.6),col||0xffe066,1.35);aGun(v||1)}
function kill_(e,dx,dz){if(e.dead)return;kill(e,dx,dz,1,0)}
const slow=(s,a,b,k)=>{tScale=s>=a&&s<b?(k||.2):1};
function grade(c,o){const g=TQ('.gr');g.style.background=c;g.style.opacity=o}
/* everything a shot may have changed goes back to normal before the next one */
function trlReset(){const A=TRL.act;if(P.car){P.car=null}for(const k of[A.c1,A.c2,A.c3,A.pc,A.p1,A.p2,A.p3])if(k){k.g.visible=false;k.v=0;k.y=0;k.g.rotation.set(0,0,0)}aiCars(true);if(A.heli)A.heli.g.visible=false;
 for(const e of(A.gang||[]))gangRemove(e);A.gang=null;for(const e of(A.props||[]))sc.remove(e.g);A.props=[];if(MP.on){MP.on=0;mpReset();MP.room=null}IN=0;P.y=0;P.roof=null;P.dead=0;P.g.rotation.set(0,0,0);P.g.a[0].rotation.x=P.g.a[1].rotation.x=0;P.g.visible=true;
 ROSY.trick=null;ROSY.play=null;BALL.st=0;BALL.m.visible=false;wxNow(0);heat=0;tScale=1;TRL.noKill=0;$('scope').style.opacity=0;if(DOGL.fit!=='none'){DOGL.fit='none';rosyLook()}const pr=PROPS.find(p=>p.id=='club');if(pr)pr.own=0;$('clog').innerHTML='';$('clog').classList.remove('on');fov(50)}
/* ---------- the shots (times in seconds from the start of the trailer) ---------- */
const TEAL='linear-gradient(180deg,#0a5a6a,#2a3a6a)',WARM='linear-gradient(180deg,#ff9a40,#7a2a5a)',BLOOD='linear-gradient(180deg,#8a0a1a,#0a3a4a)';
const SHOTS=[
 /* ACT I: the city */
 {t:0,set(){tod=.965;placeP(30,40,PI);rosyTo(31,41)},cam(s){fov(38);camAt([-70,92,240],[0,18,-30],0)}},
 {t:5.5,set(){tod=.965;placeP(30,40,PI);rosyTo(31,41);grade(TEAL,.35)},cam(s){fov(LP(40,32,s/6));camPath([-70,92,240],[-24,52,128],[0,18,-30],[30,9,0],s/6,.15)}},
 {t:11.5,set(){tod=.742},cam(s){fov(40);camAt([110,60,-120],[0,80,-200],0)}},
 {t:14.5,set(){tod=.742;placeP(14,-176,0);rosyTo(15,-175);grade(WARM,.3)},cam(s){fov(42);const a=.5+s*.06,r=180,y=72+s*5;camAt([TOWER.cx+Math.sin(a)*r,y,TOWER.cz+Math.cos(a)*r],[TOWER.cx,105,TOWER.cz],.2)}},
 {t:16.7,set(){tod=.752},cam(s){fov(34);camPath([214,13,COAST+64],[226,14,COAST+60],[252,16,COAST+4],[258,17,COAST+4],s/2.2,.08)}},
 {t:18.9,set(){tod=.76},cam(s){fov(40);camPath([-92,34,150],[-98,30,158],[-160,14,236],[-162,12,240],s/2.2,.1)}},
 {t:21.1,set(){tod=.74;placeP(-306,8,0);rosyTo(-305,9)},cam(s){fov(34);camPath([-302,1.2,-24],[-302,1.4,-18],[-302,2.2,60],[-301,2.4,60],s/2.2,.05)}},
 {t:23.3,set(){tod=.746},cam(s){fov(36);camPath([PIER.x+46,5,COAST+9],[PIER.x+40,6,COAST+11],[PIER.x,12,PIER.z1-14],[PIER.x,13,PIER.z1-12],s/2.2,.08)}},
 /* ACT II: freedom */
 {t:25.5,set(){const H=TRL.act.heli;tod=.738;H.g.visible=true;H.x=-34;H.y=58;H.z=-60;H.h=PI;grade(WARM,.3)},
  cam(s,dt){const H=TRL.act.heli;H.z-=dt*24;H.x+=Math.sin(s*.8)*dt*3;H.g.position.set(H.x,H.y+Math.sin(s*1.4)*.6,H.z);H.g.rotation.set(.16,H.h,Math.sin(s*.8)*.1);H.rotor.rotation.y+=dt*32;H.tr.rotation.x+=dt*40;
   fov(LP(46,40,s/4.5));camPath([H.x+8,H.y+2.2,H.z+10],[H.x+5,H.y+.6,H.z+7.5],[H.x,H.y+1.2,H.z-3],[H.x,H.y+1.5,H.z-12],s/4.5,.1)}},
 {t:30,set(){const A=TRL.act;tod=.725;aiCars(false);placeP(-400,0,0);[[A.c1,-30,-103.2,26.2],[A.c2,-36,-100,25.4],[A.c3,-42,-96.8,25.8]].forEach(([k,x,z,v])=>{k.x=x;k.z=z;k.h=-PI/2;k.v=v;k.g.visible=true;driveCar(k,0)})},
  cam(s,dt){const A=TRL.act;for(const[k,dv]of[[A.c1,Math.sin(s*1.3)*.6],[A.c2,s>2.4?1.4:-.4],[A.c3,Math.sin(s*.9+1)*.5]]){k.v+=dv*dt;driveCar(k,dt)}
   const c=A.c2;if(s<2.4){fov(30);camAt([c.x-8-s*.8,.9,-105.6],[c.x-1,1,-100],.05)}else{fov(13);camAt([c.x-44,2.1,-100.6],[c.x,1.1,-100],.03)}}},
 {t:34.5,set(){const A=TRL.act,k=A.pc;tod=.705;aiCars(false);DOGL.fit='shades';rosyLook();k.x=-260;k.z=-180;k.h=0;k.v=13;k.g.visible=true;P.car=k;driveCar(k,0)},
  cam(s,dt){if(s<2){const k=TRL.act.pc;driveCar(k,dt);P.x=k.x;P.z=k.z;fov(42);camPath([k.x-3.4,1.55,k.z+2.2],[k.x-3,1.45,k.z+1],[k.x-1,1.35,k.z+.2],[k.x-.9,1.3,k.z+.1],s/2,.05);return}
   if(!TRL.f0){TRL.f0=1;P.car=null;TRL.act.pc.g.visible=false;DOGL.fit='none';rosyLook();const D=DPARK;placeP(D.cx+1,D.cz-1,PI*.85);rosyTo(D.cx-.5,D.cz-2.5);ROSY.h=PI*.2;tod=.47}
   const D=DPARK;placeP(D.cx+1,D.cz-1,PI*.85);if(s>2.25&&!TRL.f1){TRL.f1=1;rosyTrick('backflip')}fov(44);const a=-.5+(s-2)*.12;camAt([ROSY.x+Math.sin(a)*4.2,.7,ROSY.z+Math.cos(a)*4.2],[ROSY.x,.8,ROSY.z],.03)}},
 {t:38.5,set(){tod=.935;wxNow(3);grade(TEAL,.4)},
  cam(s,dt){placeP(13.5,46-s*1.7,PI);walkP(2,dt);for(const[f,l]of[[1.1,0],[3.4,1]])if(s>f&&!TRL['l'+l]){TRL['l'+l]=1;const x=$('fx');x.style.background='#cfe0ff';x.style.opacity=.45;setTimeout(()=>x.style.opacity=0,120)}
   fov(40);camAt([16.6,1.45,P.z-6+s*.25],[13.6,1.5,P.z+3],.05)}},
 {t:43,set(){tod=.955;const[cx,cz]=CLUBXZ;const pr=PROPS.find(p=>p.id=='club');if(pr)pr.own=1;placeP(cx+3.2,cz+2.6,PI*.9);rosyTo(cx+4.3,cz+3);grade(WARM,.25)},
  cam(s){const[cx,cz]=CLUBXZ;fov(44);camPath([cx-10,1.4,cz+7.5],[cx+1,2,cz+6.2],[cx-4,2.4,cz],[cx+1,4,cz],s/4,.05)}},
 /* ACT III: the city bites back */
 {t:47,set(){tod=.97;grade(BLOOD,0)},cam(s){fov(40);camAt([0,20,60],[0,8,0],0)}},
 {t:50.5,set(){const A=TRL.act;tod=.97;grade(BLOOD,.35);placeP(-1,14,0);rosyTo(1.5,13);
   A.cops=[prop('cop',-7,22.5,PI),prop('cop',3.6,24.5,PI),prop('cop',9,22,PI)];
   for(const[k,x,z,h]of[[A.p1,-4.5,24.5,PI*.62],[A.p2,7.5,25,PI*1.35]]){k.x=x;k.z=z;k.h=h;k.v=0;k.g.visible=true;driveCar(k,0)}A.gt=0},
  cam(s,dt){const A=TRL.act;slow(s,2.1,3.5);const d=dt*tScale;placeP(-1,11+Math.min(s,2)*1.2,0);walkP(s<2?4:0,d,1);for(const k of[A.p1,A.p2])flash(k,s);
   for(const c of A.cops)if(!c.dead)aim(c,P.x,P.z);P.g.a[1].rotation.x=-1.5;
   if((A.gt-=d)<=0){A.gt=rr(.12,.28);const c=ri(A.cops.filter(e=>!e.dead));if(c){if(R()<.5)fire({x:P.x,z:P.z,h:Math.atan2(c.x-P.x,c.z-P.z)},c,0xffe066,tScale<1?.5:1);else fire(c,P,0xff8855,.6)}}
   if(s>2.1&&!TRL.k1){TRL.k1=1;const c=A.cops[1];kill_(c,(c.x-P.x)/14,(c.z-P.z)/14)}
   if(s<2.1){fov(32);camAt([P.x+1.6,1.6,P.z-4],[1,1.3,24],.06)}else if(s<3.6){fov(34);const c=A.cops[1];camAt([c.x-5.2,1.5,c.z-1.2],[c.x,.9,c.z],.02)}else{fov(40);camAt([P.x-3,2,P.z+5],[P.x,1.3,P.z],.06)}}},
 {t:55.5,set(){const A=TRL.act;tod=.765;grade(BLOOD,.3);placeP(-220.5,22,0);rosyTo(-219,21);A.gang=[[-219,52],[-221.6,53.6],[-217,55],[-220.2,57]].map(([x,z])=>{const e=gangPed('vip',x,z);e.h=Math.atan2(-220.5-x,22-z);e.g.rotation.y=e.h;return e});A.gt=0},
  cam(s,dt){const A=TRL.act;slow(s,2.3,3.7);const d=dt*tScale;placeP(-220.5,22+Math.min(s,2.3)*6.5+Math.max(0,s-2.3)*1.5,-.08);walkP(s<2.3?7:2,d,1);
   if((A.gt-=d)<=0){A.gt=rr(.12,.3);const g=ri(A.gang.filter(e=>!e.dead));if(g){if(R()<.5)fire({x:P.x,z:P.z,h:0},g,0xffe066,tScale<1?.5:1);else fire(g,P,0xff8855,.6)}}
   for(const e of A.gang)if(!e.dead){aim(e,P.x,P.z);e.g.position.set(e.x,0,e.z)}
   if(s>2.3&&!TRL.k1){TRL.k1=1;kill_(A.gang[0],0,1)}if(s>3.1&&!TRL.k2){TRL.k2=1;kill_(A.gang[2],.4,1)}
   if(s<2.3){fov(40);camAt([P.x+1.8,2.3,P.z-5],[-219.5,1.2,54],.08)}else if(s<3.8){fov(32);const g=A.gang[0];camAt([g.x+2.2,1.2,g.z-2.6],[g.x,1.2,g.z],.02)}else{fov(40);const g=A.gang[3];camAt([g.x+1.4,1.7,g.z+4.8],[P.x,1.1,P.z],.06)}}},
 {t:60.5,set(){const A=TRL.act;tod=.97;grade(BLOOD,.3);placeP(-4,9.6,Math.atan2(-6,17.8),16.06);ROSY.x=8;ROSY.z=30;A.tg=prop('thug',-10,27.6,0);A.by=[prop('',-14,28,PI/2),prop('',-6.5,28.2,-PI/2)];P.g.a[1].rotation.x=-1.5},
  cam(s,dt){const A=TRL.act,t=A.tg;slow(s,2.1,3.3,.25);if(s<1.6){fov(46);camAt([P.x-1,17.9,P.z-.8],[t.x,1,t.z],.04);$('scope').style.opacity=0;return}
   fov(s<2.1?10:12);$('scope').style.opacity=1;P.g.visible=false;camAt([P.x,17.6,P.z+.3],[t.x,1.4+(s<2.1?0:-.25*(s-2.1)),t.z],.015);if(s>2.1&&!TRL.k1){TRL.k1=1;kill_(t,(t.x-P.x)/20,(t.z-P.z)/20);for(const b of A.by){b.g.a[0].rotation.x=b.g.a[1].rotation.x=-2.5}}}},
 {t:64.5,set(){const A=TRL.act,k=A.pc;tod=.975;grade(BLOOD,.3);k.x=-20;k.z=-330;k.h=0;k.v=30;k.g.visible=true;P.car=k;driveCar(k,0);for(const[p,dz,dx]of[[A.p1,-8,-.9],[A.p2,-15,.9],[A.p3,-23,-.4]]){p.x=-20+dx;p.z=k.z+dz;p.h=0;p.v=30;p.y=0;p.vy=0;p.g.visible=true;driveCar(p,0)}},
  cam(s,dt){const A=TRL.act,k=A.pc;slow(s,2.5,3.7,.3);const d=dt*tScale;driveCar(k,d);P.x=k.x;P.z=k.z;
   for(const p of[A.p1,A.p2,A.p3]){if(!p.boom)p.v=30+Math.sin(s*2+p.x)*.8;else{p.v*=1-1.5*d;p.vy-=18*d;p.y=Math.max(0,p.y+p.vy*d);p.g.rotation.x+=p.spin*d;p.g.rotation.z+=p.spin*.4*d;if(p.y<=0&&p.vy<0){p.vy=0;p.spin*=.3}}driveCar(p,d);flash(p,s)}
   if(s>2.5&&!TRL.k1){TRL.k1=1;const p=A.p2;explode(p.x,.8,p.z,1);p.boom=1;p.vy=11;p.spin=4.2}
   if(s<2.3){fov(34);camAt([k.x+2.6,1.25,k.z+16-s*2],[k.x,1,k.z-10],.05)}else{fov(38);const p=A.p2;camAt([p.x-9,2.2,p.z+6],[p.x,1.5+(p.y||0)*.5,p.z],.1)}}},
 {t:69.5,set(){IN=COURT;const ox=2650,oz=2300;placeP(ox-.7,oz-2.6,PI);ROSY.g.visible=false;grade(BLOOD,.15)},cam(s){const ox=2650,oz=2300;fov(40);camPath([ox+3.4,2,oz+3],[ox+2.6,1.9,oz+2],[ox-.3,2.3,oz-9],[ox-.2,2.3,oz-9],s/2,.02)}},
 {t:71.5,set(){const A=TRL.act;tod=.735;grade(WARM,.25);const x0=PIER.x,z0=COAST+34;placeP(x0,z0,0,.5);rosyTo(x0+1.3,z0-1);
   A.mp=[{n:'ALICE',c:'#2b8fff',x:x0-2.4,z0:z0+1.2,rc:'pink'},{n:'BOB',c:'#3ec24a',x:x0+2.5,z0:z0+.4,rc:'gold'},{n:'KAI',c:'#ffd23f',x:x0-1.2,z0:z0-3.5,rc:'neon'}];for(const q of A.mp)q.z=q.z0;
   MP.on=1;MP.me='me';MP.room={presence:()=>Promise.resolve(),peers:()=>[{peer:'me',sameTab:true}].concat(A.mp.filter(q=>!q.late||TRL.mpLate).map(q=>({peer:q.n,kind:'viewer',presence:{x:q.x,y:.5,z:q.z,h:q.h||0,s:'f',c:q.c,n:q.n,d:0,rv:1,rx:q.x+1,rz:q.z+.8,rh:q.h||0,rc:q.rc}})))};A.mp[2].late=1},
  cam(s,dt){const A=TRL.act;placeP(PIER.x,COAST+34+s*1.6,0,.5);walkP(1.8,dt);for(const q of A.mp){q.z=q.z0+s*1.6;q.h=0}
   if(s>.4&&!TRL.c1){TRL.c1=1;chatLog('ALICE','meet at the ferris wheel. bring guns.','#2b8fff')}if(s>1.9&&!TRL.c2){TRL.c2=1;chatLog('BOB','heists at midnight','#3ec24a')}if(s>3.1&&!TRL.c3){TRL.c3=1;TRL.mpLate=1;chatLog('','KAI joined your world!','#43ff7a')}
   fov(44);camPath([P.x+1.6,2.3,P.z-6.5],[P.x+2.2,6.5,P.z-11],[P.x,1.8,P.z+6],[PIER.x,13,PIER.z1-12],s/5,.05)}},
 {t:76.5,set(){tod=.968;grade(TEAL,.3);placeP(TOWER.cx,TOWER.cz+3,0,156.06);rosyTo(TOWER.cx+1,TOWER.cz+16)},
  cam(s){const x=TOWER.cx,z=TOWER.cz+3,y=156;fov(LP(40,52,ez(s/6)));camPath([x-1,y+2.1,z-2.6],[x-38,y+34,z-70],[x+.4,y+1.4,z+20],[x,y-40,z+160],s/6,.04)}},
 {t:82.5,set(){tod=.968},cam(s){const x=TOWER.cx,z=TOWER.cz+3,y=156;fov(52);camAt([x-38-s*1.5,y+34+s,z-70-s*2],[x,y-40,z+160],.04)}}];
/* captions: [from, to, title, subtitle]; location tags; black title cards */
const CAPS=[[15,25.3,'NINE DISTRICTS. ONE OPEN CITY.','780 × 730 METERS · NO LOADING SCREENS'],[26,30,'GO ANYWHERE','HELICOPTERS · PLANES · TANKS'],[30.6,34.4,'STEAL ANY RIDE','STREET RACES · RIDE-SHARE · GETAWAYS'],
 [35,38.4,'NEVER RIDE ALONE','ROSY · YOUR GOLDEN RETRIEVER'],[39,42.8,'DAY. NIGHT. RAIN. STORMS.','A LIVING, BREATHING CITY'],[43.5,46.8,'BUILD AN EMPIRE','CLUBS · CHOP SHOPS · DOCKS · DEALERSHIPS'],
 [51,55.3,'ROB IT BLIND',''],[56,60.3,'TAKE THE TURF','18 TURFS · 4 GANGS'],[64.9,69.3,'OUTRUN THE LAW',''],[69.7,71.4,'OR PAY FOR IT','COURT · PRISON · ESCAPE'],
 [72,76.3,'TAKE THE CITY WITH FRIENDS','UP TO 8 PLAYERS ONLINE'],[77.2,82.3,'THE CITY IS YOURS.','']];
const LOCS=[[14.6,16.6,'EMBER HEIGHTS'],[16.8,18.8,'PORT EMBER'],[19,21,'THE FOUNDRY'],[21.2,23.2,'PALM GROVE'],[23.4,25.4,'EMBER BEACH']];
const CARDS=[[.6,2.8,'IN EMBER CITY'],[2.8,5.4,'NOBODY PLAYS BY THE RULES.'],[47.2,48.7,'BUT THIS CITY'],[48.8,50.4,'BITES BACK.']];
const DIPS=[5.5,25.5,30,34.5,38.5,43,64.5,71.5,76.5],BLACK=[[0,5.5],[11.5,14.5],[47,50.5]];
/* ---------- run ---------- */
function trlClock(){if(TRL.fix!=null)return TRL.fix;return TA.ctx?TA.ctx.currentTime-TRL.T0:(performance.now()*.001-TRL.T0)}
function trlStart(){if(TRL.on)return;TRL.on=1;aInit();TQ('.start').classList.add('gone');try{if(window.self===window.top&&document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{})}catch(e){}
 Object.assign(CFG,{mode:0,map:0,mp:0,skip:1,hunger:0,rent:0,exec:0,perma:0,goal:0,god:1,gore:2.2,copLimit:0,peds:45,traffic:14,heatMult:.5,dayLen:1e7,cash:500,allW:1,infAmmo:1,gfx:Math.max(CFG.gfx,2)});
 beginGame();copsOff=1;document.body.classList.add('trl');DOGL.collar='red';DOGL.fit='none';rosyLook();
 const A=TRL.act;A.c1=car(0xffc94a,1);A.c2=car(0xe8452c,1);A.c3=car(0x111111,1);A.pc=car(0xe8452c,1);A.p1=policeCar();A.p2=policeCar();A.p3=policeCar();
 A.heli=mkHeli(0,-50,0,0,0x1a1a22);helis.splice(helis.indexOf(A.heli),1);A.heli.g.visible=false;
 /* compile every material once now, so no shot stutters the first time it appears */
 const all=[A.c1,A.c2,A.c3,A.pc,A.p1,A.p2,A.p3];for(const k of all){k.g.visible=true;k.g.position.set(cam.position.x,0,cam.position.z)}A.heli.g.visible=true;try{rd.compile(sc,cam)}catch(e){}for(const k of all)k.g.visible=false;A.heli.g.visible=false;
 cut={t:0,dur:1e9,fn:trlFrame,lines:[],done:null};TRL.T0=(TA.ctx?TA.ctx.currentTime:performance.now()*.001)+.25;if(TA.ctx)score(TRL.T0);TRL.lt=performance.now()}
function trlEnd(){if(TRL.end)return;TRL.end=1;if(TA.ctx&&TRL.skip!==2){const t=TA.ctx.currentTime;TA.out.gain.cancelScheduledValues(t);TA.out.gain.setValueAtTime(TA.out.gain.value,t);TA.out.gain.linearRampToValueAtTime(0,t+.6)}
 TQ('.blk').style.opacity=1;TQ('.end').classList.add('on');TQ('.cap').classList.remove('on');TQ('.logo').classList.remove('on');TQ('.tag').classList.remove('on');TQ('.loc').classList.remove('on');TQ('.hint').style.display='none';tScale=1}
function trlFrame(){const now=performance.now(),dt=Math.min(.05,(now-TRL.lt)/1000);TRL.lt=now;const T=trlClock();if(T<0)return;
 let i=SHOTS.length-1;while(i>0&&T<SHOTS[i].t)i--;const S=SHOTS[i];
 if(i!==TRL.shot){TRL.shot=i;trlReset();for(const k of['f0','f1','f2','l0','l1','k1','k2','c1','c2','c3','mpLate'])TRL[k]=0;S.set()}
 heat=0;S.cam(T-S.t,dt);
 /* overlay timing */
 let blk=T>=82.5?Math.min(1,(T-82.5)/.5):0;for(const[a,b]of BLACK)if(T>=a&&T<b)blk=1;TQ('.blk').style.opacity=TRL.end?1:blk;
 let dip=0;for(const d of DIPS)dip=Math.max(dip,1-Math.abs(T-d)/.18);TQ('.dip').style.opacity=dip;
 let fl=0;for(const[t,k]of[[11.5,.9],[50.5,.8],[82.5,.7],[16.7,.25],[18.9,.25],[21.1,.25],[23.3,.25]])fl=Math.max(fl,(1-Math.abs(T-t)/.3)*k);TQ('.fl').style.opacity=Math.max(0,fl);
 const ty=TQ('.ty').children,cd=CARDS.find(q=>T>=q[0]&&T<q[1]);ty[0].textContent=cd?cd[2].slice(0,Math.max(0,Math.floor((T-cd[0])*16))):'';
 TQ('.logo').classList.toggle('on',T>=11.5&&T<14.4);TQ('.tag').classList.toggle('on',T>=14.5&&T<82&&!(T>=47&&T<50.5));
 const lc=LOCS.find(q=>T>=q[0]&&T<q[1]),le=TQ('.loc');if(lc){if(le.k!==lc){le.k=lc;le.textContent=lc[2]}le.classList.add('on')}else le.classList.remove('on');
 const c=CAPS.find(q=>T>=q[0]&&T<q[1]),ce=TQ('.cap');if(c){if(ce.k!==c){ce.k=c;ce.classList.remove('on');ce.querySelector('b').textContent=c[2];ce.querySelector('i').textContent=c[3];void ce.offsetWidth}ce.classList.add('on')}else ce.classList.remove('on');
 if(T>=84.5&&!TRL.end){TRL.skip=2;trlEnd()}}
if(TRLON){trlDom();/* no saving while the trailer plays */const si=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(String(k).startsWith('embercity'))return;return si.call(this,k,v)};
 reLock=()=>{};const k0=kill;kill=function(e,...a){if(TRL.noKill&&!e.gk)return;return k0(e,...a)};const hm=$('hm');if(hm)hm.style.display='none';
 window.TRL_SEEK=t=>{TRL.fix=t};}
