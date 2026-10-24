import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as THREE from 'three';
import { Atom, Info, EyeOff } from 'lucide-react';
import { PS5Theme, PS5_THEMES } from '../types/ps5Themes';

export type { PS5Theme };
export { PS5_THEMES };

// =========================================================================
// GLSL VERTEX SHADER
// =========================================================================
const commonVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// =========================================================================
// GLSL FRAGMENT SHADERS (5 ASTROPHYSICS SHADERS)
// =========================================================================

// 1. Kepler Orbit GLSL Shader
const keplerFragmentShader = `
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  uniform vec3 u_accent;
  varying vec2 vUv;

  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 m = (u_mouse - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    
    // Gravitational lensing warp toward mouse pointer
    float mouseDist = length(p - m);
    p += (p - m) * (0.012 / (mouseDist + 0.15));

    float t = u_time * 0.12; // Calm, steady pace

    vec3 col = vec3(0.015, 0.025, 0.05);

    // Deep field stardust
    float stars = fract(sin(dot(p + vec2(1.2, 4.3), vec2(12.9898, 78.233))) * 43758.5453);
    if (stars > 0.992) {
      col += vec3(0.6, 0.8, 1.0) * (0.4 + 0.6 * sin(u_time * 2.0 + stars * 100.0));
    }

    vec2 center = vec2(0.12, -0.02);
    vec2 cp = p - center;
    float r = length(cp);

    // Goldilocks Habitable Zone (0.35 ~ 0.52 radius)
    float hz = smoothstep(0.32, 0.38, r) - smoothstep(0.48, 0.55, r);
    col += vec3(0.05, 0.45, 0.3) * hz * 0.45;

    // Central Star Core Flare
    float sun = 0.035 / (r + 0.01);
    col += vec3(1.0, 0.85, 0.5) * sun * 0.5;

    // Kepler Elliptical Orbit Rings
    float orbits[5];
    orbits[0] = 0.16; orbits[1] = 0.26; orbits[2] = 0.42; orbits[3] = 0.62; orbits[4] = 0.85;

    vec3 planetColors[5];
    planetColors[0] = vec3(0.9, 0.3, 0.3);
    planetColors[1] = vec3(0.95, 0.7, 0.2);
    planetColors[2] = vec3(0.2, 0.85, 0.55); // Habitable
    planetColors[3] = vec3(0.3, 0.6, 0.95);
    planetColors[4] = vec3(0.75, 0.4, 0.95);

    float speeds[5];
    speeds[0] = 2.4; speeds[1] = 1.6; speeds[2] = 1.0; speeds[3] = 0.68; speeds[4] = 0.45;

    for (int i = 0; i < 5; i++) {
      float orbR = orbits[i];
      float ring = abs(r - orbR);
      col += vec3(0.2, 0.4, 0.7) * (0.0018 / (ring + 0.002)) * 0.4;

      // Keplerian speed anomaly (faster near center)
      float angle = t * speeds[i] + float(i) * 1.5;
      vec2 planetPos = vec2(cos(angle), sin(angle)) * orbR;
      float pDist = length(cp - planetPos);
      float planetGlow = 0.015 / (pDist + 0.008);
      col += planetColors[i] * planetGlow * 0.8;
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

// 2. Kerr Black Hole GLSL Shader
const kerrFragmentShader = `
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  varying vec2 vUv;

  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 mouseOffset = (u_mouse / max(u_resolution.xy, vec2(1.0)) - 0.5) * 0.16;
    vec2 center = vec2(0.12, 0.0) + mouseOffset;
    vec2 cp = p - center;

    float r = length(cp);
    float t = u_time * 0.32;

    // Relativistic gravitational deflection ray warping
    float rs = 0.125; // Schwarzschild radius
    float warp = rs / (r * r + 0.032);
    vec2 warpedP = cp * (1.0 + warp * 0.85);
    float wr = length(warpedP);
    float angle = atan(warpedP.y, warpedP.x) + t * (0.38 / (wr + 0.09));

    vec3 col = vec3(0.02, 0.006, 0.018);

    // Accretion Disk with Relativistic Doppler Beaming (Brighter left, dimmer right)
    if (wr > 0.135 && wr < 0.72) {
      float doppler = 0.5 + 0.5 * cos(angle + 1.15);
      float spiral = 0.75 + 0.25 * sin(wr * 42.0 - angle * 3.0 + t * 2.5);
      float diskGlow = smoothstep(0.135, 0.21, wr) * (1.0 - smoothstep(0.46, 0.72, wr));
      vec3 diskCol = mix(vec3(0.98, 0.28, 0.08), vec3(1.0, 0.92, 0.68), pow(doppler, 1.2));
      col += diskCol * diskGlow * spiral * (0.65 + doppler * 0.95);
    }

    // Photon Sphere Ring (at r = 1.5 rs)
    float photonRing = abs(r - rs * 1.38);
    col += vec3(1.0, 0.96, 0.88) * (0.0032 / (photonRing + 0.0026)) * 0.85;

    // Relativistic Polar Jet Glow
    float jet = pow(max(0.0, 1.0 - abs(cp.x) * 6.5), 4.0) * smoothstep(0.12, 0.65, abs(cp.y)) * (0.35 / (r + 0.2));
    col += vec3(0.95, 0.45, 0.75) * jet * 0.45;

    // Event Horizon Shadow (Black Hole Core)
    if (r < rs) {
      col *= smoothstep(0.0, rs, r * 0.65);
    }

    // Spacetime Grid Metrics
    float grid = abs(sin(warpedP.x * 24.0)) * abs(sin(warpedP.y * 24.0));
    col += vec3(0.75, 0.15, 0.35) * pow(grid, 16.0) * 0.22;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// 3. Stellar Fusion GLSL Shader
