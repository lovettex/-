import { useEffect } from 'react';

/**
 * 自動進入全螢幕模式 (Auto Fullscreen Mode)
 * 網頁載入時自動嘗試進入全螢幕；因現代瀏覽器安全策略需使用者手勢觸發，
 * 同時掛載全域首次點擊/觸控/按鍵事件監聽，在使用者首次與畫面互動時立即自動啟動全螢幕。
 */
export function useAutoFullscreen() {
  useEffect(() => {
    const triggerFullscreen = () => {
      const doc = document as any;
      const elem = document.documentElement as any;

      const isAlreadyFullscreen = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!isAlreadyFullscreen && elem) {
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          elem.msRequestFullscreen();
        }
      }
    };

    // 1. 嘗試在網頁載入時立即請求全螢幕
    triggerFullscreen();

    // 2. 註冊首次使用者互動事件監聽 (解決瀏覽器限制需 User Gesture 的阻擋)
    const handleFirstInteraction = () => {
      triggerFullscreen();
      removeListeners();
    };

    const events = ['click', 'touchstart', 'pointerdown', 'keydown'] as const;

    const addListeners = () => {
      events.forEach((eventName) => {
        window.addEventListener(eventName, handleFirstInteraction, {
          capture: true,
          passive: true,
        });
      });
    };

    const removeListeners = () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleFirstInteraction, {
          capture: true,
        });
      });
    };

    addListeners();

    // 3. 監聽全螢幕變化，若已成功進入全螢幕則移除首次手勢監聽
    const onFullscreenChange = () => {
      const doc = document as any;
      if (
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      ) {
        removeListeners();
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    return () => {
      removeListeners();
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);
}
