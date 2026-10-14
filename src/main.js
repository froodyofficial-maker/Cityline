/* ---- boot: title screen flyover, then the main loop ---- */
setW('pistol');
let last=performance.now(),titleT=0;
function titleCam(dt){titleT+=dt;const a=titleT*.03+.5;cam.position.set(28+Math.sin(a)*120,58+Math.sin(titleT*.06)*8,8+Math.cos(a)*120);cam.lookAt(18,4,0)}
function loop(n){requestAnimationFrame(loop);if(started||homeOn)drsU(n-last);const dt=Math.max(0,Math.min((n-last)/1000,.05))*tScale;last=n;
 if(started){if(mode=='play')update(dt);renderFrame()}
 else if(homeOn){titleCam(dt);tod=.79;skyU();sunPlace();worldU(dt);renderFrame()}}
setCar(cars[cars.length-1],12,14,PI/2);P.g.position.set(P.x,0,P.z);camYaw=0;mmInit();cam.position.set(70,60,70);
initGfx();gfxFinalize();P.g.visible=false;requestAnimationFrame(loop);
if(window.__emberBootDone)window.__emberBootDone();
