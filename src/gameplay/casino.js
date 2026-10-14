/* ---- casino interior & games ---- */
let casOpen=0;const CAS={name:'CASINO',kind:'casino',ox:400,oz:400,cash:Math.round(rr(5000,9000)),alarm:0,counted:0,games:[],menu:[],buy:{x:-9999,z:-9999}};STORES.push(CAS);
(function(){const ox=CAS.ox,oz=CAS.oz;CAS.ret={x:casino.x,z:casino.z+1.5};
 const W_=(x,z,w,d)=>{bx(w,4.5,d,0x2a1538,ox+x,2.25,oz+z,sc);IB.push({x1:ox+x-w/2,x2:ox+x+w/2,z1:oz+z-d/2,z2:oz+z+d/2})};
 const F=(x,z,w,d,c,y)=>{const f=new T.Mesh(new T.PlaneGeometry(w,d),mat(c));f.rotation.x=-PI/2;f.position.set(ox+x,y,oz+z);f.receiveShadow=true;sc.add(f)};
 const OB=(x,z,w,h,d,c,ns)=>{bx(w,h,d,c,ox+x,h/2,oz+z,sc);if(!ns)IB.push({x1:ox+x-w/2,x2:ox+x+w/2,z1:oz+z-d/2,z2:oz+z+d/2})};
 F(0,0,28,20,0x3a0f2a,.02);F(0,0,10,20,0x23232f,.03);F(-9.5,0,9,20,0x2f1050,.03);F(9.5,0,9,20,0x0f3a2a,.03);F(0,2,2.4,16,0xc8a040,.04);
 W_(0,-10,28.4,.4);W_(-14,0,.4,20);W_(14,0,.4,20);W_(-8.25,10,11.5,.4);W_(8.25,10,11.5,.4);IB.push({x1:ox-14,x2:ox+14,z1:oz+10.6,z2:oz+11});
 W_(-5,-6.5,.4,7);W_(-5,6.5,.4,7);W_(5,-6.5,.4,7);W_(5,6.5,.4,7);
 nb(28,.12,.12,0xff2bd6,ox,4.3,oz-9.75);nb(.12,.12,20,0x2bf0ff,ox-13.75,4.3,oz);nb(.12,.12,20,0x2bf0ff,ox+13.75,4.3,oz);nb(28,.12,.12,0xffd23f,ox,.3,oz-9.75);
 nsign('CASINO','#ffd23f',ox,3.1,oz-9.75,9);let q=nsign('SLOTS','#c050ff',ox-4.8,3.7,oz,5);q.rotation.y=PI/2;q=nsign('TABLES','#37e6ff',ox+4.8,3.7,oz,5);q.rotation.y=-PI/2;
 nb(1.4,.2,1.4,0xffd23f,ox,4.1,oz+1);for(const[a,b]of[[-1,0],[1,0],[0,-1],[0,1]])nb(.3,.3,.3,0xfff1b0,ox+a*1.1,3.9,oz+1+b*1.1);
 cy(1.8,.5,0xdddddd,ox,.25,oz+2,16);cy(1.5,.3,0x2b8fff,ox,.55,oz+2,16);nb(.5,1.4,.5,0x37e6ff,ox,1.1,oz+2);IB.push({x1:ox-1.9,x2:ox+1.9,z1:oz+.1,z2:oz+3.9});
 for(const x of[-3.8,3.8]){OB(x,7.8,3,.8,1.2,0xc04060);OB(x,8.5,3,1.6,.4,0xa03050,1);OB(x,6.4,1.2,.4,.8,0x4a3a2a)}
 for(const[x,z]of[[-4.4,-9],[4.4,-9],[-4.4,9],[4.4,9]]){cy(.3,.6,0x6b4a2b,ox+x,.3,oz+z,8);bx(1,1,1,0x3f8f3f,ox+x,1.2,oz+z,sc)}
 OB(0,-8.2,8,1,1.2,0x333340);for(let i=-4;i<=4;i++)bx(.06,1.2,.06,0xc8a040,ox+i*.95,1.6,oz-7.7,sc);bx(8,.08,.1,0xc8a040,ox,2.2,oz-7.7,sc);OB(.5,-8.2,.7,.5,.5,0x555566,1);nb(.5,.3,.05,0x43ff7a,ox+.5,1.3,oz-7.9);
 const mkP=(sh,pa,x,z,ry)=>{const p=person('#e0ac69',sh,pa,'#222',0);p.position.set(ox+x,0,oz+z);p.rotation.y=ry;clerks.push({g:p,x:ox+x,z:oz+z,hp:2,dead:0,st:CAS,dt:0,ph:0});return p};
 const cg=mkP('#ffd23f','#222',0,-9.3,0);clerks[clerks.length-1].clerk=1;
 CAS.exit=marker(ox,oz+8.2,0x2bf0ff);CAS.reg={x:ox,z:oz-6.4};
 const slot=(x,z,fc)=>{const g=new T.Group();bx(1.1,1.8,.9,0x5a1a8a,0,.9,0,g);bx(1,.7,.1,0x111118,0,1.35,.46,g);nb(.9,.55,.04,ri([0x2bf0ff,0xff2bd6,0xffe62b]),0,1.35,.5,g);bx(.95,.15,.5,0xffd23f,0,1,.45,g);nb(1,.2,.05,0xffd23f,0,1.85,.4,g);bx(.12,.5,.12,0xcccccc,.62,1.3,0,g);bx(.2,.2,.2,0xe8222c,.62,1.6,0,g);
  g.position.set(ox+x,0,oz+z);g.rotation.y=fc>0?PI/2:fc<0?-PI/2:0;sc.add(g);IB.push({x1:ox+x-.7,x2:ox+x+.7,z1:oz+z-.7,z2:oz+z+.7});CAS.games.push({x:ox+(fc?x+fc*1.3:x),z:oz+(fc?z:z+1.3),type:'slots',name:'SLOTS'})};
 for(let z=-8.5;z<9;z+=2.4)slot(-13.2,z,1);for(let z=-6.5;z<5;z+=2.6)slot(-8.2,z,-1);for(let x=-11;x<-5;x+=2.4)slot(x,-9.3,0);
 for(const[x,z]of[[-11.9,-6.1],[-11.9,3.5],[-9.5,-1.3]])mkP(ri(['#3a5ea8','#c0392b','#3aa86b']),'#2b2f3a',x,z,x<-10?-PI/2:PI/2);
 const tbl=(x,z,type,name)=>{OB(x,z,4,.9,2,0x3a2418);bx(3.8,.05,1.8,type=='roulette'?0x0a6a3a:0x1a7a4a,ox+x,.93,oz+z,sc);
  if(type=='roulette'){cy(.65,.2,0x5a3a22,ox+x-1.2,1.05,oz+z,16);cy(.45,.06,0xc82030,ox+x-1.2,1.17,oz+z,16);for(let i=0;i<4;i++)bx(.3,.08,.3,ri([0xff3b3b,0x2b8fff,0xffd23f]),ox+x+.2+i*.4,1,oz+z+.4,sc)}
  else for(let i=0;i<3;i++)bx(.3,.02,.45,0xffffff,ox+x-.8+i*.8,.97,oz+z+.2,sc);
  mkP('#fff','#111',x,z-1.6,0);CAS.games.push({x:ox+x,z:oz+z+2,type,name})};
 tbl(9.5,-6.5,'roulette','ROULETTE');tbl(9.5,-1,'roulette','ROULETTE');tbl(9.5,4.5,'blackjack','BLACKJACK');tbl(9.5,8.3,'blackjack','BLACKJACK');
 for(const x of[-8,8]){const l=new T.PointLight(0xffd9ff,.8,22);l.position.set(ox+x,3.8,oz);sc.add(l)}})();
