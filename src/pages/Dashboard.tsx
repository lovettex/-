import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
import { useStockTabs } from "../hooks/useStockTabs";
import { playClickSound, playSwipeSound, playSuccessSound } from "../lib/audio";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import { toast } from "sonner";
import {
  ScrollIn,
  InteractiveButton,
  Magnetic,
} from "../components/MotionWrappers";
import { AnimatedNumber } from "../components/AnimatedNumber";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import {
  Plus,
  TrendingUp,
  Target,
  Clock,
  Activity,
  TrendingDown,
  DownloadCloud,
  Trash2,
  RotateCcw,
  Gamepad2,
  ShieldCheck,
  EyeOff,
  Eye,
  Search,
  Settings2,
  ArrowUp,
  ArrowDown,
  Calendar,
  FileJson,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Star,
  CheckCircle2,
  SlidersHorizontal,
  Sparkles,
  Link,
  Copy,
  FileText,
  LogOut,
} from "lucide-react";
import { calculateStats } from "../lib/calculations";
import { safeLocalStorage, safeSessionStorage } from "../lib/utils";
import { format } from "date-fns";
import { StockCardVisualizer, prefetchStockPrice } from "../components/StockCardVisualizer";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  user: any,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const getDisplayHoldingStatus = (
  status: string | undefined,
): "觀察中" | "候選名單" | "買進操作" | "賣出操作" | "平倉操作" | "乖離名單" => {
  if (
    status === "觀察中" ||
    status === "買進操作" ||
    status === "賣出操作" ||
    status === "平倉操作" ||
    status === "乖離名單"
  )
    return status;
  return "候選名單";
};

const holdingTabConfig = {
  "觀察中": {
    icon: Eye,
    colorClass: "text-sky-650 text-sky-600 font-bold",
    bgClass: "bg-sky-50",
    borderClass: "border-sky-200",
    shadowClass: "shadow-[0_4px_12px_rgba(56,189,248,0.06)]",
    activeCountClass: "bg-sky-100/80 text-sky-700 border-sky-200/50",
  },
  "候選名單": {
    icon: Star,
    colorClass: "text-amber-700 font-bold",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
    shadowClass: "shadow-[0_4px_12px_rgba(245,158,11,0.06)]",
    activeCountClass: "bg-amber-100/80 text-amber-800 border-amber-200/50",
  },
  "買進操作": {
    icon: TrendingUp,
    colorClass: "text-emerald-700 font-bold",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
    shadowClass: "shadow-[0_4px_12px_rgba(16,185,129,0.06)]",
    activeCountClass: "bg-emerald-100/80 text-emerald-800 border-emerald-200/50",
  },
  "賣出操作": {
    icon: TrendingDown,
    colorClass: "text-rose-700 font-bold",
    bgClass: "bg-rose-50",
    borderClass: "border-rose-200",
    shadowClass: "shadow-[0_4px_12px_rgba(225,29,72,0.06)]",
    activeCountClass: "bg-rose-100/80 text-rose-850 text-rose-800 border-rose-200/50",
  },
  "平倉操作": {
    icon: CheckCircle2,
    colorClass: "text-fuchsia-700 font-bold",
    bgClass: "bg-fuchsia-50",
    borderClass: "border-fuchsia-200",
    shadowClass: "shadow-[0_4px_12px_rgba(217,70,239,0.06)]",
    activeCountClass: "bg-fuchsia-100/80 text-fuchsia-800 border-fuchsia-200/50",
  },
  "乖離名單": {
    icon: Activity,
    colorClass: "text-indigo-700 font-bold",
    bgClass: "bg-indigo-50",
    borderClass: "border-indigo-200",
    shadowClass: "shadow-[0_4px_12px_rgba(99,102,241,0.06)]",
    activeCountClass: "bg-indigo-100/80 text-indigo-800 border-indigo-200/50",
  },
} as const;

const calculatePositiveValue = (
  rating: number = 5,
  qualityScore: number = 5,
  valueScore: number = 5,
  buyRate: number = 5
) => {
  return (
    Math.max(0, rating - 5) +
    Math.max(0, qualityScore - 5) +
    Math.max(0, valueScore - 5) +
    buyRate
  );
};

const calculateNegativeValue = (
  rating: number = 5,
  qualityScore: number = 5,
  valueScore: number = 5,
  sellRate: number = 5
) => {
  return (
    Math.max(0, 5 - rating) +
    Math.max(0, 5 - qualityScore) +
    Math.max(0, 5 - valueScore) +
    sellRate
  );
};