const stellarFragmentShader = `
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  varying vec2 vUv;

  // Simple pseudo-noise
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p); p *= 2.05; a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 mouseOffset = (u_mouse / max(u_resolution.xy, vec2(1.0)) - 0.5) * 0.14;
    vec2 center = vec2(0.12, 0.0) + mouseOffset;
    vec2 cp = p - center;
    float r = length(cp);
    float t = u_time * 0.22;

    vec3 col = vec3(0.035, 0.008, 0.002);

    // Dynamic Convective Plasma Turbulence (FBM)
    float angle = atan(cp.y, cp.x);
    float n = fbm(vec2(r * 9.0 - t * 0.65, angle * 4.0 + t * 0.28));
    float n2 = fbm(vec2(r * 16.0 - t * 1.1, angle * 8.0 - t * 0.35));

    // Nested Onion Skin Core Layers with high contrast flare
    float core = 0.095 / (r + 0.018);
    col += mix(vec3(1.0, 0.48, 0.08), vec3(1.0, 0.92, 0.55), clamp(n * 1.3, 0.0, 1.0)) * core * (0.65 + 0.55 * n2);

    // Coronal Plasma Loops
    float arc = abs(sin(angle * 6.0 + t * 1.2 + n * 2.0)) * (0.024 / (abs(r - 0.28) + 0.014));
    col += vec3(1.0, 0.85, 0.28) * arc * 0.55;

    // Outer Solar Wind Halo
    col += vec3(0.95, 0.32, 0.05) * (0.05 / (r + 0.14));

    gl_FragColor = vec4(col, 1.0);
  }
`;

// 4. Cosmic Web GLSL Shader
const cosmicWebFragmentShader = `
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  varying vec2 vUv;

  vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
  }

  void main() {
    vec2 p = gl_FragCoord.xy / u_resolution.xy;
    p.x *= u_resolution.x / u_resolution.y;
    vec2 mouseShift = (u_mouse / max(u_resolution.xy, vec2(1.0)) - 0.5) * 0.25;
    float t = u_time * 0.065;

    vec2 st = (p + mouseShift * 0.35) * 4.4;
    vec2 i_st = floor(st);
    vec2 f_st = fract(st);

    float m_dist = 1.0;
    vec2 m_point;

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = hash2(i_st + neighbor);
        point = 0.5 + 0.5 * sin(t + 6.2831 * point);
        vec2 diff = neighbor + point - f_st;
        float dist = length(diff);
        if (dist < m_dist) {
          m_dist = dist;
          m_point = point;
        }
      }
    }

    vec3 col = vec3(0.012, 0.006, 0.028);

    // Dark Matter Filaments Network
    float filament = smoothstep(0.0, 0.26, m_dist) - smoothstep(0.26, 0.52, m_dist);
    col += vec3(0.55, 0.18, 0.88) * filament * 0.68;

    // Galaxy Cluster Nodes
    float nodeGlow = 0.032 / (m_dist + 0.02);
    col += vec3(0.92, 0.68, 1.0) * nodeGlow * 0.52;

    // JWST 6-point Cross Spikes
    float crossDist = abs(fract(st.x) - 0.5) * abs(fract(st.y) - 0.5);
    col += vec3(1.0, 0.88, 0.48) * (0.0008 / (crossDist + 0.0045)) * 0.35;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// 5. Pulsar & Gravitational Waves GLSL Shader
const pulsarFragmentShader = `
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  varying vec2 vUv;

  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 mouseOffset = (u_mouse / max(u_resolution.xy, vec2(1.0)) - 0.5) * 0.15;
    vec2 center = vec2(0.12, 0.0) + mouseOffset;
    vec2 cp = p - center;
    float r = length(cp);
    float t = u_time * 0.52;

    vec3 col = vec3(0.006, 0.018, 0.035);

    // 1. Relativistic Lighthouse Synchrotron Beams
    float beamAngle = atan(cp.y, cp.x) - t * 1.65;
    float beam = pow(abs(cos(beamAngle)), 28.0);
    col += vec3(0.05, 0.98, 1.0) * beam * (0.095 / (r + 0.045)) * 0.95;

    // 2. Dipolar Magnetic Field Lines
    float magnetic = abs(sin(atan(cp.y, cp.x) * 2.0 + sin(t * 0.5) * 0.2)) * (0.018 / (abs(r - 0.25) + 0.018));
    col += vec3(0.25, 0.62, 1.0) * magnetic * 0.48;

    // 3. Spacetime Gravitational Wave Metric Ripples
    float gwRipples = sin(r * 48.0 - t * 4.8);
    col += vec3(0.15, 0.85, 1.0) * pow(abs(gwRipples), 5.0) * (0.038 / (r + 0.18)) * 0.52;

    // 4. Central Neutron Star Core
    float neutron = 0.036 / (r + 0.007);
    col += vec3(0.95, 1.0, 1.0) * neutron * 0.75;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// 6. Golden Bokeh & Light Dust Particles GLSL Shader
