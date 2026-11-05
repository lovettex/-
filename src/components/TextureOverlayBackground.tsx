import React, { useEffect, useRef } from 'react';

export const THEME_1_VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_045634_e1c98c76-1265-4f5c-882a-4276f2080894.mp4';

/**
 * Theme 1: Texture Overlay Background
 * - Full-bleed looping muted autoplaying video covering the entire section with object-cover
 * - Container: max-w-[1831px] centered with responsive horizontal padding
 * - Section has rounded-b-[32px] bottom corners, clipping the video
 * - A full-screen fixed texture overlay sits on top of everything (z-50, pointer-events-none).
 *   It uses a /texture.png image with mix-blend-mode: lighten at opacity: 0.6,
 *   covering the entire viewport with background-size: cover.
 */
export function TextureOverlayBackground() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.play().catch(() => {});
  }, []);

  return (
    <>
      {/* Full-bleed looping muted autoplaying video covering section inside max-w-[1831px] container */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none flex justify-center w-full">
        <section className="relative w-full max-w-[1831px] px-2 sm:px-4 md:px-6 h-full overflow-hidden rounded-b-[32px] flex items-center justify-center">
          <video
            ref={videoRef}
            src={THEME_1_VIDEO_URL}
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
            className="w-full h-full object-cover rounded-b-[32px] pointer-events-none"
          />
        </section>
      </div>

      {/* A full-screen fixed texture overlay sits on top of everything (z-50, pointer-events-none) */}
      <div
        className="fixed inset-0 z-50 pointer-events-none select-none"
        style={{
          backgroundImage: "url('/texture.png')",
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          mixBlendMode: 'lighten',
          opacity: 0.6,
        }}
        aria-hidden="true"
      />
    </>
  );
}

export default TextureOverlayBackground;
