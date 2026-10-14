/* ==================== rendering pipeline ====================
   Quality presets, post-processing chain and dynamic lights.
   Chain (MEDIUM+): Render -> Bloom (half resolution) -> Grade (god rays, ACES, colour) -> Output (sRGB) -> [SMAA]
   three.js r155+ uses physical light units, so artistic intensities are scaled by LI. */
const LI=Math.PI;
const GSV=new T.Vector3();let ILS=null,HEADL=null,KEYL=null,outP=null;
const QUAD_VS='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const GRADE_FS=`uniform sampler2D tDiffuse;uniform float time;uniform float sat;uniform float vig;uniform vec2 uSun;uniform float uRay;uniform vec3 uRayCol;uniform float uExpo;uniform float uWarm;varying vec2 vUv;
float rnd(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec2 c=vUv-.5;float ca=dot(c,c)*.004;vec3 col=vec3(texture2D(tDiffuse,vUv+c*ca).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-c*ca).b);
 if(uRay>.001){vec2 dl=(vUv-uSun)*(.9/28.);vec2 tc=vUv;float il=0.,dc=1.;for(int i=0;i<28;i++){tc-=dl;vec3 s=texture2D(tDiffuse,clamp(tc,0.,1.)).rgb;il+=max(dot(s,vec3(.3,.59,.11))-1.,0.)*dc;dc*=.94;}col+=uRayCol*il*uRay*.06;}
 col=aces(col*uExpo);float l=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(l),col,sat);
 col+=(vec3(-.012,.004,.022)*(1.-l)+vec3(.022,.008,-.016)*l)*uWarm;col*=1.-vig*dot(c,c)*1.9;gl_FragColor=vec4(max(col,0.),1.);}`;
function initGfx(){const q=CFG.gfx;BASEPR=Math.min(devicePixelRatio,q>=3?2:q>=2?1.5:1.25);DRS.s=1;rd.setPixelRatio(BASEPR);rd.shadowMap.enabled=true;rd.shadowMap.type=q>=1?T.PCFSoftShadowMap:T.PCFShadowMap;
 const ms=q>=3?3072:q>=2?2048:q>=1?1536:1024;sun.shadow.mapSize.set(ms,ms);{const s=sun.shadow.camera,e=q>=3?80:q>=2?66:50;s.left=s.bottom=-e;s.right=s.top=e;s.near=1;s.far=260;s.updateProjectionMatrix()}
 if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}sun.shadow.bias=-.00025;sun.shadow.normalBias=.035;
 envSetup(q>=3?256:q>=2?128:q>=1?64:0);RF.on=q>=2&&!!WATER;RF.s=q>=3?.5:.33;if(RF.on&&!RF.rt)RF.rt=new T.WebGLRenderTarget(16,16,{type:T.HalfFloatType});
 if(comp&&comp.dispose)comp.dispose();comp=null;outP=bloomP=gradeP=null;rd.toneMapping=T.NoToneMapping;
 if(q>=1&&T.EffectComposer){try{const w=innerWidth,h=innerHeight,pr=rd.getPixelRatio(),rt=new T.WebGLRenderTarget(w*pr,h*pr,{type:T.HalfFloatType,samples:q>=2?4:0});
  comp=new T.EffectComposer(rd,rt);comp.addPass(new T.RenderPass(sc,cam));
  bloomP=new T.UnrealBloomPass(new T.Vector2(w/2,h/2),.5,.5,.9);comp.addPass(bloomP);
  gradeP=new T.ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0},sat:{value:1.08},vig:{value:.38},uSun:{value:new T.Vector2(.5,.5)},uRay:{value:0},uRayCol:{value:new T.Color(1,.9,.7)},uExpo:{value:.95},uWarm:{value:1}},vertexShader:QUAD_VS,fragmentShader:GRADE_FS});comp.addPass(gradeP);
  outP=new T.OutputPass();comp.addPass(outP);
  if(q==1&&T.SMAAPass)comp.addPass(new T.SMAAPass(w*pr,h*pr));comp.setSize(w,h)}catch(e){comp=null;console.warn('post-processing unavailable',e)}}
 if(!comp){rd.toneMapping=T.ACESFilmicToneMapping;rd.toneMappingExposure=1}
 /* view distance per preset: on HIGH+ the skyline fades out far away, with no haze near the street */
 const fb=fogBase();sc.fog.near=fb[0];sc.fog.far=fb[1];cam.far=q>=2?900:sc.fog.far+40;cam.updateProjectionMatrix()}
function fogBase(){const q=CFG.gfx;return[q>=2?300:160,q>=2?1100:q>=1?480:350]}
/* dynamic resolution: keep the frame rate up by trading render resolution (50-100% of the preset) */
let BASEPR=1;const DRS={s:1,ema:16,t:0};
function drsU(ms){if(document.hidden||!(ms>0))return;DRS.ema+=(Math.min(ms,100)-DRS.ema)*.05;DRS.t+=ms;if(DRS.t<1500)return;DRS.t=0;
 let s=DRS.s;if(DRS.ema>21)s=Math.max(.5,s-.1);else if(DRS.ema<14.5&&s<1)s=Math.min(1,s+.05);
 if(s!==DRS.s){DRS.s=s;const p=BASEPR*s;rd.setPixelRatio(p);if(comp)comp.setPixelRatio(p);rs()}}
/* F3: frames-per-second counter */
let FPSE=null,FPSA=0,FPSN=0,FPST=0;
function fpsU(ms){if(!FPSE)return;FPSA+=ms;FPSN++;if((FPST+=ms)>500){FPSE.textContent=Math.round(1000/(FPSA/FPSN))+' FPS  '+rd.info.render.calls+' calls';FPSA=FPSN=FPST=0}}
addEventListener('keydown',e=>{if(e.code=='F3'){e.preventDefault();if(FPSE){FPSE.remove();FPSE=null}else{FPSE=document.createElement('div');FPSE.id='fps';document.body.appendChild(FPSE)}}});
function gradeU(){if(!gradeP)return;const u=gradeP.uniforms,day=Math.max(0,Math.min(1,-cos(tod*2*PI)*2.2+.4)),n=1-day,du=Math.max(0,1-Math.abs(-cos(tod*2*PI))*4);u.time.value=performance.now()*.001;
 if(bloomP){bloomP.strength=IN?.18:.16+.45*n;bloomP.threshold=IN?1.6:1.05-.35*n;bloomP.radius=.42+.22*n}u.uExpo.value=IN?.8:.95+.1*n;
 const d=SKYU.uSunDir.value;GSV.copy(cam.position).addScaledVector(d,300).project(cam);const vis=GSV.z<1&&d.y>-.02&&!IN?Math.max(0,1-Math.max(Math.abs(GSV.x),Math.abs(GSV.y))*.6):0;
 u.uSun.value.set(GSV.x*.5+.5,GSV.y*.5+.5);u.uRay.value=CFG.gfx>=2?vis*(1-n):0;u.uRayCol.value.copy(SKYU.uSunCol.value);u.uWarm.value=.6+.6*day}

function lightsU(){if(!ILS){ILS=[];sc.traverse(o=>{if(o.isPointLight)ILS.push(o)});for(const l of ILS){l.decay=1.6;l.intensity*=LI*(LOWM?1:.75)}HEADL=new T.SpotLight(0xfff0d0,0,52,.55,.55,1.3);sc.add(HEADL,HEADL.target);KEYL=new T.PointLight(0xffe4c4,0,18,1.4);sc.add(KEYL)}
 for(const l of ILS){const v=!!IN&&Math.abs(l.position.x-P.x)<40&&Math.abs(l.position.z-P.z)<40;if(l.visible!==v)l.visible=v}
 const c=P.car,n=GU.uNight.value;if(c&&n>.05&&!IN){const s=sin(c.h),k=cos(c.h);HEADL.intensity=26*n;HEADL.position.set(c.x+s*2.3,1.1,c.z+k*2.3);HEADL.target.position.set(c.x+s*16,0,c.z+k*16)}else HEADL.intensity=0;
 if(typeof CIN!=='undefined'&&CIN&&cut){const k2=Math.max(n,IN?.55:0,.12);cam.getWorldDirection(GSV);KEYL.position.copy(cam.position).addScaledVector(GSV,1.1);KEYL.position.y+=1.1;KEYL.intensity=(LOWM?3.2:4.4)*k2}else KEYL.intensity=0}
/* scale image-based lighting per context (outdoor sky vs. enclosed rooms); the material list is rebuilt when the context changes */
let ENVM=null,ENVK=-1,ENVIN=null;function envK(k){if(ENVIN!==IN){ENVIN=IN;ENVM=null}
 if(!ENVM){ENVM=[];ENVK=-1;const s=new Set();sc.traverse(o=>{const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms)if(m&&m.isMeshStandardMaterial&&!s.has(m)){s.add(m);if(m.userData.e0===undefined)m.userData.e0=m.envMapIntensity;ENVM.push(m)}})}
 if(Math.abs(k-ENVK)<.01)return;ENVK=k;for(const m of ENVM)m.envMapIntensity=m.userData.e0*k}
function srgbMaps(){const seen=new Set();sc.traverse(o=>{const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms){if(!m||!m.map||seen.has(m.map))continue;seen.add(m.map);if(m.map.colorSpace!==T.SRGBColorSpace){m.map.colorSpace=T.SRGBColorSpace;m.map.needsUpdate=true}}})}