const goldenBokehFragmentShader = `
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  uniform vec3 u_accent;
  varying vec2 vUv;

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  // Soft optical bokeh circle with bright edge highlight
  float bokehDisc(vec2 p, vec2 center, float radius, float blur) {
    float d = length(p - center);
    float circle = 1.0 - smoothstep(radius - blur, radius + blur, d);
    float ring = smoothstep(radius - blur * 2.0, radius, d) * (1.0 - smoothstep(radius, radius + blur, d));
    return circle * 0.75 + ring * 0.85;
  }

  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 m = (u_mouse - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

    float t = u_time * 0.22; // Smooth steady flow

    // 1. Deep Atmospheric Dark Night Background with Warm Amber Core
    float centerDist = length(p - vec2(0.05, -0.05));
    vec3 col = mix(vec3(0.09, 0.05, 0.018), vec3(0.015, 0.008, 0.003), smoothstep(0.1, 0.95, centerDist));

    // Mouse ambient warp & light warmth
    float mDist = length(p - m);
    col += vec3(0.25, 0.15, 0.04) * (0.028 / (mDist + 0.16));

    // 2. Soft Ambient Golden Sunbeams / Radial Light Flare
    float rayAngle = p.x * 1.4 - p.y * 2.2;
    float rays = sin(rayAngle * 7.0 + t * 0.4) * 0.5 + 0.5;
    rays = pow(rays, 5.0);
    col += vec3(0.24, 0.15, 0.04) * rays * smoothstep(0.85, -0.6, p.y);

    // 3. Multi-layer Golden Bokeh Circles
    // Layer 1: Background Large Soft Out-of-Focus Orbs
    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      vec2 rand = hash22(vec2(fi * 17.1, fi * 31.4));

      float speedY = 0.07 + rand.x * 0.06;
      float posX = (rand.x - 0.5) * 2.3 + sin(t * 0.35 + fi) * 0.18;
      float posY = fract(rand.y + t * speedY) * 2.4 - 1.2;

      vec2 bCenter = vec2(posX, posY);
      float radius = 0.07 + rand.y * 0.11;
      float b = bokehDisc(p, bCenter, radius, 0.035);

      vec3 bCol = mix(vec3(0.95, 0.62, 0.12), vec3(1.0, 0.82, 0.35), rand.x);
      float pulse = 0.65 + 0.35 * sin(t * 1.3 + fi * 2.1);
      col += bCol * b * 0.22 * pulse;
    }

    // Layer 2: Midground Sharp Translucent Golden Discs
    for (int j = 0; j < 14; j++) {
      float fj = float(j) + 12.0;
      vec2 rand = hash22(vec2(fj * 23.3, fj * 47.1));

      float speedY = 0.11 + rand.x * 0.09;
      float posX = (rand.x - 0.5) * 2.1 + sin(t * 0.5 + fj) * 0.22;
      float posY = fract(rand.y + t * speedY) * 2.4 - 1.2;

      vec2 bCenter = vec2(posX, posY);
      float radius = 0.028 + rand.y * 0.045;
      float b = bokehDisc(p, bCenter, radius, 0.014);

      vec3 bCol = mix(vec3(1.0, 0.72, 0.18), vec3(1.0, 0.92, 0.55), rand.y);
      float pulse = 0.7 + 0.3 * cos(t * 1.7 + fj * 1.4);
      col += bCol * b * 0.35 * pulse;
    }

    // 4. Foreground Sparkling Golden Dust Particles & Light Specs
    for (int k = 0; k < 22; k++) {
      float fk = float(k) + 32.0;
      vec2 rand = hash22(vec2(fk * 13.7, fk * 89.3));

      float speedY = 0.16 + rand.x * 0.14;
      float posX = (rand.x - 0.5) * 2.1 + sin(t * 0.8 + fk) * 0.25;
      float posY = fract(rand.y + t * speedY) * 2.4 - 1.2;

      vec2 pCenter = vec2(posX, posY);
      float dist = length(p - pCenter);

      float particleCore = 0.0022 / (dist + 0.001);
      float particleAura = 0.0085 / (dist + 0.005);

      float twinkle = pow(sin(t * 3.2 + fk * 3.8) * 0.5 + 0.5, 2.5);
      vec3 pCol = mix(vec3(1.0, 0.88, 0.45), vec3(1.0, 0.98, 0.82), rand.x);

      col += pCol * (particleCore * 0.45 + particleAura * 0.22) * (0.35 + 0.65 * twinkle);
    }

    // Subtle edge vignette
    col *= smoothstep(1.25, 0.45, length(p));

    gl_FragColor = vec4(col, 1.0);
  }
`;

