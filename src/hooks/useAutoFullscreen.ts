import { useEffect, useRef } from 'react';
import { playClickSound } from '../lib/audio';
import { toast } from 'sonner';

/**
 * 自動全螢幕模式 (Auto Fullscreen Hook)
 * 1. 快速雙擊網頁背景：
 *    - 若處於視窗模式：切換進入全螢幕模式 (F11)，並自動將「持有中 | 真實交易 | 已完成 | 操作備註」等 Tab 列對齊全螢幕頂部邊緣。
 *    - 若已處於全螢幕模式 (F11)：畫面自動校正平滑置頂對齊 Tab 列。
 * 2. 關閉全螢幕模式：
 *    - 處於全螢幕模式時，滑鼠點擊網頁背景一次後按住不放（長按約 500ms），即自動退出全螢幕模式。
 */

export const isAlreadyFullscreen = (): boolean => {
  const doc = document as any;
  return !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
};

export const scrollToMainTabs = (behavior: ScrollBehavior = 'smooth') => {
  const tabElement = document.getElementById('main-view-tabs');
  if (tabElement) {
    const rect = tabElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    // 將 tab 的頂部位置精準對齊視窗頂部邊緣 (留 6px 極微間隔保持俐落)
    const targetY = Math.max(0, rect.top + scrollTop - 6);
    window.scrollTo({
      top: targetY,
      behavior,
    });
  }
};

export const enterFullscreen = async (): Promise<boolean> => {
  const elem = document.documentElement as any;
  if (isAlreadyFullscreen()) {
    scrollToMainTabs('smooth');
    return true;
  }
  try {
    if (elem.requestFullscreen) {
      await elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      await elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      await elem.mozRequestFullScreen();
    } else if (elem.msRequestFullscreen) {
      await elem.msRequestFullscreen();
    }
    setTimeout(() => scrollToMainTabs('smooth'), 80);
    setTimeout(() => scrollToMainTabs('smooth'), 220);
    setTimeout(() => scrollToMainTabs('smooth'), 450);
    return true;
  } catch (err) {
    console.warn('Enter fullscreen error:', err);
    return false;
  }
};

export const exitFullscreen = async (): Promise<boolean> => {
  const doc = document as any;
  if (!isAlreadyFullscreen()) return false;
  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    }
    return true;
  } catch (err) {
    console.warn('Exit fullscreen error:', err);
    return false;
  }
};

export const toggleFullscreen = async (): Promise<boolean> => {
  if (isAlreadyFullscreen()) {
    return exitFullscreen();
  } else {
    return enterFullscreen();
  }
};

