import React, { useRef, useEffect } from "react";
import { motion } from "motion/react";
import { playClickSound } from "../lib/audio";

interface CinemaDockProps {
  tabs: any[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

/**
 * CinemaDock - A minimalist, macOS Dock-style magnetic stock navigation bar.
 * Designed for "Cinema Focus Mode" (電影觀賞專注模式) with high-fidelity Gaussian-curve zoom magnetism.
 * 
 * 1. MATHEMATICAL FORMULA & PARAMETERS:
 *    Let d = absolute horizontal distance in pixels between the item center and mouse cursor.
 *    The magnification scale S is defined by the Gaussian function:
 *       S(d) = BASE_SCALE + (MAX_SCALE - BASE_SCALE) * e^(-(d^2) / (2 * SIGMA^2))
 *    
 *    Adjustable Parameters:
 *    - MAX_SCALE: 1.65  (The maximum scale multiplier for the nearest element)
 *    - BASE_SCALE: 1.0  (Standard non-hovered element scale)
 *    - SIGMA: 90.0      (Standard deviation in pixels. Controls the spread/radius of the magnetic effect)
 *    - MAX_Y_POP: -12   (The maximum upward lift in pixels for the hovered element)
 */
export const CinemaDock: React.FC<CinemaDockProps> = ({ tabs, activeId, onSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const centersRef = useRef<{ id: string; center: number }[]>([]);

  // Constants directly aligned with the macOS Dock prototype's mathematical model
  const MAX_DIST = 100.0;     // Interaction radius limit in pixels
  const SIGMA = 40.0;        // Gaussian standard deviation (spread of the curve)
  const MAX_LIFT = 10.0;      // Maximum horizontal shift (popping to the right) in pixels
  const MAX_SCALE_FACTOR = 0.5; // Scale multiplier (gives a max scale of 1.5x)

  useEffect(() => {
    // Reset positions on mount or tab list change
    handleMouseLeave();
  }, [tabs, activeId]);

  const handleMouseEnter = () => {
    if (!containerRef.current) return;
    
    // Temporarily reset inline transforms to measure clean unscaled positions
    const items = containerRef.current.querySelectorAll("[data-dock-item]");
    items.forEach((itemEl: any) => {
      itemEl.style.transform = "none";
    });
    
    const rect = containerRef.current.getBoundingClientRect();
    const centers: { id: string; center: number }[] = [];
    items.forEach((itemEl: any) => {
      const id = itemEl.getAttribute("data-id");
      const itemRect = itemEl.getBoundingClientRect();
      const center = itemRect.top + itemRect.height / 2 - rect.top;
      if (id) {
        centers.push({ id, center });
      }
    });
    
    centersRef.current = centers;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const items = containerRef.current.querySelectorAll("[data-dock-item]");
    if (!items.length) return;

    // Cache unscaled centers if not cached or if tabs list length changed
    if (centersRef.current.length !== items.length) {
      handleMouseEnter();
    }

    items.forEach((itemEl: any) => {
      const id = itemEl.getAttribute("data-id");
      const cached = centersRef.current.find(c => c.id === id);
      
      let distance = MAX_DIST;
      if (cached) {
        distance = Math.abs(mouseY - cached.center);
      } else {
        const itemRect = itemEl.getBoundingClientRect();
        const itemCenter = itemRect.top + itemRect.height / 2 - rect.top;
        distance = Math.abs(mouseY - itemCenter);
      }

      // Gaussian attenuation curve
      const falloff = distance < MAX_DIST ? Math.exp(-Math.pow(distance, 2) / (2 * Math.pow(SIGMA, 2))) : 0;

      const scale = 1.0 + falloff * MAX_SCALE_FACTOR;
      const translateX = falloff * MAX_LIFT;
      
      // Calculate dynamic opacity transition
      const isActive = itemEl.getAttribute("data-active") === "true";
      const baseOpacity = isActive ? 1.0 : 0.4;
      const targetOpacity = baseOpacity + (1.0 - baseOpacity) * falloff;

      itemEl.style.transform = `scale(${scale.toFixed(3)}) translateX(${translateX.toFixed(2)}px)`;
      itemEl.style.opacity = `${targetOpacity.toFixed(3)}`;
    });
  };

  const handleMouseLeave = () => {
    if (!containerRef.current) return;
    centersRef.current = []; // Clear cache on leave
    const items = containerRef.current.querySelectorAll("[data-dock-item]");
    items.forEach((itemEl: any) => {
      const isActive = itemEl.getAttribute("data-active") === "true";
      itemEl.style.transform = "scale(1) translateX(0px)";
      itemEl.style.opacity = isActive ? "1.0" : "0.4";
    });
  };

  return (
    <div className="w-full h-full flex flex-col justify-start select-none">
      {/* Magnetic Outer Container (pure text, no backgrounds or boxes) */}
      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="flex flex-col items-start gap-4 pl-8 pr-4 py-6 relative z-50 cursor-pointer w-full"
        style={{ contentVisibility: "auto" }}
      >
        {tabs.map((tab) => {
          const isSelected = tab.id === activeId;
          return (
            <div
              key={`dock-${tab.id}`}
              data-dock-item
              data-id={tab.id}
              data-active={isSelected}
              onClick={() => {
                onSelect(tab.id);
                playClickSound();
              }}
              className="relative flex items-center justify-start transition-all duration-300 ease-out py-1 px-4 min-w-[120px]"
              style={{
                transformOrigin: "left center",
                willChange: "transform, opacity",
              }}
            >
              {/* Minimal Red Accent Vertical Left Indicator matching active::after */}
              {isSelected && (
                <motion.div
                  layoutId="cinemaActiveBar"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[#e5484d] rounded-sm shadow-[0_0_8px_rgba(229,72,77,0.7)]"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}

              {/* Stock Symbol Text */}
              <span
                className={`font-sans text-[16px] tracking-wider font-bold uppercase transition-colors duration-140 ${
                  isSelected ? "text-white" : "text-white/40 hover:text-white/80"
                }`}
              >
                {tab.symbol}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