// 7. Hypernova Prism & Radiant Aurora Stardust GLSL Shader
const hypernovaFragmentShader = `
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec2 u_mouse;
  uniform vec3 u_accent;
  varying vec2 vUv;

  vec2 hash22_h(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  float hash12_h(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise_h(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash12_h(i);
    float b = hash12_h(i + vec2(1.0, 0.0));
    float c = hash12_h(i + vec2(0.0, 1.0));
    float d = hash12_h(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm_h(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += a * noise_h(p);
      p = rot * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 m = (u_mouse - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float t = u_time * 0.18;

    // Interactive mouse gravity lens offset
    float mDist = length(p - m);
    p += (p - m) * (0.012 / (mDist + 0.2));

    // Dynamic focal center for supernova starburst
    vec2 center = vec2(0.12, 0.08);
    vec2 cp = p - center;
    float r = length(cp);
    float angle = atan(cp.y, cp.x);

    // Deep luxury dark violet & midnight cosmic backdrop
    vec3 col = mix(vec3(0.03, 0.01, 0.07), vec3(0.005, 0.002, 0.012), smoothstep(0.0, 1.2, length(p)));

    // 1. Shimmering Aurora Borealis Curtains (極光光幕與織帶)
    vec2 auroraUV = p * vec2(1.2, 0.8) + vec2(t * 0.08, 0.0);
    float auroraShape1 = sin(p.x * 3.5 + fbm_h(auroraUV * 2.0 + t * 0.3) * 3.0 + t) * 0.5 + 0.5;
    float auroraShape2 = cos(p.x * 2.2 - fbm_h(auroraUV * 1.5 - t * 0.2) * 2.5 + t * 0.7) * 0.5 + 0.5;

    float verticalMask = smoothstep(-0.6, 0.4, p.y) * smoothstep(0.7, -0.2, p.y);
    float auroraIntensity1 = pow(auroraShape1, 2.5) * verticalMask * 0.85;
    float auroraIntensity2 = pow(auroraShape2, 3.0) * verticalMask * 0.65;

    // Shimmering Emerald Green / Cyan shifting into Magenta-Violet Prism
    vec3 auroraCol1 = mix(vec3(0.0, 0.95, 0.65), vec3(0.65, 0.3, 0.95), sin(p.x * 2.0 + t) * 0.5 + 0.5);
    vec3 auroraCol2 = mix(vec3(0.2, 0.8, 1.0), vec3(0.9, 0.3, 0.75), cos(p.y * 3.0 - t) * 0.5 + 0.5);

    col += auroraCol1 * auroraIntensity1 + auroraCol2 * auroraIntensity2;

    // 2. Cosmic Nebula Swirls & Dust Lanes
    float nebNoise = fbm_h(p * 2.5 + vec2(t * 0.05, -t * 0.03));
    vec3 nebCol = mix(vec3(0.4, 0.1, 0.6), vec3(0.0, 0.4, 0.5), nebNoise);
    col += nebCol * pow(nebNoise, 2.0) * 0.25;

    // 3. Supernova Shockwave Spherical Rings
    float shock1 = sin(r * 32.0 - t * 4.0);
    float shock2 = sin(r * 20.0 - t * 2.5 + 2.0);
    float ringGlow1 = pow(clamp(1.0 - abs(shock1), 0.0, 1.0), 12.0) * (0.03 / (r + 0.12));
    float ringGlow2 = pow(clamp(1.0 - abs(shock2), 0.0, 1.0), 8.0) * (0.02 / (r + 0.18));

    col += vec3(0.3, 0.9, 1.0) * ringGlow1 * 0.6;
    col += vec3(0.95, 0.4, 0.9) * ringGlow2 * 0.5;

    // 4. Prismatic Radial Rays (稜鏡折射光束)
    float rayPattern = sin(angle * 12.0 + t * 0.6) * sin(angle * 5.0 - t * 0.4);
    float rays = pow(clamp(rayPattern * 0.5 + 0.5, 0.0, 1.0), 4.0);
    vec3 prismRayColor = 0.5 + 0.5 * cos(angle * 2.0 + vec3(0.0, 2.0, 4.0) + t);
    col += prismRayColor * rays * (0.15 / (r + 0.1)) * 0.4;

    // 5. Supernova Remnant Core Flare & Chromatic Dispersion Ring
    float coreGlow = 0.06 / (r + 0.012);
    float coreInner = 0.015 / (r * r + 0.0005);
    col += vec3(1.0, 0.98, 0.92) * coreInner * 0.8;
    col += vec3(0.85, 0.45, 0.95) * coreGlow * 0.5;

    float prismRing = exp(-pow((r - 0.28) * 12.0, 2.0));
    vec3 ringColor = mix(vec3(0.2, 0.9, 1.0), vec3(1.0, 0.7, 0.2), sin(angle * 3.0 + t) * 0.5 + 0.5);
    col += ringColor * prismRing * 0.25;

    // 6. 8-Point Diamond Starburst Lens Spikes (8角璀璨鑽石星芒)
    mat2 rot45 = mat2(0.7071, 0.7071, -0.7071, 0.7071);
    vec2 cp45 = rot45 * cp;

    float spikeMajor = (0.001 / (abs(cp.x) + 0.0015)) * (0.001 / (abs(cp.y) + 0.0015));
    float spikeMinor = (0.0006 / (abs(cp45.x) + 0.002)) * (0.0006 / (abs(cp45.y) + 0.002));

    float starburst = clamp(spikeMajor * 0.4 + spikeMinor * 0.25, 0.0, 1.0);
    col += vec3(1.0, 0.95, 0.88) * starburst * smoothstep(0.8, 0.0, r);

    // 7. Sparkling Stardust Particles & Floating Bokeh Spheres (星塵微粒與浮游光點)
    for (int k = 0; k < 30; k++) {
      float fk = float(k) + 1.0;
      vec2 rand = hash22_h(vec2(fk * 13.37, fk * 91.41));

      float speed = 0.05 + rand.x * 0.07;
      float orbRadius = 0.08 + rand.y * 0.85;
      float orbAngle = rand.x * 6.2831 + t * (speed / (orbRadius + 0.1));

      vec2 partPos = center + vec2(cos(orbAngle), sin(orbAngle)) * orbRadius;
      partPos += vec2(sin(t + fk), cos(t * 1.3 + fk)) * 0.03;

      float dist = length(p - partPos);
      float isBokeh = step(0.7, rand.x);

      float particleCore = 0.0018 / (dist + 0.001);
      float particleBokeh = smoothstep(0.03 + rand.y * 0.02, 0.0, dist) * 0.15;

      float twinkle = pow(sin(t * 3.8 + fk * 4.2) * 0.5 + 0.5, 3.0);

      vec3 pCol = mix(
        vec3(0.2, 0.95, 0.85),
        mix(vec3(1.0, 0.85, 0.4), vec3(0.9, 0.45, 0.95), rand.y),
        rand.x
      );

      float pIntensity = mix(particleCore * 0.4, particleBokeh, isBokeh);
      col += pCol * pIntensity * (0.3 + 0.7 * twinkle);
    }

    // Subtle Vignette
    col *= smoothstep(1.35, 0.45, length(p));

    gl_FragColor = vec4(col, 1.0);
  }
`;

