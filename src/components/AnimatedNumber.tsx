import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';

export function AnimatedNumber({ 
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
  const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
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

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span className={className}>{display}</motion.span>;
}
