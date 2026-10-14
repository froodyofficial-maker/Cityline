/* ==================== online play: host your world, friends join with a 6-letter code ====================
   N opens the multiplayer menu (open world only, never story mode). HOST MY WORLD gives you a code like K7Q2MX;
   a friend types it into JOIN and lands next to you. Up to 8 players.
   Players find each other through a public PeerJS broker (a WebSocket matchmaking server), then talk directly
   over WebRTC data channels; the host relays between everyone (star). Time of day and weather follow the host.
   Each player keeps their own cash, properties and street life; you see each other, your dogs, cars and shots, and chat. */
const NET={on:0,host:0,code:'',id:'',hostId:'',sig:null,peers:new Map(),pres:new Map(),ls:{},st:'',hb:0,ws:0,max:8,tp:0,ret:0};
const NETICE=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},{urls:'stun:global.stun.twilio.com:3478'}];
function netBroker(){try{const b=localStorage.getItem('embercity_broker');if(b)return b}catch(e){}return'wss://0.peerjs.com:443/peerjs?key=peerjs'}
const netPid=c=>'embercity-'+String(c).toLowerCase(),netClean=s=>String(s||'').replace(/[^A-Za-z0-9 _-]/g,'').slice(0,16)||'PLAYER';
function netCode(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';const r=new Uint32Array(6);crypto.getRandomValues(r);for(const v of r)s+=A[v%A.length];return s}
/* ---------- matchmaking (PeerJS server protocol: OPEN / OFFER / ANSWER / CANDIDATE / LEAVE / EXPIRE / HEARTBEAT) ---------- */
function sigOpen(id){return new Promise((res,rej)=>{let ok=0,ws;try{ws=new WebSocket(netBroker()+'&id='+encodeURIComponent(id)+'&token='+Math.random().toString(36).slice(2,12)+'&version=1.5.4')}catch(e){rej('unreachable');return}
 ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}if(!m||typeof m.type!='string')return;if(m.type=='OPEN'){ok=1;NET.hb=performance.now();res(ws)}else if(m.type=='ID-TAKEN'){rej('taken');ws.close()}else if(m.type=='ERROR'&&!ok){rej('error');ws.close()}else sigMsg(m)};
 ws.onerror=()=>{if(!ok)rej('unreachable')};ws.onclose=()=>{if(!ok)rej('unreachable');else if(NET.sig===ws){NET.sig=null;if(NET.host&&NET.on)netSigRetry()}};setTimeout(()=>{if(!ok){rej('timeout');try{ws.close()}catch(x){}}},10000)})}
const sigSend=(type,dst,payload)=>{if(NET.sig&&NET.sig.readyState==1)NET.sig.send(JSON.stringify({type,dst,payload}))};
/* the host keeps its code if the matchmaking connection drops: reconnect with the same id */
function netSigRetry(){if(NET.ret++>6)return;setTimeout(async()=>{if(!NET.on||!NET.host||NET.sig)return;try{NET.sig=await sigOpen(NET.id);NET.ret=0}catch(e){netSigRetry()}},2500+NET.ret*1500)}
function sigMsg(m){const src=String(m.src||''),p=m.payload||{};
 if(m.type=='OFFER'&&NET.host&&p.sdp)netAccept(src,p);
 else if(m.type=='ANSWER'&&!NET.host){const q=NET.peers.get(src);if(!q)return;if(p.full){netFail('That world is full (8 players).');return}if(p.sdp)q.pc.setRemoteDescription(p.sdp).then(()=>netIce(q)).catch(()=>netFail('Could not connect to that world.'))}
 else if(m.type=='CANDIDATE'){const q=NET.peers.get(src);if(!q||!p.candidate)return;if(q.pc.remoteDescription)q.pc.addIceCandidate(p.candidate).catch(()=>{});else q.ice.push(p.candidate)}
 else if(m.type=='EXPIRE'&&!NET.host&&NET.st=='joining')netFail('No world with code '+NET.code+'. Check the code - the host must be in the game.');
 else if(m.type=='LEAVE'&&NET.peers.has(src))netDrop(src)}
