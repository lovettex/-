import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  X,
  Save,
  SlidersHorizontal,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Check,
  Search,
  Eye,
  EyeOff,
  BoxSelect,
  Star,
  Layers,
  Activity,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Tag,
  Info,
  Plus,
  Trash2,
  ListPlus,
  FolderOpen,
  Minus,
  Circle,
  Square,
  CheckSquare,
  Download,
  Upload,
  MoveHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { playClickSound, playSuccessSound } from "../lib/audio";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { StockTab } from "../types";
import { syncSubTabDividersToCanvas, formatTagDate, analyzeCardDividers } from "../utils/visualLinesSync";

export interface PositionMap {
  [symbol: string]: {
    x: number; // percentage 0 - 100
    y: number; // percentage 0 - 100
    sizeOffset?: number; // per-tag size offset (+/- 2px steps)
    shape?: "circle"; // tag shape (always 'circle')
    color?: string; // custom circle background color hex
    hidden?: boolean; // whether tag is hidden on visual board
    updatedAt?: string;
  };
}

// 預設標籤 Solid Color 明亮純色邊框色系選單 (包含 #DCFA57，改以明亮色系為主，預設黑為 1px)
export const TAG_COLOR_OPTIONS = [
  { id: "solid-default-black", label: "預設黑色 (1px)", bg: "#000000", border: "#27272A", isDefault: true },
  { id: "solid-lime-glow", label: "螢光黃綠 (#DCFA57)", bg: "#DCFA57", border: "#C8EA3E" },
  { id: "solid-sky-blue", label: "亮天藍", bg: "#38BDF8", border: "#0284C7" },
  { id: "solid-cyan", label: "亮天青", bg: "#22D3EE", border: "#06B6D4" },
  { id: "solid-emerald", label: "亮翡翠綠", bg: "#34D399", border: "#059669" },
  { id: "solid-green", label: "亮草綠", bg: "#4ADE80", border: "#16A34A" },
  { id: "solid-yellow", label: "亮檸檬黃", bg: "#FACC15", border: "#CA8A04" },
  { id: "solid-orange", label: "亮活力橙", bg: "#FB923C", border: "#EA580C" },
  { id: "solid-red", label: "鮮亮紅", bg: "#F87171", border: "#DC2626" },
  { id: "solid-pink", label: "亮霓虹粉", bg: "#F472B6", border: "#DB2777" },
  { id: "solid-purple", label: "亮薰衣紫", bg: "#C084FC", border: "#9333EA" },
  { id: "solid-indigo", label: "亮靛青紫", bg: "#818CF8", border: "#4F46E5" },
];

/**
 * 判斷顏色是否為淺色系，自適應深色/淺色排版字體
 */
export function isColorLight(hexOrRgb?: string): boolean {
  if (!hexOrRgb) return true;
  const lower = hexOrRgb.toLowerCase();
  if (
    lower === "#f7f5f5" ||
    lower === "#ffffff" ||
    lower === "#d2f800" ||
    lower === "#b5aaa0" ||
    lower === "#c4b3a3" ||
    lower === "#9c9283"
  ) {
    return true;
  }
  let c = hexOrRgb.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  if (c.length === 6) {
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 165;
  }
  return true;
}

/**
 * 將顏色轉換為具有指定透明度的 rgba 字串
 */
