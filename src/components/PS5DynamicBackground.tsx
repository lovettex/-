import React, { useEffect } from 'react';
import { PS5Theme, PS5_THEMES } from '../types/ps5Themes';
import { FooterBackground } from './FooterBackground';
import { NativeScrubBackground } from './NativeScrubBackground';
import { FullPageVideoBackground } from './FullPageVideoBackground';

export type { PS5Theme };
export { PS5_THEMES };

interface PS5DynamicBackgroundProps {
  isActive: boolean;
  themeId?: string;
  speedMultiplier?: number;
}

export function PS5DynamicBackground({
  isActive,
  themeId = 'fullpage-loop-video',
}: PS5DynamicBackgroundProps) {
  const theme = PS5_THEMES.find((t) => t.id === themeId) || PS5_THEMES[0];

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

  if (!isActive) return null;

  if (theme.id === 'lavender-gaze-heart') {
    return <FooterBackground />;
  }

  if (theme.id === 'native-scrub-video') {
    return <NativeScrubBackground />;
  }

  return <FullPageVideoBackground />;
}

export default PS5DynamicBackground;


