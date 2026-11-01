// Renders the scene at low resolution, then: chromatic fringing, gamma, dithered colour crush,
// grain, vignette, blood running down the lens, panic wobble, and the locker slats.
import * as THREE from 'three';
import { G } from './state.js';
import { screenBloodTex } from './textures.js';

export function createPost(renderer) {
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, depthBuffer: true });
  const U = {
    tDiffuse: { value: rt.texture }, tBlood: { value: screenBloodTex() }, uRes: { value: new THREE.Vector2(2, 2) }, uTime: { value: 0 },
    uFear: { value: 0 }, uBlood: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 0, 0) }, uGamma: { value: 2.2 },
    uDistort: { value: 0 }, uBlack: { value: 1 }, uLocker: { value: 0 }, uAspect: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D tDiffuse, tBlood; uniform vec2 uRes; uniform float uTime, uFear, uBlood, uFlash, uGamma, uDistort, uBlack, uLocker, uAspect; uniform vec3 uFlashCol;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float b2(vec2 a){ a=floor(a); return fract(dot(a, vec2(0.5, a.y*0.75))); }
      float bayer(vec2 a){ return b2(0.5*a)*0.25 + b2(a); }
      void main(){
        vec2 uv = vUv;
        float d = uDistort;
        uv.x += sin(uv.y*28.0 + uTime*6.0) * 0.0035 * d + (hash(vec2(floor(uv.y*uRes.y*0.25), floor(uTime*20.0))) - 0.5) * 0.012 * d * step(0.8, hash(vec2(floor(uTime*9.0))));
        uv.y += sin(uv.x*22.0 + uTime*4.0) * 0.0025 * d;
        vec2 px = (floor(uv*uRes)+0.5)/uRes;
        vec2 dir = px - 0.5;
        float ca = 0.0012 + uFear*0.0035 + d*0.006;
        vec3 col;
        col.r = texture2D(tDiffuse, px + dir*ca).r;
        col.g = texture2D(tDiffuse, px).g;
        col.b = texture2D(tDiffuse, px - dir*ca).b;
        col = pow(max(col, 0.0), vec3(1.0/uGamma));
        float l = dot(col, vec3(0.299,0.587,0.114));
        col = mix(vec3(l), col, 0.82) * vec3(0.96, 1.0, 0.94);
        // blood on the lens
        vec4 bl = texture2D(tBlood, vec2(vUv.x, vUv.y + uTime*0.004*uBlood));
        float r = length(dir * vec2(uAspect, 1.0));
        float bm = clamp(bl.a * smoothstep(0.0, 1.0, uBlood*1.4 - (1.0 - r)*0.6), 0.0, 1.0);
        col = mix(col, vec3(0.22, 0.0, 0.0) + bl.rgb*0.25, bm * 0.92);
        col = mix(col, col*vec3(1.0,0.2,0.18), clamp(uBlood*r*1.2, 0.0, 1.0));
        // vignette
        col *= smoothstep(1.05, 0.28, r * (1.0 + uFear*0.35));
        // grain
        float g = hash(floor(uv*uRes) + fract(uTime*7.3)*91.7) - 0.5;
        col += g * (0.045 + uFear*0.05);
        // dithered crush to ~5 bits per channel
        float bay = bayer(floor(vUv*uRes));
        col = floor(col*30.0 + bay) / 30.0;
        // locker slats: you see the room through thin horizontal gaps
        if (uLocker > 0.0) {
          vec2 q = vUv;
          float inBand = smoothstep(0.34, 0.37, q.y) * (1.0 - smoothstep(0.7, 0.73, q.y)) * smoothstep(0.2, 0.24, q.x) * (1.0 - smoothstep(0.76, 0.8, q.x));
          float slit = smoothstep(0.36, 0.42, fract(q.y*22.0)) * (1.0 - smoothstep(0.82, 0.88, fract(q.y*22.0)));
          float m = inBand * slit;
          vec3 inside = vec3(0.012, 0.012, 0.01) + col*0.04;
          col = mix(col, mix(inside, col, m), uLocker);
        }
        col = mix(col, uFlashCol, uFlash);
        col *= (1.0 - uBlack);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const scene2 = new THREE.Scene(); scene2.add(quad);
  const cam2 = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let scale = 3;
  const P = {
    U,
    setScale(s) { scale = s; P.resize(); },
    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      const lh = Math.max(200, Math.round(h / scale)), lw = Math.round(lh * w / h);
      rt.setSize(lw, lh); U.uRes.value.set(lw, lh); U.uAspect.value = w / h;
      renderer.setSize(w, h, false);
    },
    render(scene, camera) {
      U.uTime.value = G.time; U.uFear.value = G.fear; U.uBlood.value = G.blood; U.uFlash.value = G.flash; U.uFlashCol.value.copy(G.flashCol);
      U.uGamma.value = 2.2 * G.brightness; U.uDistort.value = G.distort; U.uBlack.value = G.black; U.uLocker.value = G.player?.hidden ? Math.min(1, G.player.lockerAnim * 1.5) : 0;
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.render(scene2, cam2);
    },
  };
  return P;
}