function netIce(q){for(const c of q.ice)q.pc.addIceCandidate(c).catch(()=>{});q.ice.length=0}
function netPC(pid){const pc=new RTCPeerConnection({iceServers:NETICE}),q={pid,pc,dc:null,ice:[],name:'',open:0};NET.peers.set(pid,q);
 pc.onicecandidate=e=>{if(e.candidate)sigSend('CANDIDATE',pid,{candidate:e.candidate,type:'data'})};
 pc.onconnectionstatechange=()=>{if(pc.connectionState=='failed'||pc.connectionState=='closed')netDrop(pid)};return q}
/* ---------- host / join / leave ---------- */
function netOK(){if(ST.on)return'Multiplayer is for Open World only - not story mode.';if(CFG.mode==1)return'Multiplayer needs the OPEN CITY game mode (not WAR).';if(typeof RTCPeerConnection=='undefined'||typeof WebSocket=='undefined')return'This browser cannot play online.';return''}
async function netHost(){const no=netOK();if(no)return msg(no,'#ff6a6a');if(NET.on||NET.st)return;NET.st='hosting';netMenu();
 for(let t=0;t<4;t++){const code=netCode();try{NET.sig=await sigOpen(netPid(code));Object.assign(NET,{on:1,host:1,code,id:netPid(code),hostId:netPid(code),st:'',ret:0});mpBind();chatLog('','You are hosting. Your world code is '+code+' - send it to your friends.','#2bf0ff');netMenu();return}
  catch(e){if(e!='taken'){NET.st='';netErr('Could not reach the matchmaking server. Check your internet connection.');return}}}NET.st='';netErr('Could not get a world code. Try again.')}
async function netJoin(code){const no=netOK();if(no)return msg(no,'#ff6a6a');code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length!=6)return netErr('World codes are 6 letters/numbers, like K7Q2MX.');if(NET.on||NET.st)return;
 NET.st='joining';NET.code=code;NET.hostId=netPid(code);NET.host=0;NET.id=NET.hostId+'-'+netCode().toLowerCase();netMenu();
 try{NET.sig=await sigOpen(NET.id)}catch(e){NET.st='';netErr('Could not reach the matchmaking server. Check your internet connection.');return}
 const q=netPC(NET.hostId),dc=q.pc.createDataChannel('ember',{ordered:true});netDC(q,dc);
 try{const o=await q.pc.createOffer();await q.pc.setLocalDescription(o);sigSend('OFFER',NET.hostId,{sdp:q.pc.localDescription,type:'data',connectionId:'dc_'+netCode().toLowerCase(),n:netClean(CFG.name)})}catch(e){netFail('Could not connect to that world.');return}
 setTimeout(()=>{if(NET.st=='joining')netFail('Could not connect to '+code+'. The host may have left, or a firewall is blocking the connection.')},16000)}
function netAccept(src,p){if(!src.startsWith(NET.id+'-'))return;if(NET.peers.size>=NET.max-1){sigSend('ANSWER',src,{full:1});return}if(NET.peers.has(src))netDrop(src);
 const q=netPC(src);q.name=netClean(p.n);q.pc.ondatachannel=e=>netDC(q,e.channel);
 q.pc.setRemoteDescription(p.sdp).then(()=>{netIce(q);return q.pc.createAnswer()}).then(a=>q.pc.setLocalDescription(a)).then(()=>sigSend('ANSWER',src,{sdp:q.pc.localDescription,type:'data'})).catch(()=>netDrop(src))}
function netDC(q,dc){q.dc=dc;dc.onmessage=e=>netRecv(q,e.data);dc.onclose=()=>netDrop(q.pid);
 dc.onopen=()=>{q.open=1;if(!NET.host){Object.assign(NET,{on:1,st:'',tp:0});try{NET.sig&&NET.sig.close()}catch(e){}NET.sig=null;mpBind();netSend('hi',{n:netClean(CFG.name)});chatLog('','Joined world '+NET.code+'!','#43ff7a');if(mode=='cas'&&$('mdp').querySelector('.netp'))closeCas()}}}
const netRefresh=()=>{if(mode=='cas'&&$('mdp').querySelector('.netp'))netMenu()};
function netFail(t){netLeave(1);netErr(t)}
function netErr(t){msg(t,'#ff6a6a');if(mode=='cas'&&$('mdp').querySelector('.netp'))netMenu(t)}
function netLeave(quiet){for(const q of NET.peers.values()){try{q.dc&&q.dc.close()}catch(e){}try{q.pc.close()}catch(e){}}NET.peers.clear();NET.pres.clear();try{NET.sig&&NET.sig.close()}catch(e){}NET.sig=null;
 const was=NET.on;Object.assign(NET,{on:0,host:0,st:'',code:'',ret:0});mpReset();if(was&&!quiet)chatLog('','You left the online world.','#ffb02b')}