export default function Dashboard() {
  const {
    tabs,
    loading,
    addTab,
    updateTabStatus,
    updateTabHidden,
    updateTabOrder,
    updateTab,
    deleteTab,
  } = useStockTabs();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [totalCapital, setTotalCapital] = useState<number>(() => {
    const saved = safeLocalStorage.getItem(`total-capital-${user?.uid || "guest"}`);
    return saved ? parseFloat(saved) : 1000000;
  });

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "userSettings", user.uid);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (typeof data.totalCapital === "number") {
            setTotalCapital(data.totalCapital);
            safeLocalStorage.setItem(`total-capital-${user.uid}`, data.totalCapital.toString());
          }
        }
      } catch (error) {
        console.error("Failed to fetch userSettings:", error);
        handleFirestoreError(error, OperationType.GET, `userSettings/${user.uid}`, user);
      }
    };
    fetchSettings();
  }, [user]);

  const handleUpdateTotalCapital = async (newVal: number) => {
    setTotalCapital(newVal);
    const userKey = user ? user.uid : "guest";
    safeLocalStorage.setItem(`total-capital-${userKey}`, newVal.toString());
    if (user) {
      try {
        await setDoc(
          doc(db, "userSettings", user.uid),
          { totalCapital: newVal, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (error) {
        console.error("Failed to save userSettings:", error);
        handleFirestoreError(error, OperationType.WRITE, `userSettings/${user.uid}`, user);
      }
    }
  };

  const [activeTabOrders, setActiveTabOrders] = useState<Record<string, any[]>>(
    {},
  );
  
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const state = location.state as { autoFlipTabId?: string } | null;
    if (state?.autoFlipTabId) {
      setFlippedCards(prev => ({ ...prev, [state.autoFlipTabId!]: true }));
      // Use setTimeout to ensure DOM is ready before scrolling
      setTimeout(() => {
        const el = document.getElementById(`stock-card-${state.autoFlipTabId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      }, 300);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  const [activeTabTrades, setActiveTabTrades] = useState<Record<string, any[]>>(
    {},
  );
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 640 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [activeViewTab, setActiveViewTab] = useState<
    "active" | "real" | "completed" | "socrates" | "alerts" | "notes"
  >("active");
  const [activeHoldingSubTab, setActiveHoldingSubTab] = useState<
    "觀察中" | "候選名單" | "買進操作" | "賣出操作" | "平倉操作" | "乖離名單"
  >((safeSessionStorage.getItem('preferredHoldingSubTab') as any) || "候選名單");

  const [activeCardDefinitionFilter, setActiveCardDefinitionFilter] = useState<
    "all" | "highlight" | "operation" | "deviation" | "group"
  >("all");

  useEffect(() => {
    safeSessionStorage.setItem('preferredHoldingSubTab', activeHoldingSubTab);
    setActiveCardDefinitionFilter("all");
  }, [activeHoldingSubTab]);

  const [activeManageTab, setActiveManageTab] = useState<
    "觀察中" | "候選名單" | "買進操作" | "賣出操作" | "平倉操作" | "乖離名單" | "持股監控"
  >("觀察中");
  const [groupingTabId, setGroupingTabId] = useState<string | null>(null);
  const [activeTabStrategies, setActiveTabStrategies] = useState<

    Record<string, any>
  >({});
  const [strategyHighlights, setStrategyHighlights] = useState<Record<string, boolean>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [socratesData, setSocratesData] = useState<
    Record<string, { strong?: any[]; weak?: any[] }>
  >({});
  const [socratesCurrentDate, setSocratesCurrentDate] = useState(new Date());
  const [selectedSocratesDate, setSelectedSocratesDate] = useState<Date | null>(
    null,
  );
  const [socratesSubTab, setSocratesSubTab] = useState<"strong" | "weak" | "featured">(
    "strong",
  );
  const [socratesSortConfig, setSocratesSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [isSocratesCalendarOpen, setIsSocratesCalendarOpen] = useState(false);
  const [socratesSortWeights, setSocratesSortWeights] = useState({
    crashSimilarity: 5,
    buyScore: 7,
    sellScore: 2,
    qualityScore: 7,
    valueScore: 7,
  });
  const [isSocratesSortWeightsOpen, setIsSocratesSortWeightsOpen] =
    useState(false);

  const [socratesHighlightedRows, setSocratesHighlightedRows] = useState<
    Record<string, boolean>
  >({});

  const socratesLoadedUserRef = useRef<string | null>(null);

  // Synchronize socrates highlighted rows and sort weights with safeLocalStorage keyed by user
  useEffect(() => {
    const userKey = user ? user.uid : "guest";
    
    // Load highlighted rows
    const savedHighlights = safeLocalStorage.getItem(`socrates-highlighted-rows-${userKey}`);
    if (savedHighlights) {
      try {
        setSocratesHighlightedRows(JSON.parse(savedHighlights));
      } catch (e) {
        console.error("Failed to parse saved Socrates highlights", e);
        setSocratesHighlightedRows({});
      }
    } else {
      setSocratesHighlightedRows({});
    }

    // Load sort weights
    const savedWeights = safeLocalStorage.getItem(`socrates-sort-weights-${userKey}`);
    if (savedWeights) {
      try {
        setSocratesSortWeights(JSON.parse(savedWeights));
      } catch (e) {
        console.error("Failed to parse saved Socrates sort weights", e);
      }
    }

    socratesLoadedUserRef.current = userKey;
  }, [user]);

  // Premium Audio feedback on tab/state changes
  const isInitialViewTabMount = useRef(true);
  useEffect(() => {
    if (isInitialViewTabMount.current) {
      isInitialViewTabMount.current = false;
    } else {
      playClickSound();
    }
  }, [activeViewTab]);

  const isInitialHoldingSubTabMount = useRef(true);
  useEffect(() => {
    if (isInitialHoldingSubTabMount.current) {
      isInitialHoldingSubTabMount.current = false;
    } else {
      playClickSound();
    }
  }, [activeHoldingSubTab]);

  const isInitialManageTabMount = useRef(true);
  useEffect(() => {
    if (isInitialManageTabMount.current) {
      isInitialManageTabMount.current = false;
    } else {
      playClickSound();
    }
  }, [activeManageTab]);

  const isInitialCardFilterMount = useRef(true);
  useEffect(() => {
    if (isInitialCardFilterMount.current) {
      isInitialCardFilterMount.current = false;
    } else {
      playClickSound();
    }
  }, [activeCardDefinitionFilter]);

  const lastFlippedCards = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (Object.keys(lastFlippedCards.current).length > 0) {
      let changed = false;
      const allKeys = new Set([...Object.keys(flippedCards), ...Object.keys(lastFlippedCards.current)]);
      for (const k of allKeys) {
        if (!!flippedCards[k] !== !!lastFlippedCards.current[k]) {
          changed = true;
          break;
        }
      }
      if (changed) {
        playSwipeSound();
      }
    }
    lastFlippedCards.current = { ...flippedCards };
  }, [flippedCards]);

  // Save highlights when modified
  useEffect(() => {
    const userKey = user ? user.uid : "guest";
    if (socratesLoadedUserRef.current === userKey) {
      safeLocalStorage.setItem(`socrates-highlighted-rows-${userKey}`, JSON.stringify(socratesHighlightedRows));
    }
  }, [socratesHighlightedRows, user]);

  // Save sort weights when modified
  useEffect(() => {
    const userKey = user ? user.uid : "guest";
    if (socratesLoadedUserRef.current === userKey) {
      safeLocalStorage.setItem(`socrates-sort-weights-${userKey}`, JSON.stringify(socratesSortWeights));
    }
  }, [socratesSortWeights, user]);

  const copySocratesRowToClipboard = async (item: any) => {
    const headers = [
      "代碼", "名稱", "產業", "型態", "現價", "支撐", "AI分析", "Buy", "Sell", "風險", "Qual", "Val", "Pos Val", "Neg Val", "訊號解讀"
    ];
    const values = [
      item.symbol,
      item.name || "-",
      item.sector || "-",
      item.technicalPattern || "-",
      item.price ? `$${item.price}` : "-",
      item.supportPrice ? `$${item.supportPrice}` : "-",
      item.rating !== undefined ? item.rating : "-",
      item.buyScore !== undefined ? item.buyScore : "-",
      item.sellScore !== undefined ? item.sellScore : "-",
      item.crashSimilarity !== undefined ? item.crashSimilarity : "-",
      item.qualityScore !== undefined ? item.qualityScore : "-",
      item.valueScore !== undefined ? item.valueScore : "-",
      item.positiveValue !== undefined ? item.positiveValue : "-",
      item.negativeValue !== undefined ? item.negativeValue : "-",
      item.ecmStatus || "-"
    ];
    
    const tsvText = values.join("\t");
    const humanReadableText = headers.map((h, i) => `${h}: ${values[i]}`).join(", ");
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(tsvText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = tsvText;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      toast.success(`已複製 ${item.symbol} 數據：${humanReadableText}`, {
        duration: 3500
      });
    } catch (err) {
      toast.error("複製失敗");
    }
  };

  const [notesExpandedCategories, setNotesExpandedCategories] = useState<
    Record<string, boolean>
  >({});

  const toggleNotesCategory = (cat: string) => {
    setNotesExpandedCategories((prev) => ({
      ...prev,
      [cat]: prev[cat] === false,
    }));
  };

  const handleUpdateOperationNote = async (tabId: string, noteText: string) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        operationNote: noteText, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { operationNote: noteText, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新操作備註失敗");
    }
  };

  const handleUpdateOperationFocus = async (tabId: string, focusText: string) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        operationFocus: focusText, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { operationFocus: focusText, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新操作重點失敗");
    }
  };

  const handleUpdateTPChecked = async (tabId: string, checked: boolean) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        tpChecked: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { tpChecked: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新止盈狀態失敗");
    }
  };

  const handleUpdateSLChecked = async (tabId: string, checked: boolean) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        slChecked: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { slChecked: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新止損狀態失敗");
    }
  };

  const handleUpdateAddChecked = async (tabId: string, checked: boolean) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        addChecked: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { addChecked: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新加碼狀態失敗");
    }
  };

  const handleUpdateCloseChecked = async (tabId: string, checked: boolean) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        closeChecked: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { closeChecked: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新平倉狀態失敗");
    }
  };

  const handleUpdateObserveChecked = async (tabId: string, checked: boolean) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        observeChecked: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { observeChecked: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新觀察狀態失敗");
    }
  };

  const handleUpdateNotesHighlighted = async (tabId: string, checked: boolean) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        notesHighlighted: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { notesHighlighted: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新選取狀態失敗");
    }
  };

  const handleUpdateStrategyField = async (tabId: string, field: string, checked: any) => {
    try {
      const currentStrategy = activeTabStrategies[tabId] || {};
      const updatedStrategy = { 
        ...currentStrategy, 
        [field]: checked, 
        updatedAt: serverTimestamp() 
      };
      
      setActiveTabStrategies((prev) => ({
        ...prev,
        [tabId]: updatedStrategy
      }));
      
      const docRef = doc(db, `stockTabs/${tabId}/strategy`, 'main');
      await setDoc(docRef, { [field]: checked, updatedAt: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("更新設定失敗");
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingPrices, setIsImportingPrices] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingCompleted, setIsExportingCompleted] = useState(false);
  const [isImportingCompleted, setIsImportingCompleted] = useState(false);
  const completedJsonFileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingNotes, setIsExportingNotes] = useState(false);
  const [isImportingNotes, setIsImportingNotes] = useState(false);
  const notesJsonFileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingFeatured, setIsExportingFeatured] = useState(false);
  const [isImportingFeatured, setIsImportingFeatured] = useState(false);
  const featuredJsonFileInputRef = useRef<HTMLInputElement>(null);

  // Carousel State & Refs
  const carouselRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    scrollLeft: 0,
    hasDraggedBeyondThreshold: false,
    lastX: 0,
    vx: 0,
  });

  const animFrameId = useRef<number | null>(null);
  const visibleTabsRef = useRef<any[]>([]);

  const DRAG_THRESHOLD = 5;

  const onDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const ele = carouselRef.current;
    if (!ele) return;

    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }

    const pageX =
      "touches" in e && e.touches && e.touches.length > 0
        ? e.touches[0].pageX
        : (e as React.MouseEvent).pageX;

    dragRef.current.isDragging = true;
    dragRef.current.hasDraggedBeyondThreshold = false;
    dragRef.current.startX = pageX - ele.offsetLeft;
    dragRef.current.scrollLeft = ele.scrollLeft;
    dragRef.current.lastX = pageX;
    dragRef.current.vx = 0;

    // Disable snap behavior during drag for smooth swiping
    ele.style.scrollSnapType = "none";
    ele.style.cursor = "grabbing";
    document.body.style.userSelect = "none"; // Prevent text selection
  };

  const onDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragRef.current.isDragging) return;

    const ele = carouselRef.current;
    if (!ele) return;

    const pageX =
      "touches" in e && e.touches && e.touches.length > 0
        ? e.touches[0].pageX
        : (e as MouseEvent).pageX;
    const x = pageX - ele.offsetLeft;
    const dx = x - dragRef.current.startX;

    dragRef.current.vx = pageX - dragRef.current.lastX;
    dragRef.current.lastX = pageX;

    if (Math.abs(dx) > DRAG_THRESHOLD) {
      dragRef.current.hasDraggedBeyondThreshold = true;
    }

    ele.scrollLeft = dragRef.current.scrollLeft - dx;
  }, []);

  const onDragEnd = useCallback(() => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;

    const ele = carouselRef.current;
    if (ele) {
      ele.style.cursor = "grab";

      // Programmatic horizontal paging/snapping based on mobile vs desktop
      const containerInner = ele.children[0] as HTMLElement;
      if (containerInner && containerInner.children.length > 0) {
        const items = Array.from(containerInner.children) as HTMLElement[];
        const offsets = items.map((item) => item.offsetLeft);
        const currentScroll = ele.scrollLeft;
        
        // Find the index of the item closest to current scroll position
        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < offsets.length; i++) {
          const diff = Math.abs(offsets[i] - currentScroll);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }

        // Determine step size based on viewport width (Desktop: 2 units, Mobile: 1 unit)
        const isMobile = window.innerWidth < 640;
        const step = isMobile ? 1 : 2;

        let targetIdx = closestIdx;
        const vx = dragRef.current.vx;

        // Decisive drag direction check (negative velocity scrolls right, positive scrolls left)
        if (vx < -2.0) {
          // Swiped left (user wants to scroll right)
          targetIdx = Math.min(items.length - 1, closestIdx + step);
        } else if (vx > 2.0) {
          // Swiped right (user wants to scroll left)
          targetIdx = Math.max(0, closestIdx - step);
        }

        const targetScrollLeft = Math.max(0, Math.min(ele.scrollWidth - ele.clientWidth, offsets[targetIdx]));

        // Smooth animations with ease-out cubic feel
        let startScroll = ele.scrollLeft;
        const distance = targetScrollLeft - startScroll;
        const duration = 280; // ms transition phase
        let startTime: number | null = null;

        const animateScroll = (time: number) => {
          if (!startTime) startTime = time;
          const progress = time - startTime;
          const t = Math.min(progress / duration, 1);
          const ease = t * (2 - t); // Quadratic ease out
          
          ele.scrollLeft = startScroll + distance * ease;

          if (t < 1) {
            animFrameId.current = requestAnimationFrame(animateScroll);
          } else {
            animFrameId.current = null;
          }
        };

        if (animFrameId.current) {
          cancelAnimationFrame(animFrameId.current);
        }
        animFrameId.current = requestAnimationFrame(animateScroll);
      }

      if (dragRef.current.hasDraggedBeyondThreshold) {
        setTimeout(() => {
          dragRef.current.hasDraggedBeyondThreshold = false;
        }, 50);
      }
    }
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onDragMove, { passive: false });
    window.addEventListener("mouseup", onDragEnd);
    window.addEventListener("touchmove", onDragMove, { passive: false });
    window.addEventListener("touchend", onDragEnd);
    return () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
      window.removeEventListener("touchmove", onDragMove);
      window.removeEventListener("touchend", onDragEnd);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [onDragMove, onDragEnd]);

  // New stock state
  const [newSymbol, setNewSymbol] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newTradeType, setNewTradeType] = useState<"simulated" | "real">(
    "simulated",
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isManageHiddenOpen, setIsManageHiddenOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [manageTradeType, setManageTradeType] = useState<"simulated" | "real">("simulated");
  const [isEditingCapital, setIsEditingCapital] = useState(false);
  const [editCapitalVal, setEditCapitalVal] = useState("");

  useEffect(() => {
    if (isManageHiddenOpen) {
      setManageTradeType(activeViewTab === "real" ? "real" : "simulated");
    }
  }, [isManageHiddenOpen, activeViewTab]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSymbol.trim()) {
      addTab(newSymbol.trim(), newCompany.trim(), newTradeType);
      playSuccessSound();
      setNewSymbol("");
      setNewCompany("");
      setNewTradeType("simulated");
      setIsAddOpen(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setSocratesData({});
      return;
    }

    const fetchSocratesData = async () => {
      const path = `users/${user.uid}/socratesData`;
      try {
        const socratesDoc = await getDocs(query(collection(db, path)));
        const data: Record<string, any> = {};
        socratesDoc.forEach((doc) => {
          data[doc.id] = doc.data();
        });

        // Handle migration from localStorage if Firestore is empty but local has data
        const saved = safeLocalStorage.getItem("socrates-data");
        if (Object.keys(data).length === 0 && saved) {
          try {
            const parsed = JSON.parse(saved);
            Object.keys(parsed).forEach(async (dateKey) => {
              if (Array.isArray(parsed[dateKey])) {
                parsed[dateKey] = { strong: parsed[dateKey] };
              }
              const itemPath = `${path}/${dateKey}`;
              try {
                await setDoc(doc(db, itemPath), parsed[dateKey]);
              } catch (e) {
                handleFirestoreError(e, OperationType.WRITE, itemPath, user);
              }
            });
            setSocratesData(parsed);
            safeLocalStorage.removeItem("socrates-data");
            return;
          } catch (e) {
            console.error("Migration failed", e);
          }
        }

        setSocratesData(data);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path, user);
      }
    };

    fetchSocratesData();
  }, [user]);

  const handleSocratesUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    dateKey: string,
    type: "strong" | "weak",
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        if (!Array.isArray(json)) {
          throw new Error("Socrates data should be a JSON array");
        }

        const processedJson = json.map((item) => {
          const newItem = { ...item };

          // Flexible key matching to handle spaces, underscores, and various names
          Object.entries(item).forEach(([key, value]) => {
            const normalizedKey = key.toUpperCase().replace(/[\s_\.\-]+/g, "");
            if (
              normalizedKey.includes("QUALITY") &&
              newItem.qualityScore === undefined
            ) {
              newItem.qualityScore = value;
            }
            if (
              normalizedKey.includes("VALUE") &&
              newItem.valueScore === undefined
            ) {
              newItem.valueScore = value;
            }
            if (
              (normalizedKey.includes("CRASH") ||
                normalizedKey.includes("崩盤")) &&
              newItem.crashSimilarity === undefined
            ) {
              newItem.crashSimilarity = value;
            }
            if (
              (normalizedKey === "BUY" ||
                normalizedKey === "BUYSCORE" ||
                normalizedKey === "BUYRATE") &&
              newItem.buyScore === undefined
            ) {
              newItem.buyScore = value;
            }
            if (
              (normalizedKey === "SELL" ||
                normalizedKey === "SELLSCORE" ||
                normalizedKey === "SELLRATE") &&
              newItem.sellScore === undefined
            ) {
              newItem.sellScore = value;
            }
            if (
              (normalizedKey === "SYM" ||
                normalizedKey === "SYMBOL" ||
                normalizedKey === "TICKER" ||
                normalizedKey === "代碼") &&
              newItem.symbol === undefined
            ) {
              newItem.symbol = value;
            }
            if (
              (normalizedKey === "NAME" ||
                normalizedKey === "COMPANYNAME" ||
                normalizedKey === "名稱") &&
              newItem.name === undefined
            ) {
              newItem.name = value;
            }
            if (
              (normalizedKey.includes("AISCORE") ||
                normalizedKey.includes("AI分數") ||
                normalizedKey.includes("AI評分") ||
                normalizedKey === "RATING") &&
              newItem.rating === undefined
            ) {
              newItem.rating = value;
            }
            if (
              (normalizedKey.includes("CURRENTPRICE") ||
                normalizedKey === "PRICE" ||
                normalizedKey === "現價") &&
              newItem.price === undefined
            ) {
              newItem.price = value;
            }
            if (
              (normalizedKey === "SUPPORTPRICE" ||
                normalizedKey === "支撐" ||
                normalizedKey === "支撐價" ||
                normalizedKey === "支撐價格") &&
              newItem.supportPrice === undefined
            ) {
              newItem.supportPrice = value;
            }
            if (
              (normalizedKey.includes("ECM") ||
                normalizedKey.includes("訊號") ||
                normalizedKey.includes("週期狀態") ||
                normalizedKey.includes("週期") ||
                normalizedKey.includes("簡評")) &&
              newItem.ecmStatus === undefined
            ) {
              newItem.ecmStatus = value;
            }
            if (
              (normalizedKey.includes("POSITIVE") ||
                normalizedKey.includes("P+")) &&
              newItem.positiveValue === undefined
            ) {
              newItem.positiveValue = value;
            }
            if (
              (normalizedKey.includes("NEGATIVE") ||
                normalizedKey.includes("N-")) &&
              newItem.negativeValue === undefined
            ) {
              newItem.negativeValue = value;
            }
            if (
              (normalizedKey === "SECTOR" ||
                normalizedKey === "板塊" ||
                normalizedKey === "產業") &&
              newItem.sector === undefined
            ) {
              newItem.sector = value;
            }
            if (
              (normalizedKey === "TECHNICALPATTERN" ||
                normalizedKey.includes("技術型態") ||
                normalizedKey.includes("備註") ||
                normalizedKey.includes("PATTERN")) &&
              newItem.technicalPattern === undefined
            ) {
              newItem.technicalPattern = value;
            }
          });
          
          if (newItem.positiveValue === undefined) {
            newItem.positiveValue = calculatePositiveValue(
              Number(newItem.rating ?? 5), 
              Number(newItem.qualityScore || 5), 
              Number(newItem.valueScore || 5), 
              Number(newItem.buyScore || 5)
            );
          }
          if (newItem.negativeValue === undefined) {
            newItem.negativeValue = calculateNegativeValue(
              Number(newItem.rating ?? 5), 
              Number(newItem.qualityScore || 5), 
              Number(newItem.valueScore || 5), 
              Number(newItem.sellScore || 5)
            );
          }

          return newItem;
        });

        const currentDayData = socratesData[dateKey] || {};
        const updatedDayData = {
          ...currentDayData,
          [type]: processedJson,
        };

        const path = `users/${user.uid}/socratesData/${dateKey}`;
        try {
          // Update Firestore
          await setDoc(doc(db, path), updatedDayData);

          // Update local state
          setSocratesData((prev) => ({
            ...prev,
            [dateKey]: updatedDayData,
          }));

          toast.success(
            `成功匯入 ${dateKey} ${type === "strong" ? "看漲名單" : "看跌名單"}（共 ${json.length} 筆）`,
          );
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path, user);
          toast.error("匯入失敗，請檢查權限或網路連接");
        }
      } catch (error: any) {
        toast.error(`匯入失敗: ${error.message}`);
      }
      // Reset input
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleExportFeaturedJson = () => {
    if (!selectedSocratesDate) {
      toast.error("請先選擇日期");
      return;
    }
    setIsExportingFeatured(true);
    try {
      const dateKey = `${selectedSocratesDate.getFullYear()}-${String(selectedSocratesDate.getMonth() + 1).padStart(2, "0")}-${String(selectedSocratesDate.getDate()).padStart(2, "0")}`;
      const strong = socratesData[dateKey]?.strong || [];
      const weak = socratesData[dateKey]?.weak || [];
      const featuredStrong = strong.filter(item => !!socratesHighlightedRows[item.symbol]);
      const featuredWeak = weak.filter(item => !!socratesHighlightedRows[item.symbol]);
  
      if (featuredStrong.length === 0 && featuredWeak.length === 0) {
        toast.error("目前沒有任何精選名單可供匯出");
        setIsExportingFeatured(false);
        return;
      }
  
      const exportData = {
        date: dateKey,
        strong: featuredStrong,
        weak: featuredWeak,
      };
  
      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `socrates-featured-${dateKey}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  
      toast.success("成功匯出精選名單");
    } catch (error) {
       toast.error("匯出失敗");
    } finally {
      setIsExportingFeatured(false);
    }
  };

  const handleImportFeaturedJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsImportingFeatured(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);

        if (!json.strong && !json.weak) {
          throw new Error("無效的精選名單格式");
        }

        const dateKeyToUse = selectedSocratesDate
          ? `${selectedSocratesDate.getFullYear()}-${String(selectedSocratesDate.getMonth() + 1).padStart(2, "0")}-${String(selectedSocratesDate.getDate()).padStart(2, "0")}`
          : json.date;

        if (!dateKeyToUse) {
           throw new Error("無法確定匯入的日期");
        }

        const currentDayData = socratesData[dateKeyToUse] || { strong: [], weak: [] };
        
        // Merge the lists to prevent duplicates in currentDayData
        const newStrong = [...(currentDayData.strong || [])];
        const newWeak = [...(currentDayData.weak || [])];
        const highlightsToMerge: Record<string, boolean> = { ...socratesHighlightedRows };

        (json.strong || []).forEach((item: any) => {
          if (!newStrong.find(i => i.symbol === item.symbol)) {
            newStrong.push(item);
          }
          highlightsToMerge[item.symbol] = true;
        });

        (json.weak || []).forEach((item: any) => {
          if (!newWeak.find(i => i.symbol === item.symbol)) {
            newWeak.push(item);
          }
          highlightsToMerge[item.symbol] = true;
        });

        const updatedDayData = {
          ...currentDayData,
          strong: newStrong,
          weak: newWeak,
        };

        const path = `users/${user.uid}/socratesData/${dateKeyToUse}`;
        await setDoc(doc(db, path), updatedDayData);

        setSocratesData((prev) => ({
          ...prev,
          [dateKeyToUse]: updatedDayData,
        }));

        setSocratesHighlightedRows(highlightsToMerge);

        toast.success("成功匯入精選名單");
      } catch (error: any) {
        console.error(error);
        toast.error(`匯入失敗: ${error.message}`);
      } finally {
        setIsImportingFeatured(false);
        if (featuredJsonFileInputRef.current) {
          featuredJsonFileInputRef.current.value = "";
        }
      }
    };
    reader.readAsText(file);
  };

  const deleteSocratesData = async (
    dateKey: string,
    type: "strong" | "weak",
  ) => {
    if (!user) return;

    const currentDayData = socratesData[dateKey] || {};
    const updatedDayData = { ...currentDayData };
    delete updatedDayData[type];

    const path = `users/${user.uid}/socratesData/${dateKey}`;
    try {
      if (Object.keys(updatedDayData).length === 0) {
        // Remove document if no data left for this date
        await deleteDoc(doc(db, path));
        setSocratesData((prev) => {
          const newData = { ...prev };
          delete newData[dateKey];
          return newData;
        });
      } else {
        // Update document
        await setDoc(doc(db, path), updatedDayData);
        setSocratesData((prev) => ({
          ...prev,
          [dateKey]: updatedDayData,
        }));
      }

      toast.success(
        `已刪除 ${dateKey} ${type === "strong" ? "看漲名單" : "看跌名單"}資料`,
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path, user);
      toast.error("刪除失敗，請檢查權限或網路連接");
    }
  };

  const handleSocratesSort = (key: string) => {
    setSocratesSortConfig((prev) => {
      if (prev && prev.key === key && prev.direction === "desc") {
        return { key, direction: "asc" };
      }
      return { key, direction: "desc" };
    });
  };

  const getSortedSocratesData = (data: any[]) => {
    if (socratesSortConfig?.key === "customScore") {
      return [...data].sort((a, b) => {
        const getCrashScore = (val: any) => {
          if (val === "高") return 3;
          if (val === "中") return 2;
          if (val === "低") return 1;
          return Number(val) || 0;
        };
        const scoreA =
          Number(a.buyScore || 0) * socratesSortWeights.buyScore +
          Number(a.sellScore || 0) * socratesSortWeights.sellScore +
          Number(a.qualityScore || 0) * socratesSortWeights.qualityScore +
          Number(a.valueScore || 0) * socratesSortWeights.valueScore +
          getCrashScore(a.crashSimilarity) *
            socratesSortWeights.crashSimilarity;

        const scoreB =
          Number(b.buyScore || 0) * socratesSortWeights.buyScore +
          Number(b.sellScore || 0) * socratesSortWeights.sellScore +
          Number(b.qualityScore || 0) * socratesSortWeights.qualityScore +
          Number(b.valueScore || 0) * socratesSortWeights.valueScore +
          getCrashScore(b.crashSimilarity) *
            socratesSortWeights.crashSimilarity;

        return socratesSortConfig.direction === "asc"
          ? scoreA - scoreB
          : scoreB - scoreA;
      });
    }

    if (!socratesSortConfig) return data;
    return [...data].sort((a, b) => {
      if (a[socratesSortConfig.key] === undefined) return 1;
      if (b[socratesSortConfig.key] === undefined) return -1;

      let valA = a[socratesSortConfig.key];
      let valB = b[socratesSortConfig.key];

      // Attempt numerical comparison if both values are valid numbers or numeric strings
      if (
        valA !== null &&
        valB !== null &&
        valA !== "" &&
        valB !== "" &&
        !isNaN(Number(valA)) &&
        !isNaN(Number(valB))
      ) {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        // String comparison fallback
        valA = String(valA);
        valB = String(valB);
      }

      if (valA < valB) return socratesSortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return socratesSortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  const fetchedTabIdsRef = useRef<Set<string>>(new Set());
  const prevTabIdsStrRef = useRef<string>("");

  useEffect(() => {
    // Quick count of pending orders and fetch recent trades across all active tabs
    const fetchTabData = async () => {
      if (!user) return;

      const activeTabs = tabs.filter((t) => t.status === "ACTIVE");
      const currentTabIdsStr = activeTabs.map(t => t.id).sort().join(",");

      // If the set of active tabs changed, clear our fetched cache to reload fresh
      if (currentTabIdsStr !== prevTabIdsStrRef.current) {
        fetchedTabIdsRef.current.clear();
        prevTabIdsStrRef.current = currentTabIdsStr;
      }

      // 1. Separate priority and other tabs
      const priorityTabs = activeTabs.filter((t) => {
        return getDisplayHoldingStatus(t.holdingStatus) === activeHoldingSubTab;
      });
      const otherTabs = activeTabs.filter(
        (t) => getDisplayHoldingStatus(t.holdingStatus) !== activeHoldingSubTab
      );

      // Determine which ones actually need to be fetched (not in cache)
      const priorityToFetch = priorityTabs.filter(t => !fetchedTabIdsRef.current.has(t.id));
      const otherToFetch = otherTabs.filter(t => !fetchedTabIdsRef.current.has(t.id));

      const fetchSingleTab = async (tab: any) => {
        // Fetch pending orders
        const qOrders = query(
          collection(db, `stockTabs/${tab.id}/plannedOrders`),
          where("status", "==", "PENDING"),
        );
        const snapshotOrders = await getDocs(qOrders);
        const orders = snapshotOrders.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Fetch trades
        const qTrades = query(collection(db, `stockTabs/${tab.id}/trades`));
        const snapshotTrades = await getDocs(qTrades);
        const trades = snapshotTrades.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Fetch strategy
        const qStrategy = query(collection(db, `stockTabs/${tab.id}/strategy`));
        const snapshotStrategy = await getDocs(qStrategy);
        const mainStrategy = snapshotStrategy.docs.find((d) => d.id === "main");
        const strategy = mainStrategy ? mainStrategy.data() : null;

        return { id: tab.id, orders, trades, strategy };
      };

      // Helper to update state with loaded results maps
      const mergeResults = (results: any[]) => {
        setActiveTabOrders(prev => {
          const next = { ...prev };
          results.forEach(res => {
            next[res.id] = res.orders;
          });
          return next;
        });

        setActiveTabTrades(prev => {
          const next = { ...prev };
          results.forEach(res => {
            next[res.id] = res.trades;
          });
          return next;
        });

        setActiveTabStrategies(prev => {
          const next = { ...prev };
          results.forEach(res => {
            if (res.strategy) {
              next[res.id] = res.strategy;
            }
          });
          return next;
        });

        results.forEach(res => {
          fetchedTabIdsRef.current.add(res.id);
        });
      };

      // 2. Fetch priority tabs concurrently for speed!
      if (priorityToFetch.length > 0) {
        try {
          const priorityResults = await Promise.all(priorityToFetch.map(fetchSingleTab));
          mergeResults(priorityResults);
        } catch (err) {
          console.error("Error loading prioritised tab data:", err);
        }
      }

      // 3. Fetch remaining (other) tabs in the background after priority tabs have updated
      if (otherToFetch.length > 0) {
        setTimeout(async () => {
          try {
            const otherResults = await Promise.all(otherToFetch.map(fetchSingleTab));
            mergeResults(otherResults);
          } catch (err) {
            console.error("Error loading background tab data:", err);
          }
        }, 150); // small delay to allow active tab cards to draw flawlessly
      }
    };

    if (tabs.length > 0) {
      fetchTabData();
    }
  }, [tabs, user, activeHoldingSubTab]);

  // Alert detection logic
  useEffect(() => {
    const activeTabs = tabs.filter((t) => t.status === "ACTIVE");
    const detectedAlerts: any[] = [];

    activeTabs.forEach((tab) => {
      const currentPrice = tab.currentPrice;
      if (!currentPrice || !activeTabStrategies[tab.id]) return;

      const strategy = activeTabStrategies[tab.id];
      const stockAlerts: { category: string; price: number; label: string }[] =
        [];
      const threshold = 0.02; // 2% 提醒區間

      const checkAlert = (price: number, category: string, label: string) => {
        if (!price || price <= 0) return;
        const diff = Math.abs(currentPrice - price) / price;
        if (diff <= threshold) {
          stockAlerts.push({ category, price, label });
        }
      };

      // 止盈設定
      (strategy.tpTargets || []).forEach((tp: any, i: number) =>
        checkAlert(tp.price, "止盈設定", `止盈目標 ${i + 1}`),
      );

      // 止損設定
      (strategy.slTargets || []).forEach((sl: any, i: number) => {
        if (sl.price) {
          checkAlert(sl.price, "止損設定", `止損目標 ${i + 1}`);
        } else if (sl.percentage) {
          const stats = activeTabTrades[tab.id]
            ? calculateStats(activeTabTrades[tab.id])
            : { averagePrice: 0 };
          const avgPrice = stats.averagePrice || 0;
          if (avgPrice > 0) {
            const isShort = strategy.entries?.[0]?.type === "SELL";
            const changePct =
              sl.percentage > 0 ? -sl.percentage : sl.percentage;
            const calculatedPrice = isShort
              ? avgPrice * (1 - changePct / 100)
              : avgPrice * (1 + changePct / 100);
            checkAlert(
              calculatedPrice,
              "止損設定",
              `止損 % (${sl.percentage}%)`,
            );
          }
        }
      });

      // 分批進出場規劃
      (strategy.entries || []).forEach((entry: any, i: number) => {
        if (entry.priceStr) {
          if (entry.priceStr.includes("-")) {
            const [p1, p2] = entry.priceStr
              .split("-")
              .map((p: string) => parseFloat(p.trim()));
            if (!isNaN(p1))
              checkAlert(p1, "分批進出場", `規劃 P${i + 1} (區間低)`);
            if (!isNaN(p2))
              checkAlert(p2, "分批進出場", `規劃 P${i + 1} (區間高)`);
          } else {
            const p = parseFloat(entry.priceStr);
            if (!isNaN(p)) checkAlert(p, "分批進出場", `規劃價格 P${i + 1}`);
          }
        }
      });

      // 關鍵價格門檻
      (strategy.resistanceZones || []).forEach((zone: any, i: number) =>
        checkAlert(zone.price, "關鍵價格", `壓力區 ${i + 1}`),
      );
      (strategy.supportZones || []).forEach((zone: any, i: number) =>
        checkAlert(zone.price, "關鍵價格", `支撐區 ${i + 1}`),
      );

      if (stockAlerts.length > 0) {
        detectedAlerts.push({
          tab,
          stockAlerts,
        });
      }
    });

    setAlerts(detectedAlerts);
  }, [tabs, activeTabStrategies, activeTabTrades]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [selectedActionTab, setSelectedActionTab] = useState<any>(null);
  const [visualizerFocusTabId, setVisualizerFocusTabId] = useState<string | null>(null);
  const [visualizerFocusText, setVisualizerFocusText] = useState("");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const handleSearchSelect = useCallback(
    (tabId: string) => {
      setIsSearchOpen(false);
      setActiveViewTab("active");

      const selectedTab = tabs.find((t) => t.id === tabId);
      if (selectedTab) {
        setActiveHoldingSubTab(
          getDisplayHoldingStatus(selectedTab.holdingStatus),
        );
      }

      // Slight delay to ensure tab is switched
      setTimeout(() => {
        const element = document.getElementById(`stock-card-${tabId}`);
        if (element && carouselRef.current) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          // Flash effect or scale up feedback
          element.style.transform = "scale(1.05)";
          setTimeout(() => {
            element.style.transform = "";
          }, 1000);
        }
      }, 100);
    },
    [tabs],
  );

  const handleToggleTabHighlight = useCallback(
    async (tabId: string, currentStatus: boolean | undefined) => {
      if (!user) return;
      try {
        await updateDoc(doc(db, "stockTabs", tabId), {
          isFavoriteHighlight: !currentStatus,
          updatedAt: serverTimestamp(),
        });
        setIsActionDialogOpen(false);
        toast.success(!currentStatus ? "已加入重點關注" : "已取消重點關注");
      } catch (err) {
        console.error("Error updating tab highlight", err);
        toast.error("更新失敗");
      }
    },
    [user],
  );

  const handleImportLatestPrices = useCallback(async () => {
    if (!user) {
      toast.error("請先登入");
      return;
    }

    const currentActiveTabs = tabs.filter((t) => t.status === "ACTIVE");
    if (currentActiveTabs.length === 0) {
      toast.info("尚無持有中的股票");
      return;
    }

    setIsImportingPrices(true);
    toast.loading("正在抓取最新現價...", { id: "importPrices" });

    let updatedCount = 0;
    try {
      for (const tab of currentActiveTabs) {
        if (!tab.symbol) continue;

        try {
          const targetUrl = `/api/stock/${tab.symbol}`;

          let price = null;

          try {
            const response = await fetch(targetUrl);
            if (!response.ok) continue;

            const data = await response.json();
            const fetchedPrice =
              data?.chart?.result?.[0]?.meta?.regularMarketPrice;

            if (fetchedPrice && typeof fetchedPrice === "number") {
              price = fetchedPrice;
            }
          } catch (err) {
            console.warn(`Local API failed for ${tab.symbol}`, err);
          }

          if (price && typeof price === "number") {
            await updateDoc(doc(db, "stockTabs", tab.id), {
              currentPrice: price,
            });
            updatedCount++;
          }
        } catch (err) {
          console.error(`Failed to handle fetch for ${tab.symbol}`, err);
        }
      }

      if (updatedCount > 0) {
        toast.success(`成功更新 ${updatedCount} 筆股票現價！`, {
          id: "importPrices",
        });
      } else {
        toast.error("無法取得任何最新股票報價", { id: "importPrices" });
      }
    } catch (error) {
      console.error(error);
      toast.error("抓取現價時發生錯誤", { id: "importPrices" });
    } finally {
      setIsImportingPrices(false);
    }
  }, [user, tabs]);

  const handleToggleOrderHighlight = useCallback(
    async (
      tabId: string,
      orderId: string,
      currentStatus: boolean | undefined,
    ) => {
      if (!user) return;
      const path = `stockTabs/${tabId}/plannedOrders/${orderId}`;
      try {
        await updateDoc(doc(db, path), {
          isManualHighlight: !currentStatus,
        });
        // Local state update
        setActiveTabOrders((prev) => {
          const orders = prev[tabId] || [];
          const updatedOrders = orders.map((o) =>
            o.id === orderId ? { ...o, isManualHighlight: !currentStatus } : o,
          );
          return { ...prev, [tabId]: updatedOrders };
        });
      } catch (err) {
        console.error("Error updating highlight", err);
        toast.error("更新失敗");
      }
    },
    [user],
  );

  // Keyboard shortcuts handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA";
        
      if (isInput) return;

      // Shift + H for Fullscreen
      if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        (e.key === "H" || e.key === "h")
      ) {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.error(
              `Error attempting to enable full-screen mode: ${err.message}`,
            );
          });
        } else {
          document.exitFullscreen();
        }
        return;
      }

      // Shift + F for Search (Only if not Ctrl/Meta)
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.toUpperCase() === "F") {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Shift + A for Add Stock
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.toUpperCase() === "A") {
        e.preventDefault();
        setIsAddOpen(true);
        return;
      }

      // Shift + I for Import Latest Prices
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.toUpperCase() === "I") {
        e.preventDefault();
        handleImportLatestPrices();
        return;
      }

      // Shift + U for managing holding/active stocks
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.toUpperCase() === "U") {
        e.preventDefault();
        setIsManageHiddenOpen((prev) => !prev);
        return;
      }

      // Alt + 1/2/3/4/5/6 for Holding Sub Tabs
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        let selectedTab:
          | "觀察中"
          | "候選名單"
          | "買進操作"
          | "賣出操作"
          | "平倉操作"
          | "乖離名單"
          | null = null;
        if (e.code === "Digit1") selectedTab = "觀察中";
        else if (e.code === "Digit2") selectedTab = "候選名單";
        else if (e.code === "Digit3") selectedTab = "買進操作";
        else if (e.code === "Digit4") selectedTab = "賣出操作";
        else if (e.code === "Digit5") selectedTab = "平倉操作";
        else if (e.code === "Digit6") selectedTab = "乖離名單";

        if (selectedTab) {
          e.preventDefault();
          setActiveViewTab("active");
          setActiveHoldingSubTab(selectedTab);
          setTimeout(() => {
            const el = document.getElementById("active-cards-section");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 50);
          return;
        }
      }

      // Alt + Z for flipping visible stock cards
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "Z" || e.key === "z")
      ) {
        e.preventDefault();
        setFlippedCards((prev) => {
          const visibleIds = visibleTabsRef.current.map((t) => t.id);
          if (visibleIds.length === 0) return prev;

          const anyUnflipped = visibleIds.some((id) => !prev[id]);
          const targetState = anyUnflipped;
          const nextState = { ...prev };
          visibleIds.forEach((id) => {
            nextState[id] = targetState;
          });
          return nextState;
        });
        return;
      }

      // Shift + 1/2/3/4 for Navigation
      if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (e.code === "Digit1") {
          e.preventDefault();
          setActiveViewTab("active");
          const el = document.getElementById("active-cards-section");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (e.code === "Digit2") {
          e.preventDefault();
          setActiveViewTab("real");
          const el = document.getElementById("active-cards-section");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (e.code === "Digit3") {
          e.preventDefault();
          setActiveViewTab("completed");
        } else if (e.code === "Digit4") {
          e.preventDefault();
          setActiveViewTab("notes");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleImportLatestPrices]);

  const handleExportNotesJson = () => {
    if (!user) {
      toast.error("請先登入");
      return;
    }
    const activeList = tabs.filter((t) => t.status === "ACTIVE");
    if (activeList.length === 0) {
      toast.error("目前沒有持有中的個股可供匯出備註與計畫");
      return;
    }

    try {
      setIsExportingNotes(true);
      toast.loading("準備匯出個股操作備註與計畫...", { id: "export-notes" });

      const exportedNotes = activeList.map((tab) => {
        const strat = activeTabStrategies[tab.id] || {};
        return {
          symbol: tab.symbol,
          companyName: tab.companyName || "",
          notesHighlighted: strat.notesHighlighted || false,
          tpChecked: strat.tpChecked || false,
          slChecked: strat.slChecked || false,
          addChecked: strat.addChecked || false,
          closeChecked: strat.closeChecked || false,
          observeChecked: strat.observeChecked || false,
          operationFocus: strat.operationFocus || "",
          operationNote: strat.operationNote || "",
          entries: strat.entries || [],
          tpTargets: strat.tpTargets || [],
          slTargets: strat.slTargets || [],
          slConditions: strat.slConditions || "",
          strategyNotes: strat.strategyNotes || "",
          resistanceZones: strat.resistanceZones || [],
          supportZones: strat.supportZones || []
        };
      });

      const exportData = {
        backupDate: new Date().toISOString(),
        userId: user.uid,
        notes: exportedNotes
      };

      const backupJson = JSON.stringify(exportData, null, 2);
      const filename = `StockNotesBackup_${new Date().toISOString().split("T")[0]}_${Date.now()}.json`;

      const blob = new Blob([backupJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("個股操作備註與計畫匯出成功！已下載至本機", { id: "export-notes" });
    } catch (error: any) {
      console.error("Export errors:", error);
      toast.error(`匯出失敗: ${error?.message || "未知錯誤"}`, { id: "export-notes" });
    } finally {
      setIsExportingNotes(false);
    }
  };

  const handleImportNotesJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) {
      toast.error("請確認已登入且頁面正常載入");
      return;
    }

    try {
      setIsImportingNotes(true);
      toast.loading("正在解析個股操作備註備份檔案...", { id: "import-notes" });

      let backupData: any;
      try {
        const text = await file.text();
        backupData = JSON.parse(text);
      } catch (parseError: any) {
        console.error("JSON Parse Error:", parseError);
        throw new Error("檔案格式錯誤，無法解析 JSON");
      }

      let notesList: any[] = [];
      if (Array.isArray(backupData)) {
        notesList = backupData;
      } else if (backupData && Array.isArray(backupData.notes)) {
        notesList = backupData.notes;
      } else if (backupData && Array.isArray(backupData.stockTabs)) {
        // Also support full backup format if uploaded
        notesList = backupData.stockTabs.map((tab: any) => ({
          symbol: tab.symbol,
          ...(tab.strategy || {})
        }));
      } else {
        throw new Error("無效的備份檔案格式：找不到備註/notes 資料");
      }

      if (notesList.length === 0) {
        throw new Error("備份檔案中沒有任何個股備註資料");
      }

      toast.loading(`正在將備註與計畫匯入至 ${notesList.length} 筆資料中...`, {
        id: "import-notes",
      });

      const activeList = tabs.filter((t) => t.status === "ACTIVE");
      const updatedStrategies = { ...activeTabStrategies };
      let successCount = 0;

      for (const item of notesList) {
        if (!item || typeof item.symbol !== "string") continue;

        const matchedTab = activeList.find(
          (t) => t.symbol.toUpperCase() === item.symbol.toUpperCase()
        );

        if (matchedTab) {
          const tabId = matchedTab.id;
          const strategyRef = doc(db, `stockTabs/${tabId}/strategy`, "main");

          const strategyUpdate: any = {
            notesHighlighted: item.notesHighlighted !== undefined ? !!item.notesHighlighted : false,
            tpChecked: item.tpChecked !== undefined ? !!item.tpChecked : false,
            slChecked: item.slChecked !== undefined ? !!item.slChecked : false,
            addChecked: item.addChecked !== undefined ? !!item.addChecked : false,
            closeChecked: item.closeChecked !== undefined ? !!item.closeChecked : false,
            observeChecked: item.observeChecked !== undefined ? !!item.observeChecked : false,
            operationFocus: typeof item.operationFocus === "string" ? item.operationFocus : "",
            operationNote: typeof item.operationNote === "string" ? item.operationNote : "",
            entries: Array.isArray(item.entries) ? item.entries : [],
            tpTargets: Array.isArray(item.tpTargets) ? item.tpTargets : [],
            slTargets: Array.isArray(item.slTargets) ? item.slTargets : [],
            slConditions: typeof item.slConditions === "string" ? item.slConditions : "",
            strategyNotes: typeof item.strategyNotes === "string" ? item.strategyNotes : "",
            resistanceZones: Array.isArray(item.resistanceZones) ? item.resistanceZones : [],
            supportZones: Array.isArray(item.supportZones) ? item.supportZones : [],
            updatedAt: serverTimestamp()
          };

          await setDoc(strategyRef, strategyUpdate, { merge: true });

          updatedStrategies[tabId] = {
            ...(updatedStrategies[tabId] || {}),
            ...strategyUpdate,
            updatedAt: new Date()
          };

          successCount++;
        }
      }

      setActiveTabStrategies(updatedStrategies);
      toast.success(`成功為 ${successCount} 檔個股匯入備註與策略計畫！`, { id: "import-notes" });
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(`匯入失敗: ${error?.message || "未知錯誤"}`, { id: "import-notes" });
    } finally {
      setIsImportingNotes(false);
      if (notesJsonFileInputRef.current) {
        notesJsonFileInputRef.current.value = "";
      }
    }
  };

  const handleExportCompletedTabsJson = async () => {
    if (!user) {
      toast.error("請先登入");
      return;
    }
    const completedList = tabs.filter((t) => t.status === "COMPLETED");
    if (completedList.length === 0) {
      toast.error("目前沒有已完成的交易紀錄可供匯出");
      return;
    }

    try {
      setIsExportingCompleted(true);
      toast.loading("準備匯出已完成交易紀錄中...", { id: "export-completed" });

      const exportData: any = {
        backupDate: new Date().toISOString(),
        userId: user.uid,
        completedTabs: [],
      };

      for (const tab of completedList) {
        const tabData = {
          symbol: tab.symbol,
          companyName: tab.companyName || "",
          status: tab.status,
          isHidden: tab.isHidden || false,
          groupId: tab.groupId || "",
          sortOrder: tab.sortOrder !== undefined ? tab.sortOrder : 999999,
          tradeDirection: tab.tradeDirection || "看漲",
          holdingStatus: tab.holdingStatus || "平倉操作",
          finalPnL: tab.finalPnL || 0,
          currentPrice: tab.currentPrice || 0,
          tags: tab.tags || [],
          tradeType: tab.tradeType || "simulated",
          buyRate: tab.buyRate || 5,
          sellRate: tab.sellRate || 5,
          rating: tab.rating || 5,
          qualityScore: tab.qualityScore || 5,
          valueScore: tab.valueScore || 5,
          crashSimilarity: tab.crashSimilarity || 5,
          volatility: tab.volatility || "中等",
          shortTermImpact: tab.shortTermImpact || "觀察",
          longTermOutlook: tab.longTermOutlook || "觀察",
          isFavoriteHighlight: tab.isFavoriteHighlight || false,
          isOperationConfirmed: tab.isOperationConfirmed || false,
          isDeviationConfirmed: tab.isDeviationConfirmed || false,
          createdAt: tab.createdAt instanceof Timestamp ? tab.createdAt.toDate().toISOString() : (tab.createdAt && (tab.createdAt as any).seconds ? new Date((tab.createdAt as any).seconds * 1000).toISOString() : new Date().toISOString()),
          updatedAt: tab.updatedAt instanceof Timestamp ? tab.updatedAt.toDate().toISOString() : (tab.updatedAt && (tab.updatedAt as any).seconds ? new Date((tab.updatedAt as any).seconds * 1000).toISOString() : new Date().toISOString()),
          trades: [] as any[],
          plannedOrders: [] as any[],
          strategy: null as any,
          dailyReports: [] as any[],
        };

        // Fetch Trades
        const tradesSnapshot = await getDocs(
          collection(db, `stockTabs/${tab.id}/trades`),
        );
        tabData.trades = tradesSnapshot.docs.map((d) => {
          const t = d.data();
          return {
            type: t.type,
            purpose: t.purpose || "加碼",
            operator: t.operator || "人",
            price: t.price,
            quantity: t.quantity,
            tradeDate: t.tradeDate instanceof Timestamp ? t.tradeDate.toDate().toISOString() : (t.tradeDate && (t.tradeDate as any).seconds ? new Date((t.tradeDate as any).seconds * 1000).toISOString() : new Date().toISOString()),
            fees: t.fees || 0,
            notes: t.notes || "",
            createdAt: t.createdAt instanceof Timestamp ? t.createdAt.toDate().toISOString() : (t.createdAt && (t.createdAt as any).seconds ? new Date((t.createdAt as any).seconds * 1000).toISOString() : new Date().toISOString()),
          };
        });

        // Fetch Planned Orders
        const ordersSnapshot = await getDocs(
          collection(db, `stockTabs/${tab.id}/plannedOrders`),
        );
        tabData.plannedOrders = ordersSnapshot.docs.map((d) => {
          const o = d.data();
          return {
            direction: o.direction,
            purpose: o.purpose || "加碼",
            price: o.price,
            quantity: o.quantity,
            conditions: o.conditions || "",
            notes: o.notes || "",
            status: o.status || "PENDING",
            category: o.category || "分批進出場規劃",
            plannedDate: o.plannedDate instanceof Timestamp ? o.plannedDate.toDate().toISOString() : (o.plannedDate && (o.plannedDate as any).seconds ? new Date((o.plannedDate as any).seconds * 1000).toISOString() : null),
            createdAt: o.createdAt instanceof Timestamp ? o.createdAt.toDate().toISOString() : (o.createdAt && (o.createdAt as any).seconds ? new Date((o.createdAt as any).seconds * 1000).toISOString() : new Date().toISOString()),
          };
        });

        // Fetch Strategy
        const strategySnapshot = await getDocs(
          collection(db, `stockTabs/${tab.id}/strategy`),
        );
        const mainStrategy = strategySnapshot.docs.find((d) => d.id === "main");
        if (mainStrategy) {
          const s = mainStrategy.data();
          tabData.strategy = {
            entries: s.entries || [],
            tpTargets: s.tpTargets || [],
            slTargets: s.slTargets || [],
            slConditions: s.slConditions || "",
            strategyNotes: s.strategyNotes || "",
            operationNote: s.operationNote || "",
            resistanceZones: s.resistanceZones || [],
            supportZones: s.supportZones || [],
            updatedAt: s.updatedAt instanceof Timestamp ? s.updatedAt.toDate().toISOString() : (s.updatedAt && (s.updatedAt as any).seconds ? new Date((s.updatedAt as any).seconds * 1000).toISOString() : new Date().toISOString()),
          };
        }

        // Fetch Daily Reports
        const reportsSnapshot = await getDocs(
          collection(db, `stockTabs/${tab.id}/dailyReports`),
        );
        tabData.dailyReports = reportsSnapshot.docs.map((d) => {
          const r = d.data();
          return {
            date: r.date,
            summary: r.summary || "",
            score: r.score || 5,
            notes: r.notes || "",
            createdAt: r.createdAt instanceof Timestamp ? r.createdAt.toDate().toISOString() : (r.createdAt && (r.createdAt as any).seconds ? new Date((r.createdAt as any).seconds * 1000).toISOString() : new Date().toISOString()),
          };
        });

        exportData.completedTabs.push(tabData);
      }

      const backupJson = JSON.stringify(exportData, null, 2);
      const filename = `CompletedTradingBackup_${new Date().toISOString().split("T")[0]}_${Date.now()}.json`;

      const blob = new Blob([backupJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("已完成交易紀錄匯出成功！已下載至本機", { id: "export-completed" });
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(`匯出失敗: ${error?.message || "未知錯誤"}`, { id: "export-completed" });
    } finally {
      setIsExportingCompleted(false);
    }
  };

  const handleImportCompletedTabsJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Helper to recursively convert ISO strings to Firestore Timestamps
    const processData = (obj: any): any => {
      if (!obj || typeof obj !== "object" || obj instanceof Timestamp)
        return obj;

      if (Array.isArray(obj)) {
        return obj.map((item) => processData(item));
      }

      if (
        obj.type === "firestore/timestamp/1.0" &&
        typeof obj.seconds === "number" &&
        typeof obj.nanoseconds === "number"
      ) {
        return new Timestamp(obj.seconds, obj.nanoseconds);
      }

      const newObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (
          typeof value === "string" &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
        ) {
          newObj[key] = Timestamp.fromDate(new Date(value));
        } else {
          newObj[key] = processData(value);
        }
      }
      return newObj;
    };

    try {
      setIsImportingCompleted(true);
      toast.loading("正在解析已完成交易紀錄備份檔案...", { id: "import-completed" });

      let backupData: any;
      try {
        const text = await file.text();
        backupData = JSON.parse(text);
      } catch (parseError: any) {
        console.error("JSON Parse Error:", parseError);
        throw new Error("檔案格式錯誤，無法解析 JSON");
      }

      const rawTabs = backupData.completedTabs || backupData.stockTabs;

      if (!rawTabs || !Array.isArray(rawTabs)) {
        throw new Error("無效的備份檔案內容：找不到交易紀錄/stockTabs 資料");
      }

      toast.loading(`正在匯入 ${rawTabs.length} 筆已完成交易資料...`, {
        id: "import-completed",
      });

      let count = 0;
      for (const rawTabData of rawTabs) {
        try {
          const tabData = processData(rawTabData);
          const { trades, plannedOrders, strategy, dailyReports, id, ...rest } =
            tabData;

          if (!rest.symbol) {
            console.warn("Skipping tab without symbol:", tabData);
            continue;
          }

          // Force status to COMPLETED
          rest.status = "COMPLETED";

          // Generate a brand new document reference to avoid overwrites
          const newTabRef = doc(collection(db, "stockTabs"));
          const newId = newTabRef.id;

          await setDoc(newTabRef, {
            ...rest,
            userId: user.uid,
            createdAt: rest.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Restore Trades
          if (Array.isArray(trades)) {
            for (const trade of trades) {
              const { id: tradeId, ...tradeRest } = trade;
              const newTradeRef = doc(collection(db, `stockTabs/${newId}/trades`));
              await setDoc(newTradeRef, {
                ...tradeRest,
                createdAt: tradeRest.createdAt || serverTimestamp(),
              });
            }
          }

          // Restore Planned Orders
          if (Array.isArray(plannedOrders)) {
            for (const order of plannedOrders) {
              const { id: orderId, ...orderRest } = order;
              const newOrderRef = doc(collection(db, `stockTabs/${newId}/plannedOrders`));
              await setDoc(newOrderRef, {
                ...orderRest,
                createdAt: orderRest.createdAt || serverTimestamp(),
              });
            }
          }

          // Restore Strategy
          if (strategy) {
            const { id: strategyId, ...strategyRest } = strategy;
            await setDoc(
              doc(db, `stockTabs/${newId}/strategy`, "main"),
              {
                ...strategyRest,
                updatedAt: serverTimestamp(),
              }
            );
          }

          // Restore Daily Reports
          if (Array.isArray(dailyReports)) {
            for (const report of dailyReports) {
              const { id: reportId, ...reportRest } = report;
              const newReportRef = doc(collection(db, `stockTabs/${newId}/dailyReports`));
              await setDoc(newReportRef, {
                ...reportRest,
                createdAt: reportRest.createdAt || serverTimestamp(),
              });
            }
          }

          count++;
        } catch (tabError: any) {
          console.error("Failed to restore completed tab:", tabError);
        }
      }

      toast.success(`成功匯入 ${count} 筆已完成交易紀錄！`, { id: "import-completed" });
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(`匯入失敗: ${error?.message || "未知錯誤"}`, { id: "import-completed" });
    } finally {
      setIsImportingCompleted(false);
      if (completedJsonFileInputRef.current) {
        completedJsonFileInputRef.current.value = "";
      }
    }
  };

  const handleExportLocal = async () => {
    if (!user) {
      toast.error("請先登入");
      return;
    }
    try {
      setIsExporting(true);
      toast.loading("準備備份資料中...", { id: "export" });

      const exportData: any = {
        backupDate: new Date().toISOString(),
        userId: user.uid,
        stockTabs: [],
      };

      const q = query(
        collection(db, "stockTabs"),
        where("userId", "==", user.uid),
      );
      const tabsSnapshot = await getDocs(q);

      for (const docSnap of tabsSnapshot.docs) {
        const tabData = {
          id: docSnap.id,
          ...(docSnap.data() as any),
          trades: [],
          plannedOrders: [],
          strategy: null,
          dailyReports: [],
        };

        // Fetch Trades
        const tradesSnapshot = await getDocs(
          collection(db, `stockTabs/${docSnap.id}/trades`),
        );
        tabData.trades = tradesSnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Fetch Planned Orders
        const ordersSnapshot = await getDocs(
          collection(db, `stockTabs/${docSnap.id}/plannedOrders`),
        );
        tabData.plannedOrders = ordersSnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Fetch Strategy
        const strategySnapshot = await getDocs(
          collection(db, `stockTabs/${docSnap.id}/strategy`),
        );
        const mainStrategy = strategySnapshot.docs.find((d) => d.id === "main");
        if (mainStrategy) {
          tabData.strategy = { id: mainStrategy.id, ...mainStrategy.data() };
        }

        // Fetch Daily Reports
        const reportsSnapshot = await getDocs(
          collection(db, `stockTabs/${docSnap.id}/dailyReports`),
        );
        tabData.dailyReports = reportsSnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        exportData.stockTabs.push(tabData);
      }

      // 3. Fetch Socrates Data
      const socratesSnapshot = await getDocs(
        query(collection(db, `users/${user.uid}/socratesData`)),
      );
      exportData.socratesData = socratesSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const backupJson = JSON.stringify(exportData, null, 2);
      const filename = `TradingBackup_${new Date().toISOString().split("T")[0]}_${Date.now()}.json`;

      const blob = new Blob([backupJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("備份成功！已下載至本機", { id: "export" });
    } catch (error: any) {
      console.error("Export error:", error);
      const msg = error?.message || "未知錯誤";
      toast.error(`匯出失敗: ${msg}`, { id: "export" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (
      !window.confirm(
        "如果您繼續，將會清空目前的資料並由備份檔取代。此動作無法還原，確定要執行嗎？",
      )
    ) {
      e.target.value = "";
      return;
    }

    // Helper to recursively convert ISO strings to Firestore Timestamps
    const processData = (obj: any): any => {
      if (!obj || typeof obj !== "object" || obj instanceof Timestamp)
        return obj;

      if (Array.isArray(obj)) {
        return obj.map((item) => processData(item));
      }

      // Handle Firestore Timestamp JSON representation
      if (
        obj.type === "firestore/timestamp/1.0" &&
        typeof obj.seconds === "number" &&
        typeof obj.nanoseconds === "number"
      ) {
        return new Timestamp(obj.seconds, obj.nanoseconds);
      }

      const newObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Handle common date fields in ISO format
        if (
          typeof value === "string" &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
        ) {
          newObj[key] = Timestamp.fromDate(new Date(value));
        } else {
          newObj[key] = processData(value);
        }
      }
      return newObj;
    };

    try {
      setIsImporting(true);
      console.log("Import process started...");
      toast.loading("正在解析備份檔案...", { id: "import" });

      let backupData: any;
      try {
        const text = await file.text();
        backupData = JSON.parse(text);
      } catch (parseError: any) {
        console.error("JSON Parse Error:", parseError);
        throw new Error("備份檔案格式錯誤，無法解析 JSON");
      }

      if (
        !backupData ||
        !backupData.stockTabs ||
        !Array.isArray(backupData.stockTabs)
      ) {
        throw new Error("無效的備份檔案內容：找不到 stockTabs 資料");
      }

      console.log(`Found ${backupData.stockTabs.length} tabs to restore.`);
      toast.loading("正在清理舊資料...", { id: "import" });

      // 1. Find all user tabs
      const q = query(
        collection(db, "stockTabs"),
        where("userId", "==", user.uid),
      );
      const oldTabs = await getDocs(q);

      console.log(`Deleting ${oldTabs.size} existing tabs...`);
      // Clean up subcollections for each old tab
      for (const oldTab of oldTabs.docs) {
        const docId = oldTab.id;
        try {
          const subCollections = [
            "trades",
            "plannedOrders",
            "strategy",
            "dailyReports",
          ];
          for (const sub of subCollections) {
            const snap = await getDocs(
              collection(db, `stockTabs/${docId}/${sub}`),
            );
            for (const d of snap.docs) await deleteDoc(d.ref);
          }
          await deleteDoc(oldTab.ref);
        } catch (delError: any) {
          console.warn(`Failed to clean up tab ${docId}:`, delError);
        }
      }

      // Cleanup Socrates Data
      console.log("Cleaning up Socrates data...");
      const socratesSnap = await getDocs(
        query(collection(db, `users/${user.uid}/socratesData`)),
      );
      for (const d of socratesSnap.docs) await deleteDoc(d.ref);

      toast.loading(`正在還原 ${backupData.stockTabs.length} 筆個股資料...`, {
        id: "import",
      });

      // 2. Import new tabs
      let count = 0;
      for (const rawTabData of backupData.stockTabs) {
        try {
          const tabData = processData(rawTabData);
          const { trades, plannedOrders, strategy, dailyReports, id, ...rest } =
            tabData;

          if (!rest.symbol) {
            console.warn("Skipping tab without symbol:", tabData);
            continue;
          }

          console.log(
            `Restoring tab [${++count}/${backupData.stockTabs.length}]: ${rest.symbol} (${id})`,
          );

          // Restore tab
          await setDoc(doc(db, "stockTabs", id), {
            ...rest,
            userId: user.uid,
            updatedAt: serverTimestamp(),
          });

          // Restore Trades
          if (Array.isArray(trades)) {
            for (const trade of trades) {
              const { id: tradeId, ...tradeRest } = trade;
              await setDoc(
                doc(db, `stockTabs/${id}/trades`, tradeId),
                tradeRest,
              );
            }
          }

          // Restore Planned Orders
          if (Array.isArray(plannedOrders)) {
            for (const order of plannedOrders) {
              const { id: orderId, ...orderRest } = order;
              await setDoc(
                doc(db, `stockTabs/${id}/plannedOrders`, orderId),
                orderRest,
              );
            }
          }

          // Restore Strategy
          if (strategy) {
            const { id: strategyId, ...strategyRest } = strategy;
            await setDoc(
              doc(db, `stockTabs/${id}/strategy`, strategyId),
              strategyRest,
            );
          }

          // Restore Daily Reports
          if (Array.isArray(dailyReports)) {
            for (const report of dailyReports) {
              const { id: reportId, ...reportRest } = report;
              await setDoc(
                doc(db, `stockTabs/${id}/dailyReports`, reportId),
                reportRest,
              );
            }
          }
        } catch (tabError: any) {
          console.error(
            `Failed to restore tab ${rawTabData.symbol || "unknown"}:`,
            tabError,
          );
          throw new Error(
            `還原個股 ${rawTabData.symbol || "未知"} 時發生權限或格式錯誤: ${tabError.message}`,
          );
        }
      }

      // 3. Import Socrates Data
      if (Array.isArray(backupData.socratesData)) {
        console.log(
          `Restoring ${backupData.socratesData.length} Socrates records...`,
        );
        for (const rawSoc of backupData.socratesData) {
          const soc = processData(rawSoc);
          const { id: dateKey, ...socData } = soc;
          await setDoc(
            doc(db, `users/${user.uid}/socratesData`, dateKey),
            socData,
          );
        }
      }

      console.log("Restoration completed successfully.");
      toast.success("資料還原成功！系統將在 1.5 秒後重新整理", {
        id: "import",
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error("Import process failed:", error);
      toast.error(`還原失敗: ${error.message}`, { id: "import" });
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = "";
    }
  };

  const activeTabs = tabs.filter((t) => t.status === "ACTIVE");

  const totalRealHoldingCost = useMemo(() => {
    return activeTabs
      .filter((tab) => tab.tradeType === "real")
      .reduce((sum, tab) => {
        const trades = activeTabTrades[tab.id] || [];
        const stats = calculateStats(trades, tab.currentPrice);
        return sum + (stats.totalQuantity * stats.averagePrice);
      }, 0);
  }, [activeTabs, activeTabTrades]);

  const remainingBalance = totalCapital - totalRealHoldingCost;

  const visibleActiveTabs = activeTabs.filter((t) => !t.isHidden);
  const hiddenActiveTabs = activeTabs.filter((t) => t.isHidden);

  const filledCategories = useMemo(() => {
    const allCats = ["觀察中", "候選名單", "買進操作", "賣出操作", "平倉操作", "乖離名單"] as const;
    return allCats.filter(cat => 
      visibleActiveTabs.some(t => getDisplayHoldingStatus(t.holdingStatus) === cat)
    );
  }, [visibleActiveTabs]);

  const effectiveActiveTabs = useMemo(() => {
    if (activeViewTab === "real") {
      return activeTabs.filter((t) => t.tradeType === "real");
    }
    if (activeViewTab === "active") {
      return activeTabs.filter((t) => t.tradeType === "simulated");
    }
    return activeTabs;
  }, [activeTabs, activeViewTab]);

  const effectiveVisibleActiveTabs = useMemo(() => {
    if (activeViewTab === "real") {
      return visibleActiveTabs.filter((t) => t.tradeType === "real");
    }
    if (activeViewTab === "active") {
      return visibleActiveTabs.filter((t) => t.tradeType === "simulated");
    }
    return visibleActiveTabs;
  }, [visibleActiveTabs, activeViewTab]);

  const effectiveHiddenActiveTabs = useMemo(() => {
    if (activeViewTab === "real") {
      return hiddenActiveTabs.filter((t) => t.tradeType === "real");
    }
    if (activeViewTab === "active") {
      return hiddenActiveTabs.filter((t) => t.tradeType === "simulated");
    }
    return hiddenActiveTabs;
  }, [hiddenActiveTabs, activeViewTab]);

  const visibleSubTabs = useMemo(() => {
    const list = [
      "觀察中",
      "候選名單",
      "買進操作",
      "賣出操作",
      "平倉操作",
      "乖離名單",
    ] as const;
    return list.filter((tab) => {
      const tabCount = effectiveVisibleActiveTabs.filter(
        (t) => getDisplayHoldingStatus(t.holdingStatus) === tab,
      ).length;
      return tabCount > 0;
    });
  }, [effectiveVisibleActiveTabs]);

  // Adjust active sub tab if the current one has no cards & other active sub tabs are available
  useEffect(() => {
    if (visibleSubTabs.length > 0 && !visibleSubTabs.includes(activeHoldingSubTab)) {
      setActiveHoldingSubTab(visibleSubTabs[0]);
    }
  }, [visibleSubTabs, activeHoldingSubTab]);

  // further categorize visible tabs based on holdingStatus for rendering
  const currentSubTabVisibleTabs = effectiveVisibleActiveTabs.filter(
    (t) => getDisplayHoldingStatus(t.holdingStatus) === activeHoldingSubTab,
  );

  // Automatically reset card definition filter if it has no items in the active sub tab
  useEffect(() => {
    if (activeCardDefinitionFilter !== "all" && currentSubTabVisibleTabs) {
      const counts: Record<string, number> = {
        highlight: currentSubTabVisibleTabs.filter(t => !!t.isFavoriteHighlight).length,
        operation: currentSubTabVisibleTabs.filter(t => !!t.isOperationConfirmed).length,
        deviation: currentSubTabVisibleTabs.filter(t => !!t.isDeviationConfirmed).length,
        group: currentSubTabVisibleTabs.filter(t => !!t.groupId).length,
      };
      if (counts[activeCardDefinitionFilter] === 0) {
        setActiveCardDefinitionFilter("all");
      }
    }
  }, [currentSubTabVisibleTabs, activeCardDefinitionFilter]);

  const filteredSubTabVisibleTabs = useMemo(() => {
    switch (activeCardDefinitionFilter) {
      case "highlight":
        return currentSubTabVisibleTabs.filter(t => !!t.isFavoriteHighlight);
      case "operation":
        return currentSubTabVisibleTabs.filter(t => !!t.isOperationConfirmed);
      case "deviation":
        return currentSubTabVisibleTabs.filter(t => !!t.isDeviationConfirmed);
      case "group":
        return currentSubTabVisibleTabs.filter(t => !!t.groupId);
      default:
        return currentSubTabVisibleTabs;
    }
  }, [currentSubTabVisibleTabs, activeCardDefinitionFilter]);

  visibleTabsRef.current = filteredSubTabVisibleTabs;

  // Active Card Tab & Sliding Indicator state for desktop carousel
  const [activeCardTabId, setActiveCardTabId] = useState<string | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (filteredSubTabVisibleTabs.length > 0) {
      const exists = filteredSubTabVisibleTabs.some(t => t.id === activeCardTabId);
      if (!exists) {
        setActiveCardTabId(filteredSubTabVisibleTabs[0].id);
      }
    } else {
      setActiveCardTabId(null);
    }
  }, [filteredSubTabVisibleTabs, activeCardTabId]);

  const lastActiveCardTabId = useRef<string | null>(null);
  useEffect(() => {
    if (activeCardTabId && lastActiveCardTabId.current && activeCardTabId !== lastActiveCardTabId.current) {
      playSwipeSound();
    }
    lastActiveCardTabId.current = activeCardTabId;
  }, [activeCardTabId]);

  useEffect(() => {
    const updateIndicator = () => {
      const activeId = activeCardTabId || (filteredSubTabVisibleTabs.length > 0 ? filteredSubTabVisibleTabs[0].id : null);
      if (activeId) {
        const el = tabRefs.current[activeId];
        if (el) {
          setIndicatorStyle({
            left: el.offsetLeft,
            width: el.offsetWidth,
          });

          // Smoothly scroll the tabs bar container to keep the active tab visible
          const container = el.parentElement;
          if (container) {
            const containerScrollLeft = container.scrollLeft;
            const containerWidth = container.clientWidth;
            const elLeft = el.offsetLeft;
            const elWidth = el.offsetWidth;
            
            if (elLeft < containerScrollLeft) {
              container.scrollTo({ left: elLeft - 24, behavior: "smooth" });
            } else if (elLeft + elWidth > containerScrollLeft + containerWidth) {
              container.scrollTo({ left: elLeft + elWidth - containerWidth + 24, behavior: "smooth" });
            }
          }
        }
      }
    };

    const animId = requestAnimationFrame(updateIndicator);
    window.addEventListener("resize", updateIndicator);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeCardTabId, filteredSubTabVisibleTabs]);

  const handleCarouselScroll = () => {
    if (isProgrammaticScrollRef.current) return;
    const carousel = carouselRef.current;
    if (!carousel || filteredSubTabVisibleTabs.length === 0) return;
    
    const containerRect = carousel.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    
    let closestTabId = null;
    let minDistance = Infinity;
    
    filteredSubTabVisibleTabs.forEach((tab) => {
      const el = document.getElementById(`stock-card-${tab.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const distance = Math.abs(cardCenter - containerCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestTabId = tab.id;
        }
      }
    });
    
    if (closestTabId && closestTabId !== activeCardTabId) {
      setActiveCardTabId(closestTabId);
    }
  };

  const handleTabIndicatorClick = (tabId: string) => {
    setActiveCardTabId(tabId);
    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimeoutRef.current) {
      clearTimeout(programmaticScrollTimeoutRef.current);
    }
    programmaticScrollTimeoutRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 800);

    const cardElement = document.getElementById(`stock-card-${tabId}`);
    if (cardElement && carouselRef.current) {
      cardElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  };

  const renderGroups = useMemo(() => {
    const groups: { isGroup: boolean; id: string; tabs: any[] }[] = [];
    const processedGroupIds = new Set<string>();
    
    filteredSubTabVisibleTabs.forEach((tab) => {
      const shouldGroup = tab.groupId && !isMobile;
      if (shouldGroup) {
        if (!processedGroupIds.has(tab.groupId!)) {
          processedGroupIds.add(tab.groupId!);
          const allGroupTabs = effectiveVisibleActiveTabs.filter(t => t.groupId === tab.groupId);
          groups.push({
            isGroup: true,
            id: tab.groupId!,
            tabs: allGroupTabs
          });
        }
      } else {
        groups.push({
          isGroup: false,
          id: tab.id,
          tabs: [tab]
        });
      }
    });
    return groups;
  }, [filteredSubTabVisibleTabs, effectiveVisibleActiveTabs, isMobile]);

  const completedTabs = tabs.filter((t) => t.status === "COMPLETED");

  const handleSmartSuggestion = async (tab: any) => {
    if (!tab) return;

    setIsGeneratingSuggestion(true);
    toast.loading("AI 正在動態分析並更新策略...", {
      id: "ai-smart-suggestion",
    });

    try {
      // Fetch the strategy
      const strategyDocRef = doc(db, `stockTabs/${tab.id}/strategy`, 'main');
      const strategySnap = await getDoc(strategyDocRef);
      const strategyData = strategySnap.exists() ? strategySnap.data() : { entries: [], tpTargets: [], slTargets: [], slConditions: "", resistanceZones: [], supportZones: [] };

      const response = await fetch("/api/generate-operation-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: tab.symbol,
          currentPrice: tab.currentPrice,
          rating: tab.rating,
          qualityScore: tab.qualityScore,
          valueScore: tab.valueScore,
          crashSimilarity: tab.crashSimilarity,
          buyRate: tab.buyRate,
          sellRate: tab.sellRate,
          volatility: tab.volatility,
          strategyData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "伺服器請求失敗");
      }

      const result = await response.json();
      const resultText = result.text;

      // Update the strategy with the new operationNote
      function stripUndefined(obj: any): any {
        if (obj === null || obj === undefined) return obj;
        if (Array.isArray(obj)) {
          return obj.map(stripUndefined);
        }
        if (typeof obj === 'object') {
          if (obj.constructor && obj.constructor.name !== 'Object') return obj;
          const newObj: any = {};
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
              newObj[key] = stripUndefined(obj[key]);
            }
          }
          return newObj;
        }
        return obj;
      }

      const updatedStrategy = { ...strategyData, operationNote: resultText, updatedAt: serverTimestamp() };
      const sanitizedData = stripUndefined(updatedStrategy);

      await setDoc(doc(db, `stockTabs/${tab.id}/strategy`, 'main'), sanitizedData, { merge: true });

      toast.success("AI 已產生並更新策略建議", { id: "ai-smart-suggestion" });
      setIsActionDialogOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "AI 產生失敗，請稍後再試", { id: "ai-smart-suggestion" });
    } finally {
      setIsGeneratingSuggestion(false);
    }
  };

  const toggleTabGroup = async (tab: any) => {
    if (tab.groupId) {
      try {
        await updateTab(tab.id, { groupId: "" });
        toast.success("已解除區塊連動");
      } catch (e) {
        toast.error("解除連動失敗");
      }
    } else {
      setGroupingTabId(tab.id);
    }
  };

  const handleGroupWith = async (sourceTabId: string, targetTab: any) => {
    const sourceTab = tabs.find(t => t.id === sourceTabId);
    if (!sourceTab) return;
    
    const existingGroup = targetTab.groupId;
    const newGroupId = existingGroup || sourceTab.symbol + '-' + Date.now();
    
    try {
      if (!existingGroup) {
         await updateTab(targetTab.id, { groupId: newGroupId });
      }
      await updateTab(sourceTabId, { groupId: newGroupId });
      toast.success("已成功連動區塊");
      setGroupingTabId(null);
    } catch (e) {
      toast.error("連動失敗");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center font-mono">
        載入中...
      </div>
    );
  }

  const moveTabUp = async (index: number, list: any[] = effectiveActiveTabs) => {
    if (index <= 0) return;
    const currentTab = list[index];
    const prevTab = list[index - 1];
    const newTabs = [...activeTabs];
    const globalIdxCurrent = newTabs.findIndex(t => t.id === currentTab.id);
    const globalIdxPrev = newTabs.findIndex(t => t.id === prevTab.id);
    if (globalIdxCurrent !== -1 && globalIdxPrev !== -1) {
      const temp = newTabs[globalIdxCurrent];
      newTabs[globalIdxCurrent] = newTabs[globalIdxPrev];
      newTabs[globalIdxPrev] = temp;
      const updates = newTabs.map((tab, idx) => ({ id: tab.id, sortOrder: idx }));
      await updateTabOrder(updates);
    }
  };

  const moveTabDown = async (index: number, list: any[] = effectiveActiveTabs) => {
    if (index >= list.length - 1) return;
    const currentTab = list[index];
    const nextTab = list[index + 1];
    const newTabs = [...activeTabs];
    const globalIdxCurrent = newTabs.findIndex(t => t.id === currentTab.id);
    const globalIdxNext = newTabs.findIndex(t => t.id === nextTab.id);
    if (globalIdxCurrent !== -1 && globalIdxNext !== -1) {
      const temp = newTabs[globalIdxCurrent];
      newTabs[globalIdxCurrent] = newTabs[globalIdxNext];
      newTabs[globalIdxNext] = temp;
      const updates = newTabs.map((tab, idx) => ({ id: tab.id, sortOrder: idx }));
      await updateTabOrder(updates);
    }
  };

  const realCompletedTabs = completedTabs.filter((t) => t.tradeType === "real");
  const totalCompletedPnL = realCompletedTabs.reduce(
    (acc, tab) => acc + (tab.finalPnL || 0),
    0,
  );
  const simulatedCompletedPnL = completedTabs
    .filter((tab) => tab.tradeType === "simulated")
    .reduce((acc, tab) => acc + (tab.finalPnL || 0), 0);

  const realWinningTrades = realCompletedTabs.filter(
    (t) => (t.finalPnL || 0) > 0,
  );
  const realWinRate =
    realCompletedTabs.length > 0
      ? ((realWinningTrades.length / realCompletedTabs.length) * 100).toFixed(1)
      : 0;

  const simulatedCompletedTabs = completedTabs.filter(
    (t) => t.tradeType === "simulated",
  );
  const simulatedWinningTrades = simulatedCompletedTabs.filter(
    (t) => (t.finalPnL || 0) > 0,
  );
  const simulatedWinRate =
    simulatedCompletedTabs.length > 0
      ? (
          (simulatedWinningTrades.length / simulatedCompletedTabs.length) *
          100
        ).toFixed(1)
      : 0;

  // Neo-brutalist card variants
  const cardVariants = {
    rest: {
      scale: 1,
      y: 0,
      opacity: 0.9,
      filter: "brightness(1) drop-shadow(0 4px 6px rgba(0,0,0,0.1))",
    },
    hover: {
      scale: 1.02,
      y: -4,
      opacity: 1,
      filter: "brightness(1.1) drop-shadow(0 20px 25px rgba(0,0,0,0.3))",
      transition: { type: "spring", stiffness: 400, damping: 25 },
    },
  };

  return (
    <div className="w-full pb-12 mt-0 transition-all duration-300">
      {/* 1. Full-width Green Ribbon Header (Desktop: sm and above) */}
      <ScrollIn className="hidden sm:block">
        <div className="-mx-2 sm:-mx-4 md:-mx-6 bg-[#085041] text-white pt-[18px] pb-[20px] px-5 sm:px-6 md:px-8 flex flex-col gap-4 text-left border-none rounded-none shadow-none relative z-10 select-none">
          <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            {/* Left section: Portfolio Overview badge & Title */}
            <div className="flex flex-col text-left">
              <div className="flex justify-between items-center w-full lg:w-auto gap-3">
                <span className="px-2.5 py-1 text-[10px] tracking-[0.07em] font-bold text-[#9FE1CB] bg-white/10 rounded-full uppercase">
                  PORTFOLIO OVERVIEW
                </span>
                <button
                  onClick={logout}
                  className="block lg:hidden text-white/60 hover:text-white transition-colors p-1"
                  title="登出"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex items-center gap-1.5 mt-2">
                <h1 className="text-[20px] sm:text-[24px] font-bold text-white leading-none">
                  交易總覽
                </h1>
                <button
                  onClick={() => setIsHelpOpen(true)}
                  className="text-white/40 hover:text-white/70 transition-colors p-1"
                  title="快捷鍵一覽"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Middle section: 3 Indicators */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 md:gap-8 bg-black/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/5 w-full lg:w-auto">
              {/* Metric 1: Total Capital */}
              <div className="flex flex-col text-left">
                <span className="text-[11px] text-[#9FE1CB] font-medium opacity-80">目前的總資金</span>
                {isEditingCapital ? (
                  <div className="flex items-center gap-0.5 mt-1">
                    <span className="text-[15px] sm:text-[16px] font-semibold text-white">$</span>
                    <input
                      type="number"
                      autoFocus
                      value={editCapitalVal}
                      onBlur={() => {
                        const val = editCapitalVal === "" ? 0 : parseFloat(editCapitalVal);
                        handleUpdateTotalCapital(val);
                        setIsEditingCapital(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = editCapitalVal === "" ? 0 : parseFloat(editCapitalVal);
                          handleUpdateTotalCapital(val);
                          setIsEditingCapital(false);
                        }
                      }}
                      onChange={(e) => setEditCapitalVal(e.target.value)}
                      className="bg-transparent text-white font-semibold text-[15px] sm:text-[16px] focus:outline-none w-20 border-none p-0 focus:ring-0 leading-none h-5"
                      style={{ caretColor: 'white' }}
                    />
                  </div>
                ) : (
                  <div 
                    onClick={() => {
                      setEditCapitalVal(totalCapital.toString());
                      setIsEditingCapital(true);
                    }}
                    className="text-[15px] sm:text-[16px] font-semibold text-white cursor-pointer select-none leading-none mt-1 flex items-center gap-1 group/cap"
                    title="點擊修改總資金"
                  >
                    <span>${totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-[9px] text-white/30 group-hover/cap:text-white/60 transition-colors">(修改)</span>
                  </div>
                )}
              </div>

              {/* Vertical divider */}
              <div className="hidden sm:block h-6 w-[0.5px] bg-white/20" />

              {/* Metric 2: Remaining Balance */}
              <div className="flex flex-col text-left">
                <span className="text-[11px] text-[#9FE1CB] font-medium opacity-80">剩餘額度</span>
                <span className="text-[15px] sm:text-[16px] font-semibold font-mono text-white mt-1 leading-none">
                  ${remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Vertical divider */}
              <div className="hidden sm:block h-6 w-[0.5px] bg-white/20" />

              {/* Metric 3: Real Cost */}
              <div className="flex flex-col text-left">
                <span className="text-[11px] text-[#9FE1CB] font-medium opacity-80">真實交易總持有成本</span>
                <span className="text-[15px] sm:text-[16px] font-semibold font-mono text-white mt-1 leading-none">
                  ${totalRealHoldingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Right section: Actions & Logout */}
            <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end sm:justify-start">
              <button
                onClick={() => setIsAddOpen(true)}
                className="flex-1 lg:flex-initial px-4 py-2.5 lg:py-2 bg-transparent hover:bg-white/10 text-white border border-white/20 rounded-xl text-[13px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <span>＋ 新增股票</span>
              </button>

              <button
                onClick={handleImportLatestPrices}
                disabled={isImportingPrices || !user}
                className="flex-1 lg:flex-initial px-4 py-2.5 lg:py-2 bg-transparent hover:bg-white/10 text-white border border-white/20 rounded-xl text-[13px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <span>↻ 匯入最新現價</span>
              </button>

              <button
                onClick={logout}
                className="hidden lg:block text-white/60 hover:text-white transition-colors p-2 rounded-lg"
                title="登出"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </ScrollIn>

      {/* 2. Mobile-only Compact Investment Portfolio Card Section */}
      <ScrollIn className="block sm:hidden my-4 px-3">
        <div className="w-full max-w-[340px] mx-auto bg-transparent rounded-[32px] select-none">
          {/* Header section (rich deep green background: bg-[#084D38]) */}
          <div className="bg-[#084D38] p-6 pb-6 text-left flex flex-col gap-3 relative rounded-t-[32px]">
            {/* Top row: small pill badge "PORTFOLIO OVERVIEW" | logout icon on the right */}
            <div className="flex items-center justify-between w-full">
              <span className="px-3 py-1.5 text-[10px] tracking-[0.06em] font-medium text-[#9FE1CB] bg-white/10 rounded-full uppercase leading-none">
                PORTFOLIO OVERVIEW
              </span>
              <button
                onClick={logout}
                className="text-white/80 hover:text-white transition-colors p-1"
                title="登出"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Below badge: title "交易總覽" */}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[22px] font-bold text-white tracking-tight leading-none">
                交易總覽
              </span>
              <button
                onClick={() => setIsHelpOpen(true)}
                className="text-white/40 hover:text-white/70 transition-colors p-1"
                title="快捷鍵一覽"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>

            {/* Below title: hero number (totalCapital) */}
            <div className="text-[32px] font-semibold text-white tracking-tight leading-none font-sans mt-1">
              {isEditingCapital ? (
                <div className="flex items-center gap-0.5">
                  <span className="text-[26px] font-medium text-white">$</span>
                  <input
                    type="number"
                    autoFocus
                    value={editCapitalVal}
                    onBlur={() => {
                      const val = editCapitalVal === "" ? 0 : parseFloat(editCapitalVal);
                      handleUpdateTotalCapital(val);
                      setIsEditingCapital(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = editCapitalVal === "" ? 0 : parseFloat(editCapitalVal);
                        handleUpdateTotalCapital(val);
                        setIsEditingCapital(false);
                      }
                    }}
                    onChange={(e) => setEditCapitalVal(e.target.value)}
                    className="bg-transparent text-white font-semibold text-[32px] focus:outline-none w-full border-none p-0 focus:ring-0 leading-none h-10"
                    style={{ caretColor: 'white' }}
                  />
                </div>
              ) : (
                <div 
                  onClick={() => {
                    setEditCapitalVal(totalCapital.toString());
                    setIsEditingCapital(true);
                  }}
                  className="cursor-pointer flex items-baseline gap-1.5 group/cap"
                  title="點擊修改總資金"
                >
                  <span>${totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-[12px] text-white/50 group-hover/cap:text-white/80 transition-colors font-normal">(修改)</span>
                </div>
              )}
            </div>
          </div>

          {/* Body section (white) */}
          <div className="p-6 pt-5 pb-6 flex flex-col gap-4 bg-white text-left rounded-b-[32px]">
            {/* Row 1: label "剩餘額度" + value */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500 font-normal">
                剩餘額度
              </span>
              <span className="text-[15px] font-bold text-[#084D38] font-sans">
                ${remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Thin divider line */}
            <div className="h-[0.5px] bg-zinc-100" />

            {/* Row 2: label "真實交易總持有成本" + value */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500 font-normal">
                真實交易總持有成本
              </span>
              <span className="text-[15px] font-bold text-[#084D38] font-sans">
                ${totalRealHoldingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Thin divider line */}
            <div className="h-[0.5px] bg-zinc-100" />

            {/* Primary button: full-width, background bg-[#084D38], rounded-2xl, font-semibold */}
            <button
              onClick={() => setIsAddOpen(true)}
              className="w-full bg-[#084D38] hover:bg-[#063d2c] text-white rounded-2xl py-3.5 text-sm font-semibold border-none outline-none cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>+ 新增股票</span>
            </button>

            {/* Secondary button: full-width, white bg, border, rounded-2xl, text-zinc-800 */}
            <button
              onClick={handleImportLatestPrices}
              disabled={isImportingPrices || !user}
              className="w-full bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200/80 rounded-2xl py-3 text-sm font-medium outline-none cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span>↻ 匯入最新現價</span>
            </button>
          </div>
        </div>
      </ScrollIn>

      {/* Shared Add Stock Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="glass-panel border-zinc-200/80 shadow-2xl bg-white/95 backdrop-blur-3xl text-zinc-800 outline-none w-[95vw] max-w-[400px] h-auto max-h-[90vh] overflow-y-auto !rounded-3xl p-5 sm:p-6 p-safe">
          <DialogHeader>
            <DialogTitle className="font-bold text-2xl tracking-tight text-zinc-900 mb-2">
              新增股票分頁
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleAddSubmit}
            className="space-y-5 outline-none"
          >
            <div className="space-y-2">
              <Label
                htmlFor="symbol_dashboard"
                className="font-medium text-zinc-700 text-base sm:text-sm"
              >
                股票代號 (Ticker)
              </Label>
              <Input
                id="symbol_dashboard"
                value={newSymbol}
                onChange={(e) =>
                  setNewSymbol(e.target.value.toUpperCase())
                }
                placeholder="例如：AAPL"
                required
                className="bg-zinc-50 border-zinc-200 text-zinc-800 placeholder-zinc-400 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 h-[48px] text-base"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="company_dashboard"
                className="font-medium text-zinc-700 text-base sm:text-sm"
              >
                公司名稱 (選填)
              </Label>
              <Input
                id="company_dashboard"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="例如：Apple Inc."
                className="bg-zinc-50 border-zinc-200 text-zinc-800 placeholder-zinc-400 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 h-[48px] text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-medium text-zinc-700 text-base sm:text-sm">
                交易模式
              </Label>
              <Select
                value={newTradeType}
                onValueChange={(val: any) => setNewTradeType(val)}
              >
                <SelectTrigger className="w-full bg-zinc-50 border-zinc-200 text-zinc-800 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 h-[48px] text-base">
                  <SelectValue placeholder="選擇交易模式" />
                </SelectTrigger>
                <SelectContent className="bg-white border-zinc-200 text-zinc-800 outline-none rounded-xl shadow-lg">
                  <SelectItem
                    value="simulated"
                    className="font-medium focus:bg-zinc-100 focus:text-zinc-900 cursor-pointer text-zinc-700 px-4 text-base sm:text-sm py-3 sm:py-1"
                  >
                    <div className="flex items-center gap-3">
                      <Gamepad2 className="h-5 w-5 sm:h-4 sm:w-4 text-amber-600" />
                      模擬交易 (Simulated)
                    </div>
                  </SelectItem>
                  <SelectItem
                    value="real"
                    className="font-medium focus:bg-zinc-100 focus:text-zinc-900 cursor-pointer text-zinc-700 px-4 text-base sm:text-sm py-3 sm:py-1"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 sm:h-4 sm:w-4 text-emerald-600" />
                      真實交易 (Real)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4 pb-2">
              <button
                type="submit"
                className="glass-button w-full h-[52px] sm:h-auto justify-center bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 hover:bg-emerald-500/20 py-0 sm:py-6 text-[17px] font-bold transition-all rounded-xl"
              >
                建立交易日誌檔案
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Main content container, aligned nicely with responsive layout */}
      <div className={`space-y-4 sm:space-y-6 mx-auto mt-4 sm:mt-6 px-3 sm:px-4 ${activeViewTab === "notes" ? "max-w-7xl lg:max-w-[96%] xl:max-w-[1760px]" : "max-w-7xl"}`}>

      {/* Floating Metrics Section - Desktop Only (no cards, no shadows, no outer borders, pure seamless fusion with F2F1ED) */}
      <div className="hidden sm:grid sm:grid-cols-5 gap-y-6 gap-x-0 py-6 select-none">
        {[
          {
            title: "總持股數",
            rawValue: activeTabs.length,
            prefix: "",
            suffix: "",
            decimals: 0,
            pnl: undefined,
            showPlus: false,
          },
          {
            title: "總實現損益",
            rawValue: totalCompletedPnL,
            prefix: "$",
            suffix: "",
            decimals: 2,
            pnl: totalCompletedPnL,
            showPlus: true,
          },
          {
            title: "模擬實現損益",
            rawValue: simulatedCompletedPnL,
            prefix: "$",
            suffix: "",
            decimals: 2,
            pnl: simulatedCompletedPnL,
            showPlus: true,
          },
          {
            title: "真實交易勝率",
            rawValue: realWinRate,
            prefix: "",
            suffix: "%",
            decimals: 0,
            pnl: undefined,
            showPlus: false,
          },
          {
            title: "模擬交易勝率",
            rawValue: simulatedWinRate,
            prefix: "",
            suffix: "%",
            decimals: 0,
            pnl: undefined,
            showPlus: false,
          },
        ].map((metric: any, i) => {
          const isPnl = metric.pnl !== undefined;
          const isPositive = metric.rawValue >= 0;
          const valueColor = isPnl 
            ? (isPositive ? "text-[#085041]" : "text-rose-700") 
            : "text-[#2C2C2A]";

          return (
            <div 
              key={i} 
              className={`flex flex-col items-center justify-center text-center py-2 px-4 border-r border-black/[0.07] last:border-r-0`}
            >
              <span className="text-xs text-[#888780] font-medium tracking-wide uppercase">
                {metric.title}
              </span>
              <div className={`text-3xl font-bold tracking-tight mt-1.5 font-mono ${valueColor}`}>
                <AnimatedNumber
                  value={metric.rawValue}
                  prefix={metric.prefix}
                  suffix={metric.suffix}
                  decimals={metric.decimals}
                  showPlus={metric.showPlus}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Metrics Section - Mobile Only (Ultra-Compact & Designed for Mobile Reading proportions) */}
      <div className="block sm:hidden select-none px-4 py-4 mb-3 bg-transparent">
        <div className="grid grid-cols-2 gap-y-3.5 gap-x-0 text-center">
          {/* Row 1, Col 1: 總持股數 */}
          <div className="flex flex-col items-center justify-center border-r border-black/[0.06] py-1">
            <span className="text-[11px] text-[#888780] font-medium tracking-wide">
              總持股數
            </span>
            <div className="text-[19px] font-bold tracking-tight mt-0.5 text-[#2C2C2A] font-mono leading-none">
              <AnimatedNumber value={activeTabs.length} prefix="" suffix="" decimals={0} showPlus={false} />
            </div>
          </div>

          {/* Row 1, Col 2: 總實現損益 */}
          <div className="flex flex-col items-center justify-center py-1">
            <span className="text-[11px] text-[#888780] font-medium tracking-wide">
              總實現損益
            </span>
            <div className={`text-[19px] font-bold tracking-tight mt-0.5 font-mono leading-none ${totalCompletedPnL >= 0 ? "text-[#085041]" : "text-rose-700"}`}>
              <AnimatedNumber value={totalCompletedPnL} prefix="$" suffix="" decimals={2} showPlus={true} />
            </div>
          </div>

          {/* Divider 1 */}
          <div className="col-span-2 h-[0.5px] bg-black/[0.06] mx-2" />

          {/* Row 2, Col 1: 模擬實現損益 */}
          <div className="flex flex-col items-center justify-center border-r border-black/[0.06] py-1">
            <span className="text-[11px] text-[#888780] font-medium tracking-wide">
              模擬實現損益
            </span>
            <div className={`text-[19px] font-bold tracking-tight mt-0.5 font-mono leading-none ${simulatedCompletedPnL >= 0 ? "text-[#085041]" : "text-rose-700"}`}>
              <AnimatedNumber value={simulatedCompletedPnL} prefix="$" suffix="" decimals={2} showPlus={true} />
            </div>
          </div>

          {/* Row 2, Col 2: 真實交易勝率 */}
          <div className="flex flex-col items-center justify-center py-1">
            <span className="text-[11px] text-[#888780] font-medium tracking-wide">
              真實交易勝率
            </span>
            <div className="text-[19px] font-bold tracking-tight mt-0.5 text-[#2C2C2A] font-mono leading-none">
              <AnimatedNumber value={Number(realWinRate)} prefix="" suffix="%" decimals={0} showPlus={false} />
            </div>
          </div>

          {/* Divider 2 */}
          <div className="col-span-2 h-[0.5px] bg-black/[0.06] mx-2" />

          {/* Row 3, Center: 模擬交易勝率 */}
          <div className="col-span-2 flex flex-col items-center justify-center py-1">
            <span className="text-[11px] text-[#888780] font-medium tracking-wide">
              模擬交易勝率
            </span>
            <div className="text-[19px] font-bold tracking-tight mt-0.5 text-[#2C2C2A] font-mono leading-none">
              <AnimatedNumber value={Number(simulatedWinRate)} prefix="" suffix="%" decimals={0} showPlus={false} />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Row (No bottom border, pill styling for selected tab, extremely lightweight) */}
      <div className="flex flex-row snap-x flex-nowrap w-full gap-2 sm:gap-3 mb-4 sm:mb-6 mt-4 sm:mt-5 overflow-x-auto pt-2 pb-px scrollbar-hide">
        <button
          onClick={() => setActiveViewTab("active")}
          className={`h-[38px] snap-start flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 font-bold text-sm tracking-wide rounded-full transition-all duration-300 relative overflow-hidden cursor-pointer select-none border-none outline-none ${
            activeViewTab === "active"
              ? "bg-[#085041]/10 text-[#085041]"
              : "bg-transparent text-[#888780] hover:text-[#2C2C2A]"
          }`}
        >
          <Activity className="w-4 h-4" />
          持有中 (<AnimatedNumber value={visibleActiveTabs.filter((t) => t.tradeType === "simulated").length} />)
        </button>
        
        <button
          onClick={() => setActiveViewTab("real")}
          className={`h-[38px] snap-start flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 font-bold text-sm tracking-wide rounded-full transition-all duration-300 relative overflow-hidden cursor-pointer select-none border-none outline-none ${
            activeViewTab === "real"
              ? "bg-[#085041]/10 text-[#085041]"
              : "bg-transparent text-[#888780] hover:text-[#2C2C2A]"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          真實交易 (<AnimatedNumber value={visibleActiveTabs.filter((t) => t.tradeType === "real").length} />)
        </button>
        
        <button
          onClick={() => setActiveViewTab("completed")}
          className={`h-[38px] snap-start flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 font-bold text-sm tracking-wide rounded-full transition-all duration-300 relative overflow-hidden cursor-pointer select-none border-none outline-none ${
            activeViewTab === "completed"
              ? "bg-[#085041]/10 text-[#085041]"
              : "bg-transparent text-[#888780] hover:text-[#2C2C2A]"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          已完成 (<AnimatedNumber value={completedTabs.length} />)
        </button>
        
        <button
          onClick={() => setActiveViewTab("notes")}
          className={`h-[38px] snap-start flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 font-bold text-sm tracking-wide rounded-full transition-all duration-300 relative overflow-hidden cursor-pointer select-none border-none outline-none ${
            activeViewTab === "notes"
              ? "bg-[#085041]/10 text-[#085041]"
              : "bg-transparent text-[#888780] hover:text-[#2C2C2A]"
          }`}
        >
          <FileText className="w-4 h-4" />
          操作備註
        </button>
      </div>

      <div className="space-y-6">
        {/* Search Dialog */}
        <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent className="border border-zinc-200/50 shadow-2xl bg-white/90 backdrop-blur-xl text-zinc-900 max-w-[400px] w-[92%] p-6 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-extrabold text-xl text-zinc-900 flex items-center gap-2">
                <Search className="h-5 w-5 text-emerald-600" />
                快速搜尋個股
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                autoFocus
                placeholder="輸入代號或名稱..."
                className="bg-zinc-50 border-zinc-200 text-zinc-900 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-zinc-400 font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const filtered = tabs.filter(
                      (t) =>
                        t.status === "ACTIVE" &&
                        (t.symbol
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                          t.companyName
                            ?.toLowerCase()
                            .includes(searchQuery.toLowerCase())),
                    );
                    if (filtered.length > 0) {
                      handleSearchSelect(filtered[0].id);
                    }
                  }
                }}
              />
              <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1 scrollbar-hide">
                {tabs
                  .filter(
                     (t) =>
                       t.status === "ACTIVE" &&
                       (t.symbol
                         .toLowerCase()
                         .includes(searchQuery.toLowerCase()) ||
                         t.companyName
                           ?.toLowerCase()
                           .includes(searchQuery.toLowerCase())),
                  )
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleSearchSelect(t.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-100 hover:border-zinc-200/80 transition-all text-left group active:scale-[0.98] cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center font-extrabold text-[10px] rounded bg-zinc-200/70 text-zinc-650 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors">
                          {t.symbol.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-extrabold text-sm text-zinc-900 group-hover:text-emerald-600 transition-colors">
                            {t.symbol}
                          </p>
                          <p className="text-[10px] font-bold text-zinc-400 truncate max-w-[150px]">
                            {t.companyName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-zinc-750 group-hover:text-emerald-600 transition-colors">
                          ${t.currentPrice?.toLocaleString()}
                        </p>
                      </div>
                    </button>
                  ))}
                {tabs.filter((t) => t.status === "ACTIVE").length === 0 && (
                  <p className="text-center py-8 text-zinc-400 text-sm font-semibold italic">
                    尚無持有中的個股
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Card Action Choice Dialog */}
        <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
          <DialogContent className="border border-zinc-200 shadow-2xl bg-white text-zinc-800 max-w-[320px] p-6 rounded-2xl">
            <DialogHeader className="mb-4">
              <DialogTitle className="font-black text-xl text-zinc-900 flex items-center justify-center gap-2">
                <span className="bg-zinc-105 text-zinc-800 px-2 py-0.5 rounded text-sm font-black border border-zinc-200">{selectedActionTab?.symbol}</span> 操作
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => {
                  if (selectedActionTab) {
                    navigate(`/stock/${selectedActionTab.id}`);
                    setIsActionDialogOpen(false);
                  }
                }}
                onMouseEnter={() => selectedActionTab && prefetchStockPrice(selectedActionTab.symbol)}
                className="w-full py-4 px-4 bg-zinc-50 hover:bg-zinc-100/70 border border-zinc-200 rounded-xl flex items-center justify-between transition-all group shadow-sm cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ExternalLink className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-sm text-zinc-800">檢視細節</p>
                    <p className="text-[10px] font-bold text-zinc-500">
                      進入個股詳情頁面
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </button>

              <button
                onClick={() => {
                  if (selectedActionTab) {
                    handleToggleTabHighlight(
                      selectedActionTab.id,
                      selectedActionTab.isFavoriteHighlight,
                    );
                  }
                }}
                className={`w-full py-4 px-4 border rounded-xl flex items-center justify-between transition-all group cursor-pointer ${
                  selectedActionTab?.isFavoriteHighlight
                    ? "bg-[#B1C28D]/20 border-[#B1C28D]/50 hover:bg-[#B1C28D]/30"
                    : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100/70 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                      selectedActionTab?.isFavoriteHighlight
                        ? "bg-[#B1C28D]/30"
                        : "bg-amber-100"
                    }`}
                  >
                    <Star
                      className={`w-5 h-5 ${selectedActionTab?.isFavoriteHighlight ? "text-[#58633F] fill-[#58633F]/50" : "text-amber-600"}`}
                    />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-sm text-zinc-800">
                      {selectedActionTab?.isFavoriteHighlight
                        ? "取消重點"
                        : "重點關注"}
                    </p>
                    <p className="text-[10px] font-bold text-zinc-505">
                      切換首頁卡片高亮狀態
                    </p>
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-all group-hover:translate-x-1 ${
                    selectedActionTab?.isFavoriteHighlight
                      ? "text-[#58633F]"
                      : "text-zinc-400 group-hover:text-amber-500"
                  }`}
                />
              </button>

              <button
                onClick={() => {
                  if (selectedActionTab) {
                    updateTab(selectedActionTab.id, {
                      isOperationConfirmed:
                        !selectedActionTab.isOperationConfirmed,
                    });
                    setIsActionDialogOpen(false);
                  }
                }}
                className={`w-full py-4 px-4 border rounded-xl flex items-center justify-between transition-all group cursor-pointer ${
                  selectedActionTab?.isOperationConfirmed
                    ? "bg-emerald-50 border-emerald-250 hover:bg-emerald-100/50"
                    : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100/70 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                      selectedActionTab?.isOperationConfirmed
                        ? "bg-[#5cb884]/20"
                        : "bg-emerald-500/10"
                    }`}
                  >
                    <CheckCircle2
                      className={`w-5 h-5 ${selectedActionTab?.isOperationConfirmed ? "text-emerald-700 font-bold" : "text-emerald-600"}`}
                    />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-sm text-zinc-800">操作確認</p>
                    <p className="text-[10px] font-bold text-zinc-500">
                      切換首頁卡片顏色
                    </p>
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-all group-hover:translate-x-1 ${
                    selectedActionTab?.isOperationConfirmed
                      ? "text-emerald-700"
                      : "text-zinc-400 group-hover:text-emerald-600"
                  }`}
                />
              </button>

              <button
                onClick={() => {
                  if (selectedActionTab) {
                    updateTab(selectedActionTab.id, {
                      isDeviationConfirmed:
                        !selectedActionTab.isDeviationConfirmed,
                    });
                    setIsActionDialogOpen(false);
                  }
                }}
                className={`w-full py-4 px-4 border rounded-xl flex items-center justify-between transition-all group cursor-pointer ${
                  selectedActionTab?.isDeviationConfirmed
                    ? "bg-[#F5E6DB]/90 border-[#A55F2A]/35 hover:bg-[#F5E6DB]"
                    : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100/70 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                      selectedActionTab?.isDeviationConfirmed
                        ? "bg-[#F0D1B9]/60"
                        : "bg-[#F0D1B9]/30"
                    }`}
                  >
                    <Star
                      className={`w-5 h-5 ${selectedActionTab?.isDeviationConfirmed ? "text-[#854D20]" : "text-[#b06a34]"}`}
                    />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-sm text-zinc-800">乖離確認</p>
                    <p className="text-[10px] font-bold text-zinc-505">
                      更改卡片標題背景顏色
                    </p>
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-all group-hover:translate-x-1 ${
                    selectedActionTab?.isDeviationConfirmed
                      ? "text-[#854D20]"
                      : "text-zinc-400 group-hover:text-[#b06a34]"
                  }`}
                />
              </button>

              <button
                onClick={() => {
                  if (selectedActionTab) {
                    updateTab(selectedActionTab.id, {
                      isNew: !selectedActionTab.isNew,
                    });
                    setIsActionDialogOpen(false);
                  }
                }}
                className={`w-full py-4 px-4 border rounded-xl flex items-center justify-between transition-all group cursor-pointer ${
                  selectedActionTab?.isNew
                    ? "bg-emerald-50 border-emerald-250 hover:bg-[#D8F3E5]"
                    : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100/70 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${selectedActionTab?.isNew ? 'bg-emerald-500/20' : 'bg-zinc-200/80'}`}>
                    <Sparkles className={`w-5 h-5 ${selectedActionTab?.isNew ? 'text-emerald-600' : 'text-zinc-550'}`} />
                  </div>
                  <div className="text-left">
                    <p className={`font-black text-sm ${selectedActionTab?.isNew ? 'text-emerald-700' : 'text-zinc-800'}`}>
                      更新版本
                    </p>
                    <p className={`text-[10px] font-bold ${selectedActionTab?.isNew ? 'text-emerald-700/80' : 'text-zinc-500'}`}>
                      新增或移除卡片頂部的 NEW 標籤與彩色漸層細線
                    </p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 transition-all group-hover:translate-x-1 ${selectedActionTab?.isNew ? 'text-emerald-600' : 'text-zinc-400 group-hover:text-emerald-500'}`} />
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Keyboard Shortcuts Help Dialog */}
        <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
          <DialogContent className="border border-white/10 bg-[#0F0F12]/95 backdrop-blur-2xl text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-400" />
                快捷鍵指南
              </DialogTitle>
              <DialogDescription className="text-white/40 font-medium">
                使用以下快捷鍵更快速地操作系統
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "Alt + 1", desc: "持有中 - 觀察中" },
                  { key: "Alt + 2", desc: "持有中 - 候選名單" },
                  { key: "Alt + 3", desc: "持有中 - 買進操作" },
                  { key: "Alt + 4", desc: "持有中 - 賣出操作" },
                  { key: "Alt + 5", desc: "持有中 - 平倉操作" },
                  { key: "Alt + 6", desc: "持有中 - 乖離名單" },
                  { key: "Shift + 1", desc: "切換至 持有中 標籤" },
                  { key: "Shift + 2", desc: "切換至 真實交易 標籤" },
                  { key: "Shift + 3", desc: "切換至 已完成 標籤" },
                  { key: "Shift + 4", desc: "切換至 操作備註 標籤" },
                  { key: "Shift + F", desc: "快速搜尋股票" },
                  { key: "Shift + H", desc: "切換全螢幕模式" },
                  { key: "Shift + A", desc: "開啟 新增股票 對話框" },
                  { key: "Shift + U", desc: "管理持有中股票" },
                  { key: "Alt + Z", desc: "翻面可見股票卡片" },
                  { key: "Shift + I", desc: "匯入現價 / AI 智能建議 (詳情頁)" },
                  { key: "Shift + S", desc: "儲存策略 (詳情頁)" },
                  { key: "Shift + B", desc: "從詳情頁面 返回主頁" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="bg-white/5 border border-white/5 rounded-lg p-3 flex flex-col gap-1"
                  >
                    <span className="text-[10px] font-black text-emerald-400 tracking-wider uppercase">
                      {item.key}
                    </span>
                    <span className="text-xs font-bold text-white/70">
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => setIsHelpOpen(false)}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl"
              >
                了解
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {(activeViewTab === "active" || activeViewTab === "real") && (
          <div id="active-cards-section" className="grid grid-cols-1 gap-6">
            <div className="space-y-4">
              <ScrollIn delay={0.2} translateY={20}>
                <div className={`w-screen relative left-1/2 -translate-x-1/2 border-y flex flex-col group transition-all duration-500 ${activeViewTab === "real" ? "border-teal-500/10 bg-teal-500/[0.01]" : "border-emerald-500/10 bg-emerald-500/[0.01]"}`}>
                  <div className={`py-2 border-b w-full ${activeViewTab === "real" ? "border-teal-500/10" : "border-emerald-500/10"}`}>
                    {/* Desktop/Tablet version */}
                    <div className="hidden md:flex max-w-6xl mx-auto px-4 items-center justify-between w-full">
                      <div className="flex items-center gap-4">
                        <div className={`w-1.5 h-6 rounded-full transition-all duration-300 ${activeViewTab === "real" ? "bg-gradient-to-b from-teal-400 to-teal-600 shadow-[0_0_10px_rgba(20,184,166,0.5)]" : "bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"}`}></div>
                        <div className="flex bg-zinc-100 p-1 border border-zinc-200/80 rounded-xl gap-1 shadow-inner">
                          {visibleSubTabs.map((tab) => {
                            const conf = holdingTabConfig[tab];
                            const TabIcon = conf.icon;
                            const tabCount = effectiveVisibleActiveTabs.filter(
                              (t) => getDisplayHoldingStatus(t.holdingStatus) === tab,
                            ).length;
                            const isActive = activeHoldingSubTab === tab;

                            return (
                              <button
                                key={tab}
                                onClick={() => setActiveHoldingSubTab(tab as any)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-2 border cursor-pointer ${
                                  isActive
                                    ? `${conf.colorClass} ${conf.bgClass} ${conf.borderClass} ${conf.shadowClass}`
                                    : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50 border-transparent shadow-none"
                                }`}
                              >
                                <TabIcon className="w-3.5 h-3.5" />
                                {tab}
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${
                                  isActive 
                                    ? conf.activeCountClass 
                                    : "bg-zinc-200/50 border-zinc-300/40 text-zinc-650"
                                }`}>
                                  <AnimatedNumber value={tabCount} />{" "}檔
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {effectiveHiddenActiveTabs.length > 0 && (
                          <span className="text-xs font-bold border border-zinc-200 bg-zinc-50 text-zinc-500 px-3 py-1 rounded-full flex items-center gap-1.5">
                            <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                            已隱藏 {effectiveHiddenActiveTabs.length} 檔
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <InteractiveButton
                          noGlow
                          as="button"
                          onClick={() => setIsManageHiddenOpen(true)}
                          className="p-2 bg-zinc-50 border border-zinc-200 text-zinc-500 hover:text-zinc-850 hover:bg-zinc-100 rounded-md transition-all cursor-pointer"
                        >
                          <Settings2 className="w-4 h-4" />
                        </InteractiveButton>
                        <Magnetic>
                          {activeViewTab === "real" ? (
                            <ShieldCheck className="h-6 w-6 text-teal-400 opacity-80" />
                          ) : (
                            <Activity className="h-6 w-6 text-emerald-500 opacity-80" />
                          )}
                        </Magnetic>
                      </div>
                    </div>

                    {/* Redesigned Premium Mobile version */}
                    <div className="flex md:hidden flex-col w-full gap-3.5 px-4 py-1.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-150 w-full">
                        <div className="flex items-center gap-2">
                          {effectiveHiddenActiveTabs.length > 0 && (
                            <span className="text-[10px] font-black border border-zinc-250 bg-zinc-50 text-zinc-500 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                              <EyeOff className="w-3 h-3 text-zinc-400" />
                              已隱藏 {effectiveHiddenActiveTabs.length} 檔
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <InteractiveButton
                            noGlow
                            as="button"
                            onClick={() => setIsManageHiddenOpen(true)}
                            className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 text-zinc-650 hover:text-zinc-850 hover:bg-zinc-100 rounded-lg transition-all text-[11px] flex items-center gap-1 font-extrabold cursor-pointer"
                          >
                            <Settings2 className="w-3 h-3" />
                            管理
                          </InteractiveButton>
                          {activeViewTab === "real" ? (
                            <ShieldCheck className="h-4 w-4 text-teal-605 opacity-80" />
                          ) : (
                            <Activity className="h-4 w-4 text-emerald-600 opacity-80" />
                          )}
                        </div>
                      </div>

                      <div className="relative w-full overflow-hidden">
                        {/* Smooth scroll masks */}
                        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-zinc-50 to-transparent pointer-events-none z-10" />
                        <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-zinc-50 to-transparent pointer-events-none z-10" />

                        <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-hide py-1 pl-4 pr-4 -mx-4 snap-x snap-mandatory">
                          {visibleSubTabs.map((tab) => {
                            const conf = holdingTabConfig[tab];
                            const TabIcon = conf.icon;
                            const tabCount = effectiveVisibleActiveTabs.filter(
                              (t) => getDisplayHoldingStatus(t.holdingStatus) === tab,
                            ).length;
                            const isActive = activeHoldingSubTab === tab;

                            return (
                              <button
                                key={tab}
                                onClick={(e) => {
                                  setActiveHoldingSubTab(tab as any);
                                  e.currentTarget.scrollIntoView({
                                    behavior: "smooth",
                                    block: "nearest",
                                    inline: "center",
                                  });
                                }}
                                className={`flex-shrink-0 snap-center flex items-center gap-1.5 px-3.5 py-2 rounded-xl border font-bold text-xs transition-all duration-300 relative cursor-pointer ${
                                  isActive
                                    ? `${conf.colorClass} ${conf.bgClass} ${conf.borderClass} ${conf.shadowClass} scale-[1.03] z-10`
                                    : "bg-zinc-50 border-zinc-200/60 text-zinc-500 hover:bg-zinc-100/75 hover:text-zinc-800"
                                }`}
                              >
                                <TabIcon className={`w-3.5 h-3.5 ${isActive ? conf.colorClass : "text-zinc-400"}`} />
                                <span>{tab}</span>
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg border ${
                                    isActive
                                      ? conf.activeCountClass
                                      : "bg-zinc-200/50 border-zinc-250/50 text-zinc-600 font-bold"
                                  }`}
                                >
                                  {tabCount}
                                </span>

                                {isActive && (
                                  <motion.div
                                    layoutId="activeTabUnderlineMobile"
                                    className="absolute bottom-1 left-3.5 right-3.5 h-0.5 rounded-full bg-current opacity-60"
                                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Shared Controlled Dialog without a local Trigger */}
                    <Dialog
                      open={isManageHiddenOpen}
                      onOpenChange={(open) => {
                        setIsManageHiddenOpen(open);
                        if (!open) setConfirmDeleteId(null);
                      }}
                    >
                      <DialogContent className="border border-zinc-250 shadow-2xl bg-white text-zinc-800 outline-none sm:max-w-3xl max-h-[81vh] overflow-y-auto overflow-x-hidden scrollbar-hide w-11/12 max-w-lg fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] !rounded-2xl z-50">
                        <DialogHeader>
                          <DialogTitle className="font-black text-xl text-zinc-900 border-b border-zinc-150 pb-3">
                            管理持有中股票
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                          {/* 主要交易類型分頁 (持有中 vs 真實交易) */}
                          <div className="flex bg-zinc-100 p-1 rounded-xl w-full border border-zinc-200 shadow-inner">
                            <button
                              type="button"
                              onClick={() => setManageTradeType("simulated")}
                              className={`flex-1 py-2 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                                manageTradeType === "simulated"
                                  ? "bg-emerald-500 text-white shadow-sm font-black"
                                  : "text-zinc-600 hover:text-zinc-800 hover:bg-zinc-200/40"
                              }`}
                            >
                              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span>持有中 ({activeTabs.filter((t) => t.tradeType === "simulated").length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setManageTradeType("real")}
                              className={`flex-1 py-2 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                                manageTradeType === "real"
                                  ? "bg-teal-600 text-white shadow-sm font-black"
                                  : "text-zinc-600 hover:text-zinc-800 hover:bg-zinc-200/40"
                              }`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span>真實交易 ({activeTabs.filter((t) => t.tradeType === "real").length})</span>
                            </button>
                          </div>

                          {/* 子分頁列 (觀察中 | 候選名單 | 買進操作 | 賣出操作 | 平倉操作 | 乖離名單 | 持股監控) */}
                          <div className="flex bg-zinc-50 p-1 rounded-xl w-full overflow-x-auto scrollbar-hide border border-zinc-200/60">
                            {(
                              [
                                "觀察中",
                                "候選名單",
                                "買進操作",
                                "賣出操作",
                                "平倉操作",
                                "乖離名單",
                                "持股監控",
                              ] as const
                            ).map((tab) => {
                              const dialogEffectiveHiddenActiveTabs = hiddenActiveTabs.filter(
                                (t) => t.tradeType === manageTradeType
                              );
                              return (
                                <button
                                  key={tab}
                                  onClick={() => setActiveManageTab(tab)}
                                  className={`flex-shrink-0 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black rounded-lg transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                                    activeManageTab === tab
                                      ? manageTradeType === "real"
                                        ? "bg-teal-600 text-white font-black shadow-sm"
                                        : "bg-emerald-500 text-white font-black shadow-sm"
                                      : "text-zinc-600 hover:text-black hover:bg-zinc-200/50"
                                  }`}
                                >
                                  <span>{tab}</span>
                                  {tab === "持股監控" && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black border ${
                                      activeManageTab === tab
                                        ? "bg-white/20 text-white border-white/20"
                                        : manageTradeType === "real"
                                        ? "bg-teal-50 text-teal-700 border-teal-200"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}>
                                      {dialogEffectiveHiddenActiveTabs.length}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          <div className="space-y-4">
                            {(() => {
                              const dialogEffectiveHiddenActiveTabs = hiddenActiveTabs.filter(
                                (t) => t.tradeType === manageTradeType
                              );
                              const dialogEffectiveActiveTabs = activeTabs.filter(
                                (t) => t.tradeType === manageTradeType
                              );

                              const categoryTabs = activeManageTab === "持股監控"
                                ? dialogEffectiveHiddenActiveTabs
                                : dialogEffectiveActiveTabs.filter(
                                    (t) => getDisplayHoldingStatus(t.holdingStatus) === activeManageTab
                                  );

                              if (categoryTabs.length === 0) {
                                return (
                                  <div className="text-center text-zinc-450 py-12 text-sm font-black bg-zinc-50 border border-zinc-150 border-dashed rounded-xl">
                                    {activeManageTab === "持股監控"
                                      ? "目前無隱藏的個股名單"
                                      : `此分類下沒有${manageTradeType === "real" ? "真實交易" : "持有中"}股票`}
                                  </div>
                                );
                              }
                              return categoryTabs.map((tab) => {
                                const idx = dialogEffectiveActiveTabs.findIndex(t => t.id === tab.id);
                                return (
                                  <div
                                    className="flex flex-col gap-3.5 p-4 rounded-xl border border-zinc-200 bg-zinc-50/55 hover:bg-zinc-50 transition-colors relative overflow-hidden shadow-xs"
                                    key={tab.id}
                                  >
                                    <div className="flex items-center justify-between z-10 w-full relative border-b border-zinc-150 pb-2">
                                      <div className="flex items-center gap-3">
                                        <span
                                          className={`font-black text-base ${tab.isHidden ? "text-zinc-400 line-through decoration-zinc-350" : "text-zinc-800"}`}
                                        >
                                          {tab.symbol}
                                        </span>
                                        {tab.tradeType === "simulated" ? (
                                          <Badge className="bg-amber-50 border border-amber-250 text-amber-700 font-extrabold rounded-md shadow-xs">
                                            模擬
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-emerald-50 border border-emerald-250 text-emerald-700 font-extrabold rounded-md shadow-xs">
                                            真實
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => moveTabUp(idx, dialogEffectiveActiveTabs)}
                                          disabled={idx === 0}
                                          className="p-1.5 rounded-lg bg-white hover:bg-zinc-100 disabled:opacity-20 disabled:cursor-not-allowed border border-zinc-200 shadow-xs transition-colors cursor-pointer"
                                          title="往上移"
                                        >
                                          <ArrowUp className="w-3.5 h-3.5 text-zinc-600" />
                                        </button>
                                        <button
                                          onClick={() => moveTabDown(idx, dialogEffectiveActiveTabs)}
                                          disabled={idx === dialogEffectiveActiveTabs.length - 1}
                                          className="p-1.5 rounded-lg bg-white hover:bg-zinc-100 disabled:opacity-20 disabled:cursor-not-allowed border border-zinc-200 shadow-xs transition-colors cursor-pointer"
                                          title="往下移"
                                        >
                                          <ArrowDown className="w-3.5 h-3.5 text-zinc-600" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 mt-1">
                                      {(
                                        [
                                          "觀察中",
                                          "候選名單",
                                          "買進操作",
                                          "賣出操作",
                                          "平倉操作",
                                          "乖離名單",
                                        ] as const
                                      ).map((cat) => {
                                        const isSelected = getDisplayHoldingStatus(tab.holdingStatus) === cat;
                                        return (
                                          <button
                                            key={cat}
                                            onClick={() =>
                                              updateTab(tab.id, {
                                                holdingStatus: cat,
                                              })
                                            }
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all border cursor-pointer ${
                                              isSelected
                                                ? "bg-emerald-500 text-white border-emerald-600 shadow-xs"
                                                : "bg-white text-zinc-700 hover:bg-zinc-100 border-zinc-200 shadow-xs"
                                            }`}
                                          >
                                            {cat}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-1.5 w-full relative">
                                      <button
                                        onClick={() =>
                                          updateTabHidden(tab.id, !tab.isHidden)
                                        }
                                        className={`flex-1 h-[48px] sm:h-[44px] rounded-lg sm:rounded-md border transition-all flex flex-row items-center justify-center gap-2 font-black text-base sm:text-xs cursor-pointer ${tab.isHidden ? "bg-zinc-250 border-zinc-350 text-zinc-700 hover:bg-zinc-300 shadow-xs" : "bg-amber-50 border-amber-250 text-amber-700 hover:bg-amber-100 shadow-sm"}`}
                                      >
                                        {tab.isHidden ? (
                                          <EyeOff className="w-5 h-5 sm:w-3.5 sm:h-3.5 text-zinc-505" />
                                        ) : (
                                          <Eye className="w-5 h-5 sm:w-3.5 sm:h-3.5 text-amber-600 font-extrabold" />
                                        )}
                                        {tab.isHidden ? "取消隱藏" : "隱藏"}
                                      </button>

                                      <button
                                        onClick={() => toggleTabGroup(tab)}
                                        className={`flex-1 h-[48px] sm:h-[44px] rounded-lg sm:rounded-md border transition-all flex flex-row items-center justify-center gap-2 font-black text-base sm:text-xs cursor-pointer ${tab.groupId ? "bg-purple-100 border-purple-250 text-purple-700 hover:bg-purple-150 shadow-sm" : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100 shadow-xs"}`}
                                      >
                                        <Link className={`w-5 h-5 sm:w-3.5 sm:h-3.5 ${tab.groupId ? 'text-purple-650 font-black' : 'text-zinc-550'}`} />
                                        {tab.groupId ? "解除區塊" : "區塊"}
                                      </button>

                                      {confirmDeleteId === tab.id ? (
                                        <div className="absolute right-0 top-0 bottom-0 bg-white border border-rose-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-end w-full rounded-lg sm:rounded-md px-1 py-1 sm:py-0 z-10 gap-2 shadow-lg">
                                          <span className="text-zinc-800 text-xs font-black mr-auto ml-3 hidden sm:inline">
                                            確定刪除股票 【{tab.symbol}】？
                                          </span>
                                          <div className="flex gap-2 h-full w-full sm:w-auto p-1 sm:p-0">
                                            <button
                                              onClick={() =>
                                                setConfirmDeleteId(null)
                                              }
                                              className="flex-1 sm:flex-none p-1.5 px-3 h-full sm:h-[32px] rounded-lg bg-zinc-100 border border-zinc-250 text-zinc-700 hover:bg-zinc-200 text-base sm:text-xs font-black cursor-pointer"
                                            >
                                              取消
                                            </button>
                                            <button
                                              onClick={() => {
                                                deleteTab(tab.id);
                                                setConfirmDeleteId(null);
                                              }}
                                              className="flex-1 sm:flex-none p-1.5 px-3 h-full sm:h-[32px] rounded-lg bg-rose-600 border border-rose-700 text-white hover:bg-rose-700 text-base sm:text-xs font-black cursor-pointer shadow-sm"
                                            >
                                              確認刪除
                                            </button>
                                          </div>
                                        </div>
                                      ) : groupingTabId === tab.id ? (
                                        <div className="absolute right-0 top-0 bottom-0 bg-white border border-purple-250 shadow-xl flex flex-col items-center justify-center w-full rounded-lg px-2 py-2 z-10 gap-2 backdrop-blur-xl">
                                          <div className="text-zinc-800 text-xs font-black w-full text-center">選擇要連動的股票 (同一代號)</div>
                                          <div className="flex flex-wrap gap-2 w-full items-center justify-center">
                                             {activeTabs.filter(t => t.symbol === tab.symbol && t.id !== tab.id).length === 0 ? (
                                                <span className="text-rose-650 text-xs font-black">無其他相同代號的持有中股票</span>
                                             ) : (
                                                activeTabs.filter(t => t.symbol === tab.symbol && t.id !== tab.id).map(target => (
                                                   <button 
                                                      key={target.id}
                                                      onClick={(e) => { e.stopPropagation(); handleGroupWith(tab.id, target); }}
                                                      className={`px-3 py-1 bg-white hover:bg-zinc-50 border border-zinc-250 rounded-lg text-xs font-black transition-colors cursor-pointer ${target.groupId ? "bg-purple-10s text-purple-705 border-purple-200" : "text-zinc-700 hover:text-black hover:border-zinc-300"}`}
                                                   >
                                                      {target.holdingStatus || '未分類'}
                                                   </button>
                                                ))
                                             )}
                                          </div>
                                          <button 
                                            onClick={() => setGroupingTabId(null)}
                                            className="absolute right-2 top-2 p-1 text-zinc-450 hover:text-zinc-800 bg-zinc-150 hover:bg-zinc-200 border border-zinc-250 rounded cursor-pointer"
                                          >
                                            取消
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() =>
                                            setConfirmDeleteId(tab.id)
                                          }
                                          className="flex-1 h-[48px] sm:h-[44px] rounded-lg sm:rounded-md border transition-all bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 flex flex-row items-center justify-center gap-2 font-black text-base sm:text-xs cursor-pointer"
                                        >
                                          <Trash2 className="w-5 h-5 sm:w-3.5 sm:h-3.5 text-rose-605 font-bold" />
                                          刪除
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                          {activeTabs.length === 0 && (
                            <div className="text-zinc-400 text-center py-8 font-black bg-zinc-50 rounded-2xl border border-dashed border-zinc-150">
                              目前無持有中股票
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                      {/* Sub tab row of small colored blocks */}
                      <div className="py-2.5 px-6 max-w-6xl mx-auto w-full flex items-center justify-between border-t border-zinc-200 sm:border-t-0 select-none">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[11px] font-extrabold text-zinc-650">分組篩選</span>
                          <div className="flex items-center gap-2 bg-zinc-150 p-1 border border-zinc-250/70 rounded-lg">
                            {[
                              { id: "all", tooltip: "全部", color: "bg-zinc-300 hover:bg-zinc-400", activeColor: "bg-zinc-800 ring-2 ring-zinc-300", count: currentSubTabVisibleTabs.length },
                              { id: "highlight", tooltip: "重點關注", color: "bg-[#B1C28D]/50 hover:bg-[#B1C28D]", activeColor: "bg-[#B1C28D] ring-2 ring-[#B1C28D]/30", count: currentSubTabVisibleTabs.filter(t => !!t.isFavoriteHighlight).length },
                              { id: "operation", tooltip: "操作確認", color: "bg-[#A3A3A3]/50 hover:bg-[#A3A3A3]", activeColor: "bg-[#A3A3A3] ring-2 ring-[#A3A3A3]/30", count: currentSubTabVisibleTabs.filter(t => !!t.isOperationConfirmed).length },
                              { id: "deviation", tooltip: "乖離確認", color: "bg-[#F0D1B9]/50 hover:bg-[#F0D1B9]", activeColor: "bg-[#F0D1B9] ring-2 ring-[#F0D1B9]/30", count: currentSubTabVisibleTabs.filter(t => !!t.isDeviationConfirmed).length },
                              { id: "group", tooltip: "連動區塊", color: "bg-sky-500/50 hover:bg-sky-450", activeColor: "bg-sky-400 ring-2 ring-sky-500/35", count: currentSubTabVisibleTabs.filter(t => !!t.groupId).length },
                            ].filter(item => item.count > 0).map((filterItem) => {
                              const isActive = activeCardDefinitionFilter === filterItem.id;
                              return (
                                <button
                                  key={filterItem.id}
                                  onClick={() => setActiveCardDefinitionFilter(filterItem.id as any)}
                                  title={`${filterItem.tooltip} (${filterItem.count} 檔)`}
                                  className={`w-6 h-3 rounded transition-all duration-300 relative cursor-pointer ${
                                    isActive ? `${filterItem.activeColor} scale-110 shadow-md` : `${filterItem.color} opacity-80 hover:opacity-100 hover:scale-105`
                                  }`}
                                >
                                  {isActive && (
                                    <span className="absolute inset-0 m-auto w-1 h-1 rounded-full bg-white shadow-sm" />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Dynamic label showing active category & count */}
                          <span className="text-[11px] font-black text-zinc-700 tracking-wider flex items-center gap-1.5 ml-1 border-l border-zinc-250 pl-3 h-4">
                            {
                              (() => {
                                const activeObj = [
                                  { id: "all", label: "全部" },
                                  { id: "highlight", label: "重點關注" },
                                  { id: "operation", label: "操作確認" },
                                  { id: "deviation", label: "乖離確認" },
                                  { id: "group", label: "連動區塊" },
                                ].find(f => f.id === activeCardDefinitionFilter);
                                const activeCount = activeObj ? (
                                  activeObj.id === "all" ? currentSubTabVisibleTabs.length :
                                  activeObj.id === "highlight" ? currentSubTabVisibleTabs.filter(t => !!t.isFavoriteHighlight).length :
                                  activeObj.id === "operation" ? currentSubTabVisibleTabs.filter(t => !!t.isOperationConfirmed).length :
                                  activeObj.id === "deviation" ? currentSubTabVisibleTabs.filter(t => !!t.isDeviationConfirmed).length :
                                  currentSubTabVisibleTabs.filter(t => !!t.groupId).length
                                ) : 0;
                                return activeObj ? `${activeObj.label} (${activeCount} 檔)` : "";
                              })()
                            }
                          </span>
                        </div>

                        <div className="hidden sm:block text-[10px] font-bold text-white/30 tracking-wider">
                          點擊色塊切換卡片屬性分組與篩選
                        </div>
                      </div>
                    </div>

                  <div className="bg-transparent w-full">
                    <div className="overflow-hidden w-full">
                      <div className="pt-0 pb-4 sm:pt-0 sm:pb-6 min-h-[200px] w-full">
                        <AnimatePresence mode="wait">
                          {filteredSubTabVisibleTabs.length === 0 ? (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="h-full flex flex-col items-center justify-center text-white/30 py-16"
                            >
                              <div className="bg-white/5 p-5 border border-white/10 rounded-full mb-4">
                                <Activity className="h-10 w-10 opacity-40" />
                              </div>
                              <p className="text-base font-bold text-white/50 tracking-wide">
                                尚無可見的{activeHoldingSubTab}股票
                              </p>
                            </motion.div>
                          ) : (
                            <>
                            <div
                              ref={carouselRef}
                              onScroll={handleCarouselScroll}
                              className="relative w-full overflow-x-auto scrollbar-hide cursor-grab select-none border-y border-zinc-200/5 bg-zinc-50/[0.02] rounded-2xl"
                              onMouseDown={onDragStart}
                              onTouchStart={onDragStart}
                              style={{ touchAction: "pan-y" }}
                            >
                              <div className="flex flex-nowrap items-stretch gap-6 px-4 md:px-8 py-4 w-max">
                                {renderGroups.map((group, groupIdx) => {
                                  const renderCard = (tab: any, idx: number) => {
                                    const getCardStatusInfo = (tabItem: any) => {
                                      const statusName = getDisplayHoldingStatus(tabItem.list || tabItem.status);
                                      let color = "#38bdf8";
                                      if (statusName === "候選名單") color = "#fbbf24";
                                      else if (statusName === "買進操作") color = "#34d399";
                                      else if (statusName === "賣出操作") color = "#fb7185";
                                      else if (statusName === "平倉操作") color = "#e879f9";
                                      else if (statusName === "乖離名單") color = "#818cf8";
                                      return { text: statusName, color };
                                    };

                                    let plannedOrders =
                                    activeTabOrders[tab.id] || [];
                                    const getStrategyTargets = (tabId: string) => {
                                      const strat = activeTabStrategies[tabId] || {};
                                      const targets: {
                                        id: string;
                                        price: number | string;
                                        notes: string;
                                        direction?: string;
                                        categoryType: "止損設定" | "止盈設定" | "分批進出場規劃" | "支撐門檻" | "壓力門檻";
                                      }[] = [];

                                      // 1. tpTargets
                                      if (Array.isArray(strat.tpTargets)) {
                                        strat.tpTargets.forEach((tp: any, i: number) => {
                                          if (tp.price > 0) {
                                            targets.push({
                                              id: `tp-${i}`,
                                              price: tp.price,
                                              notes: tp.quantity ? `預定量: ${tp.quantity}股` : "止盈目標價",
                                              categoryType: "止盈設定"
                                            });
                                          }
                                        });
                                      }

                                      // 2. slTargets
                                      if (Array.isArray(strat.slTargets)) {
                                        strat.slTargets.forEach((sl: any, i: number) => {
                                          let priceVal = sl.price || 0;
                                          let n = "";
                                          if (sl.quantity) {
                                            n += `股數: ${sl.quantity}股`;
                                          }
                                          if (sl.percentage) {
                                            n += (n ? "，" : "") + `百分比: ${sl.percentage}%`;
                                          }
                                          if (priceVal > 0 || sl.percentage > 0) {
                                            targets.push({
                                              id: `sl-${i}`,
                                              price: priceVal || `止損 %: ${sl.percentage}%`,
                                              notes: n || "止損目標價",
                                              categoryType: "止損設定"
                                            });
                                          }
                                        });
                                      }

                                      // 3. entries
                                      if (Array.isArray(strat.entries)) {
                                        strat.entries.forEach((entry: any, i: number) => {
                                          if (entry.priceStr) {
                                            targets.push({
                                              id: `entry-${i}`,
                                              price: entry.priceStr,
                                              notes: `批次 ${i + 1} (${entry.quantityStr ? entry.quantityStr + "股" : ""}): ${entry.notes || ""}`.trim(),
                                              direction: entry.type,
                                              categoryType: "分批進出場規劃"
                                            });
                                          }
                                        });
                                      }

                                      // 4. resistanceZones
                                      if (Array.isArray(strat.resistanceZones)) {
                                        strat.resistanceZones.forEach((res: any, i: number) => {
                                          if (res.price > 0) {
                                            targets.push({
                                              id: `res-${i}`,
                                              price: res.price,
                                              notes: res.notes || "壓力門檻價",
                                              categoryType: "壓力門檻"
                                            });
                                          }
                                        });
                                      }

                                      // 5. supportZones
                                      if (Array.isArray(strat.supportZones)) {
                                        strat.supportZones.forEach((sup: any, i: number) => {
                                          if (sup.price > 0) {
                                            targets.push({
                                              id: `sup-${i}`,
                                              price: sup.price,
                                              notes: sup.notes || "支撐門檻價",
                                              categoryType: "支撐門檻"
                                            });
                                          }
                                        });
                                      }

                                      return targets;
                                    };

                                    const strategyTargets = getStrategyTargets(tab.id); plannedOrders = strategyTargets.map(t => ({ ...t, category: t.categoryType, direction: t.categoryType === "止損設定" || t.categoryType === "止盈設定" || t.categoryType === "壓力門檻" ? "SELL" : "BUY", isManualHighlight: !!strategyHighlights[`${tab.id}-${t.id}`] }));
                                    const groupedTargets = strategyTargets.reduce((acc: Record<string, any[]>, target) => {
                                      const displayCategory = `[${target.categoryType}]`;
                                      if (!acc[displayCategory]) {
                                        acc[displayCategory] = [];
                                      }
                                      acc[displayCategory].push(target);
                                      return acc;
                                    }, {});
                                  const trades = activeTabTrades[tab.id] || [];
                                  const stats = calculateStats(
                                    trades,
                                    tab.currentPrice,
                                  );
                                  const unrealizedPnL =
                                    stats.unrealizedPnL || 0;
                                  const pnlColor =
                                    unrealizedPnL > 0
                                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                      : unrealizedPnL < 0
                                        ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                                        : "text-white/60 bg-white/5 border-white/10";

                                  let isBuyOperation = false;
                                  let tpMax = 0;
                                  let batchMax = 0;
                                  let batchMin = Infinity;

                                  plannedOrders.forEach((order) => {
                                    const fullText =
                                      `${order.category || ""} ${order.notes || ""} ${order.conditions || ""}`.trim();
                                    const isTP = fullText.includes("止盈");
                                    const isBatch =
                                      fullText.includes("分批") ||
                                      fullText.includes("分批進出場規劃");

                                    if (isBatch && order.direction === "BUY") {
                                      isBuyOperation = true;
                                    }

                                    const p = order.price || 0;
                                    if (p > 0) {
                                      if (isTP) {
                                        if (p > tpMax) tpMax = p;
                                      }
                                      if (isBatch) {
                                        if (p > batchMax) batchMax = p;
                                        if (p < batchMin) batchMin = p;
                                      }
                                    }
                                  });

                                  let shouldHighlightTitle = false;
                                  const currentP = tab.currentPrice || 0;
                                  if (isBuyOperation && currentP > 0) {
                                    if (tpMax > 0 && currentP > tpMax * 1.1) {
                                      shouldHighlightTitle = true;
                                    } else if (
                                      batchMax > 0 &&
                                      currentP > batchMax * 1.1
                                    ) {
                                      shouldHighlightTitle = true;
                                    } else if (
                                      batchMin !== Infinity &&
                                      batchMin > 0 &&
                                      currentP < batchMin * 0.9
                                    ) {
                                      shouldHighlightTitle = true;
                                    }
                                  }

                                  const isCardExpanded = tab.groupId ? (expandedCards[tab.groupId] !== false) : (expandedCards[tab.id] !== false);

                                  return (
                                    <div
                                      key={tab.id}
                                      id={`stock-card-${tab.id}`}
                                      className={`card-wrapper w-[calc(100vw-32px)] sm:w-[410px] md:w-[410px] shrink-0 flex flex-col transition-all duration-300 ${isCardExpanded ? "min-h-[460px] h-[460px]" : "min-h-[135px] h-[135px]"}`}
                                      onClickCapture={(e) => {
                                        if (
                                          dragRef.current
                                            .hasDraggedBeyondThreshold
                                        ) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }
                                      }}
                                      onClick={(e) => {
                                        if (
                                          dragRef.current
                                            .hasDraggedBeyondThreshold
                                        ) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          return;
                                        }
                                        if (!isCardExpanded) {
                                          setExpandedCards((prev) => ({
                                            ...prev,
                                            [tab.groupId || tab.id]: true,
                                          }));
                                          return;
                                        }
                                        setFlippedCards((prev) => ({
                                          ...prev,
                                          [tab.id]: !prev[tab.id],
                                        }));
                                      }}
                                    >
                                      <div
                                        className={`card-inner-parallax w-full h-full flex flex-col transition-all duration-300 ${isCardExpanded ? "min-h-[460px] h-[460px]" : "min-h-[135px] h-[135px]"}`}
                                        style={{ perspective: "1200px" }}
                                      >
                                        <motion.div
                                          layout
                                          initial={{ opacity: 0, y: 20 }}
                                          animate={{
                                            opacity: 1,
                                            y: 0,
                                          }}
                                          transition={{
                                            duration: 0.6,
                                            type: "spring",
                                            stiffness: 260,
                                            damping: 20,
                                            delay: idx * 0.05,
                                          }}
                                          key={tab.id}
                                          className={`relative w-full h-full flex-1 flex flex-col cursor-pointer slide-drawer-container transition-all duration-300 ${isCardExpanded ? "min-h-[460px] h-[460px]" : "min-h-[135px] h-[135px]"} ${
                                            flippedCards[tab.id] && isCardExpanded ? "show-back" : ""
                                          } ${activeTabStrategies[tab.id]?.observeChecked ? "card-breathe-observe" : activeTabStrategies[tab.id]?.closeChecked ? "card-breathe-close" : activeTabStrategies[tab.id]?.slChecked ? "card-breathe-sl" : activeTabStrategies[tab.id]?.addChecked ? "card-breathe-add" : activeTabStrategies[tab.id]?.tpChecked ? "card-breathe-tp" : ""}`}
                                        >
                                          {/* Corner label badges - stacked vertically (render on container level to avoid clip truncation) */}
                                          <div className="absolute -top-2.5 -left-2.5 z-40 flex flex-col gap-1 items-start">
                                            {(() => {
                                              const strat = activeTabStrategies[tab.id] || {};
                                              const badges: React.ReactNode[] = [];

                                              if (strat.observeChecked) {
                                                badges.push(
                                                  <div key="observe" className="flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#C9C9C9] text-black border border-[#C9C9C9]/50 shadow-[0_0_12px_rgba(201,201,201,0.6)] select-none font-bold">
                                                    觀察中
                                                  </div>
                                                );
                                              }
                                              if (strat.addChecked) {
                                                badges.push(
                                                  <div key="add" className="flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#426B4A] text-white border border-[#426B4A]/50 shadow-[0_0_12px_rgba(66,107,74,0.6)] select-none font-bold">
                                                    加碼中
                                                  </div>
                                                );
                                              }
                                              if (strat.slChecked) {
                                                badges.push(
                                                  <div key="sl" className="flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#E04141] text-white border border-[#E04141]/50 shadow-[0_0_12px_rgba(224,65,65,0.6)] select-none font-bold">
                                                    止損中
                                                  </div>
                                                );
                                              }
                                              if (strat.closeChecked) {
                                                badges.push(
                                                  <div key="close" className="flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#EBF527] text-black border border-[#EBF527]/50 shadow-[0_0_12px_rgba(235,245,39,0.6)] select-none font-bold">
                                                    平倉中
                                                  </div>
                                                );
                                              }
                                              if (strat.tpChecked) {
                                                badges.push(
                                                  <div key="tp" className="flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#35428C] text-white border border-[#35428C]/50 shadow-[0_0_12px_rgba(53,66,140,0.6)] select-none font-bold">
                                                    止盈中
                                                  </div>
                                                );
                                              }

                                              return badges;
                                            })()}
                                          </div>

                                          {/* Inner sliding wrapper that handles overflow: hidden for transition faces */}
                                          <div className="slide-drawer-inner">
                                            {/* Front Face */}
                                          <div
                                            style={{
                                              pointerEvents: flippedCards[
                                                tab.id
                                              ]
                                                ? "none"
                                                : "auto",
                                            }}
                                            className="card-front absolute inset-0 glass-card rounded-2xl flex flex-col group/item w-full h-full transition-all duration-500 overflow-hidden"
                                          >
                                            {/* Removed old redundant child elements since they are now declared on container level */}

                                            {/* 左側色條 */}
                                            {(() => {
                                              const strat = activeTabStrategies[tab.id] || {};
                                              let color = "";
                                              if (strat.observeChecked) color = "#C9C9C9";
                                              else if (strat.closeChecked) color = "#EBF527";
                                              else if (strat.slChecked) color = "#E04141";
                                              else if (strat.addChecked) color = "#426B4A";
                                              else if (strat.tpChecked) color = "#35428C";

                                              if (!color) return null;
                                              return (
                                                <div 
                                                  style={{ backgroundColor: color }}
                                                  className="absolute left-0 top-4 bottom-4 w-[3px] z-30 rounded-full"
                                                />
                                              );
                                            })()}

                                            {/* Independent Top Banner Row */}
                                            {(() => {
                                              const isBannerActive = tab.isDeviationConfirmed || tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle;
                                              const bannerBgColor = tab.isDeviationConfirmed
                                                ? "#F0D1B9"
                                                : tab.isOperationConfirmed
                                                  ? "#D1D5DB"
                                                  : tab.isFavoriteHighlight
                                                    ? "#DCE6C1"
                                                    : shouldHighlightTitle
                                                      ? "#FCDAD7"
                                                      : "transparent";

                                              const bannerTextColor = tab.isDeviationConfirmed
                                                ? "#823b0a"
                                                : tab.isOperationConfirmed
                                                  ? "#1f2937"
                                                  : tab.isFavoriteHighlight
                                                    ? "#3f4d21"
                                                    : shouldHighlightTitle
                                                      ? "#9c2c2c"
                                                      : "#71717a";

                                              const statusInfo = getCardStatusInfo(tab);
                                              const dotColor = isBannerActive ? bannerTextColor : statusInfo.color;

                                              return (
                                                <div
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedActionTab(tab);
                                                    setIsActionDialogOpen(true);
                                                  }}
                                                  style={{ backgroundColor: bannerBgColor }}
                                                  className={`w-full h-[18px] flex items-center justify-between px-3 transition-colors duration-500 shrink-0 border-b ${isBannerActive ? "border-transparent" : "border-zinc-200/50"} select-none cursor-pointer`}
                                                >
                                                  {/* Status with dot */}
                                                  <div className="flex items-center gap-1.5 font-sans">
                                                    <span 
                                                      className="w-1.5 h-1.5 rounded-full inline-block transition-colors duration-500" 
                                                      style={{ backgroundColor: dotColor }}
                                                    />
                                                  </div>
                                                </div>
                                              );
                                            })()}

                                            {/* Main Card Content Body with padding */}
                                            <div className={`flex-1 flex flex-col p-3 pt-2 ${isCardExpanded ? "pb-16" : "pb-2"} w-full overflow-y-auto scrollbar-hide relative`}>
                                            {/* 左側色條 */}
                                            {(() => {
                                              const strat = activeTabStrategies[tab.id] || {};
                                              let color = "";
                                              if (strat.observeChecked) color = "#C9C9C9";
                                              else if (strat.closeChecked) color = "#EBF527";
                                              else if (strat.slChecked) color = "#E04141";
                                              else if (strat.addChecked) color = "#426B4A";
                                              else if (strat.tpChecked) color = "#35428C";

                                              if (!color) return null;
                                              return (
                                                <div 
                                                  style={{ backgroundColor: color }}
                                                  className="hidden"
                                                />
                                              );
                                            })()}

                                            {/* Symbol, Price, Scores Row */}
                                            <div
                                              className="flex items-center justify-between relative z-10 w-full overflow-hidden rounded-lg p-1.5 hover:bg-zinc-150/40 transition-colors duration-200 shrink-0"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedActionTab(tab);
                                                setIsActionDialogOpen(true);
                                              }}
                                              title={
                                                activeTabStrategies[tab.id]
                                                  ?.operationNote
                                                  ? `[執行操作備註]\n${activeTabStrategies[tab.id].operationNote}`
                                                  : undefined
                                              }
                                            >
                                              <div className="flex items-start gap-4 w-full">
                                                <div className="flex flex-col w-full min-w-0">
                                                  {/* Row 1: Symbol & Name & SIM/LIVE Badge */}
                                                  <div className="flex items-baseline gap-2 mb-1.5">
                                                    <span
                                                      className="font-black text-2xl tracking-tighter leading-none text-black"
                                                    >
                                                      {tab.symbol}
                                                    </span>
                                                    {tab.currentPrice !== undefined && (
                                                      <div className="flex items-baseline gap-2">
                                                        <span className="text-lg font-black tabular-nums text-zinc-900">
                                                          ${tab.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                        {unrealizedPnL !== 0 && (
                                                          <span className={`text-sm font-black tabular-nums ${unrealizedPnL > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                            {unrealizedPnL > 0 ? "▲" : "▼"}{Math.abs(unrealizedPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                          </span>
                                                        )}
                                                      </div>
                                                    )}
                                                    <div
                                                      className={`flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full border uppercase tracking-widest ml-auto ${
                                                        tab.tradeType ===
                                                        "simulated"
                                                          ? "bg-amber-50 text-amber-800 border-amber-200"
                                                          : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                                      }`}
                                                    >
                                                      {tab.tradeType === "simulated" ? (
                                                        <Gamepad2 className="h-2.5 w-2.5" />
                                                      ) : (
                                                        <ShieldCheck className="h-2.5 w-2.5" />
                                                      )}
                                                      {tab.tradeType === "simulated" ? "SIM" : "LIVE"}
                                                    </div>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedCards((prev) => ({
                                                          ...prev,
                                                          [tab.groupId || tab.id]: !isCardExpanded
                                                        }));
                                                      }}
                                                      className="p-1 text-zinc-500 hover:text-zinc-800 bg-zinc-100/80 hover:bg-zinc-200 rounded-full transition-colors ml-1.5 flex items-center justify-center shrink-0"
                                                      title={isCardExpanded ? "收合個股卡片" : "展開個股卡片"}
                                                    >
                                                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isCardExpanded ? "rotate-180" : ""}`} />
                                                    </button>
                                                  </div>

                                                  {/* Row 2: Score & Sentiment Groups */}
                                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <div className="flex items-center border border-zinc-200 rounded-md overflow-hidden h-5 bg-zinc-50">
                                                      <div className="px-1.5 h-full flex items-center border-r border-zinc-200 bg-zinc-100/50">
                                                        <span className="text-[10px] font-black text-zinc-600">
                                                          ★ {tab.rating || 8}
                                                        </span>
                                                      </div>
                                                      <div className="px-1.5 h-full flex items-center border-r border-zinc-200 bg-zinc-100/50">
                                                        <span className="text-[10px] font-black text-zinc-600">
                                                          Q {tab.qualityScore || 5}
                                                        </span>
                                                      </div>
                                                      <div className="px-1.5 h-full flex items-center border-r border-zinc-200 bg-zinc-100/50">
                                                        <span className="text-[10px] font-black text-zinc-600">
                                                          V {tab.valueScore || 5}
                                                        </span>
                                                      </div>
                                                      <div className="px-1.5 h-full flex items-center border-r border-zinc-200 bg-zinc-100/50">
                                                        <span className="text-[10px] font-black text-zinc-600">
                                                          B {tab.buyRate || 5}
                                                        </span>
                                                      </div>
                                                      <div className="px-1.5 h-full flex items-center bg-zinc-100/50">
                                                        <span className="text-[10px] font-black text-zinc-600">
                                                          S {tab.sellRate || 5}
                                                        </span>
                                                      </div>
                                                    </div>

                                                    <div className="flex items-center border border-zinc-200 rounded-md overflow-hidden h-5 bg-zinc-50">
                                                      <div className="px-1.5 h-full flex items-center border-r border-zinc-200 bg-zinc-100/50">
                                                        <span className="text-[10px] font-black text-zinc-600">
                                                          {tab.volatility || "中"}
                                                        </span>
                                                      </div>
                                                      <div className="px-1.5 h-full flex items-center border-r border-zinc-200 bg-zinc-100/50" title="Positive Value">
                                                        <span className="text-[10px] font-black text-zinc-600">
                                                          P+ {calculatePositiveValue(Number(tab.rating||5), Number(tab.qualityScore||5), Number(tab.valueScore||5), Number(tab.buyRate||5))}
                                                        </span>
                                                      </div>
                                                      <div className="px-1.5 h-full flex items-center bg-zinc-100/50" title="Negative Value">
                                                        <span className="text-[10px] font-black text-zinc-600">
                                                          N- {calculateNegativeValue(Number(tab.rating||5), Number(tab.qualityScore||5), Number(tab.valueScore||5), Number(tab.sellRate||5))}
                                                        </span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>

                                            {isCardExpanded && (
                                              <>
                                                {plannedOrders.length > 0 && (
                                                  <div className="mt-2 pt-2 border-t border-zinc-200/55 relative z-10">
                                                <p className="text-[12px] font-bold text-zinc-550 text-zinc-500 mb-[6px] tracking-wide uppercase">
                                                  交易計畫與策略目標價 (
                                                  {plannedOrders.length})
                                                </p>
                                                <div className="flex flex-col gap-1">
                                                  {Object.entries(
                                                    plannedOrders.reduce(
                                                      (
                                                        acc: Record<
                                                          string,
                                                          any[]
                                                        >,
                                                        order,
                                                      ) => {
                                                        const fullText =
                                                          `${order.notes || ""} ${order.conditions || ""}`.trim();
                                                        let category =
                                                          order.category ||
                                                          "其他";

                                                        if (
                                                          category === "其他" ||
                                                          !order.category ||
                                                          category ===
                                                            "關鍵價格門檻"
                                                        ) {
                                                          if (
                                                            fullText.includes(
                                                              "[支撐",
                                                            ) ||
                                                            fullText.includes(
                                                              "支撐門檻",
                                                            )
                                                          )
                                                            category =
                                                              "支撐門檻";
                                                          else if (
                                                            fullText.includes(
                                                              "[壓力",
                                                            ) ||
                                                            fullText.includes(
                                                              "壓力門檻",
                                                            )
                                                          )
                                                            category =
                                                              "壓力門檻";
                                                          else if (
                                                            fullText.includes(
                                                              "止損設定",
                                                            ) ||
                                                            fullText.includes(
                                                              "[止損",
                                                            )
                                                          )
                                                            category =
                                                              "止損設定";
                                                          else if (
                                                            fullText.includes(
                                                              "止盈設定",
                                                            ) ||
                                                            fullText.includes(
                                                              "[止盈",
                                                            )
                                                          )
                                                            category =
                                                              "止盈設定";
                                                          else if (
                                                            fullText.includes(
                                                              "分批進出場",
                                                            ) ||
                                                            fullText.includes(
                                                              "[分批",
                                                            )
                                                          )
                                                            category =
                                                              "分批進出場規劃";
                                                          // Fallbacks
                                                          else if (
                                                            fullText.includes(
                                                              "支撐",
                                                            )
                                                          )
                                                            category =
                                                              "支撐門檻";
                                                          else if (
                                                            fullText.includes(
                                                              "壓力",
                                                            )
                                                          )
                                                            category =
                                                              "壓力門檻";
                                                          else if (
                                                            fullText.includes(
                                                              "止損",
                                                            )
                                                          )
                                                            category =
                                                              "止損設定";
                                                          else if (
                                                            fullText.includes(
                                                              "止盈",
                                                            )
                                                          )
                                                            category =
                                                              "止盈設定";
                                                          else if (
                                                            fullText.includes(
                                                              "分批",
                                                            )
                                                          )
                                                            category =
                                                              "分批進出場規劃";
                                                        }

                                                        const displayCategory = `[${category}]`;

                                                        if (
                                                          !acc[displayCategory]
                                                        )
                                                          acc[displayCategory] =
                                                            [];
                                                        acc[
                                                          displayCategory
                                                        ].push(order);
                                                        return acc;
                                                      },
                                                      {},
                                                    ),
                                                  )
                                                    .sort(([a], [b]) => {
                                                      const order = [
                                                        "[止損設定]",
                                                        "[止盈設定]",
                                                        "[分批進出場規劃]",
                                                        "[支撐門檻]",
                                                        "[壓力門檻]",
                                                        "[其他]",
                                                      ];
                                                      const idxA =
                                                        order.indexOf(a);
                                                      const idxB =
                                                        order.indexOf(b);
                                                      if (
                                                        idxA !== -1 &&
                                                        idxB !== -1
                                                      )
                                                        return idxA - idxB;
                                                      if (idxA !== -1)
                                                        return -1;
                                                      if (idxB !== -1) return 1;
                                                      return a.localeCompare(b);
                                                    })
                                                    .map(
                                                      ([
                                                        category,
                                                        categoryOrders,
                                                      ]) => {
                                                        const categoryType =
                                                          category.replace(
                                                            /[\[\]]/g,
                                                            "",
                                                          );
                                                        return (
                                                          <div
                                                            key={category}
                                                            className="flex flex-col gap-1"
                                                          >
                                                            <div className="flex items-center gap-1.5 px-1 mb-1 mt-1.5">
                                                              <div
                                                                className={`h-1 w-1 rounded-full ${
                                                                  categoryType ===
                                                                  "止損設定"
                                                                    ? "bg-red-500"
                                                                    : categoryType ===
                                                                        "止盈設定"
                                                                      ? "bg-emerald-500"
                                                                      : categoryType ===
                                                                            "支撐門檻" ||
                                                                          categoryType ===
                                                                            "壓力門檻"
                                                                        ? "bg-amber-500"
                                                                        : "bg-blue-500"
                                                                }`}
                                                              ></div>
                                                              <span
                                                                className={`text-[11px] font-bold tracking-widest uppercase leading-none ${
                                                                  categoryType ===
                                                                  "止損設定"
                                                                    ? "text-red-600"
                                                                    : categoryType ===
                                                                        "止盈設定"
                                                                      ? "text-emerald-600"
                                                                      : categoryType ===
                                                                            "支撐門檻" ||
                                                                          categoryType ===
                                                                            "壓力門檻"
                                                                        ? "text-amber-600"
                                                                        : "text-zinc-500"
                                                                }`}
                                                              >
                                                                {category}
                                                              </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                              {(
                                                                categoryOrders as any[]
                                                              )
                                                                .sort(
                                                                  (a, b) =>
                                                                    (b.price ||
                                                                      0) -
                                                                    (a.price ||
                                                                      0),
                                                                )
                                                                .map(
                                                                  (order) => {
                                                                    const isStopLoss =
                                                                      categoryType ===
                                                                      "止損設定";
                                                                    const isKeyPrice =
                                                                      categoryType ===
                                                                        "支撐門檻" ||
                                                                      categoryType ===
                                                                        "壓力門檻";
                                                                    const keyLabel =
                                                                      isKeyPrice
                                                                        ? categoryType ===
                                                                          "支撐門檻"
                                                                          ? "支撐"
                                                                          : "壓力"
                                                                        : order.direction ===
                                                                            "BUY"
                                                                          ? "買入"
                                                                          : "賣出";

                                                                    const showLabel =
                                                                      keyLabel === "支撐" ||
                                                                      keyLabel === "壓力";

                                                                    const isAlertTriggered =
                                                                      order.price &&
                                                                      tab.currentPrice &&
                                                                      Math.abs(
                                                                        (tab.currentPrice -
                                                                          order.price) /
                                                                          order.price,
                                                                      ) <= 0.02;
                                                                    const isHighlighted =
                                                                      isAlertTriggered ||
                                                                      order.isManualHighlight;

                                                                    let colorClass =
                                                                      "";
                                                                    let borderClass =
                                                                      "border";

                                                                    if (
                                                                      isHighlighted
                                                                    ) {
                                                                      colorClass =
                                                                        "bg-amber-500 text-zinc-950 border-amber-600 shadow-sm font-semibold";
                                                                      borderClass =
                                                                        "border";
                                                                    } else if (
                                                                      isStopLoss
                                                                    ) {
                                                                      colorClass =
                                                                        "border-red-200 text-red-700 bg-red-50";
                                                                    } else if (
                                                                      isKeyPrice
                                                                    ) {
                                                                      colorClass =
                                                                        "bg-amber-50/50 border-amber-200 text-amber-800";
                                                                    } else {
                                                                      colorClass =
                                                                        order.direction ===
                                                                        "BUY"
                                                                          ? "bg-emerald-50/50 border-emerald-200 text-emerald-800 font-medium"
                                                                          : "bg-blue-50/50 border-blue-200 text-blue-800 font-medium";
                                                                    }

                                                                    return (
                                                                      <div
                                                                        key={
                                                                          order.id
                                                                        }
                                                                        title={
                                                                          order.notes ||
                                                                          order.conditions ||
                                                                          ""
                                                                        }
                                                                        className={`rounded-lg ${borderClass} py-1 px-2.5 flex items-center gap-1.5 backdrop-blur-sm transition-all duration-300 cursor-pointer select-none ${colorClass}`}
                                                                        onClick={(
                                                                          e,
                                                                        ) => {
                                                                          e.stopPropagation();
                                                                        }}
                                                                        onDoubleClick={(
                                                                          e,
                                                                        ) => {
                                                                          e.stopPropagation();
                                                                          order.id.startsWith("tp-") || order.id.startsWith("sl-") || order.id.startsWith("entry-") || order.id.startsWith("res-") || order.id.startsWith("sup-") ? setStrategyHighlights(prev => ({ ...prev, [`${tab.id}-${order.id}`]: !prev[`${tab.id}-${order.id}`] })) : handleToggleOrderHighlight(
                                                                            tab.id,
                                                                            order.id,
                                                                            order.isManualHighlight,
                                                                          );
                                                                        }}
                                                                      >
                                                                        {showLabel && (
                                                                          <span
                                                                            className={`text-[9px] tracking-wider font-extrabold px-1 py-0.5 rounded leading-none ${
                                                                              isHighlighted
                                                                                ? "bg-black/10 text-amber-950"
                                                                                : "bg-amber-100 text-amber-800"
                                                                            }`}
                                                                          >
                                                                            {keyLabel}
                                                                          </span>
                                                                        )}
                                                                        <span
                                                                          className={`text-xs leading-none ${
                                                                            isHighlighted
                                                                              ? "font-black"
                                                                              : "font-bold"
                                                                          }`}
                                                                        >
                                                                          {order.price
                                                                            ? `$${order.price.toLocaleString()}`
                                                                            : "市價"}
                                                                        </span>
                                                                      </div>
                                                                    );
                                                                  },
                                                                )}
                                                            </div>
                                                          </div>
                                                        );
                                                      },
                                                    )}
                                                </div>
                                              </div>
                                            )}

                                            {trades.length > 0 && (
                                              <div className="mt-2 pt-2 border-t border-white/10 relative z-10">
                                                <div className="flex items-center justify-between mb-[4px]">
                                                  <p className="text-[12px] font-bold text-zinc-500 tracking-wide uppercase">
                                                    近期操作記錄 (
                                                    {trades.length})
                                                  </p>
                                                  {stats.totalQuantity !==
                                                    0 && (
                                                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                                                      <span>
                                                        平均成本{" "}
                                                        <span className="font-bold text-white/80">
                                                          $
                                                          {stats.averagePrice.toLocaleString(
                                                            undefined,
                                                            {
                                                              minimumFractionDigits: 2,
                                                              maximumFractionDigits: 2,
                                                            },
                                                          )}
                                                        </span>
                                                      </span>
                                                      <span>
                                                        持有數量{" "}
                                                        <span className="font-bold text-white/80">
                                                          {Math.abs(
                                                            stats.totalQuantity,
                                                          )}
                                                          股
                                                        </span>
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                  {trades
                                                    .slice(0, 3)
                                                    .map((trade) => (
                                                      <div
                                                        key={trade.id}
                                                        className={`text-[11px] rounded border px-[8px] py-[2px] flex items-center gap-[4px] backdrop-blur-md ${trade.type === "BUY" ? "bg-emerald-50 border-emerald-200/80 text-emerald-800" : "bg-blue-50 border-blue-200/80 text-blue-800"}`}
                                                      >
                                                        <span className="font-bold">
                                                          {trade.type === "BUY"
                                                            ? "買，"
                                                            : "賣，"}
                                                        </span>
                                                        <span className="font-medium">
                                                          {trade.price
                                                            ? `$${trade.price}`
                                                            : "市價"}{" "}
                                                          / {trade.quantity}股
                                                        </span>
                                                        {trade.operator === "機器" && (
                                                          <span className="text-red-500 font-bold ml-0.5">(機器)</span>
                                                        )}
                                                        {trade.operator === "人" && (
                                                          <span className="text-zinc-500 font-bold ml-0.5">(人)</span>
                                                        )}
                                                      </div>
                                                    ))}
                                                  {trades.length > 3 && (
                                                    <div className="text-[11px] rounded border border-zinc-200 bg-zinc-100/50 px-[8px] py-[2px] flex items-center gap-[4px] text-zinc-500">
                                                      +{trades.length - 3} 更多
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            )}

                                            {/* Flip Trigger Area (Bottom section) */}
                                            <div
                                              className="absolute bottom-0 left-0 right-0 h-[60px] z-20 cursor-pointer group/flip bg-gradient-to-t from-white/[0.03] to-transparent sm:hover:from-white/[0.08] transition-colors"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setFlippedCards((prev) => ({
                                                  ...prev,
                                                  [tab.id]: true,
                                                }));
                                              }}
                                            >
                                              <div className="absolute bottom-2 right-3 opacity-60 sm:opacity-0 sm:group-hover/flip:opacity-60 text-[10px] text-white transition-opacity flex items-center gap-1 font-bold">
                                                <svg
                                                  width="12"
                                                  height="12"
                                                  viewBox="0 0 24 24"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="2.5"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                >
                                                  <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 0 1 9-9" />
                                                </svg>
                                                數據圖視化
                                              </div>
                                            </div>
                                              </>
                                            )}
                                            </div>
                                          </div>

                                          {/* Back Face */}
                                          {isCardExpanded && (
                                            <div
                                              style={{
                                              pointerEvents: flippedCards[tab.id]
                                                ? "auto"
                                                : "none",
                                            }}
                                            className={`card-back absolute inset-0 glass-card bg-transparent rounded-2xl flex flex-col w-full h-full sm:hover:bg-white/[0.04] transition-all duration-500 overflow-hidden ${
                                              activeTabStrategies[tab.id]?.observeChecked
                                                ? "card-breathe-observe"
                                                : activeTabStrategies[tab.id]?.closeChecked
                                                ? "card-breathe-close"
                                                : activeTabStrategies[tab.id]?.slChecked
                                                ? "card-breathe-sl"
                                                : activeTabStrategies[tab.id]?.addChecked
                                                ? "card-breathe-add"
                                                : activeTabStrategies[tab.id]?.tpChecked
                                                ? "card-breathe-tp"
                                                : ""
                                            }`}
                                          >
                                            {/* 左側色條 */}
                                            {(() => {
                                              const strat = activeTabStrategies[tab.id] || {};
                                              let color = "";
                                              if (strat.observeChecked) color = "#C9C9C9";
                                              else if (strat.closeChecked) color = "#EBF527";
                                              else if (strat.slChecked) color = "#E04141";
                                              else if (strat.addChecked) color = "#426B4A";
                                              else if (strat.tpChecked) color = "#35428C";

                                              if (!color) return null;
                                              return (
                                                <div 
                                                  style={{ backgroundColor: color }}
                                                  className="absolute left-0 top-4 bottom-4 w-[3px] z-30 rounded-full"
                                                />
                                              );
                                            })()}

                                            {/* Independent Top Banner Row for visualizer (back face) */}
                                            {(() => {
                                              const isBannerActive = tab.isDeviationConfirmed || tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle;
                                              const bannerBgColor = tab.isDeviationConfirmed
                                                ? "#F0D1B9"
                                                : tab.isOperationConfirmed
                                                  ? "#A3A3A3"
                                                  : tab.isFavoriteHighlight
                                                    ? "#B1C28D"
                                                    : shouldHighlightTitle
                                                      ? "#F5DAD5"
                                                      : "transparent";

                                              const bannerTextColor = tab.isDeviationConfirmed
                                                ? "#7a4a1e"
                                                : tab.isOperationConfirmed
                                                  ? "#7a4a1e"
                                                  : tab.isFavoriteHighlight
                                                    ? "#7a4a1e"
                                                    : shouldHighlightTitle
                                                      ? "#7a4a1e"
                                                      : "rgba(255, 255, 255, 0.7)";

                                              const statusInfo = getCardStatusInfo(tab);
                                              const dotColor = isBannerActive ? bannerTextColor : statusInfo.color;

                                              return (
                                                <div
                                                  style={{ backgroundColor: bannerBgColor }}
                                                  className={`w-full h-[18px] flex items-center justify-between px-3 transition-colors duration-500 shrink-0 border-b ${isBannerActive ? "border-transparent" : "border-white/5"} select-none`}
                                                >
                                                  {/* Status with dot */}
                                                  <div className="flex items-center gap-1.5 font-sans">
                                                    <span 
                                                      className="w-1.5 h-1.5 rounded-full inline-block transition-colors duration-500" 
                                                      style={{ backgroundColor: dotColor }}
                                                    />
                                                  </div>

                                                  {/* Timestamp & Close Button */}
                                                  <div className="flex items-center gap-2">
                                                    {tab.updatedAt && (
                                                      <span 
                                                        style={{ color: bannerTextColor }}
                                                        className="text-[9.5px] font-black tracking-wider opacity-80 transition-colors duration-500 font-bold"
                                                      >
                                                        {typeof tab.updatedAt.toDate === 'function' 
                                                          ? format(tab.updatedAt.toDate(), 'yyyy/MM/dd HH:mm') 
                                                          : ''}
                                                      </span>
                                                    )}
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFlippedCards((prev) => ({
                                                          ...prev,
                                                          [tab.id]: false,
                                                        }));
                                                      }}
                                                      style={{ 
                                                        color: bannerTextColor, 
                                                        borderColor: isBannerActive ? 'rgba(122,74,30,0.2)' : 'rgba(255,255,255,0.1)' 
                                                      }}
                                                      className="w-3.5 h-3.5 flex items-center justify-center rounded-full border bg-black/10 sm:hover:bg-black/20 text-[7px] font-black transition-all leading-none"
                                                      title="返回正面"
                                                    >
                                                      ✕
                                                    </button>
                                                  </div>
                                                </div>
                                              );
                                            })()}

                                            {/* Padded wrapper for the visualizer content */}
                                            <div className="flex-1 flex flex-col p-2.5 pt-1.5 w-full min-h-0 relative overflow-hidden">
                                              {/* 左側色條 */}
                                              {(() => {
                                                const strat = activeTabStrategies[tab.id] || {};
                                                let color = "";
                                                if (strat.observeChecked) color = "#C9C9C9";
                                                else if (strat.closeChecked) color = "#EBF527";
                                                else if (strat.slChecked) color = "#E04141";
                                                else if (strat.addChecked) color = "#426B4A";
                                                else if (strat.tpChecked) color = "#35428C";

                                                if (!color) return null;
                                                return (
                                                  <div 
                                                    style={{ backgroundColor: color }}
                                                    className="hidden"
                                                  />
                                                );
                                              })()}

                                              <StockCardVisualizer
                                                plannedOrders={plannedOrders}
                                                currentPrice={tab.currentPrice}
                                                onToggleHighlight={(orderId, currentStatus) => { if (orderId.startsWith("tp-") || orderId.startsWith("sl-") || orderId.startsWith("entry-") || orderId.startsWith("res-") || orderId.startsWith("sup-")) { setStrategyHighlights(prev => ({ ...prev, [`${tab.id}-${orderId}`]: !prev[`${tab.id}-${orderId}`] })); } else { handleToggleOrderHighlight(tab.id, orderId, currentStatus); } }}
                                                tabId={tab.id}
                                                annotations={tab.chartAnnotations || []}
                                                onUpdateAnnotations={(newAnn) => updateTab(tab.id, { chartAnnotations: newAnn })}
                                                averageCost={stats.totalQuantity !== 0 ? stats.averagePrice : undefined}
                                                averageCostQuantity={stats.totalQuantity !== 0 ? stats.totalQuantity : undefined}
                                                stockName={tab.symbol}
                                                rating={tab.rating}
                                                qualityScore={tab.qualityScore}
                                                valueScore={tab.valueScore}
                                                buyRate={tab.buyRate}
                                                sellRate={tab.sellRate}
                                                volatility={tab.volatility}
                                                crashSimilarity={tab.crashSimilarity}
                                                onRatingBarDoubleClick={(e) => {
                                                  if (e.stopPropagation) e.stopPropagation();
                                                  setVisualizerFocusTabId(tab.id);
                                                  setVisualizerFocusText(activeTabStrategies[tab.id]?.operationFocus || "");
                                                }}
                                                strategy={activeTabStrategies[tab.id]}
                                                tradeDirection={tab.tradeDirection}
                                                onUpdateStrategyField={(field, checked) => handleUpdateStrategyField(tab.id, field, checked)}
                                                onUpdateTPChecked={(checked) => handleUpdateTPChecked(tab.id, checked)}
                                                onUpdateSLChecked={(checked) => handleUpdateSLChecked(tab.id, checked)}
                                                onUpdateAddChecked={(checked) => handleUpdateAddChecked(tab.id, checked)}
                                                onUpdateCloseChecked={(checked) => handleUpdateCloseChecked(tab.id, checked)}
                                                onUpdateObserveChecked={(checked) => handleUpdateObserveChecked(tab.id, checked)}
                                                onUpdateNotesHighlighted={(checked) => handleUpdateNotesHighlighted(tab.id, checked)}
                                              />
                                            </div>
                                          </div>
                                          )}
                                        </div>



                                        {/* NEW Corner Block Tag - placed at container level */}
                                        {tab.isNew && (
                                          <div 
                                            className="absolute top-0 right-0 z-[100] flex items-center justify-center select-none whitespace-nowrap pointer-events-none"
                                            style={{ 
                                              background: "linear-gradient(135deg, #ff6b35 0%, #e03030 100%)",
                                              color: "#ffffff",
                                              fontSize: "10px",
                                              fontWeight: "700",
                                              letterSpacing: "0.12em",
                                              padding: "5px 13px 5px 10px",
                                              borderRadius: "0 14px 0 12px",
                                              fontFamily: "var(--font-sans)",
                                            }}
                                          >
                                            NEW
                                          </div>
                                        )}
                                      </motion.div>
                                      </div>
                                    </div>
                                  );
                                  };

                                  if (group.isGroup) {
                                    return (
                                      <div 
                                        key={group.id} 
                                        className="relative flex p-1.5 sm:p-2 bg-gradient-to-r from-white/[0.04] to-white/[0.01] rounded-[36px] shrink-0 gap-4 group/box transition-all"
                                        style={{ border: '0.8px solid #D9FF00', boxShadow: 'none' }}
                                      >
                                        {/* Optional Label / Indicator indicating this is a paired block could go here */}
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white/10 px-3 py-0.5 rounded-full text-[10px] font-bold text-white/50 opacity-0 group-hover/box:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/10">
                                          連動區塊
                                        </div>
                                        {group.tabs.map((t, i) => renderCard(t, i))}
                                      </div>
                                    );
                                  }
                                  
                                  return renderCard(group.tabs[0], groupIdx);
                                })}
                              </div>
                            </div>

                            {/* 底線滑動指示器導覽列 - Desktop Only */}
                            {filteredSubTabVisibleTabs.length > 0 && (
                              <div className="hidden sm:block mt-6 px-4 md:px-8 w-full">
                                <div className="flex justify-center w-full">
                                  <div className="relative max-w-4xl pb-2">
                                    {/* Scrollable Container if there are many tabs */}
                                    <div className="flex flex-row items-center justify-center gap-6 overflow-x-auto scrollbar-hide relative pb-1.5">
                                      {filteredSubTabVisibleTabs.map((tab) => {
                                        const isActive = (activeCardTabId || filteredSubTabVisibleTabs[0]?.id) === tab.id;
                                        return (
                                          <button
                                            key={tab.id}
                                            ref={(el) => {
                                              tabRefs.current[tab.id] = el;
                                            }}
                                            onClick={() => handleTabIndicatorClick(tab.id)}
                                            className="px-2 py-1 text-sm font-medium transition-colors duration-200 cursor-pointer outline-none shrink-0"
                                            style={{
                                              color: isActive ? "#1a1a1a" : "#999999",
                                              fontWeight: isActive ? 500 : 400,
                                            }}
                                          >
                                            {tab.symbol}
                                          </button>
                                        );
                                      })}
                                      
                                      {/* Track Line */}
                                      <div 
                                        className="absolute bottom-0 left-0 right-0" 
                                        style={{ height: "1.5px", backgroundColor: "#e0e0e0" }}
                                      />
                                      
                                      {/* Sliding Indicator Line */}
                                      <div
                                        className="absolute bottom-0"
                                        style={{
                                          height: "2px",
                                          backgroundColor: "#1a1a1a",
                                          borderRadius: "2px",
                                          left: `${indicatorStyle.left}px`,
                                          width: `${indicatorStyle.width}px`,
                                          transition: "left 0.3s cubic-bezier(0.16, 1, 0.3, 1), width 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollIn>
            </div>
          </div>
        )}

        {activeViewTab === "completed" && (
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-4">
              <ScrollIn delay={0.2} translateY={20}>
                <div className="bg-white border border-zinc-200/90 rounded-[2rem] overflow-hidden shadow-sm flex flex-col group transition-all duration-500 h-auto">
                  <div className="px-6 py-5 flex items-center justify-between bg-zinc-50/60 border-b border-zinc-150">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.25)]"></div>
                      <h3 className="font-extrabold text-lg sm:text-xl tracking-tight text-zinc-800">
                        已完成交易
                      </h3>
                      <span className="text-xs font-black border border-blue-200 bg-blue-50 text-blue-700 px-3 py-1 rounded-full shadow-sm">
                        <AnimatedNumber value={completedTabs.length} /> 檔個股
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept="application/json"
                        className="hidden"
                        ref={completedJsonFileInputRef}
                        onChange={handleImportCompletedTabsJson}
                      />
                      <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-xl p-1 shadow-sm">
                        <button
                          type="button"
                          onClick={handleExportCompletedTabsJson}
                          disabled={isExportingCompleted}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 transition-all text-xs font-bold leading-none select-none cursor-pointer disabled:opacity-50"
                          title="匯出 JSON 備份"
                        >
                          <Download className="w-3.5 h-3.5" />
                          匯出 Json
                        </button>
                        <div className="w-[1px] h-3 bg-zinc-200 shrink-0" />
                        <button
                          type="button"
                          onClick={() => completedJsonFileInputRef.current?.click()}
                          disabled={isImportingCompleted}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 transition-all text-xs font-bold leading-none select-none cursor-pointer disabled:opacity-50"
                          title="匯入 JSON 備份"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          匯入 Json
                        </button>
                      </div>
                      <TrendingUp className="h-5 w-5 text-zinc-500 opacity-80" />
                    </div>
                  </div>
                  <div className="bg-transparent">
                    <div className="overflow-hidden">
                      <div className="p-6 flex flex-col min-h-[200px]">
                        <AnimatePresence mode="wait">
                          {completedTabs.length === 0 ? (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="h-full flex flex-col items-center justify-center text-zinc-500 flex-1 py-16"
                            >
                              <div className="bg-zinc-50 p-5 border border-zinc-200 rounded-full mb-4">
                                <TrendingUp className="h-10 w-10 text-zinc-400" />
                              </div>
                              <p className="text-base font-black text-zinc-700 tracking-wide">
                                尚無已完成交易
                              </p>
                              <p className="text-xs text-zinc-405 mt-1 text-center max-w-xs leading-relaxed">
                                您可以在個股頁面將其狀態更新為「已完成」，交易紀錄即會整理並儲存在此。
                              </p>
                            </motion.div>
                          ) : (
                            <div className="space-y-8">
                              {realCompletedTabs.length > 0 && (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 border-l-4 border-emerald-500 pl-3">
                                    <h4 className="text-xs font-black text-emerald-800 tracking-widest uppercase">
                                      真實交易 (Real Trades)
                                    </h4>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {realCompletedTabs.map((tab, idx) => (
                                      <motion.div
                                        layout
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        whileHover={{ scale: 1.02, y: -2 }}
                                        key={tab.id}
                                        onClick={() =>
                                          navigate(`/stock/${tab.id}`)
                                        }
                                        onMouseEnter={() => tab.symbol && prefetchStockPrice(tab.symbol)}
                                        className="bg-white border border-zinc-200/85 hover:border-zinc-350 shadow-sm hover:shadow-md p-5 rounded-2xl cursor-pointer relative overflow-hidden group/item flex items-center justify-between transition-all duration-300"
                                      >
                                        <div className="relative z-10 flex flex-col gap-1">
                                          <div className="font-extrabold text-xl tracking-tight text-zinc-850">
                                            {tab.symbol}
                                          </div>
                                          <div className="text-xs font-semibold text-zinc-500 truncate max-w-[150px]">
                                            {tab.companyName || "實盤交易已結算"}
                                          </div>
                                        </div>
                                        <div className="relative z-10">
                                          {(() => {
                                            const val = tab.finalPnL || 0;
                                            const isProfit = val >= 0;
                                            return (
                                              <div className={`px-4 py-2 rounded-xl flex flex-col items-end border transition-all ${
                                                isProfit 
                                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-[0_2px_8px_rgba(16,185,129,0.03)]" 
                                                  : "bg-rose-50 text-rose-700 border-rose-200/80 shadow-[0_2px_8px_rgba(244,63,94,0.03)]"
                                              }`}>
                                                <span className="text-[9px] font-black uppercase tracking-wider opacity-80 mb-0.5">結算損益</span>
                                                <span className="font-mono text-base font-black">
                                                  {isProfit ? "+" : ""}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {completedTabs.filter(
                                (t) => t.tradeType === "simulated",
                              ).length > 0 && (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 border-l-4 border-amber-500 pl-3">
                                    <h4 className="text-xs font-black text-amber-800 tracking-widest uppercase">
                                      模擬交易 (Simulated Trades)
                                    </h4>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {completedTabs
                                      .filter(
                                        (t) => t.tradeType === "simulated",
                                      )
                                      .map((tab, idx) => (
                                        <motion.div
                                          layout
                                          initial={{ opacity: 0, y: 15 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ delay: idx * 0.05 }}
                                          whileHover={{ scale: 1.02, y: -2 }}
                                          key={tab.id}
                                          onClick={() =>
                                            navigate(`/stock/${tab.id}`)
                                          }
                                          onMouseEnter={() => tab.symbol && prefetchStockPrice(tab.symbol)}
                                          className="bg-white border border-zinc-200/85 hover:border-zinc-350 shadow-sm hover:shadow-md p-5 rounded-2xl cursor-pointer relative overflow-hidden group/item flex items-center justify-between transition-all duration-300"
                                        >
                                          <div className="relative z-10 flex flex-col gap-1">
                                            <div className="font-extrabold text-xl tracking-tight text-zinc-850">
                                              {tab.symbol}
                                            </div>
                                            <div className="text-xs font-semibold text-zinc-500 truncate max-w-[150px]">
                                              {tab.companyName || "模擬交易已結算"}
                                            </div>
                                          </div>
                                          <div className="relative z-10">
                                            {(() => {
                                              const val = tab.finalPnL || 0;
                                              const isProfit = val >= 0;
                                              return (
                                                <div className={`px-4 py-2 rounded-xl flex flex-col items-end border transition-all ${
                                                  isProfit 
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-[0_2px_8px_rgba(16,185,129,0.03)]" 
                                                    : "bg-rose-50 text-rose-700 border-rose-200/80 shadow-[0_2px_8px_rgba(244,63,94,0.03)]"
                                                }`}>
                                                  <span className="text-[9px] font-black uppercase tracking-wider opacity-80 mb-0.5">預估損益</span>
                                                  <span className="font-mono text-base font-black">
                                                    {isProfit ? "+" : ""}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                  </span>
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        </motion.div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollIn>
              </div>
            </div>
          )}

        {activeViewTab === "notes" && (() => {
          return (
            <div className="space-y-6">
              {filledCategories.map((cat) => {
                    const filteredTabs = visibleActiveTabs.filter(
                      (t) => getDisplayHoldingStatus(t.holdingStatus) === cat
                    );
                    const isExpanded = notesExpandedCategories[cat] !== false;
                    const highlightedStocksInCat = filteredTabs.filter(
                      (t) => !!activeTabStrategies[t.id]?.notesHighlighted
                    );
                    const conf = holdingTabConfig[cat];

                    return (
                      <div
                        key={cat}
                        className={`bg-white border rounded-[1.5rem] shadow-sm transition-all duration-300 overflow-hidden ${
                          isExpanded ? "border-zinc-300 shadow-md ring-1 ring-zinc-100" : "border-zinc-200 hover:border-zinc-300 hover:shadow-md"
                        }`}
                      >
                        {/* Section Header */}
                        <div 
                          className={`px-5 py-4 flex items-center justify-between cursor-pointer select-none transition-all duration-300 ${
                            isExpanded ? `border-b border-zinc-200 ${conf.bgClass}/50` : "hover:bg-zinc-50/50"
                          }`}
                          onClick={() => toggleNotesCategory(cat)}
                        >
                          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-3 shrink-0">
                              {(() => {
                                const CatIcon = conf.icon;
                                return (
                                  <div className={`p-1.5 rounded-lg border ${conf.borderClass} ${conf.bgClass} flex items-center justify-center`}>
                                    <CatIcon className={`w-3.5 h-3.5 ${conf.colorClass}`} />
                                  </div>
                                );
                              })()}
                              <span className="text-base font-extrabold text-zinc-900 tracking-tight">
                                {cat}
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${conf.activeCountClass}`}>
                                {filteredTabs.length} 檔
                              </span>
                            </div>
                            
                            {highlightedStocksInCat.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 ml-1.5 border-l border-zinc-200 pl-3">
                                {highlightedStocksInCat.map((tab) => {
                                  const strat = activeTabStrategies[tab.id] || {};
                                  const actions = [];
                                  if (strat.tpChecked) actions.push({ label: "止盈", color: "bg-emerald-50 text-emerald-700 border-emerald-200/80" });
                                  if (strat.slChecked) actions.push({ label: "止損", color: "bg-rose-50 text-rose-700 border-rose-200/80" });
                                  if (strat.addChecked) actions.push({ label: "加碼", color: "bg-sky-50 text-sky-700 border-sky-200/80" });
                                  if (strat.closeChecked) actions.push({ label: "平倉", color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200/80" });
                                  if (strat.observeChecked) actions.push({ label: "觀察", color: "bg-zinc-100 text-zinc-700 border-zinc-300" });
                                  
                                  return (
                                    <div 
                                      key={tab.id}
                                      onClick={(e) => {
                                        // Prevent clicking the stock badge from collapsing/expanding the accordion
                                        e.stopPropagation();
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-50 border border-zinc-200 text-[10px] font-bold"
                                    >
                                      <span className="text-amber-805 whitespace-nowrap font-extrabold">{tab.symbol}</span>
                                      <span className="text-zinc-500 font-medium max-w-[60px] truncate hidden md:inline">({tab.companyName || "-"})</span>
                                      {actions.length > 0 && (
                                        <div className="flex items-center gap-0.5 ml-0.5">
                                          {actions.map((act, i) => (
                                            <span 
                                              key={i} 
                                              className={`text-[9px] px-0.5 py-0 rounded border ${act.color} font-black whitespace-nowrap`}
                                            >
                                              {act.label}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-center p-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-all shrink-0">
                            <ChevronDown 
                              className={`w-4 h-4 text-zinc-650 transition-transform duration-300 ${
                                isExpanded ? "rotate-180 text-amber-500" : ""
                              }`}
                            />
                          </div>
                        </div>

                        {/* Collapsible Content */}
                        {isExpanded && (
                          <div className="border-t border-zinc-200 animate-in slide-in-from-top-2 duration-300 bg-white">
                            {/* Mobile Card View */}
                            <div className="flex flex-col lg:hidden divide-y divide-zinc-200">
                              {filteredTabs.map((tab) => {
                                const isHighlighted = Boolean(activeTabStrategies[tab.id]?.notesHighlighted);
                                const trades = activeTabTrades[tab.id] || [];
                                const stats = calculateStats(trades, tab.currentPrice);
                                const unrealizedPnL = stats.unrealizedPnL || 0;
                                
                                return (
                                  <div 
                                    key={`mobile-note-${tab.id}`}
                                    className={`p-4 transition-colors duration-200 ${
                                      isHighlighted ? "bg-amber-500/[0.04]" : "hover:bg-zinc-50/50"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={isHighlighted}
                                          onChange={(e) => handleUpdateNotesHighlighted(tab.id, e.target.checked)}
                                          className="h-4.5 w-4.5 rounded border-zinc-300 text-amber-500 focus:ring-offset-0 focus:ring-amber-500 cursor-pointer accent-amber-500 transition-all"
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-base font-extrabold text-zinc-900 tracking-wider">
                                            {tab.symbol}
                                          </span>
                                          <span 
                                            onClick={() => {
                                              handleSearchSelect(tab.id);
                                              setFlippedCards((prev) => ({
                                                ...prev,
                                                [tab.id]: true,
                                              }));
                                            }}
                                            className="text-[11px] font-bold text-zinc-500 hover:text-amber-805 hover:underline truncate max-w-[160px] cursor-pointer transition-colors mt-0.5"
                                          >
                                            {tab.companyName || tab.symbol}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-right flex flex-col items-end">
                                        <span className="text-sm font-mono text-zinc-900 font-extrabold">
                                          {tab.currentPrice !== undefined && tab.currentPrice > 0 ? tab.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                        </span>
                                        <span className="text-[10px] text-zinc-400 mt-0.5 uppercase font-black tracking-wider">現價</span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 mb-4 bg-zinc-50/50 p-3.5 rounded-xl border border-zinc-150">
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase mb-1 tracking-wider">平均成本</span>
                                        <span className="text-xs font-mono text-zinc-800 font-bold">
                                          {Math.abs(stats.totalQuantity) > 0 && stats.averagePrice > 0 ? stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                        </span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase mb-1 tracking-wider">未實現損益</span>
                                        <span className="text-xs font-mono font-bold">
                                          {Math.abs(stats.totalQuantity) > 0 && unrealizedPnL !== 0 ? (
                                            <span className={unrealizedPnL > 0 ? "text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" : "text-rose-700 font-extrabold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100"}>
                                              {unrealizedPnL > 0 ? "+" : ""}{unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                          ) : (
                                            <span className="text-zinc-400">-</span>
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex flex-col text-right">
                                        <span className="text-[10px] font-black text-zinc-400 uppercase mb-1 tracking-wider">持有股數</span>
                                        <span className="text-xs font-mono text-zinc-800 font-bold">
                                          {Math.abs(stats.totalQuantity) > 0 ? stats.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "-"}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-5 gap-2 mb-4 bg-zinc-50/20 p-2 border border-zinc-150 rounded-xl">
                                      <div className="flex flex-col items-center justify-center py-1.5">
                                        <span className="text-[10px] font-black text-zinc-500 mb-2">止盈</span>
                                        <input type="checkbox" checked={!!activeTabStrategies[tab.id]?.tpChecked} onChange={(e) => handleUpdateTPChecked(tab.id, e.target.checked)} className="h-4.5 w-4.5 rounded border-zinc-350 bg-white checked:bg-emerald-600 checked:border-emerald-600 text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-600 transition-all shadow-sm" />
                                      </div>
                                      <div className="flex flex-col items-center justify-center py-1.5">
                                        <span className="text-[10px] font-black text-zinc-500 mb-2">止損</span>
                                        <input type="checkbox" checked={!!activeTabStrategies[tab.id]?.slChecked} onChange={(e) => handleUpdateSLChecked(tab.id, e.target.checked)} className="h-4.5 w-4.5 rounded border-zinc-350 bg-white checked:bg-rose-600 checked:border-rose-600 text-rose-600 focus:ring-0 cursor-pointer accent-rose-600 transition-all shadow-sm" />
                                      </div>
                                      <div className="flex flex-col items-center justify-center py-1.5">
                                        <span className="text-[10px] font-black text-zinc-500 mb-2">加碼</span>
                                        <input type="checkbox" checked={!!activeTabStrategies[tab.id]?.addChecked} onChange={(e) => handleUpdateAddChecked(tab.id, e.target.checked)} className="h-4.5 w-4.5 rounded border-zinc-350 bg-white checked:bg-sky-600 checked:border-sky-600 text-sky-600 focus:ring-0 cursor-pointer accent-sky-600 transition-all shadow-sm" />
                                      </div>
                                      <div className="flex flex-col items-center justify-center py-1.5">
                                        <span className="text-[10px] font-black text-zinc-500 mb-2">平倉</span>
                                        <input type="checkbox" checked={!!activeTabStrategies[tab.id]?.closeChecked} onChange={(e) => handleUpdateCloseChecked(tab.id, e.target.checked)} className="h-4.5 w-4.5 rounded border-zinc-350 bg-white checked:bg-violet-600 checked:border-violet-600 text-violet-600 focus:ring-0 cursor-pointer accent-violet-600 transition-all shadow-sm" />
                                      </div>
                                      <div className="flex flex-col items-center justify-center py-1.5">
                                        <span className="text-[10px] font-black text-zinc-500 mb-2">觀察</span>
                                        <input id="observe-input-tab" type="checkbox" checked={!!activeTabStrategies[tab.id]?.observeChecked} onChange={(e) => handleUpdateObserveChecked(tab.id, e.target.checked)} className="h-4.5 w-4.5 rounded border-zinc-350 bg-white checked:bg-zinc-650 checked:border-zinc-650 text-zinc-650 focus:ring-0 cursor-pointer accent-zinc-650 transition-all shadow-sm" />
                                      </div>
                                    </div>

                                    <div>
                                      <span className="text-[10px] font-black text-zinc-500 mb-2 block tracking-wider">操作重點</span>
                                      <textarea
                                        value={activeTabStrategies[tab.id]?.operationFocus || ""}
                                        onChange={(e) => handleUpdateOperationFocus(tab.id, e.target.value)}
                                        placeholder="點擊輸入操作重點..."
                                        rows={4}
                                        className="w-full bg-white border border-zinc-250/80 focus:border-amber-500 focus:shadow-[0_0_12px_rgba(245,158,11,0.08)] text-zinc-800 text-xs rounded-xl p-3 focus:ring-0 outline-none resize-y transition-all min-h-[100px] font-medium leading-relaxed font-sans shadow-inner overflow-auto"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Desktop Table View */}
                            <div className="overflow-x-auto hidden lg:block pb-1">
                              <table className="w-full text-left border-collapse table-fixed">
                              <thead>
                                <tr className="border-b border-zinc-200 bg-zinc-50/50">
                                  <th className="w-[115px] py-2.5 px-4 text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                                    選取 / 股票代號
                                  </th>
                                  <th className="w-[125px] py-2.5 px-3 text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                                    股票名稱
                                  </th>
                                  <th className="w-[85px] py-2.5 px-3 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-right">
                                    現價
                                  </th>
                                  <th className="w-[85px] py-2.5 px-3 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-right">
                                    平均成本
                                  </th>
                                  <th className="w-[100px] py-2.5 px-3 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-right">
                                    未實現損益
                                  </th>
                                  <th className="w-[85px] py-2.5 px-3 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-right">
                                    持有股數
                                  </th>
                                  <th className="w-[54px] py-2.5 px-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-center">
                                    止盈
                                  </th>
                                  <th className="w-[54px] py-2.5 px-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-center">
                                    止損
                                  </th>
                                  <th className="w-[54px] py-2.5 px-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-center">
                                    加碼
                                  </th>
                                  <th className="w-[54px] py-2.5 px-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-center">
                                    平倉
                                  </th>
                                  <th className="w-[54px] py-2.5 px-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider text-center">
                                    觀察
                                  </th>
                                  <th className="py-2.5 px-4 text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                                    操作重點
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-200">
                                {filteredTabs.map((tab) => {
                                  const isHighlighted = !!activeTabStrategies[tab.id]?.notesHighlighted;
                                  const trades = activeTabTrades[tab.id] || [];
                                  const stats = calculateStats(trades, tab.currentPrice);
                                  const unrealizedPnL = stats.unrealizedPnL || 0;
                                  
                                  return (
                                    <tr
                                      key={tab.id}
                                      id={`notes-row-${tab.id}`}
                                      className={`transition-colors duration-200 ${
                                        isHighlighted
                                          ? "bg-amber-500/10 hover:bg-amber-500/15"
                                          : "hover:bg-zinc-50"
                                      }`}
                                    >
                                      <td className="py-2.5 px-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={isHighlighted}
                                            onChange={(e) => handleUpdateNotesHighlighted(tab.id, e.target.checked)}
                                            className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-amber-500 checked:border-amber-500 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500 transition-all"
                                          />
                                          <span className="text-xs font-bold text-zinc-800 tracking-wide">
                                            {tab.symbol}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span 
                                          onClick={() => {
                                            handleSearchSelect(tab.id);
                                            setFlippedCards((prev) => ({
                                              ...prev,
                                              [tab.id]: true,
                                            }));
                                          }}
                                          className="text-xs font-semibold text-zinc-650 hover:text-amber-700 block truncate cursor-pointer transition-colors duration-200 hover:underline" 
                                          title="點擊前往持有中該股卡片並翻面數據圖示化"
                                        >
                                          {tab.companyName || tab.symbol}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono text-xs text-zinc-800 font-bold">
                                        {tab.currentPrice !== undefined && tab.currentPrice > 0 ? tab.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono text-xs text-zinc-800">
                                        {Math.abs(stats.totalQuantity) > 0 && stats.averagePrice > 0 ? stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono text-xs">
                                        {Math.abs(stats.totalQuantity) > 0 && unrealizedPnL !== 0 ? (
                                          <span className={`${unrealizedPnL > 0 ? "text-emerald-700 font-extrabold" : "text-rose-700 font-extrabold"}`}>
                                            {unrealizedPnL > 0 ? "+" : ""}{unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </span>
                                        ) : (
                                          <span className="text-zinc-400">-</span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono text-xs text-zinc-800">
                                        {Math.abs(stats.totalQuantity) > 0 ? stats.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "-"}
                                      </td>
                                      <td className="py-2.5 px-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.tpChecked}
                                          onChange={(e) => handleUpdateTPChecked(tab.id, e.target.checked)}
                                          className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-emerald-500 checked:border-emerald-500 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500 transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-2.5 px-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.slChecked}
                                          onChange={(e) => handleUpdateSLChecked(tab.id, e.target.checked)}
                                          className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-rose-500 checked:border-rose-500 text-rose-500 focus:ring-0 cursor-pointer accent-rose-500 transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-2.5 px-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.addChecked}
                                          onChange={(e) => handleUpdateAddChecked(tab.id, e.target.checked)}
                                          className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-sky-500 checked:border-sky-500 text-sky-500 focus:ring-0 cursor-pointer accent-sky-500 transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-2.5 px-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.closeChecked}
                                          onChange={(e) => handleUpdateCloseChecked(tab.id, e.target.checked)}
                                          className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-violet-500 checked:border-violet-500 text-violet-500 focus:ring-0 cursor-pointer accent-violet-500 transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-2.5 px-2 text-center">
                                        <input
                                          id="observe-input-row"
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.observeChecked}
                                          onChange={(e) => handleUpdateObserveChecked(tab.id, e.target.checked)}
                                          className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-[#929292] checked:border-[#929292] text-[#929292] focus:ring-0 cursor-pointer accent-[#929292] transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-2 px-4">
                                        <textarea
                                          value={activeTabStrategies[tab.id]?.operationFocus || ""}
                                          onChange={(e) => handleUpdateOperationFocus(tab.id, e.target.value)}
                                          placeholder="點擊輸入操作重點..."
                                          rows={4}
                                          className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:border-amber-500/50 text-zinc-800 text-xs rounded-lg p-2 focus:ring-1 focus:ring-amber-500/50 outline-none resize-y transition-colors min-h-[90px] font-medium overflow-auto"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

      {/* Operation Focus and Flip Dialog */}
      <Dialog
        open={!!visualizerFocusTabId}
        onOpenChange={(open) => {
          if (!open) setVisualizerFocusTabId(null);
        }}
      >
        <DialogContent className="border-zinc-300 shadow-2xl bg-white text-zinc-900 max-w-[420px] p-6 rounded-3xl border">
          <DialogHeader className="mb-4">
            <DialogTitle className="font-extrabold text-xl text-zinc-900 flex items-center justify-center gap-2">
              <span className="text-xl">📊</span>
              {(() => {
                const t = tabs.find((x) => x.id === visualizerFocusTabId);
                return t ? `${t.symbol} 操作設定` : "個股操作設定";
              })()}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-indigo-650 tracking-wider flex items-center gap-1.5 font-sans">
                <span>📝 編輯個股操作重點</span>
              </label>
              <textarea
                value={visualizerFocusText}
                onChange={(e) => setVisualizerFocusText(e.target.value)}
                placeholder="在此編輯您的操作策略或關鍵觀察..."
                className="w-full h-36 bg-zinc-50 border border-zinc-200 focus:border-indigo-500 text-zinc-850 placeholder-zinc-450 text-sm rounded-xl p-3 focus:ring-1 focus:ring-indigo-500/30 outline-none resize-none transition-all font-semibold font-sans text-zinc-800"
              />
            </div>
            {visualizerFocusTabId && (
              <div className="grid grid-cols-6 gap-2">
                <div className="flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => handleUpdateNotesHighlighted(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.notesHighlighted)}>
                  <span className="text-[10px] font-black text-zinc-600 mb-2 pointer-events-none">選取</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.notesHighlighted} onChange={(e) => handleUpdateNotesHighlighted(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-indigo-600 checked:border-indigo-600 text-indigo-600 focus:ring-0 cursor-pointer accent-indigo-600 transition-all" />
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => handleUpdateTPChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.tpChecked)}>
                  <span className="text-[10px] font-black text-zinc-600 mb-2 pointer-events-none">止盈</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.tpChecked} onChange={(e) => handleUpdateTPChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border-zinc-300 bg-white checked:bg-emerald-600 checked:border-emerald-600 text-emerald-600 focus:ring-0 cursor-pointer accent-emerald-600 transition-all font-black" />
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => handleUpdateSLChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.slChecked)}>
                  <span className="text-[10px] font-black text-zinc-600 mb-2 pointer-events-none">止損</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.slChecked} onChange={(e) => handleUpdateSLChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border-zinc-300 bg-white checked:bg-rose-500 checked:border-rose-500 text-rose-500 focus:ring-0 cursor-pointer accent-rose-500 transition-all font-black" />
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => handleUpdateAddChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.addChecked)}>
                  <span className="text-[10px] font-black text-zinc-600 mb-2 pointer-events-none">加碼</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.addChecked} onChange={(e) => handleUpdateAddChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-sky-500 checked:border-sky-500 text-sky-500 focus:ring-0 cursor-pointer accent-sky-500 transition-all font-black" />
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => handleUpdateCloseChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.closeChecked)}>
                  <span className="text-[10px] font-black text-zinc-600 mb-2 pointer-events-none">平倉</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.closeChecked} onChange={(e) => handleUpdateCloseChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-violet-500 checked:border-violet-500 text-violet-500 focus:ring-0 cursor-pointer accent-violet-500 transition-all font-black" />
                </div>
                <div className="flex flex-col items-center justify-center bg-zinc-50 border border-zinc-200 rounded-xl py-2.5 hover:bg-zinc-100 transition-colors cursor-pointer" onClick={() => handleUpdateObserveChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.observeChecked)}>
                  <span className="text-[10px] font-black text-zinc-600 mb-2 pointer-events-none">觀察</span>
                  <input id="observe-input-focus" type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.observeChecked} onChange={(e) => handleUpdateObserveChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border border-zinc-300 bg-white checked:bg-zinc-500 checked:border-zinc-500 text-zinc-500 focus:ring-0 cursor-pointer accent-zinc-500 transition-all font-black" />
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={async () => {
                if (visualizerFocusTabId) {
                  await handleUpdateOperationFocus(visualizerFocusTabId, visualizerFocusText);
                  toast.success("操作重點已儲存 🚀");
                }
                setVisualizerFocusTabId(null);
              }}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
            >
              <span>儲存操作重點</span>
            </button>

            <button
              onClick={async () => {
                if (visualizerFocusTabId) {
                  await handleUpdateOperationFocus(visualizerFocusTabId, visualizerFocusText);
                  
                  // Go to the specific stock notes section in notes view
                  setActiveViewTab("notes");
                  
                  const currentTab = tabs.find((t) => t.id === visualizerFocusTabId);
                  if (currentTab) {
                    const cat = getDisplayHoldingStatus(currentTab.holdingStatus);
                    setNotesExpandedCategories((prev) => ({
                      ...prev,
                      [cat]: true,
                    }));
                  }
                  
                  const tabIdToScroll = visualizerFocusTabId;
                  setTimeout(() => {
                    const rowElement = document.getElementById(`notes-row-${tabIdToScroll}`);
                    if (rowElement) {
                      rowElement.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                      
                      rowElement.style.transition = "all 0.5s ease-in-out";
                      const originalBg = rowElement.style.backgroundColor;
                      rowElement.style.backgroundColor = "rgba(245, 158, 11, 0.25)";
                      setTimeout(() => {
                        rowElement.style.backgroundColor = originalBg;
                      }, 1500);
                    }
                  }, 300);

                  toast.success("已儲存筆記並前往該操作重點 🚀");
                }
                setVisualizerFocusTabId(null);
              }}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_12px_rgba(79,70,229,0.2)]"
            >
              <span>前往該操作重點</span>
            </button>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => {
                  if (visualizerFocusTabId) {
                    setFlippedCards((prev) => ({
                      ...prev,
                      [visualizerFocusTabId]: false,
                    }));
                  }
                  setVisualizerFocusTabId(null);
                }}
                className="py-2.5 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-850 border border-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>僅翻回前面</span>
              </button>
              
              <button
                onClick={() => setVisualizerFocusTabId(null)}
                className="py-2.5 px-3 bg-zinc-50 hover:bg-rose-50 text-zinc-500 hover:text-rose-600 border border-zinc-200 hover:border-rose-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>取消</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}