function enterCasino(){IN=CAS;P.x=CAS.ox;P.z=CAS.oz+8;P.h=PI;camYaw=PI;cam.position.set(CAS.ox,5,CAS.oz+13);msg('Welcome to the GOLDEN EMBER CASINO','#ffd23f');snd(600,.2,'sine',.05)}
const gm={bet:500,busy:0,rb:[],bj:null,jp:5000,rw:0,cur:''};
const betRow=()=>'<div>'+[100,500,2000,10000].map(v=>'<button class="'+(gm.bet==v?'sel':'')+'" data-g="bet:'+v+'">$'+v+'</button>').join('')+'</div>';
function setMd(h){if($('md').style.display=='flex')$('mdp').innerHTML=h;else openMd(h)}
function openGame(g){casStart=cash;casOpen=1;gm.busy=0;gm.cur=g.type=='slots'?'slots':g.type=='roulette'?'rou':'bj';gm.bj=null;render()}
const render=()=>gm.cur=='slots'?slotUI():gm.cur=='rou'?rouUI():bjUI();
function gRefund(){for(const b of gm.rb)cash+=b.amt;gm.rb=[]}
function slotUI(res,r){r=r||[0,1,2];setMd('<h2>LUCKY EMBER SLOTS</h2><div class="stat">CASH $'+cash+' / JACKPOT $'+gm.jp+'</div><div id="rl2">'+r.map(i=>si(SY[i],64)).join('')+'</div>'+betRow()+'<div><button data-g="spin">SPIN</button></div><div class="stat" id="res2">'+(res||'Triple 7 wins the jackpot')+'</div><button data-a="close">LEAVE</button>')}
function sSpin(){if(gm.busy)return;if(cash<gm.bet)return msg('Not enough cash','#ff6a6a');cash-=gm.bet;gm.jp+=Math.round(gm.bet*.1);gm.busy=1;let n=0;const iv=setInterval(()=>{const e=$('rl2');if(!e){clearInterval(iv);gm.busy=0;return}const r=[wp(),wp(),wp()];
  if(++n>14){clearInterval(iv);gm.busy=0;let w=0,t='';if(r[0]==r[1]&&r[1]==r[2]){if(r[0]==4){w=gm.jp;gm.jp=5000;t='JACKPOT!!! +$'+w}else{w=gm.bet*PAY[r[0]];t='THREE OF A KIND +$'+(w-gm.bet)}}else if(r[0]==r[1]||r[1]==r[2]||r[0]==r[2]){w=gm.bet;t='Push - bet returned'}else t='Lost $'+gm.bet;cash+=w;snd(w>gm.bet?900:150,.3,'square');slotUI(t,r);return}
  e.innerHTML=r.map(i=>si(SY[i],64)).join('');snd(500+n*20,.04)},90)}
