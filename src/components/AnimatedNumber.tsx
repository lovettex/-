import React, { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { playTickSound } from '../lib/audio';

let lastGlobalTickTime = 0;

export const AnimatedNumber = React.memo(function AnimatedNumber({ 
  value, 
  prefix = "", 
  suffix = "", 
  decimals = 0,
  className = "",
  showPlus = false
}: { 
  value: number; 
  prefix?: string; 
  suffix?: string; 
  decimals?: number;
  className?: string;
  showPlus?: boolean;
}) {
  const spring = useSpring(value, { mass: 0.35, stiffness: 210, damping: 26 });
  const display = useTransform(spring, (current) => {
    const isNegative = current < 0;
    const absValue = Math.abs(current);
    const sign = isNegative ? "-" : ((showPlus && current >= 0) ? "+" : "");
    const formatted = absValue.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
    return `${sign}${prefix}${formatted}${suffix}`;
  });

  const isMounted = useRef(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current === value && isMounted.current) return;
    prevValueRef.current = value;
    spring.set(value);
    if (isMounted.current) {
      const now = performance.now();
      if (now - lastGlobalTickTime > 90) {
        lastGlobalTickTime = now;
        playTickSound();
      }
    } else {
      isMounted.current = true;
    }
  }, [value, spring]);

  return <motion.span className={className}>{display}</motion.span>;
});

