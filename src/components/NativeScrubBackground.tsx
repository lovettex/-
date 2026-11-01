import React, { useEffect, useRef } from 'react';

export const NATIVE_SCRUB_VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4';

export function NativeScrubBackground() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Desktop Mouse Scrubbing Hook
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let prevX: number | null = null;
    let targetTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    let isSeeking = false;
    let hasPendingSeek = false;

    const commitSeek = (timeToSeek: number) => {
      if (!video || video.readyState < 1) {
        hasPendingSeek = true;
        return;
      }

      if (isSeeking || video.seeking) {
        hasPendingSeek = true;
        return;
      }

      isSeeking = true;
      hasPendingSeek = false;
      try {
        video.currentTime = timeToSeek;
      } catch {
        isSeeking = false;
      }
    };

    const handleSeeked = () => {
      isSeeking = false;
      if (hasPendingSeek && video) {
        hasPendingSeek = false;
        commitSeek(targetTime);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth < 1024) {
        prevX = null;
        return;
      }

      if (!video.paused) {
        video.pause();
      }

      const currentX = e.clientX;
      if (prevX === null) {
        prevX = currentX;
        targetTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
        return;
      }

      const delta = currentX - prevX;
      prevX = currentX;

      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        return;
      }

      const timeDelta = (delta / window.innerWidth) * 0.8 * duration;
      const baseTime = Number.isFinite(targetTime) ? targetTime : video.currentTime || 0;
      targetTime = Math.max(0, Math.min(duration, baseTime + timeDelta));

      commitSeek(targetTime);
    };

    video.addEventListener('seeked', handleSeeked);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      video.removeEventListener('seeked', handleSeeked);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Mobile Autoplay Hook
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const applyMobilePlayback = () => {
      if (window.innerWidth < 1024) {
        video.autoplay = true;
        video.loop = true;
        video.play().catch(() => {});
      } else {
        video.autoplay = false;
        video.pause();
      }
    };

    applyMobilePlayback();

    video.addEventListener('loadedmetadata', applyMobilePlayback);
    window.addEventListener('resize', applyMobilePlayback, { passive: true });

    return () => {
      video.removeEventListener('loadedmetadata', applyMobilePlayback);
      window.removeEventListener('resize', applyMobilePlayback);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none">
      <div className="order-last lg:order-none relative lg:absolute lg:inset-0 lg:z-0 overflow-hidden pointer-events-none w-full aspect-square md:aspect-video lg:aspect-auto lg:h-full bg-neutral-50 lg:bg-transparent">
        <video
          ref={videoRef}
          src={NATIVE_SCRUB_VIDEO_URL}
          muted
          playsInline
          preload="auto"
          className="w-full h-full object-cover object-right lg:object-right-bottom"
        />
      </div>
    </div>
  );
}

export default NativeScrubBackground;