const RO=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26],RED=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36],rcol=n=>n==0?'g':RED.includes(n)?'r':'b';
function rouUI(res){const tot=gm.rb.reduce((a,b)=>a+b.amt,0);setMd('<h2>ROULETTE</h2><div class="stat">CASH $'+cash+' / BETS $'+tot+'</div><canvas id="rw" width="220" height="220"></canvas>'+betRow()+'<div>'+[['r','RED x2'],['b','BLACK x2'],['odd','ODD x2'],['even','EVEN x2'],['lo','1-18 x2'],['hi','19-36 x2']].map(([k,l])=>'<button data-g="rb:'+k+'">'+l+'</button>').join('')+'</div><div class="nums">'+Array.from({length:37},(_,n)=>'<button class="rc-'+rcol(n)+'" data-g="rb:'+n+'">'+n+'</button>').join('')+'</div><div class="stat" id="res2">'+(res||(gm.rb.length?gm.rb.map(b=>b.t+' $'+b.amt).join('  '):'Place your bets'))+'</div><div><button data-g="rspin">SPIN</button><button data-g="rclr">CLEAR</button></div><button data-a="close">LEAVE</button>');drawWheel(gm.rw,null)}
function drawWheel(a,b){const c=$('rw');if(!c)return;const g=c.getContext('2d'),seg=2*PI/37;g.clearRect(0,0,220,220);g.fillStyle='#3a2418';g.beginPath();g.arc(110,110,108,0,7);g.fill();
 for(let i=0;i<37;i++){const n=RO[i],c0=a+i*seg-seg/2-PI/2;g.fillStyle=n==0?'#1a8a3a':RED.includes(n)?'#c0202a':'#161616';g.beginPath();g.moveTo(110,110);g.arc(110,110,100,c0,c0+seg);g.closePath();g.fill();g.save();g.translate(110,110);g.rotate(a+i*seg);g.fillStyle='#fff';g.font='8px monospace';g.textAlign='center';g.fillText(n,0,-84);g.restore()}
 g.fillStyle='#3a2418';g.beginPath();g.arc(110,110,62,0,7);g.fill();g.fillStyle='#c8a040';g.beginPath();g.arc(110,110,10,0,7);g.fill();if(b!=null){g.fillStyle='#fff';g.beginPath();g.arc(110+sin(b)*92,110-cos(b)*92,5,0,7);g.fill()}}
function rSpin(){if(gm.busy)return;if(!gm.rb.length)return msg('Place a bet first');gm.busy=1;const n=R()*37|0,idx=RO.indexOf(n),seg=2*PI/37,a0=gm.rw,aF=a0+6*PI,t0=performance.now();
 (function f(){if(!$('rw')){gm.busy=0;return}const t=Math.min(1,(performance.now()-t0)/5000),k=1-(1-t)**3,a=a0+(aF-a0)*k,free=-t*18*PI;let lock=aF*k+idx*seg+a0*(1-k);lock=a+idx*seg;lock+=2*PI*Math.round((free-lock)/(2*PI));const m=Math.max(0,(t-.6)/.4);drawWheel(a,free+(lock-free)*m*m*(3-2*m));
  if(t<1){requestAnimationFrame(f);if((t*50|0)%3==0)snd(300,.02,'square',.01)}else{gm.rw=aF;gm.busy=0;rResolve(n)}})()}
