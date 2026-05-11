import { motion, useSpring, useMotionValue, useTransform, AnimatePresence } from 'motion/react';
import React, { useRef, useState } from 'react';

// Spring config for smooth physics
const springConfig = { damping: 15, stiffness: 150 };

/**
 * Magnetic element that follows the cursor slightly when hovered
 */
export const Magnetic: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;
    
    // Limits the magnetic pull range
    x.set(distanceX * 0.3);
    y.set(distanceY * 0.3);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Button with 3D tilt, scale, and glow effect
 */
export const InteractiveButton = React.forwardRef<
  any,
  any
>(({ children, className = "", disabled = false, as: Component = "button", noGlow = false, ...props }, ref) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-100, 100], [30, -30]), springConfig);
  const rotateY = useSpring(useTransform(x, [-100, 100], [-30, 30]), springConfig);

  // Filter out props that shouldn't go to DOM
  const { asChild, ...validProps } = props as any;

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(e.clientX - centerX);
    y.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const MotionComponent = (motion as any)[Component] || motion.button;

  return (
    <MotionComponent
      ref={ref}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      className={`relative group ${className}`}
      {...validProps}
    >
      {/* Glow effect */}
      {!noGlow && (
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-0 group-hover:opacity-60 transition duration-300 pointer-events-none" />
      )}
      
      <div className="relative h-full w-full flex items-center justify-center">
        {children}
      </div>
    </MotionComponent>
  );
});

InteractiveButton.displayName = "InteractiveButton";

/**
 * Card that fades and slides in when scrolled into view
 */
export const ScrollIn: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ 
        type: "spring", 
        damping: 20, 
        stiffness: 100,
        delay 
      }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Layout wrapper for list items
 */
export const AnimatedListItem: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", damping: 20, stiffness: 200 }}
    >
      {children}
    </motion.div>
  );
};
