import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
import { useStockTabs } from "../hooks/useStockTabs";
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
) {
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
  return errInfo;
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
    colorClass: "text-sky-400",
    bgClass: "bg-sky-500/10",
    borderClass: "border-sky-500/30",
    shadowClass: "shadow-[0_0_12px_rgba(56,189,248,0.15)]",
    activeCountClass: "bg-sky-500/20 text-sky-300 border-sky-400/30",
  },
  "候選名單": {
    icon: Star,
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/30",
    shadowClass: "shadow-[0_0_12px_rgba(245,158,11,0.15)]",
    activeCountClass: "bg-amber-500/20 text-amber-300 border-amber-400/30",
  },
  "買進操作": {
    icon: TrendingUp,
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/30",
    shadowClass: "shadow-[0_0_12px_rgba(52,211,153,0.15)]",
    activeCountClass: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  },
  "賣出操作": {
    icon: TrendingDown,
    colorClass: "text-rose-400",
    bgClass: "bg-rose-500/10",
    borderClass: "border-rose-500/30",
    shadowClass: "shadow-[0_0_12px_rgba(251,113,133,0.15)]",
    activeCountClass: "bg-rose-500/20 text-rose-300 border-rose-400/30",
  },
  "平倉操作": {
    icon: CheckCircle2,
    colorClass: "text-fuchsia-400",
    bgClass: "bg-fuchsia-500/10",
    borderClass: "border-fuchsia-500/30",
    shadowClass: "shadow-[0_0_12px_rgba(232,121,249,0.15)]",
    activeCountClass: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/30",
  },
  "乖離名單": {
    icon: Activity,
    colorClass: "text-indigo-400",
    bgClass: "bg-indigo-500/10",
    borderClass: "border-indigo-500/30",
    shadowClass: "shadow-[0_0_12px_rgba(129,140,248,0.15)]",
    activeCountClass: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30",
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
  const [activeViewTab, setActiveViewTab] = useState<
    "active" | "completed" | "socrates" | "alerts" | "notes"
  >("active");
  const [activeHoldingSubTab, setActiveHoldingSubTab] = useState<
    "觀察中" | "候選名單" | "買進操作" | "賣出操作" | "平倉操作" | "乖離名單"
  >((sessionStorage.getItem('preferredHoldingSubTab') as any) || "候選名單");

  useEffect(() => {
    sessionStorage.setItem('preferredHoldingSubTab', activeHoldingSubTab);
  }, [activeHoldingSubTab]);
  const [activeManageTab, setActiveManageTab] = useState<
    "觀察中" | "候選名單" | "買進操作" | "賣出操作" | "平倉操作" | "乖離名單" | "持股監控"
  >("觀察中");
  const [groupingTabId, setGroupingTabId] = useState<string | null>(null);
  const [activeTabStrategies, setActiveTabStrategies] = useState<

    Record<string, any>
  >({});
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

  // Synchronize socrates highlighted rows and sort weights with localStorage keyed by user
  useEffect(() => {
    const userKey = user ? user.uid : "guest";
    
    // Load highlighted rows
    const savedHighlights = localStorage.getItem(`socrates-highlighted-rows-${userKey}`);
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
    const savedWeights = localStorage.getItem(`socrates-sort-weights-${userKey}`);
    if (savedWeights) {
      try {
        setSocratesSortWeights(JSON.parse(savedWeights));
      } catch (e) {
        console.error("Failed to parse saved Socrates sort weights", e);
      }
    }

    socratesLoadedUserRef.current = userKey;
  }, [user]);

  // Save highlights when modified
  useEffect(() => {
    const userKey = user ? user.uid : "guest";
    if (socratesLoadedUserRef.current === userKey) {
      localStorage.setItem(`socrates-highlighted-rows-${userKey}`, JSON.stringify(socratesHighlightedRows));
    }
  }, [socratesHighlightedRows, user]);

  // Save sort weights when modified
  useEffect(() => {
    const userKey = user ? user.uid : "guest";
    if (socratesLoadedUserRef.current === userKey) {
      localStorage.setItem(`socrates-sort-weights-${userKey}`, JSON.stringify(socratesSortWeights));
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
      [cat]: !prev[cat],
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

  const handleUpdateStrategyField = async (tabId: string, field: string, checked: boolean) => {
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

  const onDragStart = (e: React.MouseEvent) => {
    const ele = carouselRef.current;
    if (!ele) return;

    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }

    dragRef.current.isDragging = true;
    dragRef.current.hasDraggedBeyondThreshold = false;
    dragRef.current.startX = e.pageX - ele.offsetLeft;
    dragRef.current.scrollLeft = ele.scrollLeft;
    dragRef.current.lastX = e.pageX;
    dragRef.current.vx = 0;

    // Disable snap behavior during drag for smooth swiping
    ele.style.scrollSnapType = "none";
    ele.style.cursor = "grabbing";
    document.body.style.userSelect = "none"; // Prevent text selection
  };

  const onDragMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current.isDragging) return;

    const ele = carouselRef.current;
    if (!ele) return;

    const x = e.pageX - ele.offsetLeft;
    const dx = x - dragRef.current.startX;

    dragRef.current.vx = e.pageX - dragRef.current.lastX;
    dragRef.current.lastX = e.pageX;

    if (Math.abs(dx) > DRAG_THRESHOLD) {
      dragRef.current.hasDraggedBeyondThreshold = true;
      if (e.cancelable) {
        e.preventDefault(); // Prevent scrolling the page while dragging horizontally
      }
    }

    ele.scrollLeft = dragRef.current.scrollLeft - dx;
  }, []);

  const onDragEnd = useCallback(() => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;

    const ele = carouselRef.current;
    if (ele) {
      ele.style.cursor = "grab";

      const loop = () => {
        if (Math.abs(dragRef.current.vx) < 0.5) {
          ele.style.scrollSnapType = "x mandatory"; // Re-enable snap to auto-align
          animFrameId.current = null;
          return;
        }
        dragRef.current.vx *= 0.95; // decay
        ele.scrollLeft -= dragRef.current.vx;
        animFrameId.current = requestAnimationFrame(loop);
      };

      if (Math.abs(dragRef.current.vx) > 1) {
        animFrameId.current = requestAnimationFrame(loop);
      } else {
        ele.style.scrollSnapType = "x mandatory";
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
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
    return () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
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

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSymbol.trim()) {
      addTab(newSymbol.trim(), newCompany.trim(), newTradeType);
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
        const saved = localStorage.getItem("socrates-data");
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
            localStorage.removeItem("socrates-data");
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

  useEffect(() => {
    // Quick count of pending orders and fetch recent trades across all active tabs
    const fetchTabData = async () => {
      if (!user) return;
      let count = 0;
      const ordersMap: Record<string, any[]> = {};
      const tradesMap: Record<string, any[]> = {};
      const strategiesMap: Record<string, any> = {};

      const activeTabs = tabs.filter((t) => t.status === "ACTIVE");

      for (const tab of activeTabs) {
        // Fetch pending orders
        const qOrders = query(
          collection(db, `stockTabs/${tab.id}/plannedOrders`),
          where("status", "==", "PENDING"),
        );
        const snapshotOrders = await getDocs(qOrders);
        count += snapshotOrders.size;
        ordersMap[tab.id] = snapshotOrders.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Fetch trades
        const qTrades = query(collection(db, `stockTabs/${tab.id}/trades`));
        const snapshotTrades = await getDocs(qTrades);
        tradesMap[tab.id] = snapshotTrades.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Fetch strategy
        const qStrategy = query(collection(db, `stockTabs/${tab.id}/strategy`));
        const snapshotStrategy = await getDocs(qStrategy);
        const mainStrategy = snapshotStrategy.docs.find((d) => d.id === "main");
        if (mainStrategy) {
          strategiesMap[tab.id] = mainStrategy.data();
        }
      }
      setActiveTabOrders(ordersMap);
      setActiveTabTrades(tradesMap);
      setActiveTabStrategies(strategiesMap);
    };
    if (tabs.length > 0) {
      fetchTabData();
    }
  }, [tabs, user]);

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
            block: "nearest",
            inline: "center",
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
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key === "F") {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Shift + A for Add Stock
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key === "A") {
        e.preventDefault();
        setIsAddOpen(true);
        return;
      }

      // Shift + I for Import Latest Prices
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key === "I") {
        e.preventDefault();
        handleImportLatestPrices();
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
        } else if (e.code === "Digit3") {
          e.preventDefault();
          setActiveViewTab("completed");
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
  const visibleActiveTabs = activeTabs.filter((t) => !t.isHidden);
  const hiddenActiveTabs = activeTabs.filter((t) => t.isHidden);

  // further categorize visible tabs based on holdingStatus for rendering
  const currentSubTabVisibleTabs = visibleActiveTabs.filter(
    (t) => getDisplayHoldingStatus(t.holdingStatus) === activeHoldingSubTab,
  );
  visibleTabsRef.current = currentSubTabVisibleTabs;

  const renderGroups = useMemo(() => {
    const groups: { isGroup: boolean; id: string; tabs: any[] }[] = [];
    const processedGroupIds = new Set<string>();
    
    currentSubTabVisibleTabs.forEach((tab) => {
      if (tab.groupId) {
        if (!processedGroupIds.has(tab.groupId)) {
          processedGroupIds.add(tab.groupId);
          const allGroupTabs = visibleActiveTabs.filter(t => t.groupId === tab.groupId);
          groups.push({
            isGroup: true,
            id: tab.groupId,
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
  }, [currentSubTabVisibleTabs, visibleActiveTabs]);

  const completedTabs = tabs.filter((t) => t.status === "COMPLETED");

  const handleSmartSuggestion = async (tab: any) => {
    if (!tab) return;

    setIsGeneratingSuggestion(true);
    toast.loading("AI 正在動態分析並更新策略...", {
      id: "ai-smart-suggestion",
    });

    try {
      const { GoogleGenAI } = await import("@google/genai");
      // @ts-ignore
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // Fetch the strategy
      const strategyDocRef = doc(db, `stockTabs/${tab.id}/strategy`, 'main');
      const strategySnap = await getDoc(strategyDocRef);
      const strategyData = strategySnap.exists() ? strategySnap.data() : { entries: [], tpTargets: [], slTargets: [], slConditions: "", resistanceZones: [], supportZones: [] };

      const currentPriceStr = tab.currentPrice
        ? `$${tab.currentPrice}`
        : "未知";

      const prompt = `
        你是一個量化與風控並重的選股模型設計顧問，協助建立可實際交易的選股框架。
        請根據以下的股票資訊、個股評分指標及使用者的交易計畫，給出「執行操作備註」的建議。
        請善用你內建的 Google Search 能力尋找該股票 (${tab.symbol}) 最新的新聞、財報數據或技術分析，
        並結合以下三個面相來擬定內容：
        1. 當前情境分析：結合最新現價 (${currentPriceStr})、市況與「個股評分指標」來評估目前狀況。
        2. 進場操作建議：融合當前計畫（分批進出場規劃、止盈/止損、關鍵價格門檻），給予具體的執行細節。
        3. 綜合考量與注意事項：點出潛在風險（特別是崩盤相似度、波動性等），以及距離目標價的多寡。

        請保持專業簡潔，條理分明。按照上述三大點進行段落劃分，輸出格式為純文字。

        [當前狀態]
        股票代號: ${tab.symbol}
        目前現價: ${currentPriceStr}

        [個股評分指標]
        綜合評分: ${tab.rating || "未評分"} / 10
        企業體質 (Quality): ${tab.qualityScore || "未評分"} / 10
        估值 (Value): ${tab.valueScore || "未評分"} / 10
        崩盤相似度 (Crash Similarity): ${tab.crashSimilarity || "未評分"} / 10
        看多訊號 (Buy Rate): ${tab.buyRate || "未評分"} / 10
        看空訊號 (Sell Rate): ${tab.sellRate || "未評分"} / 10
        波動性: ${tab.volatility || "未知"}
        正向價值 (Pos Value): ${Math.max(0, Number(tab.rating||5) - 5) + Math.max(0, Number(tab.qualityScore||5) - 5) + Math.max(0, Number(tab.valueScore||5) - 5) + Number(tab.buyRate||5)}
        負向價值 (Neg Value): ${Math.max(0, 5 - Number(tab.rating||5)) + Math.max(0, 5 - Number(tab.qualityScore||5)) + Math.max(0, 5 - Number(tab.valueScore||5)) + Number(tab.sellRate||5)}
        
        [交易計畫與策略紀錄]
        分批進場規劃: ${JSON.stringify(strategyData.entries)}
        止盈設定: ${JSON.stringify(strategyData.tpTargets)}
        止損設定: ${JSON.stringify(strategyData.slTargets)}
        止損條件: ${strategyData.slConditions || "無"}
        上方壓力區: ${JSON.stringify(strategyData.resistanceZones)}
        下方支撐區: ${JSON.stringify(strategyData.supportZones)}
      `;

      const result = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
      });

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
    } catch (error) {
      console.error(error);
      toast.error("AI 產生失敗，請稍後再試", { id: "ai-smart-suggestion" });
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

  const moveTabUp = async (index: number) => {
    if (index === 0) return;
    const newTabs = [...activeTabs];
    const temp = newTabs[index];
    newTabs[index] = newTabs[index - 1];
    newTabs[index - 1] = temp;
    const updates = newTabs.map((tab, idx) => ({ id: tab.id, sortOrder: idx }));
    await updateTabOrder(updates);
  };

  const moveTabDown = async (index: number) => {
    if (index === activeTabs.length - 1) return;
    const newTabs = [...activeTabs];
    const temp = newTabs[index];
    newTabs[index] = newTabs[index + 1];
    newTabs[index + 1] = temp;
    const updates = newTabs.map((tab, idx) => ({ id: tab.id, sortOrder: idx }));
    await updateTabOrder(updates);
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
    <div className={`space-y-4 sm:space-y-6 mx-auto pb-12 px-3 sm:px-4 mt-0 transition-all duration-300 ${activeViewTab === "notes" ? "max-w-6xl lg:max-w-[1450px]" : "max-w-6xl"}`}>
      <ScrollIn>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end glass-panel pt-5 pb-5 px-5 sm:px-4 sm:py-4 mb-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-blue-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
          
          <button
            onClick={logout}
            className="absolute top-5 right-5 sm:top-4 sm:right-4 z-20 h-8 w-8 flex items-center justify-center bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/50 text-white/50 hover:text-red-400 transition-all rounded-lg"
            title="登出"
          >
            <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>

          <div className="relative z-10 w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-5 sm:gap-4 border-b border-white/5 pb-3 sm:pb-2">
            <div className="w-full text-left md:text-left pt-1 sm:pt-0">
              <div className="flex items-center justify-start md:justify-start gap-2">
                <p className="text-[10px] sm:text-[10px] font-bold sm:font-medium tracking-[0.2em] sm:tracking-[0.25em] text-emerald-400 uppercase mb-1">
                  Portfolio Overview
                </p>
                <button
                  onClick={() => setIsHelpOpen(true)}
                  className="mb-1 text-white/40 hover:text-white transition-colors p-1"
                  title="快捷鍵一覽"
                >
                  <HelpCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
              <h1 className="text-4xl md:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 drop-shadow-sm leading-tight pb-1">
                交易總覽
              </h1>
            </div>
            <div className="flex flex-col sm:flex-row w-full md:w-auto items-stretch sm:items-center gap-2.5 sm:gap-2">
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger
                  render={
                    <InteractiveButton
                      noGlow
                      as="button"
                      className="h-[44px] sm:h-8 w-full sm:w-auto sm:min-w-[100px] px-3 flex items-center justify-center text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 text-[13px] sm:text-[11px] font-bold sm:font-semibold transition-all hover:bg-emerald-500/20 hover:text-emerald-300 rounded-xl sm:rounded"
                    >
                      <span>新增股票</span>
                    </InteractiveButton>
                  }
                />
                <DialogContent className="glass-panel border-white/10 shadow-2xl bg-slate-900/90 backdrop-blur-3xl text-white outline-none w-[95vw] max-w-[400px] h-auto max-h-[90vh] overflow-y-auto !rounded-3xl p-5 sm:p-6 p-safe">
                  <DialogHeader>
                    <DialogTitle className="font-bold text-2xl tracking-tight text-white mb-2">
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
                        className="font-medium text-white/70 text-base sm:text-sm"
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
                        className="bg-white/5 border-white/10 text-white placeholder-white/30 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500 h-[48px] text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="company_dashboard"
                        className="font-medium text-white/70 text-base sm:text-sm"
                      >
                        公司名稱 (選填)
                      </Label>
                      <Input
                        id="company_dashboard"
                        value={newCompany}
                        onChange={(e) => setNewCompany(e.target.value)}
                        placeholder="例如：Apple Inc."
                        className="bg-white/5 border-white/10 text-white placeholder-white/30 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500 h-[48px] text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-medium text-white/70 text-base sm:text-sm">
                        交易模式
                      </Label>
                      <Select
                        value={newTradeType}
                        onValueChange={(val: any) => setNewTradeType(val)}
                      >
                        <SelectTrigger className="w-full bg-white/5 border-white/10 text-white focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500 h-[48px] text-base">
                          <SelectValue placeholder="選擇交易模式" />
                        </SelectTrigger>
                        <SelectContent className="glass-panel border-white/10 text-white outline-none">
                          <SelectItem
                            value="simulated"
                            className="font-medium focus:bg-white/10 focus:text-white cursor-pointer px-4 text-base sm:text-sm py-3 sm:py-1"
                          >
                            <div className="flex items-center gap-3">
                              <Gamepad2 className="h-5 w-5 sm:h-4 sm:w-4 text-amber-400" />
                              模擬交易 (Simulated)
                            </div>
                          </SelectItem>
                          <SelectItem
                            value="real"
                            className="font-medium focus:bg-white/10 focus:text-white cursor-pointer px-4 text-base sm:text-sm py-3 sm:py-1"
                          >
                            <div className="flex items-center gap-3">
                              <ShieldCheck className="h-5 w-5 sm:h-4 sm:w-4 text-emerald-400" />
                              真實交易 (Real)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter className="pt-4 pb-2">
                      <button
                        type="submit"
                        className="glass-button w-full h-[52px] sm:h-auto justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 py-0 sm:py-6 text-[17px] font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.1)] rounded-xl"
                      >
                        建立交易日誌檔案
                      </button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <InteractiveButton
                onClick={handleImportLatestPrices}
                disabled={isImportingPrices || !user}
                noGlow
                as="button"
                className={`h-[44px] sm:h-8 w-full sm:w-auto sm:min-w-[100px] px-2 sm:px-3 flex items-center justify-center text-white/90 text-[13px] sm:text-[11px] font-bold sm:font-semibold transition-all hover:text-white hover:bg-white/5 border border-white/10 sm:border-white/10 rounded-xl sm:rounded bg-white/[0.03] sm:bg-transparent ${!user || isImportingPrices ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span>匯入最新現價</span>
              </InteractiveButton>
            </div>
          </div>
        </div>
      </ScrollIn>

      {/* Top Metrics Row - Hover Expandable */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 mt-3 sm:mt-4">
        {[
          {
            title: "總持股數",
            rawValue: activeTabs.length,
            prefix: "",
            suffix: "",
            decimals: 0,
            icon: Activity,
            color: "red",
            sub: `${activeTabs.length} 持有中, ${completedTabs.length} 已完成`,
            showPlus: false,
            badge: undefined as number | undefined,
          },
          {
            title: "總實現損益",
            rawValue: totalCompletedPnL,
            prefix: "$",
            suffix: "",
            decimals: 1,
            icon: TrendingUp,
            color: "emerald",
            sub: `↗ ${realCompletedTabs.length} 檔已結清`,
            pnl: totalCompletedPnL,
            showPlus: true,
          },
          {
            title: "模擬實現損益",
            rawValue: simulatedCompletedPnL,
            prefix: "$",
            suffix: "",
            decimals: 1,
            icon: Gamepad2,
            color: "amber",
            sub: "🎮 模擬模式績效記錄",
            pnl: simulatedCompletedPnL,
            showPlus: true,
          },
          {
            title: "真實交易勝率",
            rawValue: realWinRate,
            prefix: "",
            suffix: "%",
            decimals: 0,
            icon: Target,
            color: "emerald",
            sub: `共 ${realCompletedTabs.length} 筆真實交易`,
            progress: realWinRate,
            showPlus: false,
          },
          {
            title: "模擬交易勝率",
            rawValue: simulatedWinRate,
            prefix: "",
            suffix: "%",
            decimals: 0,
            icon: Gamepad2,
            color: "amber",
            sub: `共 ${simulatedCompletedTabs.length} 筆模擬交易`,
            progress: simulatedWinRate,
            showPlus: false,
          },
        ].map((metric: any, i) => (
          <ScrollIn key={i} delay={i * 0.1} className={i === 4 ? "col-span-2 sm:col-span-1" : ""}>
            <motion.div
              whileHover="hover"
              initial="rest"
              variants={cardVariants}
              className="glass-card relative group z-10 transition-all duration-300 flex flex-col justify-center min-h-[85px] sm:min-h-[90px]"
            >
              {metric.badge !== undefined && metric.badge > 0 && (
                <div className="absolute -top-2 -right-2 w-5 h-5 sm:w-6 sm:h-6 bg-red-500/90 text-white rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs border border-white/20 shadow-[0_0_15px_rgba(239,68,68,0.5)] z-30">
                  {metric.badge}
                </div>
              )}
              <div className="py-4 px-3 sm:p-4 flex justify-between items-center cursor-default">
                <div className="flex flex-col min-w-0 w-full">
                  <span className="text-[10px] sm:text-[11px] font-bold tracking-wider text-white/60 uppercase truncate leading-none">
                    {metric.title}
                  </span>
                  <div
                    className={`text-xl sm:text-xl lg:text-lg xl:text-xl 2xl:text-2xl font-black tracking-tight mt-1.5 sm:mt-[6px] leading-none ${metric.pnl !== undefined ? (metric.pnl >= 0 ? "text-emerald-400 color-glow-emerald" : "text-red-400 color-glow-red") : "text-white"} truncate`}
                    title={`${metric.showPlus && metric.rawValue > 0 ? "+" : ""}${metric.prefix}${metric.rawValue.toLocaleString(undefined, { minimumFractionDigits: metric.decimals, maximumFractionDigits: metric.decimals })}${metric.suffix}`}
                  >
                    <AnimatedNumber
                      value={metric.rawValue}
                      prefix={metric.prefix}
                      suffix={metric.suffix}
                      decimals={metric.decimals}
                      showPlus={metric.showPlus}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">
                <div className="overflow-hidden px-3 sm:px-4">
                  <div className="pb-4 md:pb-4 border-t border-white/10 pt-3 md:pt-3">
                    {metric.progress !== undefined ? (
                      <>
                        <div className="w-full bg-white/5 rounded-full h-1 sm:h-1.5 border border-white/5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${metric.progress}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="bg-gradient-to-r from-red-500 to-amber-500 h-full rounded-full"
                          ></motion.div>
                        </div>
                        <p className="text-[9px] sm:text-[10px] font-medium text-white/40 mt-1.5 md:mt-2 tracking-wide truncate">
                          {metric.sub}
                        </p>
                      </>
                    ) : (
                      <p className="text-[9px] sm:text-[10px] font-medium text-white/40 tracking-wide truncate">
                        {metric.sub}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </ScrollIn>
        ))}
      </div>

      {/* Main Panels - Tabs */}
      <div className="flex flex-row snap-x flex-nowrap w-full gap-2 sm:gap-3 border-b border-white/10 mb-4 sm:mb-6 mt-4 sm:mt-5 overflow-x-auto pt-2 pb-px scrollbar-hide">
        <button
          onClick={() => setActiveViewTab("active")}
          className={`h-[48px] snap-start flex-shrink-0 flex items-center justify-center gap-2 px-5 sm:px-6 py-3 font-bold text-base tracking-wide rounded-t-xl transition-all duration-300 relative overflow-hidden ${
            activeViewTab === "active"
              ? "bg-emerald-500/10 text-emerald-400 border border-t-emerald-500/30 border-x-emerald-500/30 border-b-transparent shadow-[0_-10px_20px_rgba(16,185,129,0.05)]"
              : "bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 border border-transparent"
          }`}
        >
          {activeViewTab === "active" && (
            <motion.div
              layoutId="tab-indicator-active"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"
            />
          )}
          <Activity
            className={`w-5 h-5 ${activeViewTab === "active" ? "text-emerald-400" : "opacity-70"}`}
          />
          持有中 (<AnimatedNumber value={visibleActiveTabs.length} />)
        </button>
        <button
          onClick={() => setActiveViewTab("completed")}
          className={`h-[48px] snap-start flex-shrink-0 flex items-center justify-center gap-2 px-5 sm:px-6 py-3 font-bold text-base tracking-wide rounded-t-xl transition-all duration-300 relative overflow-hidden ${
            activeViewTab === "completed"
              ? "bg-blue-500/10 text-blue-400 border border-t-blue-500/30 border-x-blue-500/30 border-b-transparent shadow-[0_-10px_20px_rgba(59,130,246,0.05)]"
              : "bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 border border-transparent"
          }`}
        >
          {activeViewTab === "completed" && (
            <motion.div
              layoutId="tab-indicator-completed"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
            />
          )}
          <TrendingUp
            className={`w-5 h-5 ${activeViewTab === "completed" ? "text-blue-400" : "opacity-70"}`}
          />
          已完成 (<AnimatedNumber value={completedTabs.length} />)
        </button>
        <button
          onClick={() => setActiveViewTab("notes")}
          className={`h-[48px] snap-start flex-shrink-0 flex items-center justify-center gap-2 px-5 sm:px-6 py-3 font-bold text-base tracking-wide rounded-t-xl transition-all duration-300 relative overflow-hidden ${
            activeViewTab === "notes"
              ? "bg-amber-500/10 text-amber-400 border border-t-amber-500/30 border-x-amber-500/30 border-b-transparent shadow-[0_-10px_20px_rgba(245,158,11,0.05)]"
              : "bg-transparent text-white/50 hover:bg-white/5 hover:text-white/80 border border-transparent"
          }`}
        >
          {activeViewTab === "notes" && (
            <motion.div
              layoutId="tab-indicator-notes"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400"
            />
          )}
          <FileText
            className={`w-5 h-5 ${activeViewTab === "notes" ? "text-amber-400" : "opacity-70"}`}
          />
          操作備註
        </button>
      </div>

      <div className="space-y-6">
        {/* Search Dialog */}
        <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent className="glass-panel border-white/10 shadow-2xl bg-slate-900/90 backdrop-blur-3xl text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-bold text-xl text-white flex items-center gap-2">
                <Search className="h-5 w-5 text-emerald-400" />
                快速搜尋個股
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                autoFocus
                placeholder="輸入代號或名稱..."
                className="bg-white/5 border-white/10 text-white"
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
              <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1 scrollbar-hide">
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
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center font-bold text-xs rounded bg-white/10 text-white">
                          {t.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                            {t.symbol}
                          </p>
                          <p className="text-[10px] text-white/40 truncate max-w-[150px]">
                            {t.companyName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white/60">
                          ${t.currentPrice?.toLocaleString()}
                        </p>
                      </div>
                    </button>
                  ))}
                {tabs.filter((t) => t.status === "ACTIVE").length === 0 && (
                  <p className="text-center py-8 text-white/30 text-sm italic">
                    尚無持有中的個股
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Card Action Choice Dialog */}
        <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
          <DialogContent className="glass-panel border-white/10 shadow-2xl bg-[#0F0F12]/95 backdrop-blur-3xl text-white max-w-[320px] p-6 rounded-2xl border border-white/10">
            <DialogHeader className="mb-4">
              <DialogTitle className="font-black text-xl text-white flex items-center justify-center gap-2">
                {selectedActionTab?.symbol} 操作
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
                className="w-full py-4 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ExternalLink className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-sm text-white">檢視細節</p>
                    <p className="text-[10px] font-bold text-white/40">
                      進入個股詳情頁面
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
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
                className={`w-full py-4 px-4 border rounded-xl flex items-center justify-between transition-all group ${
                  selectedActionTab?.isFavoriteHighlight
                    ? "bg-[#B1C28D]/10 border-[#B1C28D]/30 hover:bg-[#B1C28D]/20"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                      selectedActionTab?.isFavoriteHighlight
                        ? "bg-[#B1C28D]/20"
                        : "bg-amber-500/20"
                    }`}
                  >
                    <Star
                      className={`w-5 h-5 ${selectedActionTab?.isFavoriteHighlight ? "text-[#B1C28D] fill-[#B1C28D]/50" : "text-amber-400"}`}
                    />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-sm text-white">
                      {selectedActionTab?.isFavoriteHighlight
                        ? "取消重點"
                        : "重點關注"}
                    </p>
                    <p className="text-[10px] font-bold text-white/40">
                      切換首頁卡片高亮狀態
                    </p>
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-all group-hover:translate-x-1 ${
                    selectedActionTab?.isFavoriteHighlight
                      ? "text-[#B1C28D]"
                      : "text-white/20 group-hover:text-amber-400"
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
                className={`w-full py-4 px-4 border rounded-xl flex items-center justify-between transition-all group ${
                  selectedActionTab?.isOperationConfirmed
                    ? "bg-[#A3A3A3]/20 border-[#A3A3A3]/50 hover:bg-[#A3A3A3]/30"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                      selectedActionTab?.isOperationConfirmed
                        ? "bg-[#A3A3A3]/30"
                        : "bg-emerald-500/20"
                    }`}
                  >
                    <CheckCircle2
                      className={`w-5 h-5 ${selectedActionTab?.isOperationConfirmed ? "text-white" : "text-emerald-400"}`}
                    />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-sm text-white">操作確認</p>
                    <p className="text-[10px] font-bold text-white/40">
                      切換首頁卡片顏色
                    </p>
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-all group-hover:translate-x-1 ${
                    selectedActionTab?.isOperationConfirmed
                      ? "text-white"
                      : "text-white/20 group-hover:text-emerald-400"
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
                className={`w-full py-4 px-4 border rounded-xl flex items-center justify-between transition-all group ${
                  selectedActionTab?.isDeviationConfirmed
                    ? "bg-[#F0D1B9]/20 border-[#F0D1B9]/50 hover:bg-[#F0D1B9]/30"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                      selectedActionTab?.isDeviationConfirmed
                        ? "bg-[#F0D1B9]/30"
                        : "bg-[#F0D1B9]/10"
                    }`}
                  >
                    <Star
                      className={`w-5 h-5 ${selectedActionTab?.isDeviationConfirmed ? "text-[#F0D1B9]" : "text-[#F0D1B9]/70"}`}
                    />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-sm text-white">乖離確認</p>
                    <p className="text-[10px] font-bold text-white/40">
                      更改卡片標題背景顏色
                    </p>
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-all group-hover:translate-x-1 ${
                    selectedActionTab?.isDeviationConfirmed
                      ? "text-[#F0D1B9]"
                      : "text-white/20 group-hover:text-[#F0D1B9]/70"
                  }`}
                />
              </button>

              <button
                onClick={() => {
                  if (selectedActionTab) {
                    setFlippedCards((prev) => ({
                      ...prev,
                      [selectedActionTab.id]: !prev[selectedActionTab.id],
                    }));
                    setIsActionDialogOpen(false);
                  }
                }}
                className="w-full py-4 px-4 border rounded-xl flex items-center justify-between transition-all group bg-white/5 border-white/10 hover:bg-white/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform bg-purple-500/20">
                    <Activity className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-sm text-white">數據圖視化</p>
                    <p className="text-[10px] font-bold text-white/40">
                      翻轉卡片檢視分批圖表
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 transition-all group-hover:translate-x-1 group-hover:text-purple-400" />
              </button>

              <button
                onClick={() => {
                  if (selectedActionTab && !isGeneratingSuggestion) {
                    handleSmartSuggestion(selectedActionTab);
                  }
                }}
                disabled={isGeneratingSuggestion}
                className="w-full py-4 px-4 border rounded-xl flex items-center justify-between transition-all group bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform bg-emerald-500/20">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-sm text-emerald-400">
                      {isGeneratingSuggestion ? "分析中..." : "AI 智能建議"}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-400/60">
                      動態取得操作備註分析並更新策略
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-400/50 transition-all group-hover:translate-x-1 group-hover:text-emerald-400" />
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
                  { key: "Shift + F", desc: "快速搜尋股票" },
                  { key: "Shift + H", desc: "切換全螢幕模式" },
                  { key: "Shift + 1", desc: "切換至 持有中 標籤" },
                  { key: "Shift + 3", desc: "切換至 已完成 標籤" },
                  { key: "Alt + 1", desc: "切換至 觀察中" },
                  { key: "Alt + 2", desc: "切換至 候選名單" },
                  { key: "Alt + 3", desc: "切換至 買進操作" },
                  { key: "Alt + 4", desc: "切換至 賣出操作" },
                  { key: "Alt + 5", desc: "切換至 平倉操作" },
                  { key: "Alt + 6", desc: "切換至 乖離名單" },
                  { key: "Alt + Z", desc: "翻面可見股票卡片" },
                  { key: "Shift + A", desc: "開啟 新增股票 對話框" },
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

        {activeViewTab === "active" && (
          <div id="active-cards-section" className="grid grid-cols-1 gap-6">
            <div className="space-y-4">
              <ScrollIn delay={0.2} translateY={20}>
                <div className="w-screen relative left-1/2 -translate-x-1/2 border-y border-emerald-500/10 bg-emerald-500/[0.01] flex flex-col group transition-all duration-500">
                  <div className="py-2 border-b border-emerald-500/10 w-full">
                    {/* Desktop/Tablet version */}
                    <div className="hidden md:flex max-w-6xl mx-auto px-4 items-center justify-between w-full">
                      <div className="flex items-center gap-4">
                        <div className="w-1.5 h-6 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        <div className="flex bg-black/30 p-1 border border-white/5 rounded-xl gap-1">
                          {(
                            [
                              "觀察中",
                              "候選名單",
                              "買進操作",
                              "賣出操作",
                              "平倉操作",
                              "乖離名單",
                            ] as const
                          ).map((tab) => {
                            const conf = holdingTabConfig[tab];
                            const TabIcon = conf.icon;
                            const tabCount = visibleActiveTabs.filter(
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
                                    : "text-white/50 hover:text-white hover:bg-white/5 border-transparent"
                                }`}
                              >
                                <TabIcon className="w-3.5 h-3.5" />
                                {tab}
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${
                                  isActive 
                                    ? conf.activeCountClass 
                                    : "bg-white/5 border-white/10 opacity-70"
                                }`}>
                                  <AnimatedNumber value={tabCount} />{" "}檔
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {hiddenActiveTabs.length > 0 && (
                          <span className="text-xs font-bold border border-white/10 bg-white/5 text-white/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                            <EyeOff className="w-3.5 h-3.5" />
                            已隱藏 {hiddenActiveTabs.length} 檔
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <InteractiveButton
                          noGlow
                          as="button"
                          onClick={() => setIsManageHiddenOpen(true)}
                          className="p-2 bg-white/5 border border-white/10 text-white/60 hover:text-white rounded-md transition-all cursor-pointer"
                        >
                          <Settings2 className="w-4 h-4" />
                        </InteractiveButton>
                        <Magnetic>
                          <Activity className="h-6 w-6 text-emerald-500 opacity-80" />
                        </Magnetic>
                      </div>
                    </div>

                    {/* Redesigned Premium Mobile version */}
                    <div className="flex md:hidden flex-col w-full gap-3.5 px-4 py-1.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.04] w-full">
                        <div className="flex items-center gap-2">
                          {hiddenActiveTabs.length > 0 && (
                            <span className="text-[10px] font-black border border-white/10 bg-white/5 text-white/40 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                              <EyeOff className="w-3 h-3 text-white/40" />
                              已隱藏 {hiddenActiveTabs.length} 檔
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <InteractiveButton
                            noGlow
                            as="button"
                            onClick={() => setIsManageHiddenOpen(true)}
                            className="px-2.5 py-1 bg-white/5 border border-white/10 text-white/60 hover:text-white rounded-lg transition-all text-[11px] flex items-center gap-1 font-extrabold cursor-pointer"
                          >
                            <Settings2 className="w-3 h-3" />
                            管理
                          </InteractiveButton>
                          <Activity className="h-4 w-4 text-emerald-500 opacity-60" />
                        </div>
                      </div>

                      <div className="relative w-full overflow-hidden">
                        {/* Smooth scroll masks */}
                        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-[#0d0e12]/90 to-transparent pointer-events-none z-10" />
                        <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-[#0d0e12]/90 to-transparent pointer-events-none z-10" />

                        <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-hide py-1 pl-4 pr-4 -mx-4 snap-x snap-mandatory">
                          {(
                            [
                              "觀察中",
                              "候選名單",
                              "買進操作",
                              "賣出操作",
                              "平倉操作",
                              "乖離名單",
                            ] as const
                          ).map((tab) => {
                            const conf = holdingTabConfig[tab];
                            const TabIcon = conf.icon;
                            const tabCount = visibleActiveTabs.filter(
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
                                    : "bg-white/[0.01] border-white/[0.04] text-white/50"
                                }`}
                              >
                                <TabIcon className={`w-3.5 h-3.5 ${isActive ? conf.colorClass : "text-white/40"}`} />
                                <span>{tab}</span>
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg border ${
                                    isActive
                                      ? conf.activeCountClass
                                      : "bg-white/5 border-white/10 opacity-60"
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
                          <DialogContent className="glass-panel border-white/10 shadow-2xl bg-slate-900/90 backdrop-blur-3xl text-white outline-none sm:max-w-3xl max-h-[80vh] overflow-y-auto overflow-x-hidden scrollbar-hide w-11/12 max-w-lg fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] !rounded-2xl z-50">
                            <DialogHeader>
                              <DialogTitle className="font-bold text-xl">
                                管理持有中股票
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-6 py-4">
                              <div className="flex bg-black/40 p-1 rounded-lg w-full overflow-x-auto scrollbar-hide mb-2 border border-white/5">
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
                                ).map((tab) => (
                                  <button
                                    key={tab}
                                    onClick={() => setActiveManageTab(tab)}
                                    className={`flex-shrink-0 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                                      activeManageTab === tab
                                        ? "bg-emerald-500/20 text-emerald-400 font-extrabold"
                                        : "text-white/50 hover:text-white/80 hover:bg-white/5"
                                    }`}
                                  >
                                    <span>{tab}</span>
                                    {tab === "持股監控" && (
                                      <span className="text-[10px] bg-emerald-500/25 px-1.5 py-0.5 rounded-full text-emerald-300 font-black border border-emerald-400/25">
                                        {hiddenActiveTabs.length}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                              <div className="space-y-3">
                                {(() => {
                                  const categoryTabs = activeManageTab === "持股監控"
                                    ? hiddenActiveTabs
                                    : activeTabs.filter(
                                        (t) => getDisplayHoldingStatus(t.holdingStatus) === activeManageTab
                                      );
                                  if (categoryTabs.length === 0) {
                                    return (
                                      <div className="text-center text-white/40 py-8 text-sm font-medium">
                                        {activeManageTab === "持股監控"
                                          ? "目前無隱藏的個股名單"
                                          : `此分類下沒有持有中股票`}
                                      </div>
                                    );
                                  }
                                  return categoryTabs.map((tab) => {
                                      const idx = activeTabs.findIndex(t => t.id === tab.id);
                                      return (
                                        <div
                                          className="flex flex-col gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors relative overflow-hidden"
                                          key={tab.id}
                                        >
                                          <div className="flex items-center justify-between z-10 w-full relative">
                                    <div className="flex items-center gap-3">
                                      <span
                                        className={`font-bold ${tab.isHidden ? "text-white/40 line-through" : "text-white"}`}
                                      >
                                        {tab.symbol}
                                      </span>
                                      {tab.tradeType === "simulated" ? (
                                        <Badge className="bg-amber-500/20 text-amber-500">
                                          模擬
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-emerald-500/20 text-emerald-500">
                                          真實
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => moveTabUp(idx)}
                                        disabled={idx === 0}
                                        className="p-1.5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="往上移"
                                      >
                                        <ArrowUp className="w-4 h-4 text-white/70" />
                                      </button>
                                      <button
                                        onClick={() => moveTabDown(idx)}
                                        disabled={idx === activeTabs.length - 1}
                                        className="p-1.5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="往下移"
                                      >
                                        <ArrowDown className="w-4 h-4 text-white/70" />
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
                                    ).map((cat) => (
                                      <button
                                        key={cat}
                                        onClick={() =>
                                          updateTab(tab.id, {
                                            holdingStatus: cat,
                                          })
                                        }
                                        className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${
                                          getDisplayHoldingStatus(
                                            tab.holdingStatus,
                                          ) === cat
                                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                            : "bg-white/5 text-white/50 hover:bg-white/10 border border-transparent"
                                        }`}
                                      >
                                        {cat}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-2 w-full relative">
                                    <button
                                      onClick={() =>
                                        updateTabHidden(tab.id, !tab.isHidden)
                                      }
                                      className={`flex-1 h-[48px] sm:h-[44px] rounded-lg sm:rounded-md border transition-all flex flex-row items-center justify-center gap-2 font-bold text-base sm:text-sm ${tab.isHidden ? "bg-white/10 border-white/20 text-white hover:bg-white/20" : "bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20"}`}
                                    >
                                      {tab.isHidden ? (
                                        <EyeOff className="w-5 h-5 sm:w-4 sm:h-4 opacity-50" />
                                      ) : (
                                        <Eye className="w-5 h-5 sm:w-4 sm:h-4" />
                                      )}
                                      {tab.isHidden ? "取消隱藏" : "隱藏"}
                                    </button>

                                    <button
                                      onClick={() => toggleTabGroup(tab)}
                                      className={`flex-1 h-[48px] sm:h-[44px] rounded-lg sm:rounded-md border transition-all flex flex-row items-center justify-center gap-2 font-bold text-base sm:text-sm ${tab.groupId ? "bg-purple-500/20 border-purple-500/30 text-purple-400 hover:bg-purple-500/30" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
                                    >
                                      <Link className="w-5 h-5 sm:w-4 sm:h-4" />
                                      {tab.groupId ? "解除區塊" : "區塊"}
                                    </button>

                                    {confirmDeleteId === tab.id ? (
                                      <div className="absolute right-0 top-0 bottom-0 bg-slate-900 border border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-end w-full rounded-lg sm:rounded-md px-1 py-1 sm:py-0 z-10 gap-2">
                                        <span className="text-white/70 text-sm font-medium mr-auto ml-3 hidden sm:inline">
                                          確定刪除?
                                        </span>
                                        <div className="flex gap-2 h-full w-full sm:w-auto">
                                          <button
                                            onClick={() =>
                                              setConfirmDeleteId(null)
                                            }
                                            className="flex-1 sm:flex-none p-2 px-3 h-full sm:h-[36px] rounded bg-white/10 text-white hover:bg-white/20 text-base sm:text-sm font-bold"
                                          >
                                            取消
                                          </button>
                                          <button
                                            onClick={() => {
                                              deleteTab(tab.id);
                                              setConfirmDeleteId(null);
                                            }}
                                            className="flex-1 sm:flex-none p-2 px-3 h-full sm:h-[36px] rounded bg-red-600 text-white hover:bg-red-700 text-base sm:text-sm font-bold"
                                          >
                                            確認刪除
                                          </button>
                                        </div>
                                      </div>
                                    ) : groupingTabId === tab.id ? (
                                      <div className="absolute right-0 top-0 bottom-0 bg-slate-900/95 border border-purple-500/50 shadow-xl flex flex-col items-center justify-center w-full rounded-lg px-2 py-2 z-10 gap-2 backdrop-blur-xl">
                                        <div className="text-white text-xs font-bold w-full text-center">選擇要連動的股票 (同一代號)</div>
                                        <div className="flex flex-wrap gap-2 w-full items-center justify-center">
                                           {activeTabs.filter(t => t.symbol === tab.symbol && t.id !== tab.id).length === 0 ? (
                                              <span className="text-red-400 text-xs">無其他相同代號的持有中股票</span>
                                           ) : (
                                              activeTabs.filter(t => t.symbol === tab.symbol && t.id !== tab.id).map(target => (
                                                 <button 
                                                    key={target.id}
                                                    onClick={(e) => { e.stopPropagation(); handleGroupWith(tab.id, target); }}
                                                    className={`px-3 py-1.5 border rounded-md text-xs font-bold transition-colors ${target.groupId ? "bg-purple-500/10 border-purple-500/30 text-purple-400" : "bg-white/10 hover:bg-white/20 border-white/20 text-white"}`}
                                                 >
                                                    {target.holdingStatus || '未分類'}
                                                 </button>
                                              ))
                                           )}
                                        </div>
                                        <button 
                                          onClick={() => setGroupingTabId(null)}
                                          className="absolute right-2 top-2 p-1 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded"
                                        >
                                          取消
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() =>
                                          setConfirmDeleteId(tab.id)
                                        }
                                        className="flex-1 h-[48px] sm:h-[44px] rounded-lg sm:rounded-md border transition-all bg-transparent sm:bg-red-500/5 border-red-500/20 text-red-500 hover:bg-red-500/10 flex flex-row items-center justify-center gap-2 font-bold text-base sm:text-sm"
                                      >
                                        <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
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
                                <div className="text-white/50 text-center py-4">
                                  目前無持有中股票
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                  <div className="bg-transparent w-full">
                    <div className="overflow-hidden w-full">
                      <div className="pt-0 pb-4 sm:pt-0 sm:pb-6 min-h-[200px] w-full">
                        <AnimatePresence mode="wait">
                          {currentSubTabVisibleTabs.length === 0 ? (
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
                            <div
                              ref={carouselRef}
                              className="relative w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide cursor-grab"
                              onMouseDown={onDragStart}
                            >
                              <div className="flex flex-nowrap gap-4 sm:gap-6 px-6 sm:px-[max(15%,calc((100vw-1152px)/2+16px))] pt-2 pb-4 w-max">
                                {renderGroups.map((group, groupIdx) => {
                                  const renderCard = (tab: any, idx: number) => {
                                    const plannedOrders =
                                    activeTabOrders[tab.id] || [];
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

                                  return (
                                    <div
                                      key={tab.id}
                                      id={`stock-card-${tab.id}`}
                                      className="card-wrapper shrink-0 w-[88vw] sm:w-[460px] min-h-[460px] flex flex-col snap-center transition-transform duration-500"
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
                                        setFlippedCards((prev) => ({
                                          ...prev,
                                          [tab.id]: !prev[tab.id],
                                        }));
                                      }}
                                    >
                                      <div
                                        className="card-inner-parallax w-full h-full min-h-[460px] flex flex-col"
                                        style={{ perspective: "1200px" }}
                                      >
                                        <motion.div
                                          layout
                                          initial={{ opacity: 0, y: 20 }}
                                          animate={{
                                            opacity: 1,
                                            y: 0,
                                            rotateY: flippedCards[tab.id]
                                              ? 180
                                              : 0,
                                          }}
                                          transition={{
                                            duration: 0.6,
                                            type: "spring",
                                            stiffness: 260,
                                            damping: 20,
                                            delay: idx * 0.05,
                                          }}
                                          key={tab.id}
                                          style={{
                                            transformStyle: "preserve-3d",
                                          }}
                                          className="relative w-full h-full flex-1 flex flex-col min-h-[460px] cursor-pointer"
                                        >
                                          {/* Front Face */}
                                          <div
                                            style={{
                                              backfaceVisibility: "hidden",
                                              pointerEvents: flippedCards[
                                                tab.id
                                              ]
                                                ? "none"
                                                : "auto",
                                              opacity: flippedCards[tab.id]
                                                ? 0
                                                : 1,
                                              transition:
                                                "opacity 0.2s ease-in-out",
                                            }}
                                            className="glass-card flex flex-col p-3 group/item relative overflow-hidden w-full h-full"
                                          >
                                            {/* No spotlight or glow overlays */}
                                            <div
                                              className="flex items-start justify-between relative z-10 w-full overflow-hidden transition-colors duration-500 rounded-lg p-2 -mx-2 -mt-2"
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
                                              style={{
                                                backgroundColor:
                                                  tab.isDeviationConfirmed
                                                    ? "#F0D1B9"
                                                    : tab.isOperationConfirmed
                                                      ? "#A3A3A3"
                                                      : tab.isFavoriteHighlight
                                                        ? "#B1C28D"
                                                        : shouldHighlightTitle
                                                          ? "#F5DAD5"
                                                          : "transparent",
                                              }}
                                            >
                                              <div className="flex items-start gap-4 w-full">
                                                <div className="flex flex-col w-full min-w-0">
                                                  {/* Row 1: Symbol & Name & Badge */}
                                                  <div className="flex items-baseline gap-2 mb-1">
                                                    <span
                                                      className={`font-black text-2xl tracking-tighter leading-none ${typeof tab.updatedAt?.toDate === 'function' && (new Date().getTime() - tab.updatedAt.toDate().getTime() > 17 * 60 * 60 * 1000) ? "text-red-500 animate-pulse font-bold" : tab.isDeviationConfirmed || tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "text-[#0F0F0F]" : "text-white"}`}
                                                    >
                                                      {tab.symbol}
                                                    </span>
                                                    {tab.updatedAt && (
                                                      <span className={`text-[9px] tracking-widest ml-1 ${typeof tab.updatedAt.toDate === 'function' && (new Date().getTime() - tab.updatedAt.toDate().getTime() > 17 * 60 * 60 * 1000) ? "text-red-500 animate-pulse font-bold" : tab.isDeviationConfirmed || tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "text-[#0F0F0F]/40" : "text-white/30"}`}>
                                                        {typeof tab.updatedAt.toDate === 'function' ? format(tab.updatedAt.toDate(), 'yyyy/MM/dd HH:mm') : ''}
                                                      </span>
                                                    )}
                                                    {tab.currentPrice !== undefined && (
                                                      <div className="flex items-baseline gap-2">
                                                        <span className={`text-lg font-black tabular-nums ${tab.isDeviationConfirmed || tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "text-[#0F0F0F]" : "text-white"}`}>
                                                          ${tab.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                        {unrealizedPnL !== 0 && (
                                                          <span className={`text-sm font-black tabular-nums ${unrealizedPnL > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                                            {unrealizedPnL > 0 ? "▲" : "▼"}{Math.abs(unrealizedPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                          </span>
                                                        )}
                                                      </div>
                                                    )}
                                                    {(() => {
                                                      const strat = activeTabStrategies[tab.id] || {};
                                                      if (strat.addChecked) {
                                                        return (
                                                          <div className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ml-auto bg-[#426B4A] text-white border border-[#426B4A]/40 shadow-[0_0_8px_rgba(66,107,74,0.3)] select-none">
                                                            加碼
                                                          </div>
                                                        );
                                                      } else if (strat.slChecked) {
                                                        return (
                                                          <div className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ml-auto bg-[#E04141] text-white border border-[#E04141]/40 shadow-[0_0_8px_rgba(224,65,65,0.3)] select-none">
                                                            止損
                                                          </div>
                                                        );
                                                      } else if (strat.closeChecked) {
                                                        return (
                                                          <div className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ml-auto bg-[#EBF527] text-black border border-[#EBF527]/40 shadow-[0_0_8px_rgba(235,245,39,0.3)] select-none">
                                                            平倉
                                                          </div>
                                                        );
                                                      } else if (strat.tpChecked) {
                                                        return (
                                                          <div className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ml-auto bg-[#35428C] text-white border border-[#35428C]/40 shadow-[0_0_8px_rgba(53,66,140,0.3)] select-none">
                                                            止盈
                                                          </div>
                                                        );
                                                      } else {
                                                        return (
                                                          <div
                                                            className={`flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full border uppercase tracking-widest ml-auto ${
                                                              tab.tradeType ===
                                                              "simulated"
                                                                ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                                                : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                                            }`}
                                                          >
                                                            {tab.tradeType === "simulated" ? (
                                                              <Gamepad2 className="h-2.5 w-2.5" />
                                                            ) : (
                                                              <ShieldCheck className="h-2.5 w-2.5" />
                                                            )}
                                                            {tab.tradeType === "simulated" ? "SIM" : "LIVE"}
                                                          </div>
                                                        );
                                                      }
                                                    })()}
                                                  </div>

                                                  {/* Row 2: Score & Sentiment Groups */}
                                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <div
                                                      className={`flex items-center border rounded-md overflow-hidden h-5 ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "border-black/10" : "border-white/10"}`}
                                                    >
                                                      <div
                                                        className={`px-1.5 h-full flex items-center border-r ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "bg-black/5 border-black/10" : "bg-white/5 border-white/10"}`}
                                                      >
                                                        <span
                                                          className={`text-[10px] font-black ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "text-amber-700" : "text-yellow-500"}`}
                                                        >
                                                          ★ {tab.rating || 8}
                                                        </span>
                                                      </div>
                                                      <div
                                                        className={`px-1.5 h-full flex items-center border-r ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "bg-black/5 border-black/10" : "bg-white/5 border-white/10"}`}
                                                      >
                                                        <span
                                                          className={`text-[10px] font-black ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "text-purple-700" : "text-purple-400"}`}
                                                        >
                                                          Q{" "}
                                                          {tab.qualityScore ||
                                                            5}
                                                        </span>
                                                      </div>
                                                      <div
                                                        className={`px-1.5 h-full flex items-center border-r ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "bg-black/5 border-black/10" : "bg-white/5 border-white/10"}`}
                                                      >
                                                        <span
                                                          className={`text-[10px] font-black ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "text-amber-700" : "text-amber-500"}`}
                                                        >
                                                          V{" "}
                                                          {tab.valueScore || 5}
                                                        </span>
                                                      </div>
                                                      <div
                                                        className={`px-1.5 h-full flex items-center bg-emerald-500/10 text-emerald-600`}
                                                      >
                                                        <span className="text-[10px] font-black">
                                                          B {tab.buyRate || 5}
                                                        </span>
                                                      </div>
                                                      <div
                                                        className={`px-1.5 h-full flex items-center bg-rose-500/10 text-rose-600`}
                                                      >
                                                        <span className="text-[10px] font-black">
                                                          S {tab.sellRate || 5}
                                                        </span>
                                                      </div>
                                                    </div>

                                                    <div
                                                      className={`flex items-center border rounded-md overflow-hidden h-5 ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "border-black/10" : "border-white/10"}`}
                                                    >
                                                      <div
                                                        className={`px-1.5 h-full flex items-center border-r ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "bg-black/5 border-black/10" : "bg-white/5 border-white/10"}`}
                                                      >
                                                        <span
                                                          className={`text-[10px] font-black ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "text-indigo-700" : "text-indigo-400"}`}
                                                        >
                                                          🌊{" "}
                                                          {tab.volatility ||
                                                            "中"}
                                                        </span>
                                                      </div>
                                                      <div
                                                        className={`px-1.5 h-full flex items-center border-r ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "bg-black/5 border-black/10" : "bg-white/5 border-white/10"}`}
                                                        title="Positive Value"
                                                      >
                                                        <span
                                                          className={`text-[10px] font-black ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "text-emerald-700" : "text-emerald-400"}`}
                                                        >
                                                          P+{" "}
                                                          {calculatePositiveValue(Number(tab.rating||5), Number(tab.qualityScore||5), Number(tab.valueScore||5), Number(tab.buyRate||5))}
                                                        </span>
                                                      </div>
                                                      <div
                                                        className={`px-1.5 h-full flex items-center ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "bg-black/5" : "bg-white/5"}`}
                                                        title="Negative Value"
                                                      >
                                                        <span
                                                          className={`text-[10px] font-black ${tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "text-red-700" : "text-red-400"}`}
                                                        >
                                                          N-{" "}
                                                          {calculateNegativeValue(Number(tab.rating||5), Number(tab.qualityScore||5), Number(tab.valueScore||5), Number(tab.sellRate||5))}
                                                        </span>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Right side: Action Button */}
                                              <div className="flex flex-col items-end justify-center self-stretch ml-2">
                                                <div className={`${tab.groupId ? 'opacity-100 translate-x-0' : 'opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 translate-x-0 sm:translate-x-4 sm:group-hover/item:translate-x-0'} transition-all duration-500 transform`}>
                                                  <button
                                                    className={`whitespace-nowrap text-sm font-black rounded-full px-5 py-2.5 sm:hover:scale-105 active:scale-95 transition-all ${tab.isDeviationConfirmed || tab.isOperationConfirmed || tab.isFavoriteHighlight || shouldHighlightTitle ? "bg-[#0F0F12] text-white" : "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]"} ${tab.tradeDirection === '看跌' ? '!bg-red-500 !text-white' : tab.tradeDirection === '看漲' ? '!bg-emerald-500 !text-white' : ''}`}
                                                  >
                                                    {tab.tradeDirection ? `${tab.tradeDirection}操作` : "檢視細節"}
                                                  </button>
                                                </div>
                                              </div>
                                            </div>

                                            {plannedOrders.length > 0 && (
                                              <div className="mt-2 pt-2 border-t border-white/10 relative z-10">
                                                <p className="text-[12px] font-medium text-white/40 mb-[6px] tracking-wide uppercase">
                                                  預定訂單 (
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
                                                                    ? "bg-red-400"
                                                                    : categoryType ===
                                                                        "止盈設定"
                                                                      ? "bg-emerald-400"
                                                                      : categoryType ===
                                                                            "支撐門檻" ||
                                                                          categoryType ===
                                                                            "壓力門檻"
                                                                        ? "bg-amber-400"
                                                                        : "bg-blue-400"
                                                                }`}
                                                              ></div>
                                                              <span
                                                                className={`text-[11px] font-bold tracking-widest uppercase leading-none ${
                                                                  categoryType ===
                                                                  "止損設定"
                                                                    ? "text-red-400/80"
                                                                    : categoryType ===
                                                                        "止盈設定"
                                                                      ? "text-emerald-400/80"
                                                                      : categoryType ===
                                                                            "支撐門檻" ||
                                                                          categoryType ===
                                                                            "壓力門檻"
                                                                        ? "text-amber-400/80"
                                                                        : "text-white/40"
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
                                                                        "bg-[#ED8900] text-[#0F0F0F] border-transparent shadow-[0_0_15px_rgba(237,137,0,0.5)]";
                                                                      borderClass =
                                                                        "";
                                                                    } else if (
                                                                      isStopLoss
                                                                    ) {
                                                                      colorClass =
                                                                        "border-[#D6B2AB]/20 text-[#D6B2AB] bg-[#D6B2AB]/5";
                                                                    } else if (
                                                                      isKeyPrice
                                                                    ) {
                                                                      colorClass =
                                                                        "bg-amber-500/5 border-amber-500/20 text-amber-400";
                                                                    } else {
                                                                      colorClass =
                                                                        order.direction ===
                                                                        "BUY"
                                                                          ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                                                                          : "bg-blue-500/5 border-blue-500/20 text-blue-400";
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
                                                                          handleToggleOrderHighlight(
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
                                                                                ? "bg-black/20 text-[#ED8900]"
                                                                                : "bg-amber-500/10 text-amber-400"
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
                                                  <p className="text-[12px] font-medium text-white/40 tracking-wide uppercase">
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
                                                        className={`text-[11px] rounded border px-[8px] py-[2px] flex items-center gap-[4px] backdrop-blur-md ${trade.type === "BUY" ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-blue-500/5 border-blue-500/20 text-blue-400"}`}
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
                                                          <span className="text-white/40 font-bold ml-0.5">(人)</span>
                                                        )}
                                                      </div>
                                                    ))}
                                                  {trades.length > 3 && (
                                                    <div className="text-[11px] rounded border border-white/10 px-[8px] py-[2px] flex items-center gap-[4px] text-white/40">
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
                                          </div>

                                          {/* Back Face */}
                                          <div
                                            style={{
                                              backfaceVisibility: "hidden",
                                              transform: "rotateY(180deg)",
                                              pointerEvents: flippedCards[tab.id]
                                                ? "auto"
                                                : "none",
                                              opacity: flippedCards[tab.id]
                                                ? 1
                                                : 0,
                                              transition: "opacity 0.2s ease-in-out",
                                            }}
                                            className={`absolute inset-0 glass-card bg-transparent rounded-2xl flex flex-col p-3 w-full h-full sm:hover:bg-white/[0.04] transition-all duration-500 ${
                                              activeTabStrategies[tab.id]?.closeChecked
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
                                            {/* 左側色條 & 頂部色條 */}
                                            {activeTabStrategies[tab.id]?.addChecked && (
                                              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#426B4A] z-30 rounded-l-2xl" />
                                            )}
                                            {activeTabStrategies[tab.id]?.slChecked && (
                                              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#E04141] z-30 rounded-l-2xl" />
                                            )}
                                            {activeTabStrategies[tab.id]?.closeChecked && (
                                              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#EBF527] z-30 rounded-l-2xl" />
                                            )}
                                            {activeTabStrategies[tab.id]?.tpChecked && (
                                              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#35428C] z-30 rounded-l-2xl" />
                                            )}

                                            <StockCardVisualizer
                                              plannedOrders={plannedOrders}
                                              currentPrice={tab.currentPrice}
                                              onToggleHighlight={(orderId, currentStatus) => handleToggleOrderHighlight(tab.id, orderId, currentStatus)}
                                              tabId={tab.id}
                                              annotations={tab.chartAnnotations || []}
                                              onUpdateAnnotations={(newAnn) => updateTab(tab.id, { chartAnnotations: newAnn })}
                                              averageCost={stats.totalQuantity !== 0 ? stats.averagePrice : undefined}
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
                                              onUpdateNotesHighlighted={(checked) => handleUpdateNotesHighlighted(tab.id, checked)}
                                            />

                                            {/* Corner label badge */}
                                            {(() => {
                                              const strat = activeTabStrategies[tab.id] || {};
                                              if (strat.addChecked) {
                                                return (
                                                  <div className="absolute -top-2.5 -left-2.5 z-40 flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#426B4A] text-white border border-[#426B4A]/50 shadow-[0_0_12px_rgba(66,107,74,0.6)] select-none">
                                                    加碼中
                                                  </div>
                                                );
                                              } else if (strat.slChecked) {
                                                return (
                                                  <div className="absolute -top-2.5 -left-2.5 z-40 flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#E04141] text-white border border-[#E04141]/50 shadow-[0_0_12px_rgba(224,65,65,0.6)] select-none">
                                                    止損中
                                                  </div>
                                                );
                                              } else if (strat.closeChecked) {
                                                return (
                                                  <div className="absolute -top-2.5 -left-2.5 z-40 flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#EBF527] text-black border border-[#EBF527]/50 shadow-[0_0_12px_rgba(235,245,39,0.6)] select-none">
                                                    平倉中
                                                  </div>
                                                );
                                              } else if (strat.tpChecked) {
                                                return (
                                                  <div className="absolute -top-2.5 -left-2.5 z-40 flex items-center text-[12px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider bg-[#35428C] text-white border border-[#35428C]/50 shadow-[0_0_12px_rgba(53,66,140,0.6)] select-none">
                                                    止盈中
                                                  </div>
                                                );
                                              }
                                              return null;
                                            })()}

                                            {/* Close back button */}
                                            <div className="absolute top-2 right-2">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setFlippedCards((prev) => ({
                                                    ...prev,
                                                    [tab.id]: false,
                                                  }));
                                                }}
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 sm:hover:bg-white/20 text-white/50 sm:hover:text-white transition-colors"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          </div>
                                        </motion.div>
                                      </div>
                                    </div>
                                  );
                                  };

                                  if (group.isGroup) {
                                    return (
                                      <div key={group.id} className="relative flex p-1.5 sm:p-2 bg-gradient-to-r from-white/[0.04] to-white/[0.01] border border-white/5 shadow-2xl rounded-[36px] shrink-0 gap-4 group/box transition-all">
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
                <div className="glass-panel overflow-hidden drop-shadow-2xl flex flex-col group transition-all duration-500 h-auto">
                  <div className="px-6 py-5 flex items-center justify-between bg-blue-500/[0.03] border-b border-blue-500/10">
                    <div className="flex items-center gap-4">
                      <div className="w-1.5 h-6 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                      <h3 className="font-bold text-xl tracking-tight text-white/90">
                        已完成
                      </h3>
                      <span className="text-xs font-bold border border-blue-500/30 bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                        <AnimatedNumber value={completedTabs.length} /> 檔
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
                      <button
                        type="button"
                        onClick={handleExportCompletedTabsJson}
                        disabled={isExportingCompleted}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 transition-all text-xs font-bold leading-none shadow-sm cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        匯出Json
                      </button>
                      <button
                        type="button"
                        onClick={() => completedJsonFileInputRef.current?.click()}
                        disabled={isImportingCompleted}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all text-xs font-bold leading-none shadow-sm cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        匯入Json
                      </button>
                      <Magnetic>
                        <TrendingUp className="h-6 w-6 text-blue-400 opacity-80 group-hover:text-blue-300 transition-colors" />
                      </Magnetic>
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
                              className="h-full flex flex-col items-center justify-center text-white/30 flex-1 py-16"
                            >
                              <div className="bg-white/5 p-5 border border-white/10 rounded-full mb-4">
                                <TrendingUp className="h-10 w-10 opacity-40" />
                              </div>
                              <p className="text-base font-bold text-white/50 tracking-wide">
                                尚無已完成交易
                              </p>
                            </motion.div>
                          ) : (
                            <div className="space-y-8">
                              {realCompletedTabs.length > 0 && (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_5px_rgba(52,211,153,0.5)]"></div>
                                    <h4 className="text-xs font-bold text-emerald-400/80 tracking-widest uppercase">
                                      真實交易
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
                                        className="glass-card flex items-center justify-between p-4 cursor-pointer relative overflow-hidden group/item border border-emerald-500/10 hover:border-emerald-500/30"
                                      >
                                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 sm:from-emerald-500/5 to-transparent opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity duration-500"></div>
                                        <div className="relative z-10 flex flex-col gap-1.5">
                                          <div className="font-black text-xl tracking-wide text-white/90">
                                            {tab.symbol}
                                          </div>
                                        </div>
                                        <div
                                          className={`relative z-10 text-xl font-black ${tab.finalPnL && tab.finalPnL >= 0 ? "text-emerald-400 color-glow-emerald" : "text-red-400 color-glow-red"}`}
                                        >
                                          {tab.finalPnL && tab.finalPnL >= 0
                                            ? "+"
                                            : ""}
                                          ${tab.finalPnL?.toLocaleString() || 0}
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
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-400/80 shadow-[0_0_5px_rgba(251,191,36,0.5)]"></div>
                                    <h4 className="text-xs font-bold text-amber-400/80 tracking-widest uppercase">
                                      模擬交易
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
                                          className="glass-card flex items-center justify-between p-4 cursor-pointer relative overflow-hidden group/item border border-amber-500/10 hover:border-amber-500/30"
                                        >
                                          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 sm:from-amber-500/5 to-transparent opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity duration-500"></div>
                                          <div className="relative z-10 flex flex-col gap-1.5">
                                            <div className="font-black text-xl tracking-wide text-white/90">
                                              {tab.symbol}
                                            </div>
                                          </div>
                                          <div
                                            className={`relative z-10 text-xl font-black ${tab.finalPnL && tab.finalPnL >= 0 ? "text-emerald-400 color-glow-emerald" : "text-red-400 color-glow-red"}`}
                                          >
                                            {tab.finalPnL && tab.finalPnL >= 0
                                              ? "+"
                                              : ""}
                                            $
                                            {tab.finalPnL?.toLocaleString() ||
                                              0}
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

        

        {activeViewTab === "notes" && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Intro block */}
            <div className="glass-panel p-5 sm:p-6 rounded-3xl sm:rounded-[2rem] border border-white/5 bg-[#0F0F12]/80 backdrop-blur-xl overflow-hidden shadow-2xl relative">
              <div className="absolute top-0 left-1/4 -translate-y-1/2 w-96 h-48 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none"></div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-4 relative z-10 w-full">
                <div className="space-y-1.5 w-full sm:w-auto">
                  <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2.5 whitespace-nowrap">
                    <div className="w-1.5 h-6 shrink-0 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.5)]"></div>
                    個股操作備註總覽
                  </h2>
                  <p className="text-xs text-white/40 leading-relaxed">
                    整合所有持有中個股的執行計畫與操作備註，依據目前所屬的交易進度分類呈現。
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0 justify-start sm:justify-end">
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    ref={notesJsonFileInputRef}
                    onChange={handleImportNotesJson}
                  />
                  <button
                    type="button"
                    onClick={handleExportNotesJson}
                    disabled={isExportingNotes}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 transition-all text-xs font-bold leading-none shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    匯出Json
                  </button>
                  <button
                    type="button"
                    onClick={() => notesJsonFileInputRef.current?.click()}
                    disabled={isImportingNotes}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all text-xs font-bold leading-none shadow-sm cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    匯入Json
                  </button>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                    共 {visibleActiveTabs.length} 檔個股
                  </span>
                </div>
              </div>
            </div>

            {/* Categories and tables */}
            {(() => {
              const categories: ("觀察中" | "候選名單" | "買進操作" | "賣出操作" | "平倉操作" | "乖離名單")[] = [
                "觀察中",
                "候選名單",
                "買進操作",
                "賣出操作",
                "平倉操作",
                "乖離名單"
              ];
              
              const filledCategories = categories.filter(cat => 
                visibleActiveTabs.some(t => getDisplayHoldingStatus(t.holdingStatus) === cat)
              );

              if (filledCategories.length === 0) {
                return (
                  <div className="text-center py-12 glass-panel rounded-[2rem]">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-6 h-6 text-white/30" />
                    </div>
                    <p className="text-white/50 font-bold text-sm">目前尚無任何持有中的股票</p>
                    <p className="text-white/30 text-xs mt-1">請先至「持有中」頁面新增或個股設定交易階段</p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {filledCategories.map((cat) => {
                    const filteredTabs = visibleActiveTabs.filter(
                      (t) => getDisplayHoldingStatus(t.holdingStatus) === cat
                    );
                    const isExpanded = !!notesExpandedCategories[cat];
                    const highlightedStocksInCat = filteredTabs.filter(
                      (t) => !!activeTabStrategies[t.id]?.notesHighlighted
                    );

                    return (
                      <div
                        key={cat}
                        className="glass-panel rounded-[2rem] border border-white/5 bg-[#0F0F12]/60 overflow-hidden shadow-xl"
                      >
                        {/* Section Header */}
                        <div 
                          className={`px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.03] select-none transition-colors duration-200 ${
                            isExpanded ? "border-b border-white/5 bg-white/[0.02]" : ""
                          }`}
                          onClick={() => toggleNotesCategory(cat)}
                        >
                          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-black text-white/95">
                                {cat}
                              </span>
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-white/10 text-white/60">
                                {filteredTabs.length}
                              </span>
                            </div>
                            
                            {highlightedStocksInCat.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 ml-1 border-l border-white/10 pl-3">
                                {highlightedStocksInCat.map((tab) => {
                                  const strat = activeTabStrategies[tab.id] || {};
                                  const actions = [];
                                  if (strat.tpChecked) actions.push({ label: "止盈", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" });
                                  if (strat.slChecked) actions.push({ label: "止損", color: "bg-rose-500/15 text-rose-400 border-rose-500/30" });
                                  if (strat.addChecked) actions.push({ label: "加碼", color: "bg-sky-500/15 text-sky-400 border-sky-500/30" });
                                  if (strat.closeChecked) actions.push({ label: "平倉", color: "bg-violet-500/15 text-violet-400 border-violet-500/30" });
                                  
                                  return (
                                    <div 
                                      key={tab.id}
                                      onClick={(e) => {
                                        // Prevent clicking the stock badge from collapsing/expanding the accordion
                                        e.stopPropagation();
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold"
                                    >
                                      <span className="text-amber-400 whitespace-nowrap">{tab.symbol}</span>
                                      <span className="text-white/40 font-medium max-w-[60px] truncate hidden md:inline">({tab.companyName || "-"})</span>
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
                          <div className="flex items-center justify-center p-1 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all shrink-0">
                            <ChevronDown 
                              className={`w-4 h-4 text-white/50 transition-transform duration-300 ${
                                isExpanded ? "rotate-180 text-amber-400" : ""
                              }`}
                            />
                          </div>
                        </div>

                        {/* Collapsible Content */}
                        {isExpanded && (
                          <div className="border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                            {/* Mobile Card View */}
                            <div className="flex flex-col lg:hidden divide-y divide-white/5">
                              {filteredTabs.map((tab) => {
                                const isHighlighted = !!activeTabStrategies[tab.id]?.notesHighlighted;
                                const trades = activeTabTrades[tab.id] || [];
                                const stats = calculateStats(trades, tab.currentPrice);
                                const unrealizedPnL = stats.unrealizedPnL || 0;
                                
                                return (
                                  <div 
                                    key={`mobile-note-${tab.id}`}
                                    className={`p-4 transition-colors duration-200 ${
                                      isHighlighted ? "bg-[#F29657]/15" : "hover:bg-white/[0.02]"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={isHighlighted}
                                          onChange={(e) => handleUpdateNotesHighlighted(tab.id, e.target.checked)}
                                          className="h-5 w-5 rounded border border-white/20 bg-white/5 checked:bg-[#F29657] checked:border-[#F29657] text-[#F29657] focus:ring-0 cursor-pointer accent-[#F29657] transition-all shrink-0"
                                        />
                                        <div className="flex flex-col">
                                          <span className="text-base font-black text-white tracking-wider">
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
                                            className="text-[11px] font-semibold text-white/50 hover:text-amber-400 truncate max-w-[160px] cursor-pointer transition-colors mt-0.5"
                                          >
                                            {tab.companyName || tab.symbol}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-right flex flex-col items-end">
                                        <span className="text-sm font-mono text-white/95 font-bold">
                                          {tab.currentPrice !== undefined && tab.currentPrice > 0 ? tab.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                        </span>
                                        <span className="text-[10px] text-white/40 mt-1 uppercase font-bold tracking-wider">現價</span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 mb-4 bg-black/20 p-3.5 rounded-xl border border-white/5">
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-white/40 uppercase mb-1.5 tracking-wider">平均成本</span>
                                        <span className="text-xs font-mono text-white/90">
                                          {Math.abs(stats.totalQuantity) > 0 && stats.averagePrice > 0 ? stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                        </span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-white/40 uppercase mb-1.5 tracking-wider">未實現損益</span>
                                        <span className="text-xs font-mono font-bold">
                                          {Math.abs(stats.totalQuantity) > 0 && unrealizedPnL !== 0 ? (
                                            <span className={unrealizedPnL > 0 ? "text-emerald-400" : "text-rose-400"}>
                                              {unrealizedPnL > 0 ? "+" : ""}{unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                          ) : (
                                            <span className="text-white/40">-</span>
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex flex-col text-right">
                                        <span className="text-[10px] font-bold text-white/40 uppercase mb-1.5 tracking-wider">持有股數</span>
                                        <span className="text-xs font-mono text-white/90">
                                          {Math.abs(stats.totalQuantity) > 0 ? stats.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "-"}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 mb-4">
                                      <div className="flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-xl py-2.5">
                                        <span className="text-[10px] font-bold text-white/50 mb-2">止盈</span>
                                        <input type="checkbox" checked={!!activeTabStrategies[tab.id]?.tpChecked} onChange={(e) => handleUpdateTPChecked(tab.id, e.target.checked)} className="h-4 w-4 rounded border border-white/20 bg-white/5 checked:bg-emerald-500 checked:border-emerald-500 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500 transition-all" />
                                      </div>
                                      <div className="flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-xl py-2.5">
                                        <span className="text-[10px] font-bold text-white/50 mb-2">止損</span>
                                        <input type="checkbox" checked={!!activeTabStrategies[tab.id]?.slChecked} onChange={(e) => handleUpdateSLChecked(tab.id, e.target.checked)} className="h-4 w-4 rounded border border-white/20 bg-white/5 checked:bg-rose-500 checked:border-rose-500 text-rose-500 focus:ring-0 cursor-pointer accent-rose-500 transition-all" />
                                      </div>
                                      <div className="flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-xl py-2.5">
                                        <span className="text-[10px] font-bold text-white/50 mb-2">加碼</span>
                                        <input type="checkbox" checked={!!activeTabStrategies[tab.id]?.addChecked} onChange={(e) => handleUpdateAddChecked(tab.id, e.target.checked)} className="h-4 w-4 rounded border border-white/20 bg-white/5 checked:bg-sky-500 checked:border-sky-500 text-sky-500 focus:ring-0 cursor-pointer accent-sky-500 transition-all" />
                                      </div>
                                      <div className="flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-xl py-2.5">
                                        <span className="text-[10px] font-bold text-white/50 mb-2">平倉</span>
                                        <input type="checkbox" checked={!!activeTabStrategies[tab.id]?.closeChecked} onChange={(e) => handleUpdateCloseChecked(tab.id, e.target.checked)} className="h-4 w-4 rounded border border-white/20 bg-white/5 checked:bg-violet-500 checked:border-violet-500 text-violet-500 focus:ring-0 cursor-pointer accent-violet-500 transition-all" />
                                      </div>
                                    </div>

                                    <div>
                                      <span className="text-[10px] font-bold text-white/40 uppercase mb-2 block tracking-wider">操作重點</span>
                                      <textarea
                                        value={activeTabStrategies[tab.id]?.operationFocus || ""}
                                        onChange={(e) => handleUpdateOperationFocus(tab.id, e.target.value)}
                                        placeholder="點擊輸入操作重點..."
                                        rows={2}
                                        className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-amber-500/50 text-white text-xs rounded-xl p-3 focus:ring-1 focus:ring-amber-500/50 outline-none resize-y transition-colors min-h-[56px] font-medium [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] overflow-auto"
                                        style={{ scrollbarWidth: "none" }}
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
                                <tr className="border-b border-white/5 bg-white/[0.01]">
                                  <th className="w-[140px] py-3 px-6 text-[10px] font-black text-white/40 uppercase tracking-wider">
                                    選取 / 股票代號
                                  </th>
                                  <th className="w-[150px] py-3 px-4 text-[10px] font-black text-white/40 uppercase tracking-wider">
                                    股票名稱
                                  </th>
                                  <th className="w-[100px] py-3 px-4 text-[10px] font-black text-white/40 uppercase tracking-wider text-right">
                                    現價
                                  </th>
                                  <th className="w-[100px] py-3 px-4 text-[10px] font-black text-white/40 uppercase tracking-wider text-right">
                                    平均成本
                                  </th>
                                  <th className="w-[110px] py-3 px-4 text-[10px] font-black text-white/40 uppercase tracking-wider text-right">
                                    未實現損益
                                  </th>
                                  <th className="w-[100px] py-3 px-4 text-[10px] font-black text-white/40 uppercase tracking-wider text-right">
                                    持有股數
                                  </th>
                                  <th className="w-[75px] py-3 px-4 text-[10px] font-black text-white/40 uppercase tracking-wider text-center">
                                    止盈
                                  </th>
                                  <th className="w-[75px] py-3 px-4 text-[10px] font-black text-white/40 uppercase tracking-wider text-center">
                                    止損
                                  </th>
                                  <th className="w-[75px] py-3 px-4 text-[10px] font-black text-white/40 uppercase tracking-wider text-center">
                                    加碼
                                  </th>
                                  <th className="w-[75px] py-3 px-4 text-[10px] font-black text-white/40 uppercase tracking-wider text-center">
                                    平倉
                                  </th>
                                  <th className="py-3 px-4 text-[10px] font-black text-white/40 uppercase tracking-wider">
                                    操作重點
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
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
                                          ? "bg-[#F29657]/15 hover:bg-[#F29657]/20"
                                          : "hover:bg-white/[0.02]"
                                      }`}
                                    >
                                      <td className="py-3.5 px-6 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                          <input
                                            type="checkbox"
                                            checked={isHighlighted}
                                            onChange={(e) => handleUpdateNotesHighlighted(tab.id, e.target.checked)}
                                            className="h-4 w-4 rounded border border-white/20 bg-white/5 checked:bg-[#F29657] checked:border-[#F29657] text-[#F29657] focus:ring-0 cursor-pointer accent-[#F29657] transition-all"
                                          />
                                          <span className="text-xs font-bold text-white tracking-wide">
                                            {tab.symbol}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-3.5 px-4">
                                        <span 
                                          onClick={() => {
                                            handleSearchSelect(tab.id);
                                            setFlippedCards((prev) => ({
                                              ...prev,
                                              [tab.id]: true,
                                            }));
                                          }}
                                          className="text-xs font-semibold text-white/70 hover:text-amber-400 block truncate cursor-pointer transition-colors duration-200 hover:underline" 
                                          title="點擊前往持有中該股卡片並翻面數據圖示化"
                                        >
                                          {tab.companyName || tab.symbol}
                                        </span>
                                      </td>
                                      <td className="py-3.5 px-4 text-right font-mono text-xs text-white/90">
                                        {tab.currentPrice !== undefined && tab.currentPrice > 0 ? tab.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                      </td>
                                      <td className="py-3.5 px-4 text-right font-mono text-xs text-white/90">
                                        {Math.abs(stats.totalQuantity) > 0 && stats.averagePrice > 0 ? stats.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                      </td>
                                      <td className="py-3.5 px-4 text-right font-mono text-xs">
                                        {Math.abs(stats.totalQuantity) > 0 && unrealizedPnL !== 0 ? (
                                          <span className={`${unrealizedPnL > 0 ? "text-emerald-400" : "text-rose-400"} font-semibold`}>
                                            {unrealizedPnL > 0 ? "+" : ""}{unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </span>
                                        ) : (
                                          <span className="text-white/30">-</span>
                                        )}
                                      </td>
                                      <td className="py-3.5 px-4 text-right font-mono text-xs text-white/90">
                                        {Math.abs(stats.totalQuantity) > 0 ? stats.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "-"}
                                      </td>
                                      <td className="py-3.5 px-4 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.tpChecked}
                                          onChange={(e) => handleUpdateTPChecked(tab.id, e.target.checked)}
                                          className="h-5 w-5 rounded border border-white/20 bg-white/5 checked:bg-emerald-500 checked:border-emerald-500 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500 transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-3.5 px-4 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.slChecked}
                                          onChange={(e) => handleUpdateSLChecked(tab.id, e.target.checked)}
                                          className="h-5 w-5 rounded border border-white/20 bg-white/5 checked:bg-rose-500 checked:border-rose-500 text-rose-500 focus:ring-0 cursor-pointer accent-rose-500 transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-3.5 px-4 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.addChecked}
                                          onChange={(e) => handleUpdateAddChecked(tab.id, e.target.checked)}
                                          className="h-5 w-5 rounded border border-white/20 bg-white/5 checked:bg-sky-500 checked:border-sky-500 text-sky-500 focus:ring-0 cursor-pointer accent-sky-500 transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-3.5 px-4 text-center">
                                        <input
                                          type="checkbox"
                                          checked={!!activeTabStrategies[tab.id]?.closeChecked}
                                          onChange={(e) => handleUpdateCloseChecked(tab.id, e.target.checked)}
                                          className="h-5 w-5 rounded border border-white/20 bg-white/5 checked:bg-violet-500 checked:border-violet-500 text-violet-500 focus:ring-0 cursor-pointer accent-violet-500 transition-all mx-auto"
                                        />
                                      </td>
                                      <td className="py-2.5 px-4">
                                        <textarea
                                          value={activeTabStrategies[tab.id]?.operationFocus || ""}
                                          onChange={(e) => handleUpdateOperationFocus(tab.id, e.target.value)}
                                          placeholder="點擊輸入操作重點..."
                                          rows={2}
                                          className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-amber-400 text-white text-xs rounded-lg p-2 focus:ring-1 focus:ring-amber-400 outline-none resize-y transition-colors min-h-[42px] font-medium [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] overflow-auto"
                                          style={{ scrollbarWidth: "none" }}
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
        )}
      </div>

      {/* Operation Focus and Flip Dialog */}
      <Dialog
        open={!!visualizerFocusTabId}
        onOpenChange={(open) => {
          if (!open) setVisualizerFocusTabId(null);
        }}
      >
        <DialogContent className="glass-panel border-white/10 shadow-2xl bg-[#09090c]/98 backdrop-blur-3xl text-white max-w-[420px] p-6 rounded-3xl border border-white/15">
          <DialogHeader className="mb-4">
            <DialogTitle className="font-extrabold text-xl text-white flex items-center justify-center gap-2">
              <span className="text-xl">📊</span>
              {(() => {
                const t = tabs.find((x) => x.id === visualizerFocusTabId);
                return t ? `${t.symbol} 操作設定` : "個股操作設定";
              })()}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-amber-400 tracking-wider flex items-center gap-1.5 font-sans">
                <span>📝 編輯個股操作重點</span>
              </label>
              <textarea
                value={visualizerFocusText}
                onChange={(e) => setVisualizerFocusText(e.target.value)}
                placeholder="在此編輯您的操作策略或關鍵觀察..."
                className="w-full h-36 bg-white/[0.03] border border-white/10 focus:border-amber-400/50 text-white placeholder-white/20 text-sm rounded-xl p-3 focus:ring-1 focus:ring-amber-400/30 outline-none resize-none transition-all font-medium font-sans"
              />
            </div>
            {visualizerFocusTabId && (
              <div className="grid grid-cols-5 gap-2">
                <div className="flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-xl py-2.5 hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => handleUpdateNotesHighlighted(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.notesHighlighted)}>
                  <span className="text-[10px] font-bold text-white/50 mb-2 pointer-events-none">選取</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.notesHighlighted} onChange={(e) => handleUpdateNotesHighlighted(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border border-white/20 bg-white/5 checked:bg-amber-500 checked:border-amber-500 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500 transition-all" />
                </div>
                <div className="flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-xl py-2.5 hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => handleUpdateTPChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.tpChecked)}>
                  <span className="text-[10px] font-bold text-white/50 mb-2 pointer-events-none">止盈</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.tpChecked} onChange={(e) => handleUpdateTPChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border border-white/20 bg-white/5 checked:bg-emerald-500 checked:border-emerald-500 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500 transition-all" />
                </div>
                <div className="flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-xl py-2.5 hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => handleUpdateSLChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.slChecked)}>
                  <span className="text-[10px] font-bold text-white/50 mb-2 pointer-events-none">止損</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.slChecked} onChange={(e) => handleUpdateSLChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border border-white/20 bg-white/5 checked:bg-rose-500 checked:border-rose-500 text-rose-500 focus:ring-0 cursor-pointer accent-rose-500 transition-all" />
                </div>
                <div className="flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-xl py-2.5 hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => handleUpdateAddChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.addChecked)}>
                  <span className="text-[10px] font-bold text-white/50 mb-2 pointer-events-none">加碼</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.addChecked} onChange={(e) => handleUpdateAddChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border border-white/20 bg-white/5 checked:bg-sky-500 checked:border-sky-500 text-sky-500 focus:ring-0 cursor-pointer accent-sky-500 transition-all" />
                </div>
                <div className="flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-xl py-2.5 hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => handleUpdateCloseChecked(visualizerFocusTabId, !activeTabStrategies[visualizerFocusTabId]?.closeChecked)}>
                  <span className="text-[10px] font-bold text-white/50 mb-2 pointer-events-none">平倉</span>
                  <input type="checkbox" checked={!!activeTabStrategies[visualizerFocusTabId]?.closeChecked} onChange={(e) => handleUpdateCloseChecked(visualizerFocusTabId, e.target.checked)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded border border-white/20 bg-white/5 checked:bg-violet-500 checked:border-violet-500 text-violet-500 focus:ring-0 cursor-pointer accent-violet-500 transition-all" />
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
              className="w-full py-3 px-4 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
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
              className="w-full py-3 px-4 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.05)]"
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
                className="py-2.5 px-3 bg-white/5 hover:bg-white/10 text-white/80 border border-white/5 hover:border-white/10 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>僅翻回前面</span>
              </button>
              
              <button
                onClick={() => setVisualizerFocusTabId(null)}
                className="py-2.5 px-3 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 border border-transparent hover:border-red-500/10 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>取消</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
