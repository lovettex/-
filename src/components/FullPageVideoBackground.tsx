import React, { useEffect, useRef } from 'react';

export const FULL_PAGE_BACKGROUND_MP4_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260801_001207_ec20d138-aa45-4b2b-ab8c-bdc71607f240.mp4';

export function FullPageVideoBackground() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.play().catch(() => {});
  }, []);

  return (
    <video
      ref={videoRef}
      src={FULL_PAGE_BACKGROUND_MP4_URL}
      autoPlay
      loop
      muted
      playsInline
      aria-hidden="true"
      className="absolute inset-0 w-full h-full object-cover opacity-100 pointer-events-none z-0"
    />
  );
}

export default FullPageVideoBackground;
