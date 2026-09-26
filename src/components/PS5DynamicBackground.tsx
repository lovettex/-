import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as THREE from 'three';
import { Atom, Info, EyeOff } from 'lucide-react';

export interface PS5Theme {
  id: string;
  name: string;
  nameEn: string;
  category: 'galaxy' | 'classic';
  iconColor: string;
  bgGradient: [string, string, string];
  accentColor: string;
  particleColor: string;
  particleGlow: string;
  galaxyType?: 'kepler' | 'kerr-blackhole' | 'stellar-fusion' | 'cosmic-web' | 'pulsar-gw';
  ribbonColors?: Array<{
    color1: string;
    color2: string;
    glow: string;
    speed: number;
    amp: number;
    freq: number;
    phase: number;
    yBase: number;
  }>;
  sciConcept?: string;
  sciFormula?: string;
  sciDescription?: string;
}

export const PS5_THEMES: PS5Theme[] = [
  // =========================================================================
  // GALAXY GLSL SCIENTIFIC SHADER SERIES (5 ASTROPHYSICS PHENOMENA)
  // =========================================================================
  {
    id: 'galaxy-kepler',
    name: '克卜勒行星天體力學',
    nameEn: 'Kepler Orbit & Habitable Zone',
    category: 'galaxy',
    iconColor: '#38bdf8',
    bgGradient: ['#020617', '#08152e', '#01040d'],
    accentColor: '#38bdf8',
    particleColor: '#e0f2fe',
    particleGlow: 'rgba(56, 189, 248, 0.85)',
    galaxyType: 'kepler',
    sciConcept: '克卜勒行星三大定律 & 金髮姑娘宜居帶',
    sciFormula: 'T² = (4π² / GM) · a³  |  dA/dt = const',
    sciDescription: 'GLSL 著色器動態計算橢圓軌道偏心率、近日點加速運動與適居帶行星凌日現象。',
  },
  {
    id: 'galaxy-kerr-blackhole',
    name: '克爾旋轉黑洞與時空彎曲',
    nameEn: 'Kerr Black Hole & Gravitational Time Dilation',
    category: 'galaxy',
    iconColor: '#f43f5e',
    bgGradient: ['#0f0208', '#240614', '#080104'],
    accentColor: '#f43f5e',
    particleColor: '#ffe4e6',
    particleGlow: 'rgba(244, 63, 94, 0.85)',
    galaxyType: 'kerr-blackhole',
    sciConcept: '廣義相對論事件視界 & 引力時間膨脹',
    sciFormula: 'r₊ = (GM/c²)(1 + √(1 - a²))  |  Δt = Δt₀ / √(1 - rₛ/r)',
    sciDescription: 'GLSL 光線步進與度規扭曲計算能層 (Ergosphere)、光子球層與相對論多普勒吸積盤。',
  },
  {
    id: 'galaxy-stellar-fusion',
    name: '恆星核融合週期與赫羅圖',
    nameEn: 'Stellar Nucleosynthesis & Fusion Core',
    category: 'galaxy',
    iconColor: '#f59e0b',
    bgGradient: ['#170700', '#2e1202', '#0a0300'],
    accentColor: '#f59e0b',
    particleColor: '#fef3c7',
    particleGlow: 'rgba(245, 158, 11, 0.85)',
    galaxyType: 'stellar-fusion',
    sciConcept: '恆星核聚變洋蔥層模型 & 磁重聯閃焰',
    sciFormula: '4 ¹H ➔ ⁴He + 2e⁺ + 2νₑ + 26.7 MeV  |  M_ch ≈ 1.44 M☉',
    sciDescription: 'GLSL 碎形布朗運動 (FBM) 模擬主序星洋蔥層核合成流動、日冕物質拋射與磁力線環。',
  },
  {
    id: 'galaxy-cosmic-web',
    name: '韋伯深空巡天與宇宙紅移',
    nameEn: 'James Webb Cosmic Web & Expansion',
    category: 'galaxy',
    iconColor: '#c084fc',
    bgGradient: ['#0b0318', '#1a0836', '#06010d'],
    accentColor: '#c084fc',
    particleColor: '#f5d0fe',
    particleGlow: 'rgba(192, 132, 252, 0.85)',
    galaxyType: 'cosmic-web',
    sciConcept: '哈伯宇宙膨脹定律 & 暗物質巨網',
    sciFormula: 'v = H₀ · d  |  1 + z = λ_obs / λ_emit',
    sciDescription: 'GLSL Voronoi 網格渲染暗物質絲狀結構、愛因斯坦十字引力透鏡與 134 億年紅移光譜。',
  },
  {
    id: 'galaxy-pulsar-gw',
    name: '脈衝星強磁層與引力波',
    nameEn: 'Relativistic Pulsar & Gravitational Waves',
    category: 'galaxy',
    iconColor: '#00f2fe',
    bgGradient: ['#01111c', '#02253d', '#00090f'],
    accentColor: '#00f2fe',
    particleColor: '#ccfbf1',
    particleGlow: 'rgba(0, 242, 254, 0.85)',
    galaxyType: 'pulsar-gw',
    sciConcept: '磁陀星偶極磁力線 & 雙中子星併合時空擾動',
    sciFormula: 'ḣ_μν = (2G/c⁴r) · d²Q_μν/dt²  |  B ≈ 10¹⁴ Gauss',
    sciDescription: 'GLSL 渲染旋轉同步輻射光錐、LIGO 引力波四極時空漣漪度規擾動與自轉能損。',
  },

  // =========================================================================
  // CLASSIC PS5 FLUID WAVE RIBBON THEMES (10 PRESETS)
  // =========================================================================
  {
    id: 'ps5-cosmic',
    name: 'PS5 經典星空',
    nameEn: 'Cosmic Midnight',
    category: 'classic',
    iconColor: '#00d4ff',
    bgGradient: ['#050b18', '#08142b', '#030814'],
    accentColor: '#00d4ff',
    particleColor: '#ffffff',
    particleGlow: 'rgba(0, 212, 255, 0.7)',
    ribbonColors: [
      { color1: 'rgba(0, 180, 255, 0.45)', color2: 'rgba(50, 90, 255, 0.1)', glow: 'rgba(0, 212, 255, 0.5)', speed: 0.0008, amp: 90, freq: 0.0012, phase: 0, yBase: 0.62 },
      { color1: 'rgba(120, 190, 255, 0.35)', color2: 'rgba(0, 140, 255, 0.08)', glow: 'rgba(100, 200, 255, 0.4)', speed: 0.0012, amp: 120, freq: 0.0018, phase: 1.8, yBase: 0.55 },
      { color1: 'rgba(255, 255, 255, 0.25)', color2: 'rgba(0, 220, 255, 0.05)', glow: 'rgba(255, 255, 255, 0.3)', speed: 0.0006, amp: 70, freq: 0.0015, phase: 3.5, yBase: 0.7 },
      { color1: 'rgba(30, 80, 220, 0.3)', color2: 'rgba(0, 0, 50, 0.0)', glow: 'rgba(0, 120, 255, 0.3)', speed: 0.0015, amp: 140, freq: 0.001, phase: 4.2, yBase: 0.48 },
    ],
  },
  {
    id: 'emerald-aurora',
    name: '極光流雲',
    nameEn: 'Emerald Aurora',
    category: 'classic',
    iconColor: '#10b981',
    bgGradient: ['#02140e', '#05291d', '#010a07'],
    accentColor: '#10b981',
    particleColor: '#a7f3d0',
    particleGlow: 'rgba(16, 185, 129, 0.8)',
    ribbonColors: [
      { color1: 'rgba(16, 185, 129, 0.5)', color2: 'rgba(6, 95, 70, 0.1)', glow: 'rgba(16, 185, 129, 0.6)', speed: 0.0009, amp: 100, freq: 0.0014, phase: 0.5, yBase: 0.58 },
      { color1: 'rgba(52, 211, 153, 0.4)', color2: 'rgba(20, 184, 166, 0.08)', glow: 'rgba(52, 211, 153, 0.5)', speed: 0.0013, amp: 130, freq: 0.0019, phase: 2.2, yBase: 0.5 },
      { color1: 'rgba(209, 250, 229, 0.28)', color2: 'rgba(5, 150, 105, 0.05)', glow: 'rgba(209, 250, 229, 0.4)', speed: 0.0007, amp: 80, freq: 0.0016, phase: 4.0, yBase: 0.66 },
      { color1: 'rgba(4, 120, 87, 0.35)', color2: 'rgba(2, 44, 34, 0.0)', glow: 'rgba(16, 185, 129, 0.3)', speed: 0.0016, amp: 150, freq: 0.0011, phase: 1.2, yBase: 0.42 },
    ],
  },
  {
    id: 'cyber-neon',
    name: '賽博霓虹',
    nameEn: 'Cyberpunk Neon',
    category: 'classic',
    iconColor: '#c084fc',
    bgGradient: ['#0d041c', '#1e0b3c', '#080212'],
    accentColor: '#c084fc',
    particleColor: '#f5d0fe',
    particleGlow: 'rgba(192, 132, 252, 0.85)',
    ribbonColors: [
      { color1: 'rgba(168, 85, 247, 0.5)', color2: 'rgba(236, 72, 153, 0.12)', glow: 'rgba(192, 132, 252, 0.6)', speed: 0.001, amp: 110, freq: 0.0015, phase: 0.2, yBase: 0.6 },
      { color1: 'rgba(236, 72, 153, 0.42)', color2: 'rgba(147, 51, 234, 0.1)', glow: 'rgba(244, 114, 182, 0.5)', speed: 0.0014, amp: 135, freq: 0.002, phase: 2.5, yBase: 0.52 },
      { color1: 'rgba(192, 132, 252, 0.3)', color2: 'rgba(79, 70, 229, 0.05)', glow: 'rgba(216, 180, 254, 0.4)', speed: 0.0008, amp: 85, freq: 0.0017, phase: 3.8, yBase: 0.68 },
      { color1: 'rgba(217, 70, 239, 0.32)', color2: 'rgba(30, 10, 60, 0.0)', glow: 'rgba(217, 70, 239, 0.4)', speed: 0.0017, amp: 145, freq: 0.0012, phase: 1.6, yBase: 0.45 },
    ],
  },
  {
    id: 'sunset-horizon',
    name: '落日餘暉',
    nameEn: 'Sunset Horizon',
    category: 'classic',
    iconColor: '#f59e0b',
    bgGradient: ['#1c0817', '#381329', '#0d030c'],
    accentColor: '#f59e0b',
    particleColor: '#fed7aa',
    particleGlow: 'rgba(245, 158, 11, 0.8)',
    ribbonColors: [
      { color1: 'rgba(245, 158, 11, 0.5)', color2: 'rgba(239, 68, 68, 0.12)', glow: 'rgba(251, 191, 36, 0.6)', speed: 0.0008, amp: 95, freq: 0.0013, phase: 0.8, yBase: 0.64 },
      { color1: 'rgba(244, 63, 94, 0.4)', color2: 'rgba(217, 70, 239, 0.08)', glow: 'rgba(251, 113, 133, 0.5)', speed: 0.0012, amp: 125, freq: 0.0018, phase: 2.8, yBase: 0.54 },
      { color1: 'rgba(254, 215, 170, 0.3)', color2: 'rgba(234, 88, 12, 0.05)', glow: 'rgba(254, 240, 138, 0.4)', speed: 0.0006, amp: 75, freq: 0.0015, phase: 4.5, yBase: 0.72 },
      { color1: 'rgba(194, 65, 12, 0.35)', color2: 'rgba(88, 28, 135, 0.0)', glow: 'rgba(249, 115, 22, 0.3)', speed: 0.0015, amp: 140, freq: 0.0011, phase: 1.5, yBase: 0.46 },
    ],
  },
  {
    id: 'deep-nebula',
    name: '深空星雲',
    nameEn: 'Deep Nebula',
    category: 'classic',
    iconColor: '#818cf8',
    bgGradient: ['#04051a', '#0b0f38', '#02030d'],
    accentColor: '#818cf8',
    particleColor: '#c7d2fe',
    particleGlow: 'rgba(129, 140, 248, 0.8)',
    ribbonColors: [
      { color1: 'rgba(99, 102, 241, 0.48)', color2: 'rgba(59, 130, 246, 0.1)', glow: 'rgba(129, 140, 248, 0.6)', speed: 0.0009, amp: 105, freq: 0.0014, phase: 0.4, yBase: 0.6 },
      { color1: 'rgba(168, 85, 247, 0.38)', color2: 'rgba(99, 102, 241, 0.08)', glow: 'rgba(192, 132, 252, 0.5)', speed: 0.0013, amp: 130, freq: 0.0019, phase: 2.1, yBase: 0.52 },
      { color1: 'rgba(224, 231, 255, 0.26)', color2: 'rgba(37, 99, 235, 0.05)', glow: 'rgba(224, 231, 255, 0.4)', speed: 0.0007, amp: 80, freq: 0.0016, phase: 3.9, yBase: 0.68 },
      { color1: 'rgba(67, 56, 202, 0.32)', color2: 'rgba(15, 23, 42, 0.0)', glow: 'rgba(99, 102, 241, 0.3)', speed: 0.0016, amp: 150, freq: 0.0011, phase: 1.1, yBase: 0.44 },
    ],
  },
  {
    id: 'titanium-frost',
    name: '鈦金霜白',
    nameEn: 'Titanium Frost',
    category: 'classic',
    iconColor: '#e2e8f0',
    bgGradient: ['#0f172a', '#1e293b', '#090d16'],
    accentColor: '#38bdf8',
    particleColor: '#f8fafc',
    particleGlow: 'rgba(56, 189, 248, 0.75)',
    ribbonColors: [
      { color1: 'rgba(148, 163, 184, 0.45)', color2: 'rgba(56, 189, 248, 0.1)', glow: 'rgba(203, 213, 225, 0.5)', speed: 0.0008, amp: 90, freq: 0.0012, phase: 0.6, yBase: 0.62 },
      { color1: 'rgba(56, 189, 248, 0.35)', color2: 'rgba(100, 116, 139, 0.08)', glow: 'rgba(125, 211, 252, 0.4)', speed: 0.0012, amp: 120, freq: 0.0017, phase: 2.4, yBase: 0.53 },
      { color1: 'rgba(248, 250, 252, 0.28)', color2: 'rgba(71, 85, 105, 0.05)', glow: 'rgba(255, 255, 255, 0.4)', speed: 0.0006, amp: 70, freq: 0.0015, phase: 4.1, yBase: 0.7 },
      { color1: 'rgba(51, 65, 85, 0.35)', color2: 'rgba(15, 23, 42, 0.0)', glow: 'rgba(148, 163, 184, 0.3)', speed: 0.0015, amp: 140, freq: 0.001, phase: 1.4, yBase: 0.46 },
    ],
  },
  {
    id: 'ember-core',
    name: '熾熱核心',
    nameEn: 'Ember Core',
    category: 'classic',
    iconColor: '#ea580c',
    bgGradient: ['#1a0703', '#331006', '#0d0301'],
    accentColor: '#ea580c',
    particleColor: '#ffedd5',
    particleGlow: 'rgba(234, 88, 12, 0.85)',
    ribbonColors: [
      { color1: 'rgba(234, 88, 12, 0.52)', color2: 'rgba(220, 38, 38, 0.12)', glow: 'rgba(249, 115, 22, 0.6)', speed: 0.001, amp: 110, freq: 0.0015, phase: 0.3, yBase: 0.6 },
      { color1: 'rgba(249, 115, 22, 0.42)', color2: 'rgba(234, 179, 8, 0.1)', glow: 'rgba(251, 146, 60, 0.5)', speed: 0.0014, amp: 135, freq: 0.002, phase: 2.6, yBase: 0.51 },
      { color1: 'rgba(254, 240, 138, 0.3)', color2: 'rgba(185, 28, 28, 0.05)', glow: 'rgba(253, 224, 71, 0.4)', speed: 0.0008, amp: 85, freq: 0.0017, phase: 4.3, yBase: 0.69 },
      { color1: 'rgba(153, 27, 27, 0.35)', color2: 'rgba(69, 10, 10, 0.0)', glow: 'rgba(220, 38, 38, 0.3)', speed: 0.0017, amp: 145, freq: 0.0012, phase: 1.7, yBase: 0.43 },
    ],
  },
  {
    id: 'oceanic-abyss',
    name: '深海秘境',
    nameEn: 'Oceanic Abyss',
    category: 'classic',
    iconColor: '#06b6d4',
    bgGradient: ['#02131e', '#04273d', '#01090f'],
    accentColor: '#06b6d4',
    particleColor: '#cffafe',
    particleGlow: 'rgba(6, 182, 212, 0.8)',
    ribbonColors: [
      { color1: 'rgba(6, 182, 212, 0.48)', color2: 'rgba(2, 132, 199, 0.1)', glow: 'rgba(34, 211, 238, 0.6)', speed: 0.0008, amp: 95, freq: 0.0013, phase: 0.7, yBase: 0.63 },
      { color1: 'rgba(14, 165, 233, 0.38)', color2: 'rgba(59, 130, 246, 0.08)', glow: 'rgba(56, 189, 248, 0.5)', speed: 0.0012, amp: 125, freq: 0.0018, phase: 2.7, yBase: 0.54 },
      { color1: 'rgba(207, 250, 254, 0.28)', color2: 'rgba(3, 105, 161, 0.05)', glow: 'rgba(207, 250, 254, 0.4)', speed: 0.0006, amp: 75, freq: 0.0015, phase: 4.4, yBase: 0.71 },
      { color1: 'rgba(3, 105, 161, 0.35)', color2: 'rgba(8, 47, 73, 0.0)', glow: 'rgba(6, 182, 212, 0.3)', speed: 0.0015, amp: 140, freq: 0.0011, phase: 1.3, yBase: 0.45 },
    ],
  },
  {
    id: 'sakura-twilight',
    name: '落櫻暮光',
    nameEn: 'Sakura Twilight',
    category: 'classic',
    iconColor: '#f472b6',
    bgGradient: ['#190818', '#330f30', '#0e030e'],
    accentColor: '#f472b6',
    particleColor: '#fce7f3',
    particleGlow: 'rgba(244, 114, 182, 0.85)',
    ribbonColors: [
      { color1: 'rgba(244, 114, 182, 0.5)', color2: 'rgba(219, 39, 119, 0.12)', glow: 'rgba(244, 114, 182, 0.6)', speed: 0.0009, amp: 100, freq: 0.0014, phase: 0.4, yBase: 0.61 },
      { color1: 'rgba(251, 113, 133, 0.4)', color2: 'rgba(192, 132, 252, 0.08)', glow: 'rgba(251, 113, 133, 0.5)', speed: 0.0013, amp: 130, freq: 0.0019, phase: 2.3, yBase: 0.52 },
      { color1: 'rgba(253, 230, 138, 0.28)', color2: 'rgba(157, 23, 77, 0.05)', glow: 'rgba(253, 230, 138, 0.4)', speed: 0.0007, amp: 80, freq: 0.0016, phase: 4.0, yBase: 0.68 },
      { color1: 'rgba(157, 23, 77, 0.32)', color2: 'rgba(76, 5, 25, 0.0)', glow: 'rgba(244, 114, 182, 0.3)', speed: 0.0016, amp: 145, freq: 0.0011, phase: 1.5, yBase: 0.44 },
    ],
  },
  {
    id: 'prestige-gold',
    name: '流金奢華',
    nameEn: 'Prestige Gold',
    category: 'classic',
    iconColor: '#fbbf24',
    bgGradient: ['#171206', '#2d2309', '#0a0802'],
    accentColor: '#fbbf24',
    particleColor: '#fef08a',
    particleGlow: 'rgba(251, 191, 36, 0.85)',
    ribbonColors: [
      { color1: 'rgba(251, 191, 36, 0.5)', color2: 'rgba(217, 119, 6, 0.12)', glow: 'rgba(251, 191, 36, 0.6)', speed: 0.0008, amp: 95, freq: 0.0013, phase: 0.5, yBase: 0.62 },
      { color1: 'rgba(245, 158, 11, 0.4)', color2: 'rgba(180, 83, 9, 0.08)', glow: 'rgba(245, 158, 11, 0.5)', speed: 0.0012, amp: 125, freq: 0.0018, phase: 2.5, yBase: 0.53 },
      { color1: 'rgba(254, 240, 138, 0.3)', color2: 'rgba(146, 64, 14, 0.05)', glow: 'rgba(254, 240, 138, 0.4)', speed: 0.0006, amp: 75, freq: 0.0015, phase: 4.2, yBase: 0.7 },
      { color1: 'rgba(180, 83, 9, 0.35)', color2: 'rgba(69, 26, 3, 0.0)', glow: 'rgba(251, 191, 36, 0.3)', speed: 0.0015, amp: 140, freq: 0.0011, phase: 1.4, yBase: 0.45 },
    ],
  },
];

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
    vec2 center = vec2(0.12, 0.0);
    vec2 cp = p - center;

    float r = length(cp);
    float t = u_time * 0.25;

    // Relativistic gravitational deflection ray warping
    float rs = 0.12; // Schwarzschild radius
    float warp = rs / (r * r + 0.035);
    vec2 warpedP = cp * (1.0 + warp * 0.8);
    float wr = length(warpedP);
    float angle = atan(warpedP.y, warpedP.x) + t * (0.3 / (wr + 0.1));

    vec3 col = vec3(0.04, 0.01, 0.025);

    // Accretion Disk with Relativistic Doppler Beaming (Brighter left, dimmer right)
    if (wr > 0.14 && wr < 0.65) {
      float doppler = 0.5 + 0.5 * cos(angle + 1.2);
      float diskGlow = smoothstep(0.14, 0.22, wr) * (1.0 - smoothstep(0.45, 0.65, wr));
      vec3 diskCol = mix(vec3(0.95, 0.35, 0.1), vec3(0.98, 0.85, 0.6), doppler);
      col += diskCol * diskGlow * (0.6 + doppler * 0.7);
    }

    // Photon Sphere Ring (at r = 1.5 rs)
    float photonRing = abs(r - rs * 1.38);
    col += vec3(1.0, 0.95, 0.9) * (0.0025 / (photonRing + 0.003)) * 0.65;

    // Event Horizon Shadow (Black Hole Core)
    if (r < rs) {
      col *= smoothstep(0.0, rs, r * 0.7);
    }

    // Spacetime Grid Metrics
    float grid = abs(sin(warpedP.x * 24.0)) * abs(sin(warpedP.y * 24.0));
    col += vec3(0.6, 0.1, 0.25) * pow(grid, 18.0) * 0.15;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// 3. Stellar Fusion GLSL Shader
