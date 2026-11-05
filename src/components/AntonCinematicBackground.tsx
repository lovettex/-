import React, { useEffect, useRef } from 'react';

export const THEME_2_VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_151551_992053d1-3d3e-4b8c-abac-45f22158f411.mp4';

/**
 * Theme 2: Anton Cinematic Background
 * - Full-bleed looping muted autoplaying video covering the entire section with object-cover
 * - Container: Same max-w-[1831px] centered, with generous vertical padding (64px-96px responsive)
 * - Top Row (flex row on desktop, column on mobile):
 *   Left: Heading in Anton, responsive 32px-60px, uppercase
 */
export function AntonCinematicBackground() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.play().catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none flex justify-center w-full">
      {/* Full-bleed looping muted autoplaying video */}
      <video
        ref={videoRef}
        src={THEME_2_VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {/* Same max-w-[1831px] centered, with generous vertical padding (64px-96px responsive) */}
      <div className="relative w-full max-w-[1831px] px-4 sm:px-6 md:px-8 py-16 md:py-24 z-10 flex flex-col justify-between pointer-events-none h-full">
        {/* Top Row (flex row on desktop, column on mobile):
            Left: Heading in Anton, responsive 32px-60px, uppercase */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4">
          <div className="flex flex-col">
            <h1
              className="font-['Anton',sans-serif] uppercase text-[32px] sm:text-[42px] md:text-[50px] lg:text-[60px] tracking-wider text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)] leading-tight select-none"
              style={{ fontFamily: "'Anton', sans-serif" }}
            >
              DYNAMIC TRADING LOG
            </h1>
            <span className="text-xs sm:text-sm font-black tracking-[0.25em] uppercase text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] mt-1">
              Cinematic Strategy & Risk Engine
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AntonCinematicBackground;
