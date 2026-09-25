import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Atom, Orbit, Sparkles, Compass, Radio, Info, Eye, EyeOff } from 'lucide-react';

export interface PS5Theme {
  id: string;
  name: string;
  nameEn: string;
  iconColor: string;
  bgGradient: [string, string, string];
  accentColor: string;
  particleColor: string;
  particleGlow: string;
  galaxyType: 'kepler' | 'kerr-blackhole' | 'stellar-fusion' | 'cosmic-web' | 'pulsar-gw';
  sciConcept: string;
  sciFormula: string;
  sciDescription: string;
}

export const PS5_THEMES: PS5Theme[] = [
  {
    id: 'galaxy-kepler',
    name: '克卜勒行星天體力學',
    nameEn: 'Kepler Orbit & Habitable Zone',
    iconColor: '#38bdf8',
    bgGradient: ['#020617', '#08152e', '#01040d'],
    accentColor: '#38bdf8',
    particleColor: '#e0f2fe',
    particleGlow: 'rgba(56, 189, 248, 0.85)',
    galaxyType: 'kepler',
    sciConcept: '克卜勒行星三大定律 & 金髮姑娘宜居帶',
    sciFormula: 'T² = (4π² / GM) · a³  |  dA/dt = const',
    sciDescription: '展示天體力學軌道偏心率、近日點加速、拉格朗日點與適居帶行星凌日測光現象。',
  },
  {
    id: 'galaxy-kerr-blackhole',
    name: '克爾旋轉黑洞與時空彎曲',
    nameEn: 'Kerr Black Hole & Gravitational Time Dilation',
    iconColor: '#f43f5e',
    bgGradient: ['#0f0208', '#240614', '#080104'],
    accentColor: '#f43f5e',
    particleColor: '#ffe4e6',
    particleGlow: 'rgba(244, 63, 94, 0.85)',
    galaxyType: 'kerr-blackhole',
    sciConcept: '廣義相對論事件視界 & 引力時間膨脹',
    sciFormula: 'r₊ = (GM/c²)(1 + √(1 - a²))  |  Δt = Δt₀ / √(1 - rₛ/r)',
    sciDescription: '展示時空拖曳能層 (Ergosphere)、最內穩定軌道 (ISCO)、愛因斯坦環與光子層測地線。',
  },
  {
    id: 'galaxy-stellar-fusion',
    name: '恆星核融合週期與赫羅圖',
    nameEn: 'Stellar Nucleosynthesis & Fusion Core',
    iconColor: '#f59e0b',
    bgGradient: ['#170700', '#2e1202', '#0a0300'],
    accentColor: '#f59e0b',
    particleColor: '#fef3c7',
    particleGlow: 'rgba(245, 158, 11, 0.85)',
    galaxyType: 'stellar-fusion',
    sciConcept: '恆星核聚變洋蔥層模型 & 磁重聯閃焰',
    sciFormula: '4 ¹H ➔ ⁴He + 2e⁺ + 2νₑ + 26.7 MeV  |  M_ch ≈ 1.44 M☉',
    sciDescription: '展示主序星至鐵核極限的核合成流動、日冕物質拋射 (CME) 與阿爾芬波磁力線。',
  },
  {
    id: 'galaxy-cosmic-web',
    name: '韋伯深空巡天與宇宙紅移',
    nameEn: 'James Webb Cosmic Web & Expansion',
    iconColor: '#c084fc',
    bgGradient: ['#0b0318', '#1a0836', '#06010d'],
    accentColor: '#c084fc',
    particleColor: '#f5d0fe',
    particleGlow: 'rgba(192, 132, 252, 0.85)',
    galaxyType: 'cosmic-web',
    sciConcept: '哈伯宇宙膨脹定律 & 暗物質巨網',
    sciFormula: 'v = H₀ · d  |  1 + z = λ_obs / λ_emit',
    sciDescription: '展示暗物質絲狀結構、引力透鏡愛因斯坦十字、紅移光譜分解與 134 億年回溯觀測。',
  },
  {
    id: 'galaxy-pulsar-gw',
    name: '脈衝星強磁層與引力波',
    nameEn: 'Relativistic Pulsar & Gravitational Waves',
    iconColor: '#00f2fe',
    bgGradient: ['#01111c', '#02253d', '#00090f'],
    accentColor: '#00f2fe',
    particleColor: '#ccfbf1',
    particleGlow: 'rgba(0, 242, 254, 0.85)',
    galaxyType: 'pulsar-gw',
    sciConcept: '磁陀星偶極磁力線 & 雙中子星併合時空擾動',
    sciFormula: 'ḣ_μν = (2G/c⁴r) · d²Q_μν/dt²  |  B ≈ 10¹⁴ Gauss',
    sciDescription: '展示光塔燈塔效應同步輻射光錐、LIGO 引力波時空度規波紋與自轉減速能量耗散。',
  },
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  pulseSpeed: number;
}

