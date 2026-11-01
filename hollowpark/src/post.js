// Render pipeline: scene -> (GTAO) -> bloom -> filmic tone map + sRGB -> SMAA -> final grade
// (chromatic fringe, grain, vignette, blood on the lens, panic wobble, hiding slats, fades).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { G } from './state.js';
import { screenBloodTex } from './textures.js';

export const QUALITY = {
  low: { ratio: 0.7, ao: false, bloom: true, smaa: false, shadow: 1024, moonShadow: false },
  medium: { ratio: 1.0, ao: false, bloom: true, smaa: true, shadow: 1024, moonShadow: true },
  high: { ratio: 1.0, ao: true, bloom: true, smaa: true, shadow: 2048, moonShadow: true },
  ultra: { ratio: 1.5, ao: true, bloom: true, smaa: true, shadow: 4096, moonShadow: true },
};

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, tBlood: { value: null }, uTime: { value: 0 }, uFear: { value: 0 }, uBlood: { value: 0 }, uFlash: { value: 0 },
    uFlashCol: { value: new THREE.Color(1, 0, 0) }, uDistort: { value: 0 }, uBlack: { value: 1 }, uLocker: { value: 0 }, uAspect: { value: 1 }, uBright: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse, tBlood; uniform float uTime, uFear, uBlood, uFlash, uDistort, uBlack, uLocker, uAspect, uBright; uniform vec3 uFlashCol; uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; float d = uDistort;
      uv.x += sin(uv.y*24.0 + uTime*6.0) * 0.003 * d; uv.y += sin(uv.x*20.0 + uTime*4.0) * 0.002 * d;
      vec2 dir = uv - 0.5;
      float ca = 0.0008 + uFear*0.0025 + d*0.006;
      vec3 col = vec3(texture2D(tDiffuse, uv + dir*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir*ca).b);
      col *= uBright;
      // a colder, sicker grade in the shadows
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(col, col*vec3(0.88,1.0,1.08), smoothstep(0.35, 0.0, l)*0.6);
      col = mix(vec3(l), col, 0.88 - uFear*0.25);
      // blood on the lens
      vec4 bl = texture2D(tBlood, vec2(vUv.x, vUv.y + uTime*0.004*uBlood));
      float r = length(dir * vec2(uAspect, 1.0));
      float bm = clamp(bl.a * smoothstep(0.0, 1.0, uBlood*1.4 - (1.0 - r)*0.6), 0.0, 1.0);
      col = mix(col, vec3(0.2, 0.0, 0.0) + bl.rgb*0.2, bm * 0.92);
      col = mix(col, col*vec3(1.0,0.25,0.2), clamp(uBlood*r*1.1, 0.0, 1.0));
      col *= smoothstep(1.1, 0.35, r * (1.0 + uFear*0.3));
      col += (hash(vUv*uRes + fract(uTime*7.3)*91.7) - 0.5) * (0.035 + uFear*0.04);
      // hiding: looking out between slats
      if (uLocker > 0.0) {
        float inBand = smoothstep(0.34, 0.37, vUv.y) * (1.0 - smoothstep(0.7, 0.73, vUv.y)) * smoothstep(0.2, 0.24, vUv.x) * (1.0 - smoothstep(0.76, 0.8, vUv.x));
        float f = fract(vUv.y*22.0); float slit = smoothstep(0.36, 0.42, f) * (1.0 - smoothstep(0.82, 0.88, f));
        vec3 inside = vec3(0.01) + col*0.03;
        col = mix(col, mix(inside, col, inBand*slit), uLocker);
      }
      col = mix(col, uFlashCol, uFlash);
      col *= (1.0 - uBlack);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const ao = new GTAOPass(scene, camera, 2, 2); ao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.5, thickness: 1.2, scale: 1.2, samples: 12 }); ao.blendIntensity = 0.85;
  const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.45, 0.55, 0.93);
  const output = new OutputPass();
  const smaa = new SMAAPass(2, 2);
  const final = new ShaderPass(FinalShader); final.uniforms.tBlood.value = screenBloodTex();
  let q = QUALITY.high, qName = 'high';
  const rebuild = () => {
    while (composer.passes.length) composer.removePass(composer.passes[0]);
    composer.addPass(renderPass); if (q.ao) composer.addPass(ao); if (q.bloom) composer.addPass(bloom); composer.addPass(output); if (q.smaa) composer.addPass(smaa); composer.addPass(final);
  };
  const P = {
    U: final.uniforms,
    get quality() { return qName; },
    setQuality(name) { qName = QUALITY[name] ? name : 'high'; q = QUALITY[qName]; rebuild(); P.resize(); G.onQuality?.(q); },
    resize() {
      const w = window.innerWidth, h = window.innerHeight, ratio = Math.min(q.ratio, window.devicePixelRatio || 1) * (G.dynScale || 1);
      renderer.setPixelRatio(ratio); renderer.setSize(w, h, false); composer.setPixelRatio(ratio); composer.setSize(w, h);
      final.uniforms.uAspect.value = w / h; final.uniforms.uRes.value.set(w * ratio, h * ratio);
    },
    render(dt) {
      const U = final.uniforms;
      U.uTime.value = G.time; U.uFear.value = G.fear; U.uBlood.value = G.blood; U.uFlash.value = G.flash; U.uFlashCol.value.copy(G.flashCol);
      U.uDistort.value = G.distort; U.uBlack.value = G.black; U.uBright.value = G.brightness; U.uLocker.value = G.player?.hidden ? Math.min(1, G.player.lockerAnim * 1.5) : 0;
      composer.render(dt);
    },
  };
  P.setQuality('high');
  return P;
}
