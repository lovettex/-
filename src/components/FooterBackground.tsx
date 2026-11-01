import React, { useEffect, useRef } from 'react';
import gazeFramesData from '../data/gaze-frames.json';

const GAZE_FRAMES = gazeFramesData as [number, number][];

const SOURCE_WIDTH = 1920;
const SOURCE_HEIGHT = 1080;
const SOURCE_CENTER_X = SOURCE_WIDTH / 2; // 960
const SOURCE_CENTER_Y = SOURCE_HEIGHT / 2; // 540
const EYE_MIDPOINT_X = 948;
const EYE_MIDPOINT_Y = 418;
const DEADZONE_RADIUS = 8;
const FRAME_OFFSET = 1 / 240;
const MIN_SEEK_DIFF = 1 / 48;
const END_CLAMP_MARGIN = 1 / 24;
const TWO_PI = Math.PI * 2;

export const CLOUDFRONT_SOURCE_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260908_073327_03643c0a-db33-417a-ae8f-4a39259c7f9c.mp4';

export function findGazeFrameTime(targetAngle: number): number {
  let bestTime = GAZE_FRAMES[0][1];
  let minDiff = Infinity;

  for (let i = 0; i < GAZE_FRAMES.length; i++) {
    const [sampleAngle, videoTime] = GAZE_FRAMES[i];
    const absDiff = Math.abs(targetAngle - sampleAngle);
    const circularDiff = Math.min(absDiff, TWO_PI - absDiff);
    if (circularDiff < minDiff) {
      minDiff = circularDiff;
      bestTime = videoTime;
    }
  }

  return bestTime;
}

export function FooterBackground() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Desktop video starts paused at time 0
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      // Ignore if metadata not yet loaded
    }

    let rafId: number | null = null;
    let isSeeking = false;
    let latestTargetTime: number | null = null;
    let lastPointer: { clientX: number; clientY: number } | null = null;

    const applySeek = (requestedTime: number) => {
      if (!video) return;

      // Require current frame data (HAVE_CURRENT_DATA = 2)
      if (video.readyState < 2) {
        latestTargetTime = requestedTime;
        return;
      }

      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 7.041667;
      const maxTime = Math.max(0, duration - END_CLAMP_MARGIN);
      const clampedTarget = Math.max(0, Math.min(requestedTime, maxTime));

      if (Math.abs(video.currentTime - clampedTarget) <= MIN_SEEK_DIFF) {
        return;
      }

      if (isSeeking || video.seeking) {
        latestTargetTime = clampedTarget;
        return;
      }

      isSeeking = true;
      latestTargetTime = null;
      try {
        video.currentTime = clampedTarget;
      } catch {
        isSeeking = false;
      }
    };

    const evaluateGazeFromPointer = () => {
      rafId = null;
      if (!video || !lastPointer) return;

      const videoRect = video.getBoundingClientRect();
      if (videoRect.width <= 0 || videoRect.height <= 0) return;

      const scale = Math.max(videoRect.width / SOURCE_WIDTH, videoRect.height / SOURCE_HEIGHT);
      const eyeScreenX = videoRect.left + videoRect.width / 2 + (EYE_MIDPOINT_X - SOURCE_CENTER_X) * scale;
      const eyeScreenY = videoRect.top + videoRect.height / 2 + (EYE_MIDPOINT_Y - SOURCE_CENTER_Y) * scale;

      const dx = lastPointer.clientX - eyeScreenX;
      const dy = lastPointer.clientY - eyeScreenY;

      // Ignore changes inside an 8px radius around the midpoint to avoid unstable angles
      if (Math.hypot(dx, dy) < DEADZONE_RADIUS) {
        return;
      }

      const rawAngle = Math.atan2(dy, dx);
      const normalizedAngle = rawAngle < 0 ? rawAngle + TWO_PI : rawAngle;

      const baseTime = findGazeFrameTime(normalizedAngle);
      const targetTime = baseTime + FRAME_OFFSET;

      applySeek(targetTime);
    };

    const scheduleUpdate = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(evaluateGazeFromPointer);
      }
    };

    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      lastPointer = { clientX: e.clientX, clientY: e.clientY };
      scheduleUpdate();
    };

    const handleViewportChange = () => {
      if (lastPointer) {
        scheduleUpdate();
      }
    };

    const handleSeeked = () => {
      isSeeking = false;
      if (latestTargetTime !== null) {
        const nextTarget = latestTargetTime;
        latestTargetTime = null;
        applySeek(nextTarget);
      }
    };

    const handleLoadedData = () => {
      video.pause();
      if (lastPointer) {
        scheduleUpdate();
      }
    };

    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('loadeddata', handleLoadedData);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.addEventListener('scroll', handleViewportChange, { passive: true });

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('loadeddata', handleLoadedData);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none bg-[#f3eef8]">
      <video
        ref={videoRef}
        src="/footer-scrub.mp4"
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover pointer-events-none select-none"
      />
    </div>
  );
}

export default FooterBackground;
