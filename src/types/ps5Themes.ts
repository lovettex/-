export interface PS5Theme {
  id: string;
  name: string;
  nameEn: string;
  category: 'galaxy' | 'classic' | 'tokyo';
  iconColor: string;
  bgGradient: [string, string, string];
  accentColor: string;
  particleColor: string;
  particleGlow: string;
  galaxyType?: 'kepler' | 'kerr-blackhole' | 'stellar-fusion' | 'cosmic-web' | 'pulsar-gw' | 'golden-bokeh' | 'hypernova-glow';
  tokyoType?: 'porsche-gt3-rs';
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
  // DYNAMIC SPEED TOKYO SERIES (🏎️ 動感急速東京系列)
  // =========================================================================
  {
    id: 'tokyo-porsche-gt3rs',
    name: 'Porsche GT3 RS 東京極速',
    nameEn: 'Porsche GT3 RS Live Wallpaper',
    category: 'tokyo',
    iconColor: '#f4a6ba',
    bgGradient: ['#0f131a', '#1e2530', '#0a0d12'],
    accentColor: '#f4a6ba',
    particleColor: '#ffe1e8',
    particleGlow: 'rgba(244, 166, 186, 0.85)',
    tokyoType: 'porsche-gt3-rs',
    sciConcept: '保時捷 911 GT3 RS 賽道空氣力學與東京夜色',
    sciFormula: 'F_downforce = ½ · ρ · v² · C_L  |  4.0L NA Flat-6',
    sciDescription: 'Porsche GT3 RS 寫真動態桌布，結合呼吸式景深、雨夜濕地倒影、金屬掠影光澤與飄逸櫻花瓣。',
  },

  // =========================================================================
  // GALAXY GLSL SCIENTIFIC SHADER SERIES (7 ASTROPHYSICS PHENOMENA)
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
    name: '宇宙網狀結構與暗物質細絲',
    nameEn: 'Cosmic Web & Dark Matter Filaments',
    category: 'galaxy',
    iconColor: '#a855f7',
    bgGradient: ['#0d031b', '#1c0836', '#06010d'],
    accentColor: '#a855f7',
    particleColor: '#f3e8ff',
    particleGlow: 'rgba(168, 85, 247, 0.85)',
    galaxyType: 'cosmic-web',
    sciConcept: '宇宙大尺度結構 & 冷暗物質 (CDM) 暈',
    sciFormula: 'δ(x) = [ρ(x) - ρ̄] / ρ̄  |  P(k) ∝ kⁿ',
    sciDescription: 'GLSL 多孔密集結構與高維 Voronoi 噪聲交織出百萬光年長度之星系團節點與暗物質網。',
  },
  {
    id: 'galaxy-pulsar-gw',
    name: '脈衝星強磁場與重力波波紋',
    nameEn: 'Pulsar Magnetosphere & Gravitational Waves',
    category: 'galaxy',
    iconColor: '#06b6d4',
    bgGradient: ['#02121a', '#062a3a', '#01080d'],
    accentColor: '#06b6d4',
    particleColor: '#cffaff',
    particleGlow: 'rgba(6, 182, 212, 0.85)',
    galaxyType: 'pulsar-gw',
    sciConcept: '中子星極向噴流 & 愛因斯坦重力波波紋',
    sciFormula: 'h_ij = (2G/c⁴r) · (d²I_ij/dt²)  |  P = 1.337 ms',
    sciDescription: 'GLSL 雙波束高能錐形燈塔噴流、相對論性對流與時空網格重力波漣漪擴散。',
  },
  {
    id: 'galaxy-golden-bokeh',
    name: '金色量子光子場與光斑散景',
    nameEn: 'Quantum Photon Field & Golden Bokeh',
    category: 'galaxy',
    iconColor: '#eab308',
    bgGradient: ['#120c02', '#281a03', '#0a0601'],
    accentColor: '#eab308',
    particleColor: '#fef08a',
    particleGlow: 'rgba(234, 179, 8, 0.85)',
    galaxyType: 'golden-bokeh',
    sciConcept: '量子電動力學 (QED) 光子場 & 光學相干散景',
    sciFormula: 'E = hν  |  |ψ⟩ = ∑ c_n |n⟩  |  A(r) = e^(-r²/w²)',
    sciDescription: 'GLSL 金色量子光斑場、高斯景深散景與微光波粒二象性流動。',
  },
  {
    id: 'galaxy-hypernova-glow',
    name: '超超新星爆發與伽瑪射線暴',
    nameEn: 'Hypernova & Gamma-Ray Burst',
    category: 'galaxy',
    iconColor: '#ec4899',
    bgGradient: ['#18020d', '#33051c', '#0c0106'],
    accentColor: '#ec4899',
    particleColor: '#fce7f3',
    particleGlow: 'rgba(236, 72, 153, 0.85)',
    galaxyType: 'hypernova-glow',
    sciConcept: '極超新星核塌縮 & 相對論性 GRB 極向噴流',
    sciFormula: 'E_k ≈ 10⁵² erg  |  L_GRB ≈ 10⁵³ erg/s',
    sciDescription: 'GLSL 衝擊波殼層演化、快中子捕獲 R-過程金屬元素合成與粉紫幻彩能量雲霧。',
  },

  // =========================================================================
  // CLASSIC SONY PS5 WAVE & RIBBON SERIES
  // =========================================================================
  {
    id: 'ps5-flow-dark',
    name: 'PS5 經典夜間波浪',
    nameEn: 'PlayStation 5 Midnight Flow',
    category: 'classic',
    iconColor: '#3b82f6',
    bgGradient: ['#030712', '#0f172a', '#020617'],
    accentColor: '#3b82f6',
    particleColor: '#93c5fd',
    particleGlow: 'rgba(59, 130, 246, 0.8)',
    ribbonColors: [
      { color1: '#1d4ed8', color2: '#3b82f6', glow: '#60a5fa', speed: 0.8, amp: 28, freq: 0.012, phase: 0, yBase: 0 },
      { color1: '#0284c7', color2: '#06b6d4', glow: '#22d3ee', speed: 0.6, amp: 35, freq: 0.009, phase: 1.5, yBase: -15 },
      { color1: '#4338ca', color2: '#6366f1', glow: '#818cf8', speed: 1.0, amp: 22, freq: 0.015, phase: 3.1, yBase: 15 },
    ],
    sciConcept: 'Sony PS5 系統介面流體波動學',
    sciFormula: 'y(x,t) = A · sin(k x - ω t + φ)',
    sciDescription: 'Sony 原廠經典夜間藍紫流體絲帶，隨流體力學相位平滑飄逸。',
  },
  {
    id: 'ps5-flow-light',
    name: 'PS5 珍珠極光極簡',
    nameEn: 'PlayStation 5 Pearl White Flow',
    category: 'classic',
    iconColor: '#10b981',
    bgGradient: ['#f8fafc', '#e2e8f0', '#f1f5f9'],
    accentColor: '#059669',
    particleColor: '#047857',
    particleGlow: 'rgba(16, 185, 129, 0.6)',
    ribbonColors: [
      { color1: '#059669', color2: '#10b981', glow: '#34d399', speed: 0.7, amp: 25, freq: 0.011, phase: 0.5, yBase: 0 },
      { color1: '#0284c7', color2: '#38bdf8', glow: '#7dd3fc', speed: 0.9, amp: 30, freq: 0.008, phase: 2.2, yBase: -20 },
      { color1: '#0d9488', color2: '#14b8a6', glow: '#2dd4bf', speed: 0.5, amp: 20, freq: 0.014, phase: 4.0, yBase: 10 },
    ],
    sciConcept: '高飽和珍珠白光澤與折射',
    sciFormula: 'I = I₀ · (cos²θ + n₂/n₁)',
    sciDescription: '極簡亮色調高貴白珍珠光澤，柔和淡雅且不影響螢幕閱讀。',
  },
  {
    id: 'ps5-cyberpunk',
    name: '賽博霓虹紫金流光',
    nameEn: 'Cyberpunk Neon Wave',
    category: 'classic',
    iconColor: '#d946ef',
    bgGradient: ['#18021e', '#2c0838', '#0e0112'],
    accentColor: '#d946ef',
    particleColor: '#f5d0fe',
    particleGlow: 'rgba(217, 70, 239, 0.85)',
    ribbonColors: [
      { color1: '#c026d3', color2: '#e879f9', glow: '#f0abfc', speed: 1.1, amp: 32, freq: 0.013, phase: 0.2, yBase: -5 },
      { color1: '#b45309', color2: '#f59e0b', glow: '#fcd34d', speed: 0.8, amp: 26, freq: 0.010, phase: 2.8, yBase: 12 },
      { color1: '#9333ea', color2: '#a855f7', glow: '#c084fc', speed: 1.3, amp: 38, freq: 0.016, phase: 4.5, yBase: -18 },
    ],
    sciConcept: '高反差霓虹光譜與能量激發',
    sciFormula: 'λ = hc / ΔE',
    sciDescription: '高彩度粉紫金光交織，呈現極具科技未來的賽博龐克光采。',
  },
];
