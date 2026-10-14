/* Ember City bootstrap: loads three.js (ES modules), exposes it to the game, then runs the game sources
   (listed in manifest.js) as one classic script so they share a single global scope, exactly like the bundled build. */
import * as THREE_NS from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GAME_FILES} from './manifest.js';

window.THREE=Object.assign({},THREE_NS,{EffectComposer,RenderPass,ShaderPass,UnrealBloomPass,OutputPass,GTAOPass,SMAAPass,RoundedBoxGeometry});
const bar=document.getElementById('bootp'),txt=document.getElementById('boott');
window.__emberBootDone=()=>{bar.style.width='100%';setTimeout(()=>document.getElementById('boot').classList.add('done'),250)};
function fail(e){txt.textContent='Failed to start: '+(e&&e.message||e);txt.style.color='#ff6a6a';console.error(e)}
addEventListener('error',e=>{if(!document.getElementById('boot').classList.contains('done'))fail(e.error||e.message)});
(async()=>{try{
 let code;
 if(window.__EMBER_BUNDLE__)code=document.getElementById('ember-game').textContent;
 else{const parts=[];for(let i=0;i<GAME_FILES.length;i++){const f=GAME_FILES[i];txt.textContent='Loading '+f.replace(/\.js$/,'')+'…';bar.style.width=(5+i/GAME_FILES.length*60)+'%';
   const r=await fetch('src/'+f);if(!r.ok)throw new Error('could not load src/'+f);parts.push('\n;/* ===== src/'+f+' ===== */\n'+await r.text())}
  code=parts.join('')+'\n//# sourceURL=ember-city-game.js'}
 txt.textContent='Building the city…';bar.style.width='72%';await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,30)));
 const s=document.createElement('script');s.textContent=code;document.body.appendChild(s);
}catch(e){fail(e)}})();