const porscheGt3RsBase64 = `data:image/jpeg;base64,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`;

function TokyoLiveWallpaper({ speedMultiplier = 0.5 }: { speedMultiplier?: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener('resize', handleResize);

    const cfg = {
      count: 70,
      color: [244, 166, 186],
    };

    function createPetal(init = false) {
      const s = (0.5 + Math.random()) * (width / 1600 + 0.6);
      return {
        x: Math.random() * width * 1.2,
        y: init ? Math.random() * height : -20,
        s,
        r: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.03,
        ph: Math.random() * 6.28,
        fl: 0.02 + Math.random() * 0.03,
        vy: 0.35 + Math.random() * 0.5,
        sw: 0.4 + Math.random() * 0.8,
        a: 0.45 + Math.random() * 0.5,
        t: Math.random(),
      };
    }

    function createMote() {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.6 + Math.random() * 1.8,
        ph: Math.random() * 6.28,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.05 - Math.random() * 0.12,
      };
    }

    const petals = Array.from({ length: cfg.count }, () => createPetal(true));
    const motes = Array.from({ length: 40 }, () => createMote());

    let wind = 0;
    let tw = 0;
    let frameCount = 0;
    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      frameCount += 1;

      if (frameCount % 240 === 0) {
        tw = (Math.random() - 0.3) * 1.4;
      }
      wind += (tw - wind) * 0.01;

      const spd = speedMultiplier || 0.5;

      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.x += m.vx * spd;
        m.y += m.vy * spd;
        m.ph += 0.02 * spd;

        if (m.y < -5) {
          m.y = height + 5;
          m.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.25 * Math.sin(m.ph)})`;
        ctx.arc(m.x, m.y, m.r, 0, 6.283);
        ctx.fill();
      }

      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.ph += 0.015 * spd;
        p.r += p.vr * spd;
        p.t += p.fl * spd;

        p.x += (Math.sin(p.ph) * p.sw - 0.6 - wind) * spd;
        p.y += p.vy * spd * (1 + 0.3 * Math.cos(p.ph));

        if (p.y > height + 20 || p.x < -30 || p.x > width + 40) {
          petals[i] = createPetal(false);
          petals[i].x = Math.random() * width * 1.2;
          continue;
        }

        const f = Math.abs(Math.cos(p.t * 3)) * 0.8 + 0.2;
        const w = 9 * p.s;
        const h = 6 * p.s * f;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = p.a;

        const g = ctx.createLinearGradient(-w, 0, w, 0);
        g.addColorStop(0, 'rgba(255,225,232,1)');
        g.addColorStop(1, `rgb(${cfg.color.join(',')})`);

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-w, 0);
        ctx.bezierCurveTo(-w * 0.6, -h * 1.3, w * 0.7, -h * 1.1, w, 0);
        ctx.bezierCurveTo(w * 0.6, h * 1.1, -w * 0.7, h * 1.3, -w, 0);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const dx = e.clientX / width - 0.5;
      const dy = e.clientY / height - 0.5;
      containerRef.current.style.transform = `translate3d(${-dx * 16}px, ${-dy * 10}px, 0)`;
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, [speedMultiplier]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none">
      <style>{`
        @keyframes breathe {
          from { transform: scale(1.02) translate3d(-.6%,0,0); }
          to { transform: scale(1.06) translate3d(.6%,-.4%,0); }
        }
        @keyframes fog {
          from { transform: translate3d(-4%,0,0); }
          to { transform: translate3d(4%,1%,0); }
        }
        @keyframes sweep {
          0% { left: -40%; }
          45%,100% { left: 130%; }
        }
        @keyframes ripple {
          to { background-position: 0 28px; }
        }
        @keyframes vig {
          from { opacity: .6; }
          to { opacity: 1; }
        }
        .tokyo-par {
          position: fixed;
          inset: 0;
          will-change: transform;
          transition: transform .25s ease-out;
        }
        .tokyo-stage {
          position: fixed;
          inset: -4%;
          background: url(${porscheGt3RsBase64}) center/cover no-repeat;
          animation: breathe 18s ease-in-out infinite alternate;
          will-change: transform;
        }
        .tokyo-fog {
          position: fixed;
          inset: 0;
          pointer-events: none;
          mix-blend-mode: screen;
          opacity: .5;
          background: radial-gradient(60% 40% at 20% 60%,rgba(255,255,255,.55),transparent 70%),
                     radial-gradient(50% 35% at 80% 45%,rgba(255,255,255,.45),transparent 70%);
          animation: fog 22s ease-in-out infinite alternate;
        }
        .tokyo-sweep {
          position: fixed;
          inset: 0;
          pointer-events: none;
          mix-blend-mode: soft-light;
          overflow: hidden;
        }
        .tokyo-sweep::before {
          content: "";
          position: absolute;
          top: -20%;
          bottom: -20%;
          width: 28%;
          left: -40%;
          background: linear-gradient(100deg,transparent,rgba(255,255,255,.95) 50%,transparent);
          transform: skewX(-18deg);
          filter: blur(18px);
          animation: sweep 11s cubic-bezier(.5,0,.3,1) infinite;
        }
        .tokyo-floor {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          height: 34%;
          pointer-events: none;
          mix-blend-mode: overlay;
          opacity: .55;
          background: repeating-linear-gradient(0deg,rgba(255,255,255,.0) 0 6px,rgba(255,255,255,.5) 6px 7px);
          -webkit-mask: linear-gradient(to top,#000,transparent);
          mask: linear-gradient(to top,#000,transparent);
          animation: ripple 7s linear infinite;
        }
        .tokyo-vig {
          position: fixed;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(120% 90% at 50% 50%,transparent 60%,rgba(60,66,80,.18));
          animation: vig 9s ease-in-out infinite alternate;
        }
      `}</style>
      <div ref={containerRef} className="tokyo-par">
        <div className="tokyo-stage" />
        <div className="tokyo-fog" />
        <div className="tokyo-sweep" />
        <div className="tokyo-floor" />
        <div className="tokyo-vig" />
      </div>
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none" />
    </div>
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  pulseSpeed: number;
}

interface PS5DynamicBackgroundProps {
  isActive: boolean;
  themeId?: string;
  speedMultiplier?: number;
}

export function PS5DynamicBackground({
  isActive,
  themeId = 'galaxy-kepler',
  speedMultiplier = 0.5,
}: PS5DynamicBackgroundProps) {
  const glslContainerRef = useRef<HTMLDivElement | null>(null);
  const classicCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const classicAnimRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const speedRef = useRef(speedMultiplier);

  useEffect(() => {
    speedRef.current = speedMultiplier;
  }, [speedMultiplier]);

  const [showSciHUD, setShowSciHUD] = useState<boolean>(true);

  const theme = PS5_THEMES.find((t) => t.id === themeId) || PS5_THEMES[0];

  // Document CSS theme variable synchronization
  useEffect(() => {
    if (isActive) {
      document.body.classList.add('ps5-theme-active');
      document.documentElement.style.setProperty('--ps5-accent', theme.accentColor);
      document.documentElement.style.setProperty('--ps5-glow', theme.particleGlow);
      document.documentElement.style.setProperty('--ps5-icon-color', theme.iconColor);
    } else {
      document.body.classList.remove('ps5-theme-active');
    }

    return () => {
      document.body.classList.remove('ps5-theme-active');
    };
  }, [isActive, theme]);

  // =========================================================================
  // EFFECT 1: GALAXY GLSL SHADER ENGINE (Three.js WebGL Fullscreen Quad)
  // =========================================================================
  useEffect(() => {
    if (!isActive || theme.category !== 'galaxy' || !glslContainerRef.current) return;

    const container = glslContainerRef.current;
    container.innerHTML = '';

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Select specific GLSL shader
    let fragShader = keplerFragmentShader;
    switch (theme.galaxyType) {
      case 'kerr-blackhole':
        fragShader = kerrFragmentShader;
        break;
      case 'stellar-fusion':
        fragShader = stellarFragmentShader;
        break;
      case 'cosmic-web':
        fragShader = cosmicWebFragmentShader;
        break;
      case 'pulsar-gw':
        fragShader = pulsarFragmentShader;
        break;
      case 'golden-bokeh':
        fragShader = goldenBokehFragmentShader;
        break;
      case 'hypernova-glow':
        fragShader = hypernovaFragmentShader;
        break;
      case 'kepler':
      default:
        fragShader = keplerFragmentShader;
        break;
    }

    const uniforms = {
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_mouse: { value: new THREE.Vector2(width * 0.5, height * 0.5) },
      u_accent: { value: new THREE.Color(theme.accentColor) },
    };

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: commonVertexShader,
      fragmentShader: fragShader,
      uniforms,
      depthWrite: false,
      depthTest: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let animId: number;
    let lastNow = performance.now();
    let accumulatedTime = 0;
    const targetMouse = new THREE.Vector2(width * 0.5, height * 0.5);

    const handlePointerMove = (e: MouseEvent) => {
      targetMouse.set(e.clientX, window.innerHeight - e.clientY);
    };
    window.addEventListener('mousemove', handlePointerMove);

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      uniforms.u_resolution.value.set(w, h);
    };
    window.addEventListener('resize', handleResize);

    const render = (now: number) => {
      const delta = Math.min(0.1, (now - lastNow) * 0.001);
      lastNow = now;
      accumulatedTime += delta * (speedRef.current || 0.5) * 1.3;
      uniforms.u_time.value = accumulatedTime;
      uniforms.u_mouse.value.lerp(targetMouse, 0.06);
      renderer.render(scene, camera);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [isActive, theme]);

  // =========================================================================
  // EFFECT 2: CLASSIC PS5 FLUID WAVE RIBBONS (High-DPI Specular 2D Engine)
  // =========================================================================
  useEffect(() => {
    if (!isActive || theme.category !== 'classic' || !classicCanvasRef.current) return;

    const canvas = classicCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const setupCanvasSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setupCanvasSize();

    // Smooth interactive mouse state for 3D wave parallax
    let mouseX = width * 0.5;
    let mouseY = height * 0.5;
    let targetMouseX = width * 0.5;
    let targetMouseY = height * 0.5;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Floating Stardust & Bokeh Particles
    const count = Math.min(85, Math.floor((width * height) / 18000));
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: -0.18 - Math.random() * 0.38,
        radius: 0.9 + Math.random() * 3.1,
        alpha: Math.random() * Math.PI * 2,
        pulseSpeed: 0.012 + Math.random() * 0.022,
      });
    }
    particlesRef.current = particles;

    let lastClassicNow = performance.now();
    let accumulatedClassicTime = 0;

    const handleResize = () => {
      setupCanvasSize();
    };
    window.addEventListener('resize', handleResize);

    const renderClassic = (now: number) => {
      const delta = Math.min(100, now - lastClassicNow);
      lastClassicNow = now;
      const spd = speedRef.current || 0.5;
      accumulatedClassicTime += delta * spd * 1.35;
      const elapsed = accumulatedClassicTime;

      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;
      const normMX = (mouseX / Math.max(1, width)) - 0.5;
      const normMY = (mouseY / Math.max(1, height)) - 0.5;

      // 1. Deep Atmospheric Radial Gradient with Subtle Breathing Center
      const breatheOffset = Math.sin(elapsed * 0.0005) * width * 0.04;
      const grad = ctx.createRadialGradient(
        width * 0.5 + normMX * 90 + breatheOffset,
        height * 0.42 + normMY * 60,
        width * 0.06,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.9
      );
      grad.addColorStop(0, theme.bgGradient[1]);
      grad.addColorStop(0.52, theme.bgGradient[0]);
      grad.addColorStop(1, theme.bgGradient[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 1.5 Ambient Upper Aurora Halo & Interactive Spotlight
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const spotGrad = ctx.createRadialGradient(
        mouseX,
        mouseY,
        0,
        mouseX,
        mouseY,
        Math.max(width, height) * 0.42
      );
      spotGrad.addColorStop(0, theme.particleGlow.replace(/[\d.]+\)$/, '0.16)'));
      spotGrad.addColorStop(0.5, theme.particleGlow.replace(/[\d.]+\)$/, '0.05)'));
      spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = spotGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // 2. PS5 Dynamic Fluid Wave Ribbons with Specular Crest Rim-Lights
      if (theme.ribbonColors) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const steps = 48;
        const stepWidth = width / steps;

        theme.ribbonColors.forEach((ribbon, rIdx) => {
          const t = elapsed * ribbon.speed + ribbon.phase;
          const parallaxY = normMY * (22 + rIdx * 10);
          const parallaxPhase = normMX * (0.45 + rIdx * 0.15);
          const baseY = height * ribbon.yBase + parallaxY;

          const points: Array<{ x: number; y: number }> = [];
          for (let i = 0; i <= steps; i++) {
            const x = i * stepWidth;
            const harmonic1 = Math.sin(x * ribbon.freq + t + parallaxPhase) * ribbon.amp;
            const harmonic2 = Math.cos(x * ribbon.freq * 0.62 - t * 0.85) * (ribbon.amp * 0.48);
            const harmonic3 = Math.sin(t * 0.55 + x * 0.00075 + rIdx) * (ribbon.amp * 0.32);
            const y = baseY + harmonic1 + harmonic2 + harmonic3;
            points.push({ x, y });
          }

          // A. Fill Volumetric Ribbon Body
          ctx.beginPath();
          ctx.moveTo(0, height);
          ctx.lineTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const midX = (prev.x + curr.x) * 0.5;
            const midY = (prev.y + curr.y) * 0.5;
            ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
          }
          ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
          ctx.lineTo(width, height);
          ctx.closePath();

          const ribbonGrad = ctx.createLinearGradient(0, baseY - ribbon.amp * 1.6, 0, height);
          ribbonGrad.addColorStop(0, ribbon.color1);
          ribbonGrad.addColorStop(0.38, ribbon.glow);
          ribbonGrad.addColorStop(1, ribbon.color2);

          ctx.fillStyle = ribbonGrad;
          ctx.fill();

          // B. Draw Signature PS5 Specular Crest Rim-Light along the Wave Top
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const midX = (prev.x + curr.x) * 0.5;
            const midY = (prev.y + curr.y) * 0.5;
            ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
          }
          ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

          const crestGrad = ctx.createLinearGradient(0, 0, width, 0);
          crestGrad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
          crestGrad.addColorStop(0.25, ribbon.glow);
          crestGrad.addColorStop(0.5 + Math.sin(t * 0.7) * 0.2, theme.particleColor);
          crestGrad.addColorStop(0.8, ribbon.glow);
          crestGrad.addColorStop(1, 'rgba(255, 255, 255, 0.05)');

          ctx.strokeStyle = crestGrad;
          ctx.lineWidth = rIdx === 0 ? 2.2 : rIdx === 1 ? 1.6 : 1.1;
          ctx.shadowColor = theme.accentColor;
          ctx.shadowBlur = 14;
          ctx.stroke();
          ctx.shadowBlur = 0;
        });

        ctx.restore();
      }

      // 3. Dual-Layer Floating Stardust & Diamond Starlight Particles
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      particlesRef.current.forEach((p, idx) => {
        p.x += (p.vx + normMX * 0.25) * (0.7 + spd * 0.6);
        p.y += p.vy * (0.7 + spd * 0.6);

        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        p.alpha += p.pulseSpeed;
        const twinkle = 0.5 + 0.5 * Math.sin(p.alpha);
        const currentAlpha = 0.18 + twinkle * 0.65;

        const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3.6);
        radGrad.addColorStop(0, '#ffffff');
        radGrad.addColorStop(0.25, theme.particleColor);
        radGrad.addColorStop(0.55, theme.particleGlow);
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = radGrad;
        ctx.globalAlpha = Math.max(0.05, Math.min(1, currentAlpha));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3.6, 0, Math.PI * 2);
        ctx.fill();

        // Subtle 4-point star flare on every 5th bright particle
        if (idx % 5 === 0 && twinkle > 0.72) {
          const flareLen = p.radius * (3.2 + twinkle * 2.5);
          ctx.strokeStyle = theme.particleColor;
          ctx.lineWidth = 0.75;
          ctx.globalAlpha = (twinkle - 0.7) * 1.8;
          ctx.beginPath();
          ctx.moveTo(p.x - flareLen, p.y);
          ctx.lineTo(p.x + flareLen, p.y);
          ctx.moveTo(p.x, p.y - flareLen);
          ctx.lineTo(p.x, p.y + flareLen);
          ctx.stroke();
        }
      });

      ctx.restore();

      classicAnimRef.current = requestAnimationFrame(renderClassic);
    };

    classicAnimRef.current = requestAnimationFrame(renderClassic);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (classicAnimRef.current) {
        cancelAnimationFrame(classicAnimRef.current);
      }
    };
  }, [isActive, theme]);

  if (!isActive) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
        >
          {/* Tokyo Series Mode: Porsche GT3 RS Live Wallpaper */}
          {theme.category === 'tokyo' && (
            <TokyoLiveWallpaper speedMultiplier={speedMultiplier} />
          )}

          {/* Galaxy Mode: GLSL Shaders Container */}
          {theme.category === 'galaxy' && (
            <div ref={glslContainerRef} className="absolute inset-0 w-full h-full block" />
          )}

          {/* Classic Mode: 2D Canvas Wave Ribbons */}
          {theme.category === 'classic' && (
            <canvas ref={classicCanvasRef} className="absolute inset-0 w-full h-full block" />
          )}

          {/* Subtle cinematic overlay vignette */}
          <div className="absolute inset-0 bg-radial from-transparent via-transparent to-black/45 pointer-events-none" />
        </motion.div>
      </AnimatePresence>

      {/* Interactive Educational HUD (Shown in Galaxy GLSL & Tokyo Live Wallpaper modes) */}
      <AnimatePresence>
        {(theme.category === 'galaxy' || theme.category === 'tokyo') && showSciHUD && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-3.5 right-4 z-[990] hidden md:flex flex-col items-end gap-1.5 pointer-events-auto select-none"
          >
            <div className="bg-black/92 backdrop-blur-2xl border-2 border-slate-600/90 p-3.5 rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.85)] max-w-sm text-left text-xs font-mono text-white ring-1 ring-white/20">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full ring-2 ring-white/50"
                    style={{ backgroundColor: theme.iconColor }}
                  />
                  <span className="font-black text-white text-[13px] tracking-wide uppercase flex items-center gap-1.5 drop-shadow-sm">
                    <Atom className="w-4 h-4 text-cyan-400 stroke-[2.5]" />
                    {theme.sciConcept}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSciHUD(false)}
                  className="text-slate-300 hover:text-white p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-600 cursor-pointer transition-colors"
                  title="隱藏說明面板"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Physical Formula Badge (High Contrast) */}
              <div className="p-2 rounded-xl bg-slate-900/95 border border-emerald-400/50 text-emerald-300 font-black text-xs mb-2 tracking-wide shadow-inner flex items-center gap-1.5">
                <span className="text-emerald-400 font-mono">📐</span>
                <span className="font-mono text-[11.5px]">{theme.sciFormula}</span>
              </div>

              {/* Educational Description (High Contrast) */}
              <p className="text-[12px] text-slate-100 font-sans font-bold leading-relaxed mb-2.5">
                {theme.sciDescription}
              </p>

              <div className="pt-2 border-t border-slate-700/90 flex items-center justify-between text-[11px] text-slate-300 font-bold">
                <span className="text-cyan-300 flex items-center gap-1">⚡ {theme.category === 'tokyo' ? '4K 寫真景深動態桌布' : 'WebGL GLSL 片段著色器'}</span>
                <span className="text-slate-200 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-600">平穩優雅渲染</span>
              </div>
            </div>
          </motion.div>
        )}

        {(theme.category === 'galaxy' || theme.category === 'tokyo') && !showSciHUD && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowSciHUD(true)}
            className="fixed top-3.5 right-4 z-[990] bg-black/85 hover:bg-slate-900 text-white p-2 rounded-full border-2 border-slate-500 shadow-xl cursor-pointer transition-all hover:scale-105"
            title="開啟天文物理科學說明面板"
          >
            <Info className="w-4 h-4 text-cyan-300 stroke-[2.5]" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
