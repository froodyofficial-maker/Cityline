/* ---- home screen ---- */
function startGame(){openSetup()}
function beginGame(){if(started)return;started=1;homeOn=0;document.body.classList.add('run');$('home').classList.add('out');$('setup').classList.add('out');$('maps').classList.add('out');setTimeout(()=>{$('home').remove();$('setup').remove();$('maps').remove()},1000);last=performance.now();applyCfg();snd(180,.35,'square',.07);snd(500,.2,'sawtooth',.04);if(CFG.skip)cam.position.set(P.x-sin(camYaw)*7.7,5.1,P.z-cos(camYaw)*7.7);else if(CFG.mode==1)warIntro();else if(!ST.on)intro();if(ST.on)storyBoot();reLock();mpStart()}
$('go').onclick=openStory;$('ow').onclick=startGame;$('mpb').onclick=()=>{NETQ=1;startGame()};$('ctl').onclick=()=>{const c=$('cp');c.style.display=c.style.display=='grid'?'none':'grid'};
/* ---- audio / ui ---- */
let ac;function snd(f,d,ty,v){try{ac=ac||new AudioContext();const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime;o.type=ty||'square';o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(30,t+d);g.gain.setValueAtTime(v||.05,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(ac.destination);o.start();o.stop(t+d)}catch(e){}}
let cash=500,kills=0,heat=0,mode='play',cut=null,shake=0,camYaw=0,shT=0,toastT=0,camPitch=.45,zoom=1,mvT=0,started=0,lastS=-1,lastN='',homeOn=1;
const P={x:4,z:14,h:0,hp:100,car:null,dead:0,g:person('#e0ac69','#e8452c','#2b2f3a','#1a1a1a',1)};
