import { useEffect } from 'react';

/**
 * 自動進入全螢幕模式 (Auto Fullscreen Mode)
 * 初次打開網頁時自動嘗試進入全螢幕；因現代瀏覽器安全性策略限制非使用者手勢觸發，
 * 透過全域監聽使用者首次合法的互動操作 (click, touchend, keydown) 立即安全啟動全螢幕。
 * 一旦成功進入全螢幕，即自動解除監聽，不影響後續正常操作與手動退出全螢幕。
 */
export function useAutoFullscreen() {
  useEffect(() => {
    let isDisposed = false;
    let hasEnteredOnce = false;

    const isAlreadyFullscreen = (): boolean => {
      const doc = document as any;
      return !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
    };

    const triggerFullscreen = async (): Promise<boolean> => {
      if (isDisposed || isAlreadyFullscreen()) return true;
      const elem = document.documentElement as any;
      if (!elem) return false;

      try {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
          return true;
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
          return true;
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
          return true;
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
          return true;
        }
      } catch {
        // 瀏覽器若因無有效手勢或權限限制拒絕，靜默等待後續合法使用者操作
        return false;
      }
      return false;
    };

    // 1. 嘗試在網頁載入時直接請求全螢幕 (部分無痕或已授權環境可直接生效)
    triggerFullscreen().then((success) => {
      if (success) {
        hasEnteredOnce = true;
        removeListeners();
      }
    });

    // 2. 監聽合法的 User Gesture: click, touchend, keydown (排除 pointerdown 避免過早觸發並被瀏覽器拒絕)
    const handleUserGesture = async () => {
      if (hasEnteredOnce || isAlreadyFullscreen()) {
        removeListeners();
        return;
      }

      const ok = await triggerFullscreen();
      if (ok || isAlreadyFullscreen()) {
        hasEnteredOnce = true;
        removeListeners();
      }
    };

    const events = ['click', 'touchend', 'keydown'] as const;

    const addListeners = () => {
      events.forEach((eventName) => {
        window.addEventListener(eventName, handleUserGesture, {
          capture: true,
          passive: true,
        });
      });
    };

    const removeListeners = () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserGesture, {
          capture: true,
        });
      });
    };

    addListeners();

    // 3. 監聽全螢幕變化事件：若成功進入全螢幕，即標記已進入並移除監聽器
    const onFullscreenChange = () => {
      if (isAlreadyFullscreen()) {
        hasEnteredOnce = true;
        removeListeners();
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);

    return () => {
      isDisposed = true;
      removeListeners();
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
    };
  }, []);
}