export function useAutoFullscreen() {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let isDisposed = false;
    let hasEnteredOnce = false;

    // 1. 初次載入自動全螢幕嘗試
    enterFullscreen().then((success) => {
      if (success) {
        hasEnteredOnce = true;
        removeFirstGestureListeners();
      }
    });

    // 2. 監聽 User Gesture 初次自動進入全螢幕
    const handleUserGesture = async () => {
      if (hasEnteredOnce || isAlreadyFullscreen()) {
        removeFirstGestureListeners();
        return;
      }

      const ok = await enterFullscreen();
      if (ok || isAlreadyFullscreen()) {
        hasEnteredOnce = true;
        removeFirstGestureListeners();
      }
    };

    const firstGestureEvents = ['click', 'touchend', 'keydown'] as const;

    const addFirstGestureListeners = () => {
      firstGestureEvents.forEach((eventName) => {
        window.addEventListener(eventName, handleUserGesture, {
          capture: true,
          passive: true,
        });
      });
    };

    const removeFirstGestureListeners = () => {
      firstGestureEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserGesture, {
          capture: true,
        });
      });
    };

    addFirstGestureListeners();

    // 嚴格判斷是否為「純網頁背景」（排除任何卡片、列表、表格、圖表、彈窗、選單、工具列及文字反白）
    const isPureBackgroundElement = (target: HTMLElement | null): boolean => {
      if (!target) return false;

      // 1. 任何文字選取反白狀態 -> 否
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) return false;

      // 2. 任何互動標籤元素 -> 否
      if (
        target.closest(
          'button, input, textarea, select, a, label, svg, canvas, audio, video, iframe, [role="button"], [role="dialog"], [role="menu"], [role="listbox"], [role="option"], [role="tab"], [role="tabpanel"], [tabindex]'
        )
      ) {
        return false;
      }

      // 3. 卡片區塊、股票卡片、交易列表、表格、彈窗、Dock 工具列、面板等容器 -> 否
      if (
        target.closest(
          'article, table, tbody, thead, tr, td, th, form, [data-card], [data-prevent-fullscreen-dblclick], [data-no-fullscreen-exit], .glass-panel, [class*="card"], [class*="panel"], [class*="drawer"], [class*="modal"], [class*="dialog"], [class*="dropdown"], [class*="popover"], [class*="dock"], [class*="dock-"], [class*="stock-card"], [class*="trading-card"]'
        )
      ) {
        return false;
      }

      // 4. 白色/深色實體卡片區塊（帶有陰影或圓角邊框的內容容器） -> 否
      const cardContainer = target.closest(
        '[class*="shadow-md"], [class*="shadow-lg"], [class*="shadow-xl"], [class*="shadow-2xl"], [class*="shadow-2xs"], [class*="bg-white"], [class*="bg-zinc-50"], [class*="bg-zinc-100"], [class*="bg-zinc-900"]'
      );
      if (
        cardContainer &&
        cardContainer !== document.body &&
        cardContainer !== document.documentElement &&
        cardContainer.tagName !== 'MAIN' &&
        cardContainer.id !== 'root'
      ) {
        return false;
      }

      return true;
    };

    // 3. 雙擊網頁背景處理：
    //    - 若非全螢幕：進入全螢幕 (F11) 並自動置頂對齊 Tab 列
    //    - 若已在全螢幕：自動校正平滑置頂對齊 Tab 列 (不退出全螢幕)
    const handleBackgroundDblClick = (e: MouseEvent) => {
      if (!isPureBackgroundElement(e.target as HTMLElement | null)) return;

      try {
        playClickSound();
      } catch {
        // ignore audio failure
      }

      if (isAlreadyFullscreen()) {
        // 全螢幕下雙擊背景：校正置頂對齊 Tab 列
        scrollToMainTabs('smooth');
        toast.info('畫面已校正對齊 Tab 導覽列', { duration: 1500 });
      } else {
        // 進入全螢幕模式
        enterFullscreen();
      }
    };

    window.addEventListener('dblclick', handleBackgroundDblClick, { passive: true });

    // 4. 點擊背景長按不放關閉全螢幕模式 (Click and Hold on pure background to Exit Fullscreen)
    const cancelLongPress = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      startPosRef.current = null;
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      // 只有在全螢幕模式下才監聽「點擊背景按住不放退出全螢幕」
      if (!isAlreadyFullscreen()) return;

      // 僅限滑鼠主鍵（左鍵）或單指觸控
      if ('button' in e && e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      if (!isPureBackgroundElement(target)) return;

      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      startPosRef.current = { x: clientX, y: clientY };

      cancelLongPress();

      // 長按 600ms 觸發退出全螢幕
      longPressTimerRef.current = setTimeout(async () => {
        if (isAlreadyFullscreen()) {
          try {
            playClickSound();
          } catch {}
          await exitFullscreen();
          toast.info('已退出全螢幕模式', { duration: 2000 });
        }
        cancelLongPress();
      }, 600);
    };

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!longPressTimerRef.current || !startPosRef.current) return;
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      const dist = Math.hypot(clientX - startPosRef.current.x, clientY - startPosRef.current.y);

      // 若滑鼠移動超過 5px（非定點按住而是拖拉或滑動），立即取消長按退出計時
      if (dist > 5) {
        cancelLongPress();
      }
    };

    // 當使用者滾動滑鼠滾輪 (wheel) 或頁面滾動 (scroll) 時，立即強制取消長按計時，杜絕誤觸！
    window.addEventListener('wheel', cancelLongPress, { passive: true, capture: true });
    window.addEventListener('scroll', cancelLongPress, { passive: true, capture: true });
    document.addEventListener('scroll', cancelLongPress, { passive: true, capture: true });

    window.addEventListener('mousedown', handlePointerDown, { passive: true });
    window.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('mouseup', cancelLongPress, { passive: true });
    window.addEventListener('touchend', cancelLongPress, { passive: true });
    window.addEventListener('touchcancel', cancelLongPress, { passive: true });
    window.addEventListener('mouseleave', cancelLongPress, { passive: true });
    window.addEventListener('contextmenu', cancelLongPress, { passive: true });

    // 5. 監聽全螢幕變化事件：若進入全螢幕，即自動平滑捲動對齊「持有中 | 真實交易 | 已完成 | 操作備註」等 Tab
    const onFullscreenChange = () => {
      cancelLongPress();
      if (isAlreadyFullscreen()) {
        hasEnteredOnce = true;
        removeFirstGestureListeners();
        setTimeout(() => scrollToMainTabs('smooth'), 80);
        setTimeout(() => scrollToMainTabs('smooth'), 220);
        setTimeout(() => scrollToMainTabs('smooth'), 450);
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);

    return () => {
      isDisposed = true;
      cancelLongPress();
      removeFirstGestureListeners();
      window.removeEventListener('dblclick', handleBackgroundDblClick);
      window.removeEventListener('wheel', cancelLongPress, { capture: true } as any);
      window.removeEventListener('scroll', cancelLongPress, { capture: true } as any);
      document.removeEventListener('scroll', cancelLongPress, { capture: true } as any);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('mouseup', cancelLongPress);
      window.removeEventListener('touchend', cancelLongPress);
      window.removeEventListener('touchcancel', cancelLongPress);
      window.removeEventListener('mouseleave', cancelLongPress);
      window.removeEventListener('contextmenu', cancelLongPress);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
    };
  }, []);
}