function rResolve(n){let w=0,tot=0;const c=rcol(n);for(const b of gm.rb){tot+=b.amt;const k=b.t;let win=0;if(/^\d+$/.test(k))win=+k==n?36:0;else if(k=='r'||k=='b')win=k==c?2:0;else if(n>0){win=(k=='odd'&&n%2||k=='even'&&n%2==0||k=='lo'&&n<=18||k=='hi'&&n>18)?2:0}w+=b.amt*win}
 cash+=w;gm.rb=[];snd(w?900:150,.3,'square');rouUI('Ball lands on '+n+' '+({r:'RED',b:'BLACK',g:'GREEN'})[c]+' - '+(w>tot?'WIN +$'+(w-tot):w?'break even':'lost $'+tot))}
const CV=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],SU2=['spade','hrt','dmd','club'],cval=c=>c.v==0?11:c.v>=9?10:c.v+1;let deck=[];
function draw(){if(deck.length<10){deck=[];for(let k=0;k<4;k++)for(let i=0;i<13;i++)deck.push({v:i,s:k});for(let i=deck.length-1;i>0;i--){const j=R()*(i+1)|0;[deck[i],deck[j]]=[deck[j],deck[i]]}}return deck.pop()}
function tot(h){let t=0,a=0;for(const c of h){t+=cval(c);if(c.v==0)a++}while(t>21&&a){t-=10;a--}return t}
const cardH=(c,hide)=>hide?'<div class="cd bk"></div>':'<div class="cd'+(c.s==1||c.s==2?' rd':'')+'"><b>'+CV[c.v]+'</b>'+si(SU2[c.s],18)+'</div>';
function bjUI(t){const b=gm.bj;let h='<h2>BLACKJACK</h2><div class="stat">CASH $'+cash+(b?' / BET $'+b.bet:'')+'</div>';
 if(b)h+='<div class="stat">DEALER '+(b.done?tot(b.d):'?')+'</div><div class="hand">'+b.d.map((c,i)=>cardH(c,!b.done&&i==1)).join('')+'</div><div class="stat">YOU '+tot(b.p)+'</div><div class="hand">'+b.p.map(c=>cardH(c)).join('')+'</div>';
 h+='<div class="stat">'+(t||(b&&!b.done?'HIT OR STAND?':'PLACE YOUR BET'))+'</div>';
 if(b&&!b.done)h+='<div><button data-g="hit">HIT</button><button data-g="stand">STAND</button>'+(b.p.length==2&&cash>=b.bet?'<button data-g="dbl">DOUBLE</button>':'')+'</div>';else h+=betRow()+'<div><button data-g="deal">DEAL</button></div>';setMd(h+'<button data-a="close">LEAVE</button>')}
function bjDeal(){if(cash<gm.bet)return msg('Not enough cash','#ff6a6a');cash-=gm.bet;const b=gm.bj={bet:gm.bet,p:[draw(),draw()],d:[draw(),draw()],done:0};snd(500,.05);if(tot(b.p)==21){b.done=1;const dbj=tot(b.d)==21;cash+=dbj?b.bet:Math.floor(b.bet*2.5);bjUI(dbj?'Both blackjack - push':'BLACKJACK! +$'+Math.floor(b.bet*1.5))}else bjUI()}
function bjEnd(){const b=gm.bj;b.done=1;const pt=tot(b.p);if(pt>21)return bjUI('BUST - lost $'+b.bet);while(tot(b.d)<17)b.d.push(draw());const dt=tot(b.d);
 if(dt>21||pt>dt){cash+=b.bet*2;snd(900,.3,'square');bjUI('YOU WIN +$'+b.bet)}else if(pt==dt){cash+=b.bet;bjUI('Push - bet returned')}else bjUI('Dealer wins - lost $'+b.bet)}
const bjHit=()=>{const b=gm.bj;if(!b||b.done)return;b.p.push(draw());snd(500,.05);tot(b.p)>=21?bjEnd():bjUI()},bjStand=()=>{if(gm.bj&&!gm.bj.done)bjEnd()},bjDbl=()=>{const b=gm.bj;if(!b||b.done||cash<b.bet)return;cash-=b.bet;b.bet*=2;b.p.push(draw());bjEnd()};
function gAct(a){const i=a.indexOf(':'),k=i<0?a:a.slice(0,i),v=i<0?'':a.slice(i+1);
 if(k=='bet'){gm.bet=+v;if(!gm.bj||gm.bj.done)render()}else if(k=='spin')sSpin();else if(k=='rspin')rSpin();else if(k=='rclr'){if(!gm.busy){gRefund();rouUI()}}
 else if(k=='rb'){if(gm.busy)return;if(cash<gm.bet)return msg('Not enough cash','#ff6a6a');cash-=gm.bet;gm.rb.push({t:v,amt:gm.bet});rouUI()}else if(k=='deal')bjDeal();else if(k=='hit')bjHit();else if(k=='stand')bjStand();else if(k=='dbl')bjDbl()}
$('md').addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(b)gAct(b.dataset.g)});