const stellarFragmentShader = `
  uniform float u_time;
  uniform vec2 u_resolution;
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
    for (int i = 0; i < 4; i++) {
      v += a * noise(p); p *= 2.0; a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 center = vec2(0.12, 0.0);
    vec2 cp = p - center;
    float r = length(cp);
    float t = u_time * 0.15;

    vec3 col = vec3(0.06, 0.015, 0.0);

    // Dynamic Convective Plasma Turbulence (FBM)
    float angle = atan(cp.y, cp.x);
    float n = fbm(vec2(r * 8.0 - t * 0.5, angle * 4.0 + t * 0.2));

    // Nested Onion Skin Core Layers
    float core = 0.08 / (r + 0.02);
    col += vec3(1.0, 0.6, 0.15) * core * (0.6 + 0.4 * n);

    // Coronal Plasma Loops
    float arc = abs(sin(angle * 5.0 + t)) * (0.02 / (abs(r - 0.28) + 0.015));
    col += vec3(1.0, 0.8, 0.2) * arc * 0.4;

    // Outer Solar Wind Halo
    col += vec3(0.85, 0.3, 0.05) * (0.04 / (r + 0.15));

    gl_FragColor = vec4(col, 1.0);
  }
`;

// 4. Cosmic Web GLSL Shader
const cosmicWebFragmentShader = `
  uniform float u_time;
  uniform vec2 u_resolution;
  varying vec2 vUv;

  vec2 hash2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
  }

  void main() {
    vec2 p = gl_FragCoord.xy / u_resolution.xy;
    p.x *= u_resolution.x / u_resolution.y;
    float t = u_time * 0.04;

    vec2 st = p * 4.2;
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

    vec3 col = vec3(0.02, 0.01, 0.04);

    // Dark Matter Filaments Network
    float filament = smoothstep(0.0, 0.25, m_dist) - smoothstep(0.25, 0.5, m_dist);
    col += vec3(0.45, 0.15, 0.7) * filament * 0.5;

    // Galaxy Cluster Nodes
    float nodeGlow = 0.025 / (m_dist + 0.025);
    col += vec3(0.85, 0.6, 1.0) * nodeGlow * 0.4;

    // JWST 6-point Cross Spikes
    float crossDist = abs(fract(st.x) - 0.5) * abs(fract(st.y) - 0.5);
    col += vec3(0.9, 0.8, 0.4) * (0.0006 / (crossDist + 0.005)) * 0.25;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// 5. Pulsar & Gravitational Waves GLSL Shader
const pulsarFragmentShader = `
  uniform float u_time;
  uniform vec2 u_resolution;
  varying vec2 vUv;

  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec2 center = vec2(0.12, 0.0);
    vec2 cp = p - center;
    float r = length(cp);
    float t = u_time * 0.4; // Calm pulsar spin

    vec3 col = vec3(0.01, 0.025, 0.04);

    // 1. Relativistic Lighthouse Synchrotron Beams
    float beamAngle = atan(cp.y, cp.x) - t * 1.5;
    float beam = pow(abs(cos(beamAngle)), 32.0);
    col += vec3(0.0, 0.95, 1.0) * beam * (0.08 / (r + 0.05)) * 0.8;

    // 2. Dipolar Magnetic Field Lines
    float magnetic = abs(sin(atan(cp.y, cp.x) * 2.0)) * (0.015 / (abs(r - 0.25) + 0.02));
    col += vec3(0.2, 0.5, 0.9) * magnetic * 0.35;

    // 3. Spacetime Gravitational Wave Metric Ripples
    float gwRipples = sin(r * 45.0 - t * 4.0);
    col += vec3(0.1, 0.75, 0.9) * pow(abs(gwRipples), 6.0) * (0.03 / (r + 0.2)) * 0.4;

    // 4. Central Neutron Star Core
    float neutron = 0.03 / (r + 0.008);
    col += vec3(0.9, 1.0, 1.0) * neutron * 0.6;

    gl_FragColor = vec4(col, 1.0);
  }