function netDrop(pid){const q=NET.peers.get(pid);if(!q)return;NET.peers.delete(pid);NET.pres.delete(pid);try{q.pc.close()}catch(e){}
 if(NET.host){if(q.name){chatLog('',q.name+' left.','#ffb02b');netSend('sys',{left:pid,n:q.name})}netRefresh()}
 else if(pid==NET.hostId&&NET.on){netLeave(1);chatLog('','The host closed the world.','#ff6a6a')}}
/* ---------- messages: {t:type, d:data, f:from}. Clients talk to the host; the host relays to everyone else ---------- */
function netSend(t,d,only){const s=JSON.stringify({t,d,f:NET.id});for(const q of NET.peers.values())if(q.open&&q.dc&&q.dc.readyState=='open'&&(!only||q===only))try{q.dc.send(s)}catch(e){}}
function netRecv(q,raw){if(typeof raw!='string'||raw.length>8000)return;let m;try{m=JSON.parse(raw)}catch(e){return}if(!m||typeof m.t!='string'||m.t.length>12)return;
 if(NET.host){m.f=q.pid;/* never trust a client about who it is */const s=JSON.stringify(m);for(const o of NET.peers.values())if(o!==q&&o.open&&o.dc.readyState=='open')try{o.dc.send(s)}catch(e){}
  if(m.t=='hi'&&!q.hi){q.hi=1;q.name=netClean(m.d&&m.d.n||q.name);chatLog('',q.name+' joined your world!','#43ff7a');netSend('sys',{n:q.name,join:1});netWorld();netRefresh()}}
 const f=String(m.f||''),d=m.d||{};
 if(m.t=='p'){NET.pres.set(f,{d,ts:performance.now()});if(!NET.host&&!NET.tp&&f==NET.hostId)netArrive(d);return}
 if(m.t=='w'&&!NET.host&&f==NET.hostId){netWorldIn(d);return}
 if(m.t=='sys'&&!NET.host){if(d.left){NET.pres.delete(String(d.left));chatLog('',netClean(d.n)+' left.','#ffb02b')}else if(d.join&&netClean(d.n)!==netClean(CFG.name))chatLog('',netClean(d.n)+' joined!','#43ff7a');return}
 for(const cb of NET.ls[m.t]||[])try{cb({data:d,peer:f,sameTab:false})}catch(e){}}
/* the room interface the multiplayer code uses */
const NETROOM={emit:(t,d)=>{netSend(t,d);return Promise.resolve()},on:(t,cb)=>{(NET.ls[t]=NET.ls[t]||[]).push(cb)},presence:p=>{netSend('p',p);return Promise.resolve()},
 peers:()=>{const now=performance.now(),a=[{peer:NET.id,sameTab:true}];for(const[f,v]of NET.pres)if(now-v.ts<5000&&f!==NET.id)a.push({peer:f,kind:'viewer',presence:v.d});return a}};
/* ---------- the world follows the host: clock, day length, weather ---------- */
function netWorld(){if(NET.host&&NET.on)netSend('w',{tod:+tod.toFixed(4),dl:CFG.dayLen,wx:WEA.k,day})}
function netWorldIn(d){if(typeof d.tod=='number'){let df=d.tod-tod;df-=Math.round(df);if(Math.abs(df)>.003)tod=(d.tod+1)%1}if(typeof d.dl=='number'&&d.dl>=30)CFG.dayLen=d.dl;if(typeof d.wx=='number'&&WXK[d.wx|0])wxSet(d.wx|0)}
/* first time we see the host: walk over to them */
function netArrive(d){if(typeof d.x!='number'||typeof d.z!='number')return;NET.tp=1;if(IN||cut){chatLog('','Your host is at '+zoneOf(d.x,d.z)+'.','#2bf0ff');return}
 const x=d.x+2.5,z=d.z+2.5;if(P.car){setCar(P.car,d.x+5,d.z+5,P.car.h);P.car.v=0}else if(!P.heli&&!P.plane&&!P.tank){P.x=x;P.z=z;P.y=Math.max(0,d.y||0)}ROSY.x=x+1;ROSY.z=z+1;msg('You arrived in the host\'s world','#43ff7a')}
