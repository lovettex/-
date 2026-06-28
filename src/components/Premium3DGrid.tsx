import React, { useEffect, useState, useMemo } from "react";

// Seeded random helper to ensure consistent terrazzo chip layouts on every render
function createSeededRandom(seed: number) {
  let h = seed;
  return function() {
    h = Math.sin(h) * 10000;
    return h - Math.floor(h);
  };
}

interface TerrazzoChip {
  id: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  size: number; // diameter in pixels
  color: string;
  rotation: number; // degrees
  points: string; // custom polygon path points
}

// Terrazzo colors matching the uploaded high-end product reference image
const TERRAZZO_COLORS = [
  "#B95239", // Terracotta / Clay Orange-Red
  "#3D5B59", // Slate Teal / Dark Green
  "#E2B28B", // Sand Warm Ochre
  "#2C3437", // Deep Charcoal Black
  "#B1C3C0", // Pale Sage / Mint Grey
  "#D9C1B0", // Light Amber Pebble
  "#4A5D6B", // Muted Navy
];

export function Premium3DGrid() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      setMousePos({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Parallax offsets for different depth layers
  const shiftX = mousePos.x * -24;
  const shiftY = mousePos.y * -24;

  // Procedural generation of organic-shaped terrazzo chips
  const { farChips, midChips, nearChips } = useMemo(() => {
    const rand = createSeededRandom(42); // Seed to guarantee identical layout
    
    // Generate organic polygon coordinates around (50, 50) bounding box
    const generatePoints = (size: number) => {
      const sides = 3 + Math.floor(rand() * 4); // 3 to 6 sided shapes
      const points: string[] = [];
      const baseRadius = size / 2;
      
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 + (rand() * 0.4 - 0.2);
        // Add random indentation to make the stone look chipped and authentic
        const r = baseRadius * (0.65 + rand() * 0.35);
        const px = Math.round(baseRadius + r * Math.cos(angle));
        const py = Math.round(baseRadius + r * Math.sin(angle));
        points.push(`${px},${py}`);
      }
      return points.join(" ");
    };

    const far: TerrazzoChip[] = [];
    const mid: TerrazzoChip[] = [];
    const near: TerrazzoChip[] = [];

    // 1. Far Layer (Small, crisp, dense background chips)
    for (let i = 0; i < 110; i++) {
      const size = 6 + Math.floor(rand() * 10);
      far.push({
        id: `far-${i}`,
        x: rand() * 100,
        y: rand() * 100,
        size,
        color: TERRAZZO_COLORS[Math.floor(rand() * TERRAZZO_COLORS.length)],
        rotation: rand() * 360,
        points: generatePoints(size),
      });
    }

    // 2. Mid Layer (Medium, sharp, standard density chips)
    for (let i = 0; i < 65; i++) {
      const size = 18 + Math.floor(rand() * 18);
      mid.push({
        id: `mid-${i}`,
        x: rand() * 100,
        y: rand() * 100,
        size,
        color: TERRAZZO_COLORS[Math.floor(rand() * TERRAZZO_COLORS.length)],
        rotation: rand() * 360,
        points: generatePoints(size),
      });
    }

    // 3. Near Foreground Layer (Large, beautifully blurred chips for true Depth of Field / 裸眼景深)
    for (let i = 0; i < 14; i++) {
      const size = 65 + Math.floor(rand() * 45);
      near.push({
        id: `near-${i}`,
        x: rand() * 100,
        y: rand() * 100,
        size,
        color: TERRAZZO_COLORS[Math.floor(rand() * TERRAZZO_COLORS.length)],
        rotation: rand() * 360,
        points: generatePoints(size),
      });
    }

    return { farChips: far, midChips: mid, nearChips: near };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none bg-[#F3F3F5]">
      {/* High-fidelity Stone Plaster Texture base with fine sand grains */}
      <div 
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            radial-gradient(rgba(0,0,0,0.15) 1px, transparent 1px),
            radial-gradient(rgba(0,0,0,0.08) 1.5px, transparent 1.5px)
          `,
          backgroundSize: "24px 24px, 40px 40px",
          backgroundPosition: "0 0, 12px 12px",
        }}
      />

      {/* Layer 1: Far Background Terrazzo Chips (Gentle out-of-focus blur for realism, moves slowly) */}
      <div 
        className="absolute inset-[-20px] w-[calc(100%+40px)] h-[calc(100%+40px)] transition-transform duration-500 ease-out blur-[1.5px]"
        style={{
          transform: `translate3d(${shiftX * 0.4}px, ${shiftY * 0.4}px, 0)`,
        }}
      >
        <svg className="w-full h-full opacity-65">
          {farChips.map((chip) => (
            <polygon
              key={chip.id}
              points={chip.points}
              fill={chip.color}
              className="transition-all duration-300"
              style={{
                transform: `translate(${chip.x}vw, ${chip.y}vh) rotate(${chip.rotation}deg)`,
                transformOrigin: `${chip.size / 2}px ${chip.size / 2}px`,
              }}
            />
          ))}
        </svg>
      </div>

      {/* Layer 2: Mid Ground Terrazzo Chips (Sharp focus, moves at standard speed) */}
      <div 
        className="absolute inset-[-40px] w-[calc(100%+80px)] h-[calc(100%+80px)] transition-transform duration-500 ease-out"
        style={{
          transform: `translate3d(${shiftX * 0.85}px, ${shiftY * 0.85}px, 0)`,
        }}
      >
        <svg className="w-full h-full opacity-85">
          {midChips.map((chip) => (
            <polygon
              key={chip.id}
              points={chip.points}
              fill={chip.color}
              className="transition-all duration-300"
              style={{
                transform: `translate(${chip.x}vw, ${chip.y}vh) rotate(${chip.rotation}deg)`,
                transformOrigin: `${chip.size / 2}px ${chip.size / 2}px`,
              }}
            />
          ))}
        </svg>
      </div>

      {/* Layer 3: Foreground Terrazzo Chips (Enormous, styled with high CSS Lens Blur for epic depth-of-field 裸眼景深) */}
      <div 
        className="absolute inset-[-100px] w-[calc(100%+200px)] h-[calc(100%+200px)] transition-transform duration-500 ease-out blur-[18px]"
        style={{
          transform: `translate3d(${shiftX * 1.9}px, ${shiftY * 1.9}px, 0)`,
        }}
      >
        <svg className="w-full h-full opacity-[0.38]">
          {nearChips.map((chip) => (
            <polygon
              key={chip.id}
              points={chip.points}
              fill={chip.color}
              className="transition-all duration-300"
              style={{
                transform: `translate(${chip.x}vw, ${chip.y}vh) rotate(${chip.rotation}deg)`,
                transformOrigin: `${chip.size / 2}px ${chip.size / 2}px`,
              }}
            />
          ))}
        </svg>
      </div>

      {/* Premium Studio ambient gradient vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          background: "radial-gradient(circle at center, transparent 30%, rgba(243,243,245,0.15) 60%, rgba(243,243,245,0.7) 100%)"
        }}
      />

      {/* Matte Frosted Glass (磨砂玻璃) backdrop-blur overlay to soften the entire terrazzo background and maximize foreground legibility */}
      <div 
        className="absolute inset-0 pointer-events-none backdrop-blur-[10px] bg-[#F3F3F5]/45"
      />
    </div>
  );
}
