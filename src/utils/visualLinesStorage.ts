import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { PositionMap } from "../components/DynamicVisualLinesModal";

// Memory cache for zero-latency access across components
interface CacheEntry {
  positions: PositionMap;
  tagSizeOffset: number;
  lastFetched: number;
}

const memoryCache = new Map<string, CacheEntry>();

// Active background save promise queue to ensure sequential writes without races
let activeSavePromise: Promise<void> = Promise.resolve();

/**
 * Get storage key for a user
 */
export function getVisualLinesStorageKey(userId?: string): string {
  return `visual_lines_board_positions_${userId || "guest"}`;
}

/**
 * Synchronously read positions and tag size offset from memory cache or localStorage
 * Execution time: < 0.2ms
 */
export function getVisualLinesDataSync(userId?: string): {
  positions: PositionMap;
  tagSizeOffset: number;
} {
  const cacheKey = userId || "guest";
  const mem = memoryCache.get(cacheKey);
  if (mem) {
    return {
      positions: { ...mem.positions },
      tagSizeOffset: mem.tagSizeOffset,
    };
  }

  const storageKey = getVisualLinesStorageKey(userId);
  let positions: PositionMap = {};
  let tagSizeOffset = 0;

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        positions = parsed;
      }
    }
    const rawOffset = localStorage.getItem("visualLines_tagSizeOffset");
    if (rawOffset !== null && !isNaN(Number(rawOffset))) {
      tagSizeOffset = Number(rawOffset);
    }
  } catch (e) {
    console.warn("Error reading local visual lines cache:", e);
  }

  // Populate memory cache
  memoryCache.set(cacheKey, {
    positions: { ...positions },
    tagSizeOffset,
    lastFetched: 0,
  });

  return { positions, tagSizeOffset };
}

/**
 * Revalidate and sync positions from Firestore in the background
 * Non-blocking, updates memory cache, localStorage, and broadcasts if changed
 */
export async function revalidateVisualLinesDataAsync(
  userId?: string,
  onUpdated?: (data: { positions: PositionMap; tagSizeOffset: number }) => void
): Promise<{ positions: PositionMap; tagSizeOffset: number } | null> {
  if (!userId) return null;

  const cacheKey = userId;
  const now = Date.now();
  const mem = memoryCache.get(cacheKey);

  // If fetched within last 5 seconds, avoid redundant network calls
  if (mem && now - mem.lastFetched < 5000) {
    return { positions: mem.positions, tagSizeOffset: mem.tagSizeOffset };
  }

  try {
    const docRef = doc(db, "users", userId, "visualLinesBoard", "positions");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const docData = docSnap.data();
      const remotePos = docData?.positions as PositionMap;
      let remoteOffset = 0;

      if (docData?.tagSizeOffset !== undefined && !isNaN(Number(docData.tagSizeOffset))) {
        remoteOffset = Number(docData.tagSizeOffset);
      }

      if (remotePos && typeof remotePos === "object") {
        const sanitized: PositionMap = {};
        Object.entries(remotePos).forEach(([sym, pos]) => {
          sanitized[sym] = {
            ...pos,
            shape: "circle",
            hidden: Boolean(pos.hidden),
            dcaProgress: pos.dcaProgress || undefined,
          };
        });

        // Update memory cache
        memoryCache.set(cacheKey, {
          positions: sanitized,
          tagSizeOffset: remoteOffset,
          lastFetched: now,
        });

        // Update localStorage
        const storageKey = getVisualLinesStorageKey(userId);
        try {
          localStorage.setItem(storageKey, JSON.stringify(sanitized));
          localStorage.setItem("visualLines_tagSizeOffset", String(remoteOffset));
        } catch (e) {}

        if (onUpdated) {
          onUpdated({ positions: sanitized, tagSizeOffset: remoteOffset });
        }

        return { positions: sanitized, tagSizeOffset: remoteOffset };
      }
    }
  } catch (err) {
    console.warn("Background revalidate visual lines failed:", err);
  }

  return null;
}

/**
 * Optimistic fast-path save:
 * 1. Synchronously updates memory cache & localStorage (~0.1ms)
 * 2. Broadcasts visual_lines_positions_updated event instantly
 * 3. Schedules non-blocking background write to Firestore
 */
export function saveVisualLinesDataOptimistic(
  userId: string | undefined,
  targetPositions: PositionMap,
  targetTagSizeOffset: number = 0
): PositionMap {
  const cacheKey = userId || "guest";
  const storageKey = getVisualLinesStorageKey(userId);

  // Sanitize positions for integrity and Firestore compatibility
  const sanitizedPositions: PositionMap = {};
  Object.entries(targetPositions).forEach(([sym, pos]) => {
    const cleanSym = sym.trim().toUpperCase();
    const entry: {
      x: number;
      y: number;
      shape: "circle";
      sizeOffset: number;
      color?: string;
      hidden?: boolean;
      dcaProgress?: string;
      updatedAt: string;
    } = {
      x: typeof pos.x === "number" ? pos.x : 50,
      y: typeof pos.y === "number" ? pos.y : 50,
      shape: "circle",
      sizeOffset: typeof pos.sizeOffset === "number" ? pos.sizeOffset : 0,
      updatedAt: pos.updatedAt || new Date().toISOString(),
    };
    if (
      pos.color &&
      typeof pos.color === "string" &&
      pos.color.trim() !== "" &&
      pos.color !== "#000000" &&
      pos.color !== "#09090b"
    ) {
      entry.color = pos.color;
    }
    if (pos.hidden) {
      entry.hidden = true;
    }
    if (pos.dcaProgress && typeof pos.dcaProgress === "string") {
      entry.dcaProgress = pos.dcaProgress;
    }
    sanitizedPositions[cleanSym] = entry;
  });

  // 1. Update in-memory cache instantly
  memoryCache.set(cacheKey, {
    positions: sanitizedPositions,
    tagSizeOffset: targetTagSizeOffset,
    lastFetched: Date.now(),
  });

  // 2. Synchronous local storage write
  try {
    localStorage.setItem(storageKey, JSON.stringify(sanitizedPositions));
    localStorage.setItem("visualLines_tagSizeOffset", String(targetTagSizeOffset));
    localStorage.setItem("visualLines_tagShape", "circle");
  } catch (e) {
    console.warn("LocalStorage write error:", e);
  }

  // 3. Instant event broadcast
  window.dispatchEvent(
    new CustomEvent("visual_lines_positions_updated", {
      detail: {
        allPositions: sanitizedPositions,
        tagSizeOffset: targetTagSizeOffset,
      },
    })
  );

  // 4. Background firestore write (non-blocking, queued to prevent race conditions)
  if (userId) {
    activeSavePromise = activeSavePromise
      .then(async () => {
        const docRef = doc(db, "users", userId, "visualLinesBoard", "positions");
        await setDoc(docRef, {
          positions: sanitizedPositions,
          tagSizeOffset: targetTagSizeOffset,
          defaultShape: "circle",
          updatedAt: new Date().toISOString(),
        });
      })
      .catch((err) => {
        console.warn("Background Firestore write error for visual lines:", err);
        handleFirestoreError(err, OperationType.WRITE, `users/${userId}/visualLinesBoard/positions`);
      });
  }

  return sanitizedPositions;
}