`;

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

    const handlePointerMove = (e: MouseEvent) => {
      uniforms.u_mouse.value.set(e.clientX, window.innerHeight - e.clientY);
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
      accumulatedTime += delta * (speedRef.current || 0.5);
      uniforms.u_time.value = accumulatedTime;
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
  // EFFECT 2: CLASSIC PS5 FLUID WAVE RIBBONS (Original 2D Canvas Engine)
  // =========================================================================
  useEffect(() => {
    if (!isActive || theme.category !== 'classic' || !classicCanvasRef.current) return;

    const canvas = classicCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Floating Stardust Particles
    const count = Math.min(65, Math.floor((width * height) / 24000));
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.15 - Math.random() * 0.3,
        radius: 1.2 + Math.random() * 2.8,
        alpha: 0.2 + Math.random() * 0.6,
        pulseSpeed: 0.008 + Math.random() * 0.015,
      });
    }
    particlesRef.current = particles;

    let lastClassicNow = performance.now();
    let accumulatedClassicTime = 0;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const renderClassic = (now: number) => {
      const delta = Math.min(100, now - lastClassicNow);
      lastClassicNow = now;
      accumulatedClassicTime += delta * (speedRef.current || 0.5);
      const elapsed = accumulatedClassicTime;

      // 1. Deep Atmospheric Radial Gradient
      const grad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        width * 0.1,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.85
      );
      grad.addColorStop(0, theme.bgGradient[1]);
      grad.addColorStop(0.55, theme.bgGradient[0]);
      grad.addColorStop(1, theme.bgGradient[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. PS5 Dynamic Fluid Wave Ribbons
      if (theme.ribbonColors) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        theme.ribbonColors.forEach((ribbon) => {
          const t = elapsed * ribbon.speed + ribbon.phase;
          const baseY = height * ribbon.yBase;

          ctx.beginPath();
          ctx.moveTo(0, height);

          const steps = 18;
          const stepWidth = width / steps;

          for (let i = 0; i <= steps; i++) {
            const x = i * stepWidth;
            const harmonic1 = Math.sin(x * ribbon.freq + t) * ribbon.amp;
            const harmonic2 = Math.cos(x * ribbon.freq * 0.6 - t * 0.8) * (ribbon.amp * 0.45);
            const harmonic3 = Math.sin(t * 0.5 + x * 0.0006) * (ribbon.amp * 0.3);
            const y = baseY + harmonic1 + harmonic2 + harmonic3;

            if (i === 0) {
              ctx.lineTo(x, y);
            } else {
              const prevX = (i - 1) * stepWidth;
              const cX = (prevX + x) / 2;
              ctx.quadraticCurveTo(prevX, y, cX, y);
            }
          }

          ctx.lineTo(width, height);
          ctx.closePath();

          const ribbonGrad = ctx.createLinearGradient(0, baseY - ribbon.amp * 1.5, 0, height);
          ribbonGrad.addColorStop(0, ribbon.color1);
          ribbonGrad.addColorStop(0.4, ribbon.glow);
          ribbonGrad.addColorStop(1, ribbon.color2);

          ctx.fillStyle = ribbonGrad;
          ctx.fill();
        });

        ctx.restore();
      }

      // 3. Floating Stardust Spark Particles
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        p.alpha += p.pulseSpeed;
        const currentAlpha = 0.25 + Math.sin(p.alpha) * 0.35;

        const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3.2);
        radGrad.addColorStop(0, theme.particleColor);
        radGrad.addColorStop(0.35, theme.particleGlow);
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = radGrad;
        ctx.globalAlpha = Math.max(0.05, Math.min(1, currentAlpha));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3.2, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();

      classicAnimRef.current = requestAnimationFrame(renderClassic);
    };

    classicAnimRef.current = requestAnimationFrame(renderClassic);

    return () => {
      window.removeEventListener('resize', handleResize);
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

      {/* Interactive Astrophysics Scientific Educational HUD (Shown in Galaxy GLSL mode) */}
      <AnimatePresence>
        {theme.category === 'galaxy' && showSciHUD && (
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
                  title="隱藏科學面板"
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
                <span className="text-cyan-300 flex items-center gap-1">⚡ WebGL GLSL 片段著色器</span>
                <span className="text-slate-200 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-600">平穩優雅渲染</span>
              </div>
            </div>
          </motion.div>
        )}

        {theme.category === 'galaxy' && !showSciHUD && (
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
