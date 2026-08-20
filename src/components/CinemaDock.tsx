import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, MotionValue } from "motion/react";
import { playClickSound } from "../lib/audio";

interface CinemaDockProps {
  tabs: any[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

interface DockItemProps {
  tab: any;
  isSelected: boolean;
  isIndicatorActive: boolean;
  mouseY: MotionValue<number>;
  onSelect: (id: string) => void;
  onHover: () => void;
}

/**
 * DockItem - Renders an individual stock symbol with a spring-loaded magnetic zoom effect.
 * The outer container remains completely stable in layout space to prevent any alignment jitter,
 * while only the inner text container scales and translates horizontally.
 */
const DockItem: React.FC<DockItemProps> = ({
  tab,
  isSelected,
  isIndicatorActive,
  mouseY,
  onSelect,
  onHover,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Dynamic calculations relative to the viewport (completely stable during parent scrolling)
  const scaleValue = useTransform(mouseY, (val: number) => {
    if (val === Infinity || !ref.current) return 1;
    const bounds = ref.current.getBoundingClientRect();
    const centerY = bounds.top + bounds.height / 2;
    const distance = Math.abs(val - centerY);

    const MAX_DIST = 110;
    if (distance < MAX_DIST) {
      const SIGMA = 45;
      const falloff = Math.exp(-Math.pow(distance, 2) / (2 * Math.pow(SIGMA, 2)));
      return 1.0 + falloff * 0.45; // Max scale 1.45x
    }
    return 1;
  });

  const translateXValue = useTransform(mouseY, (val: number) => {
    if (val === Infinity || !ref.current) return 0;
    const bounds = ref.current.getBoundingClientRect();
    const centerY = bounds.top + bounds.height / 2;
    const distance = Math.abs(val - centerY);

    const MAX_DIST = 110;
    if (distance < MAX_DIST) {
      const SIGMA = 45;
      const falloff = Math.exp(-Math.pow(distance, 2) / (2 * Math.pow(SIGMA, 2)));
      return falloff * 12; // Max lift 12px to the right
    }
    return 0;
  });

  const opacityValue = useTransform(mouseY, (val: number) => {
    const baseOpacity = isSelected ? 1.0 : 0.45;
    if (val === Infinity || !ref.current) return baseOpacity;
    
    const bounds = ref.current.getBoundingClientRect();
    const centerY = bounds.top + bounds.height / 2;
    const distance = Math.abs(val - centerY);

    const MAX_DIST = 110;
    if (distance < MAX_DIST) {
      const SIGMA = 45;
      const falloff = Math.exp(-Math.pow(distance, 2) / (2 * Math.pow(SIGMA, 2)));
      return baseOpacity + (1.0 - baseOpacity) * falloff;
    }
    return baseOpacity;
  });

  // macOS Dock spring configuration: low mass and high stiffness for crisp, snappy responsiveness
  const springConfig = { mass: 0.12, stiffness: 220, damping: 18 };
  const scale = useSpring(scaleValue, springConfig);
  const translateX = useSpring(translateXValue, springConfig);
  const opacity = useSpring(opacityValue, springConfig);

  return (
    <div
      ref={ref}
      onMouseEnter={onHover}
      onClick={() => {
        onSelect(tab.id);
        playClickSound();
      }}
      className="relative flex items-center justify-start py-2 sm:py-1.5 pl-7 sm:pl-8 pr-4 min-w-[110px] sm:min-w-[120px] cursor-pointer h-11 sm:h-10 select-none active:bg-white/5 transition-colors rounded-lg touch-manipulation"
    >
      {/* Minimal Red Accent Vertical Left Indicator */}
      {isIndicatorActive && (
        <motion.div
          layoutId="cinemaActiveBar"
          className="absolute left-2.5 sm:left-3 top-2 bottom-2 w-[3px] bg-[#e5484d] rounded-sm shadow-[0_0_8px_rgba(229,72,77,0.7)] z-10"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}

      {/* Stock Symbol Text - only this div scales and translates, keeping the red line stable */}
      <motion.div
        style={{
          transformOrigin: "left center",
          scale,
          translateX,
          opacity,
        }}
        className="w-full flex items-center justify-start"
      >
        <span
          className={`font-sans text-[15px] sm:text-[16px] tracking-wider font-bold uppercase transition-colors duration-150 ${
            isSelected ? "text-white" : "text-white/40 hover:text-white/85"
          }`}
        >
          {tab.symbol}
        </span>
      </motion.div>
    </div>
  );
};

/**
 * CinemaDock - A beautiful vertical dock inspired directly by Apple macOS.
 */
export const CinemaDock: React.FC<CinemaDockProps> = ({ tabs, activeId, onSelect }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const mouseY = useMotionValue<number>(Infinity);

  const handleMouseMove = (e: React.MouseEvent) => {
    mouseY.set(e.clientY);
  };

  const handleMouseLeave = () => {
    mouseY.set(Infinity);
    setHoveredId(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      mouseY.set(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    mouseY.set(Infinity);
    setHoveredId(null);
  };

  // If hovering, indicator follows the hovered item. Otherwise, it snaps back to activeId.
  const activeIndicatorId = hoveredId || activeId;

  return (
    <div className="w-full h-full flex flex-col justify-start select-none">
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex flex-col items-start gap-1 sm:gap-3.5 py-2 sm:py-6 relative z-50 w-full"
      >
        {tabs.map((tab) => {
          const isSelected = tab.id === activeId;
          const isIndicatorActive = tab.id === activeIndicatorId;
          return (
            <DockItem
              key={`dock-${tab.id}`}
              tab={tab}
              isSelected={isSelected}
              isIndicatorActive={isIndicatorActive}
              mouseY={mouseY}
              onSelect={onSelect}
              onHover={() => setHoveredId(tab.id)}
            />
          );
        })}
      </div>
    </div>
  );
};
