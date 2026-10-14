/* ==================== weather ====================
   In Ember City the weather drifts between CLEAR, CLOUDY, RAIN, STORM and FOG every few in-game hours.
   It thickens the clouds, dims the sun, wets (and slickens) the roads, pulls the fog in and puts umbrellas up;
   storms add lightning and thunder. Story missions keep their own weather, and the other map themes keep theirs. */
const WXK=[{n:'CLEAR',cov:.55,dim:0,rain:0,fog:1},{n:'CLOUDY',cov:.3,dim:.3,rain:0,fog:.85},{n:'RAIN',cov:.14,dim:.5,rain:1,fog:.55},
 {n:'STORM',cov:.05,dim:.66,rain:1.6,fog:.42},{n:'FOG',cov:.34,dim:.35,rain:0,fog:.14}];
/* which weather can follow which (index into WXK) */
const WXN=[[0,0,1,1,4],[0,1,2,2],[1,2,3,1],[2,2],[0,1,1]];
const WEA={k:0,t:0,next:.2,cov:.55,dim:0,rain:0,fog:1,wet:0,lt:6,held:1,mine:0,lbl:''};
const UMBG=new T.ConeGeometry(.75,.35,8),UMBP=new T.CylinderGeometry(.025,.025,1.1,5),UMBM=[0x1a1a22,0xc0392b,0x2a6fd0,0xffd23f,0x3aa86b,0xff4fa3].map(c=>mat(c));
function umbrella_(e){const g=new T.Group();const c=new T.Mesh(UMBG,ri(UMBM));c.position.y=.55;const p=new T.Mesh(UMBP,UMBM[0]);g.add(c,p);g.position.set(.3,1.75,.05);g.visible=false;e.g.add(g);return g}
function wxSet(k,quiet){if(k===WEA.k)return;WEA.k=k;if(!quiet)msg('WEATHER: '+['SKIES CLEARING','CLOUDING OVER','RAIN ROLLING IN','STORM WARNING','FOG ROLLING IN'][k],'#9ad0ff')}
/* hand the sky back (story missions, other maps): clear, dry, normal view distance */
function wxRelease(){WEA.held=1;if(WEA.mine&&RAIN)setRain(0);WEA.mine=0;if(ROADMAT)ROADMAT.roughness=1;SKYU.uCover.value=.55;if(CFG.map==0){const fb=fogBase();sc.fog.near=fb[0];sc.fog.far=fb[1]}}
function wxHold(){return !started||CFG.map!=0||!!ST.act}
function weatherDyn(dt){const held=wxHold();
 if(held){if(!WEA.held)wxRelease();
  WEA.cov=.55;WEA.dim=WEA.rain=WEA.wet=0;WEA.fog=1;txt('wxl','');return}
 WEA.held=0;
 /* pick the next weather every 3-8 in-game hours */
 if(!(NET.on&&!NET.host))WEA.t+=dt/CFG.dayLen;/* online, the host decides the weather */if(WEA.t>=WEA.next){WEA.t=0;WEA.next=rr(.12,.33);wxSet(ri(WXN[WEA.k]))}
 const W=WXK[WEA.k],k=Math.min(1,dt*.06);WEA.cov+=(W.cov-WEA.cov)*k;WEA.dim+=(W.dim-WEA.dim)*k;WEA.fog+=(W.fog-WEA.fog)*k;WEA.rain+=(W.rain-WEA.rain)*Math.min(1,dt*.15);
 WEA.wet=Math.max(0,Math.min(1,WEA.wet+(WEA.rain>.3?dt*.05:-dt*.012)));
 SKYU.uCover.value=WEA.cov;
 if(!IN){sun.intensity*=1-WEA.dim;hemi.intensity*=1-WEA.dim*.3;const day_=1-GU.uNight.value;sc.fog.color.lerp(WXG.setRGB(.4,.43,.47).multiplyScalar(.3+.7*day_),Math.min(1,WEA.dim*.8+(1-WEA.fog)*.5));
  /* grey the sky dome to match: overcast top, horizon fading into the fog, no sun disc */
  const U=SKYU,fk=Math.min(1,(1-WEA.fog)*1.15);U.uHor.value.lerp(sc.fog.color,Math.min(1,fk+WEA.dim*.6));U.uTop.value.lerp(sc.fog.color,Math.min(1,fk*.8+WEA.dim*.55));U.uCloud.value.multiplyScalar(1-WEA.dim*.45);U.uSunCol.value.multiplyScalar(1-WEA.dim*.85)}
 {const fb=fogBase();sc.fog.near=fb[0]*Math.max(.08,WEA.fog);sc.fog.far=fb[1]*Math.max(.12,WEA.fog)}
 if(ROADMAT)ROADMAT.roughness=1-.58*WEA.wet;
 /* rain: reuse the story's rain streaks (they follow the camera) */
 if(WEA.rain>.08){if(!RAIN){setRain(1);WEA.mine=1;if(ROADMAT)ROADMAT.userData.r0=1}if(WEA.mine){RAIN.material.opacity=Math.min(.6,.22+.25*WEA.rain);RAIN.visible=!IN;if(!ST.on)wxRainMove(dt)}}
 else if(RAIN&&WEA.mine){setRain(0);WEA.mine=0}
 /* storm: lightning every few seconds, thunder a moment later */
 if(WEA.k==3&&!IN&&!cut&&(WEA.lt-=dt)<=0){WEA.lt=rr(5,13);const f=$('fx');f.style.background='#cfe0ff';f.style.opacity=.32;setTimeout(()=>f.style.opacity=0,110);setTimeout(()=>{snd(46,2.4,'sawtooth',.07);snd(70,1.2,'triangle',.05)},rr(400,1600))}
 /* umbrellas up when it rains */
 const up=WEA.rain>.5&&!IN;for(const e of peds){if(!e.umb&&up&&!e.arm&&!e.gang&&!e.crew)e.umb=umbrella_(e);if(e.umb){const v=up&&!e.dead&&!e.hostile&&!e.far&&e.fl<=0;if(e.umb.visible!==v)e.umb.visible=v}}
 const l=WXK[WEA.k].n;if(l!==WEA.lbl){WEA.lbl=l;txt('wxl',l)}}
const WXG=new T.Color();
function wxRainMove(dt){const a=RAIN.geometry.attributes.position.array,sp=34+WEA.rain*6;for(let i=0;i<a.length;i+=6){let y=a[i+1]-dt*sp;if(y<0)y+=36;a[i+1]=y;a[i+4]=y-.9}RAIN.geometry.attributes.position.needsUpdate=true;RAIN.position.set(cam.position.x,cam.position.y-16,cam.position.z)}
/* grip: wet roads make cars slower to turn and to stop */
const wxGrip=()=>1-.28*WEA.wet;