export function hexToRgba(hexOrRgb?: string, alpha: number = 0.76): string {
  if (!hexOrRgb) return `rgba(247, 245, 245, ${alpha})`;
  if (hexOrRgb.startsWith("rgba")) return hexOrRgb;
  if (hexOrRgb.startsWith("rgb")) {
    return hexOrRgb.replace("rgb", "rgba").replace(")", `, ${alpha})`);
  }
  let c = hexOrRgb.replace("#", "");
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }
  if (c.length === 6) {
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(247, 245, 245, ${alpha})`;
}

interface DynamicVisualLinesModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTabs: StockTab[];
  selectedCardIds?: Set<string>;
  userId?: string;
  initialTradeType?: "active" | "real" | "all" | "completed";
  onSelectStock?: (tabId: string, symbol: string) => void;
  strategiesMap?: Record<string, any>;
  statsMap?: Record<string, { averagePrice?: number; totalQuantity?: number }>;
}

// 6 Horizontal Visual Lines
export const VISUAL_LINES = [
  { id: "line-top-yellow", yPercent: 12, color: "#EAB308", label: "頂部獲利", desc: "Take Profit / 極限超買" },
  { id: "line-red", yPercent: 28, color: "#EF4444", label: "停損警戒", desc: "Stop Loss / 阻力警戒" },
  { id: "line-black", yPercent: 44, color: "#000000", label: "基準中軸", desc: "Base / 成本平衡線" },
  { id: "line-blue", yPercent: 60, color: "#2563EB", label: "回檔加碼", desc: "Support / 回檔支撐" },
  { id: "line-green", yPercent: 76, color: "#16A34A", label: "底部買進", desc: "Floor / 強力買進" },
  { id: "line-bottom-yellow", yPercent: 90, color: "#EAB308", label: "深幅價值", desc: "Deep Value / 極限超賣" },
];

// 5 Background Color Bands Between the 6 Lines
export const VISUAL_BANDS = [
  {
    id: "band-pink",
    top: 12,
    bottom: 28,
    bg: "rgba(255, 228, 230, 0.45)", // 淡粉紅色 (紅色與金色之間)
    label: "淡粉紅色區域",
  },
  {
    id: "band-gray",
    top: 28,
    bottom: 44,
    bg: "rgba(244, 244, 245, 0.6)", // 淡灰色 (紅色與黑色/藍色之間)
    label: "淡灰色區域",
  },
  {
    id: "band-blue",
    top: 44,
    bottom: 60,
    bg: "rgba(239, 246, 255, 0.65)", // 淡淡的藍色 (黑色與藍色之間)
    label: "淡藍色區域",
  },
  {
    id: "band-emerald",
    top: 60,
    bottom: 76,
    bg: "rgba(236, 253, 245, 0.65)", // 淡淡的青綠色 (藍色與綠色之間)
    label: "淡青綠色區域",
  },
  {
    id: "band-gold",
    top: 76,
    bottom: 90,
    bg: "rgba(254, 252, 232, 0.7)", // 淡淡的金色 (青綠色與黃色之間)
    label: "淡金色區域",
  },
];

export const HOLDING_CONFIG: Record<
  string,
  {
    labelActive: string;
    labelReal: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    dot: string;
    badge: string;
  }
> = {
  "觀察中": {
    labelActive: "虛擬交易",
    labelReal: "觀察中",
    icon: Eye,
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
    dot: "bg-sky-500",
    badge: "bg-sky-100 text-sky-800",
  },
  "候選名單": {
    labelActive: "候選名單",
    labelReal: "候選名單",
    icon: Star,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800",
  },
  "買進操作": {
    labelActive: "買進操作",
    labelReal: "買進操作",
    icon: TrendingUp,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-800",
  },
  "賣出操作": {
    labelActive: "賣出操作",
    labelReal: "賣出操作",
    icon: TrendingDown,
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    dot: "bg-rose-500",
    badge: "bg-rose-100 text-rose-800",
  },
  "平倉操作": {
    labelActive: "平倉操作",
    labelReal: "平倉操作",
    icon: CheckCircle2,
    color: "text-fuchsia-600",
    bg: "bg-fuchsia-50",
    border: "border-fuchsia-200",
    dot: "bg-fuchsia-500",
    badge: "bg-fuchsia-100 text-fuchsia-800",
  },
  "乖離名單": {
    labelActive: "乖離名單",
    labelReal: "乖離名單",
    icon: Activity,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
    badge: "bg-indigo-100 text-indigo-800",
  },
};

export const SUB_TABS_LIST = [
  "觀察中",
  "候選名單",
  "買進操作",
  "賣出操作",
  "平倉操作",
  "乖離名單",
] as const;

export const DynamicVisualLinesModal: React.FC<DynamicVisualLinesModalProps> = ({
  isOpen,
  onClose,
  allTabs,
  selectedCardIds,
  userId,
  initialTradeType = "active",
  onSelectStock,
  strategiesMap,
  statsMap,
}) => {
  // 1. 交易總覽主分頁選單 ("active" | "real" | "completed" | "all")
  const [mainTabFilter, setMainTabFilter] = useState<"active" | "real" | "completed" | "all">(
    initialTradeType === "real"
      ? "real"
      : initialTradeType === "completed"
      ? "completed"
      : initialTradeType === "all"
      ? "all"
      : "active"
  );

  // 2. 子分頁分類選單 ("all" 或特定子分頁)
  const [selectedSubTab, setSelectedSubTab] = useState<string>("all");

  // 3. 搜尋股票代號
  const [stockSearchQuery, setStockSearchQuery] = useState("");

  // 下拉選單開關
  const [isMainTabDropdownOpen, setIsMainTabDropdownOpen] = useState(false);
  const [isSubTabDropdownOpen, setIsSubTabDropdownOpen] = useState(false);
  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState(false);

  // 輔助視覺狀態 - 預設不顯示線條標籤
  const [showLineLabels, setShowLineLabels] = useState(false);
  const [showPriceBadge, setShowPriceBadge] = useState(false);

  // 框選模式開關 (可點擊切換，或在畫布空白處直接拖曳框選)
  const [isBoxSelectMode, setIsBoxSelectMode] = useState(false);
  // 框選矩形區域 (像素座標)
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // 顯示隱藏標籤開關 (預設 false: 隱藏標籤不渲染；true: 隱藏標籤以半透明顯示)
  const [showHiddenTags, setShowHiddenTags] = useState(false);

  // 勾選的個別股票標籤（用於個別尺寸調整、顏色套用或隱藏操作）
  const [selectedTagSymbols, setSelectedTagSymbols] = useState<string[]>([]);

  // 全域標籤尺寸調整偏移量 (每次 +/- 2px，儲存至 localStorage)
  const [tagSizeOffset, setTagSizeOffset] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("visualLines_tagSizeOffset");
      return saved !== null && !isNaN(Number(saved)) ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });

  // 標籤位置狀態
  const [positions, setPositions] = useState<PositionMap>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const mainTabDropdownRef = useRef<HTMLDivElement>(null);
  const subTabDropdownRef = useRef<HTMLDivElement>(null);
  const stockDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 拖曳狀態
  const draggingSymbolRef = useRef<string | null>(null);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });

  // 載入已儲存的標籤位置、形狀與大小 (Firestore / localStorage)
  const loadPositions = useCallback(async () => {
    const storageKey = `visual_lines_board_positions_${userId || "guest"}`;
    let loadedPos: PositionMap = {};
    let loadedFromFirestore = false;

    // 1. 優先從 Firestore 雲端讀取權威資料
    if (userId) {
      try {
        const docRef = doc(db, "users", userId, "visualLinesBoard", "positions");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const docData = docSnap.data();
          const remotePos = docData?.positions as PositionMap;
          if (remotePos && typeof remotePos === "object") {
            loadedPos = remotePos;
            loadedFromFirestore = true;
            try {
              localStorage.setItem(storageKey, JSON.stringify(remotePos));
            } catch (e) {}
          }
          if (docData?.tagSizeOffset !== undefined && !isNaN(Number(docData.tagSizeOffset))) {
            setTagSizeOffset(Number(docData.tagSizeOffset));
            try {
              localStorage.setItem("visualLines_tagSizeOffset", String(docData.tagSizeOffset));
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn("Failed to load Firestore positions:", err);
      }
    }

    // 2. 若未從 Firestore 取得，則由 LocalStorage 回退讀取
    if (!loadedFromFirestore) {
      try {
        const localData = localStorage.getItem(storageKey);
        if (localData) {
          loadedPos = JSON.parse(localData);
        }
      } catch (e) {
        console.warn("Failed to load local positions:", e);
      }
    }

    // 確保所有載入的標籤都帶有 shape: "circle" 與正確的 hidden 狀態
    const sanitizedLoadedPos: PositionMap = {};
    Object.entries(loadedPos).forEach(([sym, pos]) => {
      sanitizedLoadedPos[sym] = {
        ...pos,
        shape: "circle",
        hidden: Boolean(pos.hidden),
      };
    });

    setPositions(sanitizedLoadedPos);
    setHasUnsavedChanges(false);
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      loadPositions();
    }
  }, [isOpen, loadPositions]);

  // 即時監聽個別標籤位置儲存事件，達成雙向同步
  useEffect(() => {
    const handlePositionsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ symbol: string; position: { x: number; y: number }; allPositions?: PositionMap }>;
      if (customEvent.detail?.allPositions) {
        setPositions(customEvent.detail.allPositions);
      } else if (customEvent.detail?.symbol && customEvent.detail?.position) {
        setPositions((prev) => ({
          ...prev,
          [customEvent.detail.symbol]: {
            ...customEvent.detail.position,
            updatedAt: new Date().toISOString(),
          },
        }));
      }
    };

    window.addEventListener("visual_lines_positions_updated", handlePositionsUpdated);
    return () => window.removeEventListener("visual_lines_positions_updated", handlePositionsUpdated);
  }, []);

  // 切換主分頁時自動重設子分頁為全部
  const handleSelectMainTab = (newMainTab: "active" | "real" | "completed" | "all") => {
    playClickSound();
    setMainTabFilter(newMainTab);
    setSelectedSubTab("all");
    setIsMainTabDropdownOpen(false);
  };

  // 點擊外部關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!target || (target instanceof Element && !document.body.contains(target))) {
        return;
      }
      if (mainTabDropdownRef.current && !mainTabDropdownRef.current.contains(target)) {
        setIsMainTabDropdownOpen(false);
      }
      if (subTabDropdownRef.current && !subTabDropdownRef.current.contains(target)) {
        setIsSubTabDropdownOpen(false);
      }
      if (stockDropdownRef.current && !stockDropdownRef.current.contains(target)) {
        setIsStockDropdownOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener("mousedown", handleClickOutside);
      return () => window.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // 全部不重複股票 Map (優先對應非已結算的 持有中/真實交易 tab 資訊)
  const allStockMap = useMemo(() => {
    const map = new Map<string, StockTab>();
    // 優先放入未結算的 (持有中/真實交易) 分頁
    allTabs
      .filter((t) => t.status !== "COMPLETED")
      .forEach((t) => {
        const sym = t.symbol.trim().toUpperCase();
        if (!map.has(sym)) {
          map.set(sym, t);
        }
      });
    // 補足其餘分頁
    allTabs.forEach((t) => {
      const sym = t.symbol.trim().toUpperCase();
      if (!map.has(sym)) {
        map.set(sym, t);
      }
    });
    return map;
  }, [allTabs]);

  // 主分頁分類下的美股數據集 (嚴格對應交易總覽之層級)
  const mainTabFilteredPool = useMemo(() => {
    return allTabs.filter((tab) => {
      if (mainTabFilter === "active") {
        // 持有中 (虛擬/模擬交易)
        return tab.status !== "COMPLETED" && tab.tradeType !== "real";
      }
      if (mainTabFilter === "real") {
        // 真實交易
        return tab.status !== "COMPLETED" && tab.tradeType === "real";
      }
      if (mainTabFilter === "completed") {
        // 已完成
        return tab.status === "COMPLETED";
      }
      // 全部交易 (不限)
      return true;
    });
  }, [allTabs, mainTabFilter]);

  // 當前篩選下的股票清單 (主分頁 + 子分頁)
  const filteredTabs = useMemo(() => {
    return mainTabFilteredPool.filter((tab) => {
      if (selectedSubTab === "all") return true;

      if (mainTabFilter === "completed") {
        if (selectedSubTab === "real") return tab.tradeType === "real";
        if (selectedSubTab === "simulated") return tab.tradeType !== "real";
        return true;
      }

      const status = tab.holdingStatus || "候選名單";
      return status === selectedSubTab;
    });
  }, [mainTabFilteredPool, selectedSubTab, mainTabFilter]);

  // 取得此篩選條件下的不重複股票清單 (依代號排序)
  const availableBlockStocks = useMemo(() => {
    const symMap = new Map<string, StockTab>();
    filteredTabs.forEach((tab) => {
      const sym = tab.symbol.trim().toUpperCase();
      if (!symMap.has(sym)) {
        symMap.set(sym, tab);
      }
    });
    return Array.from(symMap.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [filteredTabs]);

  // 所有在圖表上的股票代號
  const allCanvasSymbols = useMemo(() => {
    return Object.keys(positions);
  }, [positions]);

  // 已標記隱藏的股票標籤數量
  const hiddenCount = useMemo(() => {
    return Object.values(positions).filter((p) => Boolean(p?.hidden)).length;
  }, [positions]);

  // 目前在圖表畫布上呈現的標籤清單 (若 showHiddenTags 為 false，則過濾掉已隱藏的標籤)
  const activeCanvasSymbols = useMemo(() => {
    if (showHiddenTags) {
      return Object.keys(positions);
    }
    return Object.keys(positions).filter((sym) => !positions[sym]?.hidden);
  }, [positions, showHiddenTags]);

  // 判斷勾選的股票標籤是否全部為隱藏狀態
  const isAllSelectedHidden = useMemo(() => {
    if (selectedTagSymbols.length === 0) return false;
    return selectedTagSymbols.every((sym) => Boolean(positions[sym]?.hidden));
  }, [selectedTagSymbols, positions]);

  // 取得子分頁的顯示名稱 (依據主分頁切換 "虛擬交易" / "觀察中")
  const getSubTabLabel = useCallback(
    (subTabKey: string) => {
      if (subTabKey === "all") return "全部子分頁";
      const conf = HOLDING_CONFIG[subTabKey];
      if (!conf) return subTabKey;
      return mainTabFilter === "active" ? conf.labelActive : conf.labelReal;
    },
    [mainTabFilter]
  );

  // 主分頁顯示文字
  const mainTabDisplayInfo = useMemo(() => {
    switch (mainTabFilter) {
      case "active":
        return {
          title: "持有中",
          subtitle: "(模擬交易)",
          icon: Activity,
          badgeColor: "bg-emerald-600 text-white",
          count: allTabs.filter((t) => t.status !== "COMPLETED" && t.tradeType !== "real").length,
        };
      case "real":
        return {
          title: "真實交易",
          subtitle: "",
          icon: ShieldCheck,
          badgeColor: "bg-teal-600 text-white",
          count: allTabs.filter((t) => t.status !== "COMPLETED" && t.tradeType === "real").length,
        };
      case "completed":
        return {
          title: "已完成",
          subtitle: "(歷史交易)",
          icon: CheckCircle2,
          badgeColor: "bg-purple-600 text-white",
          count: allTabs.filter((t) => t.status === "COMPLETED").length,
        };
      case "all":
      default:
        return {
          title: "全部交易",
          subtitle: "",
          icon: Layers,
          badgeColor: "bg-zinc-800 text-white",
          count: allTabs.length,
        };
    }
  }, [mainTabFilter, allTabs]);

  // 新增股票標籤至畫布
  const handleAddStockToCanvas = (symbol: string, initialTabInfo?: StockTab) => {
    const sym = symbol.trim().toUpperCase();
    if (positions[sym]) return;

    playClickSound();
    const tab = initialTabInfo || allStockMap.get(sym);
    const currentTotal = Object.keys(positions).length;

    let targetYPercent = 44; // 基準中軸
    const status = tab?.holdingStatus || "候選名單";
    if (status === "賣出操作" || status === "平倉操作") {
      targetYPercent = 16;
    } else if (status === "買進操作") {
      targetYPercent = 74;
    } else if (status === "觀察中") {
      targetYPercent = 58;
    } else if (status === "乖離名單") {
      targetYPercent = 88;
    } else {
      targetYPercent = 38 + (currentTotal % 4) * 12;
    }

    const targetXPercent = Math.min(85, Math.max(15, 20 + (currentTotal % 6) * 12 + (Math.floor(currentTotal / 6) * 4)));

    setPositions((prev) => ({
      ...prev,
      [sym]: {
        x: parseFloat(targetXPercent.toFixed(2)),
        y: parseFloat(targetYPercent.toFixed(2)),
        shape: "circle",
        sizeOffset: 0,
        updatedAt: new Date().toISOString(),
      },
    }));
    setHasUnsavedChanges(true);
    toast.success(`已將 ${sym} 新增至視覺線圖表！`, { id: `add-${sym}`, duration: 1500 });
  };

  // 一鍵新增目前篩選區塊內的所有股票至畫布
  const handleAddAllBlockStocks = () => {
    if (availableBlockStocks.length === 0) return;
    playClickSound();

    let addedCount = 0;
    const newPos = { ...positions };

    availableBlockStocks.forEach((tab, index) => {
      const sym = tab.symbol.trim().toUpperCase();
      if (!newPos[sym]) {
        addedCount++;
        const totalNow = Object.keys(newPos).length;
        let targetYPercent = 44;
        const status = tab.holdingStatus || "候選名單";
        if (status === "賣出操作" || status === "平倉操作") {
          targetYPercent = 16;
        } else if (status === "買進操作") {
          targetYPercent = 74;
        } else if (status === "觀察中") {
          targetYPercent = 58;
        } else if (status === "乖離名單") {
          targetYPercent = 88;
        } else {
          targetYPercent = 38 + (totalNow % 4) * 12;
        }

        const targetXPercent = Math.min(88, Math.max(12, 15 + ((totalNow + index) % 7) * 11));
        newPos[sym] = {
          x: parseFloat(targetXPercent.toFixed(2)),
          y: parseFloat(targetYPercent.toFixed(2)),
          shape: "circle",
          sizeOffset: 0,
          updatedAt: new Date().toISOString(),
        };
      }
    });

    setPositions(newPos);
    setHasUnsavedChanges(true);
    toast.success(`已將 ${addedCount} 檔區塊股票新增至圖表！`, { id: "add-all-block" });
  };

  // 一鍵從卡片同步分隔線現價相對位置 (僅同步有勾選 Tickbox 之個股卡片)
  const handleSyncDividersFromCards = async () => {
    playClickSound();

    // 檢查是否有勾選任何卡片
    if (!selectedCardIds || selectedCardIds.size === 0) {
      toast.info("請先在卡片列表中勾選要同步的個股卡片（勾選圓形 Tickbox），再點擊一鍵同步");
      return;
    }

    // 取得所有屬於「持有中 (模擬交易)」與「真實交易」下所有子分頁且「有勾選」的個股卡片 (排除已結算 COMPLETED 分頁與未勾選卡片)
    const activeAndRealPool = allTabs.filter(
      (tab) => tab.status !== "COMPLETED" && selectedCardIds.has(tab.id)
    );

    if (activeAndRealPool.length === 0) {
      toast.error("所勾選的卡片中沒有屬於「持有中」或「真實交易」的有效個股卡片");
      return;
    }

    // 依股票代號分組，若同一檔股票在不同子分頁存在多張卡片，智慧選擇具備完整分隔線與現價的最佳卡片
    const symbolGroups = new Map<string, StockTab[]>();
    activeAndRealPool.forEach((tab) => {
      const sym = (tab.symbol || "").trim().toUpperCase();
      if (!sym) return;
      if (!symbolGroups.has(sym)) {
        symbolGroups.set(sym, []);
      }
      symbolGroups.get(sym)!.push(tab);
    });

    const targetTabs: StockTab[] = [];
    symbolGroups.forEach((tabsForSym) => {
      if (tabsForSym.length === 1) {
        targetTabs.push(tabsForSym[0]);
        return;
      }

      // 檢查各卡片的分隔線合格度
      const scored = tabsForSym.map((t) => {
        const analysis = analyzeCardDividers(t);
        const dividerCount = analysis.allDividers.length;
        const hasPrice = (t.currentPrice && t.currentPrice > 0) ? 1 : 0;
        const isEligible = analysis.isEligible ? 100 : 0;
        const updateTime = t.updatedAt?.toMillis?.() || 0;
        return {
          tab: t,
          score: isEligible + dividerCount * 10 + hasPrice * 5,
          updateTime,
        };
      });

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.updateTime - a.updateTime;
      });

      // 選取最高分之卡片，並若其現價缺失但同代號其他卡片有現價，進行現價補全
      const bestTab = { ...scored[0].tab };
      if (!bestTab.currentPrice || bestTab.currentPrice <= 0) {
        const altWithPrice = tabsForSym.find((t) => t.currentPrice && t.currentPrice > 0);
        if (altWithPrice) {
          bestTab.currentPrice = altWithPrice.currentPrice;
        }
      }
      targetTabs.push(bestTab);
    });

    if (targetTabs.length === 0) {
      toast.error("所勾選的股票卡片中沒有可同步的資料");
      return;
    }

    const res = await syncSubTabDividersToCanvas(targetTabs, userId, strategiesMap, statsMap);
    if (res.updatedCount > 0) {
      playSuccessSound();
      setPositions(res.allPositions);
      setHasUnsavedChanges(false);
      toast.success(
        `成功同步所勾選的 ${res.updatedCount} 檔股票分隔線現價位置 (${res.updatedSymbols.join(", ")})`,
        { duration: 4000 }
      );
    } else {
      toast.info(
        "所勾選的卡片中，尚未找到包含分隔線的卡片（請在視覺圖示化卡片上繪製分隔線後再同步）"
      );
    }
  };

  // 從圖表畫布中刪除股票標籤
  const handleRemoveStockFromCanvas = (symbol: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    playClickSound();

    const sym = symbol.trim().toUpperCase();
    setSelectedTagSymbols((prev) => prev.filter((s) => s !== sym));
    setPositions((prev) => {
      const next = { ...prev };
      delete next[sym];
      return next;
    });
    setHasUnsavedChanges(true);
    toast.info(`已從圖表中移除標籤 ${sym}`);
  };

  // 清空畫布上所有標籤
  const handleClearAllCanvas = () => {
    if (Object.keys(positions).length === 0) return;
    playClickSound();
    handleResetAllCanvas();
  };

  // 一鍵「重置」：刪除畫布上所有個股標籤並即時更新與儲存
  const handleResetAllCanvas = async () => {
    playClickSound();
    const currentCount = Object.keys(positions).length;
    if (currentCount === 0) {
      toast.info("目前畫布上沒有個股標籤可重置");
      return;
    }

    const storageKey = `visual_lines_board_positions_${userId || "guest"}`;

    // 1. 本地狀態重置
    setSelectedTagSymbols([]);
    setPositions({});
    setHasUnsavedChanges(false);

    // 2. 清空 LocalStorage
    try {
      localStorage.setItem(storageKey, JSON.stringify({}));
    } catch (e) {
      console.warn("Reset LocalStorage failed:", e);
    }

    // 3. 清空 Firestore 雲端文檔
    if (userId) {
      try {
        const docRef = doc(db, "users", userId, "visualLinesBoard", "positions");
        await setDoc(docRef, {
          positions: {},
          tagSizeOffset,
          defaultShape: "circle",
          updatedAt: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn("Reset Firestore failed:", dbErr);
      }
    }

    // 4. 發送全域自訂廣播事件
    window.dispatchEvent(
      new CustomEvent("visual_lines_positions_updated", {
        detail: {
          allPositions: {},
          tagSizeOffset,
        },
      })
    );

    playSuccessSound();
    toast.success(`已成功重置！已刪除畫布上所有個股標籤 (共清除 ${currentCount} 檔)`, {
      id: "canvas-reset-all",
    });
  };

  // 勾選 / 取消勾選單一標籤
  const handleToggleTagSelection = (symbol: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    playClickSound();
    const sym = symbol.trim().toUpperCase();
    setSelectedTagSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  // 全選 / 取消全選畫布上的標籤
  const handleSelectAllTags = () => {
    playClickSound();
    if (selectedTagSymbols.length === activeCanvasSymbols.length && activeCanvasSymbols.length > 0) {
      setSelectedTagSymbols([]);
      toast.info("已取消所有股票標籤選取");
    } else {
      setSelectedTagSymbols([...activeCanvasSymbols]);
      toast.info(`已選取畫布上全部 ${activeCanvasSymbols.length} 檔股票標籤`);
    }
  };

  // 調整標籤尺寸 (+ / - 2px)
  const handleAdjustTagSize = (delta: number) => {
    playClickSound();
    if (selectedTagSymbols.length > 0) {
      // 僅針對勾選的標籤調整尺寸
      setPositions((prev) => {
        const next = { ...prev };
        selectedTagSymbols.forEach((sym) => {
          if (next[sym]) {
            const currentOffset = next[sym].sizeOffset !== undefined ? next[sym].sizeOffset! : tagSizeOffset;
            const nextOffset = Math.max(-10, Math.min(24, currentOffset + delta));
            next[sym] = {
              ...next[sym],
              sizeOffset: nextOffset,
            };
          }
        });
        return next;
      });
      setHasUnsavedChanges(true);
      toast.info(`已將勾選的 ${selectedTagSymbols.length} 檔標籤尺寸${delta > 0 ? "放大" : "縮小"} 2px`, { id: "tag-size" });
    } else {
      // 未勾選時調整預設尺寸
      setTagSizeOffset((prev) => {
        const next = Math.max(-6, Math.min(16, prev + delta));
        try {
          localStorage.setItem("visualLines_tagSizeOffset", String(next));
        } catch {}
        return next;
      });
      toast.info(`已將預設標籤尺寸${delta > 0 ? "放大" : "縮小"} 2px`, { id: "tag-size" });
    }
  };

  // 重設標籤尺寸
  const handleResetTagSize = () => {
    playClickSound();
    if (selectedTagSymbols.length > 0) {
      setPositions((prev) => {
        const next = { ...prev };
        selectedTagSymbols.forEach((sym) => {
          if (next[sym]) {
            const copy = { ...next[sym] };
            delete copy.sizeOffset;
            next[sym] = copy;
          }
        });
        return next;
      });
      setHasUnsavedChanges(true);
      toast.info(`已重設勾選的 ${selectedTagSymbols.length} 檔標籤尺寸為預設`, { id: "tag-size-reset" });
    } else {
      setTagSizeOffset(0);
      try {
        localStorage.setItem("visualLines_tagSizeOffset", "0");
      } catch {}
      toast.info("已重設標籤預設尺寸", { id: "tag-size-reset" });
    }
  };

  // 為勾選的標籤設定邊框顏色 (若選中預設黑或未指定則恢復 1px 黑色邊框，其餘套用 6px 亮色邊框)
  const handleSetTagColor = (colorHex?: string) => {
    playClickSound();
    if (selectedTagSymbols.length > 0) {
      const isResetToDefault = !colorHex || colorHex === "#000000";
      setPositions((prev) => {
        const next = { ...prev };
        selectedTagSymbols.forEach((sym) => {
          if (next[sym]) {
            next[sym] = {
              ...next[sym],
              color: isResetToDefault ? undefined : colorHex,
              updatedAt: new Date().toISOString(),
            };
          }
        });
        return next;
      });
      setHasUnsavedChanges(true);
      if (isResetToDefault) {
        toast.info(`已將勾選的 ${selectedTagSymbols.length} 檔標籤重設為預設黑色邊框 (1px)`, {
          id: "tag-color",
        });
      } else {
        const colorObj = TAG_COLOR_OPTIONS.find((c) => c.bg === colorHex);
        toast.info(`已將勾選的 ${selectedTagSymbols.length} 檔標籤邊框顏色設為「${colorObj?.label || colorHex}」 (6px)`, {
          id: "tag-color",
        });
      }
    }
  };

  // 隱藏 / 解除隱藏勾選的股票標籤
  const handleToggleHideSelected = () => {
    if (selectedTagSymbols.length === 0) {
      toast.info("請先勾選欲隱藏或顯示的股票標籤");
      return;
    }
    playClickSound();

    const willHide = !isAllSelectedHidden; // 若不全為隱藏狀態則設為隱藏，若全為隱藏狀態則解除隱藏
    setPositions((prev) => {
      const next = { ...prev };
      selectedTagSymbols.forEach((sym) => {
        if (next[sym]) {
          next[sym] = {
            ...next[sym],
            hidden: willHide,
            updatedAt: new Date().toISOString(),
          };
        }
      });
      return next;
    });
    setHasUnsavedChanges(true);

    if (willHide) {
      toast.info(`已隱藏勾選的 ${selectedTagSymbols.length} 檔股票標籤（可點擊「顯示隱藏」檢視或解除）`, {
        id: "tag-hide",
      });
      // 隱藏後取消勾選，保持畫布乾淨
      setSelectedTagSymbols([]);
    } else {
      toast.success(`已解除隱藏勾選的 ${selectedTagSymbols.length} 檔股票標籤！`, {
        id: "tag-hide",
      });
    }
  };

  // 一鍵解除所有股票標籤的隱藏狀態
  const handleUnhideAll = () => {
    playClickSound();
    setPositions((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((sym) => {
        if (next[sym]?.hidden) {
          next[sym] = {
            ...next[sym],
            hidden: false,
            updatedAt: new Date().toISOString(),
          };
        }
      });
      return next;
    });
    setHasUnsavedChanges(true);
    toast.success(`已解除全部 ${hiddenCount} 檔股票標籤的隱藏狀態！`, { id: "tag-unhide-all" });
  };

  // 匯出股票儲存位置訊息 (JSON 格式下載)
  const handleExportPositions = () => {
    playClickSound();
    const count = Object.keys(positions).length;
    if (count === 0) {
      toast.info("目前畫布上沒有股票標籤可供匯出");
      return;
    }

    const exportData = {
      version: "1.0",
      type: "visual_lines_board_positions",
      exportedAt: new Date().toISOString(),
      tagSizeOffset,
      count,
      positions,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `StockPositions_VisualLines_${dateStr}_(${count}檔).json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    playSuccessSound();
    toast.success(`成功匯出 ${count} 檔股票儲存位置訊息！`, { id: "export-positions" });
  };

  // 觸發選擇匯入檔案
  const handleTriggerImport = () => {
    playClickSound();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // 處理匯入股票儲存位置訊息
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      let importedPositions: PositionMap = {};
      let importedTagSizeOffset: number | undefined;

      if (data && typeof data === "object") {
        if (data.positions && typeof data.positions === "object") {
          importedPositions = data.positions;
        } else if (!data.positions && Object.keys(data).length > 0 && !data.version) {
          // 直接是 PositionMap 格式
          importedPositions = data;
        }
        if (typeof data.tagSizeOffset === "number") {
          importedTagSizeOffset = data.tagSizeOffset;
        }
      }

      const validEntries = Object.entries(importedPositions).filter(([sym, pos]) => {
        return sym && pos && typeof pos.x === "number" && typeof pos.y === "number";
      });

      if (validEntries.length === 0) {
        toast.error("匯入檔案格式不正確或未包含有效的股票位置資料");
        return;
      }

      const sanitized: PositionMap = {};
      validEntries.forEach(([sym, pos]) => {
        const cleanSym = sym.trim().toUpperCase();
        sanitized[cleanSym] = {
          x: Math.max(0, Math.min(100, pos.x)),
          y: Math.max(0, Math.min(100, pos.y)),
          shape: "circle",
          sizeOffset: typeof pos.sizeOffset === "number" ? pos.sizeOffset : 0,
          color: pos.color && pos.color !== "#000000" ? pos.color : undefined,
          hidden: Boolean(pos.hidden),
          updatedAt: pos.updatedAt || new Date().toISOString(),
        };
      });

      // 合併至目前位置（或覆蓋更新）
      setPositions((prev) => ({
        ...prev,
        ...sanitized,
      }));

      if (importedTagSizeOffset !== undefined) {
        setTagSizeOffset(importedTagSizeOffset);
      }

      setHasUnsavedChanges(true);
      playSuccessSound();
      toast.success(`成功匯入 ${validEntries.length} 檔股票儲存位置訊息！請記得點擊「儲存」以同步至雲端。`, {
        id: "import-positions",
        duration: 4000,
      });
    } catch (err) {
      console.error("匯入位置檔案失敗:", err);
      toast.error("讀取匯入檔案失敗，請確認檔案為正確的 JSON 格式");
    }
  };

  // 一鍵避開重疊：保持 Y 軸（現價相對高度）不變，純水平調整 X 軸使標籤彼此錯開
  const handleAvoidOverlap = () => {
    playClickSound();
    const entries = Object.entries(positions);
    if (entries.length <= 1) {
      toast.info("目前畫布上的標籤數量不足以產生重疊");
      return;
    }

    const canvasEl = canvasRef.current;
    const canvasWidth = canvasEl ? Math.max(300, canvasEl.clientWidth) : 1200;
    const canvasHeight = canvasEl ? Math.max(200, canvasEl.clientHeight) : 600;

    // 複製一份工作用位置
    const working: { [sym: string]: { x: number; y: number; size: number } } = {};
    entries.forEach(([sym, pos]) => {
      const effectiveSizeOffset = (pos.sizeOffset ?? 0) + tagSizeOffset;
      const diameter = Math.max(44, 54 + effectiveSizeOffset * 2.2);
      working[sym] = {
        x: pos.x, // 百分比
        y: pos.y, // 百分比
        size: diameter,
      };
    });

    const symbols = Object.keys(working);
    const n = symbols.length;

    const originalX: { [sym: string]: number } = {};
    symbols.forEach((sym) => {
      originalX[sym] = working[sym].x;
    });

    const iterations = 80;
    const paddingX = 8; // 水平額外安全間隔 (px)
    const minXPercent = 4.0; // 邊界保護 (4%)
    const maxXPercent = 96.0; // 邊界保護 (96%)

    for (let iter = 0; iter < iterations; iter++) {
      let anyCollisionInThisRound = false;

      for (let i = 0; i < n; i++) {
        const symA = symbols[i];
        const a = working[symA];
        const aPxX = (a.x / 100) * canvasWidth;
        const aPxY = (a.y / 100) * canvasHeight;
        const radiusA = a.size / 2;

        for (let j = i + 1; j < n; j++) {
          const symB = symbols[j];
          const b = working[symB];
          const bPxX = (b.x / 100) * canvasWidth;
          const bPxY = (b.y / 100) * canvasHeight;
          const radiusB = b.size / 2;

          const dy = Math.abs(aPxY - bPxY);
          const combinedRadius = radiusA + radiusB + paddingX;

          // 若 Y 軸距離小於兩球半徑加安全間距，則上下有交疊風險，必須在 X 軸拉開足夠距離
          if (dy < combinedRadius) {
            // 水平安全距離：至少需達到兩球半徑和加上緩衝間隙
            const minSafeDistanceX = Math.max(
              radiusA + radiusB + paddingX,
              Math.sqrt(Math.max(0, combinedRadius * combinedRadius - dy * dy)) + paddingX
            );

            const dx = bPxX - aPxX;
            const absDx = Math.abs(dx);

            if (absDx < minSafeDistanceX) {
              anyCollisionInThisRound = true;
              const overlap = minSafeDistanceX - absDx;
              const shiftPx = (overlap / 2) * 0.65; // 阻尼係數
              const shiftPercent = (shiftPx / canvasWidth) * 100;

              if (absDx < 0.1) {
                // 兩者 X 幾乎完全一樣，依符號字母順序固定一左一右推開
                const dir = symA.localeCompare(symB) < 0 ? -1 : 1;
                a.x = Math.max(minXPercent, Math.min(maxXPercent, a.x - shiftPercent * dir));
                b.x = Math.max(minXPercent, Math.min(maxXPercent, b.x + shiftPercent * dir));
              } else if (dx > 0) {
                // B 在 A 右側：A 往左推，B 往右推
                a.x = Math.max(minXPercent, Math.min(maxXPercent, a.x - shiftPercent));
                b.x = Math.max(minXPercent, Math.min(maxXPercent, b.x + shiftPercent));
              } else {
                // B 在 A 左側：A 往右推，B 往左推
                a.x = Math.max(minXPercent, Math.min(maxXPercent, a.x + shiftPercent));
                b.x = Math.max(minXPercent, Math.min(maxXPercent, b.x - shiftPercent));
              }
            }
          }
        }
      }

      if (!anyCollisionInThisRound) {
        break;
      }
    }

    // 產生新位置映射 (嚴格保持 Y 座標不變)
    let totalMovedCount = 0;
    const newPositions: PositionMap = { ...positions };
    symbols.forEach((sym) => {
      const diff = Math.abs(working[sym].x - originalX[sym]);
      if (diff > 0.15) {
        totalMovedCount++;
      }
      if (newPositions[sym]) {
        newPositions[sym] = {
          ...newPositions[sym],
          x: Math.round(working[sym].x * 100) / 100,
          // Y 座標絕對保持原樣不變
          y: positions[sym].y,
          updatedAt: new Date().toISOString(),
        };
      }
    });

    if (totalMovedCount > 0) {
      setPositions(newPositions);
      setHasUnsavedChanges(true);
      playSuccessSound();
      toast.success(`已完成水平避開重疊！共微調了 ${totalMovedCount} 檔股票標籤位置（現價高度維持不變）。`, {
        id: "avoid-overlap",
        duration: 3500,
      });
    } else {
      toast.info("目前畫布上所有股票標籤已均勻分散，無重疊需要調整。");
    }
  };

  // 輔助函式：返回交易總覽時進入全螢幕模式
  const triggerFullscreenOverview = () => {
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.warn("Fullscreen request rejected:", err);
        });
      }
    } catch (e) {
      console.warn("Trigger fullscreen error:", e);
    }
  };

  // 點擊原點跳轉至該股視覺圖示化卡片
  const handleJumpToCard = (tabId: string, symbol: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    playClickSound();
    triggerFullscreenOverview();

    if (onSelectStock) {
      onSelectStock(tabId, symbol);
    } else {
      window.dispatchEvent(
        new CustomEvent("jump_to_stock_card", {
          detail: { tabId, symbol },
        })
      );
      onClose();
    }

    toast.info(`正在前往「${symbol}」視覺圖示化卡片...`, {
      id: `jump-${symbol}`,
      duration: 2000,
    });
  };

  // 儲存位置、形狀與大小 (Save button 或 Shift + S)
  const handleSavePositions = useCallback(async () => {
    setIsSaving(true);
    playSuccessSound();

    const storageKey = `visual_lines_board_positions_${userId || "guest"}`;

    // 確保每檔股票標籤都有完整的 shape: 'circle'、sizeOffset 與 color 等設定，且無 undefined 欄位以符合 Firestore 要求
    const sanitizedPositions: PositionMap = {};
    Object.entries(positions).forEach(([sym, pos]) => {
      const entry: {
        x: number;
        y: number;
        shape?: "circle";
        sizeOffset?: number;
        color?: string;
        hidden?: boolean;
        updatedAt?: string;
      } = {
        x: typeof pos.x === "number" ? pos.x : 50,
        y: typeof pos.y === "number" ? pos.y : 50,
        shape: "circle",
        sizeOffset: typeof pos.sizeOffset === "number" ? pos.sizeOffset : 0,
        updatedAt: pos.updatedAt || new Date().toISOString(),
      };
      if (pos.color && typeof pos.color === "string" && pos.color.trim() !== "" && pos.color !== "#09090b") {
        entry.color = pos.color;
      }
      if (pos.hidden) {
        entry.hidden = true;
      }
      sanitizedPositions[sym] = entry;
    });

    try {
      // 1. LocalStorage
      localStorage.setItem(storageKey, JSON.stringify(sanitizedPositions));
      localStorage.setItem("visualLines_tagSizeOffset", String(tagSizeOffset));
      localStorage.setItem("visualLines_tagShape", "circle");

      // 2. Firestore (完整儲存文檔：位置、個別尺寸、形狀與全域設定)
      if (userId) {
        const docRef = doc(db, "users", userId, "visualLinesBoard", "positions");
        try {
          await setDoc(
            docRef,
            {
              positions: sanitizedPositions,
              tagSizeOffset,
              defaultShape: "circle",
              updatedAt: new Date().toISOString(),
            }
          );
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.WRITE, `users/${userId}/visualLinesBoard/positions`);
        }
      }

      // 3. 發送全域自訂廣播事件，讓其他開啟中的畫布組件即時同步
      window.dispatchEvent(
        new CustomEvent("visual_lines_positions_updated", {
          detail: {
            allPositions: sanitizedPositions,
            tagSizeOffset,
          },
        })
      );

      setPositions(sanitizedPositions);
      setHasUnsavedChanges(false);
      toast.success(`圖表標籤位置、形狀與尺寸已成功儲存！(共 ${Object.keys(sanitizedPositions).length} 檔)`, {
        id: "visual-lines-save",
        duration: 2500,
      });
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("儲存失敗：" + (err?.message || "請稍後再試"));
    } finally {
      setIsSaving(false);
    }
  }, [positions, tagSizeOffset, userId]);

  // 鍵盤快速鍵 (Shift + S, Alt + W, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "S" || e.key === "s") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        handleSavePositions();
        return;
      }

      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "W" || e.key === "w" || e.code === "KeyW")
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerFullscreenOverview();
        onClose();
        return;
      }

      if (e.key === "Escape") {
        if (isMainTabDropdownOpen || isSubTabDropdownOpen || isStockDropdownOpen) {
          setIsMainTabDropdownOpen(false);
          setIsSubTabDropdownOpen(false);
          setIsStockDropdownOpen(false);
          return;
        }
        triggerFullscreenOverview();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleSavePositions, onClose, isMainTabDropdownOpen, isSubTabDropdownOpen, isStockDropdownOpen]);

  // 滑鼠與觸控拖曳標籤
  const handleTagPointerDown = (
    e: React.MouseEvent | React.TouchEvent,
    symbol: string,
    currentX: number,
    currentY: number
  ) => {
    if (!canvasRef.current) return;
    
    // 如果點擊的是按鈕或其子元素 (如勾選按鈕、刪除按鈕、狀態圓點按鈕)，交由各自的事件處理器
    const targetEl = e.target as HTMLElement | null;
    if (targetEl && (targetEl.closest("button") || targetEl.tagName === "BUTTON")) {
      return;
    }

    // 不要在 mousedown 立即 e.preventDefault()，避免阻止瀏覽器正常的 dblclick (雙擊) 事件派發
    if ("touches" in e) {
      e.preventDefault();
    }
    e.stopPropagation();

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const tagPixelX = canvasRect.left + (currentX / 100) * canvasRect.width;
    const tagPixelY = canvasRect.top + (currentY / 100) * canvasRect.height;

    const startClientX = clientX;
    const startClientY = clientY;
    let hasMoved = false;

    draggingSymbolRef.current = symbol;
    dragOffsetRef.current = {
      offsetX: clientX - tagPixelX,
      offsetY: clientY - tagPixelY,
    };

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!draggingSymbolRef.current || !canvasRef.current) return;

      const curMoveX = "touches" in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curMoveY = "touches" in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const dist = Math.hypot(curMoveX - startClientX, curMoveY - startClientY);
      if (dist > 4) {
        hasMoved = true;
      }

      if (hasMoved) {
        moveEvent.preventDefault();
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const targetPixelX = curMoveX - dragOffsetRef.current.offsetX;
      const targetPixelY = curMoveY - dragOffsetRef.current.offsetY;

      // 限制於畫布邊界內 [2%, 96%]
      const rawPctX = ((targetPixelX - rect.left) / rect.width) * 100;
      const rawPctY = ((targetPixelY - rect.top) / rect.height) * 100;

      const boundedX = Math.max(2, Math.min(96, rawPctX));
      const boundedY = Math.max(2, Math.min(96, rawPctY));

      const activeSymbol = draggingSymbolRef.current;
      setPositions((prev) => ({
        ...prev,
        [activeSymbol]: {
          ...prev[activeSymbol],
          x: parseFloat(boundedX.toFixed(2)),
          y: parseFloat(boundedY.toFixed(2)),
          shape: "circle",
          sizeOffset: prev[activeSymbol]?.sizeOffset ?? 0,
          updatedAt: new Date().toISOString(),
        },
      }));
      setHasUnsavedChanges(true);
    };

    const handlePointerUp = (upEvent: MouseEvent | TouchEvent) => {
      const activeSym = draggingSymbolRef.current;
      draggingSymbolRef.current = null;
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);

      // 若滑鼠或手指沒有實質位移（單純點擊一下），則切換勾選狀態 (已勾選 -> 取消勾選；未勾選 -> 勾選)
      if (!hasMoved && activeSym) {
        const curUpX = "changedTouches" in upEvent ? upEvent.changedTouches[0].clientX : (upEvent as MouseEvent).clientX;
        const curUpY = "changedTouches" in upEvent ? upEvent.changedTouches[0].clientY : (upEvent as MouseEvent).clientY;
        const totalDist = Math.hypot(curUpX - startClientX, curUpY - startClientY);
        if (totalDist <= 4) {
          playClickSound();
          const cleanSym = activeSym.trim().toUpperCase();
          setSelectedTagSymbols((prev) =>
            prev.includes(cleanSym) ? prev.filter((s) => s !== cleanSym) : [...prev, cleanSym]
          );
        }
      }
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: false });
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: false });
    window.addEventListener("touchend", handlePointerUp);
  };

  // 處理畫布空白處框選複數股票標籤 (Box Selection Marquee)
  const handleCanvasPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return;

    // 檢查點擊目標是否為互動元件（標籤、按鈕、輸入框、下拉選單等），如果是則不觸發畫布框選
    const targetEl = e.target as HTMLElement | null;
    if (
      targetEl &&
      (targetEl.closest("button") ||
        targetEl.closest("input") ||
        targetEl.closest("[data-tag-symbol]") ||
        targetEl.closest("[data-no-marquee]"))
    ) {
      return;
    }

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const startCanvasX = clientX - canvasRect.left;
    const startCanvasY = clientY - canvasRect.top;

    let isMarquee = false;
    let latestCurX = startCanvasX;
    let latestCurY = startCanvasY;

    const handlePointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!canvasRef.current) return;
      const curClientX = "touches" in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const curClientY = "touches" in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const rect = canvasRef.current.getBoundingClientRect();
      latestCurX = curClientX - rect.left;
      latestCurY = curClientY - rect.top;

      const dist = Math.hypot(latestCurX - startCanvasX, latestCurY - startCanvasY);
      if (dist > 5) {
        isMarquee = true;
        moveEvent.preventDefault();
        setSelectionBox({
          startX: startCanvasX,
          startY: startCanvasY,
          currentX: latestCurX,
          currentY: latestCurY,
        });
      }
    };

    const handlePointerUp = (upEvent: MouseEvent | TouchEvent) => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);

      if (isMarquee && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const minX = Math.min(startCanvasX, latestCurX);
        const maxX = Math.max(startCanvasX, latestCurX);
        const minY = Math.min(startCanvasY, latestCurY);
        const maxY = Math.max(startCanvasY, latestCurY);

        if (maxX - minX >= 6 || maxY - minY >= 6) {
          const selectedInBox: string[] = [];
          activeCanvasSymbols.forEach((sym) => {
            const pos = positions[sym];
            if (!pos) return;
            const tagPx = (pos.x / 100) * rect.width;
            const tagPy = (pos.y / 100) * rect.height;
            const effOffset = pos.sizeOffset !== undefined ? pos.sizeOffset : tagSizeOffset;
            const tagRadius = Math.max(44, 54 + effOffset * 2.2) / 2;

            // 判斷標籤圓形是否落入或相交於框選矩形
            if (
              tagPx + tagRadius >= minX &&
              tagPx - tagRadius <= maxX &&
              tagPy + tagRadius >= minY &&
              tagPy - tagRadius <= maxY
            ) {
              selectedInBox.push(sym);
            }
          });

          if (selectedInBox.length > 0) {
            playSuccessSound();
            const isShift = (upEvent as MouseEvent).shiftKey;
            setSelectedTagSymbols((prev) => {
              if (isShift) {
                return Array.from(new Set([...prev, ...selectedInBox]));
              }
              return selectedInBox;
            });
            toast.success(`已框選 ${selectedInBox.length} 檔股票標籤（已直接勾選）`, { id: "box-select" });
          } else {
            const isShift = (upEvent as MouseEvent).shiftKey;
            if (!isShift) {
              setSelectedTagSymbols([]);
            }
          }
        }
      } else {
        // 單純點擊空白處且未按 Shift，取消所有勾選
        const isShift = (upEvent as MouseEvent).shiftKey;
        if (!isShift) {
          setSelectedTagSymbols([]);
        }
      }

      setSelectionBox(null);
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: false });
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: false });
    window.addEventListener("touchend", handlePointerUp);
  };

  // 自動依 6 條視覺線整齊排列圖表上的標籤
  const handleAutoArrange = () => {
    const syms = Object.keys(positions);
    if (syms.length === 0) {
      toast.info("圖表上尚無標籤可排列，請先新增股票標籤");
      return;
    }
    playClickSound();

    const newPosMap: PositionMap = {};
    const lineIndices = [0, 1, 2, 3, 4, 5];

    syms.forEach((sym, index) => {
      const lineIdx = lineIndices[index % lineIndices.length];
      const targetLine = VISUAL_LINES[lineIdx];

      const itemsInLine = Math.ceil(syms.length / VISUAL_LINES.length) || 1;
      const slotInLine = Math.floor(index / VISUAL_LINES.length);
      const startX = 14;
      const endX = 86;
      const stepX = itemsInLine > 1 ? (endX - startX) / itemsInLine : 25;
      const xPct = Math.min(88, startX + slotInLine * stepX + (index % 2 === 0 ? 0 : 3));

      newPosMap[sym] = {
        ...positions[sym],
        x: parseFloat(xPct.toFixed(2)),
        y: targetLine.yPercent - 2,
        shape: "circle",
        sizeOffset: positions[sym]?.sizeOffset ?? 0,
        updatedAt: new Date().toISOString(),
      };
    });

    setPositions(newPosMap);
    setHasUnsavedChanges(true);
    toast.info("已將圖表標籤自動依視覺線對齊排列");
  };

  if (!isOpen) return null;

  const MainIcon = mainTabDisplayInfo.icon;

  return (
    <div className="fixed inset-0 z-[99999] bg-white flex flex-col select-none overflow-hidden font-sans">
      {/* Top Header Bar - Nike Athletic High-Contrast Aesthetic */}
      <header className="w-full bg-[#111111] text-white border-b border-zinc-800 px-3.5 sm:px-5 py-2.5 flex items-center justify-between gap-3 shadow-lg z-50 shrink-0 relative overflow-visible">
        {/* Left: Cascading Navigation Dropdowns */}
        <div className="flex items-center gap-2.5 py-0.5 relative z-40 overflow-visible flex-wrap">
          {/* Main Title Badge - Nike Bold Style */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white text-black rounded-full shadow-sm shrink-0 select-none">
            <SlidersHorizontal className="w-3.5 h-3.5 text-black stroke-[2.5]" />
            <span className="font-black text-xs tracking-wider uppercase font-sans">
              視覺線看板
            </span>
          </div>

          {/* 1. 交易總覽主分頁選單 (持有中 / 真實交易 / 已完成 / 全部交易) */}
          <div className="relative shrink-0 z-30" ref={mainTabDropdownRef}>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setIsMainTabDropdownOpen(!isMainTabDropdownOpen);
                setIsSubTabDropdownOpen(false);
                setIsStockDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 rounded-full text-xs font-bold transition-all border border-zinc-700/80 cursor-pointer active:scale-95"
            >
              <MainIcon className="w-3.5 h-3.5 text-[#D2F800]" />
              <span className="text-zinc-400 font-medium text-[11px]">分類</span>
              <span className="font-black text-white tracking-wide">{mainTabDisplayInfo.title}</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full font-mono font-black bg-zinc-800 text-zinc-300 border border-zinc-700">
                {mainTabDisplayInfo.count}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {isMainTabDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-60 bg-[#18181b] border border-zinc-700 rounded-2xl shadow-2xl p-2 z-[100] space-y-1 backdrop-blur-md">
                <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-400 border-b border-zinc-800 mb-1">
                  選擇交易總覽主分類
                </div>
                {/* 持有中 */}
                <button
                  type="button"
                  onClick={() => handleSelectMainTab("active")}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                    mainTabFilter === "active"
                      ? "bg-white text-black shadow-md"
                      : "hover:bg-zinc-800/80 text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                    <span>持有中 (模擬交易)</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black ${
                    mainTabFilter === "active" ? "bg-black text-white" : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {allTabs.filter((t) => t.status !== "COMPLETED" && t.tradeType !== "real").length}
                  </span>
                </button>

                {/* 真實交易 */}
                <button
                  type="button"
                  onClick={() => handleSelectMainTab("real")}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                    mainTabFilter === "real"
                      ? "bg-[#D2F800] text-black shadow-md"
                      : "hover:bg-zinc-800/80 text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                    <span>真實交易</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black ${
                    mainTabFilter === "real" ? "bg-black text-[#D2F800]" : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {allTabs.filter((t) => t.status !== "COMPLETED" && t.tradeType === "real").length}
                  </span>
                </button>

                {/* 已完成 */}
                <button
                  type="button"
                  onClick={() => handleSelectMainTab("completed")}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                    mainTabFilter === "completed"
                      ? "bg-purple-600 text-white shadow-md"
                      : "hover:bg-zinc-800/80 text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>已完成 (歷史)</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black ${
                    mainTabFilter === "completed" ? "bg-black text-white" : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {allTabs.filter((t) => t.status === "COMPLETED").length}
                  </span>
                </button>

                {/* 全部交易 */}
                <button
                  type="button"
                  onClick={() => handleSelectMainTab("all")}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                    mainTabFilter === "all"
                      ? "bg-white text-black shadow-md"
                      : "hover:bg-zinc-800/80 text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>全部交易</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black ${
                    mainTabFilter === "all" ? "bg-black text-white" : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {allTabs.length}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 2. 子分頁分類選單 (動態對應所選主分頁之子分頁) */}
          <div className="relative shrink-0 z-20" ref={subTabDropdownRef}>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setIsSubTabDropdownOpen(!isSubTabDropdownOpen);
                setIsMainTabDropdownOpen(false);
                setIsStockDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 rounded-full text-xs font-bold transition-all border border-zinc-700/80 cursor-pointer active:scale-95"
            >
              <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-zinc-400 font-medium text-[11px]">子分頁</span>
              <span className="font-black text-white tracking-wide">
                {getSubTabLabel(selectedSubTab)}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {isSubTabDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-[#18181b] border border-zinc-700 rounded-2xl shadow-2xl p-2 z-[100] space-y-1 backdrop-blur-md">
                <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-400 border-b border-zinc-800 mb-1">
                  選擇「{mainTabDisplayInfo.title}」子分頁
                </div>

                {/* 全部子分頁 */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubTab("all");
                    setIsSubTabDropdownOpen(false);
                    playClickSound();
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                    selectedSubTab === "all" ? "bg-white text-black" : "hover:bg-zinc-800 text-zinc-300"
                  }`}
                >
                  <span>全部子分頁</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black ${
                    selectedSubTab === "all" ? "bg-black text-white" : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {mainTabFilteredPool.length} 檔
                  </span>
                </button>

                {mainTabFilter === "completed" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubTab("real");
                        setIsSubTabDropdownOpen(false);
                        playClickSound();
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                        selectedSubTab === "real" ? "bg-teal-500 text-black" : "hover:bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>真實交易完成</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black ${
                        selectedSubTab === "real" ? "bg-black text-white" : "bg-zinc-800 text-zinc-400"
                      }`}>
                        {allTabs.filter((t) => t.status === "COMPLETED" && t.tradeType === "real").length} 檔
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubTab("simulated");
                        setIsSubTabDropdownOpen(false);
                        playClickSound();
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-left text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                        selectedSubTab === "simulated" ? "bg-emerald-500 text-black" : "hover:bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" />
                        <span>虛擬交易完成</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black ${
                        selectedSubTab === "simulated" ? "bg-black text-white" : "bg-zinc-800 text-zinc-400"
                      }`}>
                        {allTabs.filter((t) => t.status === "COMPLETED" && t.tradeType !== "real").length} 檔
                      </span>
                    </button>
                  </>
                ) : (
                  SUB_TABS_LIST.map((subTabKey) => {
                    const conf = HOLDING_CONFIG[subTabKey];
                    const TabIcon = conf.icon;
                    const isCur = selectedSubTab === subTabKey;
                    const subLabel = getSubTabLabel(subTabKey);

                    const count = mainTabFilteredPool.filter(
                      (t) => (t.holdingStatus || "候選名單") === subTabKey
                    ).length;

                    return (
                      <button
                        key={subTabKey}
                        type="button"
                        onClick={() => {
                          setSelectedSubTab(subTabKey);
                          setIsSubTabDropdownOpen(false);
                          playClickSound();
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-left text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                          isCur
                            ? "bg-[#D2F800] text-black shadow-md"
                            : "hover:bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <TabIcon className="w-3.5 h-3.5" />
                          <span>{subLabel}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black ${
                          isCur ? "bg-black text-[#D2F800]" : "bg-zinc-800 text-zinc-400"
                        }`}>
                          {count} 檔
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* 3. 區塊股票選單 (選擇區塊股票並個別新增/刪除) - Nike Volt Highlighted Capsule */}
          <div className="relative shrink-0 z-10" ref={stockDropdownRef}>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setIsStockDropdownOpen(!isStockDropdownOpen);
                setIsMainTabDropdownOpen(false);
                setIsSubTabDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-[#D2F800] hover:bg-[#bce000] text-black rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Tag className="w-3.5 h-3.5 text-black stroke-[2.5]" />
              <span className="font-extrabold text-black/80 text-[11px]">
                {selectedSubTab === "all" ? "選擇區塊股票" : `${getSubTabLabel(selectedSubTab)}股票`}:
              </span>
              <span className="font-black tracking-tight text-black">
                圖表已有 {activeCanvasSymbols.length} 檔
              </span>
              <span className="bg-black text-[#D2F800] text-[10px] px-2 py-0.2 rounded-full font-mono font-black">
                {availableBlockStocks.length}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-black stroke-[2.5]" />
            </button>

            {isStockDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-88 bg-[#18181b] border border-zinc-700 rounded-2xl shadow-2xl p-3 z-[100] space-y-2.5 backdrop-blur-md">
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs font-black text-zinc-200">
                  <div className="flex items-center gap-1.5">
                    <ListPlus className="w-4 h-4 text-[#D2F800]" />
                    <span className="tracking-wide">
                      {selectedSubTab === "all"
                        ? `所有「${mainTabDisplayInfo.title}」美股`
                        : `「${getSubTabLabel(selectedSubTab)}」美股清單`}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    共 {availableBlockStocks.length} 檔
                  </span>
                </div>

                {/* Search input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={stockSearchQuery}
                    onChange={(e) => setStockSearchQuery(e.target.value)}
                    placeholder="搜尋股票代號或名稱..."
                    className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs font-mono font-bold text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#D2F800]"
                  />
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={handleAddAllBlockStocks}
                    className="flex-1 py-1.5 px-2.5 bg-white hover:bg-zinc-200 text-black text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    title="一鍵將此區塊所有股票標籤新增至圖表"
                  >
                    <Plus className="w-3.5 h-3.5 text-black stroke-[3]" />
                    <span>全部新增</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncDividersFromCards}
                    className="flex-1 py-1.5 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-[#D2F800] text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1 border border-zinc-700 hover:border-[#D2F800]/50 cursor-pointer active:scale-95"
                    title="一鍵將此區塊內符合分隔線條件之卡片，同步現價相對位置至畫布"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-[#D2F800]" />
                    <span>同步分隔線</span>
                  </button>
                  {activeCanvasSymbols.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllCanvas}
                      className="py-1.5 px-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-[11px] font-black rounded-xl transition-all flex items-center gap-1 border border-rose-800/80 cursor-pointer active:scale-95"
                      title="清空圖表上所有標籤"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>清空</span>
                    </button>
                  )}
                </div>

                {/* Stock List with Add / Remove Buttons */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {availableBlockStocks
                    .filter((t) => {
                      const q = stockSearchQuery.toLowerCase();
                      return (
                        t.symbol.toLowerCase().includes(q) ||
                        (t.companyName && t.companyName.toLowerCase().includes(q))
                      );
                    })
                    .map((tab) => {
                      const sym = tab.symbol.trim().toUpperCase();
                      const isOnCanvas = Boolean(positions[sym]);
                      const conf = HOLDING_CONFIG[tab.holdingStatus || "候選名單"];
                      const subLabel = getSubTabLabel(tab.holdingStatus || "候選名單");

                      return (
                        <div
                          key={sym}
                          className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all border ${
                            isOnCanvas
                              ? "bg-zinc-900/90 border-[#D2F800]/50 text-white font-bold"
                              : "bg-zinc-900/40 border-zinc-800 text-zinc-300 hover:bg-zinc-800/60"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-black font-sans text-xs tracking-wider text-white">
                              {sym}
                            </span>
                            <span className={`text-[10px] px-2 py-0.2 rounded-full font-black ${
                              isOnCanvas ? "bg-[#D2F800] text-black" : "bg-zinc-800 text-zinc-400"
                            }`}>
                              {subLabel}
                            </span>
                            {tab.tradeType === "real" && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full font-black">
                                真實
                              </span>
                            )}
                            {tab.currentPrice && (
                              <span className="text-[10px] text-zinc-400 font-mono">
                                ${Number(tab.currentPrice).toFixed(1)}
                              </span>
                            )}
                          </div>

                          {/* Action Button */}
                          <div>
                            {isOnCanvas ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveStockFromCanvas(sym)}
                                className="px-2.5 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/60 rounded-lg text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer"
                                title="從圖表上移除此標籤"
                              >
                                <X className="w-3 h-3" />
                                <span>移除</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddStockToCanvas(sym, tab)}
                                className="px-3 py-1 bg-white hover:bg-zinc-200 text-black rounded-lg text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Plus className="w-3 h-3 text-black stroke-[3]" />
                                <span>新增</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                  {availableBlockStocks.length === 0 && (
                    <div className="py-6 text-center text-xs text-zinc-500">
                      此區塊目前沒有任何美股
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4. 一鍵同步分隔線現價至畫布按鈕 (涵蓋「持有中」與「真實交易」所有子分頁卡片) */}
          <button
            type="button"
            onClick={handleSyncDividersFromCards}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/90 hover:bg-zinc-700 text-[#D2F800] border border-zinc-700 hover:border-[#D2F800]/50 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="一鍵同步「持有中」與「真實交易」下所有子分頁個股卡片之現價與分隔線相對位置"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#D2F800]" />
            <span className="hidden sm:inline">一鍵同步分隔線現價</span>
            <span className="sm:hidden">同步線</span>
          </button>

          {/* 4.5. 一鍵避開重疊按鈕 (保持 Y 軸現價高度不變，純水平 X 軸微調避開重疊) */}
          <button
            type="button"
            onClick={handleAvoidOverlap}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/90 hover:bg-zinc-700 text-sky-300 border border-zinc-700 hover:border-sky-400/50 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="一鍵將上下重疊的股票標籤往左/右水平調整位置以避開重疊（現價相對高度維持不變）"
          >
            <MoveHorizontal className="w-3.5 h-3.5 text-sky-400 stroke-[2.2]" />
            <span className="hidden sm:inline">一鍵避開重疊</span>
            <span className="sm:hidden">避開重疊</span>
          </button>

          {/* 5. 一鍵「重置」按鈕 (刪除畫布上所有個股標籤) */}
          <button
            type="button"
            onClick={handleResetAllCanvas}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/80 hover:border-rose-600 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="一鍵重置並刪除畫布上所有個股標籤"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-300 stroke-[2.5]" />
            <span className="tracking-wide">重置</span>
          </button>

          {/* 隱藏的檔案上傳 Input 用於匯入位置 */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".json,application/json"
            className="hidden"
          />

          {/* 匯出 / 匯入位置訊息整合操作群組 (放置在同一個膠囊區塊內) */}
          <div className="flex items-center bg-zinc-900/90 border border-zinc-700/90 rounded-full p-0.5 shadow-sm shrink-0">
            {/* 匯出股票儲存位置訊息按鈕 */}
            <button
              type="button"
              onClick={handleExportPositions}
              className="flex items-center gap-1.5 px-2.5 py-1 text-zinc-200 hover:text-white hover:bg-zinc-800 rounded-full text-xs font-black transition-all cursor-pointer select-none active:scale-95 shrink-0"
              title="匯出畫布上所有股票的儲存位置、尺寸與顏色訊息 (JSON 格式備份)"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">匯出位置訊息</span>
              <span className="sm:hidden">匯出</span>
            </button>

            {/* 分隔線 */}
            <div className="w-[1px] h-3.5 bg-zinc-700 mx-0.5" />

            {/* 匯入股票儲存位置訊息按鈕 */}
            <button
              type="button"
              onClick={handleTriggerImport}
              className="flex items-center gap-1.5 px-2.5 py-1 text-zinc-200 hover:text-white hover:bg-zinc-800 rounded-full text-xs font-black transition-all cursor-pointer select-none active:scale-95 shrink-0"
              title="匯入先前備份的股票儲存位置訊息檔案 (JSON 格式)"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">匯入位置訊息</span>
              <span className="sm:hidden">匯入</span>
            </button>
          </div>

          {/* 6. 圓形標籤管理工具：框選模式 / 勾選選取 / 隱藏標籤 / 圓形尺寸調整 (-/+) / 重設 */}
          <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-700/90 rounded-full px-2 py-1 shadow-sm shrink-0 flex-wrap">
            {/* 框選模式按鈕 */}
            <button
              type="button"
              onClick={() => {
                setIsBoxSelectMode(!isBoxSelectMode);
                playClickSound();
                toast.info(!isBoxSelectMode ? "已開啟框選模式：直接在畫布上拖曳即可框選多檔股票標籤" : "已切換回標準模式", { id: "box-mode" });
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black transition-all cursor-pointer select-none active:scale-95 ${
                isBoxSelectMode
                  ? "bg-sky-400 text-black shadow-sm"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
              title={
                isBoxSelectMode
                  ? "目前處於框選模式 (在畫布上拖曳滑鼠即可框選)"
                  : "框選功能：在畫布空白處直接拖曳滑鼠即可框選複數股票標籤"
              }
            >
              <BoxSelect className="w-3.5 h-3.5 text-current stroke-[2.2]" />
              <span className="hidden sm:inline">框選</span>
            </button>

            {/* 勾選 / 全選按鈕 */}
            <button
              type="button"
              onClick={handleSelectAllTags}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black transition-all cursor-pointer select-none active:scale-95 ${
                selectedTagSymbols.length > 0
                  ? "bg-[#D2F800] text-black shadow-sm"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
              title={
                selectedTagSymbols.length > 0
                  ? `已勾選 ${selectedTagSymbols.length} 檔 (點擊取消全選)`
                  : "勾選標籤可個別調整圓形尺寸與隱藏 (點擊全選)"
              }
            >
              {selectedTagSymbols.length > 0 ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-black" />
                  <span>已選 {selectedTagSymbols.length} 檔</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="hidden sm:inline">全選</span>
                </>
              )}
            </button>

            {/* 隱藏標籤按鈕 (當有股票處於勾選狀態時顯示) */}
            {selectedTagSymbols.length > 0 && (
              <button
                type="button"
                onClick={handleToggleHideSelected}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black transition-all cursor-pointer select-none active:scale-95 animate-in fade-in zoom-in-95 duration-150 ${
                  isAllSelectedHidden
                    ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-sm"
                    : "bg-amber-500/90 text-black hover:bg-amber-400 shadow-sm"
                }`}
                title={
                  isAllSelectedHidden
                    ? `解除勾選的 ${selectedTagSymbols.length} 檔股票標籤之隱藏狀態`
                    : `隱藏勾選的 ${selectedTagSymbols.length} 檔股票標籤 (可隨時從「顯示隱藏」檢視或恢復)`
                }
              >
                {isAllSelectedHidden ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                    <span>解除隱藏</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                    <span>隱藏標籤</span>
                  </>
                )}
              </button>
            )}

            {/* 圓形尺寸調整組 (- / 數值 / +) */}
            <div className="flex items-center gap-0.5 bg-zinc-950 border border-zinc-800 rounded-full px-1 py-0.5">
              <button
                type="button"
                onClick={() => handleAdjustTagSize(-2)}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-transparent hover:bg-zinc-800 text-zinc-200 transition-all cursor-pointer active:scale-90"
                title={
                  selectedTagSymbols.length > 0
                    ? `縮小勾選的 ${selectedTagSymbols.length} 檔圓形標籤 (-2px)`
                    : "縮小預設圓形標籤 (-2px)"
                }
              >
                <Minus className="w-3 h-3 text-zinc-200" />
              </button>

              <button
                type="button"
                onClick={handleResetTagSize}
                className="px-2 py-0.5 text-center cursor-pointer select-none rounded-full hover:bg-zinc-800 transition-colors flex items-center gap-1"
                title="點擊重設尺寸"
              >
                <Circle className="w-2.5 h-2.5 text-zinc-400" />
                <span className="text-[10.5px] font-mono font-black text-white">
                  {selectedTagSymbols.length === 1
                    ? `${(positions[selectedTagSymbols[0]]?.sizeOffset ?? tagSizeOffset) > 0 ? "+" : ""}${
                        positions[selectedTagSymbols[0]]?.sizeOffset ?? tagSizeOffset
                      }px`
                    : selectedTagSymbols.length > 1
                    ? `選取${selectedTagSymbols.length}`
                    : tagSizeOffset > 0
                    ? `+${tagSizeOffset}px`
                    : tagSizeOffset < 0
                    ? `${tagSizeOffset}px`
                    : "大小"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleAdjustTagSize(2)}
                className="w-5 h-5 flex items-center justify-center rounded-full bg-transparent hover:bg-zinc-800 text-zinc-200 transition-all cursor-pointer active:scale-90"
                title={
                  selectedTagSymbols.length > 0
                    ? `放大勾選的 ${selectedTagSymbols.length} 檔圓形標籤 (+2px)`
                    : "放大預設圓形標籤 (+2px)"
                }
              >
                <Plus className="w-3 h-3 text-zinc-200" />
              </button>
            </div>

            {/* 顏色選擇區塊 (當股票處於 tickbox 勾選狀態時在大小按鈕旁顯示) */}
            {selectedTagSymbols.length > 0 && (
              <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-700 rounded-full px-2 py-0.5 shadow-sm animate-in fade-in zoom-in-95 duration-150">
                <span className="text-[10px] font-black text-zinc-400 mr-0.5 select-none hidden sm:inline uppercase tracking-wider">
                  邊框顏色:
                </span>
                <div className="flex items-center gap-1">
                  {TAG_COLOR_OPTIONS.map((c) => {
                    const isAllThisColor = c.isDefault
                      ? selectedTagSymbols.every((s) => !positions[s]?.color || positions[s]?.color === "#000000")
                      : selectedTagSymbols.every((s) => positions[s]?.color === c.bg);

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSetTagColor(c.isDefault ? undefined : c.bg)}
                        title={`${c.label} ${c.isDefault ? "(1px 黑色預設)" : "(6px 邊框)"}`}
                        className={`w-4 h-4 rounded-full transition-all cursor-pointer relative hover:scale-125 shrink-0 ${
                          isAllThisColor
                            ? "ring-2 ring-[#D2F800] ring-offset-1 ring-offset-black scale-120 shadow-xs"
                            : "hover:ring-1 hover:ring-zinc-400 opacity-90 hover:opacity-100"
                        }`}
                        style={{
                          backgroundColor: c.bg,
                          border: `1px solid ${c.border}`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions & Save Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Status Indicator */}
          <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 text-[11px] font-black rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300">
            {hasUnsavedChanges ? (
              <span className="flex items-center gap-1.5 text-amber-400 font-black animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                未儲存 (Shift+S)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[#D2F800] font-black">
                <span className="w-2 h-2 rounded-full bg-[#D2F800] shadow-[0_0_8px_rgba(210,248,0,0.8)]" />
                已儲存 ({activeCanvasSymbols.length} 檔)
              </span>
            )}
          </div>

          {/* 顯示 / 隱藏標籤開關 (包含隱藏數量 badge 與狀態) */}
          <button
            type="button"
            onClick={() => {
              const next = !showHiddenTags;
              setShowHiddenTags(next);
              playClickSound();
              if (next) {
                toast.info(`已開啟「顯示隱藏」，畫布上顯示 ${hiddenCount} 檔已隱藏股票（半透明標示）`, {
                  id: "toggle-show-hidden",
                });
              } else {
                toast.info("已關閉「顯示隱藏」", { id: "toggle-show-hidden" });
              }
            }}
            title={
              showHiddenTags
                ? `目前顯示所有標籤 (包含 ${hiddenCount} 檔已隱藏，點擊關閉)`
                : `點擊顯示被隱藏的 ${hiddenCount} 檔股票標籤`
            }
            className={`px-3 py-1.5 rounded-full border text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              showHiddenTags
                ? "bg-amber-400 text-black border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.35)]"
                : hiddenCount > 0
                ? "bg-zinc-900 border-amber-500/60 text-amber-300 hover:bg-zinc-800"
                : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {showHiddenTags ? (
              <>
                <Eye className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                <span className="hidden sm:inline">顯示隱藏</span>
                <span className="sm:hidden">顯示</span>
                {hiddenCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-black/20 text-black text-[10px] rounded-full font-mono font-black">
                    {hiddenCount}
                  </span>
                )}
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-current stroke-[2.2]" />
                <span className="hidden sm:inline">顯示隱藏</span>
                <span className="sm:hidden">顯示</span>
                {hiddenCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] rounded-full font-mono font-black">
                    {hiddenCount}
                  </span>
                )}
              </>
            )}
          </button>

          {/* 一鍵全部解除隱藏按鈕 (當處於顯示隱藏模式且有隱藏標籤時提供快捷按鈕) */}
          {showHiddenTags && hiddenCount > 0 && (
            <button
              type="button"
              onClick={handleUnhideAll}
              className="px-2.5 py-1.5 rounded-full border border-emerald-500/80 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 text-xs font-black transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-sm animate-in fade-in"
              title={`一鍵解除全部 ${hiddenCount} 檔股票標籤的隱藏狀態`}
            >
              <Eye className="w-3 h-3 text-emerald-400" />
              <span className="hidden md:inline">全部取消隱藏</span>
              <span className="md:hidden">全部取消</span>
            </button>
          )}

          {/* Toggle Line Labels */}
          <button
            type="button"
            onClick={() => {
              setShowLineLabels(!showLineLabels);
              playClickSound();
            }}
            title="切換線條說明文字"
            className={`px-3 py-1.5 rounded-full border text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              showLineLabels
                ? "bg-white text-black border-white"
                : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <Info className="w-3.5 h-3.5 text-current" />
            <span className="hidden md:inline">線條標籤</span>
          </button>

          {/* 儲存按鈕 (Nike Premium Black/Volt Save + Shortcut Shift+S) */}
          <button
            type="button"
            onClick={handleSavePositions}
            disabled={isSaving}
            className={`px-4 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-md ${
              hasUnsavedChanges
                ? "bg-amber-400 hover:bg-amber-300 text-black shadow-amber-400/30 animate-pulse"
                : "bg-white hover:bg-zinc-200 text-black shadow-white/20"
            }`}
          >
            <Save className="w-3.5 h-3.5 text-black stroke-[2.5]" />
            <span className="tracking-wide uppercase">儲存位置</span>
            <span className="hidden lg:inline-block px-1.5 py-0.2 bg-black/15 text-black text-[10px] rounded-full font-mono font-black">
              Shift+S
            </span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              triggerFullscreenOverview();
              onClose();
            }}
            title="關閉並以全螢幕返回交易總覽 (Esc)"
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer active:scale-90"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* Main Visualizer Fullscreen Canvas with Depth of Field */}
      <main
        ref={canvasRef}
        onMouseDown={handleCanvasPointerDown}
        onTouchStart={handleCanvasPointerDown}
        className={`flex-1 relative w-full h-full bg-[#F4F5F8] select-none overflow-hidden ${
          isBoxSelectMode ? "cursor-crosshair" : "cursor-default"
        }`}
      >
        {/* Optical Depth of Field Ambient Lighting Layer */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background:
              "radial-gradient(ellipse 95% 85% at 50% 48%, rgba(255, 255, 255, 0.45) 0%, rgba(238, 242, 248, 0.45) 55%, rgba(208, 216, 228, 0.65) 100%)",
          }}
        />

        {/* Subtle Top & Bottom Depth Vignettes */}
        <div
          className="absolute inset-x-0 top-0 h-32 pointer-events-none z-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(15, 23, 42, 0.07) 0%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-32 pointer-events-none z-0"
          style={{
            background:
              "linear-gradient(to top, rgba(15, 23, 42, 0.09) 0%, transparent 100%)",
          }}
        />

        {/* Box Selection (Marquee) Visual Overlay */}
        {selectionBox && (
          <div
            className="absolute z-50 pointer-events-none border-2 border-sky-500 bg-sky-500/15 rounded-xs shadow-sm transition-none"
            style={{
              left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
              top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
              width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
              height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
            }}
          >
            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-sky-600 text-white rounded text-[10px] font-mono font-black shadow-xs flex items-center gap-1">
              <BoxSelect className="w-3 h-3 text-white" />
              <span>框選範圍</span>
            </div>
          </div>
        )}

        {/* Background Color Bands Between Lines */}
        {VISUAL_BANDS.map((band) => (
          <div
            key={band.id}
            className="absolute left-0 right-0 pointer-events-none transition-colors z-0"
            style={{
              top: `${band.top}%`,
              height: `${band.bottom - band.top}%`,
              backgroundColor: band.bg,
            }}
          />
        ))}

        {/* Render 6 Horizontal Lines across full width */}
        {VISUAL_LINES.map((line) => (
          <div
            key={line.id}
            className="absolute left-0 right-0 pointer-events-none group flex items-center z-10"
            style={{ top: `${line.yPercent}%` }}
          >
            {/* The colored continuous horizontal bar */}
            <div
              className="w-full transition-all"
              style={{
                height: line.color === "#000000" ? "4px" : "3.5px",
                backgroundColor: line.color,
                boxShadow:
                  line.color === "#000000"
                    ? "0 0 10px rgba(0,0,0,0.22)"
                    : `0 0 10px ${line.color}55`,
              }}
            />

            {/* Line label with Nike typography at the right margin */}
            {showLineLabels && (
              <div
                className="absolute right-4 -top-5 px-3 py-1 rounded-full text-[11px] font-black pointer-events-none tracking-wider flex items-center gap-2 shadow-lg border border-black/10 backdrop-blur-md"
                style={{
                  color: "#000000",
                  backgroundColor: "rgba(255, 255, 255, 0.96)",
                }}
              >
                <span className="text-black font-black uppercase">{line.label}</span>
                <span className="text-[9.5px] text-zinc-500 font-mono font-bold">[{line.desc}]</span>
              </div>
            )}
          </div>
        ))}

        {/* Draggable Stock Symbol Tags on Canvas (Android 扁平化運動球體標籤: 內部純白 #FFFFFF, 文字極致黑 #000000, 邊緣約 2px Solid Color 邊框, 含最新現價, 下方顯示更新時間與日期) */}
        {activeCanvasSymbols.map((sym) => {
          const pos = positions[sym];
          if (!pos) return null;
          const tab = allStockMap.get(sym);
          const conf = HOLDING_CONFIG[tab?.holdingStatus || "候選名單"];

          const effectiveSizeOffset = pos.sizeOffset !== undefined ? pos.sizeOffset : tagSizeOffset;
          const isSelected = selectedTagSymbols.includes(sym);
          const isHidden = Boolean(pos.hidden);

          const symbolFontSize = Math.max(10, 13 + Math.round(effectiveSizeOffset * 0.85));
          const priceFontSize = Math.max(8, 10 + Math.round(effectiveSizeOffset * 0.5));
          const dotSize = Math.max(5, 7 + Math.round(effectiveSizeOffset * 0.3));
          const btnSize = Math.max(14, 16 + Math.round(effectiveSizeOffset * 0.3));
          const circleSize = Math.max(44, 54 + effectiveSizeOffset * 2.2);

          const hasAppliedColor = Boolean(pos.color && pos.color !== "#000000");
          const tagBorderColor = hasAppliedColor ? pos.color! : "#000000";
          const borderThickness = hasAppliedColor ? "6px" : "1px";

          // 格式化最新現價
          const formattedCurrentPrice = (() => {
            if (tab?.currentPrice !== undefined && tab.currentPrice !== null) {
              const num = Number(tab.currentPrice);
              if (!isNaN(num) && num > 0) {
                return `$${num >= 100 ? num.toFixed(1) : num.toFixed(2)}`;
              }
            }
            return null;
          })();

          return (
            <div
              key={sym}
              data-tag-symbol={sym}
              onMouseDown={(e) => handleTagPointerDown(e, sym, pos.x, pos.y)}
              onTouchStart={(e) => handleTagPointerDown(e, sym, pos.x, pos.y)}
              onDoubleClick={(e) => {
                if (isSelected && tab) {
                  handleJumpToCard(tab.id, sym, e);
                }
              }}
              className={`absolute z-20 cursor-grab active:cursor-grabbing transform -translate-x-1/2 -translate-y-1/2 group flex flex-col items-center select-none ${
                isHidden ? "opacity-60 hover:opacity-100" : ""
              }`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
            >
              {/* Android Flat Design Spherical Tag - 運動球體標籤 (內部純白 #FFFFFF, 依設定顯示 6px 套用純色或 1px 預設黑, 勾選不改變邊框顏色, 內部文字 #000000) */}
              <div
                className={`relative flex flex-col items-center justify-center rounded-full transition-all select-none bg-white shadow-md hover:shadow-lg hover:scale-105 ${
                  isHidden ? "border-dashed ring-1 ring-amber-500/50" : ""
                }`}
                style={{
                  width: `${circleSize}px`,
                  height: `${circleSize}px`,
                  backgroundColor: "#FFFFFF",
                  border: `${borderThickness} ${isHidden ? "dashed" : "solid"} ${tagBorderColor}`,
                  boxShadow: isHidden
                    ? "0 1px 4px rgba(0,0,0,0.08)"
                    : "0 2px 6px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)",
                }}
                title={
                  isSelected && tab
                    ? `【${sym}】${isHidden ? "(目前處於隱藏狀態)\n" : ""}雙擊或點擊原點前往視覺圖示化卡片\n分類: ${tab?.holdingStatus || "候選名單"}\n模式: ${tab?.tradeType === "real" ? "真實交易" : "模擬交易"}\n最新現價: ${formattedCurrentPrice || "-"}\n更新時間: ${pos.updatedAt ? new Date(pos.updatedAt).toLocaleString() : "-"}`
                    : `${sym} ${isHidden ? "(隱藏中)" : ""}- 拖曳至任意位置\n分類: ${tab?.holdingStatus || "候選名單"}\n模式: ${tab?.tradeType === "real" ? "真實交易" : "模擬交易"}\n最新現價: ${formattedCurrentPrice || "-"}\n更新時間: ${pos.updatedAt ? new Date(pos.updatedAt).toLocaleString() : "-"}`
                }
              >
                {/* 隱藏標籤指示徽章 (當處於顯示隱藏模式下醒目標示) */}
                {isHidden && (
                  <div className="absolute -top-3.5 px-1.5 py-0.2 bg-zinc-900/95 text-amber-300 border border-amber-500/60 rounded-full text-[8.5px] font-black flex items-center gap-0.5 pointer-events-none shadow-md z-30 tracking-tight">
                    <EyeOff className="w-2.5 h-2.5 text-amber-300 stroke-[2.5]" />
                    <span>隱藏中</span>
                  </div>
                )}
                {/* Tickbox positioned at top-left of circle */}
                <button
                  type="button"
                  onClick={(e) => handleToggleTagSelection(sym, e)}
                  title={isSelected ? "取消勾選" : "勾選以個別調整尺寸與邊框顏色"}
                  className={`absolute -top-1.5 -left-1.5 rounded-full flex items-center justify-center transition-all cursor-pointer z-10 ${
                    isSelected
                      ? "bg-[#D2F800] text-black border border-white shadow-xs scale-110"
                      : "bg-zinc-800 text-transparent border border-zinc-500 hover:border-zinc-300 opacity-60 group-hover:opacity-100"
                  }`}
                  style={{
                    width: `${Math.max(13, 15 + Math.round(effectiveSizeOffset * 0.2))}px`,
                    height: `${Math.max(13, 15 + Math.round(effectiveSizeOffset * 0.2))}px`,
                  }}
                >
                  <Check
                    style={{
                      width: `${Math.max(8, 10 + Math.round(effectiveSizeOffset * 0.2))}px`,
                      height: `${Math.max(8, 10 + Math.round(effectiveSizeOffset * 0.2))}px`,
                    }}
                    className={isSelected ? "opacity-100 stroke-[3.5]" : "opacity-0"}
                  />
                </button>

                {/* Status Dot (當處於勾選狀態時，點擊原點跳轉至該股視覺圖示化卡片) */}
                <button
                  type="button"
                  onClick={(e) => {
                    if (isSelected && tab) {
                      handleJumpToCard(tab.id, sym, e);
                    }
                  }}
                  disabled={!isSelected}
                  title={
                    isSelected && tab
                      ? `點擊前往「${sym}」視覺圖示化卡片`
                      : `${sym} (${tab?.holdingStatus || "候選名單"})`
                  }
                  className={`rounded-full ${conf?.dot || "bg-emerald-500"} shrink-0 mb-0.5 transition-all z-10 ${
                    isSelected
                      ? "cursor-pointer hover:scale-150 ring-2 ring-[#D2F800] active:scale-90 shadow-xs animate-pulse"
                      : "cursor-default ring-1 ring-black/15"
                  }`}
                  style={{
                    width: `${Math.max(5, dotSize)}px`,
                    height: `${Math.max(5, dotSize)}px`,
                  }}
                />

                {/* Stock Symbol - 內部文字極致黑 #000000 */}
                <span
                  className="font-black font-sans tracking-tight leading-none text-center uppercase z-10 select-none text-black"
                  style={{
                    fontSize: `${symbolFontSize}px`,
                    color: "#000000",
                  }}
                >
                  {sym}
                </span>

                {/* Latest Current Price - 最新現價 (內部文字極致黑 #000000) */}
                {formattedCurrentPrice ? (
                  <span
                    className="font-mono font-black tracking-tight leading-none text-center mt-0.5 z-10 select-none text-black"
                    style={{
                      fontSize: `${priceFontSize}px`,
                      color: "#000000",
                    }}
                  >
                    {formattedCurrentPrice}
                  </span>
                ) : (
                  <span
                    className="font-mono font-bold leading-none text-center mt-0.5 z-10 opacity-30 select-none text-black"
                    style={{
                      fontSize: `${priceFontSize}px`,
                      color: "#000000",
                    }}
                  >
                    $--
                  </span>
                )}

                {/* Delete button on hover / touch */}
                <button
                  type="button"
                  onClick={(e) => handleRemoveStockFromCanvas(sym, e)}
                  title={`從圖表刪除 ${sym}`}
                  className="opacity-0 group-hover:opacity-100 absolute -top-1.5 -right-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm z-20 active:scale-90"
                  style={{
                    width: `${btnSize}px`,
                    height: `${btnSize}px`,
                  }}
                >
                  <X style={{ width: `${Math.max(8, btnSize - 6)}px`, height: `${Math.max(8, btnSize - 6)}px` }} className="stroke-[2.5]" />
                </button>
              </div>

              {/* 更新時間與日期顯示在標籤下方 (Android Flat Pill Design) */}
              {pos.updatedAt ? (
                <div
                  className="mt-1 px-1.5 py-0.5 rounded-full bg-white border border-zinc-200 pointer-events-none flex items-center justify-center gap-0.5 select-none transition-all shadow-xs"
                  title={`更新時間與日期: ${new Date(pos.updatedAt).toLocaleString()}`}
                >
                  <span
                    className="font-mono font-bold text-black tracking-tight leading-none whitespace-nowrap"
                    style={{
                      fontSize: `${Math.max(7.5, Math.min(10, 8.5 + Math.round(effectiveSizeOffset * 0.2)))}px`,
                      color: "#000000",
                    }}
                  >
                    {formatTagDate(pos.updatedAt)}
                  </span>
                </div>
              ) : (
                <div
                  className="mt-1 px-1.5 py-0.5 rounded-full bg-white border border-zinc-200 pointer-events-none flex items-center justify-center gap-0.5 select-none transition-all shadow-xs"
                >
                  <span
                    className="font-mono font-bold text-black tracking-tight leading-none whitespace-nowrap"
                    style={{
                      fontSize: `${Math.max(7.5, Math.min(10, 8.5 + Math.round(effectiveSizeOffset * 0.2)))}px`,
                      color: "#000000",
                    }}
                  >
                    {formatTagDate(new Date().toISOString())}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state hint */}
        {activeCanvasSymbols.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center mb-4 shadow-2xl">
              <Tag className="w-7 h-7 text-[#D2F800]" />
            </div>
            <p className="font-black text-lg sm:text-xl text-black uppercase tracking-wider mb-1.5">
              圖表上目前沒有任何美股標籤
            </p>
            <p className="text-xs text-zinc-600 max-w-md leading-relaxed mb-4 font-medium">
              請點選上方「<strong className="text-black font-black">選擇區塊股票</strong>」選單，勾選欲呈現的股票代號新增至視覺線上；拖曳至理想位置後，按下「<strong className="text-black font-black">儲存位置 (Shift+S)</strong>」即可保存。
            </p>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setIsStockDropdownOpen(true);
              }}
              className="pointer-events-auto px-5 py-2.5 bg-black hover:bg-zinc-800 text-[#D2F800] rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-2 transition-all shadow-lg cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-[#D2F800] stroke-[3]" />
              <span>新增美股標籤</span>
            </button>
          </div>
        )}

        {/* Bottom Helper Bar - Nike Precision Track Aesthetic */}
        <div className="absolute bottom-3 left-5 right-5 flex items-center justify-between text-[11px] text-zinc-500 font-mono pointer-events-none">
          <div className="flex items-center gap-4">
            <span>• 拖曳標籤任意定位 (DRAG TO POSITION)</span>
            <span>• 懸停標籤可點擊 <strong className="text-rose-600 font-bold">✕</strong> 刪除</span>
            <span>• 儲存快速鍵 <strong className="text-black font-black">SHIFT + S</strong></span>
          </div>
          <div>
            <span className="uppercase tracking-wider">圖表共有 <strong className="text-black font-black text-xs">{activeCanvasSymbols.length}</strong> 檔標籤</span>
          </div>
        </div>
      </main>
    </div>
  );
};