interface Probe {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: Array<{ x: number; y: number; alpha: number }>;
  life: number;
}

interface PS5DynamicBackgroundProps {
  isActive: boolean;
  themeId?: string;
}

export function PS5DynamicBackground({ isActive, themeId = 'galaxy-kepler' }: PS5DynamicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const probesRef = useRef<Probe[]>([]);
  const mousePosRef = useRef<{ x: number; y: number; isActive: boolean }>({
    x: -1000,
    y: -1000,
    isActive: false,
  });

  const [showSciHUD, setShowSciHUD] = useState<boolean>(true);
  const [activeTelemetry, setActiveTelemetry] = useState<string>('系統待命中');

  const theme = PS5_THEMES.find((t) => t.id === themeId) || PS5_THEMES[0];

  // Sync PS5 High Contrast & Neon Glow variables with document
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

  // Window-level pointer tracking for full-screen dynamic astrophysics interaction
  useEffect(() => {
    if (!isActive) return;

    const handlePointerMove = (e: MouseEvent) => {
      mousePosRef.current = {
        x: e.clientX,
        y: e.clientY,
        isActive: true,
      };
    };

    const handlePointerLeave = () => {
      mousePosRef.current.isActive = false;
    };

    const handleClick = (e: MouseEvent) => {
      // Spawn an astrophysical orbital probe towards mouse target
      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.5;
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
      const speed = 4.2;

      probesRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        trail: [],
        life: 1.0,
      });

      if (probesRef.current.length > 8) {
        probesRef.current.shift();
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseleave', handlePointerLeave);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseleave', handlePointerLeave);
      window.removeEventListener('click', handleClick);
    };
  }, [isActive]);

  // Main Canvas Rendering Engine (60 FPS Scientific Astrophysics Simulation)
  useEffect(() => {
    if (!isActive) {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Initialize Cosmic Deep-Field Stars
    const initParticles = () => {
      const count = Math.min(120, Math.floor((width * height) / 16000));
      const list: Particle[] = [];
      for (let i = 0; i < count; i++) {
        list.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          radius: 0.8 + Math.random() * 2.2,
          alpha: 0.15 + Math.random() * 0.65,
          pulseSpeed: 0.005 + Math.random() * 0.012,
        });
      }
      particlesRef.current = list;
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    };
    window.addEventListener('resize', handleResize);
    initParticles();

    let startTime = performance.now();

    // =========================================================================
    // SCI-FI HUD HELPER: Celestial Coordinate Rings & Vectors
    // =========================================================================
    const drawCelestialCoordinates = (c: CanvasRenderingContext2D, cx: number, cy: number, maxR: number) => {
      c.save();
      c.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      c.lineWidth = 1;
      c.setLineDash([3, 8]);

      // Concentric Distance Grids (AU / Parsecs)
      for (let r = 80; r <= maxR; r += 70) {
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.stroke();
      }

      // Crosshair Axes
      c.beginPath();
      c.moveTo(cx - maxR, cy);
      c.lineTo(cx + maxR, cy);
      c.moveTo(cx, cy - maxR);
      c.lineTo(cx, cy + maxR);
      c.stroke();
      c.restore();
    };

    // =========================================================================
    // 1. GALAXY SYSTEM 1: KEPLER CELESTIAL ORBITS & HABITABLE ZONE
    // =========================================================================
    const drawKeplerSystem = (c: CanvasRenderingContext2D, elapsed: number, mx: number, my: number) => {
      const cx = width * 0.55;
      const cy = height * 0.48;
      const t = elapsed * 0.0008;

      drawCelestialCoordinates(c, cx, cy, Math.min(width, height) * 0.45);

      // 1. Goldilocks Habitable Zone (綠色宜居帶 0.95 ~ 1.4 AU)
      const rInner = 150;
      const rOuter = 220;
      const hzGrad = c.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
      hzGrad.addColorStop(0, 'rgba(16, 185, 129, 0)');
      hzGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.12)');
      hzGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
      c.fillStyle = hzGrad;
      c.beginPath();
      c.arc(cx, cy, rOuter, 0, Math.PI * 2);
      c.arc(cx, cy, rInner, 0, Math.PI * 2, true);
      c.fill();

      // Habitable Zone Label
      c.fillStyle = 'rgba(16, 185, 129, 0.65)';
      c.font = '10px monospace';
      c.fillText('✦ 宜居帶 GOLDILOCKS ZONE (0.95 - 1.37 AU)', cx + rInner + 8, cy - 8);

      // 2. Central Parent Star (Sol / Kepler-186)
      const starGrad = c.createRadialGradient(cx, cy, 2, cx, cy, 45);
      starGrad.addColorStop(0, '#ffffff');
      starGrad.addColorStop(0.2, '#fef08a');
      starGrad.addColorStop(0.6, '#38bdf8');
      starGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = starGrad;
      c.beginPath();
      c.arc(cx, cy, 45, 0, Math.PI * 2);
      c.fill();

      // 3. Planetary Orbit Paths (Kepler's Ellipses with eccentricity e)
      const planets = [
        { name: 'Kepler-b (熔岩微星)', a: 75, b: 70, e: 0.18, speed: 2.2, size: 3.5, color: '#f87171', desc: '0.38 AU | 47.8 km/s' },
        { name: 'Kepler-c (金屬陸塊)', a: 115, b: 110, e: 0.10, speed: 1.5, size: 4.8, color: '#fbbf24', desc: '0.72 AU | 35.0 km/s' },
        { name: 'Kepler-e (宜居海洋星)', a: 185, b: 180, e: 0.04, speed: 1.0, size: 5.5, color: '#34d399', desc: '1.02 AU | 29.8 km/s (液態水存在)' },
        { name: 'Kepler-f (超級類地行星)', a: 260, b: 245, e: 0.15, speed: 0.7, size: 7.0, color: '#60a5fa', desc: '1.55 AU | 24.1 km/s' },
        { name: 'Kepler-g (氣態巨行星)', a: 350, b: 335, e: 0.08, speed: 0.45, size: 9.5, color: '#c084fc', desc: '2.80 AU | 18.0 km/s (帶光環)' },
      ];

      planets.forEach((p, idx) => {
        // Orbit Ellipse
        c.save();
        c.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        c.lineWidth = 1;
        c.setLineDash([4, 4]);
        c.beginPath();
        c.ellipse(cx, cy, p.a, p.b, 0.2, 0, Math.PI * 2);
        c.stroke();
        c.restore();

        // Keplerian Speed Modulation (Faster at Perihelion: Kepler's 2nd Law)
        const meanAngle = t * p.speed + idx * 1.3;
        const angle = meanAngle + 2 * p.e * Math.sin(meanAngle); // True anomaly approx

        const px = cx + Math.cos(angle) * p.a;
        const py = cy + Math.sin(angle) * p.b;

        // Gravitational Velocity Vector Line
        const vx = -Math.sin(angle) * (20 / Math.sqrt(p.a)) * 12;
        const vy = Math.cos(angle) * (20 / Math.sqrt(p.a)) * 12;

        c.save();
        c.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(px + vx, py + vy);
        c.stroke();
        c.restore();

        // Planet Body with Glow
        c.save();
        c.fillStyle = p.color;
        c.shadowColor = p.color;
        c.shadowBlur = 10;
        c.beginPath();
        c.arc(px, py, p.size, 0, Math.PI * 2);
        c.fill();
        c.restore();

        // Planet Label & Telemetry HUD
        c.fillStyle = '#ffffff';
        c.font = '10px monospace';
        c.fillText(`${p.name}`, px + p.size + 6, py - 4);
        c.fillStyle = 'rgba(255, 255, 255, 0.5)';
        c.font = '8px monospace';
        c.fillText(`${p.desc}`, px + p.size + 6, py + 8);

        // Hover Detection
        const dist = Math.hypot(mx - px, my - py);
        if (dist < 35) {
          c.save();
          c.strokeStyle = '#38bdf8';
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(px, py, p.size + 8, 0, Math.PI * 2);
          c.stroke();
          c.restore();
          setActiveTelemetry(`[天體鎖定] ${p.name} | 軌道半長軸 a = ${p.a} px | 偏心率 e = ${p.e} | 克卜勒週期律 T = ${p.speed.toFixed(2)}x`);
        }
      });

      // 4. Interactive Gravitational Well at Cursor
      if (mousePosRef.current.isActive) {
        c.save();
        c.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        c.setLineDash([2, 4]);
        c.beginPath();
        c.arc(mx, my, 40, 0, Math.PI * 2);
        c.stroke();

        // Gravitational Force Vector to Parent Star
        c.strokeStyle = 'rgba(254, 240, 138, 0.6)';
        c.setLineDash([4, 4]);
        c.beginPath();
        c.moveTo(mx, my);
        c.lineTo(cx, cy);
        c.stroke();
        c.restore();
      }
    };

    // =========================================================================
    // 2. GALAXY SYSTEM 2: KERR BLACK HOLE & RELATIVISTIC TIME DILATION
    // =========================================================================
    const drawKerrBlackHole = (c: CanvasRenderingContext2D, elapsed: number, mx: number, my: number) => {
      const cx = width * 0.52;
      const cy = height * 0.5;

      // 1. Spacetime Curvature Metric Grid Distortion
      c.save();
      c.strokeStyle = 'rgba(244, 63, 94, 0.1)';
      c.lineWidth = 1;
      const gridSize = 38;
      for (let x = 0; x < width; x += gridSize) {
        c.beginPath();
        for (let y = 0; y < height; y += 12) {
          const d = Math.hypot(x - cx, y - cy);
          const warp = Math.max(0, 1800 / (d + 60));
          const wx = x - (x - cx) * (warp / (d + 20));
          const wy = y - (y - cy) * (warp / (d + 20));
          if (y === 0) c.moveTo(wx, wy);
          else c.lineTo(wx, wy);
        }
        c.stroke();
      }
      c.restore();

      // 2. Relativistic Doppler-Boosted Accretion Disk (Interstellar-style)
      c.save();
      c.translate(cx, cy);
      c.scale(1.0, 0.35);
      c.rotate(elapsed * 0.0003);

      const diskGrad = c.createRadialGradient(0, 0, 50, 0, 0, 240);
      diskGrad.addColorStop(0, '#ffffff');
      diskGrad.addColorStop(0.2, 'rgba(251, 146, 60, 0.95)');
      diskGrad.addColorStop(0.5, 'rgba(244, 63, 94, 0.65)');
      diskGrad.addColorStop(0.85, 'rgba(159, 18, 57, 0.25)');
      diskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = diskGrad;
      c.beginPath();
      c.arc(0, 0, 240, 0, Math.PI * 2);
      c.fill();
      c.restore();

      // 3. Ergosphere & Frame Dragging Boundary (動能圈 - 彭羅斯過程)
      c.save();
      c.translate(cx, cy);
      c.strokeStyle = 'rgba(251, 146, 60, 0.5)';
      c.lineWidth = 1.5;
      c.setLineDash([6, 4]);
      c.beginPath();
      c.ellipse(0, 0, 78, 62, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();

      // Ergosphere Annotation
      c.fillStyle = '#fb923c';
      c.font = '10px monospace';
      c.fillText('✦ 能層 ERGOSPHERE (時空拖曳 Frame Dragging)', cx + 85, cy - 25);
      c.fillStyle = 'rgba(255, 255, 255, 0.4)';
      c.font = '9px monospace';
      c.fillText('彭羅斯過程能量提取區: 0 < r < r_ergo', cx + 85, cy - 10);

      // 4. Photon Sphere Geodesic Ring
      c.save();
      c.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      c.lineWidth = 2;
      c.shadowColor = '#f43f5e';
      c.shadowBlur = 12;
      c.beginPath();
      c.arc(cx, cy, 48, 0, Math.PI * 2);
      c.stroke();
      c.restore();

      // 5. Event Horizon (事件視界黑洞本體)
      c.save();
      c.fillStyle = '#000000';
      c.beginPath();
      c.arc(cx, cy, 42, 0, Math.PI * 2);
      c.fill();
      c.restore();

      // 6. Interactive Free-Fall Observer Time Dilation Telemetry
      const userDist = Math.hypot(mx - cx, my - cy);
      const rs = 42; // Schwarzschild radius in px
      if (mousePosRef.current.isActive && userDist > rs) {
        const timeFactor = Math.sqrt(Math.max(0.001, 1 - rs / userDist));
        const redshiftZ = (1 / timeFactor) - 1;

        // Gravitational Lensing Light Cone Ray
        c.save();
        c.strokeStyle = 'rgba(244, 63, 94, 0.7)';
        c.lineWidth = 1.5;
        c.setLineDash([3, 3]);
        c.beginPath();
        c.moveTo(mx, my);
        c.lineTo(cx, cy);
        c.stroke();

        // Observer Reticle
        c.strokeStyle = '#ffffff';
        c.strokeRect(mx - 10, my - 10, 20, 20);
        c.fillStyle = '#ffffff';
        c.font = '10px monospace';
        c.fillText(`觀測者座標 [r = ${userDist.toFixed(0)} px]`, mx + 16, my - 14);
        c.fillStyle = '#fda4af';
        c.fillText(`時鐘膨脹流速: ${timeFactor.toFixed(3)}x (外界1秒 = 這裡${(1/timeFactor).toFixed(1)}秒)`, mx + 16, my);
        c.fillStyle = '#fb7185';
        c.fillText(`引力紅移量 z = ${redshiftZ.toFixed(3)} | 潮汐力 dF/dr = ${(2000/(userDist*userDist)).toFixed(2)} N/kg`, mx + 16, my + 14);
        c.restore();

        setActiveTelemetry(`[廣義相對論] 距離事件視界 ${(userDist - rs).toFixed(0)} px | 時間膨脹係數 γ = ${(1/timeFactor).toFixed(2)} | 光子測地線偏折`);
      }
    };

    // =========================================================================
    // 3. GALAXY SYSTEM 3: STELLAR NUCLEOSYNTHESIS & FUSION ONION MODEL
    // =========================================================================
    const drawStellarFusion = (c: CanvasRenderingContext2D, elapsed: number, mx: number, my: number) => {
      const cx = width * 0.52;
      const cy = height * 0.48;
      const t = elapsed * 0.001;

      // 1. Coronal Mass Ejections & Alfvén Magnetic Field Loops (日冕物質拋射與磁力線環)
      c.save();
      c.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      c.lineWidth = 1.5;
      for (let loop = 0; loop < 7; loop++) {
        const loopAngle = (loop * Math.PI * 2) / 7 + Math.sin(t * 0.3 + loop) * 0.2;
        const loopR = 170 + Math.sin(t * 1.5 + loop * 2) * 25;
        const lx1 = cx + Math.cos(loopAngle - 0.2) * 115;
        const ly1 = cy + Math.sin(loopAngle - 0.2) * 115;
        const lx2 = cx + Math.cos(loopAngle + 0.2) * 115;
        const ly2 = cy + Math.sin(loopAngle + 0.2) * 115;
        const cpx = cx + Math.cos(loopAngle) * loopR;
        const cpy = cy + Math.sin(loopAngle) * loopR;

        c.beginPath();
        c.moveTo(lx1, ly1);
        c.quadraticCurveTo(cpx, cpy, lx2, ly2);
        c.stroke();
      }
      c.restore();

      // 2. Stellar Fusion Onion Layers (洋蔥結構核融合層)
      const layers = [
        { name: '氫燃燒包層 (H ➔ He)', r: 120, color: 'rgba(239, 68, 68, 0.35)', temp: '1,500 萬 K' },
        { name: '氦燃燒層 (He ➔ C/O)', r: 92, color: 'rgba(249, 115, 22, 0.45)', temp: '1 億 K' },
        { name: '碳/氧融合層 (C ➔ Ne/Mg)', r: 68, color: 'rgba(245, 158, 11, 0.55)', temp: '6 億 K' },
        { name: '矽融合層 (Si ➔ Fe/Ni)', r: 46, color: 'rgba(234, 179, 8, 0.7)', temp: '30 億 K' },
        { name: '鐵核心 (Fe 坍縮極限)', r: 24, color: '#ffffff', temp: '鐵核無能量釋放 ➔ 超新星' },
      ];

      layers.forEach((layer) => {
        c.save();
        c.fillStyle = layer.color;
        c.beginPath();
        c.arc(cx, cy, layer.r, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        c.lineWidth = 1;
        c.stroke();
        c.restore();
      });

      // Layer Annotations
      layers.forEach((layer, idx) => {
        const textY = cy - 130 + idx * 24;
        c.fillStyle = '#fef08a';
        c.font = '10px monospace';
        c.fillText(`✦ Layer ${idx + 1}: ${layer.name}`, cx + 135, textY);
        c.fillStyle = 'rgba(255, 255, 255, 0.5)';
        c.font = '9px monospace';
        c.fillText(`核心溫度: ${layer.temp}`, cx + 135, textY + 11);
      });

      // 3. Solar Wind Charged Particles
      const particles = particlesRef.current;
      c.save();
      c.fillStyle = '#fde047';
      particles.slice(0, 35).forEach((p) => {
        const pAngle = Math.atan2(p.y - cy, p.x - cx);
        p.x += Math.cos(pAngle) * 0.8;
        p.y += Math.sin(pAngle) * 0.8;

        if (Math.hypot(p.x - cx, p.y - cy) > 380) {
          p.x = cx + Math.cos(pAngle) * 115;
          p.y = cy + Math.sin(pAngle) * 115;
        }

        c.beginPath();
        c.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        c.fill();
      });
      c.restore();

      // Interactive Flare Trigger on Hover
      const distToStar = Math.hypot(mx - cx, my - cy);
      if (mousePosRef.current.isActive && distToStar < 180) {
        c.save();
        c.strokeStyle = '#fef08a';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(mx, my);
        c.stroke();

        c.fillStyle = '#ffffff';
        c.font = '10px monospace';
        c.fillText(`[磁重聯電離閃焰] 太陽風流速 650 km/s | 錢德拉塞卡質量極限 1.44 M☉`, mx + 12, my - 6);
        c.restore();

        setActiveTelemetry(`[恆星物理] 赫羅圖光譜類型 G2V | 核心壓力 2.5×10¹⁶ Pa | 質子-質子鏈核融合釋能 26.7 MeV`);
      }
    };

    // =========================================================================
    // 4. GALAXY SYSTEM 4: COSMIC WEB & WEBB DEEP FIELD REDSHIFT
    // =========================================================================
    const drawCosmicWeb = (c: CanvasRenderingContext2D, elapsed: number, mx: number, my: number) => {
      // 1. Dark Matter Filament Network (暗物質絲狀宇宙巨網)
      const nodes = [
        { x: width * 0.2, y: height * 0.25, z: 2.1, type: '螺旋星系 NGC 1365' },
        { x: width * 0.35, y: height * 0.65, z: 4.8, type: '早期星系團 SMACS 0723' },
        { x: width * 0.55, y: height * 0.3, z: 8.5, type: '高紅移原星系 GLASS-z12' },
        { x: width * 0.75, y: height * 0.55, z: 11.1, type: '宇宙黎明星系 GN-z11' },
        { x: width * 0.85, y: height * 0.2, z: 13.4, type: '韋伯極深場 JADES-GS-z14-0' },
        { x: width * 0.45, y: height * 0.85, z: 1.2, type: '透鏡星系團 Abell 2744' },
      ];

      // Draw Filaments Connecting Nodes
      c.save();
      c.strokeStyle = 'rgba(192, 132, 252, 0.25)';
      c.lineWidth = 1.2;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          c.beginPath();
          c.moveTo(nodes[i].x, nodes[i].y);
          // Filament organic curve
          const midX = (nodes[i].x + nodes[j].x) / 2 + Math.sin(elapsed * 0.0005 + i + j) * 20;
          const midY = (nodes[i].y + nodes[j].y) / 2 + Math.cos(elapsed * 0.0005 + i + j) * 20;
          c.quadraticCurveTo(midX, midY, nodes[j].x, nodes[j].y);
          c.stroke();
        }
      }
      c.restore();

      // 2. JWST Hexagonal Golden Mirror Diffraction Spikes
      nodes.forEach((node) => {
        // Redshift Color Mapping (Higher z = More Redshifted / Infrared)
        const hue = Math.max(0, 280 - node.z * 22); // Purple -> Red -> Deep IR
        const starColor = `hsl(${hue}, 90%, 65%)`;

        c.save();
        c.translate(node.x, node.y);

        // Hexagonal 6-point JWST Diffraction Spike
        c.strokeStyle = starColor;
        c.lineWidth = 1;
        c.globalAlpha = 0.7;
        for (let sp = 0; sp < 6; sp++) {
          const sAngle = (sp * Math.PI) / 3;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(Math.cos(sAngle) * 32, Math.sin(sAngle) * 32);
          c.stroke();
        }

        // Galaxy Core
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(0, 0, 3.5, 0, Math.PI * 2);
        c.fill();

        // Node Redshift Tag
        c.fillStyle = starColor;
        c.font = '10px monospace';
        c.fillText(`${node.type}`, 16, -6);
        c.fillStyle = 'rgba(255, 255, 255, 0.5)';
        c.font = '9px monospace';
        c.fillText(`紅移 z = ${node.z.toFixed(1)} | 退行速度 v = ${(node.z * 70000).toFixed(0)} km/s`, 16, 8);
        c.restore();
      });

      // 3. Einstein Cross Gravitational Lensing Quadruple Image at Center
      const ecX = width * 0.55;
      const ecY = height * 0.3;
      c.save();
      c.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      c.setLineDash([2, 2]);
      c.beginPath();
      c.arc(ecX, ecY, 18, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#fef08a';
      c.font = '8px monospace';
      c.fillText('愛因斯坦十字 EINSTEIN CROSS', ecX - 55, ecY - 24);
      c.restore();

      // Interactive NIRSpec Spectrometer HUD on Pointer Move
      if (mousePosRef.current.isActive) {
        c.save();
        c.strokeStyle = '#c084fc';
        c.strokeRect(mx - 15, my - 15, 30, 30);

        // Spectral Line Grating Display
        c.fillStyle = 'rgba(15, 23, 42, 0.85)';
        c.fillRect(mx + 20, my - 30, 220, 60);
        c.strokeStyle = '#c084fc';
        c.strokeRect(mx + 20, my - 30, 220, 60);

        c.fillStyle = '#ffffff';
        c.font = '10px monospace';
        c.fillText(`JWST NIRSpec 光譜儀掃描中`, mx + 26, my - 16);

        // Emission Lines (H-alpha, OIII, Ly-alpha)
        const lines = [
          { name: 'Ly-α (121.6nm)', color: '#ec4899', x: 70 },
          { name: '[OIII] (500.7nm)', color: '#38bdf8', x: 125 },
          { name: 'H-α (656.3nm)', color: '#ef4444', x: 175 },
        ];
        lines.forEach(l => {
          c.strokeStyle = l.color;
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(mx + 20 + l.x, my);
          c.lineTo(mx + 20 + l.x, my + 20);
          c.stroke();
          c.fillStyle = l.color;
          c.font = '8px monospace';
          c.fillText(l.name, mx + 20 + l.x - 12, my + 22);
        });

        c.restore();

        setActiveTelemetry(`[宇宙學觀測] 哈伯常數 H₀ = 67.4 km/s/Mpc | 宇宙回溯時間 Lookback Time = 13.4 Gyr | 宇宙微波背景 2.725 K`);
      }
    };

    // =========================================================================
    // 5. GALAXY SYSTEM 5: PULSAR MAGNETOSPHERE & GRAVITATIONAL WAVE CHIRP
    // =========================================================================
    const drawPulsarGravitationalWaves = (c: CanvasRenderingContext2D, elapsed: number, mx: number, my: number) => {
      const cx = width * 0.5;
      const cy = height * 0.48;
      const t = elapsed * 0.003;

      // 1. Spacetime Gravitational Wave Metric Ripples (LIGO 引力波時空漣漪)
      c.save();
      c.strokeStyle = 'rgba(0, 242, 254, 0.25)';
      c.lineWidth = 1.2;
      for (let ring = 0; ring < 7; ring++) {
        const r = ((elapsed * 0.08 + ring * 55) % 380);
        const alpha = Math.max(0, 1 - r / 380) * 0.4;
        c.strokeStyle = `rgba(0, 242, 254, ${alpha})`;
        c.beginPath();
        // Quadrupole Gravitational Wave Distortion (四極波紋形變)
        for (let a = 0; a <= Math.PI * 2; a += 0.1) {
          const quadR = r * (1 + Math.cos(a * 2 + t * 0.5) * 0.12);
          const qx = cx + Math.cos(a) * quadR;
          const qy = cy + Math.sin(a) * quadR;
          if (a === 0) c.moveTo(qx, qy);
          else c.lineTo(qx, qy);
        }
        c.closePath();
        c.stroke();
      }
      c.restore();

      // 2. Dipolar Magnetic Field Lines (偶極磁場磁力線)
      c.save();
      c.translate(cx, cy);
      c.rotate(0.35); // Magnetic axis tilt angle

      c.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      c.lineWidth = 1.2;
      for (let m = 1; m <= 4; m++) {
        const mR = m * 35;
        // North magnetic loop
        c.beginPath();
        c.ellipse(0, mR * 0.7, mR * 0.6, mR * 1.2, 0, 0, Math.PI);
        c.stroke();
        // South magnetic loop
        c.beginPath();
        c.ellipse(0, -mR * 0.7, mR * 0.6, mR * 1.2, 0, Math.PI, Math.PI * 2);
        c.stroke();
      }

      // 3. Relativistic Beaming Light Cones (光塔輻射光錐)
      const beamAngle = t * 1.8;
      c.save();
      c.rotate(beamAngle);

      for (let beam = 0; beam < 2; beam++) {
        c.rotate(Math.PI);
        const bGrad = c.createLinearGradient(0, 0, 0, 360);
        bGrad.addColorStop(0, '#ffffff');
        bGrad.addColorStop(0.2, 'rgba(0, 242, 254, 0.9)');
        bGrad.addColorStop(0.6, 'rgba(59, 130, 246, 0.25)');
        bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = bGrad;
        c.beginPath();
        c.moveTo(-8, 0);
        c.lineTo(-40, 360);
        c.lineTo(40, 360);
        c.lineTo(8, 0);
        c.closePath();
        c.fill();
      }
      c.restore();

      // 4. Central Neutron Star Core
      const nGrad = c.createRadialGradient(0, 0, 1, 0, 0, 22);
      nGrad.addColorStop(0, '#ffffff');
      nGrad.addColorStop(0.4, '#00f2fe');
      nGrad.addColorStop(0.8, '#3b82f6');
      nGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = nGrad;
      c.beginPath();
      c.arc(0, 0, 22, 0, Math.PI * 2);
      c.fill();
      c.restore();

      // Annotations
      c.fillStyle = '#00f2fe';
      c.font = '10px monospace';
      c.fillText('✦ 毫秒脈衝星 PSR B1919+21 (自轉週期 P = 1.337 s)', cx + 45, cy - 80);
      c.fillStyle = 'rgba(255, 255, 255, 0.5)';
      c.font = '9px monospace';
      c.fillText('磁層強磁場: B ≈ 1.2 × 10¹² Gauss | 密度: 10¹⁴ g/cm³', cx + 45, cy - 65);

      // Interactive Pulse Waveform Monitor
      if (mousePosRef.current.isActive) {
        c.save();
        c.fillStyle = 'rgba(2, 6, 23, 0.9)';
        c.fillRect(mx + 15, my - 25, 180, 50);
        c.strokeStyle = '#00f2fe';
        c.strokeRect(mx + 15, my - 25, 180, 50);

        c.fillStyle = '#ffffff';
        c.font = '9px monospace';
        c.fillText('LIGO 引力波 Chirp 頻譜示波器', mx + 20, my - 12);

        // Chirp waveform
        c.strokeStyle = '#00f2fe';
        c.lineWidth = 1.5;
        c.beginPath();
        for (let i = 0; i < 150; i++) {
          const wy = my + 10 + Math.sin(i * 0.2 + t * 3) * (5 + (i / 150) * 8);
          if (i === 0) c.moveTo(mx + 20 + i, wy);
          else c.lineTo(mx + 20 + i, wy);
        }
        c.stroke();
        c.restore();

        setActiveTelemetry(`[重力波天文台] 雙緻密星併合 GW170817 | 四極輻射能損 dE/dt = 10⁴⁵ W | 時空幾何度規擾動 h_μν`);
      }
    };

    // =========================================================================
    // MAIN SIMULATION RENDER LOOP
    // =========================================================================
    const render = (now: number) => {
      const elapsed = now - startTime;
      const mx = mousePosRef.current.x;
      const my = mousePosRef.current.y;

      // 1. Deep Space Cosmic Background
      const bgGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        50,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.8
      );
      bgGrad.addColorStop(0, theme.bgGradient[1]);
      bgGrad.addColorStop(0.6, theme.bgGradient[0]);
      bgGrad.addColorStop(1, theme.bgGradient[2]);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Deep Field Starfield Particles
      ctx.save();
      const particles = particlesRef.current;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.fillStyle = theme.particleColor;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // 3. Active Probes Trajectory
      ctx.save();
      const probes = probesRef.current;
      for (let pIdx = probes.length - 1; pIdx >= 0; pIdx--) {
        const pr = probes[pIdx];
        pr.x += pr.vx;
        pr.y += pr.vy;
        pr.life -= 0.008;

        pr.trail.push({ x: pr.x, y: pr.y, alpha: 0.8 });
        if (pr.trail.length > 20) pr.trail.shift();

        if (pr.life <= 0 || pr.x < -50 || pr.x > width + 50 || pr.y < -50 || pr.y > height + 50) {
          probes.splice(pIdx, 1);
          continue;
        }

        // Draw Probe Trail
        ctx.strokeStyle = theme.accentColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        pr.trail.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();

        // Probe Body
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 4. Render Active Scientifically Educational Galaxy Animation
      switch (theme.galaxyType) {
        case 'kepler':
          drawKeplerSystem(ctx, elapsed, mx, my);
          break;
        case 'kerr-blackhole':
          drawKerrBlackHole(ctx, elapsed, mx, my);
          break;
        case 'stellar-fusion':
          drawStellarFusion(ctx, elapsed, mx, my);
          break;
        case 'cosmic-web':
          drawCosmicWeb(ctx, elapsed, mx, my);
          break;
        case 'pulsar-gw':
          drawPulsarGravitationalWaves(ctx, elapsed, mx, my);
          break;
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isActive, themeId, theme]);

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
          <canvas ref={canvasRef} className="w-full h-full block" />
          {/* Subtle cinematic vignette */}
          <div className="absolute inset-0 bg-radial from-transparent via-transparent to-black/45 pointer-events-none" />
        </motion.div>
      </AnimatePresence>

      {/* Interactive Astrophysics Scientific Educational HUD (Top-Right Overlay) */}
      <AnimatePresence>
        {showSciHUD && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-3.5 right-4 z-[990] hidden md:flex flex-col items-end gap-1.5 pointer-events-auto select-none"
          >
            <div className="bg-slate-950/85 backdrop-blur-xl border border-slate-700/60 p-3 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5)] max-w-sm text-left text-xs font-mono text-slate-200">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full animate-ping"
                    style={{ backgroundColor: theme.iconColor }}
                  />
                  <span className="font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
                    <Atom className="w-3.5 h-3.5 text-indigo-400" />
                    {theme.sciConcept}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSciHUD(false)}
                  className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                  title="隱藏科學面板"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Physical Formula Badge */}
              <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-emerald-400 font-bold mb-2">
                {theme.sciFormula}
              </div>

              {/* Educational Description */}
              <p className="text-[11px] text-slate-300 leading-relaxed font-sans font-medium mb-2">
                {theme.sciDescription}
              </p>

              {/* Real-time Interactive Pointer Telemetry */}
              <div className="p-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-[10px] text-indigo-300 font-mono">
                <span className="text-slate-400">遙測態勢: </span>
                {activeTelemetry}
              </div>

              <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                <span>💡 移動滑鼠即時探測天體物理參數</span>
                <span>點擊發射探測器 🚀</span>
              </div>
            </div>
          </motion.div>
        )}

        {!showSciHUD && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowSciHUD(true)}
            className="fixed top-3.5 right-4 z-[990] bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white p-2 rounded-full border border-slate-700 shadow-md cursor-pointer transition-colors"
            title="開啟天文物理科學說明面板"
          >
            <Info className="w-4 h-4 text-indigo-400" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