function netU(dt){if(!NET.on&&!NET.st)return;const now=performance.now();if(NET.sig&&NET.sig.readyState==1&&now-NET.hb>5000){NET.hb=now;NET.sig.send('{"type":"HEARTBEAT"}')}
 if(NET.host&&now-NET.ws>2000){NET.ws=now;netWorld()}}
/* ---------- the N menu ---------- */
function netMenu(err){const no=netOK();let h='<div class="netp"><h2>MULTIPLAYER</h2>';
 if(no)h+='<div class="stat">'+no+'</div>';
 else if(NET.st=='hosting')h+='<div class="stat">GETTING A WORLD CODE...</div>';
 else if(NET.st=='joining')h+='<div class="stat">JOINING '+NET.code+'...</div><button data-a="net:leave">CANCEL</button>';
 else if(NET.on){const nm=new Map();for(const[f,v]of NET.pres)nm.set(f,netClean(v.d.n)+(f==NET.hostId?' (HOST)':''));if(NET.host)for(const q of NET.peers.values())if(q.hi)nm.set(q.pid,q.name);const list=[netClean(CFG.name)+(NET.host?' (HOST - YOU)':' (YOU)'),...nm.values()];
  if(NET.host)h+='<div class="stat">YOUR WORLD CODE</div><div class="ncode">'+NET.code+'</div><button data-a="net:copy">COPY CODE</button><div class="stat">FRIENDS PRESS N, PICK JOIN AND TYPE THIS CODE</div>';
  else h+='<div class="stat">IN WORLD '+NET.code+'</div>';
  h+='<div class="stat">PLAYERS '+list.length+'/'+NET.max+'</div>'+list.map(n=>'<div class="ln"><span>'+n.replace(/[<>&]/g,'')+'</span></div>').join('');
  h+='<div class="stat">Y OR ENTER - CHAT</div><button data-a="net:leave">'+(NET.host?'CLOSE MY WORLD':'LEAVE WORLD')+'</button>'}
 else h+='<div class="stat">YOUR NAME</div><input id="nnm" maxlength="16" value="'+netClean(CFG.name)+'"><button class="sbig" data-a="net:host">HOST MY WORLD</button><div class="stat">OR JOIN A FRIEND - TYPE THEIR CODE</div><input id="nci" maxlength="8" placeholder="K7Q2MX" autocomplete="off"><button class="sbig" data-a="net:join">JOIN</button><div class="stat">OPEN WORLD ONLY - UP TO 8 PLAYERS</div>';
 if(err)h+='<div class="stat nerr">'+String(err).replace(/[<>&]/g,'')+'</div>';openMd(h+'<button data-a="close">CLOSE (N)</button></div>');const ci=$('nci');if(ci)setTimeout(()=>ci.focus(),50)}
function netAct(id){const nm=$('nnm');if(nm){CFG.name=netClean(nm.value);saveCfg()}
 if(id=='host')netHost();else if(id=='join')netJoin(($('nci')||{}).value);else if(id=='leave'){netLeave();netMenu()}
 else if(id=='copy'){const c=NET.code;(navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(c):Promise.reject()).catch(()=>{const t=document.createElement('textarea');t.value=c;document.body.appendChild(t);t.select();try{document.execCommand('copy')}catch(e){}t.remove()}).finally(()=>msg('CODE '+c+' COPIED','#43ff7a'))}}
/* ---------- chat log ---------- */
function chatLog(n,t,col){const L=$('clog');if(!L)return;const d=document.createElement('div');if(n){const b=document.createElement('b');b.textContent=n+': ';b.style.color=col||'#ffe27a';d.appendChild(b);d.appendChild(document.createTextNode(t))}else{d.textContent=t;d.style.color=col||'#ccc'}
 L.appendChild(d);while(L.children.length>8)L.firstChild.remove();d.t=performance.now();L.classList.add('on');clearTimeout(chatLog.tm);chatLog.tm=setTimeout(()=>{if($('chat').style.display!='block')L.classList.remove('on')},12000)}
